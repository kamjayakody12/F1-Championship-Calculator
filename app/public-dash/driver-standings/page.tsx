"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { supabase } from "@/lib/db";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart } from "recharts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DriverRow {
  id: string;
  name: string;
  points: number;
  team: string;
  teamName: string;
  teamLogo: string;
}

interface RaceResult {
  track: string;
  trackName: string;
  date: string;
  position: number;
  driver: string;
  driverName: string;
  teamId: string;
  teamName: string;
  points: number;
  pole: boolean;
  fastestlap: boolean;
  racefinished: boolean;
}

interface DriverStatsData {
  driverId: string;
  driverName: string;
  teamName: string;
  teamLogo: string;
  wins: number;
  podiums: number;
  pointsFinishes: number;
  poles: number;
  dnfs: number;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const TEAM_COLOR_MAP: { [key: string]: string } = {
  'Red Bull': 'hsl(220, 100%, 30%)',
  'Mercedes': 'hsl(180, 100%, 50%)',
  'Mclaren': 'hsl(25, 100%, 50%)',
  'Ferrari': 'hsl(0, 100%, 50%)',
  'Sauber': 'hsl(120, 100%, 40%)',
  'Aston Martin': 'hsl(120, 100%, 25%)',
  'RB': 'hsl(230, 70%, 22%)',
  'Haas': 'hsl(0, 0%, 50%)',
  'Alpine': 'hsl(300, 100%, 35%)',
  'Williams': 'hsl(205, 90%, 50%)',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract image URL from HTML string
 */
function extractImageUrl(htmlString: string): string {
  if (!htmlString) return "";
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : "";
}


/**
 * Calculate points for a race result
 */
function calculateResultPoints(result: any, rules: any, eventType: string): number {
  if (!result.racefinished) return 0;

  const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

  const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
  const maxPositions = eventType === 'Sprint' ? 8 : 10;

  const position = result.finishing_position ?? result.position;
  const basePoints = position <= maxPositions ? pointsMapping[position - 1] : 0;

  const poleBonus = rules.polegivespoint && result.pole ? 1 : 0;
  const fastestLapBonus = rules.fastestlapgivespoint && result.fastestlap ? 1 : 0;

  return basePoints + poleBonus + fastestLapBonus;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DriverStandingsPage() {
  // State management
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<DriverStatsData[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDriver, setActiveDriver] = useState<string>("all");
  const [hoveredDistributionDriver, setHoveredDistributionDriver] = useState<string | null>(null);
  const [hoveredProgressionDriver, setHoveredProgressionDriver] = useState<string | null>(null);

  // Fetch and process data on mount
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Fetch all data and calculate standings, stats, and charts
   */
  const fetchData = async () => {
    try {
      const [
        { data: driversData },
        { data: teamsData },
        { data: results },
        { data: schedules },
        { data: tracksData },
        { data: selectedTracks },
        { data: rules }
      ] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('results').select('*'),
        supabase.from('schedules').select('*'),
        supabase.from('tracks').select('*'),
        supabase.from('selected_tracks').select('*, track(*)'),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single()
      ]);

      if (!driversData || !teamsData || !results || !schedules || !tracksData || !selectedTracks || !rules) {
        throw new Error('Failed to fetch data');
      }

      // Create lookup maps
      const teamMap = new Map(teamsData.map((t: any) => [t.id, t]));
      const driverMap = new Map(driversData.map((d: any) => [d.id, d]));
      const trackMap = new Map(tracksData.map((t: any) => [t.id, t.name]));
      const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));

      setTracks(tracksData);

      // Process race results
      const raceResults = processRaceResults(
        results,
        driverMap,
        teamMap,
        trackMap,
        selectedTrackMap,
        schedules,
        rules
      );

      // Calculate driver statistics
      const driverStats = calculateDriverStats(driversData, teamMap, raceResults);
      setStatsData(driverStats);

      // Calculate progression and distribution data
      const { progressionData, distributionData: distData, rankingEvolution } = calculateChartData(
        driversData,
        raceResults,
        schedules,
        selectedTrackMap,
        tracksData
      );

      setChartData(progressionData);
      setDistributionData(distData);
      setRankingData(rankingEvolution);

      // Set driver standings
      const enrichedDrivers = enrichDriverData(driversData, teamMap);
      setDrivers(enrichedDrivers);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  /**
   * Process raw race results into structured data
   */
  function processRaceResults(
    results: any[],
    driverMap: Map<string, any>,
    teamMap: Map<string, any>,
    trackMap: Map<string, string>,
    selectedTrackMap: Map<string, any>,
    schedules: any[],
    rules: any
  ): RaceResult[] {
    return results.map((result: any) => {
      const driver = driverMap.get(result.driver);
      const team = teamMap.get(driver?.team || '');
      const schedule = schedules.find((s: any) => {
        const st = selectedTrackMap.get(s.track);
        return st?.track?.id === result.track;
      });

      const selectedTrack = selectedTrackMap.get(schedule?.track || '');
      const eventType = selectedTrack?.type || 'Race';
      const points = calculateResultPoints(result, rules, eventType);

      return {
        track: result.track,
        trackName: trackMap.get(result.track) || 'Unknown',
        date: schedule?.date || '',
        position: result.finishing_position ?? result.position,
        driver: result.driver,
        driverName: driver?.name || 'Unknown',
        teamId: driver?.team || '',
        teamName: team?.name || 'Unknown',
        points,
        pole: result.pole || false,
        fastestlap: result.fastestlap || false,
        racefinished: result.racefinished !== false,
      };
    });
  }

  /**
   * Calculate driver statistics (wins, podiums, etc.)
   */
  function calculateDriverStats(
    driversData: any[],
    teamMap: Map<string, any>,
    raceResults: RaceResult[]
  ): DriverStatsData[] {
    const driverStats = new Map<string, DriverStatsData>();

    // Initialize stats for all drivers
    driversData.forEach((d: any) => {
      const team = teamMap.get(d.team);
      driverStats.set(d.id, {
        driverId: d.id,
        driverName: d.name,
        teamName: team?.name || 'Unknown',
        teamLogo: extractImageUrl(team?.logo || ''),
        wins: 0,
        podiums: 0,
        pointsFinishes: 0,
        poles: 0,
        dnfs: 0,
      });
    });

    // Count statistics from race results
    raceResults.forEach((res) => {
      const stats = driverStats.get(res.driver);
      if (!stats) return;

      if (res.pole) stats.poles++;

      if (!res.racefinished) {
        stats.dnfs++;
        return;
      }

      if (res.position >= 1 && res.position <= 10) stats.pointsFinishes++;
      if (res.position === 1) stats.wins++;
      if (res.position >= 1 && res.position <= 3) stats.podiums++;
    });

    return Array.from(driverStats.values())
      .filter((s) => s.wins + s.podiums + s.pointsFinishes + s.poles + s.dnfs > 0)
      .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);
  }

