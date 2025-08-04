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
import { ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";

export default async function ConstructorStandingsPage() {
  // Fetch drivers and teams from Supabase
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*, teams(name)');
  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('*');

  if (driversError || teamsError) {
    return <div>Error loading data</div>;
  }

  // Calculate constructor points for each team
  const teams = (teamsData || []).map((team) => {
    const teamDrivers = (drivers || []).filter((driver) => driver.team === team.id);
    const constructorPoints = teamDrivers.reduce(
      (sum, driver) => sum + (driver.points || 0),
      0
    );
    return { ...team, constructorPoints, drivers: teamDrivers };
  });

  // Sort teams by points descending
  const sortedTeams = [...teams].sort((a, b) => (b.constructorPoints || 0) - (a.constructorPoints || 0));

  // MOCK: Previous order (for demo, shuffle the current order)
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

      <div className="bg-white dark:bg-card rounded-2xl shadow border border-gray-200 dark:border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Constructor</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Drivers</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</TableHead>
              <TableHead className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evolution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeams.map((team: any, idx: number) => {
              const prevIdx = prevTeamOrder.indexOf(team.id);
              const evo = getEvolution(idx, prevIdx);
              return (
                <TableRow key={team.id} className="border-b border-gray-100 dark:border-border last:border-0 hover:bg-gray-50 dark:hover:bg-muted/30 transition">
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">{idx + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {/* Placeholder for team logo */}
                      <span className="inline-block w-10 h-10 bg-gray-200 dark:bg-muted rounded-full flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">{team.name}</span>
                      </div>
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
                  <TableCell className={`py-4 px-6 font-medium ${evo.color}`}>
                    <div className="flex items-center gap-1">
                      {evo.icon}
                      <span className="font-semibold">{evo.value}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}