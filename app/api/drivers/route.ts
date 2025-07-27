// app/api/drivers/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: drivers, error } = await supabase.from('drivers').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(drivers);
}

export async function POST(request: Request) {
  const { name, teamId } = await request.json();
  // Enforce max 2 drivers per team
  if (teamId) {
    const { data: teamDrivers, error: teamDriversError } = await supabase
      .from('drivers')
      .select('id')
      .eq('team', teamId);
    if (teamDriversError) return NextResponse.json({ error: teamDriversError.message }, { status: 500 });
    if ((teamDrivers?.length || 0) >= 2) {
      return NextResponse.json({ error: 'A team cannot have more than 2 drivers.' }, { status: 400 });
    }
  }
  const { data, error } = await supabase.from('drivers').insert([
    {
      name,
      team: teamId,
      points: 0,
    },
  ]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { driverId, points, teamId } = await request.json();
  const update: { points?: number; team?: string | null } = {};
  if (points !== undefined) update.points = points;
  if (teamId !== undefined) {
    if (teamId) {
      // Enforce max 2 drivers per team (excluding this driver)
      const { data: teamDrivers, error: teamDriversError } = await supabase
        .from('drivers')
        .select('id')
        .eq('team', teamId);
      if (teamDriversError) return NextResponse.json({ error: teamDriversError.message }, { status: 500 });
      const filtered = (teamDrivers || []).filter((d: any) => d.id !== driverId);
      if (filtered.length >= 2) {
        return NextResponse.json({ error: 'A team cannot have more than 2 drivers.' }, { status: 400 });
      }
    }
    update.team = teamId || null;
  }
  const { data, error } = await supabase
    .from('drivers')
    .update(update)
    .eq('id', driverId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { driverId } = await request.json();
  const { error } = await supabase.from('drivers').delete().eq('id', driverId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
