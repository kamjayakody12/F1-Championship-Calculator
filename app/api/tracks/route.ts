// app/api/tracks/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

const ROUND_NAMES = [
  "Australia", "China", "Japan", "Bahrain", "Saudi Arabia",
  "USA", "Italy", "Monaco", "Spain", "Canada", "Austria",
  "United Kingdom", "Belgium", "Hungary", "Netherlands",
  "Azerbaijan", "Singapore", "Mexico", "Brazil", "Qatar",
  "Abu Dhabi"
];

export async function GET(request: Request) {
  // seed on first ever call
  const { count, error: countError } = await supabase.from('tracks').select('*', { count: 'exact', head: true });
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count === 0) {
    const { error: insertError } = await supabase.from('tracks').insert(
      ROUND_NAMES.map((name) => ({ name }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  const { data: tracks, error } = await supabase.from('tracks').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(tracks);
}

export async function POST(request: Request) {
  const { name, date } = await request.json();
  const { data, error } = await supabase.from('tracks').insert([{ name, date }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { id, date } = await request.json();
  const { data, error } = await supabase.from('tracks').update({ date }).eq('id', id).select().single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
