// app/admin/drivers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// Magic constant for “no team” so our SelectItem value is never empty
const NO_TEAM = "none";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // New driver form state
  const [driverName, setDriverName] = useState("");
  const [driverPoints, setDriverPoints] = useState("");
  const [driverTeamId, setDriverTeamId] = useState("");

  // Fetch drivers & teams on mount
  useEffect(() => {
    fetch("/api/drivers").then((r) => r.json()).then(setDrivers);
    fetch("/api/teams").then((r) => r.json()).then(setTeams);
  }, []);

  // Helpers for controlling team assignments
  function getAvailableTeamsForDriver(driver: any) {
    return teams.filter((team) => {
      const assignedCount = drivers.filter(
        (d) =>
          d._id !== driver._id &&
          (d.team?._id?.toString() === team._id.toString() || d.team === team._id)
      ).length;
      const isCurrent =
        driver.team?._id?.toString() === team._id.toString() ||
        driver.team === team._id;
      return isCurrent || assignedCount < 2;
    });
  }
  const availableTeamsForNewDriver = teams.filter((team) => {
    const count = drivers.filter(
      (d) =>
        (d.team?._id?.toString() === team._id.toString()) ||
        d.team === team._id
    ).length;
    return count < 2;
  });

  // CRUD operations
  async function addDriver(e?: React.FormEvent) {
    e?.preventDefault();
    if (!driverTeamId) {
      alert("Please select a team.");
      return;
    }
    await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: driverName,
        points: Number(driverPoints),
        teamId: driverTeamId,
      }),
    });
    setDriverName("");
    setDriverPoints("");
    setDriverTeamId("");
    const data = await fetch("/api/drivers").then((r) => r.json());
    setDrivers(data);
  }

  async function updateDriverTeam(driverId: string, newTeamId: string) {
    const teamId = newTeamId === NO_TEAM ? null : newTeamId;
    await fetch("/api/drivers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, teamId }),
    });
    const data = await fetch("/api/drivers").then((r) => r.json());
    setDrivers(data);
  }

  async function deleteDriver(driverId: string) {
    await fetch("/api/drivers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    const data = await fetch("/api/drivers").then((r) => r.json());
    setDrivers(data);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Drivers</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add Driver"}
        </Button>
      </div>

      {/* Add Driver Form */}
      {showForm && (
        <form
          onSubmit={addDriver}
          className="space-y-4 bg-white p-4 rounded-lg border"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="driver-name">Name</Label>
              <Input
                id="driver-name"
                placeholder="Driver Name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="starting-points">Starting Points</Label>
              <Input
                id="starting-points"
                type="number"
                placeholder="Starting Points"
                value={driverPoints}
                onChange={(e) => setDriverPoints(e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1">
              <Label htmlFor="team-select">Team</Label>
              <Select
                value={driverTeamId || NO_TEAM}
                onValueChange={(val) =>
                  setDriverTeamId(val === NO_TEAM ? "" : val)
                }
              >
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>Select Team</SelectItem>
                  {availableTeamsForNewDriver.map((team) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Add Driver</Button>
          </div>
        </form>
      )}

      {/* Drivers Table */}
      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drivers.map((driver) => {
              const currentTeamId =
                driver.team?._id?.toString() ??
                (typeof driver.team === "string" ? driver.team : NO_TEAM);
              const driverAvailableTeams = getAvailableTeamsForDriver(driver);

              return (
                <tr key={driver._id}>
                  <td className="px-6 py-4 whitespace-nowrap">{driver.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{driver.points}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Select
                      value={currentTeamId}
                      onValueChange={(val) =>
                        updateDriverTeam(driver._id, val)
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="No Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>No Team</SelectItem>
                        {driverAvailableTeams.map((team: any) => (
                          <SelectItem key={team._id} value={team._id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDriver(driver._id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
