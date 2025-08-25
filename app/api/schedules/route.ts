// app/api/schedules/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

export async function GET() {
  try {
    console.log('GET /api/schedules - fetching data...');
    const cacheKey = 'schedules:list';
    const cached = apiCache.get<any[]>(cacheKey);
    if (cached) return NextResponse.json(cached, withCacheControlHeaders());
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*');
    
    if (error) {
      console.error('GET /api/schedules - Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log('GET /api/schedules - raw data:', schedules);
    
    apiCache.set(cacheKey, schedules || [], 60_000);
    return NextResponse.json(schedules || [], withCacheControlHeaders());
  } catch (error) {
    console.error('GET /api/schedules - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { selectedTrack, date } = await request.json();
    console.log('POST /api/schedules - received:', { selectedTrack, date });
    
    // For now, let's try with the old structure to see what works
    const { data, error } = await supabase
      .from('schedules')
      .upsert([{ track: selectedTrack, date }], { onConflict: 'track' })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
         console.log('POST /api/schedules - success:', data);
     apiCache.del('schedules:list');
     return NextResponse.json({
       track: data.track,
       date: data.date?.slice(0, 10),
     });
  } catch (error) {
    console.error('POST /api/schedules - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
