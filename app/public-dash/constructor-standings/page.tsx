"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
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
import { ArrowLeft } from "lucide-react";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart } from "recharts";

interface Team {
  id: string;
  name: string;
  points: number;
  constructorPoints: number;
  drivers: Driver[];
  logo?: string;
}

interface Driver {
  id: string;
  name: string;
  points: number;
  team: string;
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

interface TeamStatsData {
  teamName: string;
  teamLogo: string;
  wins: number;
  podiums: number;
  pointsFinishes: number;
  poles: number;
  dnfs: number;
}

export default function ConstructorStandingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<TeamStatsData[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [tracks, setTracks] = useState<any[]>([]);

  // Helper function to extract image URL from HTML img tag
  const extractImageUrl = (htmlString: string): string => {
    if (!htmlString) return '';
    const srcMatch = htmlString.match(/src="([^"]+)"/);
    return srcMatch ? srcMatch[1] : '';
  };

  // Helper function to generate team color variations
  const getTeamColorVariations = (teamName: string) => {
    const baseColor = teamColorMap[teamName] || 'hsl(0, 0%, 50%)';
    
    // Parse HSL values
    const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!hslMatch) return {
      pointsFinishes: baseColor,
      podiums: baseColor,
      wins: baseColor,
      poles: baseColor,
      dnfs: baseColor
    };
    
    const [, h, s, l] = hslMatch.map(Number);
    
