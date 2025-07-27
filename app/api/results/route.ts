import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

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
  const { track, results } = await request.json();
  console.log("POST /api/results payload:", { track, results }); // Debug log

  // Clear existing results for the track
  const { error: deleteError } = await supabase.from("results").delete().eq("track", track);
  if (deleteError) {
    console.error("Error deleting old results:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Update driver points (fetching current points from DB)
  for (const row of results) {
    if (!row.driverId) continue;
    const basePoints = row.position <= 10 ? positionPointsMapping[row.position - 1] : 0;
    const bonusPoints = (row.pole ? 1 : 0) + (row.fastestLap ? 1 : 0);
    const totalPoints = basePoints + bonusPoints;
    // Save the race result
    const { error: insertError } = await supabase.from("results").insert([
      {
        track,
        position: row.position,
        driver: row.driverId,
        pole: row.pole,
        fastestLap: row.fastestLap,
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
