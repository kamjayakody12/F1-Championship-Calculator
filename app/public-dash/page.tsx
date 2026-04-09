import Link from "next/link";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown } from "lucide-react";
import { JSX } from "react";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { PUBLIC_SEASON_COOKIE_NAME } from "@/lib/public-season";
import { getTeamColorVariations } from "./constructor-standings/hooks/constants";
import NextRaceTimer from "./NextRaceTimer";
import SeasonConfetti from "./SeasonConfetti";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EvolutionData {
  value: string;
  color: string;
  icon: JSX.Element | null;
}

interface StandingEntry {
  id: string;
  name: string;
  points: number;
  position: number;
}

interface TrackRound {
  trackId: string;
  trackName: string;
  date: string;
  results: any[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract image URL from HTML string
 */
function extractImageUrl(htmlString: string): string {
  if (!htmlString) return '';
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : '';
}

function getImageSrc(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw);
  return extractImageUrl(str) || str;
}

function getMediaSrc(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str || str === "null" || str === "undefined") return "";
  return extractImageUrl(str) || str;
}

function isLikelyVideoUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".ogg") ||
    clean.endsWith(".mov") ||
    clean.includes("/driver-celebrations/")
  );
}

function toAlphaHsl(hsl: string, alpha: number): string {
  const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (!match) return hsl;
  const [, h, s, l] = match;
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

/**
 * Calculate points for a specific result based on rules
 * This should match the points calculation in the admin panel
 */
function calculateResultPoints(result: any, rules: any, eventType: string): number {
  // If driver didn't finish, no points
  if (!result.racefinished) return 0;

  // Points mapping based on event type
  const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

  const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
  const maxPositions = eventType === 'Sprint' ? 8 : 10;

  const position = result.finishing_position || result.position || 0;
  const basePoints = position <= maxPositions ? pointsMapping[position - 1] : 0;

  // Add bonus points
  const poleBonus = rules?.polegivespoint && result.pole ? 1 : 0;
  const fastestLapBonus = rules?.fastestlapgivespoint && result.fastestlap ? 1 : 0;

  return basePoints + poleBonus + fastestLapBonus;
}

// ============================================================================
// EVOLUTION CALCULATION ENGINE
// ============================================================================

/**
 * Generic function to calculate standings evolution for drivers or constructors
 * 
 * This function:
 * 1. Groups results by track (combining Sprint + Race for same weekend)
 * 2. Calculates cumulative points after each completed track
 * 3. Determines standings/rankings after each track
 * 4. Compares current standings with previous track to calculate evolution
 * 
 * @param entities - Array of drivers or teams
 * @param allResults - All race results from database
 * @param schedules - Race schedule data
 * @param selectedTracks - Selected tracks for the season
 * @param rules - Points rules (pole, fastest lap bonuses)
 * @param isTeam - true for constructor standings, false for driver standings
 * @returns Map of entity IDs to their evolution data
 */
function calculateStandingsEvolution(
  entities: any[],
  allResults: any[],
  schedules: any[],
  selectedTracks: any[],
  rules: any,
  isTeam: boolean = false
): Map<string, EvolutionData> {

  // Return empty evolution if insufficient data
  if (!allResults || !schedules || !selectedTracks || !entities || entities.length === 0) {
    return new Map();
  }

  // ========================================
  // STEP 1: Organize tracks chronologically
  // ========================================

  const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));
  const sortedSchedules = [...schedules].sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // ========================================
  // STEP 2: Group results by track weekend
  // (Combine Sprint + Race for same track)
  // ========================================

  const trackRoundsMap = new Map<string, TrackRound>();

  for (const schedule of sortedSchedules) {
    const selectedTrack = selectedTrackMap.get(schedule.track);
    if (!selectedTrack?.id) continue;

    // Find all results for this selected track
    const trackResults = allResults.filter((r: any) => r.track === selectedTrack.id);
    if (trackResults.length === 0) continue;

    // Use the actual track ID as key to group Sprint + Race
    const trackKey = selectedTrack.track?.id || selectedTrack.id;

    if (!trackRoundsMap.has(trackKey)) {
      trackRoundsMap.set(trackKey, {
        trackId: trackKey,
        trackName: selectedTrack.track?.name || 'Unknown',
        date: schedule.date,
        results: []
      });
    }

    // Add results to this track round
    trackRoundsMap.get(trackKey)!.results.push(...trackResults);
  }

  // Convert to array and sort by date
  const completedRounds = Array.from(trackRoundsMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Need at least 2 completed rounds to show evolution
  if (completedRounds.length < 2) {
    return new Map();
  }

  // ========================================
  // STEP 3: Calculate standings after each track
  // ========================================

  const standingsHistory: StandingEntry[][] = [];

  for (let roundIndex = 0; roundIndex < completedRounds.length; roundIndex++) {
    // Initialize points accumulator
    const pointsMap = new Map<string, number>();
    entities.forEach((entity: any) => {
      pointsMap.set(entity.id, 0);
    });

    // Accumulate points from all rounds up to current round
    for (let i = 0; i <= roundIndex; i++) {
      const round = completedRounds[i];

      for (const result of round.results) {
        // Calculate points for this result
        const selectedTrack = Array.from(selectedTrackMap.values())
          .find((st: any) => st.id === result.track);
        const eventType = selectedTrack?.type || 'Race';
        const points = calculateResultPoints(result, rules, eventType);

        if (isTeam) {
          // For constructors: find which team this driver belongs to
          const driver = entities.find((team: any) =>
            team.drivers?.some((d: any) => d.id === result.driver)
          );
          if (driver) {
            const currentPoints = pointsMap.get(driver.id) || 0;
            pointsMap.set(driver.id, currentPoints + points);
          }
        } else {
          // For drivers: add points directly
          const currentPoints = pointsMap.get(result.driver) || 0;
          pointsMap.set(result.driver, currentPoints + points);
        }
      }
    }

    // Create standings for this round (sorted by points, then by name for ties)
    const roundStandings: StandingEntry[] = entities
      .map((entity: any) => ({
        id: entity.id,
        name: entity.name,
        points: pointsMap.get(entity.id) || 0,
        position: 0 // Will be set after sorting
      }))
      .sort((a, b) => {
        // Primary sort: by points (descending)
        if (b.points !== a.points) return b.points - a.points;
        // Tiebreaker: alphabetically by name
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({
        ...entry,
        position: index + 1
      }));

    standingsHistory.push(roundStandings);
  }

  // ========================================
  // STEP 4: Calculate evolution (position change)
  // ========================================

  const currentStandings = standingsHistory[standingsHistory.length - 1];
  const previousStandings = standingsHistory[standingsHistory.length - 2];

  const evolutionMap = new Map<string, EvolutionData>();

  for (const current of currentStandings) {
    const previous = previousStandings.find(p => p.id === current.id);

    if (!previous) {
      // New entry (wasn't in previous standings)
      evolutionMap.set(current.id, {
        value: "NEW",
        color: "text-blue-600",
        icon: null
      });
      continue;
    }

    // Calculate position change
    const positionChange = previous.position - current.position;

    if (positionChange > 0) {
      // Moved up in standings
      evolutionMap.set(current.id, {
        value: `+${positionChange}`,
        color: "text-green-600",
        icon: <ArrowUp className="inline w-4 h-4" />
      });
    } else if (positionChange < 0) {
      // Moved down in standings
      evolutionMap.set(current.id, {
        value: `${positionChange}`,
        color: "text-red-600",
        icon: <ArrowDown className="inline w-4 h-4" />
      });
    } else {
      // No position change
      evolutionMap.set(current.id, {
        value: "—",
        color: "text-gray-400",
        icon: null
      });
    }
  }

  return evolutionMap;
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ seasonId?: string }>;
}) {
  noStore();

  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  let seasonId =
    resolvedSearchParams?.seasonId ||
    cookieStore.get(PUBLIC_SEASON_COOKIE_NAME)?.value ||
    "";

  let latestSeasonRow: { id: string; season_number: number; is_finalized: boolean } | null = null;
  if (!seasonId) {
    const { data } = await supabase
      .from("seasons")
      .select("id, season_number, is_finalized")
      .order("season_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestSeasonRow = data ?? null;
    seasonId = latestSeasonRow?.id || "";
  }
  // ========================================
  // Fetch all required data from database
  // ========================================

  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*, teams(name, logo, carImage)');

  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('*');

  const { data: results } = await (seasonId
    ? supabase.from("results").select("*").eq("season_id", seasonId)
    : supabase.from("results").select("*"));

  const { data: schedules } = await (seasonId
    ? supabase.from("schedules").select("*").eq("season_id", seasonId)
    : supabase.from("schedules").select("*"));

  const { data: selectedTracks } = await (seasonId
    ? supabase.from("selected_tracks").select("*, track(*)").eq("season_id", seasonId)
    : supabase.from("selected_tracks").select("*, track(*)"));

  const { data: seasonEntries } = await (seasonId
    ? supabase
        .from("season_driver_entries")
        .select("driver_id, team_id")
        .eq("season_id", seasonId)
    : Promise.resolve({ data: [] as any[] }));

  const { data: rules } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();

  const { data: seasonRow } = latestSeasonRow
    ? { data: latestSeasonRow }
    : await supabase
        .from("seasons")
        .select("id, season_number, is_finalized")
        .eq("id", seasonId)
        .maybeSingle();

  // Handle errors
  if (driversError || teamsError) {
    return <div className="p-8 text-center text-red-600">Error loading data</div>;
  }

  // If `schedules` is empty, synthesize it from `selected_tracks` so we can:
  // 1) derive the latest completed event
  // 2) calculate evolution for the Evo column
  const effectiveSchedules =
    (schedules || []).length > 0
      ? schedules
      : (selectedTracks || []).map((st: any, idx: number) => ({
          track: st.id, // `calculateStandingsEvolution` expects `schedule.track` to be a selected_track.id
          date: `1970-01-${String(idx + 1).padStart(2, "0")}`,
        }));

  const seasonTeamByDriverId = new Map<string, string | null>(
    ((seasonEntries as any[]) || []).map((e: any) => [String(e.driver_id), e.team_id || null])
  );

  const selectedTrackMap = new Map((selectedTracks || []).map((st: any) => [String(st.id), st]));
  const teamById = new Map((teamsData || []).map((t: any) => [String(t.id), t]));
  const driverPointsMap = new Map<string, number>();
  const constructorPointsMap = new Map<string, number>();

  for (const r of results || []) {
    const driverId = String(r.driver || "");
    if (!driverId) continue;
    const st = selectedTrackMap.get(String(r.track));
    const eventType = st?.type || "Race";
    const points = calculateResultPoints(r, rules, eventType);
    driverPointsMap.set(driverId, (driverPointsMap.get(driverId) || 0) + points);

    const resolvedTeamId =
      (seasonId ? seasonTeamByDriverId.get(driverId) : null) ||
      r.team_id ||
      (drivers || []).find((d: any) => String(d.id) === driverId)?.team ||
      null;
    if (resolvedTeamId) {
      const key = String(resolvedTeamId);
      constructorPointsMap.set(key, (constructorPointsMap.get(key) || 0) + points);
    }
  }

  const participatingDriverIds = new Set((results || []).map((r: any) => String(r.driver)));
  const participatingDrivers = (drivers || [])
    .map((d: any) => {
      const resolvedTeamId = seasonId
        ? (seasonTeamByDriverId.get(String(d.id)) ?? null)
        : (d.team || null);
      const resolvedTeam = resolvedTeamId ? teamById.get(String(resolvedTeamId)) : null;
      return {
        ...d,
        team: resolvedTeamId,
        teams: resolvedTeam
          ? {
              name: resolvedTeam.name,
              logo: resolvedTeam.logo,
              carImage: resolvedTeam.carImage,
            }
          : d.teams,
        points: driverPointsMap.get(String(d.id)) || 0,
      };
    })
    .filter((d: any) => participatingDriverIds.has(String(d.id)) && !!d.team);

  // ========================================
  // Prepare teams data with driver relationships
  // ========================================

  const teams = (teamsData || [])
    .map((team: any) => {
      const teamDrivers = participatingDrivers.filter((driver: any) => driver.team === team.id);
      const constructorPoints = constructorPointsMap.get(String(team.id)) || 0;
      return {
        ...team,
        constructorPoints,
        drivers: teamDrivers
      };
    })
    // Only keep teams that actually have at least one driver
    .filter((team: any) => (team.drivers || []).length > 0);

  // ========================================
  // Calculate evolution for drivers
  // ========================================

  const driverEvolution = calculateStandingsEvolution(
    participatingDrivers || [],
    results || [],
    effectiveSchedules || [],
    selectedTracks || [],
    rules,
    false // isTeam = false
  );

  // ========================================
  // Calculate evolution for constructors
  // ========================================

  const teamEvolution = calculateStandingsEvolution(
    teams,
    results || [],
    effectiveSchedules || [],
    selectedTracks || [],
    rules,
    true // isTeam = true
  );

  // ========================================
  // Sort current standings by points
  // ========================================

  const sortedDrivers = [...(participatingDrivers || [])].sort((a, b) => {
    // Primary sort: by points (descending)
    if ((b.points || 0) !== (a.points || 0)) {
      return (b.points || 0) - (a.points || 0);
    }
    // Tiebreaker: alphabetically
    return a.name.localeCompare(b.name);
  });

  const sortedTeams = [...teams].sort((a, b) => {
    // Primary sort: by constructor points (descending)
    if ((b.constructorPoints || 0) !== (a.constructorPoints || 0)) {
      return (b.constructorPoints || 0) - (a.constructorPoints || 0);
    }
    // Tiebreaker: alphabetically
    return a.name.localeCompare(b.name);
  });

  const isSeasonFinalized = !!seasonRow?.is_finalized;
  const driverChampion = sortedDrivers[0] || null;
  const constructorChampion = sortedTeams[0] || null;
  const constructorChampionDrivers = constructorChampion
    ? [...participatingDrivers]
        .filter((d: any) => d.team === constructorChampion.id)
        .sort((a: any, b: any) => (b.points || 0) - (a.points || 0))
        .slice(0, 2)
    : [];
  const driverChampionTeamNameRaw = driverChampion?.teams?.name || "";
  const driverChampionTeamName =
    driverChampionTeamNameRaw === "Stake F1 Team" ? "Sauber" : driverChampionTeamNameRaw;
  const driverChampionColors = getTeamColorVariations(driverChampionTeamName);
  const constructorChampionNameRaw = constructorChampion?.name || "";
  const constructorChampionName =
    constructorChampionNameRaw === "Stake F1 Team" ? "Sauber" : constructorChampionNameRaw;
  const constructorChampionColors = getTeamColorVariations(constructorChampionName);

  // ========================================
  // Last race podium (top 3 finishers)
  // ========================================
  const selectedTrackById = new Map((selectedTracks || []).map((st: any) => [st.id, st]));
  const selectedTrackByPhysicalId = new Map<string, any>();
  (selectedTracks || []).forEach((st: any) => {
    const physicalId = st?.track?.id;
    if (physicalId) selectedTrackByPhysicalId.set(String(physicalId), st);
  });

  const driverById = new Map((participatingDrivers || []).map((d: any) => [d.id, d]));

  const nowMs = Date.now();
  const schedulesDesc = [...(effectiveSchedules || [])].sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let lastRaceWeekend: any | null = null;
  let lastRaceResults: any[] = [];

  const findWeekendWithResults = (preferredType: "Race" | "Any") => {
  for (const sch of schedulesDesc) {
      const schMs = new Date(sch.date).getTime();
      if (!Number.isFinite(schMs)) continue;
      if (schMs > nowMs) continue; // only consider events that have already started

      const selectedTrack =
        selectedTrackById.get(sch.track) || selectedTrackByPhysicalId.get(String(sch.track));
      if (!selectedTrack?.id) continue;

      const physicalTrackId = selectedTrack?.track?.id;

      // `results.track` might match any of these ids depending on how it was stored.
      const candidateTrackIds = Array.from(
        new Set(
          [String(sch.track), String(selectedTrack.id), physicalTrackId ? String(physicalTrackId) : ""].filter(Boolean)
        )
      );

      const trackResults = (results || []).filter((r: any) => {
        const rTrack = r.track == null ? "" : String(r.track);
        const posRaw = r.finishing_position ?? r.position;
        const hasPosition = posRaw !== null && posRaw !== undefined;
        return candidateTrackIds.includes(rTrack) && hasPosition;
      });

      if (trackResults.length === 0) continue;

      const eventType = selectedTrack.type || selectedTrack?.track?.type || "Race";
      if (preferredType === "Race" && eventType !== "Race") continue;

      lastRaceWeekend = selectedTrack;
      lastRaceResults = trackResults;
      return true;
    }
    return false;
  };

  // First try: latest completed Race.
  findWeekendWithResults("Race");
  // Fallback: latest completed event of any type (only if no Race exists yet).
  if (!lastRaceWeekend) findWeekendWithResults("Any");

  const podium = (() => {
    if (!lastRaceWeekend) return [];

    const finished = (lastRaceResults || [])
      .map((r: any) => {
        const posRaw = r.finishing_position ?? r.position;
        const posNum = Number(posRaw);
        return {
          driverId: r.driver,
          teamId:
            (seasonId ? seasonTeamByDriverId.get(String(r.driver)) : null) ||
            r.team_id ||
            null,
          position: Number.isFinite(posNum) ? posNum : Infinity,
        };
      })
      .filter((x: any) => Number.isFinite(x.position) && x.position !== Infinity && x.position >= 1)
      .sort((a: any, b: any) => a.position - b.position);

    const top3: any[] = [];
    const seen = new Set<string>();
    for (const row of finished) {
      if (!row.driverId) continue;
      const key = String(row.driverId);
      if (seen.has(key)) continue;
      seen.add(key);
      top3.push(row);
      if (top3.length >= 3) break;
    }

    return top3.map((row: any) => {
      const driver = driverById.get(row.driverId);
      const resolvedTeam = row.teamId ? teamById.get(String(row.teamId)) : null;
      const teamNameRaw = resolvedTeam?.name || driver?.teams?.name || "";
      const normalizedTeamName = teamNameRaw === "Stake F1 Team" ? "Sauber" : teamNameRaw;
      const teamColors = getTeamColorVariations(normalizedTeamName);
      const teamLogoUrl = extractImageUrl(resolvedTeam?.logo || driver?.teams?.logo || "");

      // "DIL" / "BUD" style badge: first 3 letters of the driver's name.
      const rawName = driver?.name || "";
      const cleaned = String(rawName).replace(/[^A-Za-z]/g, "");
      const driverCode = cleaned.toUpperCase().slice(0, 3);

      return {
        driverName: driver?.name || String(row.driverId),
        driverImageUrl: getImageSrc(driver?.image ?? driver?.carImage ?? ""),
        // Optional celebration clip from drivers table (supports either field naming).
        driverVideoUrl: getMediaSrc(
          (driver as any)?.celebration_video ??
            (driver as any)?.celebrationVideo ??
            (driver as any)?.video ??
            ""
        ),
        teamName: teamNameRaw,
        teamLogoUrl,
        driverCode,
        teamColorPrimary: teamColors.wins,
        teamColorSecondary: teamColors.podiums,
      };
    });
  })();

  const lastRaceTrackName = lastRaceWeekend?.track?.name || lastRaceWeekend?.track?.trackName || "";

  // ========================================
  // Next race + countdown target
  // ========================================
  const upcomingSchedules =
    (schedules || []).length > 0
      ? schedules
      : (selectedTracks || []).map((st: any, idx: number) => ({
          // Use selected_track id as key (same structure expected by our schedule lookups).
          track: st.id,
          date: new Date(nowMs + (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        }));

  const nextRace = (() => {
    const sorted = [...(upcomingSchedules || [])].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const sch of sorted) {
      const schMs = new Date(sch.date).getTime();
      if (!Number.isFinite(schMs) || schMs <= nowMs) continue;

      const st =
        selectedTrackById.get(sch.track) ||
        selectedTrackByPhysicalId.get(String(sch.track));
      if (!st?.id) continue;

      return {
        targetMs: schMs,
        trackName: st.track?.name || st.track?.trackName || "",
        flagHtml: st.track?.img || null,
        background: st.track?.background || null,
      };
    }

    // If nothing is found, don't crash: return null timer.
    return null;
  })();

  // ========================================
  // Render the standings tables
  // ========================================

  const rawBg = !isSeasonFinalized ? (nextRace?.background || null) : null;
  // background may be stored as an HTML string (like img/logo fields) — extract the src URL
  const nextBg = rawBg ? (extractImageUrl(rawBg) || rawBg) : null;
  if (rawBg) console.log('[Hero] raw background value:', rawBg, '→ resolved:', nextBg);

  return (
    <div>
      {/* ── Hero banner (next race background) ── */}
      {/* Negative margins cancel the layout's pt + px so the image bleeds edge-to-edge */}
      {nextBg ? (
        <div className="relative overflow-hidden -mt-2 sm:-mt-4 -mx-2 sm:-mx-4 lg:-mx-6 h-[260px] sm:h-[340px] md:h-[420px]">
          <img
            src={nextBg}
            alt="Next race background"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Bottom fade into page bg */}
          <div
            className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--background) 60%, transparent) 60%, var(--background) 100%)",
            }}
          />
          {/* NextRaceTimer pill – bottom-right of the hero */}
          {!isSeasonFinalized ? (
            <div className="absolute bottom-5 right-4 sm:right-6 md:right-8">
              <NextRaceTimer
                targetMs={nextRace?.targetMs ?? null}
                trackName={nextRace?.trackName}
                flagHtml={nextRace?.flagHtml}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="p-3 sm:p-4 md:p-8">
      {isSeasonFinalized ? <SeasonConfetti /> : null}
      {isSeasonFinalized && driverChampion && constructorChampion ? (
        <section className="mb-4 sm:mb-6">
          <h2 className="text-2xl font-semibold mb-4">Season Champions</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div
              className="rounded-2xl border border-white/15 bg-card/20 p-4 relative overflow-hidden w-full f1-card-glow"
              style={{
                ["--f1-card-glow-color" as string]: toAlphaHsl(
                  driverChampionColors.podiums,
                  0.55
                ),
              }}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Drivers Champion</div>
              <div className="flex items-center gap-3">
                {driverChampion?.image ? (
                  <img
                    src={getImageSrc(driverChampion.image)}
                    alt={`${driverChampion.name} image`}
                    className="w-28 h-28 object-contain"
                  />
                ) : null}
                <div>
                  <div className="text-xl font-bold">{driverChampion.name}</div>
                  <div className="text-sm text-muted-foreground">{driverChampion.points || 0} pts</div>
                </div>
                {driverChampion?.teams?.carImage ? (
                  <img
                    src={getImageSrc(driverChampion.teams.carImage)}
                    alt={`${driverChampion.name} car`}
                    className="w-44 h-24 object-contain opacity-80"
                    style={{
                      WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0) 100%)",
                      maskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0) 100%)",
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div
              className="rounded-2xl border border-white/15 bg-card/20 p-4 relative overflow-hidden w-full f1-card-glow"
              style={{
                ["--f1-card-glow-color" as string]: toAlphaHsl(
                  constructorChampionColors.podiums,
                  0.55
                ),
              }}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Constructors Champion</div>
              <div className="flex items-center gap-3 mb-3 relative z-[1]">
                {constructorChampion?.logo ? (
                  <img
                    src={extractImageUrl(constructorChampion.logo)}
                    alt={`${constructorChampion.name} logo`}
                    className="w-16 h-16 object-contain"
                  />
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="leading-tight">
                    <div className="text-xl font-bold">{constructorChampion.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {constructorChampion.constructorPoints || 0} pts
                    </div>
                  </div>
                  <div className="flex items-center -space-x-2">
                    {constructorChampionDrivers.map((d: any) => (
                      <img
                        key={`champ-driver-inline-${d.id}`}
                        src={getImageSrc(d.image)}
                        alt={`${d.name} image`}
                        className="w-28 h-28 object-contain bg-black/10 dark:bg-transparent"
                        style={{
                          WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                          maskImage:
                            "linear-gradient(to bottom, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                        }}
                        title={d.name}
                      />
                    ))}
                  </div>
                  {constructorChampion?.carImage ? (
                    <img
                      src={getImageSrc(constructorChampion.carImage)}
                      alt={`${constructorChampion.name} car`}
                      className="w-44 h-24 object-contain opacity-80"
                      style={{
                        WebkitMaskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0) 100%)",
                        maskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,0.9) 50%, rgba(0,0,0,0) 100%)",
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {!isSeasonFinalized && !nextBg ? (
        <div className="flex justify-end mb-4">
          <NextRaceTimer
            targetMs={nextRace?.targetMs ?? null}
            trackName={nextRace?.trackName}
            flagHtml={nextRace?.flagHtml}
          />
        </div>
      ) : null}
      <div className="space-y-4 sm:space-y-6">
          {/* ==================== LAST RACE PODIUM ==================== */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-semibold">Last Race</h3>
                  {lastRaceWeekend?.track?.img ? (
                    <span
                      className="inline-flex items-center justify-center w-8 h-5 [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full [&>img]:object-contain"
                      dangerouslySetInnerHTML={{ __html: lastRaceWeekend.track.img }}
                    />
                  ) : null}
                </div>
                {lastRaceTrackName ? (
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {lastRaceTrackName}
                  </h4>
                ) : null}
              </div>
            </div>
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                {[0, 1, 2].map((i) => {
                      const entry = podium[i];
                      const rank = i + 1;
                      const desktopOrderClass =
                        rank === 1 ? "sm:order-2" : rank === 2 ? "sm:order-1" : "sm:order-3";
                      const cardHeightClass =
                        rank === 1
                          ? "min-h-[260px] sm:min-h-[400px]"
                          : rank === 2
                            ? "min-h-[240px] sm:min-h-[330px]"
                            : "min-h-[230px] sm:min-h-[300px]";
                      const contentHeightClass =
                        rank === 1
                          ? "min-h-[260px] sm:min-h-[400px]"
                          : rank === 2
                            ? "min-h-[240px] sm:min-h-[330px]"
                            : "min-h-[230px] sm:min-h-[300px]";
                      const gapValue =
                        rank === 1 ? "1.23.076" : rank === 2 ? "+2.345" : "+5.845";
                      const rankNumber = rank === 1 ? "1" : rank === 2 ? "2" : "3";
                      const rankSuffix = rank === 1 ? "st" : rank === 2 ? "nd" : "rd";
                      const rankColor =
                        rank === 1 ? "#FFD700" : rank === 2 ? "#d8dde3" : "#cd7f32";
                      const driverImageClass =
                        rank === 1
                          ? "absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-[22rem] sm:h-[22rem] object-contain bg-black/10 dark:bg-transparent"
                          : rank === 2
                            ? "absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 w-[17rem] h-[17rem] sm:w-[20rem] sm:h-[20rem] object-contain bg-black/10 dark:bg-transparent"
                            : "absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 w-[16rem] h-[16rem] sm:w-[18rem] sm:h-[18rem] object-contain bg-black/10 dark:bg-transparent";
                      const tileBorder = entry?.teamColorPrimary || "hsl(0, 0%, 50%)";
                      const mediaMask =
                        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 92%)";
                      const mediaFilter =
                        rank === 1
                          ? "drop-shadow(0 16px 26px rgba(0,0,0,0.65)) saturate(1.08) contrast(1.05)"
                          : "drop-shadow(0 12px 20px rgba(0,0,0,0.58)) saturate(1.04) contrast(1.03)";
                      const tileOverlay = entry?.teamColorSecondary
                        ? toAlphaHsl(entry.teamColorSecondary, rank === 1 ? 0.22 : 0.16)
                        : "rgba(255,255,255,0.08)";
                      return (
                        <div
                          key={`podium-${rank}`}
                          className={`relative self-end rounded-2xl border border-white/15 bg-card/10 overflow-hidden flex flex-col justify-center ${desktopOrderClass} ${cardHeightClass}`}
                          style={{ borderColor: tileBorder }}
                        >
                          <div className={`relative ${contentHeightClass} pt-4 pb-7`}>
                            {entry ? (
                              <>
                                {/* Soft inner shade for better media blending */}
                                <div
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0"
                                  style={{
                                    backgroundImage: `radial-gradient(circle at 20% 14%, ${tileOverlay} 0%, rgba(0,0,0,0) 62%), linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 38%, rgba(0,0,0,0.16) 100%)`,
                                  }}
                                />
                                {/* Driver photo */}
                                {entry.driverImageUrl ? (
                                  <img
                                    src={entry.driverImageUrl}
                                    alt={`${entry.driverName} photo`}
                                    className={driverImageClass}
                                    style={{
                                      // Keep shoulders crisp but fade the lower body so it blends into the tile.
                                      WebkitMaskImage: mediaMask,
                                      maskImage: mediaMask,
                                      filter: mediaFilter,
                                    }}
                                  />
                                ) : (
                                  <div className="absolute -left-6 bottom-0 w-24 h-24 bg-muted/40" />
                                )}
                                {/* Subtle edge vignette for a more cinematic tile */}
                                <div
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0"
                                  style={{
                                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03), inset 0 -70px 80px rgba(0,0,0,0.42)",
                                  }}
                                />

                                {/* Position badge in card top-right */}
                                <div
                                  className="absolute right-5 top-3 sm:right-6 sm:top-5 text-3xl sm:text-4xl md:text-5xl leading-none"
                                  style={{
                                    color: rankColor,
                                    fontFamily: "'Racing Sans One', 'Impact', 'Arial Black', sans-serif",
                                    fontStyle: "italic",
                                    fontWeight: 900,
                                    letterSpacing: "-0.055em",
                                    transform: "skewX(-10deg)",
                                    WebkitTextStroke: "2.8px rgba(0,0,0,0.98)",
                                    textShadow:
                                      "0 1px 0 rgba(255,255,255,0.35), 3px 3px 0 rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.55)",
                                  }}
                                >
                                  <span className="inline-flex items-start gap-2 leading-none">
                                    <span className="font-black">{rankNumber}</span>
                                    <sup
                                      className="text-[0.5em] font-black leading-none relative top-[0.1em]"
                                      style={{
                                        WebkitTextStroke: "1.35px rgba(0,0,0,0.98)",
                                        textShadow:
                                          "0 1px 0 rgba(255,255,255,0.25), 1px 1px 0 rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.35)",
                                      }}
                                    >
                                      {rankSuffix}
                                    </sup>
                                  </span>
                                </div>

                                {/* Team name + logo in card top-left (no pill background) */}
                                <div className="absolute left-6 top-4 sm:top-5 flex items-center gap-2 text-white text-sm sm:text-base md:text-lg font-semibold tracking-wide">
                                  {entry.teamLogoUrl ? (
                                    <img
                                      src={entry.teamLogoUrl}
                                      alt={`${entry.teamName} logo`}
                                      className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 object-contain"
                                    />
                                  ) : null}
                                  <span>{entry.teamName}</span>
                                </div>

                                {/* Driver abbreviation bottom-right, aligned with P badge x-axis */}
                                <div className="absolute right-6 bottom-5 text-right text-white">
                                  <div className="text-lg sm:text-xl font-extrabold uppercase tracking-wide leading-none">
                                    {entry.driverCode || "—"}
                                  </div>
                                  <div className="mt-1 text-sm sm:text-base font-mono font-semibold tabular-nums text-white/75 tracking-normal leading-none">
                                    {gapValue}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>

            {/* Intentionally no footer copy under the podium tiles. */}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          {/* ==================== DRIVER STANDINGS ==================== */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Driver Standings</h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 grid grid-cols-[56px_1fr_96px_96px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20">
              <div>POS</div>
              <div>DRIVER</div>
              <div className="text-right">POINTS</div>
              <div className="text-right">EVO.</div>
            </div>

            <div className="p-2 space-y-2">
              {sortedDrivers.map((driver: any, idx: number) => {
                const evolution = driverEvolution.get(driver.id) || {
                  value: "—",
                  color: "text-gray-400",
                  icon: null,
                };

                const teamNameRaw = driver.teams?.name || "";
                const normalizedTeamName =
                  teamNameRaw === "Stake F1 Team" ? "Sauber" : teamNameRaw;
                const teamColors = getTeamColorVariations(normalizedTeamName);

                const logoSrc = extractImageUrl(driver.teams?.logo || "");

                return (
                  <div
                    key={driver.id}
                    className="px-4 py-3 rounded-xl border border-white/15 bg-card/20 flex items-center gap-4 transition f1-card-glow"
                    style={{
                      ["--f1-card-glow-color" as string]: toAlphaHsl(teamColors.podiums, 0.5),
                    }}
                  >
                    <div className="w-14 text-sm font-semibold text-foreground text-center">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-9 h-9 flex-shrink-0 overflow-hidden">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={`${teamNameRaw} logo`}
                            style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }}
                            className="rounded-lg p-1"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-muted/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {driver.name}
                        </div>
                        {teamNameRaw ? (
                          <div className="text-xs text-muted-foreground/70 truncate">
                            {teamNameRaw}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="w-28 text-right text-sm font-bold text-foreground">
                      {driver.points || 0}
                    </div>

                    <div className={`w-28 text-right flex items-center justify-end gap-1 text-sm font-medium ${evolution.color}`}>
                      {evolution.icon}
                      {evolution.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Link to full standings */}
            <div className="flex justify-center p-4">
              <Link href="/public-dash/driver-standings">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-1">
                  Full Standings
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ==================== CONSTRUCTOR STANDINGS ==================== */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Constructor Standings</h2>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 grid grid-cols-[56px_1fr_96px_96px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20">
              <div>POS</div>
              <div>CONSTRUCTOR</div>
              <div className="text-right">POINTS</div>
              <div className="text-right">EVO.</div>
            </div>

            <div className="p-2 space-y-2">
              {sortedTeams.map((team: any, idx: number) => {
                const evolution = teamEvolution.get(team.id) || {
                  value: "—",
                  color: "text-gray-400",
                  icon: null,
                };

                const normalizedTeamName =
                  team.name === "Stake F1 Team" ? "Sauber" : team.name;
                const teamColors = getTeamColorVariations(normalizedTeamName);

                const logoSrc = extractImageUrl(team.logo || "");

                return (
                  <div
                    key={team.id}
                    className="px-4 py-3 rounded-xl border border-white/15 bg-card/20 flex items-center gap-4 transition f1-card-glow"
                    style={{
                      ["--f1-card-glow-color" as string]: toAlphaHsl(teamColors.podiums, 0.5),
                    }}
                  >
                    <div className="w-14 text-sm font-semibold text-foreground text-center">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-9 h-9 flex-shrink-0 overflow-hidden">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={`${team.name} logo`}
                            style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }}
                            className="rounded-lg p-1"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-muted/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {team.name}
                        </div>
                      </div>
                    </div>

                    <div className="w-28 text-right text-sm font-bold text-foreground">
                      {team.constructorPoints || 0}
                    </div>

                    <div className={`w-28 text-right flex items-center justify-end gap-1 text-sm font-medium ${evolution.color}`}>
                      {evolution.icon}
                      {evolution.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Link to full standings */}
            <div className="flex justify-center p-4">
              <Link href="/public-dash/constructor-standings">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-1">
                  Full Standings
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </Link>
            </div>
          </div>
        </section>
        </div>{/* end grid xl:grid-cols-2 */}
      </div>{/* end space-y-4 */}

      </div>{/* end p-3 */}
    </div>
  );
}