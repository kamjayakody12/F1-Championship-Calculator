// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Team from "@/models/Team";

export async function GET() {
  await connectToDatabase();
  const teams = await Team.find({}).lean();
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  await connectToDatabase();
  const { name } = await request.json();
  const team = await Team.create({ name });
  return NextResponse.json(team);
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const { teamId, name } = await request.json();
  const updatedTeam = await Team.findByIdAndUpdate(teamId, { name }, { new: true });
  return NextResponse.json(updatedTeam);
}

export async function DELETE(request: Request) {
  await connectToDatabase();
  const { teamId } = await request.json();
  await Team.findByIdAndDelete(teamId);
  return NextResponse.json({ success: true });
}
