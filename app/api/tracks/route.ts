import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import Track from "@/models/Track";

export async function GET(request: Request) {
  await connectToDatabase();
  const tracks = await Track.find({}).lean();
  return NextResponse.json(tracks);
}

// Handles both create (when no id) and update (when id provided)
export async function POST(request: Request) {
  await connectToDatabase();
  const { id, name, date } = await request.json();

  // If an id is provided, we treat this as an update
  if (id) {
    let updated;
    if (mongoose.isValidObjectId(id)) {
      // update by real ObjectId
      updated = await Track.findByIdAndUpdate(id, { date }, { new: true });
    } else {
      // update by track name (temporary id)
      updated = await Track.findOneAndUpdate({ name: id }, { date }, { new: true });
    }
    if (!updated) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }

  // Otherwise, create a new track
  const track = await Track.create({ name, date });
  return NextResponse.json(track);
}
