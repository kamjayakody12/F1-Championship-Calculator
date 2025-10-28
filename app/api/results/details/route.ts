import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders, CACHE_DURATIONS, CACHE_PRESETS } from "@/lib/cache";

/**
 * GET /api/results/details?track={trackId}
 * 
 * Fetches race results with full driver and team details for display in the results page.
 * This endpoint enriches the basic results data with driver names, numbers, team info,
 * and calculates points based on the current rules configuration.
 * 
 * Query Parameters:
 * - track: The selected_track.id (required)
 * 
 * Returns:
 * - Array of enriched result objects with driver details, team details, and calculated points
 * - Cached for 30 seconds to improve performance
 */
export async function GET(request: Request) {
  // Extract track ID from query parameters
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");

  // Validate required parameter
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }

  try {
    // Step 1: Determine if this is a Race or Sprint event
    // This affects point calculations (different point systems)
    const { data: selectedTrack, error: trackError } = await supabase
      .from("selected_tracks")
      .select("type")
      .eq("id", track)
      .single();

    if (trackError) {
      console.error("Error fetching track type:", trackError);
      return NextResponse.json({ error: trackError.message }, { status: 500 });
    }

    const eventType = selectedTrack?.type || 'Race';

    // Step 2: Fetch rules to determine if pole position and fastest lap award bonus points
    // These rules can be toggled on/off by admins
    const { data: rules, error: rulesError } = await supabase
      .from("rules")
      .select("polegivespoint, fastestlapgivespoint")
      .eq("id", 1)
      .single();

    if (rulesError) {
      console.error("Error fetching rules:", rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    // Step 3: Check cache to avoid redundant database queries
    const cacheKey = `results-details:track:${track}:${eventType}:v1`;
    const cached = apiCache.get<any[]>(cacheKey);
    if (cached) return NextResponse.json(cached, withCacheControlHeaders(undefined, CACHE_PRESETS.DYNAMIC));

    // Step 4: Fetch results with nested driver and team data using Supabase joins
    // This single query gets all the data we need in one go
    const { data: results, error } = await supabase
      .from("results")
      .select(`
        *,
        drivers!inner (
          id,
          name,
          driver_number,
          team,
          teams!inner (
            id,
            name,
            logo
          )
        )
      `)
      .eq("track", track)
      .order("finishing_position", { ascending: true });

    if (error) {
      console.error("Error fetching results with details:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Step 5: Define team colors for UI display
    // These are dark mode friendly colors that work well in the interface
    const teamColorMap: { [key: string]: string } = {
      'Red Bull': '#002661',     // Dark blue
      'Mercedes': '#002d33',     // Dark teal
      'Mclaren': '#461a08',      // Dark orange
      'Ferrari': '#520810',      // Dark red
      'Sauber': '#002f14',       // Dark green
      'Aston Martin': '#1b2d00', // Dark lime
      'RB': '#3a1659',           // Dark purple
      'Haas': '#282828',         // Dark gray
      'Alpine': '#50003F',       // Dark magenta
      'Williams': '#002661',     // Dark blue
    };

    // Step 6: Transform database results into frontend-friendly format
    // This includes calculating points and adding display-specific fields
    const transformedResults = (results || []).map((result: any) => ({
      // Basic result data
      id: result.id,
      track: result.track,
      position: result.finishing_position,
      driver: result.driver,
      pole: result.pole,
      fastestlap: result.fastestlap,
      racefinished: result.racefinished,
      qualified_position: result.qualified_position,
      
      // Driver information
      driverDetails: {
        id: result.drivers.id,
        name: result.drivers.name,
        driver_number: result.drivers.driver_number,
        team: result.drivers.team
      },
      
      // Team information with color for UI
      teamDetails: {
        id: result.drivers.teams.id,
        name: result.drivers.teams.name,
        logo: result.drivers.teams.logo,
        color: teamColorMap[result.drivers.teams.name] || '#B6BABD' // Default gray if team not found
      },
      
      // Display fields (placeholder data for now)
      time: result.racefinished ? (result.finishing_position === 1 ? '1:35:21.231' : '-') : 'DNF',
      gap: result.racefinished && result.finishing_position > 1 ? '-' : '-',
      
      // Calculate points based on position, bonuses, and rules
      points: calculatePoints(
        result.finishing_position, 
        result.pole, 
        result.fastestlap, 
        result.racefinished, 
        eventType as 'Race' | 'Sprint', 
        rules
      ),
      
      // Additional display data (placeholder for now)
      laps: result.racefinished ? 70 : Math.floor(Math.random() * 50) + 10,
      fastestLapTime: result.fastestlap ? '1:19.409' : undefined,
      fastestLapNumber: result.fastestlap ? 45 : undefined
    }));

    // Step 7: Cache the transformed results and return
    apiCache.set(cacheKey, transformedResults, CACHE_DURATIONS.RESULTS);
    return NextResponse.json(transformedResults, withCacheControlHeaders(undefined, CACHE_PRESETS.DYNAMIC));
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Calculate points for a race result based on position and bonuses
 * 
 * Point Systems:
 * - Race: Top 10 get points [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
 * - Sprint: Top 8 get points [8, 7, 6, 5, 4, 3, 2, 1]
 * 
 * Bonus Points (if enabled in rules):
 * - Pole position: +1 point
 * - Fastest lap: +1 point
 * 
 * @param position - Finishing position (1-based)
 * @param pole - Whether driver had pole position
 * @param fastestLap - Whether driver had fastest lap
 * @param racefinished - Whether driver finished the race (DNF = 0 points)
 * @param type - Event type ('Race' or 'Sprint')
 * @param rules - Rules configuration from database
 * @returns Total points earned
 */
function calculatePoints(
  position: number,
  pole: boolean,
  fastestLap: boolean,
  racefinished: boolean,
  type: 'Race' | 'Sprint',
  rules: { polegivespoint: boolean; fastestlapgivespoint: boolean }
): number {
  // DNF drivers get 0 points regardless of pole or fastest lap
  if (!racefinished) {
    return 0;
  }

  // Define point mappings for each event type
  const racePoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];   // Top 10 positions
  const sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1];            // Top 8 positions

  // Select appropriate point system
  const pointsMapping = type === 'Sprint' ? sprintPoints : racePoints;
  
  // Calculate base points from finishing position
  const basePoints = position <= pointsMapping.length ? pointsMapping[position - 1] : 0;

  // Add bonus points if enabled in rules
  let bonusPoints = 0;
  if (pole && rules.polegivespoint) bonusPoints += 1;
  if (fastestLap && rules.fastestlapgivespoint) bonusPoints += 1;

  return basePoints + bonusPoints;
}
