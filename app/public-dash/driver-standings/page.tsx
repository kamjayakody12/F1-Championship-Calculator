"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function extractImageUrl(htmlString: string): string {
  if (!htmlString) return "";
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : "";
}

export default function DriverStandingsPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<DriverStatsData[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDriver, setActiveDriver] = useState<string>("all");
  const [hoveredDistributionDriver, setHoveredDistributionDriver] = useState<string | null>(null);

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
      pointsFinishes: baseColor,
      podiums: baseColor,
      wins: baseColor,
      poles: baseColor,
      dnfs: baseColor
    };
    const [, h, s, l] = hslMatch.map(Number);
    return {
      pointsFinishes: `hsl(${h}, ${Math.min(s + 20, 100)}%, ${Math.min(l + 30, 85)}%)`,
      podiums: `hsl(${h}, ${s}%, ${Math.min(l + 15, 75)}%)`,
      wins: `hsl(${h}, ${s}%, ${l}%)`,
      poles: `hsl(${h}, ${Math.max(s - 10, 30)}%, ${Math.max(l - 15, 25)}%)`,
      dnfs: `hsl(${h}, ${Math.max(s - 20, 20)}%, ${Math.max(l - 30, 15)}%)`
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

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

      const teamMap = new Map(teamsData.map((t: any) => [t.id, t]));
      const driverMap = new Map(driversData.map((d: any) => [d.id, d]));
      const trackMap = new Map(tracksData.map((t: any) => [t.id, t.name]));
      setTracks(tracksData);

      const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));
      const sortedSchedules = schedules.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const raceResults: RaceResult[] = results.map((result: any) => {
        const driver = driverMap.get(result.driver);
        const team = teamMap.get(driver?.team || '');
        const schedule = schedules.find((s: any) => {
          const st = selectedTrackMap.get(s.track);
          return st?.track?.id === result.track;
        });
        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];
        let points = 0;
        if (result.racefinished) {
          const pos = result.finishing_position ?? result.position; // support both column names
          
          // Determine event type from schedule
          const selectedTrack = selectedTrackMap.get(schedule?.track || '');
          const eventType = selectedTrack?.type || 'Race';
          
          // Choose appropriate points mapping
          const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
          const maxPositions = eventType === 'Sprint' ? 8 : 10;
          
          const basePoints = pos <= maxPositions ? pointsMapping[(pos || 0) - 1] : 0;
          const bonusPoints = (rules.polegivespoint && result.pole ? 1 : 0) + (rules.fastestlapgivespoint && result.fastestlap ? 1 : 0);
          points = basePoints + bonusPoints;
        }
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

      // Stats per driver
      const driverStats = new Map<string, DriverStatsData>();
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

      raceResults.forEach((res) => {
        const stats = driverStats.get(res.driver);
        if (!stats) return;
        if (res.pole) stats.poles++;
        if (!res.racefinished) {
          stats.dnfs++;
          return;
        }
        // Points finishes include all finishes from 1st to 10th (including wins and podiums)
        if (res.position >= 1 && res.position <= 10) stats.pointsFinishes++;
        if (res.position === 1) stats.wins++;
        else if (res.position === 2 || res.position === 3) stats.podiums++;
      });

      const statsArray = Array.from(driverStats.values())
        .filter((s) => s.wins + s.podiums + s.pointsFinishes + s.poles + s.dnfs > 0)
        .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);
      setStatsData(statsArray);

      // Progression per driver by grouped track (combine sprints and race)
      const driverPointsProgression = new Map<string, { [raceIndex: number]: number }>();
      const trackGroups = new Map<string, any[]>();
      sortedSchedules.forEach((schedule: any, originalRaceIndex: number) => {
        const st = selectedTrackMap.get(schedule.track);
        const trackId = st?.track?.id;
        if (!trackId) return;
        if (!trackGroups.has(trackId)) trackGroups.set(trackId, []);
        trackGroups.get(trackId)!.push({ schedule, originalRaceIndex, selectedTrack: st });
      });

      // Initialize progression structure
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

      const chartDataArray: any[] = [];
      const distributionRows: any[] = [];
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
        const dataPoint: any = {
          race: `${st?.track?.name || 'Unknown'} (${new Date(first.schedule.date).toLocaleDateString()})`,
          raceIndex: completedRoundIndex,
          date: first.schedule.date,
        };
        // combined cumulative points at this round for each driver
        driversData.forEach((d: any) => {
          let combined = 0;
          schedulesForTrack.forEach(({ originalRaceIndex }: any) => {
            const prog = driverPointsProgression.get(d.id) || {};
            combined += prog[originalRaceIndex] || 0;
          });
          dataPoint[d.name] = combined;
        });
        chartDataArray.push(dataPoint);

        // distribution raw points for this track (sum of events within the track)
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
        distributionRows.push(distRow);
        completedRoundIndex++;
      });

      setChartData(chartDataArray);
      setDistributionData(distributionRows);

      // Ranking evolution
      const rankingDataArray: any[] = [];
      chartDataArray.forEach((raceData) => {
        const standings = driversData.map((d: any) => ({
          driverId: d.id,
          driverName: d.name,
          points: raceData[d.name] || 0,
        })).sort((a, b) => b.points - a.points);
        const point: any = {
          race: raceData.race,
          raceIndex: raceData.raceIndex,
          date: raceData.date,
        };
        standings.forEach((s, pos) => {
          point[s.driverName] = pos + 1;
        });
        rankingDataArray.push(point);
      });
      setRankingData(rankingDataArray);

      // Driver rows with constructor points already on driver
      const enrichedDrivers: DriverRow[] = driversData.map((d: any) => {
        const team = teamMap.get(d.team);
        return {
          id: d.id,
          name: d.name,
          points: d.points || 0,
          team: d.team,
          teamName: team?.name || 'Unknown',
          teamLogo: extractImageUrl(team?.logo || ''),
        };
      }).sort((a, b) => b.points - a.points);

      setDrivers(enrichedDrivers);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      views: { label: "Driver Points" },
    };
    drivers.forEach((d) => {
      config[d.name] = {
        label: d.name,
        color: teamColorMap[d.teamName] || 'hsl(0, 0%, 70%)',
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

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading driver standings...</div>
        </div>
        
        {/* Bottom row: expand across full width to use left space */}
        <div className="xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Points Distribution by Track (Horizontal Stacked Bars) */}
          <Card>
            <CardHeader>
              <CardTitle>Points Distribution</CardTitle>
              <CardDescription>Split of points earned by each driver per track (horizontal stacked bars)</CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:px-2 sm:pt-2 sm:pb-0">
              <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(520, distributionData.length * 40) }}>
                <BarChart accessibilityLayer data={distributionData} layout="vertical" margin={{ left: 0, right: 16, top: 6, bottom: 0 }}>
                  <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 'auto']} allowDataOverflow height={20} />
                  <YAxis
                    type="category"
                    dataKey="trackNameOnly"
                    width={140}
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
                              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: track.img }} />
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
                      onMouseMove={() => setHoveredDistributionDriver(d.name)}
                      onMouseLeave={() => setHoveredDistributionDriver(null)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Driver Ranking Evolution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Ranking Evolution</CardTitle>
              <CardDescription>Position changes in the driver standings across rounds</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:px-3 sm:pt-3 sm:pb-0">
              <ChartContainer config={chartConfig} className="w-full h-[520px]">
                <LineChart accessibilityLayer data={rankingData} margin={{ left: 8, right: 120, top: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={10}
                    height={36}
                    interval={0}
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
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.toString()} reversed={true} domain={[1, drivers.length]} />
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
                      label={(props: any) => {
                        const { x, y, index } = props;
                        if (index === rankingData.length - 1) {
                          return (
                            <text x={x + 16} y={y + 4} fill={chartConfig[(props as any).name]?.color || '#666'} fontSize={13} fontWeight="600" textAnchor="start">
                              {(props as any).name}
                            </text>
                          );
                        }
                        return <></>;
                      }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Driver Standings Table */}
        <div className="xl:col-span-4">
          <div className="bg-white dark:bg-card rounded-2xl shadow border border-gray-200 dark:border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</TableHead>
                  <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver, idx) => (
                  <TableRow key={driver.id} className="border-b border-gray-100 dark:border-border last:border-0 hover:bg-gray-50 dark:hover:bg-muted/30 transition">
                    <TableCell className="py-4 px-6">
                      <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">{idx + 1}</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">{driver.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center">
                        {(() => {
                          const isRB = driver.teamName === 'RB';
                          const isStakeF1 = driver.teamName === 'Stake F1 Team';
                          const logoSize = (isRB || isStakeF1) ? 'w-10 h-10' : 'w-8 h-8';
                          const fallbackSize = (isRB || isStakeF1) ? 'w-10 h-10' : 'w-8 h-8';
                          
                          return driver.teamLogo ? (
                            <img src={driver.teamLogo} alt={`${driver.teamName} logo`} className={`${logoSize} object-contain bg-black/10 dark:bg-transparent rounded-lg p-1`} />
                          ) : (
                            <span className={`inline-block ${fallbackSize} bg-gray-200 dark:bg-muted rounded-full flex-shrink-0`} />
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{driver.points}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right: Charts grid */}
        <div className="xl:col-span-8 grid grid-cols-1 gap-6">
          {/* Points Progression Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
                <CardTitle>Driver Points Progression</CardTitle>
                <CardDescription>Points progression across all races in chronological order</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:px-3 sm:pt-3 sm:pb-0">
              <ChartContainer config={chartConfig} className="w-full h-[320px]">
                <LineChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8, top: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={10}
                    height={36}
                    interval={0}
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
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.toString()} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const raceData = chartData.find((d) => d.race === label);
                        const raceName = raceData ? raceData.race : label;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm mb-2">{raceName}</p>
                            <p className="text-xs text-muted-foreground mb-2">Cumulative points after this race</p>
                            <div className="space-y-1">
                              {payload.map((entry: any, index: number) => {
                                const driverName = entry.dataKey;
                                const color = chartConfig[driverName]?.color || entry.color;
                                // Use the chart data value which represents cumulative points at this race
                                const displayPoints = entry.value;
                                return (
                                  <div key={index} className="flex items-center gap-2 text-sm">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="font-medium">{driverName}</span>
                                    <span className="text-muted-foreground">{displayPoints} points</span>
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
            </CardContent>
          </Card>

          {/* Points Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Points Distribution</CardTitle>
              <CardDescription>Split of points earned by each driver per track (horizontal stacked bars)</CardDescription>
            </CardHeader>
            <CardContent className="p-1 sm:px-2 sm:pt-2 sm:pb-0">
              <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(800, distributionData.length * 60) }}>
                <BarChart accessibilityLayer data={distributionData} layout="vertical" margin={{ left: 0, right: 16, top: 6, bottom: 0 }}>
                  <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 'auto']} allowDataOverflow height={20} />
                  <YAxis
                    type="category"
                    dataKey="trackNameOnly"
                    width={140}
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
                              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: track.img }} />
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
                      onMouseMove={() => setHoveredDistributionDriver(d.name)}
                      onMouseLeave={() => setHoveredDistributionDriver(null)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

        </div>

        {/* Bottom row using full width: Driver Ranking Evolution */}
        <div className="xl:col-span-12">

          {/* Driver Ranking Evolution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Ranking Evolution</CardTitle>
              <CardDescription>Position changes in the driver standings across rounds</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:px-3 sm:pt-3 sm:pb-0">
              <ChartContainer config={chartConfig} className="w-full h-[520px]">
                <LineChart accessibilityLayer data={rankingData} margin={{ left: 8, right: 120, top: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={10}
                    height={36}
                    interval={0}
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
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.toString()} reversed={true} domain={[1, drivers.length]} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const raceData = chartData.find((d) => d.race === label);
                        const raceName = raceData ? raceData.race : label;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm mb-2">{raceName}</p>
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
                      label={(props: any) => {
                        const { x, y, index } = props;
                        if (index === rankingData.length - 1) {
                          return (
                            <text x={x + 16} y={y + 4} fill={chartConfig[(props as any).name]?.color || '#666'} fontSize={13} fontWeight="600" textAnchor="start">
                              {(props as any).name}
                            </text>
                          );
                        }
                        return <></>;
                      }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Driver Stats Bar Chart - Full Width Row */}
        <div className="xl:col-span-12 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Driver Stats</CardTitle>
              <CardDescription>Wins (1st), podiums (2nd-3rd), points finishes (1st-10th), pole positions, and DNFs</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:px-6 sm:pt-6 sm:pb-4">
              <ChartContainer config={statsChartConfig} className="w-full h-[600px]">
                <BarChart accessibilityLayer data={statsData} margin={{ left: 20, right: 20, top: 20, bottom: 20 }} barCategoryGap="15%" barGap={4}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="driverName"
                    tickLine={false}
                    tickMargin={12}
                    axisLine={false}
                    height={50}
                    interval={0}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const name = (payload.value as string) || '';
                      const initials = name.substring(0, 3).toUpperCase();
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={16}
                            textAnchor="middle"
                            fill="#666"
                            fontSize="13"
                            fontWeight={600}
                          >
                            {initials}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length && label) {
                        const d = statsData.find((s) => s.driverName === label);
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                              {d?.teamLogo && (
                                <img src={d.teamLogo} alt={`${label} team logo`} className="w-5 h-5 object-contain bg-black/10 dark:bg-transparent rounded p-0.5" />
                              )}
                              <p className="font-medium text-sm">{label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">Season statistics</p>
                            <div className="space-y-1">
                              {[
                                { key: 'pointsFinishes', label: 'Points Finishes (1st-10th, incl. wins & podiums)' },
                                { key: 'podiums', label: 'Podiums (2nd-3rd)' },
                                { key: 'wins', label: 'Wins (1st)' },
                                { key: 'poles', label: 'Poles' },
                                { key: 'dnfs', label: 'DNFs' },
                              ].map((stat, idx) => {
                                const entry = payload.find((p: any) => p.dataKey === stat.key);
                                const value = entry?.value || 0;
                                const colors = getTeamColorVariations(d?.teamName || '');
                                const color = (colors as any)[stat.key] || '#999';
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                    <span>{stat.label}</span>
                                    <span className="ml-auto font-medium">{value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                  />
                  {/* Points Finishes */}
                  <Bar dataKey="pointsFinishes" radius={[4, 4, 0, 0]} shape={(p: any) => {
                    const teamColors = getTeamColorVariations(p.payload?.teamName);
                    const { x, y, width, height, radius, onMouseEnter, onMouseLeave, onMouseMove, onClick } = p;
                    const r = Array.isArray(radius) ? radius[0] : (radius || 0);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={r}
                        ry={r}
                        fill={teamColors.pointsFinishes}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        onClick={onClick}
                      />
                    );
                  }} />
                  {/* Podiums */}
                  <Bar dataKey="podiums" radius={[4, 4, 0, 0]} shape={(p: any) => {
                    const teamColors = getTeamColorVariations(p.payload?.teamName);
                    const { x, y, width, height, radius, onMouseEnter, onMouseLeave, onMouseMove, onClick } = p;
                    const r = Array.isArray(radius) ? radius[0] : (radius || 0);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={r}
                        ry={r}
                        fill={teamColors.podiums}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        onClick={onClick}
                      />
                    );
                  }} />
                  {/* Wins */}
                  <Bar dataKey="wins" radius={[4, 4, 0, 0]} shape={(p: any) => {
                    const teamColors = getTeamColorVariations(p.payload?.teamName);
                    const { x, y, width, height, radius, onMouseEnter, onMouseLeave, onMouseMove, onClick } = p;
                    const r = Array.isArray(radius) ? radius[0] : (radius || 0);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={r}
                        ry={r}
                        fill={teamColors.wins}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        onClick={onClick}
                      />
                    );
                  }} />
                  {/* Poles */}
                  <Bar dataKey="poles" radius={[4, 4, 0, 0]} shape={(p: any) => {
                    const teamColors = getTeamColorVariations(p.payload?.teamName);
                    const { x, y, width, height, radius, onMouseEnter, onMouseLeave, onMouseMove, onClick } = p;
                    const r = Array.isArray(radius) ? radius[0] : (radius || 0);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={r}
                        ry={r}
                        fill={teamColors.poles}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        onClick={onClick}
                      />
                    );
                  }} />
                  {/* DNFs */}
                  <Bar dataKey="dnfs" radius={[4, 4, 0, 0]} shape={(p: any) => {
                    const teamColors = getTeamColorVariations(p.payload?.teamName);
                    const { x, y, width, height, radius, onMouseEnter, onMouseLeave, onMouseMove, onClick } = p;
                    const r = Array.isArray(radius) ? radius[0] : (radius || 0);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={r}
                        ry={r}
                        fill={teamColors.dnfs}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onMouseMove={onMouseMove}
                        onClick={onClick}
                      />
                    );
                  }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

