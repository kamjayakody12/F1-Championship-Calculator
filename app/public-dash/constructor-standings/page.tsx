"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";

import { useConstructorStandings } from "./hooks/useConstructorStandings";
import { Team } from "./hooks/types";
import { TEAM_COLOR_MAP, extractImageUrl, getTeamColorVariations } from "./hooks/constants";
import { ProgressionTooltip } from "./components/ProgressionTooltip";
import { DistributionTooltip } from "./components/DistributionTooltip";
import { RankingTooltip } from "./components/RankingTooltip";
import { useSearchParams } from "next/navigation";
import { usePublicSeasonId } from "@/hooks/use-public-season-id";

function ConstructorStandingsContent() {
  // State management
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [hoveredDistributionTeam, setHoveredDistributionTeam] = useState<string | null>(null);
  const [hoveredProgressionTeam, setHoveredProgressionTeam] = useState<string | null>(null);
  const [hoveredRankingTeam, setHoveredRankingTeam] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const seasonId = usePublicSeasonId() || undefined;

  // Fetch data
  const {
    teams,
    chartData,
    rankingData,
    statsData,
    distributionData,
    tracks,
    loading,
  } = useConstructorStandings(seasonId);

  // Deep-link support: /public-dash/constructor-standings?team=...
  useEffect(() => {
    const teamParam = searchParams.get("team");
    if (!teamParam) return;
    if (teamParam === "all") {
      setActiveTeam("all");
      return;
    }

    // Accept both team name and team id in URL param.
    const byId = teams.find((t) => t.id === teamParam);
    if (byId) {
      setActiveTeam(byId.name);
      return;
    }

    const byName = teams.find((t) => t.name === teamParam);
    setActiveTeam(byName ? byName.name : "all");
  }, [searchParams, teams]);

  // Handle row click
  const handleTeamClick = (teamName: string) => {
    setActiveTeam(activeTeam === teamName ? "all" : teamName);
  };

  // Chart configuration
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      views: { label: "Constructor Points" },
    };
    teams.forEach((team) => {
      config[team.name] = {
        label: team.name,
        color: TEAM_COLOR_MAP[team.name] || "hsl(0, 0%, 70%)",
      };
    });
    return config;
  }, [teams]);

  const statsChartConfig: ChartConfig = {
    wins: { label: "Wins", color: "hsl(45, 100%, 60%)" },
    podiums: { label: "Podiums", color: "hsl(210, 100%, 65%)" },
    pointsFinishes: {
      label: "Points finishes (1st-10th)",
      color: "hsl(145, 85%, 55%)",
    },
    poles: { label: "Pole positions", color: "hsl(285, 100%, 65%)" },
    dnfs: { label: "DNF/DSQ", color: "hsl(5, 100%, 60%)" },
  };

  const progressionHeight = Math.max(300, chartData.length * 56);
  const distributionHeight = Math.max(240, distributionData.length * 36 + 40);
  const rankingHeight = Math.max(300, rankingData.length * 56);

  const progressionTeams = useMemo(
    () =>
      teams.filter((team) =>
        chartData.some((row) => typeof row[team.name] === "number")
      ),
    [teams, chartData]
  );

  // Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-primary/20"></div>
          </div>
          <div className="text-lg font-medium text-muted-foreground">
            Loading constructor standings...
          </div>
          <div className="text-sm text-muted-foreground/60">Fetching championship data</div>
        </div>
      </div>
    );
  }

  // Render component
  return (
    <div className="p-3 sm:p-4 md:p-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Constructor Standings Table */}
        <div className="xl:col-span-4">
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 grid grid-cols-[56px_1fr_96px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/20">
              <div>POS</div>
              <div>CONSTRUCTOR</div>
              <div className="text-right">POINTS</div>
            </div>
            <div className="p-2 space-y-2">
              {teams.map((team: Team, idx: number) => {
                const colors = getTeamColorVariations(team.name === "Stake F1 Team" ? "Sauber" : team.name);
                const borderColor = colors.wins;
                const overlay = borderColor.replace("hsl(", "hsla(").replace(")", ", 0.20)");
                const logoSrc = extractImageUrl(team.logo || "");
                const isActive = activeTeam === team.name;

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleTeamClick(team.name)}
                    className={`w-full text-left px-4 py-3 rounded-xl border border-border bg-card/30 flex items-center gap-4 transition ${isActive ? "ring-2 ring-primary/40" : ""}`}
                    style={{
                      borderColor,
                      backgroundImage: `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0) 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                      backgroundSize: "auto, 12px 12px",
                      backgroundPosition: "center, 0 0",
                    }}
                  >
                    <div className="w-14 text-sm font-semibold text-foreground text-center">{idx + 1}</div>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-9 h-9 flex-shrink-0 overflow-hidden">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={`${team.name} logo`}
                            style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }}
                            className="rounded-lg p-1"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-muted/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground/70 truncate">
                          {(team.drivers || []).map((d) => d.name).join(" • ")}
                        </div>
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm font-bold text-foreground">{team.constructorPoints || 0}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Points Progression Chart */}
        <div className="xl:col-span-8">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Constructor Points Progression</CardTitle>
              <CardDescription>
                Points progression across all races in chronological order. Click on a team in the table to isolate their line.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No race data available yet
                  </div>
                ) : (
                  <ChartContainer
                    key={`constructor-prog-${chartData.length}`}
                    config={chartConfig}
                    className="w-full overflow-visible"
                    style={{ height: progressionHeight }}
                  >
                    <LineChart
                      accessibilityLayer
                      data={chartData}
                      margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="race"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={5}
                        height={36}
                        interval={0}
                        scale="point"
                        padding={{ left: 10, right: 10 }}
                        tick={(props) => {
                          const { x, y, payload } = props as any;
                          const raceData = chartData.find((d) => d.race === payload.value);
                          if (raceData) {
                            const trackName = (raceData.race as string).split(" (")[0];
                            const track = tracks.find((t) => t.name === trackName);

                            if (track?.img) {
                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <foreignObject x={-12} y={4} width={24} height={16}>
                                    <div
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                      }}
                                      dangerouslySetInnerHTML={{ __html: track.img }}
                                    />
                                  </foreignObject>
                                </g>
                              );
                            }

                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text
                                  x={0}
                                  y={0}
                                  dy={12}
                                  textAnchor="middle"
                                  fill="#666"
                                  fontSize={12}
                                >
                                  {`Round ${raceData.raceIndex + 1}`}
                                </text>
                              </g>
                            );
                          }
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={0}
                                y={0}
                                dy={12}
                                textAnchor="middle"
                                fill="#666"
                                fontSize={12}
                              >
                                {payload.value}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={{ fontSize: 12 }}
                        width={40}
                        domain={[0, "auto"]}
                      />
                      <ChartTooltip
                        cursor={true}
                        content={(props) => (
                          <ProgressionTooltip
                            {...props}
                            chartData={chartData}
                            tracks={tracks}
                            chartConfig={chartConfig}
                            hoveredTeam={hoveredProgressionTeam}
                          />
                        )}
                      />
                      {progressionTeams.map((team) => {
                        const isHovered = hoveredProgressionTeam === team.name;
                        const isOtherHovered =
                          hoveredProgressionTeam && hoveredProgressionTeam !== team.name;
                        const lineColor = chartConfig[team.name]?.color || "hsl(0, 0%, 70%)";
                        const isVisible = activeTeam === "all" || activeTeam === team.name;

                        return (
                          <Line
                            key={team.id}
                            dataKey={team.name}
                            type="monotone"
                            stroke={isVisible ? lineColor : "transparent"}
                            strokeWidth={isHovered ? 4 : activeTeam === team.name ? 3 : 2}
                            strokeOpacity={isOtherHovered ? 0.15 : 1}
                            connectNulls={true}
                            dot={
                              isVisible
                                ? {
                                    r: 4,
                                    strokeWidth: 2,
                                    stroke: lineColor,
                                    fill: lineColor,
                                    onMouseEnter: () => setHoveredProgressionTeam(team.name),
                                    onMouseLeave: () => setHoveredProgressionTeam(null),
                                    style: { cursor: "pointer" },
                                  }
                                : false
                            }
                            activeDot={{
                              r: isHovered ? 8 : 4,
                              strokeWidth: 2,
                              stroke: lineColor,
                              fill: lineColor,
                              onMouseEnter: () => setHoveredProgressionTeam(team.name),
                              onMouseLeave: () => setHoveredProgressionTeam(null),
                            }}
                            hide={!isVisible}
                            onMouseEnter={() => setHoveredProgressionTeam(team.name)}
                            onMouseLeave={() => setHoveredProgressionTeam(null)}
                            style={{ cursor: "pointer" }}
                          />
                        );
                      })}
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Points Distribution and Ranking Evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        {/* Points Distribution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Points Distribution</CardTitle>
            <CardDescription>
              Split of points earned by each team per track (horizontal stacked bars)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full flex flex-col px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
              <ChartContainer
                config={chartConfig}
                className="w-full flex-1 overflow-visible"
                style={{ minHeight: distributionHeight }}
              >
                <BarChart
                  accessibilityLayer
                  data={distributionData}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 6, bottom: 0 }}
                >
                  <CartesianGrid horizontal={true} vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    domain={[0, "auto"]}
                    allowDataOverflow
                    height={20}
                  />
                  <YAxis
                    type="category"
                    dataKey="trackNameOnly"
                    width={30}
                    tickLine={false}
                    axisLine={false}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const trackName = payload.value as string;
                      const track = tracks.find((t) => t.name === trackName);
                      if (track?.img) {
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <foreignObject x={-26} y={-10} width={24} height={16}>
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                                dangerouslySetInnerHTML={{ __html: track.img }}
                              />
                            </foreignObject>
                          </g>
                        );
                      }
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={4}
                            textAnchor="end"
                            fill="#666"
                            fontSize={12}
                          >
                            {trackName}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <ChartTooltip
                    content={(props) => (
                      <DistributionTooltip
                        {...props}
                        tracks={tracks}
                        chartConfig={chartConfig}
                        hoveredTeam={hoveredDistributionTeam}
                      />
                    )}
                  />
                  {teams.map((team) => (
                    <Bar
                      key={`dist-${team.id}`}
                      dataKey={team.name}
                      stackId="distribution"
                      radius={[0, 0, 0, 0]}
                      fill={chartConfig[team.name]?.color}
                      stroke="#000"
                      strokeWidth={1}
                      onMouseMove={() => setHoveredDistributionTeam(team.name)}
                      onMouseLeave={() => setHoveredDistributionTeam(null)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Constructor Ranking Evolution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Constructor Ranking Evolution</CardTitle>
            <CardDescription>
              Position changes in the constructor standings across rounds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
              <ChartContainer
                config={chartConfig}
                className="w-full h-full overflow-visible"
                style={{ height: rankingHeight }}
              >
                <LineChart
                  accessibilityLayer
                  data={rankingData}
                  margin={{ left: 5, right: 20, top: 15, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="race"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={5}
                    height={36}
                    interval={0}
                    scale="point"
                    padding={{ left: 10, right: 10 }}
                    tick={(props) => {
                      const { x, y, payload } = props as any;
                      const raceData = rankingData.find((d) => d.race === payload.value);
                      if (raceData) {
                        const trackName = (raceData.race as string).split(" (")[0];
                        const track = tracks.find((t) => t.name === trackName);
                        if (track?.img) {
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <foreignObject x={-15} y={4} width={30} height={20}>
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                  dangerouslySetInnerHTML={{ __html: track.img }}
                                />
                              </foreignObject>
                            </g>
                          );
                        }
                      }
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={12}
                            textAnchor="middle"
                            fill="#666"
                            fontSize={12}
                          >
                            {raceData ? `Round ${raceData.raceIndex + 1}` : payload.value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.toString()}
                    reversed={true}
                    domain={[1, teams.length]}
                    ticks={Array.from({ length: teams.length }, (_, i) => i + 1)}
                    tick={{ fontSize: 12 }}
                    width={30}
                  />
                  <ChartTooltip
                    cursor={true}
                    content={(props) => (
                      <RankingTooltip
                        {...props}
                        rankingData={rankingData}
                        tracks={tracks}
                        chartConfig={chartConfig}
                        hoveredTeam={hoveredRankingTeam}
                      />
                    )}
                  />
                  {teams.map((team) => {
                    const isHovered = hoveredRankingTeam === team.name;
                    const isOtherHovered =
                      hoveredRankingTeam && hoveredRankingTeam !== team.name;
                    const lineColor = chartConfig[team.name]?.color || "hsl(0, 0%, 70%)";

                    return (
                      <Line
                        key={team.id}
                        dataKey={team.name}
                        type="monotone"
                        stroke={
                          activeTeam === "all" || activeTeam === team.name
                            ? lineColor
                            : "transparent"
                        }
                        strokeWidth={isHovered ? 6 : activeTeam === team.name ? 3 : 2}
                        strokeOpacity={isOtherHovered ? 0.15 : 1}
                        dot={
                          activeTeam === "all" || activeTeam === team.name
                            ? {
                                r: 5,
                                strokeWidth: 2,
                                stroke: lineColor,
                                fill: lineColor,
                                onMouseEnter: () => setHoveredRankingTeam(team.name),
                                onMouseLeave: () => setHoveredRankingTeam(null),
                                style: { cursor: "pointer" },
                              }
                            : false
                        }
                        activeDot={{
                          r: isHovered ? 10 : 5,
                          strokeWidth: 2,
                          stroke: lineColor,
                          fill: lineColor,
                          fillOpacity: isHovered ? 0.4 : 1,
                          onMouseEnter: () => setHoveredRankingTeam(team.name),
                          onMouseLeave: () => setHoveredRankingTeam(null),
                        }}
                        hide={activeTeam !== "all" && activeTeam !== team.name}
                        onMouseEnter={() => setHoveredRankingTeam(team.name)}
                        onMouseLeave={() => setHoveredRankingTeam(null)}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </LineChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Bar Chart - Full Width */}
      <div className="mt-4 sm:mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
            <CardDescription>
              Wins (1st), podiums (1st-3rd), points finishes (1st-10th), pole positions, and
              DNFs by team
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:px-6 sm:pt-6 sm:pb-4">
            <ChartContainer config={statsChartConfig} className="w-full h-[600px]">
              <BarChart
                accessibilityLayer
                data={statsData}
                margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                barCategoryGap="15%"
                barGap={4}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="teamName"
                  tickLine={false}
                  tickMargin={12}
                  axisLine={false}
                  height={50}
                  interval={0}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const team = teams.find((t) => t.name === payload.value);
                    const logoUrl = team ? extractImageUrl(team.logo || "") : "";
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <foreignObject x={-15} y={-10} width={30} height={20}>
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={`${payload.value} logo`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  backgroundColor: "#ccc",
                                  borderRadius: "2px",
                                }}
                              />
                            )}
                          </div>
                        </foreignObject>
                      </g>
                    );
                  }}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length && label) {
                      const team = teams.find((t) => t.name === label);
                      const logoUrl = team ? extractImageUrl(team.logo || "") : "";
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <div className="flex items-center gap-2 mb-2">
                            {logoUrl && (
                              <img
                                src={logoUrl}
                                alt={`${label} team logo`}
                                className="w-5 h-5 object-contain bg-black/10 dark:bg-transparent rounded p-0.5"
                              />
                            )}
                            <p className="font-medium text-sm">{label}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">Season statistics</p>
                          <div className="space-y-1">
                            {[
                              { key: "pointsFinishes", label: "Points Finishes (1st-10th)" },
                              { key: "podiums", label: "Podiums (1st-3rd)" },
                              { key: "wins", label: "Wins (1st)" },
                              { key: "poles", label: "Poles" },
                              { key: "dnfs", label: "DNFs" },
                            ].map((stat, idx) => {
                              const entry = payload.find((p: any) => p.dataKey === stat.key);
                              const value = entry?.value || 0;
                              const colors = getTeamColorVariations(label);
                              const color = (colors as any)[stat.key] || "#999";
                              return (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  <span
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{stat.label}</span>
                                  <span className="ml-auto font-medium">{value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
                />
                {["pointsFinishes", "podiums", "wins", "poles", "dnfs"].map((stat) => (
                  <Bar
                    key={stat}
                    dataKey={stat}
                    radius={[4, 4, 0, 0]}
                    shape={(p: any) => {
                      const teamColors = getTeamColorVariations(p.payload?.teamName);
                      const { x, y, width, height, radius } = p;
                      const r = Array.isArray(radius) ? radius[0] : radius || 0;
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={r}
                          ry={r}
                          fill={(teamColors as any)[stat]}
                        />
                      );
                    }}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConstructorStandingsPage() {
  return (
    <Suspense fallback={<div className="p-3 sm:p-4 lg:p-5" />}>
      <ConstructorStandingsContent />
    </Suspense>
  );
}
