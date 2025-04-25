// app/api/tracks/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Track from "@/models/Track";

// Full F1 calendar
const ROUND_NAMES = [
  "Australia", "China", "Japan", "Bahrain", "Saudi Arabia",
  "USA", "Italy", "Monaco", "Spain", "Canada", "Austria",
  "United Kingdom", "Belgium", "Hungary", "Netherlands",
  "Azerbaijan", "Singapore", "Mexico", "Brazil", "Qatar",
  "Abu Dhabi"
];

export async function GET() {
  await connectToDatabase();

  // If no tracks exist yet, seed all 24
  const count = await Track.countDocuments();
  if (count === 0) {
    await Track.insertMany(ROUND_NAMES.map((name) => ({ name })));
  }

  // Return all tracks
  const all = await Track.find({}).lean();
  return NextResponse.json(all);
}
