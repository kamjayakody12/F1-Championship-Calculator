"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useSearchParams } from "next/navigation";

interface Team {
  id: string;
  name: string;
  logo?: string;
}

interface TeamStats {
  wins: number;
  podiums: number;
  pointsFinishes: number;
  dnfs: number;
  totalRaces: number;
}

export default function ConstructorStatsPage() {
  const searchParams = useSearchParams();
  const teamParam = searchParams.get("team") || "";
  const seasonId = searchParams.get("seasonId") || "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: teamsData }, { data: drivers }, { data: results }] = await Promise.all([
          supabase.from("teams").select("*"),
          supabase.from("drivers").select("*"),
          (seasonId
            ? supabase.from("results").select("*").eq("season_id", seasonId)
            : supabase.from("results").select("*")),
        ]);
        let effectiveResults = results || [];
        if (seasonId && effectiveResults.length === 0) {
          const fallbackResults = await supabase.from("results").select("*");
          effectiveResults = fallbackResults.data || [];
        }

        const teamsList: Team[] = (teamsData || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          logo: t.logo,
        }));
        setTeams(teamsList);

        // Default selection from param or first team with drivers
        const byName = teamsList.find((t) => t.name === teamParam);
        const firstWithDrivers = teamsList.find((t) =>
          (effectiveResults || []).some((r: any) => (r as any).team_id === t.id) ||
          (drivers || []).some((d: any) => d.team === t.id)
        );
        setSelectedTeam((byName || firstWithDrivers || teamsList[0])?.id || "");

        // Precompute distribution per team (points per track)
        const teamResults = (effectiveResults || []).filter((r: any) =>
          (drivers || []).some((d: any) => d.id === r.driver)
        );

        const distMap = new Map<string, any[]>();
        for (const t of teamsList) distMap.set(t.id, []);

        (effectiveResults || []).forEach((r: any) => {
          const teamId = (r as any).team_id || (drivers || []).find((d: any) => d.id === r.driver)?.team;
          if (!teamId) return;
          const arr = distMap.get(teamId) || [];
          arr.push(r);
          distMap.set(teamId, arr);
        });

        const distRows = new Map<string, any[]>();
        distMap.forEach((resArr, teamId) => {
          const byTrack = new Map<string, number>();
          resArr.forEach((r: any) => {
            const pts = (r.position && r.position <= 10) ? [25,18,15,12,10,8,6,4,2,1][(r.position || 0) - 1] || 0 : 0;
            const sum = byTrack.get(r.track) || 0;
            byTrack.set(r.track, sum + (r.racefinished === false ? 0 : pts) + (r.pole ? 1 : 0) + (r.fastestlap ? 1 : 0));
          });
          const rows: any[] = [];
          byTrack.forEach((pts, track) => rows.push({ track, points: pts }));
          distRows.set(teamId, rows.sort((a, b) => b.points - a.points));
        });

        setDistribution(distRows.get((byName || firstWithDrivers || teamsList[0])?.id || "") || []);

        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();
  }, [seasonId, teamParam]);

  useEffect(() => {
    (async () => {
      if (!selectedTeam) return;
      try {
        const [{ data: drivers }, { data: results }] = await Promise.all([
          supabase.from("drivers").select("*").eq("team", selectedTeam),
          (seasonId
            ? supabase.from("results").select("*").eq("season_id", seasonId)
            : supabase.from("results").select("*")),
        ]);
        let effectiveResults = results || [];
        if (seasonId && effectiveResults.length === 0) {
          const fallbackResults = await supabase.from("results").select("*");
          effectiveResults = fallbackResults.data || [];
        }

        const teamDriverIds = new Set((drivers || []).map((d: any) => d.id));
        const teamResults = (effectiveResults || []).filter(
          (r: any) => (r as any).team_id === selectedTeam || teamDriverIds.has(r.driver)
        );

        const computed: TeamStats = {
          wins: 0,
          podiums: 0,
          pointsFinishes: 0,
          dnfs: 0,
          totalRaces: 0,
        };

        teamResults.forEach((r: any) => {
          computed.totalRaces += 1;
          if (r.racefinished === false) {
            computed.dnfs += 1;
            return;
          }
          const pos = r.finishing_position ?? r.position;
          if (pos === 1) computed.wins += 1;
          if (pos >= 1 && pos <= 3) computed.podiums += 1;
          if (pos >= 1 && pos <= 10) computed.pointsFinishes += 1;
        });

        setStats(computed);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedTeam, seasonId]);

  useEffect(() => {
    // When team selection changes, recompute distribution rows from server if needed
    (async () => {
      if (!selectedTeam) return;
      try {
        const [{ data: drivers }, { data: results }] = await Promise.all([
          supabase.from("drivers").select("*").eq("team", selectedTeam),
          (seasonId
            ? supabase.from("results").select("*").eq("season_id", seasonId)
            : supabase.from("results").select("*")),
        ]);
        let effectiveResults = results || [];
        if (seasonId && effectiveResults.length === 0) {
          const fallbackResults = await supabase.from("results").select("*");
          effectiveResults = fallbackResults.data || [];
        }
        const teamDriverIds = new Set((drivers || []).map((d: any) => d.id));
        const teamResults = (effectiveResults || []).filter(
          (r: any) => (r as any).team_id === selectedTeam || teamDriverIds.has(r.driver)
        );
        const byTrack = new Map<string, number>();
        teamResults.forEach((r: any) => {
          const pts = (r.position && r.position <= 10) ? [25,18,15,12,10,8,6,4,2,1][(r.position || 0) - 1] || 0 : 0;
          const sum = byTrack.get(r.track) || 0;
          byTrack.set(r.track, sum + (r.racefinished === false ? 0 : pts) + (r.pole ? 1 : 0) + (r.fastestlap ? 1 : 0));
        });
        const rows: any[] = [];
        byTrack.forEach((pts, track) => rows.push({ track, points: pts }));
        setDistribution(rows.sort((a, b) => b.points - a.points));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedTeam, seasonId]);

  const chartConfig: ChartConfig = useMemo(() => {
    return {
      points: { label: "Points", color: "hsl(210, 100%, 60%)" },
    };
  }, []);

  if (loading) {
    return <div className="p-4 md:p-8">Loading constructor stats...</div>;
  }

  const selectedTeamName = teams.find((t) => t.id === selectedTeam)?.name || "Constructor";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{selectedTeamName} - Summary</CardTitle>
          <CardDescription>Wins, podiums, points finishes and DNFs</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats ? (
            <>
              <div className="rounded-lg bg-card/60 border border-border p-4">
                <div className="text-xs text-muted-foreground">Wins</div>
                <div className="text-2xl font-bold">{stats.wins}</div>
              </div>
              <div className="rounded-lg bg-card/60 border border-border p-4">
                <div className="text-xs text-muted-foreground">Podiums</div>
                <div className="text-2xl font-bold">{stats.podiums}</div>
              </div>
              <div className="rounded-lg bg-card/60 border border-border p-4">
                <div className="text-xs text-muted-foreground">Points Finishes</div>
                <div className="text-2xl font-bold">{stats.pointsFinishes}</div>
              </div>
              <div className="rounded-lg bg-card/60 border border-border p-4">
                <div className="text-xs text-muted-foreground">DNFs</div>
                <div className="text-2xl font-bold">{stats.dnfs}</div>
              </div>
            </>
          ) : (
            <div>No stats.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points by Track</CardTitle>
          <CardDescription>Points earned per track (aggregated across drivers)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <BarChart width={800} height={360} data={distribution}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="track" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip />
              <Bar dataKey="points" fill="hsl(210, 100%, 60%)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

