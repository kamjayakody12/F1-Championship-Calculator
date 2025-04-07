import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Result from "@/models/Result";
import Driver from "@/models/Driver";

// Define the points mapping for positions 1 to 10
const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");

  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }

  await connectToDatabase();
  const results = await Result.find({ track }).lean();
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { track, results } = await request.json();

  // Optionally, you could clear existing results for the track:
  // await Result.deleteMany({ track });

  // Process each result row
  for (const row of results) {
    // Skip rows without a selected driver
    if (!row.driverId) continue;

    // Calculate base points (only positions 1-10 have base points)
    const basePoints =
      row.position <= 10 ? positionPointsMapping[row.position - 1] : 0;

    // Calculate bonus points (1 point each for pole and fastest lap)
    const bonusPoints = (row.pole ? 1 : 0) + (row.fastestLap ? 1 : 0);

    const totalPoints = basePoints + bonusPoints;

    // Save the race result (expand as needed)
    await Result.create({
      track,
      position: row.position,
      driver: row.driverId,
      pole: row.pole,
      fastestLap: row.fastestLap,
    });

    // Update the driver's total championship points by incrementing with totalPoints
    await Driver.findByIdAndUpdate(row.driverId, { $inc: { points: totalPoints } });
  }

  return NextResponse.json({ success: true });
}
