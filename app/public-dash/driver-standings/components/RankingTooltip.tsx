import { ChartConfig } from "@/components/ui/chart";
import { Track } from "../hooks/types";

interface RankingTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  rankingData: any[];
  tracks: Track[];
  chartConfig: ChartConfig;
  hoveredDriver: string | null;
}

export function RankingTooltip({
  active,
  payload,
  label,
  rankingData,
  tracks,
  chartConfig,
  hoveredDriver,
}: RankingTooltipProps) {
  if (!active || !payload || !payload.length || !hoveredDriver) return null;

  const raceData = rankingData.find((d) => d.race === label);
  const raceName = raceData ? raceData.race : label;

  // Only show the hovered driver
  const entry = payload.find((p: any) => p.dataKey === hoveredDriver);
  if (!entry) return null;

  const driverName = entry.dataKey as string;
  if (!driverName) return null;

  const color = chartConfig[driverName]?.color || entry.color;

  // Get track flag
  const trackName = (raceName as string).split(" (")[0];
  const track = tracks.find((t) => t.name === trackName);

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        {track?.img && (
          <div
            className="w-6 h-4 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: track.img }}
          />
        )}
        <p className="font-medium text-sm">{trackName}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Championship position</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium">{driverName}</span>
          <span className="ml-auto text-muted-foreground">P{entry.value}</span>
        </div>
      </div>
    </div>
  );
}
