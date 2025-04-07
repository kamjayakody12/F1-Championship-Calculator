"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// We assume each driver document has:
//   { _id, name, points, team } 
// and each team document has:
//   { _id, name }

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // For adding a new driver
  const [driverName, setDriverName] = useState("");
  const [driverPoints, setDriverPoints] = useState("");
  const [driverTeamId, setDriverTeamId] = useState("");

  // Fetch drivers
  async function fetchDrivers() {
    const res = await fetch("/api/drivers", { method: "GET" });
    const data = await res.json();
    setDrivers(data);
  }

  // Fetch teams
  async function fetchTeams() {
    const res = await fetch("/api/teams", { method: "GET" });
    const data = await res.json();
    setTeams(data);
  }

  useEffect(() => {
    fetchDrivers();
    fetchTeams();
  }, []);

  // --- 1) ADD DRIVER ---

  // Filter teams to only those with fewer than 2 drivers assigned
  // so we can't assign a new driver to a full team.
  const availableTeamsForNewDriver = teams.filter((team) => {
    const count = drivers.filter(
      (driver) => driver.team && driver.team.toString() === team._id.toString()
    ).length;
    return count < 2;
  });

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!driverTeamId) {
      alert("Please select a team.");
      return;
    }
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: driverName,
        points: Number(driverPoints),
        teamId: driverTeamId,
      }),
    });
    if (res.ok) {
      setDriverName("");
      setDriverPoints("");
      setDriverTeamId("");
      fetchDrivers();
    }
  }

  // --- 2) EDIT DRIVER’S TEAM ---

  // For each driver, we only show teams that:
  //   - Already have < 2 drivers assigned (excluding this driver),
  //     OR the driver is already on that team
  function getAvailableTeamsForDriver(driver: any) {
    return teams.filter((team) => {
      const assignedCount = drivers.filter(
        (d) => d._id !== driver._id && d.team?.toString() === team._id.toString()
      ).length;

      // Keep this team if it has fewer than 2 assigned drivers,
      // or if the driver is already on this team (so they can stay).
      if (driver.team?.toString() === team._id.toString()) {
        return true; 
      }
      return assignedCount < 2;
    });
  }

  // Also allow "No Team" if you want to unassign the driver
  // (remove them from any team).
  async function updateDriverTeam(driverId: string, newTeamId: string) {
    const res = await fetch("/api/drivers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, teamId: newTeamId || null }),
    });
    if (res.ok) {
      fetchDrivers();
    }
  }

  async function deleteDriver(driverId: string) {
    const res = await fetch("/api/drivers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    if (res.ok) {
      fetchDrivers();
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Manage Drivers</h1>

      {/* DRIVER LIST */}
      <ul>
        {drivers.map((driver) => {
          // Determine the driver's current team ID
          const currentTeamId = driver.team?._id || driver.team || "";

          // Build the list of teams the driver can switch to
          const driverAvailableTeams = getAvailableTeamsForDriver(driver);

          return (
            <li key={driver._id} className="flex flex-col gap-2 py-2 border-b">
              <div className="flex items-center justify-between">
                <span>
                  <strong>{driver.name}</strong> - {driver.points} points
                </span>
                <Button variant="outline" onClick={() => deleteDriver(driver._id)}>
                  Delete
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span>Team:</span>
                {/* "No Team" + driver-available teams in a dropdown */}
                <select
                  value={currentTeamId}
                  onChange={(e) => updateDriverTeam(driver._id, e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="">No Team</option>
                  {driverAvailableTeams.map((team: any) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ADD DRIVER FORM */}
      <form onSubmit={addDriver} className="mt-6 flex flex-col gap-2 w-64">
        <h3 className="text-xl">Add Driver</h3>
        <Input
          placeholder="Driver Name"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
        />
        <select
          value={driverTeamId}
          onChange={(e) => setDriverTeamId(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">Select Team</option>
          {availableTeamsForNewDriver.map((team) => (
            <option key={team._id} value={team._id}>
              {team.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Points"
          type="number"
          value={driverPoints}
          onChange={(e) => setDriverPoints(e.target.value)}
        />
        <Button type="submit">Add Driver</Button>
      </form>
    </div>
  );
}
