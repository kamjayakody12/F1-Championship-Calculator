// app/admin/drivers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const NO_TEAM = "no-team";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverTeamId, setDriverTeamId] = useState("");

  useEffect(() => {
    fetchDrivers();
    fetchTeams();
  }, []);

  async function fetchDrivers() {
    const res = await fetch("/api/drivers");
    if (res.ok) {
      const data = await res.json();
      setDrivers(data);
    } else {
      toast.error("Failed to fetch drivers");
    }
  }

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data);
    } else {
      toast.error("Failed to fetch teams");
    }
  }

  const availableTeamsForNewDriver = teams;

  async function addDriver(e?: React.FormEvent) {
    e?.preventDefault();
    if (!driverName.trim()) {
      toast.error("Please enter a driver name");
      return;
    }
    if (!driverTeamId) {
      toast.error("Please select a team.");
      return;
    }

    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: driverName,
        teamId: driverTeamId,
      }),
    });

    if (res.ok) {
      setDriverName("");
      setDriverTeamId("");
      fetchDrivers();
      toast.success("Driver added successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to add driver: " + errorMsg);
    }
  }

  async function updateDriverTeam(driverId: string, newTeamId: string) {
    const res = await fetch("/api/drivers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId,
        teamId: newTeamId,
      }),
    });

    if (res.ok) {
      fetchDrivers();
      toast.success("Driver team updated successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to update driver: " + errorMsg);
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
      toast.success("Driver deleted successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to delete driver: " + errorMsg);
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
                      <SelectItem key={team.id} value={team.id.toString()}>
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

              return (
                <tr
                  key={driver.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {driver.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {driver.points || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <Select
                      value={currentTeamId}
                      onValueChange={(newTeamId) =>
                        updateDriverTeam(
                          driver.id,
                          newTeamId === NO_TEAM ? "" : newTeamId
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>No Team</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
