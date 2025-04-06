// app/api/drivers/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Driver from "@/models/Driver";

export async function GET() {
  await connectToDatabase();
  const drivers = await Driver.find({}).lean();
  return NextResponse.json(drivers);
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { name, teamId, points } = await request.json();
  const driver = await Driver.create({
    name,
    team: teamId,
    points: points || 0,
  });
  return NextResponse.json(driver);
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const { driverId, points } = await request.json();
  const updatedDriver = await Driver.findByIdAndUpdate(
    driverId,
    { points },
    { new: true }
  );
  return NextResponse.json(updatedDriver);
}

export async function DELETE(request: Request) {
  await connectToDatabase();
  const { driverId } = await request.json();
  await Driver.findByIdAndDelete(driverId);
  return NextResponse.json({ success: true });
}
