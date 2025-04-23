import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Track from "@/models/Track";

export async function GET() {
  await connectToDatabase();
  const tracks = await Track.find({}).lean();
  return NextResponse.json(tracks);
}

export async function POST(req: Request) {
  await connectToDatabase();
  const { name, date } = await req.json();      // date as ISO string
  const track = await Track.create({ name, date });
  return NextResponse.json(track);
}

export async function PUT(req: Request) {
  await connectToDatabase();
  const { id, date } = await req.json();
  const updated = await Track.findByIdAndUpdate(id, { date }, { new: true });
  return NextResponse.json(updated);
}