  /**
   * Calculate chart data for progression, distribution, and ranking evolution
   */
  function calculateChartData(
    driversData: any[],
    raceResults: RaceResult[],
    schedules: any[],
    selectedTrackMap: Map<string, any>,
    tracksData: any[]
  ) {
    const sortedSchedules = schedules.sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Group results by track
    const trackGroups = new Map<string, any[]>();
    sortedSchedules.forEach((schedule: any, originalRaceIndex: number) => {
      const st = selectedTrackMap.get(schedule.track);
      const trackId = st?.track?.id;
      if (!trackId) return;

      if (!trackGroups.has(trackId)) trackGroups.set(trackId, []);
      trackGroups.get(trackId)!.push({ schedule, originalRaceIndex, selectedTrack: st });
    });

    // Calculate points progression
    const driverPointsProgression = new Map<string, { [raceIndex: number]: number }>();
    driversData.forEach((d: any) => driverPointsProgression.set(d.id, {}));

    sortedSchedules.forEach((schedule: any, idx: number) => {
      const st = selectedTrackMap.get(schedule.track);
      const raceResultsForTrack = raceResults.filter(r => r.track === st?.id);
      const driverPointsThisRace = new Map<string, number>();

      raceResultsForTrack.forEach((r) => {
        const curr = driverPointsThisRace.get(r.driver) || 0;
        driverPointsThisRace.set(r.driver, curr + r.points);
      });

      driversData.forEach((d: any) => {
        const cur = driverPointsProgression.get(d.id) || {};
        const prev = idx > 0 ? (cur[idx - 1] || 0) : 0;
        const add = driverPointsThisRace.get(d.id) || 0;
        cur[idx] = prev + add;
        driverPointsProgression.set(d.id, cur);
      });
    });

    // Build chart data arrays
    const progressionData: any[] = [];
    const distributionData: any[] = [];
    let completedRoundIndex = 0;

    trackGroups.forEach((schedulesForTrack, trackId) => {
      const hasResults = schedulesForTrack.some(({ schedule }: any) => {
        const st = selectedTrackMap.get(schedule.track);
        const rr = raceResults.filter((r) => r.track === st?.id);
        return rr.length > 0;
      });

      if (!hasResults) return;

      const first = schedulesForTrack[0];
      const st = first.selectedTrack;

      // Progression data point
      const dataPoint: any = {
        race: `${st?.track?.name || 'Unknown'} (${new Date(first.schedule.date).toLocaleDateString()})`,
        raceIndex: completedRoundIndex,
        date: first.schedule.date,
      };

      driversData.forEach((d: any) => {
        // Get the cumulative points after the last event in this track group
        const lastSchedule = schedulesForTrack[schedulesForTrack.length - 1];
        const prog = driverPointsProgression.get(d.id) || {};
        dataPoint[d.name] = prog[lastSchedule.originalRaceIndex] || 0;
      });

      progressionData.push(dataPoint);

      // Distribution data point
      const distRow: any = {
        race: `${st?.track?.name || 'Unknown'} (${new Date(first.schedule.date).toLocaleDateString()})`,
        trackNameOnly: st?.track?.name || 'Unknown',
        selectedTrackId: st?.id,
        date: first.schedule.date,
      };

      driversData.forEach((d: any) => {
        let raw = 0;
        schedulesForTrack.forEach(({ originalRaceIndex }: any) => {
          const prog = driverPointsProgression.get(d.id) || {};
          const prev = originalRaceIndex > 0 ? (prog[originalRaceIndex - 1] || 0) : 0;
          const eventPoints = (prog[originalRaceIndex] || 0) - prev;
          raw += Math.max(0, eventPoints);
        });
        distRow[d.name] = raw;
      });

      distributionData.push(distRow);
      completedRoundIndex++;
    });

    // Calculate ranking evolution
    const rankingEvolution: any[] = [];
    progressionData.forEach((raceData, raceIndex) => {
      // For the last race, use actual database points to ensure accuracy
      const isLastRace = raceIndex === progressionData.length - 1;

      const standings = driversData.map((d: any) => ({
        driverId: d.id,
        driverName: d.name,
        points: isLastRace ? (d.points || 0) : (raceData[d.name] || 0),
      })).sort((a, b) => {
        // Sort by points descending, then by driver name alphabetically for tiebreaker
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.driverName.localeCompare(b.driverName);
      });

      const point: any = {
        race: raceData.race,
        raceIndex: raceData.raceIndex,
        date: raceData.date,
      };

      standings.forEach((s, pos) => {
        point[s.driverName] = pos + 1;
      });

      rankingEvolution.push(point);
    });

    return { progressionData, distributionData, rankingEvolution };
  }

