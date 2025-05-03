// app/api/tracks/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Track from "@/models/Track";

const ROUND_NAMES = [
  "Australia", "China", "Japan", "Bahrain", "Saudi Arabia",
  "USA", "Italy", "Monaco", "Spain", "Canada", "Austria",
  "United Kingdom", "Belgium", "Hungary", "Netherlands",
  "Azerbaijan", "Singapore", "Mexico", "Brazil", "Qatar",
  "Abu Dhabi"
];

export async function GET(request: Request) {
  await connectToDatabase();

  // seed on first ever call
  if ((await Track.countDocuments()) === 0) {
    await Track.insertMany(ROUND_NAMES.map((name) => ({ name })));
  }

  const tracks = await Track.find({}).lean();
  return NextResponse.json(tracks);
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { name, date } = await request.json();
  const track = await Track.create({ name, date });
  return NextResponse.json(track);
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const { id, date } = await request.json();
  const updated = await Track.findByIdAndUpdate(id, { date }, { new: true });
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
