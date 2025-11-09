import { ChartConfig } from '@/components/ui/chart';
import { Track } from '../hooks/types';

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
  chartConfig,
  hoveredTeam,
}: DistributionTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const entries = hoveredTeam
    ? payload.filter((p: any) => p.dataKey === hoveredTeam)
    : [payload.find((p: any) => typeof p.value === 'number' && p.value > 0) || payload[0]];

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-2">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">Points earned at this track</p>
      <div className="space-y-1">
        {entries.filter(Boolean).map((entry: any, idx: number) => {
          const name = entry.dataKey as string;
          const color = chartConfig[name]?.color || entry.color;
          return (
            <div key={`${name}-${idx}`} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span>{name}</span>
              <span className="ml-auto font-medium">{entry.value} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
