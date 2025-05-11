// app/api/selected-tracks/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import SelectedTrack from "@/models/SelectedTrack";
import Track from "@/models/Track";      // ← make sure this import is here!

export async function GET() {
  await connectToDatabase();
  // now Mongoose knows about both models, so populate() will work
  const sel = await SelectedTrack.find().populate("track").lean();
  return NextResponse.json(
    sel.map((s) => ({ id: s._id, track: s.track }))
  );
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { trackId } = await request.json();
  // ensure Track is registered before upserting
  const trackObj = await Track.findById(trackId);
  if (!trackObj) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  const newSel = await SelectedTrack.create({ track: trackObj._id });
  const populated = await newSel.populate("track");
  return NextResponse.json({ id: populated._id, track: populated.track });
}

export async function DELETE(request: Request) {
  await connectToDatabase();
  const { trackId } = await request.json();
  await SelectedTrack.deleteOne({ track: trackId });
  return NextResponse.json({ success: true });
}
