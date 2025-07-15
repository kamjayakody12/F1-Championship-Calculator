// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: teams, error } = await supabase.from('teams').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const { data, error } = await supabase.from('teams').insert([{ name }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { teamId, name } = await request.json();
  const { data, error } = await supabase.from('teams').update({ name }).eq('id', teamId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { teamId } = await request.json();
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
