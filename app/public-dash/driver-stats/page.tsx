"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import { usePublicSeasonId } from "@/hooks/use-public-season-id";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Label } from "recharts";
import { IconTrophy, IconMedal, IconTarget } from "@tabler/icons-react";

interface Driver {
  id: string;
  name: string;
  team: string;
  points: number;
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
  qualified_position?: number;
}

interface DriverStats {
  wins: number;
  podiums: number;
  pointsFinishes: number;
  // Total points scored across all finished races for the driver (includes bonus points).
  totalPoints: number;
  dnfs: number;
  totalRaces: number;
  finishPositions: { [key: number]: number };
  qualifyingPositions: { [key: number]: number };
  qualifyingTrend: Array<{ race: string; position: number }>;
  driverImage?: string;
  driverNumber?: number | string | null;
  teamColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  allTimeWins: number;
  allTimePoints: number;
  allTimePodiums: number;
  allTimeRaceStarts: number;
}



const COLORS = {
  wins: "#FFD700", // Gold
  podiums: "#4169E1", // Blue
  pointsFinishes: "#C0C0C0", // Light Grey
  dnfs: "#696969", // Dark Grey
  primary: "#FF6B35", // Orange
  secondary: "#4ECDC4", // Teal
  // Consistent color scheme for radial chart
  chart: {
    wins: "#FFD700", // Gold
    podiums: "#4169E1", // Blue
    points: "#C0C0C0", // Light Grey
    dnfs: "#696969", // Dark Grey
  }
};

