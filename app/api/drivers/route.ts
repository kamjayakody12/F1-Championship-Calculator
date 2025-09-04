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

// Function to check if driver number is already taken
async function checkDriverNumberTaken(supabase: any, driverNumber: number, excludeDriverId?: string) {
  if (!driverNumber) return null; // Allow null/empty numbers
  
  const { data: existingDriver, error } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('driver_number', driverNumber);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If we found a driver with this number and it's not the driver we're updating
  if (existingDriver && existingDriver.length > 0) {
    const conflictingDriver = excludeDriverId 
      ? existingDriver.find((d: any) => d.id !== excludeDriverId)
      : existingDriver[0];
    
    if (conflictingDriver) {
      return NextResponse.json({ 
        error: `Driver number ${driverNumber} is already taken by ${conflictingDriver.name}.` 
      }, { status: 400 });
    }
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
  const { name, driver_number, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  
  // Check for duplicate driver number
  if (driver_number) {
    const res = await checkDriverNumberTaken(supabase, driver_number);
    if (res) return res;
  }
  
  // Enforce max 3 drivers per team
  if (teamId) {
    const res = await checkTeamDriverLimit(supabase, teamId);
    if (res) return res;
  }
  
  const { data, error } = await supabase.from('drivers').insert([
    {
      name,
      driver_number: driver_number || null,
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
  const { driverId, name, driver_number, points, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  
  // Check for duplicate driver number (excluding current driver)
  if (driver_number !== undefined && driver_number !== null) {
    const res = await checkDriverNumberTaken(supabase, driver_number, driverId);
    if (res) return res;
  }
  
  const update: { 
    name?: string; 
    driver_number?: number | null; 
    points?: number; 
    team?: string | null; 
    image?: string | null 
  } = {};
  
  if (name !== undefined) update.name = name;
  if (driver_number !== undefined) update.driver_number = driver_number;
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