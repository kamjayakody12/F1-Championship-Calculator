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
export async function GET() {
  try {
    console.log('GET /api/schedules - fetching data...');
    
    // Check cache first
    const cacheKey = 'schedules:list';
    const cached = apiCache.get<any[]>(cacheKey);
    if (cached) return NextResponse.json(cached, withCacheControlHeaders());
    
    // Fetch all schedules from database
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*');
    
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
    const { selectedTrack, date } = await request.json();
    console.log('POST /api/schedules - received:', { selectedTrack, date });
    
    // Upsert: Insert new or update existing schedule
    // onConflict: 'track' means if this track already has a schedule, update it
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
    
    // Invalidate cache so next GET fetches fresh data
    apiCache.del('schedules:list');
    
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