function DriverStatsContent() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonRacingDriverCount, setSeasonRacingDriverCount] = useState<number>(20);

  const searchParams = useSearchParams();
  const urlDriverId = useMemo(() => searchParams.get("driverId"), [searchParams]);
  const urlSeasonId = usePublicSeasonId();

  useEffect(() => {
    fetchData();
  }, [urlSeasonId]);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverStats(selectedDriver);
    }
  }, [selectedDriver, urlSeasonId]);

  const fetchData = async () => {
    try {
      const [
        { data: driversData },
        { data: teamsData },
        { data: results },
        { data: seasonEntries },
        { data: tracksData },
        { data: selectedTracks },
        { data: rules }
      ] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('teams').select('*'),
        (urlSeasonId
          ? supabase.from('results').select('*').eq('season_id', urlSeasonId)
          : supabase.from('results').select('*')),
        (urlSeasonId
          ? supabase.from("season_driver_entries").select("driver_id, team_id").eq("season_id", urlSeasonId)
          : Promise.resolve({ data: [] as any[] })),
        supabase.from('tracks').select('*'),
        (urlSeasonId
          ? supabase.from('selected_tracks').select('*, track(*)').eq('season_id', urlSeasonId)
          : supabase.from('selected_tracks').select('*, track(*)')),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single()
      ]);

      let effectiveResults = results || [];
      let effectiveSelectedTracks = selectedTracks || [];
      if (urlSeasonId && effectiveResults.length === 0 && effectiveSelectedTracks.length === 0) {
        const [fallbackResults, fallbackSelectedTracks] = await Promise.all([
          supabase.from("results").select("*"),
          supabase.from("selected_tracks").select("*, track(*)"),
        ]);
        effectiveResults = fallbackResults.data || [];
        effectiveSelectedTracks = fallbackSelectedTracks.data || [];
      }

      if (!driversData || !teamsData || !tracksData || !rules) {
        throw new Error('Failed to fetch data');
      }

      
      // Process drivers with team info
      const teamMap = new Map(teamsData.map((t: Record<string, unknown>) => [t.id as string, t]));
      const seasonTeamByDriverId = new Map<string, string | null>(
        ((seasonEntries as any[]) || []).map((e: any) => [String(e.driver_id), e.team_id || null])
      );
      const participatingDriverIds = new Set((effectiveResults || []).map((r: any) => String(r.driver)));
      setSeasonRacingDriverCount(Math.max(1, participatingDriverIds.size));
      
      // Create selected track map for event type lookup
      const selectedTrackMap = new Map(effectiveSelectedTracks.map((st: Record<string, unknown>) => [st.id as string, st]));
      const processedDrivers = driversData
        .filter(
          (d: Record<string, unknown>) =>
            participatingDriverIds.has(String(d.id as string)) &&
            !!String(
              (urlSeasonId
                ? (seasonTeamByDriverId.get(String(d.id as string)) ?? "")
                : (d.team as string | null)) || ""
            )
        )
        .map((d: Record<string, unknown>) => {
        const resolvedTeamId = (urlSeasonId
          ? (seasonTeamByDriverId.get(String(d.id as string)) ?? null)
          : (d.team as string | null));
        const team = teamMap.get((resolvedTeamId as string) || "");
        return {
          id: d.id as string,
          name: d.name as string,
          team: (team as Record<string, unknown>)?.name as string || 'Unknown',
          points: (d.points as number) || 0,
        };
      }).sort((a, b) => b.points - a.points);

      setDrivers(processedDrivers);
      
      // Set first driver as default
      if (!urlDriverId && processedDrivers.length > 0) {
        setSelectedDriver(processedDrivers[0].id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // Deep-link: preselect driver if driverId is provided in the URL.
  useEffect(() => {
    if (urlDriverId) {
      setSelectedDriver(urlDriverId);
    }
  }, [urlDriverId]);

  const fetchDriverStats = async (driverId: string) => {
    try {
      const [
        { data: results },
        { data: allResults },
        { data: teamsData },
        { data: tracksData },
        { data: selectedTracks },
        { data: allSelectedTracks },
        { data: rules },
        { data: seasonDriverEntry },
        { data: driverData }
      ] = await Promise.all([
        (urlSeasonId
          ? supabase.from('results').select('*').eq('driver', driverId).eq('season_id', urlSeasonId)
          : supabase.from('results').select('*').eq('driver', driverId)),
        supabase.from('results').select('*').eq('driver', driverId),
        supabase.from('teams').select('*'),
        supabase.from('tracks').select('*'),
        (urlSeasonId
          ? supabase.from('selected_tracks').select('*, track(*)').eq('season_id', urlSeasonId)
          : supabase.from('selected_tracks').select('*, track(*)')),
        supabase.from('selected_tracks').select('*, track(*)'),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single(),
        (urlSeasonId
          ? supabase
              .from("season_driver_entries")
              .select("team_id")
              .eq("season_id", urlSeasonId)
              .eq("driver_id", driverId)
              .maybeSingle()
          : Promise.resolve({ data: null as any })),
        supabase.from('drivers').select('*, team(*)').eq('id', driverId).single()
      ]);

      let effectiveResults = results || [];
      let effectiveSelectedTracks = selectedTracks || [];
      if (urlSeasonId && effectiveResults.length === 0 && effectiveSelectedTracks.length === 0) {
        const [fallbackResults, fallbackSelectedTracks] = await Promise.all([
          supabase.from("results").select("*").eq("driver", driverId),
          supabase.from("selected_tracks").select("*, track(*)"),
        ]);
        effectiveResults = fallbackResults.data || [];
        effectiveSelectedTracks = fallbackSelectedTracks.data || [];
      }

      if (!teamsData || !tracksData || !rules || !driverData) return;

      const teamMap = new Map(teamsData.map((t: Record<string, unknown>) => [t.id as string, t]));
      const trackMap = new Map(tracksData.map((t: Record<string, unknown>) => [t.id as string, t.name as string]));
      
      // Create selected track map for event type lookup
      const selectedTrackMap = new Map(effectiveSelectedTracks.map((st: Record<string, unknown>) => [st.id as string, st]));
      const allSelectedTrackMap = new Map(((allSelectedTracks as Record<string, unknown>[]) || []).map((st: Record<string, unknown>) => [st.id as string, st]));
      
      // Team color mapping
      const teamColorMap: { [key: string]: string } = {
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

      const getTeamColorVariations = (teamName: string) => {
        const baseColor = teamColorMap[teamName] || 'hsl(0, 0%, 50%)';
        const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) return {
          primary: baseColor,
          secondary: baseColor,
          accent: baseColor
        };
        
        const h = parseInt(hslMatch[1]);
        const s = parseInt(hslMatch[2]);
        const l = parseInt(hslMatch[3]);
        
        return {
          primary: baseColor,
          secondary: `hsl(${h}, ${Math.max(20, s - 20)}%, ${Math.min(70, l + 15)}%)`,
          accent: `hsl(${(h + 30) % 360}, ${s}%, ${Math.min(80, l + 20)}%)`
        };
      };

      // Get driver's team colors
      const resolvedDriverTeamId = urlSeasonId
        ? (seasonDriverEntry as any)?.team_id || null
        : (driverData as any)?.team?.id || (driverData as any)?.team || null;
      const driverTeam = teamMap.get(String(resolvedDriverTeamId || "")) as any;
      const teamName = driverTeam?.name || '';
      const teamColors = getTeamColorVariations(teamName);

      // Driver image (optional; depends on what's stored in the `drivers` table)
      const driverImage: string = (driverData as any)?.image || (driverData as any)?.carImage || "";
      const driverNumber: number | string | null =
        (driverData as any)?.driver_number ?? (driverData as any)?.number ?? null;
      const calculateResultPoints = (result: Record<string, unknown>, selectedTrackType: string | undefined) => {
        if (!result.racefinished) return 0;
        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];
        const eventType = selectedTrackType || 'Race';
        const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
        const maxPositions = eventType === 'Sprint' ? 8 : 10;
        const pos = (result.finishing_position as number) ?? (result.position as number);
        const basePoints = pos <= maxPositions ? pointsMapping[(pos || 0) - 1] : 0;
        const bonusPoints =
          ((rules as Record<string, unknown>).polegivespoint && result.pole ? 1 : 0) +
          ((rules as Record<string, unknown>).fastestlapgivespoint && result.fastestlap ? 1 : 0);
        return basePoints + bonusPoints;
      };

      // Process race results
      const raceResults: RaceResult[] = effectiveResults.map((result: Record<string, unknown>) => {
        const resolvedTeamId = (result as any).team_id || resolvedDriverTeamId || '';
        const team = teamMap.get(String(resolvedTeamId));
        const trackName = trackMap.get(result.track as string) || 'Unknown';
        
        // Calculate points with rules
        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];
        const selectedTrack = selectedTrackMap.get(result.track as string) as any;
        const points = calculateResultPoints(result, selectedTrack?.type);

        return {
          track: result.track as string,
          trackName,
          date: (result.date as string) || '',
          position: (result.finishing_position as number) ?? (result.position as number),
          driver: result.driver as string,
          driverName: 'Driver', // Will be filled from driver data
          teamId: String(resolvedTeamId || ''),
          teamName: (team as Record<string, unknown>)?.name as string || 'Unknown',
          points,
          pole: (result.pole as boolean) || false,
          fastestlap: (result.fastestlap as boolean) || false,
          racefinished: result.racefinished !== false,
          qualified_position: result.qualified_position as number
        };
      });

             // Calculate statistics
       const stats: DriverStats = {
         wins: 0,
         podiums: 0,
         pointsFinishes: 0,
        totalPoints: 0,
         dnfs: 0,
         totalRaces: raceResults.length,
         finishPositions: {},
         qualifyingPositions: {},
         qualifyingTrend: [],
        driverImage,
        driverNumber,
         teamColors,
         allTimeWins: 0,
         allTimePoints: 0,
         allTimePodiums: 0,
         allTimeRaceStarts: 0,
       };

      // Process each result
      raceResults.forEach((result) => {
        const qualPosRaw = result.qualified_position;
        const qualPos = typeof qualPosRaw === "number" ? qualPosRaw : Number(qualPosRaw);
        if (Number.isFinite(qualPos) && qualPos > 0) {
          stats.qualifyingPositions[qualPos] = (stats.qualifyingPositions[qualPos] || 0) + 1;
          stats.qualifyingTrend.push({
            race: result.trackName || `Race ${stats.qualifyingTrend.length + 1}`,
            position: qualPos,
          });
        }

        if (!result.racefinished) {
          stats.dnfs++;
          return;
        }

        // Sum up points for every finished race (including bonus points).
        stats.totalPoints += result.points;

        // Count finish positions
        const pos = result.position;
        stats.finishPositions[pos] = (stats.finishPositions[pos] || 0) + 1;

        // Count wins, podiums, points finishes
        if (pos === 1) {
          stats.wins++;
          stats.podiums++;
          stats.pointsFinishes++;
        } else if (pos === 2 || pos === 3) {
          stats.podiums++;
          stats.pointsFinishes++;
        } else if (pos >= 4 && pos <= 10) {
          stats.pointsFinishes++;
        }
      });

      // Calculate all-time career stats across all seasons.
      const careerResults = (allResults || []) as Record<string, unknown>[];
      careerResults.forEach((result) => {
        const pos = Number((result.finishing_position as number) ?? (result.position as number));
        if (Number.isFinite(pos) && pos === 1) stats.allTimeWins++;
        if (Number.isFinite(pos) && pos >= 1 && pos <= 3) stats.allTimePodiums++;
        stats.allTimeRaceStarts++;
        const selectedTrack = allSelectedTrackMap.get(String(result.track)) as any;
        stats.allTimePoints += calculateResultPoints(result, selectedTrack?.type);
      });

             
       
       setDriverStats(stats);
     } catch (error) {
       console.error('Error fetching driver stats:', error);
     }
   };


  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-muted-foreground">Loading driver stats...</div>
        </div>
      </div>
    );
  }

  
  // Calculate categories (these can overlap - a win is also a podium and points finish)
  const wins = driverStats?.wins || 0;
  const podiums = driverStats?.podiums || 0; // P1-P3
  const pointsFinishes = driverStats?.pointsFinishes || 0; // P1-P10
  const pointsScored = driverStats?.totalPoints || 0;
  const dnfs = driverStats?.dnfs || 0;
  
     // Create data array for Interactive Pie chart with team colors
   const seasonPerformanceData = [
     { 
       category: "wins", 
       value: wins,
       fill: driverStats?.teamColors?.accent || COLORS.wins,
       label: "Wins"
     },
     { 
       category: "podiums", 
       value: podiums,
       fill: driverStats?.teamColors?.primary || COLORS.podiums,
       label: "Podiums"
     },
     { 
       category: "points", 
       value: pointsFinishes,
       fill: driverStats?.teamColors?.secondary || COLORS.pointsFinishes,
      label: "Points Finishes"
     },
     { 
       category: "dnfs", 
       value: dnfs,
       fill: "#696969", // Keep DNFs as dark grey for contrast
       label: "DNFs"
     }
   ];

   // Debug: Log the data to console
   console.log('Season Performance Data:', seasonPerformanceData);
   console.log('Driver Stats:', driverStats);

                       const chartConfig = {
       value: {
         label: "Races",
       },
       wins: {
         label: "Wins (P1)",
         color: driverStats?.teamColors?.accent || COLORS.chart.wins,
       },
       podiums: {
         label: "Podiums (P1-P3)", 
         color: driverStats?.teamColors?.primary || COLORS.chart.podiums,
       },
       points: {
         label: "Points (P1-P10)",
         color: driverStats?.teamColors?.secondary || COLORS.chart.points,
       },
       dnfs: {
         label: "DNF/DSQ",
         color: "#696969",
       },
     } satisfies ChartConfig;

  const finishPositionsData = driverStats ? 
    Array.from({ length: seasonRacingDriverCount }, (_, i) => ({
      position: `P${i + 1}`,
      count: driverStats.finishPositions[i + 1] || 0
    })) : [];

  const qualifyingPositionsData = driverStats
    ? Array.from({ length: seasonRacingDriverCount }, (_, i) => ({
        position: `P${i + 1}`,
        count: driverStats.qualifyingPositions[i + 1] || 0,
      }))
    : [];

  const pointsPercentage = driverStats ? 
    Math.round((driverStats.pointsFinishes / driverStats.totalRaces) * 100) : 0;

  const toAlphaHsl = (hsl: string, alpha: number) => {
    // Convert `hsl(h, s%, l%)` -> `hsla(h, s%, l%, alpha)` for rgba-like gradients.
    const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (!match) return hsl;
    const [, h, s, l] = match;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  };

  const setHslLightness = (hsl: string, lightness: number) => {
    const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (!match) return hsl;
    const [, h, s] = match;
    return `hsl(${h}, ${s}%, ${lightness}%)`;
  };

  const makeTeamTileVars = (baseColor: string) => {
    const baseTop = setHslLightness(baseColor, 30);
    const overlay = toAlphaHsl(baseTop, 0.25);
    const corner = "rgba(0,0,0,0)";
    const glow = toAlphaHsl(baseColor, 0.95);
    return {
      overlay,
      corner,
      glow,
    };
  };

  const vizBase = driverStats?.teamColors?.primary || COLORS.primary;
  const { overlay: vizOverlay, corner: vizCorner, glow: vizGlow } = makeTeamTileVars(vizBase);
  const tileBorderColor = toAlphaHsl(vizBase, 0.72);

  return (
    <div className="relative">
      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
      {/* Header with driver selection */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver: Driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name} ({driver.team})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 md:gap-4 items-stretch">
                {/* Left: compact tiles + charts */}
                <div className="space-y-3 md:space-y-4 lg:h-full lg:flex lg:flex-col lg:justify-end">
                  {/* Top compact stat tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(() => {
                      const base = driverStats?.teamColors?.primary || COLORS.primary;
                      const { overlay, corner, glow } = makeTeamTileVars(base);
                      return (
                        <Card
                          className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                          style={{
                            borderColor: tileBorderColor,
                            backgroundColor: "#070708",
                            backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                            backgroundSize: "auto, 12px 12px",
                            backgroundPosition: "center, 0 0",
                            ["--driver-tile-glow" as any]: glow,
                            ["--driver-tile-glow-blur" as any]: "30px",
                          }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                            style={{
                              background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                            }}
                          />
                          <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-xl font-bold mb-1 driver-number-beam" style={{ color: base }}>
                                  {driverStats?.wins || 0}
                                </CardTitle>
                                <CardDescription className="text-xs driver-name-beam">Wins</CardDescription>
                              </div>
                              <IconTrophy className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })()}

                    {(() => {
                      const base = driverStats?.teamColors?.primary || COLORS.primary;
                      const { overlay, corner, glow } = makeTeamTileVars(base);
                      return (
                        <Card
                          className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                          style={{
                            borderColor: tileBorderColor,
                            backgroundColor: "#070708",
                            backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                            backgroundSize: "auto, 12px 12px",
                            backgroundPosition: "center, 0 0",
                            ["--driver-tile-glow" as any]: glow,
                            ["--driver-tile-glow-blur" as any]: "30px",
                          }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                            style={{
                              background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                            }}
                          />
                          <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-xl font-bold mb-1 driver-number-beam" style={{ color: base }}>
                                  {driverStats?.podiums || 0}
                                </CardTitle>
                                <CardDescription className="text-xs driver-name-beam">Podiums</CardDescription>
                              </div>
                              <IconMedal className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })()}

                    {(() => {
                      const base = driverStats?.teamColors?.primary || COLORS.primary;
                      const { overlay, corner, glow } = makeTeamTileVars(base);
                      return (
                        <Card
                          className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                          style={{
                            borderColor: tileBorderColor,
                            backgroundColor: "#070708",
                            backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                            backgroundSize: "auto, 12px 12px",
                            backgroundPosition: "center, 0 0",
                            ["--driver-tile-glow" as any]: glow,
                            ["--driver-tile-glow-blur" as any]: "30px",
                          }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                            style={{
                              background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                            }}
                          />
                          <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-xl font-bold mb-1 driver-number-beam" style={{ color: base }}>
                                  {pointsScored}
                                </CardTitle>
                                <CardDescription className="text-xs driver-name-beam">Points scored</CardDescription>
                              </div>
                              <IconTarget className="h-5 w-5 text-muted-foreground/60" />
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })()}
                  </div>

                  {/* Pie chart tiles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
                    <Card
                      className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
                      style={{
                        borderColor: tileBorderColor,
                        backgroundColor: "#070708",
                        backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                        backgroundSize: "auto, 12px 12px",
                        backgroundPosition: "center, 0 0",
                        ["--driver-tile-glow" as any]: vizGlow,
                        ["--driver-tile-glow-blur" as any]: "30px",
                      }}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
                        style={{
                          background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
                        }}
                      />
                      <CardHeader className="relative z-[1] pt-4 pb-2">
                        <CardTitle>Season Performance</CardTitle>
                        <CardDescription>Distribution of race outcomes</CardDescription>
                      </CardHeader>
                      <CardContent className="relative z-[1]">
                        <div className="w-full h-[220px] sm:h-[240px] relative flex items-center justify-center">
                          <ChartContainer
                            config={chartConfig}
                            className="mx-auto aspect-square w-full max-w-[240px]"
                          >
                            <PieChart>
                              <ChartTooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium">{data.label}</p>
                                        <p className="text-muted-foreground">{data.value} races</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Pie
                                data={seasonPerformanceData}
                                dataKey="value"
                                nameKey="category"
                                innerRadius={55}
                                strokeWidth={5}
                              >
                                <Label
                                  content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                      return (
                                        <text
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                        >
                                          <tspan
                                            x={viewBox.cx}
                                            y={viewBox.cy}
                                            className="fill-foreground text-2xl font-bold"
                                          >
                                            {driverStats?.totalRaces || 0}
                                          </tspan>
                                          <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) + 20}
                                            className="fill-muted-foreground"
                                          >
                                            Total Races
                                          </tspan>
                                        </text>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </Pie>
                            </PieChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
                      style={{
                        borderColor: tileBorderColor,
                        backgroundColor: "#070708",
                        backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                        backgroundSize: "auto, 12px 12px",
                        backgroundPosition: "center, 0 0",
                        ["--driver-tile-glow" as any]: vizGlow,
                        ["--driver-tile-glow-blur" as any]: "30px",
                      }}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
                        style={{
                          background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
                        }}
                      />
                      <CardHeader className="relative z-[1] pt-4 pb-2">
                        <CardTitle>Finish Positions in Points</CardTitle>
                        <CardDescription>Percentage of finishes in points</CardDescription>
                      </CardHeader>
                      <CardContent className="relative z-[1]">
                        <div className="w-full h-[220px] sm:h-[240px] flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "In Points", value: driverStats?.pointsFinishes || 0 },
                                  {
                                    name: "Outside Points",
                                    value:
                                      (driverStats?.totalRaces || 0) - (driverStats?.pointsFinishes || 0),
                                  },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={95}
                                paddingAngle={5}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                <Cell fill={driverStats?.teamColors?.primary || COLORS.primary} />
                                <Cell fill="#e5e7eb" />
                                <Label
                                  content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                      return (
                                        <text
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                        >
                                          <tspan
                                            x={viewBox.cx}
                                            y={viewBox.cy}
                                            className="fill-foreground text-2xl font-bold"
                                            style={{
                                              fill: driverStats?.teamColors?.primary || COLORS.primary,
                                            }}
                                          >
                                            {pointsPercentage}%
                                          </tspan>
                                          <tspan
                                            x={viewBox.cx}
                                            y={(viewBox.cy || 0) + 20}
                                            className="fill-muted-foreground text-xs"
                                          >
                                            {driverStats?.pointsFinishes || 0} In Points
                                          </tspan>
                                        </text>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </Pie>
                              <ChartTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium">{payload[0].name}</p>
                                        <p className="text-muted-foreground">
                                          {payload[0].value} races
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                {/* Right: driver image + all-time mini stats */}
                <div className="space-y-3 md:space-y-4">
                  <div className="relative min-h-[220px] md:min-h-[240px] flex items-center justify-center">
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-90 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at 80% 10%, ${
                          driverStats?.teamColors?.primary || "hsl(210, 100%, 60%)"
                        }55 0%, rgba(0,0,0,0) 55%), radial-gradient(ellipse at 15% 85%, ${
                          driverStats?.teamColors?.secondary || "hsl(210, 100%, 60%)"
                        }33 0%, rgba(0,0,0,0) 60%)`,
                      }}
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/25 to-transparent pointer-events-none"
                    />

                    {driverStats?.driverImage ? (
                      <>
                        <div
                          aria-hidden
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-[2] w-[220px] h-[220px] rounded-full overflow-hidden flex items-center justify-center pointer-events-none select-none"
                          style={{
                            border: `2px solid ${driverStats.teamColors?.primary || COLORS.primary}`,
                            boxShadow: `0 0 0 10px ${toAlphaHsl(
                              driverStats.teamColors?.primary || COLORS.primary,
                              0.08
                            )}`,
                          }}
                        >
                          <img
                            src={driverStats.driverImage}
                            alt={`${selectedDriver} image`}
                            className="w-full h-full object-cover object-top opacity-95"
                            style={{
                              // Stronger edge fade so it feels "inside the circle" instead of just clipped.
                              WebkitMaskImage:
                                "radial-gradient(circle at 50% 55%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 88%)",
                              maskImage:
                                "radial-gradient(circle at 50% 55%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 88%)",
                              transform: "scale(1.05)",
                              transformOrigin: "center",
                            }}
                          />

                          {driverStats?.driverNumber ? (
                            <div
                              aria-hidden
                              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                              style={{
                                fontSize: 120,
                                fontWeight: 900,
                                fontStyle: "italic",
                                color: driverStats.teamColors?.primary || "#ffffff",
                                opacity: 0.06,
                                letterSpacing: "-0.06em",
                              }}
                            >
                              {driverStats.driverNumber}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        No driver image
                      </div>
                    )}
                  </div>
                  <Card
                    className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
                    style={{
                      borderColor: tileBorderColor,
                      backgroundColor: "#070708",
                      backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                      backgroundPosition: "center, 0 0",
                      ["--driver-tile-glow" as any]: vizGlow,
                      ["--driver-tile-glow-blur" as any]: "30px",
                    }}
                  >
                    <CardHeader className="pb-1 pt-5">
                      <CardTitle className="text-sm">All-Time Career</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 pb-3">
                      <div className="grid grid-cols-2 gap-2 text-sm max-w-[280px] mx-auto">
                        <div className="rounded-md border border-white/10 bg-black/25 p-2">
                          <div className="text-muted-foreground text-xs">Wins</div>
                          <div className="font-bold">{driverStats?.allTimeWins || 0}</div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/25 p-2">
                          <div className="text-muted-foreground text-xs">Points</div>
                          <div className="font-bold">{driverStats?.allTimePoints || 0}</div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/25 p-2">
                          <div className="text-muted-foreground text-xs">Podiums</div>
                          <div className="font-bold">{driverStats?.allTimePodiums || 0}</div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/25 p-2">
                          <div className="text-muted-foreground text-xs">Race Starts</div>
                          <div className="font-bold">{driverStats?.allTimeRaceStarts || 0}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

        

       {/* Bottom visualizations */}
      <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card
        className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
        style={{
          borderColor: tileBorderColor,
          backgroundColor: "#070708",
          backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "auto, 12px 12px",
          backgroundPosition: "center, 0 0",
          ["--driver-tile-glow" as any]: vizGlow,
          ["--driver-tile-glow-blur" as any]: "30px",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
          style={{
            background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
          }}
        />
        <CardHeader className="relative z-[1] pt-4 pb-2">
          <CardTitle>Finish Positions Distribution</CardTitle>
          <CardDescription>Count of finishes for each position</CardDescription>
        </CardHeader>
        <CardContent className="relative z-[1]">
         <div className="w-full h-[220px] sm:h-[250px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={finishPositionsData}
                margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="position"
                  tickMargin={8}
                  padding={{ left: 20, right: 20 }}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  hide={false}
                  mirror={false}
                  tickMargin={8}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickCount={6}
                  domain={[0, "dataMax"]}
                  allowDecimals={false}
                  fontSize={12}
                />
                <Bar
                  dataKey="count"
                  fill={driverStats?.teamColors?.primary || COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-muted-foreground">{payload[0].value} finishes</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card
        className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
        style={{
          borderColor: tileBorderColor,
          backgroundColor: "#070708",
          backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "auto, 12px 12px",
          backgroundPosition: "center, 0 0",
          ["--driver-tile-glow" as any]: vizGlow,
          ["--driver-tile-glow-blur" as any]: "30px",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
          style={{
            background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
          }}
        />
        <CardHeader className="relative z-[1] pt-4 pb-2">
          <CardTitle>Qualifying Positions Through Season</CardTitle>
          <CardDescription>Count of qualifying finishes for each grid position</CardDescription>
        </CardHeader>
        <CardContent className="relative z-[1]">
          <div className="w-full h-[220px] sm:h-[250px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={qualifyingPositionsData}
                margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="position"
                  tickMargin={8}
                  padding={{ left: 20, right: 20 }}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  hide={false}
                  mirror={false}
                  tickMargin={8}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickCount={6}
                  domain={[0, "dataMax"]}
                  allowDecimals={false}
                  fontSize={12}
                />
                <Bar
                  dataKey="count"
                  fill={driverStats?.teamColors?.secondary || COLORS.secondary}
                  radius={[4, 4, 0, 0]}
                />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-muted-foreground">{payload[0].value} qualifying results</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
   );
 }

export default function DriverStatsPage() {
  return (
    <Suspense fallback={<div className="p-3 sm:p-4 lg:p-5" />}>
      <DriverStatsContent />
    </Suspense>
  );
}