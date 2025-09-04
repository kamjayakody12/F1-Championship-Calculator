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

  // MOCK: Previous order (for demo, shuffle the current order)
  const prevDriverOrder = [...sortedDrivers].sort(() => Math.random() - 0.5).map(d => d.id);
  const prevTeamOrder = [...sortedTeams].sort(() => Math.random() - 0.5).map(t => t.id);

  function getEvolution(currentIndex: number, prevIndex: number | undefined) {
    if (prevIndex === undefined) return { value: "—", color: "text-gray-400", icon: null };
    const diff = prevIndex - currentIndex;
    if (diff > 0) {
      return { value: `+${diff}`, color: "text-green-600", icon: <ArrowUp className="inline w-4 h-4" /> };
    }
    if (diff < 0) {
      return { value: `${diff}`, color: "text-red-600", icon: <ArrowDown className="inline w-4 h-4" /> };
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
                        {extractImageUrl(driver.teams?.logo || '') ? (
                          <img 
                            src={extractImageUrl(driver.teams.logo)} 
                            alt={`${driver.teams?.name || 'Team'} logo`} 
                            className="w-7 h-7 object-contain flex-shrink-0 bg-black/10 dark:bg-transparent rounded-lg p-1" 
                          />
                        ) : (
                          <span className="inline-block w-7 h-7 bg-muted rounded-full flex-shrink-0" />
                        )}
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
                        {extractImageUrl(team.logo || '') ? (
                          <img 
                            src={extractImageUrl(team.logo)} 
                            alt={`${team.name} logo`} 
                            className="w-7 h-7 object-contain flex-shrink-0 bg-black/10 dark:bg-transparent rounded-lg p-1" 
                          />
                        ) : (
                          <span className="inline-block w-7 h-7 bg-muted rounded-full flex-shrink-0" />
                        )}
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