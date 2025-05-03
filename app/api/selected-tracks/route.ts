// app/api/selected-tracks/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import SelectedTrack from "@/models/SelectedTrack";
import Track from "@/models/Track";

export async function GET() {
  await connectToDatabase();
  // populate to return full track info
  const sel = await SelectedTrack.find().populate("track").lean();
  return NextResponse.json(
    sel.map((s) => ({ id: s._id, track: s.track }))
  );
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { trackId } = await request.json();
  // avoid duplicates
  if (!(await SelectedTrack.exists({ track: trackId }))) {
    await SelectedTrack.create({ track: trackId });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  await connectToDatabase();
  const { trackId } = await request.json();
  await SelectedTrack.deleteOne({ track: trackId });
  return NextResponse.json({ success: true });
}
