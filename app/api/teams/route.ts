/**
 * /api/teams
 * 
 * CRUD operations for managing teams (constructors) in the championship.
 * Teams compete in the Constructor's Championship based on their drivers' points.
 * 
 * Business Rules:
 * - Each team can have up to 3 drivers (enforced in /api/drivers)
 * - Team points = sum of all their drivers' points
 * - Deleting a team sets all its drivers to "no team"
 * - Team points are updated when race results are saved
 * 
 * Endpoints:
 * - GET: List all teams
 * - POST: Create a new team
 * - PUT: Update team name
 * - DELETE: Remove team (drivers become teamless)
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

/**
 * GET /api/teams
 * 
 * Fetches all teams in the championship.
 * Results are cached for 60 seconds.
 * 
 * Returns:
 * Array of team objects:
 * [
 *   {
 *     id: string,
 *     name: string,
 *     points: number,    // Constructor championship points
 *     logo: string       // Team logo URL (optional)
 *   }
 * ]
 */
export async function GET() {
  // Check cache first
  const cacheKey = `teams:list`;
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  
  // Fetch from database
  const { data: teams, error } = await supabase.from('teams').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Cache and return
  apiCache.set(cacheKey, teams || [], 60_000);
  return NextResponse.json(teams, withCacheControlHeaders());
}

/**
 * POST /api/teams
 * 
 * Creates a new team in the championship.
 * New teams start with 0 points.
 * 
 * Request Body:
 * {
 *   name: string  // Team name (required)
 * }
 * 
 * Returns:
 * The created team object
 */
export async function POST(request: Request) {
  const { name } = await request.json();
  
  // Create team with initial 0 points
  const { data, error } = await supabase.from('teams').insert([{ name }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('teams:list');
  return NextResponse.json(data);
}

/**
 * PUT /api/teams
 * 
 * Updates a team's name.
 * 
 * Request Body:
 * {
 *   teamId: string,  // Team UUID (required)
 *   name: string     // New team name (required)
 * }
 * 
 * Returns:
 * The updated team object
 */
export async function PUT(request: Request) {
  const { teamId, name } = await request.json();
  
  // Update team name
  const { data, error } = await supabase.from('teams').update({ name }).eq('id', teamId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('teams:list');
  return NextResponse.json(data);
}

/**
 * DELETE /api/teams
 * 
 * Removes a team from the championship.
 * All drivers in this team are set to "no team" (team = null).
 * 
 * Request Body:
 * {
 *   teamId: string  // Team UUID (required)
 * }
 * 
 * Process:
 * 1. Set all drivers' team field to null
 * 2. Delete the team
 * 
 * Note: This does NOT delete:
 * - Historical race results
 * - Driver records
 * - Team's historical points
 * 
 * Returns:
 * { success: true }
 */
export async function DELETE(request: Request) {
  const { teamId } = await request.json();
  console.log("Deleting team with id:", teamId);

  // STEP 1: Remove team assignment from all drivers
  // Set their 'team' field to null so they become teamless
  const { error: driverUpdateError } = await supabase
    .from('drivers')
    .update({ team: null })
    .eq('team', teamId);

  if (driverUpdateError) {
    console.error("Failed to update drivers:", driverUpdateError);
    return NextResponse.json({ error: driverUpdateError.message }, { status: 500 });
  }

  // STEP 2: Delete the team
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) {
    console.error("Supabase delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Invalidate cache
  apiCache.del('teams:list');
  return NextResponse.json({ success: true });
}