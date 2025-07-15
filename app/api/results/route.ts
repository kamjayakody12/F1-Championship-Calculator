import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }
  const { data: results, error } = await supabase.from('results').select('*').eq('track', track);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const { track, results } = await request.json();
  // Optionally, you could clear existing results for the track:
  // await supabase.from('results').delete().eq('track', track);
  for (const row of results) {
    if (!row.driverId) continue;
    const basePoints = row.position <= 10 ? positionPointsMapping[row.position - 1] : 0;
    const bonusPoints = (row.pole ? 1 : 0) + (row.fastestLap ? 1 : 0);
    const totalPoints = basePoints + bonusPoints;
    // Save the race result
    await supabase.from('results').insert([
      {
        track,
        position: row.position,
        driver: row.driverId,
        pole: row.pole,
        fastestLap: row.fastestLap,
      },
    ]);
    // Update the driver's total championship points
    await supabase.from('drivers').update({ points: row.currentPoints + totalPoints }).eq('id', row.driverId);
  }
  return NextResponse.json({ success: true });
}
