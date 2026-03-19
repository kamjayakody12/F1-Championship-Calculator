/**
 * /api/schedules
 * 
 * Manages the race calendar/schedule for the championship season.
 * Each schedule entry links a selected track to a specific date.
 * 
 * Database Structure:
 * - track: References selected_tracks.id (not tracks.id)
 * - date: ISO date string (YYYY-MM-DD)
 * 
 * Purpose:
 * - Determines the order of races in the season
 * - Used for chronological sorting in charts and standings
 * - Links selected tracks (which can be Race or Sprint) to calendar dates
 * 
 * Endpoints:
 * - GET: Fetch all scheduled races
 * - POST: Create or update a schedule entry (upsert)
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

async function resolveSeasonId(request?: Request, bodySeasonId?: string | null): Promise<string | null> {
  if (bodySeasonId) return bodySeasonId;
  if (request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("seasonId");
    if (q) return q;
  }
  const { data } = await supabase.from("seasons").select("id, season_number").order("season_number", { ascending: false }).limit(1);
  return data?.[0]?.id || null;
}

/**
 * GET /api/schedules
 * 
 * Fetches all scheduled races for the current season.
 * Results are cached for 60 seconds.
 * 
 * Returns:
 * Array of schedule objects:
 * [
 *   {
 *     track: string,  // selected_tracks.id (not tracks.id!)
 *     date: string    // ISO date (YYYY-MM-DD)
 *   }
 * ]
 * 
 * Note: The 'track' field references selected_tracks, which includes
 * both the physical track and the event type (Race/Sprint)
 */
export async function GET(request: Request) {
  try {
    console.log('GET /api/schedules - fetching data...');
    const seasonId = await resolveSeasonId(request);
    
    // Check cache first
    const cacheKey = `schedules:list:${seasonId || "all"}`;
    const cached = apiCache.get<any[]>(cacheKey);
    if (cached) return NextResponse.json(cached, withCacheControlHeaders());
    
    // Fetch all schedules from database
    let query = supabase
      .from('schedules')
      .select('*');
    if (seasonId) query = query.eq("season_id", seasonId);
    const { data: schedules, error } = await query;
    
    if (error) {
      console.error('GET /api/schedules - Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log('GET /api/schedules - raw data:', schedules);
    
    // Cache for 60 seconds and return
    apiCache.set(cacheKey, schedules || [], 60_000);
    return NextResponse.json(schedules || [], withCacheControlHeaders());
    
  } catch (error) {
    console.error('GET /api/schedules - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/schedules
 * 
 * Creates or updates a schedule entry for a selected track.
 * Uses upsert to avoid duplicates (updates if track already scheduled).
 * 
 * Request Body:
 * {
 *   selectedTrack: string,  // selected_tracks.id
 *   date: string            // ISO date (YYYY-MM-DD)
 * }
 * 
 * Behavior:
 * - If track already has a schedule, updates the date
 * - If track doesn't have a schedule, creates new entry
 * - Uses 'track' as conflict key (one schedule per selected_track)
 * 
 * Returns:
 * {
 *   track: string,  // selected_tracks.id
 *   date: string    // ISO date (YYYY-MM-DD)
 * }
 */
export async function POST(request: Request) {
  try {
    const { selectedTrack, date, seasonId: bodySeasonId } = await request.json();
    const seasonId = await resolveSeasonId(undefined, bodySeasonId || null);
    console.log('POST /api/schedules - received:', { selectedTrack, date, seasonId });
    
    // Update if exists for this season + selected track, else insert
    const { data: existing } = await supabase
      .from("schedules")
      .select("id")
      .eq("track", selectedTrack)
      .eq("season_id", seasonId)
      .maybeSingle();

    const { data, error } = existing?.id
      ? await supabase.from("schedules").update({ date }).eq("id", existing.id).select().single()
      : await supabase.from("schedules").insert([{ track: selectedTrack, date, season_id: seasonId }]).select().single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log('POST /api/schedules - success:', data);
    
    // Invalidate cache so next GET fetches fresh data
    apiCache.delByPrefix('schedules:list:');
    
    // Return the schedule with date formatted as YYYY-MM-DD
    return NextResponse.json({
      track: data.track,
      date: data.date?.slice(0, 10),  // Ensure date is in YYYY-MM-DD format
    });
    
  } catch (error) {
    console.error('POST /api/schedules - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
