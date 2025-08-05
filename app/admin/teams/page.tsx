// app/admin/teams/page.tsx
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
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState("");

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data);
    } else {
      toast.error("Failed to fetch teams");
    }
  }

  useEffect(() => {
    fetchTeams();
  }, []);

  async function addTeam(e?: React.FormEvent) {
    e?.preventDefault();
    if (!teamName.trim()) {
      toast.error("Please enter a team name");
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
      toast.success("Team added successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to add team: " + errorMsg);
    }
  }

  async function deleteTeam(teamId: string) {
    console.log("Attempting to delete team with id:", teamId); // Debug log
    const res = await fetch("/api/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    if (res.ok) {
      fetchTeams();
      toast.success("Team deleted successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to delete team: " + errorMsg);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Add-Team Dialog */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Teams
        </h1>
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
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Team Name
              </th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {teams.map((team) => (
              <tr
                key={team.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {team.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTeam(team.id)}
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
