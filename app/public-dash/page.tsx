import Link from "next/link";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUp, ArrowDown } from "lucide-react";
import { JSX } from "react";

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

export default async function HomePage() {
  // ========================================
  // Fetch all required data from database
  // ========================================

  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*, teams(name, logo)');

  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('*');

  const { data: results } = await supabase
    .from('results')
    .select('*');

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*');

  const { data: selectedTracks } = await supabase
    .from('selected_tracks')
    .select('*, track(*)');

  const { data: rules } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();

  // Handle errors
  if (driversError || teamsError) {
    return <div className="p-8 text-center text-red-600">Error loading data</div>;
  }

  // ========================================
  // Prepare teams data with driver relationships
  // ========================================

  const teams = (teamsData || []).map((team: any) => {
    const teamDrivers = (drivers || []).filter((driver: any) => driver.team === team.id);
    const constructorPoints = teamDrivers.reduce(
      (sum: number, driver: any) => sum + (driver.points || 0),
      0
    );
    return {
      ...team,
      constructorPoints,
      drivers: teamDrivers
    };
  });

  // ========================================
  // Calculate evolution for drivers
  // ========================================

  const driverEvolution = calculateStandingsEvolution(
    drivers || [],
    results || [],
    schedules || [],
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
    schedules || [],
    selectedTracks || [],
    rules,
    true // isTeam = true
  );

  // ========================================
  // Sort current standings by points
  // ========================================

  const sortedDrivers = [...(drivers || [])].sort((a, b) => {
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

  // ========================================
  // Render the standings tables
  // ========================================

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ==================== DRIVER STANDINGS ==================== */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Driver Standings</h2>
          <div className="bg-card rounded-2xl shadow border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-muted-foreground">POS.</TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-muted-foreground">DRIVER</TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-muted-foreground">POINTS</TableHead>
                  <TableHead className="py-3 px-4 text-xs font-semibold text-muted-foreground">EVO.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDrivers.map((driver: any, idx: number) => {
                  // Get evolution data for this driver
                  const evolution = driverEvolution.get(driver.id) || {
                    value: "—",
                    color: "text-gray-400",
                    icon: null
                  };

                  return (
                    <TableRow
                      key={driver.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition"
                    >
                      {/* Position */}
                      <TableCell className="py-3 px-4 font-semibold text-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Driver name with team logo */}
                      <TableCell className="py-3 px-4 flex items-center gap-3">
                        {(() => {
                          const isRB = driver.teams?.name === 'RB';
                          const isStakeF1 = driver.teams?.name === 'Stake F1 Team';
                          const logoSize = (isRB || isStakeF1) ? 'w-9 h-9' : 'w-7 h-7';
                          const fallbackSize = (isRB || isStakeF1) ? 'w-9 h-9' : 'w-7 h-7';

                          return extractImageUrl(driver.teams?.logo || '') ? (
                            <img
                              src={extractImageUrl(driver.teams.logo)}
                              alt={`${driver.teams?.name || 'Team'} logo`}
                              className={`${logoSize} object-contain flex-shrink-0 bg-black/10 dark:bg-transparent rounded-lg p-1`}
                            />
                          ) : (
                            <span className={`inline-block ${fallbackSize} bg-muted rounded-full flex-shrink-0`} />
                          );
                        })()}
                        <span className="font-medium text-foreground">{driver.name}</span>
                      </TableCell>

                      {/* Points */}
                      <TableCell className="py-3 px-4 font-bold text-foreground">
                        {driver.points || 0}
                      </TableCell>

                      {/* Evolution */}
                      <TableCell className={`py-3 px-4 font-medium flex items-center gap-1 ${evolution.color}`}>
                        {evolution.icon}
                        {evolution.value}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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
          <div className="bg-card rounded-2xl shadow border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-muted-foreground">POS.</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-muted-foreground">CONSTRUCTOR</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-muted-foreground">POINTS</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-muted-foreground">EVO.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeams.map((team: any, idx: number) => {
                  // Get evolution data for this team
                  const evolution = teamEvolution.get(team.id) || {
                    value: "—",
                    color: "text-gray-400",
                    icon: null
                  };

                  return (
                    <TableRow
                      key={team.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition"
                    >
                      {/* Position */}
                      <TableCell className="py-4 px-6 font-semibold text-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Team name with logo */}
                      <TableCell className="py-4 px-6 flex items-center gap-3">
                        {(() => {
                          const isRB = team.name === 'RB';
                          const isStakeF1 = team.name === 'Stake F1 Team';
                          const logoSize = (isRB || isStakeF1) ? 'w-9 h-9' : 'w-7 h-7';
                          const fallbackSize = (isRB || isStakeF1) ? 'w-9 h-9' : 'w-7 h-7';

                          return extractImageUrl(team.logo || '') ? (
                            <img
                              src={extractImageUrl(team.logo)}
                              alt={`${team.name} logo`}
                              className={`${logoSize} object-contain flex-shrink-0 bg-black/10 dark:bg-transparent rounded-lg p-1`}
                            />
                          ) : (
                            <span className={`inline-block ${fallbackSize} bg-muted rounded-full flex-shrink-0`} />
                          );
                        })()}
                        <span className="font-medium text-foreground">{team.name}</span>
                      </TableCell>

                      {/* Constructor Points */}
                      <TableCell className="py-4 px-6 font-bold text-foreground">
                        {team.constructorPoints || 0}
                      </TableCell>

                      {/* Evolution */}
                      <TableCell className={`py-4 px-6 font-medium flex items-center gap-1 ${evolution.color}`}>
                        {evolution.icon}
                        {evolution.value}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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

      </div>
    </div>
  );
}