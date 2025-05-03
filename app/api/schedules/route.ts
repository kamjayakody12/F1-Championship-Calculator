// app/api/schedules/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Schedule from "@/models/Schedule";
import Track from "@/models/Track";

export async function GET() {
  await connectToDatabase();
  // return all schedules, populated with track name
  const list = await Schedule.find({})
    .populate("track", "name")
    .lean();
  // normalize to { trackId, name, date }
  return NextResponse.json(
    list.map((s) => ({
      trackId: (s.track as any)._id.toString(),
      name: (s.track as any).name,
      date: s.date.toISOString().slice(0, 10),
    }))
  );
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { trackId, date } = await request.json();

  // upsert by track ObjectId
  const trackObj = await Track.findById(trackId);
  if (!trackObj) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const schedule = await Schedule.findOneAndUpdate(
    { track: trackObj._id },
    { date: new Date(date) },
    { upsert: true, new: true }
  );

  return NextResponse.json({
    trackId: schedule.track.toString(),
    date: schedule.date.toISOString().slice(0, 10),
  });
}
