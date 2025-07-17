// app/api/schedules/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  // Join schedules with tracks to get track name
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('id, track, date, tracks(name)');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Normalize to { trackId, name, date }
  return NextResponse.json(
    (schedules || []).map((s: any) => ({
      trackId: s.track,
      name: s.tracks?.name,
      date: s.date?.slice(0, 10),
    }))
  );
}

export async function POST(request: Request) {
  const { track, date } = await request.json();
  // Upsert by track id
  const { data, error } = await supabase
    .from('schedules')
    .upsert([{ track, date }], { onConflict: 'track' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    trackId: data.track,
    date: data.date?.slice(0, 10),
  });
}
