import { ChartConfig } from "@/components/ui/chart";
import { Track } from "../hooks/types";
import { brightenColor } from "../hooks/utils";

interface ProgressionTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  chartData: any[];
  tracks: Track[];
  chartConfig: ChartConfig;
  hoveredDriver: string | null;
}

export function ProgressionTooltip({
  active,
  payload,
  label,
  chartData,
  tracks,
  chartConfig,
  hoveredDriver,
}: ProgressionTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const raceData = chartData.find((d) => d.race === label);
  const raceName = raceData ? raceData.race : label;

  // Get track flag
  const trackName = (raceName as string).split(" (")[0];
  const track = tracks.find((t) => t.name === trackName);

  // Sort drivers by points at this race (descending)
  const sortedPayload = [...payload]
    .filter((p: any) => typeof p.value === "number")
    .sort((a: any, b: any) => b.value - a.value);

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg max-h-[400px] overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        {track?.img && (
          <div
            className="w-6 h-4 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: track.img }}
          />
        )}
        <p className="font-medium text-sm">{trackName}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Cumulative points</p>
      <div className="space-y-1">
        {sortedPayload.map((entry: any, index: number) => {
          const driverName = entry.dataKey as string;
          const color = chartConfig[driverName]?.color || entry.color;
          const isHovered = hoveredDriver === driverName;
          const brightColor = brightenColor(color);

          return (
            <div
              key={index}
              className="flex items-center justify-between gap-2 text-sm"
              style={{
                fontWeight: isHovered ? "bold" : "normal",
              }}
            >
              <span style={{ color: brightColor }}>{driverName}</span>
              <span style={{ color: brightColor }}>{entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
