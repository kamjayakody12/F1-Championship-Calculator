"use client";

import { useEffect, useMemo, useState } from "react";

export default function NextRaceTimer({
  targetMs,
  trackName,
  flagHtml,
}: {
  targetMs: number | null;
  trackName?: string;
  flagHtml?: string | null;
}) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = useMemo(() => {
    if (!targetMs) return null;
    return Math.max(0, targetMs - nowMs);
  }, [targetMs, nowMs]);

  const { days, hours } = useMemo(() => {
    if (diff == null) return { days: 0, hours: 0 };
    const totalSeconds = Math.floor(diff / 1000);
    const d = Math.floor(totalSeconds / (24 * 60 * 60));
    const remainingAfterDays = totalSeconds - d * 24 * 60 * 60;
    const h = Math.floor(remainingAfterDays / (60 * 60));
    const remainingAfterHours = remainingAfterDays - h * 60 * 60;
    const m = Math.floor(remainingAfterHours / 60);
    const s = remainingAfterHours - m * 60;
    return { days: d, hours: h, minutes: m, seconds: s };
  }, [diff]);

  const { minutes, seconds } = useMemo(() => {
    if (diff == null) return { minutes: 0, seconds: 0 };
    const totalSeconds = Math.floor(diff / 1000);
    const remainingAfterDays = totalSeconds % (24 * 60 * 60);
    const remainingAfterHours = remainingAfterDays % (60 * 60);
    const m = Math.floor(remainingAfterHours / 60);
    const s = remainingAfterHours - m * 60;
    return { minutes: m, seconds: s };
  }, [diff]);

  const timeText = targetMs
    ? diff === 0
      ? "Starting"
      : `${days}d ${hours}h ${minutes}m ${seconds}s`
    : "—";

  return (
    <div className="bg-card/60 border border-border rounded-3xl px-6 py-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl border border-transparent bg-transparent flex items-center justify-center overflow-hidden shadow-none">
        {flagHtml ? (
          <div
            className="w-full h-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: flagHtml }}
          />
        ) : (
          <div className="text-muted-foreground text-xs">—</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Next race
        </div>
        <div className="text-base font-semibold text-foreground truncate">
          {trackName || "TBD"}
        </div>
      </div>

      <div className="text-right">
        <div className="text-3xl font-bold text-foreground tabular-nums leading-none">
          {timeText}
        </div>
      </div>
    </div>
  );
}

