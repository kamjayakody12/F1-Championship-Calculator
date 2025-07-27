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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Magic constant for “no team” so our SelectItem value is never empty
const NO_TEAM = "none";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

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
      if (!team || !team.id) return false;
      const assignedCount = drivers.filter(
        (d) =>
          d.id !== driver.id &&
          ((d.team && d.team.id && d.team.id.toString() === team.id.toString()) ||
           d.team === team.id)
      ).length;
      const isCurrent =
        (driver.team && driver.team.id && driver.team.id.toString() === team.id.toString()) ||
        driver.team === team.id;
      return isCurrent || assignedCount < 2;
    });
  }
  const availableTeamsForNewDriver = teams.filter((team) => {
    if (!team || !team.id) return false;
    const count = drivers.filter(
      (d) =>
        (d.team && d.team.id && d.team.id.toString() === team.id.toString()) ||
        d.team === team.id
    ).length;
    return count < 2;
  });

  // --- 1) ADD DRIVER ---
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

  // --- 2) EDIT DRIVER’S TEAM ---
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

  // --- 3) DELETE DRIVER ---
  async function deleteDriver(driverId: string) {
    console.log("Attempting to delete driver with id:", driverId); // Debug log
    const res = await fetch("/api/drivers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    if (res.ok) {
      const data = await fetch("/api/drivers").then((r) => r.json());
      setDrivers(data);
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      alert("Failed to delete driver: " + errorMsg);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Add-Driver Dialog */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Drivers
        </h1>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default">Add Driver</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
              <DialogDescription>
                Fill out the fields below to create a new driver.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addDriver} className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driver-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="driver-name"
                  className="col-span-3"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver Name"
                  required
                />
              </div>
              {/* Points */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="starting-points" className="text-right">
                  Starting Points
                </Label>
                <Input
                  id="starting-points"
                  type="number"
                  className="col-span-3"
                  value={driverPoints}
                  onChange={(e) => setDriverPoints(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              {/* Team */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="team-select" className="text-right">
                  Team
                </Label>
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
                    <SelectItem value={NO_TEAM} key={NO_TEAM}>Select Team</SelectItem>
                    {availableTeamsForNewDriver.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit">Add Driver</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Drivers Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {["Name", "Points", "Team", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {drivers.map((driver) => {
              const currentTeamId =
                driver.team?.id?.toString() ??
                (typeof driver.team === "string" ? driver.team : NO_TEAM);
              const driverAvailableTeams = getAvailableTeamsForDriver(driver);

              return (
                <tr
                  key={driver.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {driver.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {driver.points}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Select
                      value={currentTeamId}
                      onValueChange={(val) =>
                        updateDriverTeam(driver.id, val)
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="No Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM} key={NO_TEAM}>No Team</SelectItem>
                        {driverAvailableTeams.map((team: any) => (
                          <SelectItem key={team.id} value={team.id}>
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
                      onClick={() => deleteDriver(driver.id)}
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
