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

export async function GET(request: Request) {
  await connectToDatabase();
  // 1) Seed on first call
  const count = await Track.countDocuments();
  if (count === 0) {
    await Track.insertMany(ROUND_NAMES.map((name) => ({ name })));
  }
  // 2) If ?active=true, filter; else return all
  const url = new URL(request.url);
  const onlyActive = url.searchParams.get("active") === "true";
  const filter = onlyActive ? { active: true } : {};
  const tracks = await Track.find(filter).lean();
  return NextResponse.json(tracks);
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const { id, active } = await request.json();
  // Flip that track’s `active` flag
  const updated = await Track.findByIdAndUpdate(
    id,
    { active: !!active },
    { new: true }
  );
  if (!updated) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
