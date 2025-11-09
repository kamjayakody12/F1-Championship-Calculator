import { ChartConfig } from '@/components/ui/chart';
import { ChartDataPoint, Track } from '../hooks/types';

interface ProgressionTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  chartData: ChartDataPoint[];
  tracks: Track[];
  chartConfig: ChartConfig;
  hoveredTeam: string | null;
}

export const ProgressionTooltip = ({
  active,
  payload,
  label,
  chartData,
  chartConfig,
  hoveredTeam,
}: ProgressionTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const raceData = chartData.find((d) => d.race === label);
  const raceName = raceData ? raceData.race : label;

  const entries = hoveredTeam
    ? payload.filter((p: any) => p.dataKey === hoveredTeam)
    : payload.filter((p: any) => typeof p.value === 'number' && p.value > 0);

  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm mb-2">{raceName}</p>
      <p className="text-xs text-muted-foreground mb-2">Constructor championship points</p>
      <div className="space-y-1">
        {entries.map((entry: any, index: number) => {
          const teamName = entry.dataKey;
          const color = chartConfig[teamName]?.color || entry.color;
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-medium">{teamName}</span>
              <span className="ml-auto font-medium">{entry.value} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
