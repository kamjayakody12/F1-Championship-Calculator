import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

export async function PUT(
  request: Request,
  { params }: { params: { trackId: string } }
) {
  const { trackType, results } = await request.json();
  const track = params.trackId;
  
  console.log("PUT /api/results/[trackId] payload:", { track, trackType, results }); // Debug log

  const eventType = trackType || 'Race';
  console.log("Event type:", eventType); // Debug log

  // First, we need to revert the points from the existing results
  const { data: existingResults, error: fetchError } = await supabase
    .from("results")
    .select("*")
    .eq("track", track);
  
  if (fetchError) {
    console.error("Error fetching existing results:", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
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

  // Revert points from existing results
  for (const existingResult of existingResults || []) {
    if (!existingResult.driver) continue;
    
    // Calculate points that were previously awarded
    const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
    const maxPositions = eventType === 'Sprint' ? 8 : 10;
    
    const basePoints = existingResult.position <= maxPositions ? pointsMapping[existingResult.position - 1] : 0;
    const bonusPoints = (rules.polegivespoint && existingResult.pole ? 1 : 0) + (rules.fastestlapgivespoint && existingResult.fastestlap ? 1 : 0);
    const totalPoints = basePoints + bonusPoints;
    
    // Subtract these points from the driver
    const { data: driverData, error: driverFetchError } = await supabase
      .from("drivers")
      .select("points")
      .eq("id", existingResult.driver)
      .single();
    
    if (driverFetchError) {
      console.error("Error fetching driver points for revert:", driverFetchError);
      return NextResponse.json({ error: driverFetchError.message }, { status: 500 });
    }
    
    const currentPoints = driverData?.points || 0;
    const { error: revertError } = await supabase
      .from("drivers")
      .update({ points: Math.max(0, currentPoints - totalPoints) })
      .eq("id", existingResult.driver);
    
    if (revertError) {
      console.error("Error reverting driver points:", revertError);
      return NextResponse.json({ error: revertError.message }, { status: 500 });
    }
    
    console.log(`Reverted ${totalPoints} points from driver ${existingResult.driver}`);
  }

  // Clear existing results for the track
  const { error: deleteError } = await supabase.from("results").delete().eq("track", track);
  if (deleteError) {
    console.error("Error deleting old results:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Now insert the new results and update running points
  for (const row of results) {
    if (!row.driverId) continue;
    // Fetch driver's current team and points
    const { data: driverTeamData, error: driverTeamError } = await supabase
      .from("drivers")
      .select("team, points")
      .eq("id", row.driverId)
      .single();
    if (driverTeamError) {
      console.error("Error fetching driver team:", driverTeamError);
      return NextResponse.json({ error: driverTeamError.message }, { status: 500 });
    }
    const teamId = driverTeamData?.team ?? null;
    const currentDriverPoints = driverTeamData?.points ?? 0;
    // If driver didn't finish the race, they get zero points
    if (!row.racefinished) {
      // Save the race result with 0 points
      const { error: insertError } = await supabase.from("results").insert([
        {
          track,
          position: row.position,
          driver: row.driverId,
          pole: row.pole,
          fastestlap: row.fastestLap, // use lowercase column name
          racefinished: row.racefinished
        },
      ]);
      if (insertError) {
        console.error("Error inserting result:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      console.log(`Updated result for driver ${row.driverId} (DNF - 0 points)`);
      continue; // Skip point calculation for DNF drivers
    }
    
    // Choose point system based on track type
    const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
    const maxPositions = eventType === 'Sprint' ? 8 : 10;
    
    const basePoints = row.position <= maxPositions ? pointsMapping[row.position - 1] : 0;
    const bonusPoints = (rules.polegivespoint && row.pole ? 1 : 0) + (rules.fastestlapgivespoint && row.fastestLap ? 1 : 0);
    const totalPoints = basePoints + bonusPoints;
    
    // Save the race result
    const { error: insertError } = await supabase.from("results").insert([
      {
        track,
        position: row.position,
        driver: row.driverId,
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
    const { error: updateError } = await supabase
      .from("drivers")
      .update({ points: currentDriverPoints + totalPoints })
      .eq("id", row.driverId);
    if (updateError) {
      console.error("Error updating driver points:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    console.log(`Updated result for driver ${row.driverId}, updated points to ${currentDriverPoints + totalPoints}`);

    // Increment the constructor (team) points for the current team
    if (teamId) {
      const { data: teamData, error: teamFetchError } = await supabase
        .from("teams")
        .select("points")
        .eq("id", teamId)
        .single();
      if (teamFetchError) {
        console.error("Error fetching team points:", teamFetchError);
        return NextResponse.json({ error: teamFetchError.message }, { status: 500 });
      }
      const teamPoints = teamData?.points ?? 0;
      const { error: teamUpdateError } = await supabase
        .from("teams")
        .update({ points: teamPoints + totalPoints })
        .eq("id", teamId);
      if (teamUpdateError) {
        console.error("Error updating team points:", teamUpdateError);
        return NextResponse.json({ error: teamUpdateError.message }, { status: 500 });
      }
    }
  }

  // No global recompute; team points were adjusted incrementally

  return NextResponse.json({ success: true });
} 