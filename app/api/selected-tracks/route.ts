/**
 * /api/selected-tracks
 * 
 * Manages the tracks selected for the current championship season.
 * This is a crucial concept: selected_tracks links physical tracks to event types.
 * 
 * Key Concept:
 * - tracks table: Contains all available physical tracks (e.g., "Monaco", "Silverstone")
 * - selected_tracks table: Tracks chosen for THIS season with their event type
 * 
 * Why separate tables?
 * - Same physical track can appear multiple times (e.g., Baku Race + Baku Sprint)
 * - Each selected_track has its own:
 *   - Event type (Race or Sprint)
 *   - Schedule date
 *   - Results
 *   - Qualifying
 * 
 * Database Structure:
 * - id: selected_track.id (used in results, qualifying, schedules)
 * - track: References tracks.id (the physical track)
 * - type: 'Race' or 'Sprint'
 * 
 * Endpoints:
 * - GET: List all tracks in current season
 * - POST: Add a track to the season
 * - PUT: Update track's event type
 * - DELETE: Remove track from season
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

/**
 * GET /api/selected-tracks
 * 
 * Fetches all tracks selected for the current championship season.
 * Results include nested track data (name, location, etc.)
 * 
 * Returns:
 * Array of selected tracks:
 * [
 *   {
 *     id: string,           // selected_track.id (used in results/qualifying/schedules)
 *     track: {              // Nested physical track data
 *       id: string,         // tracks.id
 *       name: string,       // Track name (e.g., "Monaco")
 *       ...                 // Other track metadata
 *     },
 *     type: 'Race' | 'Sprint'  // Event type
 *   }
 * ]
 * 
 * Cached for 60 seconds.
 */
export async function GET() {
  // Check cache first
  const cached = apiCache.get<any[]>(`selected-tracks:list`);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  
  // Fetch selected tracks with nested physical track data
  const { data: sel, error } = await supabase
    .from('selected_tracks')
    .select('id, track, type, tracks(*)');  // Join with tracks table
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Transform to cleaner format
  const payload = (sel || []).map((s: any) => ({ 
    id: s.id,           // selected_track.id
    track: s.tracks,    // Nested track object
    type: s.type        // Event type
  }));
  
  // Cache and return
  apiCache.set('selected-tracks:list', payload, 60_000);
  return NextResponse.json(payload, withCacheControlHeaders());
}

/**
 * POST /api/selected-tracks
 * 
 * Adds a track to the current championship season.
 * Creates a new selected_track entry linking a physical track to an event type.
 * 
 * Request Body:
 * {
 *   trackId: string,           // tracks.id (physical track)
 *   type: 'Race' | 'Sprint'    // Event type
 * }
 * 
 * Example Use Cases:
 * - Add Monaco as a Race: { trackId: "monaco-id", type: "Race" }
 * - Add Baku as a Sprint: { trackId: "baku-id", type: "Sprint" }
 * - Add Baku as a Race: { trackId: "baku-id", type: "Race" } (separate entry!)
 * 
 * Returns:
 * {
 *   id: string,              // New selected_track.id
 *   track: Track,            // Physical track object
 *   type: 'Race' | 'Sprint'
 * }
 */
export async function POST(request: Request) {
  const { trackId, type } = await request.json();
  
  // Validation: Ensure the physical track exists
  const { data: trackObj, error: trackError } = await supabase
    .from('tracks')
    .select('*')
    .eq('id', trackId)
    .single();
    
  if (trackError || !trackObj) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Create new selected_track entry
  const { data: newSel, error } = await supabase
    .from('selected_tracks')
    .insert([{ track: trackId, type }])
    .select('id, track, type, tracks(*)')
    .single();
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('selected-tracks:list');
  
  return NextResponse.json({ 
    id: newSel.id,          // This ID is used in results, qualifying, schedules
    track: newSel.tracks,   // Physical track data
    type: newSel.type       // Event type
  });
}

/**
 * PUT /api/selected-tracks
 * 
 * Updates the event type of a selected track.
 * Useful for changing a track from Race to Sprint or vice versa.
 * 
 * Request Body:
 * {
 *   trackId: string,           // selected_track.id (NOT tracks.id!)
 *   type: 'Race' | 'Sprint'    // New event type
 * }
 * 
 * Important: trackId here is selected_track.id, not the physical track ID.
 * 
 * Returns:
 * {
 *   id: string,
 *   track: Track,
 *   type: 'Race' | 'Sprint'
 * }
 */
export async function PUT(request: Request) {
  const { trackId, type } = await request.json();
  
  // Validate required fields
  if (!trackId || !type) {
    return NextResponse.json({ error: "trackId and type are required" }, { status: 400 });
  }

  // Update the event type
  const { data: updatedTrack, error } = await supabase
    .from('selected_tracks')
    .update({ type })
    .eq('id', trackId)  // trackId is selected_track.id
    .select('id, track, type, tracks(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updatedTrack) return NextResponse.json({ error: "Selected track not found" }, { status: 404 });

  // Invalidate cache
  apiCache.del('selected-tracks:list');
  
  return NextResponse.json({ 
    id: updatedTrack.id, 
    track: updatedTrack.tracks,
    type: updatedTrack.type 
  });
}

/**
 * DELETE /api/selected-tracks
 * 
 * Removes a track from the current championship season.
 * This deletes the selected_track entry (not the physical track).
 * 
 * Request Body:
 * {
 *   trackId: string  // selected_track.id (NOT tracks.id!)
 * }
 * 
 * Important: This removes the track from the season but does NOT:
 * - Delete the physical track from the tracks table
 * - Delete historical results for this track
 * - Delete qualifying data for this track
 * 
 * Returns:
 * { success: true }
 */
export async function DELETE(request: Request) {
  const { trackId } = await request.json();
  
  // Validate required field
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  // Delete the selected_track entry
  const { error } = await supabase
    .from('selected_tracks')
    .delete()
    .eq('id', trackId);  // trackId is selected_track.id
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('selected-tracks:list');
  
  return NextResponse.json({ success: true });
}
