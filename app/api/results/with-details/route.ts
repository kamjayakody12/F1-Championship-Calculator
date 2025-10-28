import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");

  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }

  try {
    // First, get the event type for this track
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

    // Fetch rules to determine if pole and fastest lap give points
    const { data: rules, error: rulesError } = await supabase
      .from("rules")
      .select("polegivespoint, fastestlapgivespoint")
      .eq("id", 1)
      .single();

    if (rulesError) {
      console.error("Error fetching rules:", rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    const cacheKey = `results-with-details:track:${track}:${eventType}:v4`; // Updated cache key to force refresh
    const cached = apiCache.get<any[]>(cacheKey);
    if (cached) return NextResponse.json(cached, withCacheControlHeaders());

    // Fetch results with driver and team details
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

    console.log('Database query results:', results); // Debug log

    if (error) {
      console.error("Error fetching results with details:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Team color mapping using dark mode friendly palette
    const teamColorMap: { [key: string]: string } = {
      'Red Bull': '#002661',     // Blue 900 - dark blue
      'Mercedes': '#002d33',     // Teal 900 - dark teal
      'Mclaren': '#461a08',      // Orange 900 - dark orange
      'Ferrari': '#520810',      // Red 900 - dark red
      'Sauber': '#002f14',       // Green 900 - dark green
      'Aston Martin': '#1b2d00', // Lime 900 - dark lime
      'RB': '#3a1659',           // Purple 900 - dark purple
      'Haas': '#282828',         // Gray 900 - dark gray
      'Alpine': '#50003F',       // Magenta 900 - dark magenta
      'Williams': '#002661',     // Blue 900 - dark blue (same as Red Bull)
    };

    // Transform the data to match the expected format
    const transformedResults = (results || []).map((result: any) => ({
      id: result.id,
      track: result.track,
      position: result.finishing_position,
      driver: result.driver,
      pole: result.pole,
      fastestlap: result.fastestlap,
      racefinished: result.racefinished,
      qualified_position: result.qualified_position,
      driverDetails: {
        id: result.drivers.id,
        name: result.drivers.name,
        driver_number: result.drivers.driver_number,
        team: result.drivers.team
      },
      teamDetails: {
        id: result.drivers.teams.id,
        name: result.drivers.teams.name,
        logo: result.drivers.teams.logo,
        color: teamColorMap[result.drivers.teams.name] || '#B6BABD'
      },
      time: result.racefinished ? (result.finishing_position === 1 ? '1:35:21.231' : '-') : 'DNF',
      gap: result.racefinished && result.finishing_position > 1 ? '-' : '-',
      points: calculatePoints(result.finishing_position, result.pole, result.fastestlap, result.racefinished, eventType as 'Race' | 'Sprint', rules),
      laps: result.racefinished ? 70 : Math.floor(Math.random() * 50) + 10,
      fastestLapTime: result.fastestlap ? '1:19.409' : undefined,
      fastestLapNumber: result.fastestlap ? 45 : undefined
    }));

    console.log('Transformed results:', transformedResults); // Debug log
    apiCache.set(cacheKey, transformedResults, 30_000);
    return NextResponse.json(transformedResults, withCacheControlHeaders());
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculatePoints(
  position: number,
  pole: boolean,
  fastestLap: boolean,
  racefinished: boolean,
  type: 'Race' | 'Sprint',
  rules: { polegivespoint: boolean; fastestlapgivespoint: boolean }
): number {
  // If driver didn't finish the race, they get 0 points regardless of pole or fastest lap
  if (!racefinished) {
    return 0;
  }

  const racePoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1];

  const pointsMapping = type === 'Sprint' ? sprintPoints : racePoints;
  const basePoints = position <= pointsMapping.length ? pointsMapping[position - 1] : 0;

  // Add bonus points for pole and fastest lap based on rules (applies to both Race and Sprint)
  let bonusPoints = 0;
  if (pole && rules.polegivespoint) bonusPoints += 1;
  if (fastestLap && rules.fastestlapgivespoint) bonusPoints += 1;

  return basePoints + bonusPoints;
}
