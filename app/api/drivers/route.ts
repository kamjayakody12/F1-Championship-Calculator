// app/api/drivers/route.ts
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

// Function to ensure there can be max 3 drivers in a team
async function checkTeamDriverLimit(supabase: any, teamId: string, excludeDriverId?: string) {
  const { data: teamDrivers, error } = await supabase
    .from('drivers')
    .select('id')
    .eq('team', teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const count = excludeDriverId
    ? (teamDrivers || []).filter((d: any) => d.id !== excludeDriverId).length
    : (teamDrivers?.length || 0);

  if (count >= 3) {
    return NextResponse.json({ error: 'A team cannot have more than 3 drivers.' }, { status: 400 });
  }
  return null;
}

export async function GET() {
  const cached = apiCache.get<any[]>(`drivers:list`);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  const supabase = await createServerSupabase();
  const { data: drivers, error } = await supabase.from('drivers').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.set(`drivers:list`, drivers || [], 60_000);
  return NextResponse.json(drivers, withCacheControlHeaders());
}

export async function POST(request: Request) {
  const { name, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  // Enforce max 3 drivers per team
  if (teamId) {
    const res = await checkTeamDriverLimit(supabase, teamId);
    if (res) return res;
  }
  const { data, error } = await supabase.from('drivers').insert([
    {
      name,
      team: teamId,
      points: 0,
      image: image || null,
    },
  ]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.del('drivers:list');
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const { driverId, points, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  const update: { points?: number; team?: string | null; image?: string | null } = {};
  if (points !== undefined) update.points = points;
  if (teamId !== undefined) {
    if (teamId) {
      // Enforce max 3 drivers per team (excluding this driver)
      const res = await checkTeamDriverLimit(supabase, teamId, driverId);
      if (res) return res;
    }
    update.team = teamId || null;
  }
  if (image !== undefined) {
    update.image = image || null;
  }
  const { data, error } = await supabase
    .from('drivers')
    .update(update)
    .eq('id', driverId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.del('drivers:list');
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { driverId } = await request.json();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('drivers').delete().eq('id', driverId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.del('drivers:list');
  return NextResponse.json({ success: true });
}
