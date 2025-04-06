import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Result from "@/models/Result";

export async function POST(request: Request) {
  await connectToDatabase();
  const { track, results } = await request.json();

  // Optionally, you can clear existing results for this track:
  // await Result.deleteMany({ track });

  // Insert only rows that have a valid driverId
  for (const row of results) {
    if (!row.driverId) continue; // Skip if driverId is empty
    await Result.create({
      track,
      position: row.position,
      driver: row.driverId,
      pole: row.pole,
      fastestLap: row.fastestLap,
    });
  }

  return NextResponse.json({ success: true });
}
