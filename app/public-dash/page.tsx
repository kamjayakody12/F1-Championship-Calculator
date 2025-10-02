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

// Helper function to extract image URL from HTML string
  function extractImageUrl(htmlString: string): string {
  if (!htmlString) return '';
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : '';
}

export default async function HomePage() {
  // Fetch drivers and teams from Supabase
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

  if (driversError || teamsError) {
    return <div>Error loading data</div>;
  }

  // Calculate constructor points for each team
  const teams = (teamsData || []).map((team: any) => {
    const teamDrivers = (drivers || []).filter((driver: any) => driver.team === team.id);
    const constructorPoints = teamDrivers.reduce(
      (sum: number, driver: any) => sum + (driver.points || 0),
      0
    );
    return { ...team, constructorPoints };
  });

  // Sort drivers and teams by points descending
  const sortedDrivers = [...(drivers || [])].sort((a, b) => (b.points || 0) - (a.points || 0));
  const sortedTeams = [...teams].sort((a, b) => (b.constructorPoints || 0) - (a.constructorPoints || 0));

  // Calculate previous round standings for evolution comparison
  const calculatePreviousStandings = () => {
    if (!results || !schedules || !selectedTracks) return { prevDriverOrder: [], prevTeamOrder: [] };

    const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));
    const sortedSchedules = schedules.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Find all completed rounds
    const completedRounds = [];
    for (const schedule of sortedSchedules) {
      const selectedTrack = selectedTrackMap.get(schedule.track);
      const raceResults = results.filter((r: any) => r.track === selectedTrack?.id);
      if (raceResults.length > 0) {
        completedRounds.push({ schedule, selectedTrack, raceResults });
      }
    }

    // If we have less than 2 completed rounds, no evolution to show
    if (completedRounds.length < 2) {
      console.log(`Only ${completedRounds.length} completed rounds - showing blank evolution`);
      return { prevDriverOrder: [], prevTeamOrder: [] };
    }

    console.log(`${completedRounds.length} completed rounds - calculating evolution`);

    // Calculate standings after the previous round (excluding the latest round)
    const prevDriverPoints = new Map();
    const prevTeamPoints = new Map();

    // Initialize all drivers and teams with 0 points
    drivers.forEach((driver: any) => {
      prevDriverPoints.set(driver.id, 0);
    });
    teams.forEach((team: any) => {
      prevTeamPoints.set(team.id, 0);
    });

    // Add points from all rounds except the latest one
    for (let i = 0; i < completedRounds.length - 1; i++) {
      const round = completedRounds[i];
      round.raceResults.forEach((result: any) => {
        const currentDriverPoints = prevDriverPoints.get(result.driver) || 0;
        prevDriverPoints.set(result.driver, currentDriverPoints + (result.points || 0));
      });
    }

    // Calculate previous team standings based on driver points
    teams.forEach((team: any) => {
      const teamDrivers = drivers.filter((driver: any) => driver.team === team.id);
      const teamPoints = teamDrivers.reduce((sum: number, driver: any) => {
        return sum + (prevDriverPoints.get(driver.id) || 0);
      }, 0);
      prevTeamPoints.set(team.id, teamPoints);
    });

    // Create previous standings sorted by points
    const prevDriverStandings = drivers.map((driver: any) => ({
      id: driver.id,
      points: prevDriverPoints.get(driver.id) || 0
    })).sort((a, b) => b.points - a.points);

    const prevTeamStandings = teams.map((team: any) => ({
      id: team.id,
      points: prevTeamPoints.get(team.id) || 0
    })).sort((a, b) => b.points - a.points);

    return {
      prevDriverOrder: prevDriverStandings.map(d => d.id),
      prevTeamOrder: prevTeamStandings.map(t => t.id)
    };
  };

  const { prevDriverOrder, prevTeamOrder } = calculatePreviousStandings();

  // Debug logging
  console.log('Current driver order:', sortedDrivers.map(d => d.name));
  console.log('Previous driver order:', prevDriverOrder.length > 0 ? prevDriverOrder.map(id => drivers.find(d => d.id === id)?.name) : 'No previous data');
  console.log('Current team order:', sortedTeams.map(t => t.name));
  console.log('Previous team order:', prevTeamOrder.length > 0 ? prevTeamOrder.map(id => teams.find(t => t.id === id)?.name) : 'No previous data');

  function getEvolution(currentIndex: number, prevIndex: number | undefined) {
    // If no previous data (less than 2 rounds completed), show blank
    if (prevIndex === undefined) return { value: "—", color: "text-gray-400", icon: null };
    
    const diff = prevIndex - currentIndex;
    if (diff > 0) {
      return { value: `↑+${diff}`, color: "text-green-600", icon: <ArrowUp className="inline w-4 h-4" /> };
    }
    if (diff < 0) {
      return { value: `↓${diff}`, color: "text-red-600", icon: <ArrowDown className="inline w-4 h-4" /> };
    }
    return { value: "—", color: "text-gray-400", icon: null };
  }

  return (
    <div className="p-4 md:p-8">
      {/* <header className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">F1 Esports Championship Standings</h1>
        <Link href="/login">
          <Button variant="outline">Admin Login</Button>
        </Link>
      </header> */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Drivers Table */}
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
                  const prevIdx = prevDriverOrder.indexOf(driver.id);
                  const evo = getEvolution(idx, prevIdx);
                  return (
                    <TableRow key={driver.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                      <TableCell className="py-3 px-4 font-semibold text-foreground">{idx + 1}</TableCell>
                      <TableCell className="py-3 px-4 flex items-center gap-3">
                        {/* Team logo for driver */}
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
                      <TableCell className="py-3 px-4 font-bold text-foreground">{driver.points}</TableCell>
                      <TableCell className={`py-3 px-4 font-medium flex items-center gap-1 ${evo.color}`}>{evo.icon}{evo.value}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-center p-4">
              <Link href="/public-dash/driver-standings">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-1">
                  Full Standings
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Button>
              </Link>
            </div>
          </div>
        </section>
        {/* Constructors Table */}
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
                  const prevIdx = prevTeamOrder.indexOf(team.id);
                  const evo = getEvolution(idx, prevIdx);
                  return (
                    <TableRow key={team.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                      <TableCell className="py-4 px-6 font-semibold text-foreground">{idx + 1}</TableCell>
                      <TableCell className="py-4 px-6 flex items-center gap-3">
                        {/* Team logo */}
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
                      <TableCell className="py-4 px-6 font-bold text-foreground">{team.constructorPoints}</TableCell>
                      <TableCell className={`py-4 px-6 font-medium flex items-center gap-1 ${evo.color}`}>{evo.icon}{evo.value}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-center p-4">
              <Link href="/public-dash/constructor-standings">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-1">
                  Full Standings
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}