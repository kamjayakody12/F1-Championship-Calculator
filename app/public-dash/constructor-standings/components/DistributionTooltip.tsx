import { ChartConfig } from '@/components/ui/chart';
import { Track } from '../hooks/types';

const brightenColor = (hslColor: string) => {
  const hslMatch = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!hslMatch) return hslColor;

  const [, h, s, l] = hslMatch.map(Number);
  return `hsl(${h}, ${Math.min(s + 10, 100)}%, ${Math.min(l + 18, 85)}%)`;
};

interface DistributionTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  tracks: Track[];
  chartConfig: ChartConfig;
  hoveredTeam: string | null;
}

export const DistributionTooltip = ({
  active,
  payload,
  label,
  tracks,
  chartConfig,
  hoveredTeam,
}: DistributionTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const trackName = label as string;
  const track = tracks.find((t) => t.name === trackName);

  if (hoveredTeam) {
    const entry = payload.find((p: any) => p.dataKey === hoveredTeam);
    if (!entry) return null;

    const teamName = entry.dataKey as string;
    const color = chartConfig[teamName]?.color || entry.color;
    const brightColor = brightenColor(color);

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
        <p className="text-xs text-muted-foreground mb-2">Points earned at this weekend</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{teamName}</span>
            <span className="ml-auto" style={{ color: brightColor }}>
              {entry.value} pts
            </span>
          </div>
        </div>
      </div>
    );
  }

  let totalPoints = 0;
  payload.forEach((entry: any) => {
    if (typeof entry.value === 'number') {
      totalPoints += entry.value;
    }
  });

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">Total points</p>
      <div className="flex items-center gap-2">
        {track?.img && (
          <div
            className="w-6 h-4 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: track.img }}
          />
        )}
        <p className="font-medium text-sm">{trackName}</p>
        <span className="ml-auto text-muted-foreground">{totalPoints} pts</span>
      </div>
    </div>
  );
};
