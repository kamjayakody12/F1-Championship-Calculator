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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
    fetch("/api/drivers")
      .then((r) => r.json())
      .then(setDrivers);
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setTeams);
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

  async function updateDriverTeam(driverId: string, newTeamIdOrNone: string) {
    const teamId = newTeamIdOrNone === NO_TEAM ? null : newTeamIdOrNone;
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
    <div className="p-6">
      {/* Header and Add button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage Drivers</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add Driver"}
        </Button>
      </div>

      {/* Add Driver Form Card */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Driver</CardTitle>
            <CardDescription>Use the form below to add a new driver</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addDriver} className="grid w-full gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="driver-name">Driver Name</Label>
                <Input
                  id="driver-name"
                  placeholder="Driver Name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="team-select">Select Team</Label>
                <Select
                  value={driverTeamId || NO_TEAM}
                  onValueChange={(val) => setDriverTeamId(val === NO_TEAM ? "" : val)}
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
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="starting-points">Starting Points</Label>
                <Input
                  id="starting-points"
                  type="number"
                  placeholder="Starting Points"
                  value={driverPoints}
                  onChange={(e) => setDriverPoints(e.target.value)}
                />
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={() => addDriver()}>Add Driver</Button>
          </CardFooter>
        </Card>
      )}

      {/* DRIVER LIST */}
      <div className="space-y-4">
        {drivers.map((driver) => {
          const currentTeamId =
            driver.team?._id?.toString() ??
            (typeof driver.team === "string" ? driver.team : NO_TEAM);
          const driverAvailableTeams = getAvailableTeamsForDriver(driver);

          return (
            <Card key={driver._id}>
              <CardHeader>
                <CardTitle>
                  <strong>{driver.name}</strong> — {driver.points} pts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span>Team:</span>
                  <Select
                    value={currentTeamId}
                    onValueChange={(val) => updateDriverTeam(driver._id, val)}
                  >
                    <SelectTrigger>
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
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => deleteDriver(driver._id)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
