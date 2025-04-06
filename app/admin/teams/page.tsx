// app/admin/teams/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");

  // Fetch teams
  async function fetchTeams() {
    const res = await fetch("/api/teams", { method: "GET" });
    const data = await res.json();
    setTeams(data);
  }

  useEffect(() => {
    fetchTeams();
  }, []);

  // Add team
  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
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

  // Delete team
  async function deleteTeam(teamId: string) {
    const res = await fetch("/api/teams", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    if (res.ok) fetchTeams();
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Manage Teams</h1>
      <ul>
        {teams.map((team) => (
          <li key={team._id} className="flex items-center gap-4 py-2">
            <span>{team.name}</span>
            <Button variant="outline" onClick={() => deleteTeam(team._id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={addTeam} className="mt-6 flex flex-col gap-2 w-64">
        <Input
          placeholder="Team Name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <Button type="submit">Add Team</Button>
      </form>
    </div>
  );
}
