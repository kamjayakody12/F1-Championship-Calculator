import { ChartConfig } from "@/components/ui/chart";
import { ChartDataPoint, Track } from "../hooks/types";

interface ProgressionTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  chartData: ChartDataPoint[];
  tracks: Track[];
  chartConfig: ChartConfig;
  hoveredTeam: string | null;
}

const brightenColor = (hslColor: string) => {
  const hslMatch = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!hslMatch) return hslColor;

  const [, h, s, l] = hslMatch.map(Number);
  return `hsl(${h}, ${Math.min(s + 10, 100)}%, ${Math.min(l + 18, 85)}%)`;
};

export const ProgressionTooltip = ({
  active,
  payload,
  label,
  chartData,
  tracks,
  chartConfig,
  hoveredTeam,
}: ProgressionTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const raceData = chartData.find((d) => d.race === label);
  const raceName = raceData ? raceData.race : label;
  const trackName = String(raceName || "").split(" (")[0];
  const track = tracks.find((t) => t.name === trackName);
  const eventType = String(raceName || "").includes(" - ")
    ? String(raceName)
        .split(" - ")
        .pop()
        ?.replace(")", "")
    : null;

  const numericEntries = payload.filter(
    (entry: any) => typeof entry.value === "number" && Number.isFinite(entry.value)
  );
  const entries = (hoveredTeam
    ? numericEntries.filter((entry: any) => entry.dataKey === hoveredTeam)
    : numericEntries
  ).sort((a: any, b: any) => b.value - a.value);

  if (!entries.length) return null;

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg max-h-[400px] overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        {track?.img && (
          <div
            className="w-6 h-4 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: track.img }}
          />
        )}
        <p className="font-medium text-sm">
          {trackName || raceName}
          {eventType ? ` - ${eventType}` : null}
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Constructor championship points</p>
      <div className="space-y-1">
        {entries.map((entry: any, index: number) => {
          const teamName = entry.dataKey as string;
          const color = (chartConfig[teamName]?.color as string) || entry.color || "hsl(0, 0%, 70%)";
          const textColor = brightenColor(color);
          const isHovered = hoveredTeam === teamName;

          return (
            <div
              key={index}
              className="flex items-center justify-between gap-2 text-sm"
              style={{ fontWeight: isHovered ? "bold" : "normal" }}
            >
              <span style={{ color: textColor }}>{teamName}</span>
              <span style={{ color: textColor }}>{entry.value} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
