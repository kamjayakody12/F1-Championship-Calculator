/**
 * /api/tracks
 * 
 * Manages the master list of physical racing tracks/circuits.
 * These are the actual locations where races can be held.
 * 
 * Key Concept:
 * - tracks: Physical racing circuits (e.g., "Monaco", "Silverstone")
 * - selected_tracks: Tracks chosen for current season (references tracks)
 * 
 * Relationship:
 * - One physical track can be used multiple times in a season
 * - Example: Baku can have both a Sprint and a Race (2 selected_tracks, 1 track)
 * 
 * Auto-Seeding:
 * - On first GET request, if tracks table is empty, seeds with F1 circuits
 * - This ensures the app works out of the box
 * 
 * Endpoints:
 * - GET: List all available tracks (auto-seeds if empty)
 * - POST: Add a new track
 * - PUT: Update track information
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

/**
 * Default F1 circuits for auto-seeding
 * These are inserted on first GET request if tracks table is empty
 */
const ROUND_NAMES = [
  "Australia", "China", "Japan", "Bahrain", "Saudi Arabia",
  "USA", "Italy", "Monaco", "Spain", "Canada", "Austria",
  "United Kingdom", "Belgium", "Hungary", "Netherlands",
  "Azerbaijan", "Singapore", "Mexico", "Brazil", "Qatar",
  "Abu Dhabi"
];

/**
 * GET /api/tracks
 * 
 * Fetches all available physical racing tracks.
 * Auto-seeds with F1 circuits on first call if table is empty.
 * 
 * Returns:
 * Array of track objects:
 * [
 *   {
 *     id: string,
 *     name: string,      // Track name (e.g., "Monaco")
 *     location: string,  // Optional location info
 *     country: string,   // Optional country
 *     img: string        // Optional track image/flag
 *   }
 * ]
 * 
 * Auto-Seeding:
 * - If tracks table is empty, automatically inserts default F1 circuits
 * - This happens only once on first GET request
 * - Ensures app works out of the box without manual setup
 * 
 * Cached for 60 seconds.
 */
export async function GET(request: Request) {
  // Check cache first
  const cached = apiCache.get<any[]>(`tracks:list`);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  
  // Check if tracks table is empty (for auto-seeding)
  const { count, error: countError } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true });
    
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  
  // Auto-seed: If no tracks exist, insert default F1 circuits
  if (count === 0) {
    const { error: insertError } = await supabase
      .from('tracks')
      .insert(ROUND_NAMES.map((name) => ({ name })));
      
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  
  // Fetch all tracks
  const { data: tracks, error } = await supabase.from('tracks').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Cache and return
  apiCache.set(`tracks:list`, tracks || [], 60_000);
  return NextResponse.json(tracks, withCacheControlHeaders());
}

/**
 * POST /api/tracks
 * 
 * Adds a new physical track to the master list.
 * This track can then be selected for the current season.
 * 
 * Request Body:
 * {
 *   name: string,  // Track name (required)
 *   date: string   // Optional date (deprecated, use schedules instead)
 * }
 * 
 * Returns:
 * The created track object
 */
export async function POST(request: Request) {
  const { name, date } = await request.json();
  
  // Create new track
  const { data, error } = await supabase.from('tracks').insert([{ name, date }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('tracks:list');
  return NextResponse.json(data);
}

/**
 * PUT /api/tracks
 * 
 * Updates track information.
 * 
 * Request Body:
 * {
 *   id: string,    // Track UUID (required)
 *   date: string   // Date to update (deprecated, use schedules instead)
 * }
 * 
 * Note: The 'date' field is deprecated. Use /api/schedules to manage dates.
 * 
 * Returns:
 * The updated track object
 */
export async function PUT(request: Request) {
  const { id, date } = await request.json();
  
  // Update track
  const { data, error } = await supabase.from('tracks').update({ date }).eq('id', id).select().single();
  
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('tracks:list');
  return NextResponse.json(data);
}
