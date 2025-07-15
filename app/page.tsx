// app/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/db";
import { Driver } from "@/models/Driver";
import { Team } from "@/models/Team";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
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
    return { ...team, constructorPoints };
  });

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold">F1 Esports Championship Standings</h1>
        <Link href="/login">
          <Button variant ="outline">Admin Login</Button>
        </Link>
      </header>

      <section>
        <h2 className="text-2xl font-semibold">Drivers</h2>
        <ul>
          {(drivers || []).map((driver: any) => (
            <li key={driver.id}>
              <strong>{driver.name}</strong> -{" "}
              {driver.teams ? driver.teams.name : "No Team"} - {driver.points}{" "}
              points
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Constructors</h2>
        <ul>
          {teams.map((team: any) => (
            <li key={team.id}>
              <strong>{team.name}</strong> - {team.constructorPoints} points
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
