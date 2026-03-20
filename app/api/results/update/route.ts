import { NextResponse } from "next/server";
import { adminSupabase } from "@/utils/supabase/admin";
import { apiCache } from "@/lib/cache";
import { finalizeSeasonIfComplete, getSeasonTeamForDriver } from "@/lib/season-lifecycle";

/**
 * Point mappings for different event types
 */
const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];  // Top 10 for races
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];           // Top 8 for sprints

/**
 * PUT /api/results/update?track={trackId}
 * 
 * Updates existing race results for a track.
 * This is a complex operation that must maintain point integrity.
 * 
 * Query Parameters:
 * - track: The selected_track.id (required)
 * 
 * Request Body:
 * {
 *   trackType: 'Race' | 'Sprint',
 *   results: Array<{
 *     driverId: string,
 *     position: number,
 *     pole: boolean,
 *     fastestLap: boolean,
 *     racefinished: boolean
 *   }>
 * }
 * 
 * Process (Critical for maintaining accurate points):
 * 1. Fetch existing results from database
 * 2. Fetch rules configuration
 * 3. REVERT old points:
 *    - For each existing result, calculate what points were awarded
 *    - Subtract those points from driver and team totals
 *    - IMPORTANT: Use the CORRECT event type from the existing result
 * 4. Delete old results from database
 * 5. INSERT new results:
 *    - Calculate points for new results
 *    - Add points to driver and team totals
 * 6. Return success
 * 
 * Why this is complex:
 * - Must correctly revert old points before adding new ones
 * - Must handle both Race and Sprint point systems
 * - Must respect rules configuration (pole/fastest lap bonuses)
 * - Must update both driver and team standings
 */
