// app/page.tsx
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import Driver from "@/models/Driver";
import Team from "@/models/Team";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  // Connect to DB
  await connectToDatabase();

  // Fetch drivers and teams
  const drivers = await Driver.find({}).populate("team").lean();
  const teamsData = await Team.find({}).lean();

  // Calculate constructor points for each team
  const teams = await Promise.all(
    teamsData.map(async (team) => {
      const teamDrivers = await Driver.find({ team: team._id });
      const constructorPoints = teamDrivers.reduce(
        (sum, driver) => sum + driver.points,
        0
      );
      return { ...team, constructorPoints };
    })
  );

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold">F1 Esports Championship Standings</h1>
        <Link
          href="/login">
          <Button variant ="outline">Admin Login</Button>
        </Link>
      </header>

      <section>
        <h2 className="text-2xl font-semibold">Drivers</h2>
        <ul>
          {drivers.map((driver: any) => (
            <li key={driver._id}>
              <strong>{driver.name}</strong> -{" "}
              {driver.team ? driver.team.name : "No Team"} - {driver.points}{" "}
              points
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Constructors</h2>
        <ul>
          {teams.map((team: any) => (
            <li key={team._id}>
              <strong>{team.name}</strong> - {team.constructorPoints} points
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
