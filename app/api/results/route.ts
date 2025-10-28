import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { adminSupabase } from "@/utils/supabase/admin";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

/**
 * Point mappings for different event types
 * These define how many points each finishing position receives
 */
const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];  // Top 10 for races
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];           // Top 8 for sprints

/**
 * GET /api/results?track={trackId}
 * 
 * Fetches basic race results for a specific track.
 * Returns raw result data without driver/team details.
 * 
 * Query Parameters:
 * - track: The selected_track.id (required)
 * 
 * Returns:
 * - Array of result records from the database
 * - Cached for 30 seconds
 */
export async function GET(request: Request) {
  // Extract track ID from query parameters
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");

  // Validate required parameter
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }

  // Check cache first to avoid redundant database queries
  const cacheKey = `results:track:${track}`;
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());

  // Fetch results from database
  const { data: results, error } = await supabase.from("results").select("*").eq("track", track);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cache and return results
  apiCache.set(cacheKey, results || [], 30_000);
  return NextResponse.json(results, withCacheControlHeaders());
}

/**
 * POST /api/results
 * 
 * Creates new race results for a track (FIRST TIME ONLY).
 * This endpoint will reject if results already exist for the track.
 * Use PUT /api/results/update to modify existing results.
 * 
 * Request Body:
 * {
 *   track: string,              // selected_track.id
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
 * Process:
 * 1. Validates no existing results exist
 * 2. Fetches rules configuration
 * 3. For each driver result:
 *    - Calculates points based on position and bonuses
 *    - Saves result to database
 *    - Updates driver's total championship points
 *    - Updates team's total championship points
 * 4. Invalidates relevant caches
 */
export async function POST(request: Request) {
  // Parse request body
  const { track, trackType, results } = await request.json();
  console.log("POST /api/results payload:", { track, trackType, results });

  const eventType = trackType || 'Race';
  console.log("Event type:", eventType);

  // STEP 1: Prevent duplicate results
  // Check if results already exist for this track to protect point totals
  const { data: existingResults, error: existingErr } = await adminSupabase
    .from("results")
    .select("id")
    .eq("track", track);

  if (existingErr) {
    console.error("Error checking existing results:", existingErr);
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  if ((existingResults?.length || 0) > 0) {
    return NextResponse.json(
      { error: "Results for this event already exist. Use PUT /api/results/update to modify them." },
      { status: 400 }
    );
  }

  // STEP 2: Fetch rules configuration
  // Rules determine if pole position and fastest lap award bonus points
  const { data: rules, error: rulesError } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();

  if (rulesError) {
    console.error('Error fetching rules:', rulesError);
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  // STEP 3: Process each driver's result
  for (const row of results) {
    // Skip if no driver ID provided
    if (!row.driverId) continue;

    // 3a. Fetch driver's current team and championship points
    // We need this to know which team to award points to and to update the driver's total
    const { data: driverTeamData, error: driverTeamError } = await adminSupabase
      .from("drivers")
      .select("team, points")
      .eq("id", row.driverId)
      .single();

    if (driverTeamError) {
      console.error("Error fetching driver team:", driverTeamError);
      return NextResponse.json({ error: driverTeamError.message }, { status: 500 });
    }

    const teamId: string | null = driverTeamData?.team ?? null;
    const currentDriverPoints: number = driverTeamData?.points ?? 0;

    // 3b. Fetch qualifying position (optional, for display purposes)
    // This links the race result to the qualifying session
    const { data: qualifyingData, error: qualifyingError } = await adminSupabase
      .from("qualifying")
      .select("position")
      .eq("track", track)
      .eq("driver", row.driverId)
      .single();

    const qualifyingPosition = qualifyingData?.position || null;

    // PGRST116 = no rows found, which is OK (not all tracks have qualifying data)
    if (qualifyingError && qualifyingError.code !== 'PGRST116') {
      console.warn(`Warning: Could not fetch qualifying position for driver ${row.driverId}:`, qualifyingError);
    }

    // 3c. Handle DNF (Did Not Finish) drivers
    // DNF drivers get 0 points regardless of pole or fastest lap
    if (!row.racefinished) {
      const { error: insertError } = await adminSupabase.from("results").insert([
        {
          track,
          finishing_position: row.position,
          driver: row.driverId,
          qualified_position: qualifyingPosition,
          pole: row.pole,
          fastestlap: row.fastestLap,
          racefinished: row.racefinished
        },
      ]);

      if (insertError) {
        console.error("Error inserting result:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log(`Inserted result for driver ${row.driverId} (DNF - 0 points)`);
      continue; // Skip point calculation and updates for DNF drivers
    }

    // 3d. Calculate points for drivers who finished
    // Select appropriate point system based on event type
    const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
    const maxPositions = eventType === 'Sprint' ? 8 : 10;

    // Base points from finishing position
    const basePoints = row.position <= maxPositions ? pointsMapping[row.position - 1] : 0;

    // Bonus points (if enabled in rules)
    const bonusPoints = (rules.polegivespoint && row.pole ? 1 : 0) +
      (rules.fastestlapgivespoint && row.fastestLap ? 1 : 0);

    const totalPoints = basePoints + bonusPoints;

    // Log point calculation for debugging
    console.log(`Points calculation for driver ${row.driverId}:`, {
      position: row.position,
      maxPositions,
      basePoints,
      pole: row.pole,
      fastestLap: row.fastestLap,
      bonusPoints,
      totalPoints,
      rules: { polegivespoint: rules.polegivespoint, fastestlapgivespoint: rules.fastestlapgivespoint }
    });

    // 3e. Save the race result to database
    const { error: insertError } = await adminSupabase.from("results").insert([
      {
        track,
        finishing_position: row.position,
        driver: row.driverId,
        qualified_position: qualifyingPosition,
        pole: row.pole,
        fastestlap: row.fastestLap,
        racefinished: row.racefinished
      },
    ]);

    if (insertError) {
      console.error("Error inserting result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 3f. Update driver's total championship points
    // Add the points earned in this race to their running total
    const { error: updateError } = await adminSupabase
      .from("drivers")
      .update({ points: currentDriverPoints + totalPoints })
      .eq("id", row.driverId);

    if (updateError) {
      console.error("Error updating driver points:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`✅ Driver ${row.driverId}: ${currentDriverPoints} + ${totalPoints} = ${currentDriverPoints + totalPoints} points`);

    // 3g. Update team's (constructor) championship points
    // Teams earn the same points as their drivers
    if (teamId) {
      // Fetch current team points
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

      // Add points to team total
      const { error: teamUpdateError } = await adminSupabase
        .from("teams")
        .update({ points: teamPoints + totalPoints })
        .eq("id", teamId);

      if (teamUpdateError) {
        console.error("Error updating team points:", teamUpdateError);
        return NextResponse.json({ error: teamUpdateError.message }, { status: 500 });
      }

      console.log(`✅ Team ${teamId}: ${teamPoints} + ${totalPoints} = ${teamPoints + totalPoints} points`);
    }
  }

  // STEP 4: Clean up and return
  // Points were updated incrementally above, no need for global recomputation

  // Invalidate caches so fresh data is fetched on next request
  apiCache.delByPrefix('results:');  // All results caches
  apiCache.del('drivers:list');      // Driver standings
  apiCache.del('teams:list');        // Team standings

  return NextResponse.json({ success: true });
}


