/**
 * /api/qualifying
 * 
 * Manages qualifying session results for race weekends.
 * Qualifying determines the starting grid positions for the race.
 * 
 * Purpose:
 * - Store qualifying positions for each driver at each track
 * - Link qualifying results to race results (starting grid)
 * - Display qualifying positions in results tables
 * 
 * Note: Qualifying results do NOT award championship points.
 * They only determine starting positions for the race.
 * 
 * Endpoints:
 * - GET: Fetch qualifying results for a specific track
 * - POST: Create qualifying results (first time only)
 */

import { NextResponse } from "next/server";
import { adminSupabase } from "@/utils/supabase/admin";

/**
 * GET /api/qualifying?track={trackId}
 * 
 * Fetches qualifying results for a specific track.
 * Results are ordered by position (P1, P2, P3, etc.)
 * 
 * Query Parameters:
 * - track: The selected_track.id (required)
 * 
 * Returns:
 * Array of qualifying results:
 * [
 *   {
 *     id: string,
 *     track: string,      // selected_track.id
 *     driver: string,     // driver.id
 *     position: number    // Qualifying position (1-based)
 *   }
 * ]
 */
export async function GET(request: Request) {
  // Extract track ID from query parameters
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");
  const seasonId = searchParams.get("seasonId");

  // Validate required parameter
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }

  // Fetch qualifying results ordered by position
  let qualifyingQuery = adminSupabase
    .from("qualifying")
    .select("*")
    .eq("track", track);

  if (seasonId) {
    qualifyingQuery = qualifyingQuery.eq("season_id", seasonId);
  }

  const { data: qualifying, error } = await qualifyingQuery.order("position", { ascending: true });  // P1, P2, P3, etc.

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(qualifying);
}

/**
 * POST /api/qualifying
 * 
 * Creates qualifying results for a track (FIRST TIME ONLY).
 * This endpoint will reject if qualifying results already exist.
 * 
 * Request Body:
 * {
 *   track: string,              // selected_track.id
 *   qualifyingResults: Array<{
 *     driverId: string,
 *     position: number          // Qualifying position (1-based)
 *   }>
 * }
 * 
 * Process:
 * 1. Validates no existing qualifying results exist
 * 2. Inserts each driver's qualifying position
 * 3. These positions are later used as "starting grid" in race results
 * 
 * Note: Qualifying does NOT award championship points.
 * It only determines starting positions.
 * 
 * Returns:
 * { success: true }
 */
export async function POST(request: Request) {
  // Parse request body
  const { track, qualifyingResults, seasonId } = await request.json();
  console.log("POST /api/qualifying payload:", { track, seasonId, qualifyingResults });

  // STEP 1: Prevent duplicate qualifying results
  // Check if qualifying results already exist for this track
  let existingQualifyingQuery = adminSupabase
    .from("qualifying")
    .select("id")
    .eq("track", track);

  if (seasonId) {
    existingQualifyingQuery = existingQualifyingQuery.eq("season_id", seasonId);
  }

  const { data: existingQualifying, error: existingErr } = await existingQualifyingQuery;

  if (existingErr) {
    console.error("Error checking existing qualifying:", existingErr);
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  // Reject if qualifying already exists (no updates allowed via this endpoint)
  if ((existingQualifying?.length || 0) > 0) {
    return NextResponse.json(
      { error: "Qualifying results for this event already exist. Updating existing results is disabled." },
      { status: 400 }
    );
  }

  // STEP 2: Insert qualifying results for each driver
  for (const result of qualifyingResults) {
    // Skip if no driver ID provided
    if (!result.driverId) continue;

    // Insert qualifying position
    const { error: insertError } = await adminSupabase.from("qualifying").insert([
      {
        track,
        season_id: seasonId || null,
        position: result.position,  // Qualifying position (1-based)
        driver: result.driverId
      },
    ]);

    if (insertError) {
      console.error("Error inserting qualifying result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`Inserted qualifying result for driver ${result.driverId} at position ${result.position}`);
  }

  return NextResponse.json({ success: true });
}
