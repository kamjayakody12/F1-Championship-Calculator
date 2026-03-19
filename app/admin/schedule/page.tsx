// app/admin/schedule/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface TrackRow {
  selectedTrackId: string;
  trackName: string;
  type: string;
  date: string; // "YYYY-MM-DD" or ""
}

export default function ManageSchedulesPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [isSavingSeason, setIsSavingSeason] = useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const seasonsRes = await fetch("/api/season-manager");
        const seasonsData = await seasonsRes.json();
        if (Array.isArray(seasonsData)) {
          setSeasons(seasonsData);
          if (!selectedSeasonId && seasonsData[0]?.id) {
            setSelectedSeasonId(seasonsData[0].id);
          }
        }

        if (!selectedSeasonId && !seasonsData?.[0]?.id) {
          setTracks([]);
          return;
        }

        // load only the tracks you've marked "selected"
        const selRes = await fetch(`/api/selected-tracks${selectedSeasonId ? `?seasonId=${encodeURIComponent(selectedSeasonId)}` : ""}`);
        const selected: { id: string; track: { name: string }; type: string }[] =
          await selRes.json();

        // load any existing schedules for those tracks
        const schedRes = await fetch(`/api/schedules${selectedSeasonId ? `?seasonId=${encodeURIComponent(selectedSeasonId)}` : ""}`);
        const schedulesResponse = await schedRes.json();
        
                 // Ensure schedules is an array
         const schedules: { track: string; date: string }[] = 
           Array.isArray(schedulesResponse) ? schedulesResponse : [];
        
        console.log('Schedules response:', schedulesResponse);
        console.log('Schedules array:', schedules);
        
                 const dateMap = new Map(schedules.map((s) => [s.track, s.date])); // Use s.track (which is selected_tracks.id)

        // merge into our table rows
        const rows: TrackRow[] = selected.map((s) => ({
          selectedTrackId: s.id,
          trackName: s.track.name,
          type: s.type,
          date: dateMap.get(s.id) || "",
        }));

        setTracks(rows);
      } catch (error) {
        console.error('Error loading schedule data:', error);
        toast.error('Failed to load schedule data');
      }
    }
    load();
  }, [selectedSeasonId]);

  function handleDateChange(selectedTrackId: string, newIso: string) {
    setTracks((prev) =>
      prev.map((t) => (t.selectedTrackId === selectedTrackId ? { ...t, date: newIso } : t))
    );
  }

  async function saveAll() {
    if (!selectedSeasonId) {
      toast.error("Please create/select a season first.");
      return;
    }
    // upsert each schedule
    await Promise.all(
      tracks.map((t) =>
        fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedTrack: t.selectedTrackId, date: t.date, seasonId: selectedSeasonId }),
        })
      )
    );
    toast.success("Schedule saved!");
  }

  async function addSeason() {
    const selectedSeason = seasons.find((s: any) => s.id === selectedSeasonId);
    const hasCurrentSeason = !!selectedSeason;
    const hasTracks = tracks.length > 0;
    const allDatesSet = tracks.every((t) => !!t.date);

    if (hasCurrentSeason && (!hasTracks || !allDatesSet)) {
      toast.error("Before adding a new season, make sure current season has tracks and all schedules are set.");
      return;
    }

    setIsCreatingSeason(true);
    try {
      const res = await fetch("/api/season-manager", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to create season");
        return;
      }

      const refreshedSeasons = await fetch("/api/season-manager").then((r) => r.json());
      if (Array.isArray(refreshedSeasons)) {
        setSeasons(refreshedSeasons);
      }
      if (data?.id) {
        setSelectedSeasonId(data.id);
        setTracks([]);
      }
      toast.success(`Season ${data?.season_number} created`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create season");
    } finally {
      setIsCreatingSeason(false);
    }
  }

  async function saveSeason(finalize: boolean = false) {
    if (!selectedSeasonId) {
      toast.error("Please select a season first.");
      return;
    }
    setIsSavingSeason(true);
    try {
      const res = await fetch("/api/season-manager", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: selectedSeasonId, finalize }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to save season");
        return;
      }
      toast.success(finalize ? "Season saved and finalized" : "Season saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save season");
    } finally {
      setIsSavingSeason(false);
    }
  }

  async function deleteSeason() {
    if (!selectedSeasonId) {
      toast.error("Please select a season to delete.");
      return;
    }
    setIsDeletingSeason(true);
    try {
      const res = await fetch("/api/season-manager", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: selectedSeasonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to delete season");
        return;
      }

      const refreshedSeasons = await fetch("/api/season-manager").then((r) => r.json());
      if (Array.isArray(refreshedSeasons)) {
        setSeasons(refreshedSeasons);
        setSelectedSeasonId(refreshedSeasons[0]?.id || "");
      }
      toast.success("Season deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete season");
    } finally {
      setIsDeletingSeason(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Manage Track Schedule
      </h1>
      <div className="flex items-center gap-3 flex-wrap max-w-5xl">
        <div className="w-64">
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  Season {s.season_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={addSeason} disabled={isCreatingSeason}>
          {isCreatingSeason ? "Creating..." : "Add Season"}
        </Button>
        <Button onClick={() => saveSeason(false)} disabled={isSavingSeason || !selectedSeasonId}>
          {isSavingSeason ? "Saving..." : "Save Season"}
        </Button>
        <Button onClick={() => saveSeason(true)} disabled={isSavingSeason || !selectedSeasonId}>
          {isSavingSeason ? "Finalizing..." : "Finalize Season"}
        </Button>
        <Button variant="destructive" onClick={deleteSeason} disabled={isDeletingSeason || !selectedSeasonId}>
          {isDeletingSeason ? "Deleting..." : "Delete Season"}
        </Button>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Track
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {tracks.map((t) => (
              <tr
                key={t.selectedTrackId}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {t.trackName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    t.type === 'Sprint' 
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' 
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  }`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {t.date
                          ? format(new Date(t.date), "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={t.date ? new Date(t.date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const iso = format(date, "yyyy-MM-dd");
                            handleDateChange(t.selectedTrackId, iso);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={saveAll}>Save Schedule</Button>
    </div>
  );
}
