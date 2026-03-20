"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractImageUrl, getTeamColorVariations } from "../constructor-standings/hooks/constants";
import { IconMedal, IconTarget, IconTrophy } from "@tabler/icons-react";

interface Team {
  id: string;
  name: string;
  logo?: string;
  carImage?: string;
}

interface TeamStats {
  wins: number;
  podiums: number;
  pointsFinishes: number;
  top5Finishes: number;
  dnfs: number;
  totalRaces: number;
  totalPoints: number;
  finishPositions: { [position: number]: number };
  finishPositionsByDriver: { [driverId: string]: { [position: number]: number } };
}

export default function ConstructorStatsPage() {
  const searchParams = useSearchParams();
  const teamParam = searchParams.get("team") || "";
  const seasonId = searchParams.get("seasonId") || "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any | null>(null);
  const [selectedTrackTypes, setSelectedTrackTypes] = useState<Record<string, string>>({});
  const [teamDriversForChart, setTeamDriversForChart] = useState<Array<{ id: string; name: string }>>([]);
  const [seasonRacingDriverCount, setSeasonRacingDriverCount] = useState<number>(20);

  useEffect(() => {
    (async () => {
      try {
        const [
          { data: teamsData },
          { data: drivers },
          { data: results },
          { data: seasonEntries },
          { data: rulesData },
          { data: selectedTracks },
        ] = await Promise.all([
          supabase.from("teams").select("*"),
          supabase.from("drivers").select("*"),
          (seasonId
            ? supabase.from("results").select("*").eq("season_id", seasonId)
            : supabase.from("results").select("*")),
          (seasonId
            ? supabase
                .from("season_driver_entries")
                .select("driver_id, team_id")
                .eq("season_id", seasonId)
            : Promise.resolve({ data: [] as any[] })),
          supabase
            .from("rules")
            .select("polegivespoint, fastestlapgivespoint")
            .eq("id", 1)
            .single(),
          (seasonId
            ? supabase.from("selected_tracks").select("id, type").eq("season_id", seasonId)
            : supabase.from("selected_tracks").select("id, type")),
        ]);
        let effectiveResults = results || [];
        if (seasonId && effectiveResults.length === 0) {
          const fallbackResults = await supabase.from("results").select("*");
          effectiveResults = fallbackResults.data || [];
        }

        const racingDriverCount = new Set(
          (effectiveResults || [])
            .map((r: any) => String(r.driver || ""))
            .filter(Boolean)
        ).size;
        setSeasonRacingDriverCount(Math.max(1, racingDriverCount));

        const teamsList: Team[] = (teamsData || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          logo: t.logo,
          carImage: t.carImage,
        }));
        setTeams(teamsList);

        const seasonTeamByDriverId = new Map<string, string | null>(
          ((seasonEntries as any[]) || []).map((e: any) => [String(e.driver_id), e.team_id || null])
        );

        // Default selection from param or first team with drivers
        const byName = teamsList.find((t) => t.name === teamParam);
        const firstWithDrivers = teamsList.find((t) =>
          (effectiveResults || []).some((r: any) => (r as any).team_id === t.id) ||
          (drivers || []).some((d: any) => {
            const resolvedTeamId = seasonId
              ? seasonTeamByDriverId.get(String(d.id))
              : d.team;
            return resolvedTeamId === t.id;
          })
        );
        setSelectedTeam((byName || firstWithDrivers || teamsList[0])?.id || "");
        setRules(rulesData || null);
        const trackTypeMap = ((selectedTracks || []) as any[]).reduce((acc, st: any) => {
          acc[String(st.id)] = st.type || "Race";
          return acc;
        }, {} as Record<string, string>);

        setSelectedTrackTypes(trackTypeMap);

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
        const [{ data: drivers }, { data: seasonEntries }, { data: results }] = await Promise.all([
          supabase.from("drivers").select("*"),
          (seasonId
            ? supabase
                .from("season_driver_entries")
                .select("driver_id, team_id")
                .eq("season_id", seasonId)
            : Promise.resolve({ data: [] as any[] })),
          (seasonId
            ? supabase.from("results").select("*").eq("season_id", seasonId)
            : supabase.from("results").select("*")),
        ]);
        let effectiveResults = results || [];
        if (seasonId && effectiveResults.length === 0) {
          const fallbackResults = await supabase.from("results").select("*");
          effectiveResults = fallbackResults.data || [];
        }

        const seasonTeamByDriverId = new Map<string, string | null>(
          ((seasonEntries as any[]) || []).map((e: any) => [String(e.driver_id), e.team_id || null])
        );
        const teamDriverIds = new Set(
          (drivers || [])
            .filter((d: any) => {
              const resolvedTeamId = seasonId
                ? seasonTeamByDriverId.get(String(d.id))
                : d.team;
              return resolvedTeamId === selectedTeam;
            })
            .map((d: any) => d.id)
        );
        const driverNameById = new Map((drivers || []).map((d: any) => [String(d.id), d.name || String(d.id)]));
        const teamDriversList = Array.from(teamDriverIds)
          .map((id) => ({ id: String(id), name: String(driverNameById.get(String(id)) || id) }))
          .slice(0, 2);
        setTeamDriversForChart(teamDriversList);
        const teamResults = (effectiveResults || []).filter(
          (r: any) => (r as any).team_id === selectedTeam || teamDriverIds.has(r.driver)
        );

        // Event-based aggregation:
        // - `totalRaces` counts distinct `track` events for the constructor
        // - `pointsFinishes` / `wins` / etc are based on the *best* finished position of any team driver in that event
        const byEvent = new Map<string, any[]>();
        for (const r of teamResults || []) {
          const eventId = String((r as any).track ?? "");
          if (!eventId) continue;
          const arr = byEvent.get(eventId) || [];
          arr.push(r);
          byEvent.set(eventId, arr);
        }

        const computed: TeamStats = {
          wins: 0,
          podiums: 0,
          pointsFinishes: 0,
          top5Finishes: 0,
          dnfs: 0,
          totalRaces: byEvent.size,
          totalPoints: 0,
          finishPositions: {},
          finishPositionsByDriver: {},
        };

        for (const [eventId, eventResults] of byEvent.entries()) {
          const finished = (eventResults || []).filter((r: any) => r.racefinished !== false);

          if (finished.length === 0) {
            computed.dnfs += 1;
            continue;
          }

          const eventType = selectedTrackTypes[eventId] || "Race";
          const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
          const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];
          const pointsMapping = eventType === "Sprint" ? sprintPointsMapping : racePointsMapping;
          const maxPositions = eventType === "Sprint" ? 8 : 10;

          const positions = finished
            .map((r: any) => {
              const raw = r.finishing_position ?? r.position;
              const num = typeof raw === "number" ? raw : Number(raw);
              return Number.isFinite(num) && num > 0 ? num : null;
            })
            .filter((p: number | null): p is number => p !== null);

          if (positions.length === 0) {
            computed.dnfs += 1;
            continue;
          }

          const bestPos = Math.min(...positions);

          if (bestPos === 1) computed.wins += 1;
          if (bestPos >= 1 && bestPos <= 3) computed.podiums += 1;
          if (bestPos >= 1 && bestPos <= 10) computed.pointsFinishes += 1;
          if (bestPos >= 1 && bestPos <= 5) computed.top5Finishes += 1;

          // Distribution should represent ALL team-driver finishes, not only the best finisher.
          finished.forEach((res: any) => {
            const posRaw = res.finishing_position ?? res.position;
            const pos = typeof posRaw === "number" ? posRaw : Number(posRaw);
            if (!Number.isFinite(pos) || pos <= 0) return;
            computed.finishPositions[pos] = (computed.finishPositions[pos] || 0) + 1;
            const dId = String(res.driver || "");
            if (!dId) return;
            if (!computed.finishPositionsByDriver[dId]) computed.finishPositionsByDriver[dId] = {};
            computed.finishPositionsByDriver[dId][pos] =
              (computed.finishPositionsByDriver[dId][pos] || 0) + 1;
          });

          // Total constructor points for the event (sum points earned by each finished team driver)
          for (const r of finished) {
            const posRaw = r.finishing_position ?? r.position;
            const posNum = typeof posRaw === "number" ? posRaw : Number(posRaw);

            const basePoints =
              Number.isFinite(posNum) && posNum > 0 && posNum <= maxPositions
                ? pointsMapping[posNum - 1] || 0
                : 0;

            const bonusPoints =
              (rules?.polegivespoint && r.pole ? 1 : 0) + (rules?.fastestlapgivespoint && r.fastestlap ? 1 : 0);

            computed.totalPoints += basePoints + bonusPoints;
          }
        }

        setStats(computed);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedTeam, seasonId, rules, selectedTrackTypes]);



  if (loading) {
    return <div className="p-4 md:p-8">Loading constructor stats...</div>;
  }

  const selectedTeamObj = teams.find((t) => t.id === selectedTeam);
  const selectedTeamName = selectedTeamObj?.name || "Constructor";
  const teamColors = getTeamColorVariations(selectedTeamName);

  // `teams.logo` is often stored as HTML; extract a usable `src` URL.
  const selectedTeamLogo = extractImageUrl(selectedTeamObj?.logo || "");

  const toAlphaHsl = (hsl: string, alpha: number) => {
    const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (!match) return hsl;
    const [, h, s, l] = match;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  };

  const setHslLightness = (hsl: string, lightness: number) => {
    const match = hsl.match(/hsl\(\s*(\d+),\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (!match) return hsl;
    const [, h, s] = match;
    return `hsl(${h}, ${s}%, ${lightness}%)`;
  };

  const makeTeamTileVars = (baseColor: string) => {
    const baseTop = setHslLightness(baseColor, 30);
    const overlay = toAlphaHsl(baseTop, 0.25);
    const corner = toAlphaHsl(setHslLightness(baseColor, 36), 0.28);
    const glow = toAlphaHsl(baseColor, 0.95);
    return { overlay, corner, glow };
  };

  const teamPrimary = teamColors.wins || "hsl(220, 100%, 50%)";
  const teamSecondary = teamColors.pointsFinishes || "hsl(25, 100%, 50%)";

  const pageGlowPrimary = toAlphaHsl(teamPrimary, 0.22);
  const pageGlowSecondary = toAlphaHsl(teamSecondary, 0.12);

  const vizBase = teamColors.podiums || teamPrimary;
  const { overlay: vizOverlay, corner: vizCorner, glow: vizGlow } = makeTeamTileVars(vizBase);

  const pointsIn = stats?.pointsFinishes || 0;
  const pointsOut = Math.max(0, (stats?.totalRaces || 0) - pointsIn);
  const totalRacesDone = stats?.totalRaces || 0;
  const pointsPercentage =
    stats && stats.totalRaces > 0
      ? Math.round((pointsIn / stats.totalRaces) * 100)
      : 0;

  const seasonPerformanceData = stats
    ? [
        {
          name: "Wins (P1)",
          value: stats.wins,
          color: teamColors.wins,
        },
        {
          name: "Podiums (P1-P3)",
          value: stats.podiums,
          color: teamColors.podiums,
        },
        {
          name: "Top 5 (P1-P5)",
          value: stats.top5Finishes ?? 0,
          color: teamColors.pointsFinishes,
        },
      ]
    : [];

  const pointsInPieData = [
    { name: "In Points", value: pointsIn, color: teamColors.pointsFinishes },
    { name: "Outside Points", value: pointsOut, color: "hsl(0, 0%, 60%)" },
  ];

  const finishPositionsData = Array.from({ length: seasonRacingDriverCount }, (_, i) => {
    const position = i + 1;
    const row: Record<string, string | number> = {
      position: `P${position}`,
    };
    teamDriversForChart.forEach((d) => {
      row[d.id] = stats?.finishPositionsByDriver?.[d.id]?.[position] || 0;
    });
    return row;
  });

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10"
        style={{
          background: `linear-gradient(to bottom, ${toAlphaHsl(teamPrimary, 0.14)} 0%, rgba(0,0,0,0) 20%),
                       radial-gradient(ellipse at 0% 0%, ${toAlphaHsl(teamPrimary, 0.2)} 0%, rgba(0,0,0,0) 42%),
                       radial-gradient(ellipse at 80% 20%, ${pageGlowPrimary} 0%, rgba(0,0,0,0) 60%),
                       radial-gradient(ellipse at 20% 85%, ${pageGlowSecondary} 0%, rgba(0,0,0,0) 55%)`,
        }}
      />

      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">Constructor Stats</div>
            <div className="text-sm text-muted-foreground">
              Explore results for the selected constructor
            </div>
          </div>

          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select Constructor" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 md:gap-4 items-stretch">
          {/* Left */}
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(() => {
                const base = teamColors.wins || teamPrimary;
                const { overlay, corner, glow } = makeTeamTileVars(base);
                return (
                  <Card
                    className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                    style={{
                      backgroundColor: "#070708",
                      backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                      backgroundPosition: "center, 0 0",
                      ["--driver-tile-glow" as any]: glow,
                      ["--driver-tile-glow-blur" as any]: "30px",
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                      style={{
                        background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                      }}
                    />
                    <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle
                            className="text-xl font-bold mb-1 driver-number-beam"
                            style={{ color: base }}
                          >
                            {stats?.wins || 0}
                          </CardTitle>
                          <CardDescription className="text-xs driver-name-beam">
                            Wins
                          </CardDescription>
                        </div>
                        <IconTrophy className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })()}

              {(() => {
                const base = teamColors.podiums || teamPrimary;
                const { overlay, corner, glow } = makeTeamTileVars(base);
                return (
                  <Card
                    className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                    style={{
                      backgroundColor: "#070708",
                      backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                      backgroundPosition: "center, 0 0",
                      ["--driver-tile-glow" as any]: glow,
                      ["--driver-tile-glow-blur" as any]: "30px",
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                      style={{
                        background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                      }}
                    />
                    <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle
                            className="text-xl font-bold mb-1 driver-number-beam"
                            style={{ color: base }}
                          >
                            {stats?.podiums || 0}
                          </CardTitle>
                          <CardDescription className="text-xs driver-name-beam">
                            Podiums
                          </CardDescription>
                        </div>
                        <IconMedal className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })()}

              {(() => {
                const base = teamColors.pointsFinishes || teamSecondary;
                const { overlay, corner, glow } = makeTeamTileVars(base);
                return (
                  <Card
                    className="min-h-[92px] py-0 gap-0 relative overflow-hidden driver-tile-beam-parent"
                    style={{
                      backgroundColor: "#070708",
                      backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                      backgroundPosition: "center, 0 0",
                      ["--driver-tile-glow" as any]: glow,
                      ["--driver-tile-glow-blur" as any]: "30px",
                    }}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
                      style={{
                        background: `radial-gradient(circle at 0% 0%, ${corner} 0%, rgba(0,0,0,0) 78%)`,
                      }}
                    />
                    <CardHeader className="relative z-[1] pt-4 pb-2 min-h-[72px] px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle
                            className="text-xl font-bold mb-1 driver-number-beam"
                            style={{ color: base }}
                          >
                            {stats?.totalPoints || 0}
                          </CardTitle>
                          <CardDescription className="text-xs driver-name-beam">
                            Points scored
                          </CardDescription>
                        </div>
                        <IconTarget className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    </CardHeader>
                  </Card>
                );
              })()}
            </div>

            {/* Pie tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
              <Card
                className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
                style={{
                  backgroundColor: "#070708",
                  backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                  backgroundSize: "auto, 12px 12px",
                  backgroundPosition: "center, 0 0",
                  ["--driver-tile-glow" as any]: vizGlow,
                  ["--driver-tile-glow-blur" as any]: "30px",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
                  style={{
                    background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
                  }}
                />
                <CardHeader className="relative z-[1] pt-4 pb-2">
                  <CardTitle>Season Performance</CardTitle>
                  <CardDescription>Distribution of race outcomes</CardDescription>
                </CardHeader>
                <CardContent className="relative z-[1]">
                  <div className="w-full h-[220px] sm:h-[240px] relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Pie
                          key={`season-performance-${selectedTeam}-${stats?.top5Finishes ?? 0}`}
                          data={seasonPerformanceData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                          strokeWidth={5}
                          isAnimationActive
                          animationDuration={800}
                        >
                          {seasonPerformanceData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                          <Label
                            content={({ viewBox }) => {
                              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                const cx = viewBox.cx ?? 0;
                                const cy = viewBox.cy ?? 0;
                                return (
                                  <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    <tspan
                                      x={cx}
                                      y={cy}
                                      className="fill-foreground text-2xl font-bold"
                                    >
                                      {totalRacesDone}
                                    </tspan>
                                    <tspan
                                      x={cx}
                                      y={cy + 20}
                                      className="fill-muted-foreground text-xs"
                                    >
                                      Total Races
                                    </tspan>
                                  </text>
                                );
                              }
                              return null;
                            }}
                          />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
                style={{
                  backgroundColor: "#070708",
                  backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                  backgroundSize: "auto, 12px 12px",
                  backgroundPosition: "center, 0 0",
                  ["--driver-tile-glow" as any]: vizGlow,
                  ["--driver-tile-glow-blur" as any]: "30px",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
                  style={{
                    background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
                  }}
                />
                <CardHeader className="relative z-[1] pt-4 pb-2">
                  <CardTitle>Finish in Points</CardTitle>
                  <CardDescription>Share of results in points vs outside points</CardDescription>
                </CardHeader>
                <CardContent className="relative z-[1]">
                  <div className="w-full h-[220px] sm:h-[240px] relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Pie
                          isAnimationActive
                          animationDuration={800}
                          key={`points-in-${selectedTeam}-${pointsIn}-${pointsOut}`}
                          data={pointsInPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                          strokeWidth={5}
                        >
                          {pointsInPieData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                          <Label
                            content={({ viewBox }) => {
                              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                const cx = viewBox.cx ?? 0;
                                const cy = viewBox.cy ?? 0;
                                return (
                                  <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    <tspan
                                      x={cx}
                                      y={cy}
                                      className="fill-foreground text-2xl font-bold"
                                    >
                                      {pointsPercentage}%
                                    </tspan>
                                    <tspan
                                      x={cx}
                                      y={cy + 20}
                                      className="fill-muted-foreground text-xs"
                                    >
                                      In Points
                                    </tspan>
                                  </text>
                                );
                              }
                              return null;
                            }}
                          />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: team car image + faded logo */}
          <div className="relative min-h-[220px] md:min-h-[240px] flex items-center justify-center">
            
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/25 to-transparent pointer-events-none"
            />

            {/* One big circle: team logo inside it */}
            <div
              className="relative z-[2] w-[220px] h-[220px] rounded-full overflow-hidden flex items-end justify-center pointer-events-none select-none"
              style={{
                border: `2px solid ${teamPrimary}`,
                backgroundColor: "transparent",
              }}
            >
              {selectedTeamLogo ? (
                <img
                  src={selectedTeamLogo}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain object-center opacity-95"
                  style={{
                    transform: "scale(1.05)",
                    transformOrigin: "center",
                    WebkitMaskImage:
                      "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 88%)",
                    maskImage:
                      "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 88%)",
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Finish Positions Distribution Bar Chart */}
        <Card
          className="mt-3 overflow-hidden driver-tile-beam-parent border-transparent bg-transparent py-0"
          style={{
            backgroundColor: "#070708",
            backgroundImage: `linear-gradient(to bottom right, ${vizOverlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "auto, 12px 12px",
            backgroundPosition: "center, 0 0",
            ["--driver-tile-glow" as any]: vizGlow,
            ["--driver-tile-glow-blur" as any]: "30px",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-[0]"
            style={{
              background: `radial-gradient(circle at 0% 0%, ${vizCorner} 0%, rgba(0,0,0,0) 78%)`,
            }}
          />
          <CardHeader className="relative z-[1] pt-4 pb-2">
            <CardTitle>Finish Positions Distribution</CardTitle>
            <CardDescription>Per-position finish contribution by each team driver</CardDescription>
          </CardHeader>
          <CardContent className="relative z-[1]">
            <div className="w-full h-[220px] sm:h-[250px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={`finish-positions-${selectedTeam}-${stats?.totalRaces || 0}`}
                  data={finishPositionsData}
                  margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="position"
                    tickMargin={8}
                    padding={{ left: 20, right: 20 }}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickMargin={8}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickCount={6}
                    domain={[0, "dataMax"]}
                  />
                  <Tooltip />
                  {teamDriversForChart.map((d, idx) => (
                    <Bar
                      key={`driver-finish-bar-${d.id}`}
                      dataKey={d.id}
                      name={d.name}
                      stackId="driverFinishes"
                      fill={idx === 0 ? teamColors.wins : teamColors.podiums}
                      isAnimationActive
                      animationDuration={800}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

