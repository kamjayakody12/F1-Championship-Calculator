import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { adminSupabase } from "@/utils/supabase/admin";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");
  
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }
  const cacheKey = `results:track:${track}`;
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  const { data: results, error } = await supabase.from("results").select("*").eq("track", track);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.set(cacheKey, results || [], 30_000);
  return NextResponse.json(results, withCacheControlHeaders());
}

export async function POST(request: Request) {
  const { track, trackType, results } = await request.json();
  console.log("POST /api/results payload:", { track, trackType, results }); // Debug log

  const eventType = trackType || 'Race';
  console.log("Event type:", eventType); // Debug log

  // Disallow creating results if this track already has results (protect constructor totals)
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
      { error: "Results for this event already exist. Updating existing results is disabled." },
      { status: 400 }
    );
  }

  // Fetch rules for bonus points
  const { data: rules, error: rulesError } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();
  if (rulesError) {
    console.error('Error fetching rules:', rulesError);
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  // Update driver and team points based on the race being saved
  for (const row of results) {
    if (!row.driverId) continue;
    
    // Fetch the driver's current team and points
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

    // Fetch qualifying position for this driver and track
    const { data: qualifyingData, error: qualifyingError } = await adminSupabase
      .from("qualifying")
      .select("position")
      .eq("track", track)
      .eq("driver", row.driverId)
      .single();
    
    const qualifyingPosition = qualifyingData?.position || null;
    if (qualifyingError && qualifyingError.code !== 'PGRST116') { // PGRST116 = no rows found, which is OK
      console.warn(`Warning: Could not fetch qualifying position for driver ${row.driverId}:`, qualifyingError);
    }

    // If driver didn't finish the race, they get zero points
    if (!row.racefinished) {
      // Save the race result with 0 points effect
      const { error: insertError } = await adminSupabase.from("results").insert([
        {
          track,
          finishing_position: row.position,
          driver: row.driverId,
          qualified_position: qualifyingPosition,
          pole: row.pole,
          fastestlap: row.fastestLap, // use lowercase column name
          racefinished: row.racefinished
        },
      ]);
      if (insertError) {
        console.error("Error inserting result:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      console.log(`Inserted result for driver ${row.driverId} (DNF - 0 points)`);
      continue; // Skip point calculation for DNF drivers
    }
    
    // Choose point system based on track type
    const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
    const maxPositions = eventType === 'Sprint' ? 8 : 10;
    
    const basePoints = row.position <= maxPositions ? pointsMapping[row.position - 1] : 0;
    const bonusPoints = (rules.polegivespoint && row.pole ? 1 : 0) + (rules.fastestlapgivespoint && row.fastestLap ? 1 : 0);
    const totalPoints = basePoints + bonusPoints;
    
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
    // Save the race result
    const { error: insertError } = await adminSupabase.from("results").insert([
      {
        track,
        finishing_position: row.position,
        driver: row.driverId,
        qualified_position: qualifyingPosition,
        pole: row.pole,
        fastestlap: row.fastestLap, // use lowercase column name
        racefinished: row.racefinished
      },
    ]);
    if (insertError) {
      console.error("Error inserting result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    // Update the driver's total championship points
    const { error: updateError } = await adminSupabase
      .from("drivers")
      .update({ points: currentDriverPoints + totalPoints })
      .eq("id", row.driverId);
    if (updateError) {
      console.error("Error updating driver points:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    console.log(`✅ Driver ${row.driverId}: ${currentDriverPoints} + ${totalPoints} = ${currentDriverPoints + totalPoints} points`);

    // Increment the constructor (team) points for the driver's current team
    if (teamId) {
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
      console.log(`✅ Team ${teamId}: ${teamPoints} + ${totalPoints} = ${teamPoints + totalPoints} points`);
    }
  }

  // No team-wide recompute here; team points were adjusted incrementally above

  // Invalidate caches that may be affected by results changes
  apiCache.delByPrefix('results:');
  apiCache.del('drivers:list');
  apiCache.del('teams:list');
  return NextResponse.json({ success: true });
}


