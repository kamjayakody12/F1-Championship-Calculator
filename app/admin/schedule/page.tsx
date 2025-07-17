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

interface TrackRow {
  trackId: string;
  name: string;
  date: string; // "YYYY-MM-DD" or ""
}

export default function ManageSchedulesPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    async function load() {
      // load only the tracks you’ve marked “selected”
      const selRes = await fetch("/api/selected-tracks");
      const selected: { track: { id: string; name: string } }[] =
        await selRes.json();

      // load any existing schedules for those tracks
      const schedRes = await fetch("/api/schedules");
      const schedules: { trackId: string; date: string }[] =
        await schedRes.json();
      const dateMap = new Map(schedules.map((s) => [s.trackId, s.date]));

      // merge into our table rows
      const rows: TrackRow[] = selected.map((s) => ({
        trackId: s.track.id,
        name: s.track.name,
        date: dateMap.get(s.track.id) || "",
      }));

      setTracks(rows);
    }
    load();
  }, []);

  function handleDateChange(trackId: string, newIso: string) {
    setTracks((prev) =>
      prev.map((t) => (t.trackId === trackId ? { ...t, date: newIso } : t))
    );
  }

  async function saveAll() {
    // upsert each schedule
    await Promise.all(
      tracks.map((t) =>
        fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track: t.trackId, date: t.date }),
        })
      )
    );
    alert("Schedule saved!");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Manage Track Schedule
      </h1>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Track
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {tracks.map((t) => (
              <tr
                key={t.trackId}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {t.name}
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
                            handleDateChange(t.trackId, iso);
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
