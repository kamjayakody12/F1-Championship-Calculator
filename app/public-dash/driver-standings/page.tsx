"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/data-table";
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

import { useDriverStandings } from "./hooks/useDriverStandings";
import { DriverRow } from "./hooks/types";
import { TEAM_COLOR_MAP } from "./hooks/constants";
import { ProgressionTooltip } from "./components/ProgressionTooltip";
import { DistributionTooltip } from "./components/DistributionTooltip";
import { RankingTooltip } from "./components/RankingTooltip";

export default function DriverStandingsPage() {
  // State management
  const [activeDriver, setActiveDriver] = useState<string>("all");
  const [hoveredDistributionDriver, setHoveredDistributionDriver] =
    useState<string | null>(null);
  const [hoveredProgressionDriver, setHoveredProgressionDriver] =
    useState<string | null>(null);
  const [hoveredRankingDriver, setHoveredRankingDriver] = useState<
    string | null
  >(null);

  // Fetch data
  const {
    drivers,
    chartData,
    rankingData,
    statsData,
    distributionData,
    tracks,
    loading,
  } = useDriverStandings();

  // Define table columns
  const columns: ColumnDef<DriverRow>[] = useMemo(
    () => [
      {
        accessorKey: "position",
        header: "POS",
        cell: ({ row }) => (
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-100">
            {row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "DRIVER",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "teamName",
        header: "TEAM",
        cell: ({ row }) => {
          const isRB = row.original.teamName === "RB";
          const isStakeF1 = row.original.teamName === "Stake F1 Team";
          const logoSize = isRB || isStakeF1 ? "w-10 h-10" : "w-8 h-8";

          return (
            <div className="flex items-center">
              {row.original.teamLogo ? (
                <img
                  src={row.original.teamLogo}
                  alt={`${row.original.teamName} logo`}
                  className={`${logoSize} object-contain bg-black/10 dark:bg-transparent rounded-lg p-1`}
                />
              ) : (
                <span
                  className={`inline-block ${logoSize} bg-gray-200 dark:bg-muted rounded-full flex-shrink-0`}
                />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "points",
        header: "POINTS",
        cell: ({ row }) => (
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {row.original.points}
          </span>
        ),
      },
    ],
    []
  );

  // Chart configuration
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      views: { label: "Driver Points" },
    };
    drivers.forEach((d) => {
      config[d.name] = {
        label: d.name,
        color: TEAM_COLOR_MAP[d.teamName] || "hsl(0, 0%, 70%)",
      };
    });
    return config;
  }, [drivers]);

  const statsChartConfig: ChartConfig = {
    wins: { label: "Wins", color: "hsl(45, 100%, 60%)" },
    podiums: { label: "Podiums", color: "hsl(210, 100%, 65%)" },
    pointsFinishes: {
      label: "Points finishes (4th-10th)",
      color: "hsl(145, 85%, 55%)",
    },
    poles: { label: "Pole positions", color: "hsl(285, 100%, 65%)" },
    dnfs: { label: "DNF/DSQ", color: "hsl(5, 100%, 60%)" },
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading driver standings...</div>
        </div>
      </div>
    );
  }

  // Render component
  return (
    <div className="p-3 sm:p-4 md:p-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Driver Standings Table */}
        <div className="xl:col-span-4">
          <DataTable columns={columns} data={drivers} />
        </div>

        {/* Charts Grid */}
        <div className="xl:col-span-8 grid grid-cols-1 gap-6">
          {/* Points Progression Chart */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="flex flex-col items-stretch !p-0 sm:flex-row">
              <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
                <CardTitle>Driver Points Progression</CardTitle>
                <CardDescription>
                  Points progression across all races in chronological order
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
                <ChartContainer
                  config={chartConfig}
                  className="w-full h-full overflow-visible"
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
                        const raceData = chartData.find(
                          (d) => d.race === payload.value
                        );
                        if (raceData) {
                          const trackName = (raceData.race as string).split(
                            " ("
                          )[0];
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
                              {raceData
                                ? `Round ${raceData.raceIndex + 1}`
                                : payload.value}
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
                          hoveredDriver={hoveredProgressionDriver}
                        />
                      )}
                    />
                    {drivers.map((d) => {
                      const isHovered = hoveredProgressionDriver === d.name;
                      const isOtherHovered =
                        hoveredProgressionDriver &&
                        hoveredProgressionDriver !== d.name;
                      const lineColor =
                        chartConfig[d.name]?.color || "hsl(0, 0%, 70%)";

                      return (
                        <Line
                          key={d.id}
                          dataKey={d.name}
                          type="monotone"
                          stroke={
                            activeDriver === "all" || activeDriver === d.name
                              ? lineColor
                              : "transparent"
                          }
                          strokeWidth={isHovered ? 4 : 2}
                          strokeOpacity={isOtherHovered ? 0.15 : 1}
                          dot={
                            activeDriver === "all" || activeDriver === d.name
                              ? {
                                  r: 4,
                                  strokeWidth: 2,
                                  stroke: lineColor,
                                  fill: lineColor,
                                  onMouseEnter: () =>
                                    setHoveredProgressionDriver(d.name),
                                  onMouseLeave: () =>
                                    setHoveredProgressionDriver(null),
                                  style: { cursor: "pointer" },
                                }
                              : false
                          }
                          activeDot={{
                            r: isHovered ? 8 : 4,
                            strokeWidth: 2,
                            stroke: lineColor,
                            fill: lineColor,
                            onMouseEnter: () =>
                              setHoveredProgressionDriver(d.name),
                            onMouseLeave: () =>
                              setHoveredProgressionDriver(null),
                          }}
                          hide={activeDriver !== "all" && activeDriver !== d.name}
                          onMouseEnter={() => setHoveredProgressionDriver(d.name)}
                          onMouseLeave={() => setHoveredProgressionDriver(null)}
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
      </div>

      {/* Bottom row: Points Distribution and Ranking Evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        {/* Points Distribution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Points Distribution</CardTitle>
            <CardDescription>
              Split of points earned by each driver per track (horizontal stacked
              bars)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4 overflow-auto">
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: Math.max(400, distributionData.length * 40) }}
              >
                <BarChart
                  accessibilityLayer
                  data={distributionData}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 6, bottom: 0 }}
                >
                  <CartesianGrid
                    horizontal={true}
                    vertical={false}
                    strokeDasharray="3 3"
                  />
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
                        hoveredDriver={hoveredDistributionDriver}
                      />
                    )}
                  />
                  {drivers.map((d) => (
                    <Bar
                      key={`dist-${d.id}`}
                      dataKey={d.name}
                      stackId="distribution"
                      radius={[0, 0, 0, 0]}
                      fill={chartConfig[d.name]?.color}
                      stroke="#000"
                      strokeWidth={1}
                      onMouseMove={() => setHoveredDistributionDriver(d.name)}
                      onMouseLeave={() => setHoveredDistributionDriver(null)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Driver Ranking Evolution Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Driver Ranking Evolution</CardTitle>
            <CardDescription>
              Position changes in the driver standings across rounds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="w-full h-full min-h-[450px] px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
              <ChartContainer
                config={chartConfig}
                className="w-full h-full overflow-visible"
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
                      const raceData = rankingData.find(
                        (d) => d.race === payload.value
                      );
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
                            {raceData
                              ? `Round ${raceData.raceIndex + 1}`
                              : payload.value}
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
                    domain={[1, drivers.length]}
                    ticks={Array.from({ length: drivers.length }, (_, i) => i + 1)}
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
                        hoveredDriver={hoveredRankingDriver}
                      />
                    )}
                  />
                  {drivers.map((d) => {
                    const isHovered = hoveredRankingDriver === d.name;
                    const isOtherHovered =
                      hoveredRankingDriver && hoveredRankingDriver !== d.name;
                    const lineColor =
                      chartConfig[d.name]?.color || "hsl(0, 0%, 70%)";

                    return (
                      <Line
                        key={d.id}
                        dataKey={d.name}
                        type="monotone"
                        stroke={
                          activeDriver === "all" || activeDriver === d.name
                            ? lineColor
                            : "transparent"
                        }
                        strokeWidth={isHovered ? 6 : activeDriver === d.name ? 3 : 2}
                        strokeOpacity={isOtherHovered ? 0.15 : 1}
                        dot={
                          activeDriver === "all" || activeDriver === d.name
                            ? {
                                r: 5,
                                strokeWidth: 2,
                                stroke: lineColor,
                                fill: lineColor,
                                onMouseEnter: () => setHoveredRankingDriver(d.name),
                                onMouseLeave: () => setHoveredRankingDriver(null),
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
                          onMouseEnter: () => setHoveredRankingDriver(d.name),
                          onMouseLeave: () => setHoveredRankingDriver(null),
                        }}
                        hide={activeDriver !== "all" && activeDriver !== d.name}
                        onMouseEnter={() => setHoveredRankingDriver(d.name)}
                        onMouseLeave={() => setHoveredRankingDriver(null)}
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
    </div>
  );
}
