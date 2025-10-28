/**
 * /api/drivers
 * 
 * CRUD operations for managing drivers in the championship.
 * Handles driver creation, updates, deletion, and listing.
 * 
 * Business Rules:
 * - Each team can have a maximum of 3 drivers
 * - Driver numbers must be unique across all drivers
 * - Driver numbers are optional (can be null)
 * - New drivers start with 0 points
 * - Deleting a driver does not affect historical results
 * 
 * Endpoints:
 * - GET: List all drivers
 * - POST: Create a new driver
 * - PUT: Update an existing driver
 * - DELETE: Remove a driver
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { apiCache, withCacheControlHeaders, CACHE_DURATIONS, CACHE_PRESETS } from "@/lib/cache";

/**
 * Validates that a team doesn't exceed the maximum driver limit (3 drivers)
 * 
 * @param supabase - Supabase client instance
 * @param teamId - The team ID to check
 * @param excludeDriverId - Optional driver ID to exclude from count (used when updating)
 * @returns Error response if limit exceeded, null if valid
 */
async function checkTeamDriverLimit(supabase: any, teamId: string, excludeDriverId?: string) {
  // Fetch all drivers currently in this team
  const { data: teamDrivers, error } = await supabase
    .from('drivers')
    .select('id')
    .eq('team', teamId);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count drivers, excluding the one being updated (if applicable)
  const count = excludeDriverId
    ? (teamDrivers || []).filter((d: any) => d.id !== excludeDriverId).length
    : (teamDrivers?.length || 0);

  // Enforce 3-driver limit per team
  if (count >= 3) {
    return NextResponse.json({ 
      error: 'A team cannot have more than 3 drivers.' 
    }, { status: 400 });
  }
  
  return null; // Validation passed
}

/**
 * Validates that a driver number is not already taken by another driver
 * 
 * @param supabase - Supabase client instance
 * @param driverNumber - The driver number to check
 * @param excludeDriverId - Optional driver ID to exclude from check (used when updating)
 * @returns Error response if number is taken, null if available
 */
async function checkDriverNumberTaken(supabase: any, driverNumber: number, excludeDriverId?: string) {
  // Allow null/empty driver numbers (they're optional)
  if (!driverNumber) return null;
  
  // Search for any driver with this number
  const { data: existingDriver, error } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('driver_number', driverNumber);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if the number is taken by a different driver
  if (existingDriver && existingDriver.length > 0) {
    const conflictingDriver = excludeDriverId 
      ? existingDriver.find((d: any) => d.id !== excludeDriverId)  // Exclude current driver when updating
      : existingDriver[0];  // Any driver when creating new
    
    if (conflictingDriver) {
      return NextResponse.json({ 
        error: `Driver number ${driverNumber} is already taken by ${conflictingDriver.name}.` 
      }, { status: 400 });
    }
  }
  
  return null; // Number is available
}

/**
 * GET /api/drivers
 * 
 * Fetches all drivers in the championship.
 * Results are cached for 60 seconds to improve performance.
 * 
 * Returns:
 * Array of driver objects with:
 * - id: Driver UUID
 * - name: Driver name
 * - driver_number: Racing number (optional)
 * - team: Team UUID (optional)
 * - points: Current championship points
 * - image: Profile image URL (optional)
 */
export async function GET() {
  // Check cache first
  const cached = apiCache.get<any[]>(`drivers:list`);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders(undefined, CACHE_PRESETS.DYNAMIC));
  
  // Fetch from database
  const supabase = await createServerSupabase();
  const { data: drivers, error } = await supabase.from('drivers').select('*');
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Cache with appropriate duration
  apiCache.set(`drivers:list`, drivers || [], CACHE_DURATIONS.DRIVERS);
  return NextResponse.json(drivers, withCacheControlHeaders(undefined, CACHE_PRESETS.DYNAMIC));
}

/**
 * POST /api/drivers
 * 
 * Creates a new driver in the championship.
 * 
 * Request Body:
 * {
 *   name: string (required),
 *   driver_number: number (optional),
 *   teamId: string (optional),
 *   image: string (optional)
 * }
 * 
 * Validations:
 * - Driver number must be unique (if provided)
 * - Team cannot exceed 3 drivers (if team specified)
 * 
 * Returns:
 * The created driver object
 */
export async function POST(request: Request) {
  const { name, driver_number, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  
  // Validation 1: Check for duplicate driver number
  if (driver_number) {
    const res = await checkDriverNumberTaken(supabase, driver_number);
    if (res) return res; // Return error if number is taken
  }
  
  // Validation 2: Enforce max 3 drivers per team
  if (teamId) {
    const res = await checkTeamDriverLimit(supabase, teamId);
    if (res) return res; // Return error if team is full
  }
  
  // Create the driver with initial 0 points
  const { data, error } = await supabase.from('drivers').insert([
    {
      name,
      driver_number: driver_number || null,
      team: teamId,
      points: 0,  // New drivers start with 0 points
      image: image || null,
    },
  ]).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache so next GET fetches fresh data
  apiCache.del('drivers:list');
  return NextResponse.json(data);
}

/**
 * PUT /api/drivers
 * 
 * Updates an existing driver's information.
 * Only provided fields will be updated (partial updates supported).
 * 
 * Request Body:
 * {
 *   driverId: string (required),
 *   name?: string,
 *   driver_number?: number,
 *   points?: number,
 *   teamId?: string,
 *   image?: string
 * }
 * 
 * Validations:
 * - Driver number must be unique (if changed)
 * - New team cannot exceed 3 drivers (if team changed)
 * 
 * Returns:
 * The updated driver object
 */
export async function PUT(request: Request) {
  const { driverId, name, driver_number, points, teamId, image } = await request.json();
  const supabase = await createServerSupabase();
  
  // Validation 1: Check for duplicate driver number (excluding this driver)
  if (driver_number !== undefined && driver_number !== null) {
    const res = await checkDriverNumberTaken(supabase, driver_number, driverId);
    if (res) return res; // Return error if number is taken by another driver
  }
  
  // Build update object with only provided fields
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
  
  // Validation 2: Check team driver limit if team is being changed
  if (teamId !== undefined) {
    if (teamId) {
      // Enforce max 3 drivers per team (excluding this driver from count)
      const res = await checkTeamDriverLimit(supabase, teamId, driverId);
      if (res) return res; // Return error if new team is full
    }
    update.team = teamId || null;
  }
  
  if (image !== undefined) {
    update.image = image || null;
  }
  
  // Update the driver
  const { data, error } = await supabase
    .from('drivers')
    .update(update)
    .eq('id', driverId)
    .select()
    .single();
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('drivers:list');
  return NextResponse.json(data);
}

/**
 * DELETE /api/drivers
 * 
 * Removes a driver from the championship.
 * Note: This does not delete historical race results for this driver.
 * 
 * Request Body:
 * {
 *   driverId: string (required)
 * }
 * 
 * Returns:
 * { success: true }
 */
export async function DELETE(request: Request) {
  const { driverId } = await request.json();
  const supabase = await createServerSupabase();
  
  // Delete the driver
  const { error } = await supabase.from('drivers').delete().eq('id', driverId);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache
  apiCache.del('drivers:list');
  return NextResponse.json({ success: true });
}