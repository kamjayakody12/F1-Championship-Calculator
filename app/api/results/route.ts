import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");
  
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }
  
  const { data: results, error } = await supabase.from("results").select("*").eq("track", track);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const { track, trackType, results } = await request.json();
  console.log("POST /api/results payload:", { track, trackType, results }); // Debug log

  const eventType = trackType || 'Race';
  console.log("Event type:", eventType); // Debug log

  // Clear existing results for the track
  const { error: deleteError } = await supabase.from("results").delete().eq("track", track);
  if (deleteError) {
    console.error("Error deleting old results:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
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

  // Update driver points (fetching current points from DB)
  for (const row of results) {
    if (!row.driverId) continue;
    
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
      },
    ]);
    if (insertError) {
      console.error("Error inserting result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    // Fetch current driver points from DB
    const { data: driverData, error: fetchError } = await supabase
      .from("drivers")
      .select("points")
      .eq("id", row.driverId)
      .single();
    if (fetchError) {
      console.error("Error fetching driver points:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    const currentPoints = driverData?.points || 0;
    // Update the driver's total championship points
    const { error: updateError } = await supabase
      .from("drivers")
      .update({ points: currentPoints + totalPoints })
      .eq("id", row.driverId);
    if (updateError) {
      console.error("Error updating driver points:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    console.log(`Inserted result for driver ${row.driverId}, updated points to ${currentPoints + totalPoints}`);
  }

  // Constructors calculation
  // 1. Fetch all teams
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id");
  if (teamsError) {
    console.error("Error fetching teams:", teamsError);
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }
  // 2. For each team, sum points of all drivers in that team
  for (const team of teams) {
    const { data: teamDrivers, error: driversError } = await supabase
      .from("drivers")
      .select("points")
      .eq("team", team.id);
    if (driversError) {
      console.error(`Error fetching drivers for team ${team.id}:`, driversError);
      return NextResponse.json({ error: driversError.message }, { status: 500 });
    }
    const teamPoints = (teamDrivers || []).reduce((sum, d) => sum + (d.points || 0), 0);
    // 3. Update the team's points
    const { error: updateTeamError } = await supabase
      .from("teams")
      .update({ points: teamPoints })
      .eq("id", team.id);
    if (updateTeamError) {
      console.error(`Error updating team points for team ${team.id}:`, updateTeamError);
      return NextResponse.json({ error: updateTeamError.message }, { status: 500 });
    }
    console.log(`Updated team ${team.id} points to ${teamPoints}`);
  }

  return NextResponse.json({ success: true });
}