export async function PUT(request: Request) {
    // Extract track ID from query parameters
    const { searchParams } = new URL(request.url);
    const track = searchParams.get("track");

    // Validate required parameter
    if (!track) {
        return NextResponse.json({ error: "No track specified" }, { status: 400 });
    }

    // Parse request body
    const { trackType, results, seasonId } = await request.json();
    // Resolve season_id from payload or selected track relationship.
    let resolvedSeasonId: string | null = seasonId || null;
    if (!resolvedSeasonId) {
        const { data: selectedTrackRow } = await adminSupabase
            .from("selected_tracks")
            .select("season_id")
            .eq("id", track)
            .maybeSingle();
        resolvedSeasonId = selectedTrackRow?.season_id || null;
    }
    console.log("PUT /api/results/update payload:", { track, trackType, seasonId, results });

    const eventType = trackType || 'Race';
    console.log("Event type:", eventType);

    // STEP 1: Fetch existing results that we need to revert
    // IMPORTANT: scope by season_id (when available) so updating one season
    // does not overwrite results from other seasons for the same track.
    let existingResultsQuery = adminSupabase.from("results").select("*").eq("track", track);
    if (resolvedSeasonId) {
        existingResultsQuery = existingResultsQuery.eq("season_id", resolvedSeasonId);
    }
    const { data: existingResults, error: fetchError } = await existingResultsQuery;

    if (fetchError) {
        console.error("Error fetching existing results:", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // STEP 2: Fetch rules configuration
    // Rules determine if pole and fastest lap award bonus points
    const { data: rules, error: rulesError } = await adminSupabase
        .from('rules')
        .select('polegivespoint, fastestlapgivespoint')
        .eq('id', 1)
        .single();
        
    if (rulesError) {
        console.error('Error fetching rules:', rulesError);
        return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    // STEP 3: Revert points from existing results
    // This is CRITICAL - we must subtract the old points before adding new ones
    for (const existingResult of existingResults || []) {
        if (!existingResult.driver) continue;

        // We need to determine what event type THIS specific result was for
        // Get the selected_track to know if it was a sprint or race
        const { data: existingTrackData } = await adminSupabase
            .from('selected_tracks')
            .select('type')
            .eq('id', track)
            .single();

        const existingEventType = existingTrackData?.type || 'Race';

        // Calculate points that were previously awarded using the CORRECT event type
        const pointsMapping = existingEventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
        const maxPositions = existingEventType === 'Sprint' ? 8 : 10;

        const priorPos = (existingResult as any).finishing_position ?? existingResult.position;
        const basePoints = priorPos <= maxPositions ? pointsMapping[(priorPos || 0) - 1] : 0;

        // Only add bonus points if the driver finished the race
        const bonusPoints = existingResult.racefinished !== false
            ? (rules.polegivespoint && existingResult.pole ? 1 : 0) + (rules.fastestlapgivespoint && existingResult.fastestlap ? 1 : 0)
            : 0;

        const totalPoints = existingResult.racefinished !== false ? basePoints + bonusPoints : 0;

        console.log(`Reverting for driver ${existingResult.driver}: eventType=${existingEventType}, position=${priorPos}, basePoints=${basePoints}, bonusPoints=${bonusPoints}, totalPoints=${totalPoints}, racefinished=${existingResult.racefinished}`);

        // Subtract these points from the driver (season-scoped when possible).
        let currentPoints = 0;
        let driverTeamId: string | null = null;

        if (resolvedSeasonId) {
            const { data: seasonDriverData, error: driverFetchError } = await adminSupabase
                .from("season_drivers")
                .select("points, team_id")
                .eq("season_id", resolvedSeasonId)
                .eq("driver_id", existingResult.driver)
                .single();

            if (driverFetchError) {
                // If the row doesn't exist, keep 0 and still attempt to revert by using historical team_id.
                currentPoints = 0;
                driverTeamId = null;
            } else {
                currentPoints = seasonDriverData?.points ?? 0;
                driverTeamId = seasonDriverData?.team_id ?? null;
            }

            const { error: revertError } = await adminSupabase
                .from("season_drivers")
                .update({ points: Math.max(0, currentPoints - totalPoints) })
                .eq("season_id", resolvedSeasonId)
                .eq("driver_id", existingResult.driver);

            if (revertError) {
                console.error("Error reverting season driver points:", revertError);
                return NextResponse.json({ error: revertError.message }, { status: 500 });
            }
        } else {
            const { data: driverData, error: driverFetchError } = await adminSupabase
                .from("drivers")
                .select("points, team")
                .eq("id", existingResult.driver)
                .single();

            if (driverFetchError) {
                console.error("Error fetching driver points for revert:", driverFetchError);
                return NextResponse.json({ error: driverFetchError.message }, { status: 500 });
            }

            currentPoints = driverData?.points || 0;
            driverTeamId = driverData?.team ?? null;

            const { error: revertError } = await adminSupabase
                .from("drivers")
                .update({ points: Math.max(0, currentPoints - totalPoints) })
                .eq("id", existingResult.driver);

            if (revertError) {
                console.error("Error reverting driver points:", revertError);
                return NextResponse.json({ error: revertError.message }, { status: 500 });
            }
        }

        console.log(`Reverted ${totalPoints} points from driver ${existingResult.driver}`);

        // Revert constructor points from the team recorded on this historical result.
        const teamIdToRevert: string | null =
            (existingResult as any).team_id ?? driverTeamId ?? null;

        if (teamIdToRevert) {
            if (resolvedSeasonId) {
                const { data: seasonTeamData, error: teamFetchError } = await adminSupabase
                    .from("season_teams")
                    .select("points")
                    .eq("season_id", resolvedSeasonId)
                    .eq("team_id", teamIdToRevert)
                    .single();

                const teamPts = seasonTeamData?.points ?? 0;
                const { error: teamRevertError } = await adminSupabase
                    .from("season_teams")
                    .update({ points: Math.max(0, teamPts - totalPoints) })
                    .eq("season_id", resolvedSeasonId)
                    .eq("team_id", teamIdToRevert);

                if (teamRevertError) {
                    console.error("Error reverting season team points:", teamRevertError);
                    return NextResponse.json({ error: teamRevertError.message }, { status: 500 });
                }

                if (teamFetchError) {
                    // row missing is effectively a no-op revert; ignore.
                }
            } else {
                const { data: teamData, error: teamFetchError } = await adminSupabase
                    .from("teams")
                    .select("points")
                    .eq("id", teamIdToRevert)
                    .single();
                if (teamFetchError) {
                    console.error("Error fetching team points for revert:", teamFetchError);
                    return NextResponse.json({ error: teamFetchError.message }, { status: 500 });
                }
                const teamPts = teamData?.points ?? 0;
                const { error: teamRevertError } = await adminSupabase
                    .from("teams")
                    .update({ points: Math.max(0, teamPts - totalPoints) })
                    .eq("id", teamIdToRevert);
                if (teamRevertError) {
                    console.error("Error reverting team points:", teamRevertError);
                    return NextResponse.json({ error: teamRevertError.message }, { status: 500 });
                }
            }
        }
    }

    // Clear existing results for the track (and season, if season-scoped)
    let deleteQuery = adminSupabase.from("results").delete().eq("track", track);
    if (resolvedSeasonId) {
        deleteQuery = deleteQuery.eq("season_id", resolvedSeasonId);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
        console.error("Error deleting old results:", deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Now insert the new results and update running points
    for (const row of results) {
        if (!row.driverId) continue;
        // Resolve team + current points for incremental updates (season-scoped when possible).
        let teamId: string | null = null;
        let currentDriverPoints = 0;

        if (resolvedSeasonId) {
            teamId = await getSeasonTeamForDriver(resolvedSeasonId, row.driverId);
            const { data: seasonDriverData } = await adminSupabase
                .from("season_drivers")
                .select("points")
                .eq("season_id", resolvedSeasonId)
                .eq("driver_id", row.driverId)
                .single();
            currentDriverPoints = seasonDriverData?.points ?? 0;
        } else {
            const { data: driverTeamData, error: driverTeamError } = await adminSupabase
                .from("drivers")
                .select("team, points")
                .eq("id", row.driverId)
                .single();
            if (driverTeamError) {
                console.error("Error fetching driver team:", driverTeamError);
                return NextResponse.json({ error: driverTeamError.message }, { status: 500 });
            }
            teamId = driverTeamData?.team ?? null;
            currentDriverPoints = driverTeamData?.points ?? 0;
        }
        // If driver didn't finish the race, they get zero points
        if (!row.racefinished) {
            // Save the race result with 0 points
            const { error: insertError } = await adminSupabase.from("results").insert([
                {
                    track,
                    season_id: resolvedSeasonId,
                    finishing_position: row.position,
                    driver: row.driverId,
                    team_id: teamId,
                    pole: row.pole,
                    fastestlap: row.fastestLap,
                    racefinished: row.racefinished
                },
            ]);
            if (insertError) {
                console.error("Error inserting result:", insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
            console.log(`Updated result for driver ${row.driverId} (DNF - 0 points)`);
            continue;
        }

        // Choose point system based on track type
        const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
        const maxPositions = eventType === 'Sprint' ? 8 : 10;

        const basePoints = row.position <= maxPositions ? pointsMapping[row.position - 1] : 0;
        const bonusPoints = (rules.polegivespoint && row.pole ? 1 : 0) + (rules.fastestlapgivespoint && row.fastestLap ? 1 : 0);
        const totalPoints = basePoints + bonusPoints;

        console.log(`Adding points for driver ${row.driverId}: eventType=${eventType}, position=${row.position}, basePoints=${basePoints}, bonusPoints=${bonusPoints}, totalPoints=${totalPoints}, currentPoints=${currentDriverPoints}, newTotal=${currentDriverPoints + totalPoints}`);

        // Fetch qualifying position (optional)
        const { data: qData } = await adminSupabase
            .from('qualifying')
            .select('position')
            .eq('track', track)
            .eq('driver', row.driverId)
            .single();

        // Save the race result
        const { error: insertError } = await adminSupabase.from("results").insert([
            {
                track,
                season_id: resolvedSeasonId,
                finishing_position: row.position,
                driver: row.driverId,
                team_id: teamId,
                qualified_position: qData?.position ?? null,
                pole: row.pole,
                fastestlap: row.fastestLap,
                racefinished: row.racefinished
            },
        ]);
        if (insertError) {
            console.error("Error inserting result:", insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Update the driver's total championship points
        if (resolvedSeasonId) {
            const { error: updateError } = await adminSupabase
                .from("season_drivers")
                .update({ points: currentDriverPoints + totalPoints })
                .eq("season_id", resolvedSeasonId)
                .eq("driver_id", row.driverId);
            if (updateError) {
                console.error("Error updating season driver points:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        } else {
            const { error: updateError } = await adminSupabase
                .from("drivers")
                .update({ points: currentDriverPoints + totalPoints })
                .eq("id", row.driverId);
            if (updateError) {
                console.error("Error updating driver points:", updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        }
        console.log(`Updated result for driver ${row.driverId}, updated points to ${currentDriverPoints + totalPoints}`);

        // Increment the constructor (team) points for the current team
        if (teamId) {
            if (resolvedSeasonId) {
                const { data: seasonTeamData, error: teamFetchError } = await adminSupabase
                    .from("season_teams")
                    .select("points")
                    .eq("season_id", resolvedSeasonId)
                    .eq("team_id", teamId)
                    .single();
                if (teamFetchError) {
                    // If the row doesn't exist yet, treat current points as 0.
                }
                const teamPoints = seasonTeamData?.points ?? 0;
                const { error: teamUpdateError } = await adminSupabase
                    .from("season_teams")
                    .update({ points: teamPoints + totalPoints })
                    .eq("season_id", resolvedSeasonId)
                    .eq("team_id", teamId);
                if (teamUpdateError) {
                    console.error("Error updating season team points:", teamUpdateError);
                    return NextResponse.json({ error: teamUpdateError.message }, { status: 500 });
                }
            } else {
                const { data: teamData, error: teamFetchError } = await adminSupabase
                    .from("teams")
                    .select("points")
                    .eq("id", teamId)
                    .single();
                if (teamFetchError) {
                    console.error("Error fetching team points:", teamFetchError);
                    return NextResponse.json({ error: teamFetchError.message }, { status: 500 });
                }
                const teamPoints = teamData?.points ?? 0;
                const { error: teamUpdateError } = await adminSupabase
                    .from("teams")
                    .update({ points: teamPoints + totalPoints })
                    .eq("id", teamId);
                if (teamUpdateError) {
                    console.error("Error updating team points:", teamUpdateError);
                    return NextResponse.json({ error: teamUpdateError.message }, { status: 500 });
                }
            }
        }
    }

    apiCache.delByPrefix('results:');
    apiCache.del('drivers:list');
    apiCache.del('teams:list');
    if (resolvedSeasonId) {
        try {
            await finalizeSeasonIfComplete(resolvedSeasonId);
        } catch (e) {
            console.error("Failed to finalize season automatically after update:", e);
        }
    }

    return NextResponse.json({ success: true });
}