    // Create variations from lightest to darkest
    return {
      pointsFinishes: `hsl(${h}, ${Math.min(s + 20, 100)}%, ${Math.min(l + 30, 85)}%)`, // Lightest
      podiums: `hsl(${h}, ${s}%, ${Math.min(l + 15, 75)}%)`,
      wins: `hsl(${h}, ${s}%, ${l}%)`, // Base color
      poles: `hsl(${h}, ${Math.max(s - 10, 30)}%, ${Math.max(l - 15, 25)}%)`,
      dnfs: `hsl(${h}, ${Math.max(s - 20, 20)}%, ${Math.max(l - 30, 15)}%)` // Darkest
    };
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all necessary data
      const [
        { data: drivers },
        { data: teamsData },
        { data: results },
        { data: schedules },
        { data: tracks },
        { data: selectedTracks }
      ] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('results').select('*'),
        supabase.from('schedules').select('*'),
        supabase.from('tracks').select('*'),
                 supabase.from('selected_tracks').select('*, track(*)')
      ]);

       console.log('Raw data fetched:', {
         drivers: drivers?.length,
         teams: teamsData?.length,
         results: results?.length,
         schedules: schedules?.length,
         tracks: tracks?.length,
         selectedTracks: selectedTracks?.length
       });


      if (!drivers || !teamsData || !results || !schedules || !tracks || !selectedTracks) {
        throw new Error('Failed to fetch data');
      }

             // Create a map of track IDs to track names
       const trackMap = new Map(tracks.map(track => [track.id, track.name]));
       setTracks(tracks);
      
                     // Create a map of selected track IDs to selected track info
        const selectedTrackMap = new Map(selectedTracks.map(st => [st.id, st]));
        console.log('SelectedTrackMap entries:', Array.from(selectedTrackMap.entries()));
      
      // Create a map of driver IDs to driver info
      const driverMap = new Map(drivers.map(driver => [driver.id, driver]));

             // Create a map of team IDs to team info
       const teamMap = new Map(teamsData.map(team => [team.id, team]));

                     // Sort schedules by date to get race order
        const sortedSchedules = schedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        console.log('Sorted schedules:', sortedSchedules.map(s => {
          const selectedTrack = selectedTrackMap.get(s.track); 
          return {
            track: selectedTrack?.track?.name,
            date: s.date,
            selectedTrackId: s.track, 
            type: selectedTrack?.type
          };
        }));

               const raceResults: RaceResult[] = results.map(result => {
          const driver = driverMap.get(result.driver);
          const team = teamMap.get(driver?.team || ''); // Use driver's team since results.team doesn't exist yet
          const trackName = trackMap.get(result.track) || 'Unknown Track';
        
          // Find the schedule for this track to get the date
          const schedule = schedules.find(s => {
            const selectedTrack = selectedTrackMap.get(s.track); // Use s.track (which is selected_tracks.id)
            const matches = selectedTrack?.track?.id === result.track;
            if (matches) {
              console.log(`Found schedule for result track ${result.track}:`, {
                scheduleDate: s.date,
                selectedTrackId: s.track,
                trackName: selectedTrack?.track?.name
              });
            }
            return matches;
          });
        
        // Calculate points for this result
        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];
        
        let points = 0;
        if (result.racefinished) {
          const basePoints = result.position <= 10 ? racePointsMapping[result.position - 1] : 0;
          const bonusPoints = (result.pole ? 1 : 0) + (result.fastestlap ? 1 : 0);
          points = basePoints + bonusPoints;
        }

                 return {
           track: result.track,
           trackName,
           date: schedule?.date || '',
           position: result.position,
           driver: result.driver,
           driverName: driver?.name || 'Unknown',
                       teamId: driver?.team || '', // Use driver's team since results.team doesn't exist yet
           teamName: team?.name || 'Unknown',
           points,
           pole: result.pole || false,
           fastestlap: result.fastestlap || false,
           racefinished: result.racefinished !== false // Default to true if null/undefined
                  };
       });

       console.log('Race results processed:', raceResults.length);
       console.log('Sample race results:', raceResults.slice(0, 5));

       // Calculate team statistics
       const teamStats = new Map<string, TeamStatsData>();

       // Initialize team stats
       teamsData.forEach(team => {
         teamStats.set(team.id, {
           teamName: team.name,
           teamLogo: extractImageUrl(team.logo || ''),
           wins: 0,
           podiums: 0,
           pointsFinishes: 0,
           poles: 0,
           dnfs: 0
         });
       });

       // Process each result for team stats
       raceResults.forEach(result => {
         const stats = teamStats.get(result.teamId);
         if (!stats) return;

         // Count pole positions (separate from race results)
         if (result.pole) {
           stats.poles++;
         }

         // Count DNFs/DSQs
         if (!result.racefinished) {
           stats.dnfs++;
           return; // Don't count other stats for DNF
         }

         // For finished races only - count individual categories:
         // Count wins (1st position only)
         if (result.position === 1) {
           stats.wins++;
           console.log(`WIN recorded for ${stats.teamName}: driver ${result.driverName} position ${result.position}`);
         }
         // Count podiums (2nd and 3rd positions only - not including wins)
         else if (result.position === 2 || result.position === 3) {
           stats.podiums++;
           console.log(`PODIUM recorded for ${stats.teamName}: driver ${result.driverName} position ${result.position}`);
         }
         // Count points finishes (4th-10th positions only - not including wins or podiums)
         else if (result.position >= 4 && result.position <= 10) {
           stats.pointsFinishes++;
           console.log(`POINTS FINISH recorded for ${stats.teamName}: driver ${result.driverName} position ${result.position}`);
         }
       });

       // Convert to array and filter out teams with no data
       const statsArray = Array.from(teamStats.values())
         .filter(stats => stats.wins + stats.podiums + stats.pointsFinishes + stats.poles + stats.dnfs > 0)
         .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums); // Sort by wins, then podiums

       console.log('Individual team stats:', statsArray);
       
       // For stacked bar chart, we need to structure data so each segment shows only its value
       // The key is that Recharts will stack these values, so they represent individual segments
       const structuredStatsArray = statsArray.map(stats => ({
         ...stats,
         // Keep individual values - Recharts will handle the stacking visually
         pointsFinishes: stats.pointsFinishes, // 4th-10th only
         podiums: stats.podiums, // 2nd-3rd only  
         wins: stats.wins, // 1st only
         poles: stats.poles, // poles only
         dnfs: stats.dnfs // dnfs only
       }));
       
       console.log('Structured stats for chart:', structuredStatsArray);
       
       // Debug: Check for logical inconsistencies (using original statsArray for validation)
       statsArray.forEach(stats => {
         console.log(`${stats.teamName}: Wins=${stats.wins}, Podiums=${stats.podiums}, Points=${stats.pointsFinishes}, Poles=${stats.poles}, DNFs=${stats.dnfs}`);
       });
       
       setStatsData(structuredStatsArray);

       // Calculate cumulative points for each team across races
       const teamPointsProgression = new Map<string, { [raceIndex: number]: number }>();
       
       console.log('Processing races for progression...');
      
                     sortedSchedules.forEach((schedule, raceIndex) => {
          const selectedTrack = selectedTrackMap.get(schedule.track);
          console.log(`Processing schedule ${raceIndex + 1}:`, {
            scheduleTrack: schedule.track, 
            selectedTrackFound: !!selectedTrack,
            selectedTrackData: selectedTrack,
            trackId: selectedTrack?.track?.id,
            trackName: selectedTrack?.track?.name,
            type: selectedTrack?.type
          });
          
                     const raceResultsForTrack = raceResults.filter(r => r.track === selectedTrack?.id);
           console.log(`  - Race results for this track:`, raceResultsForTrack);
          console.log(`  - Filtering results: looking for track ${selectedTrack?.track?.id}, found ${raceResultsForTrack.length} results`);
          console.log(`  - Available result tracks:`, [...new Set(raceResults.map(r => r.track))]);
        
        console.log(`Race ${raceIndex + 1}: ${selectedTrack?.track?.name} (${schedule.date})`);
        console.log(`  - Results for this track: ${raceResultsForTrack.length}`);
        
        // Initialize team points for this race
        if (raceIndex === 0) {
          teamsData.forEach(team => {
            teamPointsProgression.set(team.id, {});
          });
        }

        // Calculate team points for this race
        const teamPointsThisRace = new Map<string, number>();
        raceResultsForTrack.forEach(result => {
          const currentPoints = teamPointsThisRace.get(result.teamId) || 0;
          teamPointsThisRace.set(result.teamId, currentPoints + result.points);
        });

        console.log(`  - Team points this race:`, Object.fromEntries(teamPointsThisRace));

                 // Update cumulative points
         teamsData.forEach(team => {
           const currentProgression = teamPointsProgression.get(team.id) || {};
           const previousPoints = raceIndex > 0 ? (currentProgression[raceIndex - 1] || 0) : 0;
           const pointsThisRace = teamPointsThisRace.get(team.id) || 0;
           currentProgression[raceIndex] = previousPoints + pointsThisRace;
           teamPointsProgression.set(team.id, currentProgression);
           
           console.log(`  - Team ${team.name}: previous=${previousPoints}, this race=${pointsThisRace}, cumulative=${currentProgression[raceIndex]}`);
         });
      });

                                                       // Create chart data - combine race and sprint for same track
         const chartDataArray: any[] = [];
         let completedRoundIndex = 0;
         
         // Group schedules by track to combine race and sprint
         const trackGroups = new Map<string, any[]>();
         const distributionRows: any[] = [];
         
         sortedSchedules.forEach((schedule, originalRaceIndex) => {
           const selectedTrack = selectedTrackMap.get(schedule.track);
           const trackId = selectedTrack?.track?.id;
           
           if (trackId) {
             if (!trackGroups.has(trackId)) {
               trackGroups.set(trackId, []);
             }
             trackGroups.get(trackId)!.push({
               schedule,
               originalRaceIndex,
               selectedTrack
             });
           }
         });
         
        // Process each track group
         trackGroups.forEach((schedules, trackId) => {
           // Check if any schedule for this track has results
           const hasResults = schedules.some(({ schedule }) => {
             const selectedTrack = selectedTrackMap.get(schedule.track);
             const raceResultsForTrack = raceResults.filter(r => r.track === selectedTrack?.id);
             return raceResultsForTrack.length > 0;
           });
           
          if (hasResults) {
             // Get the first schedule for this track (earliest date)
             const firstSchedule = schedules[0];
             const selectedTrack = firstSchedule.selectedTrack;
             
            // Calculate combined cumulative points for this track (for progression)
            const combinedPoints = new Map<string, number>();
            // Calculate raw event points for this track (for distribution)
            const rawPoints = new Map<string, number>();
             
            schedules.forEach(({ originalRaceIndex }) => {
               teamsData.forEach(team => {
                 const progression = teamPointsProgression.get(team.id);
                 const currentPoints = combinedPoints.get(team.id) || 0;
                 const pointsThisEvent = progression?.[originalRaceIndex] || 0;
                 combinedPoints.set(team.id, currentPoints + pointsThisEvent);
                // Raw points for this event only = cumulative at index - cumulative at previous index
                const prev = originalRaceIndex > 0 ? (progression?.[originalRaceIndex - 1] || 0) : 0;
                const eventPoints = (progression?.[originalRaceIndex] || 0) - prev;
                rawPoints.set(team.id, (rawPoints.get(team.id) || 0) + Math.max(0, eventPoints));
               });
             });
             
             const dataPoint: any = {
               race: `${selectedTrack?.track?.name || 'Unknown'} (${new Date(firstSchedule.schedule.date).toLocaleDateString()})`,
               raceIndex: completedRoundIndex,
               date: firstSchedule.schedule.date
             };
             
             teamsData.forEach(team => {
               dataPoint[team.name] = combinedPoints.get(team.id) || 0;
             });
             
             chartDataArray.push(dataPoint);

            // Build distribution row (horizontal stacked bars by team)
            const distRow: any = {
              race: `${selectedTrack?.track?.name || 'Unknown'} (${new Date(firstSchedule.schedule.date).toLocaleDateString()})`,
              trackNameOnly: selectedTrack?.track?.name || 'Unknown',
              selectedTrackId: selectedTrack?.id,
              date: firstSchedule.schedule.date
            };
            teamsData.forEach(team => {
              distRow[team.name] = rawPoints.get(team.id) || 0;
            });
            distributionRows.push(distRow);
             completedRoundIndex++;
           }
         });

                              console.log('Final chart data:', chartDataArray);

         console.log('Team progression summary:', Object.fromEntries(teamPointsProgression));

        setChartData(chartDataArray);
        // Save distribution data (sorted by date like chartData)
        setDistributionData(distributionRows);

        // Calculate ranking evolution data
        const rankingDataArray: any[] = [];
        
        chartDataArray.forEach((raceData, raceIndex) => {
          // Calculate standings for this race
          const raceStandings = teamsData.map(team => ({
            teamId: team.id,
            teamName: team.name,
            points: raceData[team.name] || 0
          })).sort((a, b) => b.points - a.points);
          
          // Create ranking data point
          const rankingPoint: any = {
            race: raceData.race,
            raceIndex: raceData.raceIndex,
            date: raceData.date
          };
          
          // Add position for each team
          raceStandings.forEach((standing, position) => {
            rankingPoint[standing.teamName] = position + 1; // Position 1, 2, 3, etc.
          });
          
          rankingDataArray.push(rankingPoint);
        });
        
        console.log('Ranking evolution data:', rankingDataArray);
        setRankingData(rankingDataArray);

       // Calculate current constructor points for each team
      const teamsWithPoints = teamsData.map((team) => {
        const teamDrivers = drivers.filter((driver) => driver.team === team.id);
    const constructorPoints = teamDrivers.reduce(
      (sum, driver) => sum + (driver.points || 0),
      0
    );
    return { ...team, constructorPoints, drivers: teamDrivers };
  });

  // Sort teams by points descending
        const sortedTeams = [...teamsWithPoints].sort((a, b) => (b.constructorPoints || 0) - (a.constructorPoints || 0));
        console.log('Setting teams state:', sortedTeams.length, 'teams');
        setTeams(sortedTeams);
       setLoading(false);

    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // Team color mapping
  const teamColorMap: { [key: string]: string } = {
    'Red Bull': 'hsl(220, 100%, 30%)',     // Red Bull - dark blue
    'Mercedes': 'hsl(180, 100%, 50%)',     // Mercedes - cyan
    'Mclaren': 'hsl(25, 100%, 50%)',      // McLaren - papaya orange
    'Ferrari': 'hsl(0, 100%, 50%)',       // Ferrari - red
    'Sauber': 'hsl(120, 100%, 40%)',      // Sauber - bright green
    'Aston Martin': 'hsl(120, 100%, 25%)', // Aston Martin - dark green
    'RB': 'hsl(230, 70%, 22%)',             // RB - deep navy
    'Haas': 'hsl(0, 0%, 50%)',            // Haas - grey
    'Alpine': 'hsl(300, 100%, 35%)',      // Alpine - dark pink
    'Williams': 'hsl(205, 90%, 50%)',    // Williams - vivid blue
  };

  // Create chart configuration with team-based colors
  const statsChartConfig: ChartConfig = {
    wins: {
      label: "Wins",
      color: "hsl(45, 100%, 60%)", // Default fallback
    },
    podiums: {
      label: "Podiums", 
      color: "hsl(210, 100%, 65%)", // Default fallback
    },
    pointsFinishes: {
      label: "Points finishes (4th-10th)",
      color: "hsl(145, 85%, 55%)", // Default fallback
    },
    poles: {
      label: "Pole positions",
      color: "hsl(285, 100%, 65%)", // Default fallback
    },
    dnfs: {
      label: "DNF/DSQ",
      color: "hsl(5, 100%, 60%)", // Default fallback
    },
  };

  const chartConfig = useMemo(() => {
    console.log('Creating chart config, teams state:', teams?.length || 0);
    const config: ChartConfig = {
      views: {
        label: "Constructor Points",
      },
    };

    // Only add team configurations if teams data is available
    if (teams && teams.length > 0) {
             // Fixed team-to-color mapping to ensure consistency regardless of standings position
        const teamColorMap: { [key: string]: string } = {
         'Red Bull': 'hsl(220, 100%, 30%)',     // Red Bull - dark blue
         'Mercedes': 'hsl(180, 100%, 50%)',     // Mercedes - cyan
         'Mclaren': 'hsl(25, 100%, 50%)',      // McLaren - papaya orange
         'Ferrari': 'hsl(0, 100%, 50%)',       // Ferrari - red
         'Sauber': 'hsl(120, 100%, 40%)',      // Sauber - bright green
         'Aston Martin': 'hsl(120, 100%, 25%)', // Aston Martin - dark green
          'RB': 'hsl(230, 70%, 22%)',             // RB - deep navy
         'Haas': 'hsl(0, 0%, 50%)',            // Haas - grey
         'Alpine': 'hsl(300, 100%, 35%)',      // Alpine - dark pink
          'Williams': 'hsl(205, 90%, 50%)',    // Williams - vivid blue
       };

      teams.forEach((team) => {
        config[team.name] = {
          label: team.name,
          color: teamColorMap[team.name] || 'hsl(0, 0%, 70%)', // Default color if team not found
        };
      });
    }

    console.log('Chart config:', config);
    return config;
  }, [teams]);

  const total = useMemo(() => {
    const totals: { [key: string]: number } = {};
    teams.forEach(team => {
      totals[team.name] = team.constructorPoints;
    });
    return totals;
  }, [teams]);

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading constructor standings...</div>
        </div>
      </div>
    );
  }

  // Evolution column removed

  return (
    <div className="p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Constructor Championship Standings</h1>
        </div>
      </header>

      {/* Dashboard Layout: Left table, right charts (2x2) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Constructor Standings Table (wider) */}
        <div className="xl:col-span-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow border border-gray-200 dark:border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Constructor</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Drivers</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                {teams.map((team: any, idx: number) => {
              return (
                <TableRow key={team.id} className="border-b border-gray-100 dark:border-border last:border-0 hover:bg-gray-50 dark:hover:bg-muted/30 transition">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">{idx + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {/* Team logo only */}
                      {(() => {
                        const logoUrl = extractImageUrl(team.logo || '');
                        const isRB = team.name === 'RB';
                        const isStakeF1 = team.name === 'Stake F1 Team';
                        const logoSize = (isRB || isStakeF1) ? 'w-14 h-14' : 'w-10 h-10';
                        const fallbackSize = (isRB || isStakeF1) ? 'w-14 h-14' : 'w-10 h-10';
                        return logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={`${team.name} logo`}
                            className={`${logoSize} object-contain`}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <span className={`inline-block ${fallbackSize} bg-gray-200 dark:bg-muted rounded-full flex-shrink-0`} />
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="space-y-1">
                      {team.drivers.map((driver: any) => (
                        <div key={driver.id} className="text-sm text-gray-600 dark:text-gray-300">
                          {driver.name} ({driver.points || 0} pts)
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{team.constructorPoints}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
          </div>
        </div>

        {/* Right: charts column (progression + stats) */}
        <div className="xl:col-span-8 grid grid-cols-1 gap-6">
          {/* Points Progression Chart */}
          <Card>
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
             <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
               <CardTitle>Constructor Points Progression</CardTitle>
               <CardDescription>
                 Points progression across all races in chronological order
               </CardDescription>
             </div>
             <div className="grid grid-cols-5 lg:grid-cols-10 gap-0">
               {teams.map((team) => {
                 const logoUrl = extractImageUrl(team.logo || '');
                 return (
                   <button
                     key={team.id}
                     data-active={activeTeam === team.name}
                     className="data-[active=true]:bg-muted/50 flex flex-col justify-center items-center gap-1 border-t border-r last:border-r-0 px-2 py-3 text-center sm:px-3 sm:py-4"
                     onClick={() => setActiveTeam(activeTeam === team.name ? "all" : team.name)}
                   >
                     <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10">
                       {logoUrl ? (
                         <img
                           src={logoUrl}
                           alt={`${team.name} logo`}
                           className="w-full h-full object-contain"
                           onError={(e) => {
                             e.currentTarget.style.display = 'none';
                             e.currentTarget.nextElementSibling?.classList.remove('hidden');
                           }}
                         />
                       ) : (
                         <span className="text-muted-foreground text-xs leading-tight hidden">
                           {team.name}
                         </span>
                       )}
                       <span className="text-muted-foreground text-xs leading-tight hidden">
                         {team.name}
                       </span>
                     </div>
                     <span className="text-sm leading-none font-bold sm:text-lg">
                       {total[team.name]?.toLocaleString() || 0}
                     </span>
                   </button>
                 );
               })}
             </div>
           </CardHeader>
            <CardContent className="p-2 sm:p-3">
             <ChartContainer
               config={chartConfig}
                className="w-full h-[520px]"
             >
               <LineChart
                 accessibilityLayer
                 data={chartData}
                 margin={{
                   left: 8,
                   right: 8,
                   top: 6,
                   bottom: 6,
                 }}
               >
                 <CartesianGrid vertical={false} />
                                <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                                         tickMargin={8}
                     minTickGap={10}
                     height={80}
                     interval={0}
                                                                             tick={(props) => {
                        const { x, y, payload } = props;
                        const raceData = chartData.find(d => d.race === payload.value);
                        if (raceData) {
                          // Find the track data to get the image
                          const trackName = raceData.race.split(' (')[0]; // Extract track name from "Track Name (date)"
                          const track = tracks.find(t => t.name === trackName);
                          
                                                   if (track?.img) {
                            return (
                              <g transform={`translate(${x},${y})`}>
                                                               <foreignObject 
                                   x={-12} 
                                   y={15} 
                                   width={24} 
                                   height={16}
                                 >
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
                       }
                       return (
                         <g transform={`translate(${x},${y})`}>
                           <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12}>
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
                 />
                                                              <ChartTooltip
                                        content={({ active, payload, label }) => {
                                           if (active && payload && payload.length) {
                        const raceData = chartData.find(d => d.race === label);
                        const raceName = raceData ? raceData.race : label;
                         
                         return (
                           <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                             <p className="font-medium text-sm mb-2">{raceName}</p>
                             <div className="space-y-1">
                               {payload.map((entry: any, index: number) => {
                                 const teamName = entry.dataKey;
                                  const teamColorMap: { [key: string]: string } = {
                                  'Red Bull': 'hsl(220, 100%, 30%)',     // Red Bull - dark blue
                                  'Mercedes': 'hsl(180, 100%, 50%)',     // Mercedes - cyan
                                  'Mclaren': 'hsl(25, 100%, 50%)',      // McLaren - papaya orange
                                  'Ferrari': 'hsl(0, 100%, 50%)',       // Ferrari - red
                                  'Sauber': 'hsl(120, 100%, 40%)',      // Sauber - bright green
                                  'Aston Martin': 'hsl(120, 100%, 25%)', // Aston Martin - dark green
                                   'RB': 'hsl(230, 70%, 22%)',             // RB - deep navy
                                  'Haas': 'hsl(0, 0%, 50%)',            // Haas - grey
                                  'Alpine': 'hsl(300, 100%, 35%)',      // Alpine - dark pink
                                   'Williams': 'hsl(205, 90%, 50%)',    // Williams - vivid blue
                                };
                                 const teamColor = teamColorMap[teamName] || 'hsl(0, 0%, 70%)';
                                 
                                 return (
                                   <div key={index} className="flex items-center gap-2 text-sm">
                                     <span 
                                       className="w-3 h-3 rounded-full" 
                                       style={{ backgroundColor: teamColor }}
                                     />
                                     <span className="font-medium">{teamName}</span>
                                     <span className="text-muted-foreground">{entry.value} points</span>
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
                 {teams.map((team) => (
                   <Line
                     key={team.id}
                     dataKey={team.name}
                     type="monotone"
                     stroke={activeTeam === "all" || activeTeam === team.name ? chartConfig[team.name]?.color : "transparent"}
                     strokeWidth={activeTeam === team.name ? 3 : 2}
                     dot={activeTeam === "all" || activeTeam === team.name}
                     hide={activeTeam !== "all" && activeTeam !== team.name}
                   />
                 ))}
               </LineChart>
             </ChartContainer>
           </CardContent>
          </Card>

          {/* Stats Bar Chart (moved to stand-alone) remains here; ranking evolution moved to bottom row */}

          {/* Stats Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
              <CardDescription>Wins (1st), podiums (2nd-3rd), points finishes (4th-10th), pole positions, and DNFs by team</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              <ChartContainer config={statsChartConfig} className="w-full h-[520px]">
                <BarChart 
                  accessibilityLayer 
                  data={statsData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 8,
                    bottom: 40,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="teamName"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    height={80}
                    interval={0}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const teamName = payload.value;
                      
                      // Find the team stats data to get the logo
                      const teamStats = statsData.find(stats => stats.teamName === teamName);
                      const logoUrl = teamStats?.teamLogo || '';
                      
                      if (!logoUrl) {
                        // Fallback to text if no logo
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="middle"
                              fill="#666"
                              fontSize="12"
                              transform="rotate(-45)"
                            >
                              {teamName}
                            </text>
                          </g>
                        );
                      }

                      // Special sizing for RB team logo
                      const isRB = teamName === 'RB';
                      const logoSize = isRB ? '48px' : '36px';
                      const containerSize = isRB ? '50px' : '40px';
                      const containerOffset = isRB ? -25 : -20;

                      return (
                        <g transform={`translate(${x},${y})`}>
                          <foreignObject
                            x={containerOffset}
                            y={10}
                            width={parseInt(containerSize)}
                            height={parseInt(containerSize)}
                          >
                            <div
                              style={{
                                width: containerSize,
                                height: containerSize,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <img
                                src={logoUrl}
                                alt={`${teamName} logo`}
                                style={{
                                  width: logoSize,
                                  height: logoSize,
                                  objectFit: 'contain'
                                }}
                                onError={(e) => {
                                  // Fallback to team abbreviation if image fails to load
                                  const target = e.target as HTMLElement;
                                  if (target.parentElement) {
                                    const fallbackSize = isRB ? '48px' : '36px';
                                    const fallbackFontSize = isRB ? '11px' : '9px';
                                    target.parentElement.innerHTML = `
                                      <div style="
                                        width: ${fallbackSize}; 
                                        height: ${fallbackSize}; 
                                        display: flex; 
                                        align-items: center; 
                                        justify-content: center; 
                                        font-size: ${fallbackFontSize}; 
                                        font-weight: bold; 
                                        color: #666;
                                        text-align: center;
                                        line-height: 1;
                                      ">
                                        ${teamName.substring(0, 3).toUpperCase()}
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            </div>
                          </foreignObject>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length && label) {
                        const teamStats = statsData.find(stats => stats.teamName === label);
                        const logoUrl = teamStats?.teamLogo || '';
                        const teamColors = getTeamColorVariations(label);
                        
                        console.log(`Bar chart tooltip for ${label}:`, {
                          payload,
                          teamStats,
                          statsData: statsData.find(stats => stats.teamName === label)
                        });
                        
                        // Define the correct order and labels
                        const statOrder = [
                          { key: 'pointsFinishes', label: 'Points Finishes (4th-10th)', color: teamColors.pointsFinishes },
                          { key: 'podiums', label: 'Podiums (2nd-3rd)', color: teamColors.podiums },
                          { key: 'wins', label: 'Wins (1st)', color: teamColors.wins },
                          { key: 'poles', label: 'Poles', color: teamColors.poles },
                          { key: 'dnfs', label: 'DNFs', color: teamColors.dnfs }
                        ];
                        
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                              {logoUrl && (
                                <img
                                  src={logoUrl}
                                  alt={`${label} logo`}
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                              <p className="font-medium text-sm">{label}</p>
                            </div>
                            <div className="space-y-1">
                              {statOrder.map((stat, index) => {
                                const payloadEntry = payload.find((p: any) => p.dataKey === stat.key);
                                const value = payloadEntry?.value || 0;
                                console.log(`${label} ${stat.label}: ${value} (from payload)`);
                                
                                return (
                                  <div key={index} className="flex items-center gap-2 text-sm">
                                    <span 
                                      className="w-3 h-3 rounded-sm" 
                                      style={{ backgroundColor: stat.color }}
                                    />
                                    <span>{stat.label}</span>
                                    <span className="font-medium ml-auto">{value}</span>
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
                  
                  {/* Multiple Bar Chart - Each statistic as separate grouped bars */}
                  
					{/* Points Finishes (4th-10th) */}
					<Bar
						dataKey="pointsFinishes"
						name="Points Finishes"
						radius={[2, 2, 0, 0]}
						shape={(props: any) => {
							const { x, y, width, height, radius, payload } = props;
							const teamName = payload?.teamName;
							const teamColors = getTeamColorVariations(teamName);
							const r = Array.isArray(radius) ? radius[0] : (radius || 0);
							return (
								<rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={teamColors.pointsFinishes} />
							);
						}}
					/>
                  
					{/* Podiums (2nd-3rd) */}
					<Bar
						dataKey="podiums"
						name="Podiums"
						radius={[2, 2, 0, 0]}
						shape={(props: any) => {
							const { x, y, width, height, radius, payload } = props;
							const teamName = payload?.teamName;
							const teamColors = getTeamColorVariations(teamName);
							const r = Array.isArray(radius) ? radius[0] : (radius || 0);
							return (
								<rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={teamColors.podiums} />
							);
						}}
					/>
                  
					{/* Wins (1st) */}
					<Bar
						dataKey="wins"
						name="Wins"
						radius={[2, 2, 0, 0]}
						shape={(props: any) => {
							const { x, y, width, height, radius, payload } = props;
							const teamName = payload?.teamName;
							const teamColors = getTeamColorVariations(teamName);
							const r = Array.isArray(radius) ? radius[0] : (radius || 0);
							return (
								<rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={teamColors.wins} />
							);
						}}
					/>
                  
					{/* Poles */}
					<Bar
						dataKey="poles"
						name="Poles"
						radius={[2, 2, 0, 0]}
						shape={(props: any) => {
							const { x, y, width, height, radius, payload } = props;
							const teamName = payload?.teamName;
							const teamColors = getTeamColorVariations(teamName);
							const r = Array.isArray(radius) ? radius[0] : (radius || 0);
							return (
								<rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={teamColors.poles} />
							);
						}}
					/>
                  
					{/* DNFs */}
					<Bar
						dataKey="dnfs"
						name="DNFs"
						radius={[2, 2, 0, 0]}
						shape={(props: any) => {
							const { x, y, width, height, radius, payload } = props;
							const teamName = payload?.teamName;
							const teamColors = getTeamColorVariations(teamName);
							const r = Array.isArray(radius) ? radius[0] : (radius || 0);
							return (
								<rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={teamColors.dnfs} />
							);
						}}
					/>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Evolution and Points Distribution side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Constructor Ranking Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Constructor Ranking Evolution</CardTitle>
            <CardDescription>
              Position changes in the constructor standings across rounds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            <ChartContainer config={chartConfig} className="w-full h-[520px]">
              <LineChart accessibilityLayer data={rankingData} margin={{ left: 8, right: 120, top: 6, bottom: 6 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="race"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={10}
                  height={80}
                  interval={0}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const raceData = rankingData.find((d) => d.race === payload.value);
                    if (raceData) {
                      const trackName = raceData.race.split(' (')[0];
                      const track = tracks.find((t) => t.name === trackName);
                      if (track?.img) {
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <foreignObject x={-15} y={15} width={30} height={20}>
                              <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: track.img }} />
                            </foreignObject>
                          </g>
                        );
                      }
                    }
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12}>
                          {raceData ? `Round ${raceData.raceIndex + 1}` : payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.toString()} reversed={true} domain={[1, teams.length]} />
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
                              const teamName = entry.dataKey;
                              const color = chartConfig[teamName]?.color || entry.color;
                              return (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="font-medium">{teamName}</span>
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
                {teams.map((team) => (
                  <Line
                    key={team.id}
                    dataKey={team.name}
                    type="monotone"
                    stroke={activeTeam === "all" || activeTeam === team.name ? chartConfig[team.name]?.color : "transparent"}
                    strokeWidth={activeTeam === team.name ? 3 : 2}
                    dot={activeTeam === "all" || activeTeam === team.name}
                    hide={activeTeam !== "all" && activeTeam !== team.name}
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

        {/* Points Distribution by Track (Horizontal Stacked Bars) */}
        <Card>
          <CardHeader>
            <CardTitle>Points Distribution</CardTitle>
            <CardDescription>
              Split of points earned by each team per track (horizontal stacked bars)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-1 sm:p-2">
            <ChartContainer
              config={chartConfig}
              className="w-full"
              style={{ height: Math.max(520, distributionData.length * 40) }}
            >
              <BarChart
                accessibilityLayer
                data={distributionData}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 6, bottom: 6 }}
              >
                <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} domain={[0, 'auto']} allowDataOverflow />
                <YAxis
                  type="category"
                  dataKey="trackNameOnly"
                  width={170}
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
                              style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
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
                    const entries = hoveredTeam
                      ? payload.filter((p: any) => p.dataKey === hoveredTeam)
                      : [payload.find((p: any) => typeof p.value === 'number' && p.value > 0) || payload[0]];
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-sm mb-2">{label}</p>
                        <div className="space-y-1">
                          {entries.filter(Boolean).map((entry: any, idx: number) => {
                            const teamName = entry.dataKey as string;
                            const color = chartConfig[teamName]?.color || entry.color;
                            return (
                              <div key={`${teamName}-${idx}`} className="flex items-center gap-2 text-sm">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                                <span>{teamName}</span>
                                <span className="ml-auto font-medium">{entry.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                {teams.map((team) => (
                  <Bar
                    key={`dist-${team.id}`}
                    dataKey={team.name}
                    stackId="distribution"
                    radius={[0, 0, 0, 0]}
                    fill={chartConfig[team.name]?.color}
                    onMouseMove={() => setHoveredTeam(team.name)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}