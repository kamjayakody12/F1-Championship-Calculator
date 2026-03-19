"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Season = {
  id: string;
  season_number: number;
};

export function PublicSeasonSelector() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedSeasonId = searchParams.get("seasonId") || "";

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/season-manager");
        const data = await res.json();
        if (Array.isArray(data)) {
          setSeasons(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const effectiveSeasonId = useMemo(() => {
    if (selectedSeasonId) return selectedSeasonId;
    return seasons[0]?.id || "";
  }, [selectedSeasonId, seasons]);

  function onChangeSeason(nextSeasonId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("seasonId", nextSeasonId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="px-2 py-2">
      <div className="mb-2 text-xs text-muted-foreground">Season</div>
      <Select
        value={effectiveSeasonId}
        onValueChange={onChangeSeason}
        disabled={loading || seasons.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading seasons..." : "Select season"} />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              Season {s.season_number}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
