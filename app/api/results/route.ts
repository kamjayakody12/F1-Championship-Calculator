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
        fastestlap: row.fastestLap,
      },
    ]);
    if (insertError) {
      console.error("Error inserting result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    // Update the driver's total championship points
    const { error: updateError } = await supabase
      .from("drivers")
      .update({ points: row.currentPoints + totalPoints })
      .eq("id", row.driverId);
    if (updateError) {
      console.error("Error updating driver points:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    console.log(`Inserted result for driver ${row.driverId}, updated points to ${row.currentPoints + totalPoints}`);
  }
  return NextResponse.json({ success: true });
}
