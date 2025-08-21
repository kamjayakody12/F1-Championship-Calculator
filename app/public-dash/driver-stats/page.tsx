"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Label, Sector, Tooltip } from "recharts";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartJSTooltip, Legend } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { Chart } from 'react-chartjs-2';
import { PieSectorDataItem } from "recharts/types/polar/Pie";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartJSTooltip,
  Legend,
  SankeyController,
  Flow
);

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
  dnfs: number;
  totalRaces: number;
  finishPositions: { [key: number]: number };
  startToFinishFlow: {
    nodes: Array<{ name: string }>;
    links: Array<{ source: number; target: number; value: number }>;
  };
  lapsLed: any[];
  teamColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

function extractImageUrl(htmlString: string): string {
  if (!htmlString) return "";
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : "";
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

export default function DriverStatsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<any[]>([]);
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverStats(selectedDriver);
    }
  }, [selectedDriver]);

  // Listen for theme changes to re-render chart
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          setThemeKey(prev => prev + 1);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const [
        { data: driversData },
        { data: teamsData },
        { data: results },
        { data: tracksData },
        { data: selectedTracks },
        { data: rules }
      ] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('results').select('*'),
        supabase.from('tracks').select('*'),
        supabase.from('selected_tracks').select('*, track(*)'),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single()
      ]);

      if (!driversData || !teamsData || !results || !tracksData || !selectedTracks || !rules) {
        throw new Error('Failed to fetch data');
      }

      setTracks(tracksData);
      
      // Process drivers with team info
      const teamMap = new Map(teamsData.map((t: any) => [t.id, t]));
      const processedDrivers = driversData.map((d: any) => {
        const team = teamMap.get(d.team);
        return {
          id: d.id,
          name: d.name,
          team: team?.name || 'Unknown',
          points: d.points || 0,
        };
      }).sort((a, b) => b.points - a.points);

      setDrivers(processedDrivers);
      
      // Set first driver as default
      if (processedDrivers.length > 0) {
        setSelectedDriver(processedDrivers[0].id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchDriverStats = async (driverId: string) => {
    try {
      const [
        { data: results },
        { data: teamsData },
        { data: tracksData },
        { data: selectedTracks },
        { data: rules },
        { data: driverData }
      ] = await Promise.all([
        supabase.from('results').select('*').eq('driver', driverId),
        supabase.from('teams').select('*'),
        supabase.from('tracks').select('*'),
        supabase.from('selected_tracks').select('*, track(*)'),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single(),
        supabase.from('drivers').select('*, team(*)').eq('id', driverId).single()
      ]);

      if (!results || !teamsData || !tracksData || !selectedTracks || !rules || !driverData) return;

      const teamMap = new Map(teamsData.map((t: any) => [t.id, t]));
      const trackMap = new Map(tracksData.map((t: any) => [t.id, t.name]));
      const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));
      
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
      const driverTeam = driverData.team;
      const teamName = driverTeam?.name || '';
      const teamColors = getTeamColorVariations(teamName);

      // Process race results
      const raceResults: RaceResult[] = results.map((result: any) => {
        const team = teamMap.get(result.team || '');
        const trackName = trackMap.get(result.track) || 'Unknown';
        
        // Calculate points with rules
        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        let points = 0;
        if (result.racefinished) {
          const pos = result.finishing_position ?? result.position;
          const basePoints = pos <= 10 ? racePointsMapping[(pos || 0) - 1] : 0;
          const bonusPoints = (rules.polegivespoint && result.pole ? 1 : 0) + (rules.fastestlapgivespoint && result.fastestlap ? 1 : 0);
          points = basePoints + bonusPoints;
        }

        return {
          track: result.track,
          trackName,
          date: result.date || '',
          position: result.finishing_position ?? result.position,
          driver: result.driver,
          driverName: 'Driver', // Will be filled from driver data
          teamId: result.team || '',
          teamName: team?.name || 'Unknown',
          points,
          pole: result.pole || false,
          fastestlap: result.fastestlap || false,
          racefinished: result.racefinished !== false,
          qualified_position: result.qualified_position
        };
      });

             // Calculate statistics
       const stats: DriverStats = {
         wins: 0,
         podiums: 0,
         pointsFinishes: 0,
         dnfs: 0,
         totalRaces: raceResults.length,
         finishPositions: {},
         startToFinishFlow: {
           nodes: [],
           links: []
         },
         lapsLed: [],
         teamColors
       };

      // Process each result
      raceResults.forEach((result) => {
        if (!result.racefinished) {
          stats.dnfs++;
          return;
        }

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

                 // Create start to finish flow data for Sankey diagram
         // Use qualified_position if available, otherwise use grid position or assume starting position
         const startPosition = result.qualified_position || result.position || 20; // Default to back of grid if no data
         const finishPosition = result.position;
         
         const startNode = `Start P${startPosition}`;
         const finishNode = `Finish P${finishPosition}`;
         
         // Add nodes if they don't exist
         if (!stats.startToFinishFlow.nodes.find(n => n.name === startNode)) {
           stats.startToFinishFlow.nodes.push({ name: startNode });
         }
         if (!stats.startToFinishFlow.nodes.find(n => n.name === finishNode)) {
           stats.startToFinishFlow.nodes.push({ name: finishNode });
         }
         
         // Find existing link or create new one
         const existingLink = stats.startToFinishFlow.links.find(
           link => link.source === stats.startToFinishFlow.nodes.findIndex(n => n.name === startNode) &&
                   link.target === stats.startToFinishFlow.nodes.findIndex(n => n.name === finishNode)
         );
         
         if (existingLink) {
           existingLink.value += 1;
         } else {
           stats.startToFinishFlow.links.push({
             source: stats.startToFinishFlow.nodes.findIndex(n => n.name === startNode),
             target: stats.startToFinishFlow.nodes.findIndex(n => n.name === finishNode),
             value: 1
           });
         }

        // Mock laps led data (you'll need to add this to your database)
        const mockLapsLed = Math.floor(Math.random() * 60) + 1;
        stats.lapsLed.push({
          race: result.trackName,
          lapsLed: mockLapsLed,
          totalLaps: 60
        });
      });

             
       
       setDriverStats(stats);
     } catch (error) {
       console.error('Error fetching driver stats:', error);
     }
   };

  const selectedDriverData = drivers.find(d => d.id === selectedDriver);

  if (loading) {
    return <div className="p-4 md:p-8">Loading driver stats...</div>;
  }

  // Prepare chart data for radial chart - each ring represents a different category
  const totalRaces = driverStats?.totalRaces || 1; // Avoid division by zero
  
  // Calculate categories (these can overlap - a win is also a podium and points finish)
  const wins = driverStats?.wins || 0;
  const podiums = driverStats?.podiums || 0; // P1-P3
  const pointsFinishes = driverStats?.pointsFinishes || 0; // P1-P10
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
       label: "Points"
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
    Array.from({ length: 20 }, (_, i) => ({
      position: `P${i + 1}`,
      count: driverStats.finishPositions[i + 1] || 0
    })) : [];

  const pointsPercentage = driverStats ? 
    Math.round((driverStats.pointsFinishes / driverStats.totalRaces) * 100) : 0;

  return (
    <div className="p-4 md:p-8">
      {/* Header with driver selection */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Driver Stats</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name} ({driver.team})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

             {/* Top stats cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle 
               className="text-2xl font-bold" 
               style={{ color: driverStats?.teamColors?.accent || COLORS.wins }}
             >
               {driverStats?.wins || 0}
             </CardTitle>
             <CardDescription>Wins</CardDescription>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardTitle 
               className="text-2xl font-bold" 
               style={{ color: driverStats?.teamColors?.primary || COLORS.podiums }}
             >
               {driverStats?.podiums || 0}
             </CardTitle>
             <CardDescription>Podiums</CardDescription>
           </CardHeader>
         </Card>
         <Card>
           <CardHeader className="pb-2">
             <CardTitle 
               className="text-2xl font-bold" 
               style={{ color: driverStats?.teamColors?.secondary || COLORS.pointsFinishes }}
             >
               {driverStats?.pointsFinishes || 0}
             </CardTitle>
             <CardDescription>Points Finishes</CardDescription>
           </CardHeader>
         </Card>
       </div>

               {/* Main charts - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {/* Season Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Season Performance</CardTitle>
              <CardDescription>Distribution of race outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[350px] relative flex items-center justify-center">
                <ChartContainer
                  config={chartConfig}
                  className="mx-auto aspect-square w-full max-w-[280px]"
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
                      innerRadius={60}
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
                                  className="fill-foreground text-3xl font-bold"
                                >
                                  {driverStats?.totalRaces || 0}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground"
                                >
                                  Total Races
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Finish Positions in Points Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Finish Positions in Points</CardTitle>
              <CardDescription>Percentage of finishes in points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[350px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'In Points', value: driverStats?.pointsFinishes || 0 },
                        { name: 'Outside Points', value: (driverStats?.totalRaces || 0) - (driverStats?.pointsFinishes || 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
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
                                  className="fill-foreground text-3xl font-bold"
                                  style={{ fill: driverStats?.teamColors?.primary || COLORS.primary }}
                                >
                                  {pointsPercentage}%
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground text-sm"
                                >
                                  {driverStats?.pointsFinishes || 0} In Points
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{payload[0].name}</p>
                              <p className="text-muted-foreground">{payload[0].value} races</p>
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

          {/* Finish Positions Distribution Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Finish Positions Distribution</CardTitle>
              <CardDescription>Count of finishes for each position</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finishPositionsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Bar dataKey="count" fill={driverStats?.teamColors?.primary || COLORS.primary} />
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
        </div>

        

             {/* Start to Finish Position Flow - Sankey Diagram */}
       <Card className="mt-6">
         <CardHeader>
           <CardTitle>Start to Finish Position Flow</CardTitle>
           <CardDescription>How qualifying positions translate to finishing positions</CardDescription>
         </CardHeader>
         <CardContent>
           {driverStats?.startToFinishFlow?.nodes && driverStats.startToFinishFlow.nodes.length > 0 ? (
             <div className="w-full h-[600px] dark:bg-red-950/10 bg-white rounded-lg p-4 border dark:border-red-900/20 border-gray-200">
               <Chart
                 key={themeKey}
                 type="sankey"
                 data={{
                   datasets: [{
                     label: 'Position Flow',
                     data: driverStats.startToFinishFlow.links
                       .sort((a, b) => {
                         // Sort by source position first, then target position
                         const sourceA = parseInt(driverStats.startToFinishFlow.nodes[a.source]?.name?.replace('Start P', '').replace('Finish P', '') || '0');
                         const sourceB = parseInt(driverStats.startToFinishFlow.nodes[b.source]?.name?.replace('Start P', '').replace('Finish P', '') || '0');
                         if (sourceA !== sourceB) return sourceA - sourceB;
                         
                         const targetA = parseInt(driverStats.startToFinishFlow.nodes[a.target]?.name?.replace('Start P', '').replace('Finish P', '') || '0');
                         const targetB = parseInt(driverStats.startToFinishFlow.nodes[b.target]?.name?.replace('Start P', '').replace('Finish P', '') || '0');
                         return targetA - targetB;
                       })
                       .map(link => ({
                         from: driverStats.startToFinishFlow.nodes[link.source]?.name || '',
                         to: driverStats.startToFinishFlow.nodes[link.target]?.name || '',
                         flow: link.value
                       })),
                     colorFrom: () => {
                       const isDark = document.documentElement.classList.contains('dark');
                       const baseColor = driverStats?.teamColors?.primary || COLORS.primary;
                       return isDark ? baseColor : baseColor.replace(')', ', 0.8)').replace('hsl(', 'hsla(');
                     },
                     colorTo: () => {
                       const isDark = document.documentElement.classList.contains('dark');
                       const baseColor = driverStats?.teamColors?.primary || COLORS.primary;
                       return isDark ? baseColor : baseColor.replace(')', ', 0.8)').replace('hsl(', 'hsla(');
                     },
                     color: (driverStats?.teamColors?.secondary || COLORS.secondary),
                     borderWidth: 0,
                     nodeWidth: 30
                   }]
                 }}
                 options={{
                   responsive: true,
                   maintainAspectRatio: false,
                   backgroundColor: (() => {
                     const isDark = document.documentElement.classList.contains('dark');
                     return isDark ? 'rgba(127, 29, 29, 0.1)' : '#f9fafb';
                   })(),
                   scales: {
                     x: {
                       display: false
                     },
                     y: {
                       display: false
                     }
                   },
                   plugins: {
                     legend: {
                       display: false
                     },
                     tooltip: {
                       backgroundColor: function(context: any) {
                         // Check if we're in dark mode by looking at document class or CSS variables
                         const isDark = document.documentElement.classList.contains('dark') || 
                                       getComputedStyle(document.documentElement).getPropertyValue('--background').includes('0 0% 3.9%');
                         return isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
                       },
                       titleColor: function(context: any) {
                         const isDark = document.documentElement.classList.contains('dark') || 
                                       getComputedStyle(document.documentElement).getPropertyValue('--background').includes('0 0% 3.9%');
                         return isDark ? 'white' : 'black';
                       },
                       bodyColor: function(context: any) {
                         const isDark = document.documentElement.classList.contains('dark') || 
                                       getComputedStyle(document.documentElement).getPropertyValue('--background').includes('0 0% 3.9%');
                         return isDark ? 'white' : 'black';
                       },
                       borderColor: (driverStats?.teamColors?.primary || COLORS.primary),
                       borderWidth: 2,
                       cornerRadius: 8,
                       displayColors: false,
                       callbacks: {
                         title: function(context: any) {
                           const dataIndex = context[0]?.dataIndex;
                           if (dataIndex !== undefined && driverStats?.startToFinishFlow?.links[dataIndex]) {
                             const link = driverStats.startToFinishFlow.links[dataIndex];
                             const fromNode = driverStats.startToFinishFlow.nodes[link.source]?.name?.replace('Start P', 'Starting P');
                             const toNode = driverStats.startToFinishFlow.nodes[link.target]?.name?.replace('Finish P', 'Finishing P');
                             return `${fromNode} → ${toNode}`;
                           }
                           return '';
                         },
                         label: function(context: any) {
                           const dataIndex = context.dataIndex;
                           if (dataIndex !== undefined && driverStats?.startToFinishFlow?.links[dataIndex]) {
                             const flow = driverStats.startToFinishFlow.links[dataIndex].value;
                             return `${flow} race${flow !== 1 ? 's' : ''}`;
                           }
                           return '';
                         }
                       }
                     }
                   },
                   layout: {
                     padding: {
                       top: 20,
                       bottom: 20,
                       left: 80,
                       right: 80
                     }
                   }
                 }}
               />
             </div>
           ) : (
             <div className="text-center py-8 text-muted-foreground">
               <p>No qualifying data available for this driver</p>
               <p className="text-sm">Qualifying results are needed to show the flow diagram</p>
             </div>
           )}
         </CardContent>
       </Card>
    </div>
  );
}