  /**
   * Enrich driver data with team information
   */
  function enrichDriverData(driversData: any[], teamMap: Map<string, any>): DriverRow[] {
    return driversData.map((d: any) => {
      const team = teamMap.get(d.team);
      return {
        id: d.id,
        name: d.name,
        points: d.points || 0,
        team: d.team,
        teamName: team?.name || 'Unknown',
        teamLogo: extractImageUrl(team?.logo || ''),
      };
    }).sort((a, b) => {
      // Sort by points descending, then by name alphabetically for tiebreaker
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // Define table columns
  const columns: ColumnDef<DriverRow>[] = useMemo(() => [
    {
      accessorKey: 'position',
      header: 'POS',
      cell: ({ row }) => (
        <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">
          {row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'DRIVER',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {row.original.name}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'teamName',
      header: 'TEAM',
      cell: ({ row }) => {
        const isRB = row.original.teamName === 'RB';
        const isStakeF1 = row.original.teamName === 'Stake F1 Team';
        const logoSize = (isRB || isStakeF1) ? 'w-10 h-10' : 'w-8 h-8';

        return (
          <div className="flex items-center">
            {row.original.teamLogo ? (
              <img
                src={row.original.teamLogo}
                alt={`${row.original.teamName} logo`}
                className={`${logoSize} object-contain bg-black/10 dark:bg-transparent rounded-lg p-1`}
              />
            ) : (
              <span className={`inline-block ${logoSize} bg-gray-200 dark:bg-muted rounded-full flex-shrink-0`} />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'points',
      header: 'POINTS',
      cell: ({ row }) => (
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {row.original.points}
        </span>
      ),
    },
  ], []);

  // Chart configuration
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      views: { label: "Driver Points" },
    };
    drivers.forEach((d) => {
      config[d.name] = {
        label: d.name,
        color: TEAM_COLOR_MAP[d.teamName] || 'hsl(0, 0%, 70%)',
      };
    });
    return config;
  }, [drivers]);

  const statsChartConfig: ChartConfig = {
    wins: { label: "Wins", color: "hsl(45, 100%, 60%)" },
    podiums: { label: "Podiums", color: "hsl(210, 100%, 65%)" },
    pointsFinishes: { label: "Points finishes (4th-10th)", color: "hsl(145, 85%, 55%)" },
    poles: { label: "Pole positions", color: "hsl(285, 100%, 65%)" },
    dnfs: { label: "DNF/DSQ", color: "hsl(5, 100%, 60%)" },
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading driver standings...</div>
        </div>
      </div>
    );
  }

  // Render component
  return (
    <div className="p-3 sm:p-4 md:p-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 mb-4 sm:mb-6">

        {/* Driver Standings Table */}
        <div className="xl:col-span-4">
          <DataTable columns={columns} data={drivers} />
        </div>

        {/* Charts Grid */}
        <div className="xl:col-span-8 grid grid-cols-1 gap-6">

          {/* Points Progression Chart */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="flex flex-col items-stretch !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
                <CardTitle>Driver Points Progression</CardTitle>
                <CardDescription>Points progression across all races in chronological order</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
                <ChartContainer config={chartConfig} className="w-full h-full overflow-visible">
                  <LineChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="race"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={5}
                      height={36}
                      interval={0}
                      scale="point"
                      padding={{ left: 10, right: 10 }}
                      tick={(props) => {
                        const { x, y, payload } = props as any;
                        const raceData = chartData.find((d) => d.race === payload.value);
                        if (raceData) {
                          const trackName = (raceData.race as string).split(' (')[0];
                          const track = tracks.find((t) => t.name === trackName);
                          if (track?.img) {
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <foreignObject x={-12} y={4} width={24} height={16}>
                                  <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: track.img }} />
                                </foreignObject>
                              </g>
                            );
                          }
                        }
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={12} textAnchor="middle" fill="#666" fontSize={12}>
                              {raceData ? `Round ${raceData.raceIndex + 1}` : payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12 }}
                      width={40}
                      domain={[0, 'auto']}
                    />
                    <ChartTooltip
                      cursor={true}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length || !hoveredProgressionDriver) return null;

                        const raceData = chartData.find((d) => d.race === label);
                        const raceName = raceData ? raceData.race : label;

                        // Only show the hovered driver
                        const entry = payload.find((p: any) => p.dataKey === hoveredProgressionDriver);
                        if (!entry) return null;

                        const driverName = entry.dataKey as string;
                        if (!driverName) return null;

                        const color = chartConfig[driverName]?.color || entry.color;

                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm mb-2">{raceName}</p>
                            <p className="text-xs text-muted-foreground mb-2">Cumulative points</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium">{driverName}</span>
                                <span className="ml-auto text-muted-foreground">{entry.value} pts</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    {drivers.map((d) => {
                      const isHovered = hoveredProgressionDriver === d.name;
                      const isOtherHovered = hoveredProgressionDriver && hoveredProgressionDriver !== d.name;
                      const lineColor = chartConfig[d.name]?.color || 'hsl(0, 0%, 70%)';

                      return (
                        <Line
                          key={d.id}
                          dataKey={d.name}
                          type="monotone"
                          stroke={activeDriver === "all" || activeDriver === d.name ? lineColor : "transparent"}
                          strokeWidth={
                            isHovered ? 6 :
                              activeDriver === d.name ? 3 : 2
                          }
                          strokeOpacity={isOtherHovered ? 0.15 : 1}
                          dot={(activeDriver === "all" || activeDriver === d.name) ? {
                            r: 5,
                            strokeWidth: 2,
                            stroke: lineColor,
                            fill: lineColor,
                            onMouseEnter: () => setHoveredProgressionDriver(d.name),
                            onMouseLeave: () => setHoveredProgressionDriver(null),
                            style: { cursor: 'pointer' }
                          } : false}
                          activeDot={{
                            r: isHovered ? 10 : 5,
                            strokeWidth: 2,
                            stroke: lineColor,
                            fill: lineColor,
                            fillOpacity: isHovered ? 0.4 : 1,
                            onMouseEnter: () => setHoveredProgressionDriver(d.name),
                            onMouseLeave: () => setHoveredProgressionDriver(null),
                          }}
                          hide={activeDriver !== "all" && activeDriver !== d.name}
                          onMouseEnter={() => setHoveredProgressionDriver(d.name)}
                          onMouseLeave={() => setHoveredProgressionDriver(null)}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Driver Statistics and Ranking Evolution side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">

        {/* Points Distribution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Points Distribution</CardTitle>
            <CardDescription>Split of points earned by each driver per track (horizontal stacked bars)</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4 overflow-auto">
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: Math.max(400, distributionData.length * 40) }}
              >
                <BarChart
                  accessibilityLayer
                  data={distributionData}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 6, bottom: 0 }}
                >
                  <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    domain={[0, 'auto']}
                    allowDataOverflow
                    height={20}
                  />
                  <YAxis
                    type="category"
                    dataKey="trackNameOnly"
                    width={30}
                    tickLine={false}
                    axisLine={false}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const trackName = payload.value as string;
                      const track = tracks.find((t) => t.name === trackName);
                      if (track?.img) {
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <foreignObject x={-26} y={-10} width={24} height={16}>
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center'
                                }}
                                dangerouslySetInnerHTML={{ __html: track.img }}
                              />
                            </foreignObject>
                          </g>
                        );
                      }
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={12}>
                            {trackName}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const entries = hoveredDistributionDriver
                        ? payload.filter((p: any) => p.dataKey === hoveredDistributionDriver)
                        : [payload.find((p: any) => typeof p.value === 'number' && p.value > 0) || payload[0]];
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium text-sm mb-2">{label}</p>
                          <p className="text-xs text-muted-foreground mb-2">Points earned at this track</p>
                          <div className="space-y-1">
                            {entries.filter(Boolean).map((entry: any, idx: number) => {
                              const name = entry.dataKey as string;
                              const color = chartConfig[name]?.color || entry.color;
                              return (
                                <div key={`${name}-${idx}`} className="flex items-center gap-2 text-sm">
                                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                  <span>{name}</span>
                                  <span className="ml-auto font-medium">{entry.value} pts</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {drivers.map((d) => (
                    <Bar
                      key={`dist-${d.id}`}
                      dataKey={d.name}
                      stackId="distribution"
                      radius={[0, 0, 0, 0]}
                      fill={chartConfig[d.name]?.color}
                      stroke="#000"
                      strokeWidth={1}
                      onMouseMove={() => setHoveredDistributionDriver(d.name)}
                      onMouseLeave={() => setHoveredDistributionDriver(null)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Driver Ranking Evolution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Driver Ranking Evolution</CardTitle>
            <CardDescription>Position changes in the driver standings across rounds</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
              <ChartContainer
                config={chartConfig}
                className="w-full h-full overflow-visible"
              >
                <LineChart
                  accessibilityLayer
                  data={rankingData}
                  margin={{ left: 5, right: 20, top: 15, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={5}
                    height={36}
                    interval={0}
                    scale="point"
                    padding={{ left: 10, right: 10 }}
                    tick={(props) => {
                      const { x, y, payload } = props as any;
                      const raceData = rankingData.find((d) => d.race === payload.value);
                      if (raceData) {
                        const trackName = (raceData.race as string).split(' (')[0];
                        const track = tracks.find((t) => t.name === trackName);
                        if (track?.img) {
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <foreignObject x={-15} y={4} width={30} height={20}>
                                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: track.img }} />
                              </foreignObject>
                            </g>
                          );
                        }
                      }
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={12} textAnchor="middle" fill="#666" fontSize={12}>
                            {raceData ? `Round ${raceData.raceIndex + 1}` : payload.value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.toString()}
                    reversed={true}
                    domain={[1, drivers.length]}
                    ticks={Array.from({ length: drivers.length }, (_, i) => i + 1)}
                    tick={{ fontSize: 12 }}
                    width={30}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const raceData = chartData.find((d) => d.race === label);
                        const raceName = raceData ? raceData.race : label;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm mb-2">{raceName}</p>
                            <p className="text-xs text-muted-foreground mb-2">Driver championship position</p>
                            <div className="space-y-1">
                              {payload.map((entry: any, index: number) => {
                                const driverName = entry.dataKey;
                                const color = chartConfig[driverName]?.color || entry.color;
                                return (
                                  <div key={index} className="flex items-center gap-2 text-sm">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="font-medium">{driverName}</span>
                                    <span className="text-muted-foreground">Position {entry.value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {drivers.map((d) => (
                    <Line
                      key={d.id}
                      dataKey={d.name}
                      type="monotone"
                      stroke={activeDriver === "all" || activeDriver === d.name ? chartConfig[d.name]?.color : "transparent"}
                      strokeWidth={activeDriver === d.name ? 3 : 2}
                      dot={activeDriver === "all" || activeDriver === d.name}
                      hide={activeDriver !== "all" && activeDriver !== d.name}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
