// app/admin/teams/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");

  // 1️⃣ Fetch teams
  async function fetchTeams() {
    const res = await fetch("/api/teams", { method: "GET" });
    const data = await res.json();
    setTeams(data);
  }

  useEffect(() => {
    fetchTeams();
  }, []);

  // 2️⃣ Add team
  async function addTeam(e?: React.FormEvent) {
    e?.preventDefault();
    if (!teamName.trim()) {
      alert("Please enter a team name.");
      return;
    }
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName }),
    });
    if (res.ok) {
      setTeamName("");
      fetchTeams();
    }
  }

  // 3️⃣ Delete team
  async function deleteTeam(teamId: string) {
    const res = await fetch("/api/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    if (res.ok) {
      fetchTeams();
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Add-Team Dialog Trigger */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Teams</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Add Team</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Team</DialogTitle>
              <DialogDescription>
                Enter a name for the new team.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addTeam} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="team-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="team-name"
                  className="col-span-3"
                  placeholder="Team Name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Add Team</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams Table */}
      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teams.map((team) => (
              <tr key={team._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {team.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTeam(team._id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
