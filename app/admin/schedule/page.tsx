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
  _id: string;
  name: string;
  date: string; // "YYYY-MM-DD" or ""
}

export default function ManageSchedulesPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    async function load() {
      // 1️⃣ load only the tracks you’ve marked “selected”
      const selRes = await fetch("/api/selected-tracks");
      const selected: { track: { _id: string; name: string } }[] =
        await selRes.json();

      // 2️⃣ load any existing schedules for those tracks
      const schedRes = await fetch("/api/schedules");
      const schedules: { trackId: string; date: string }[] =
        await schedRes.json();
      const dateMap = new Map(schedules.map((s) => [s.trackId, s.date]));

      // 3️⃣ merge into our table rows
      const rows: TrackRow[] = selected.map((s) => ({
        _id: s.track._id,
        name: s.track.name,
        date: dateMap.get(s.track._id) || "",
      }));

      setTracks(rows);
    }
    load();
  }, []);

  function handleDateChange(id: string, newIso: string) {
    setTracks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, date: newIso } : t))
    );
  }

  async function saveAll() {
    // upsert each schedule
    await Promise.all(
      tracks.map((t) =>
        fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: t._id, date: t.date }),
        })
      )
    );
    alert("Schedule saved!");
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Manage Track Schedule</h1>

      <div className="overflow-x-auto bg-white rounded-lg border mb-6">
        <table className="min-w-full divide-y divide-gray-200 table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Track
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tracks.map((t) => (
              <tr
                key={t._id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {t.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
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
                            handleDateChange(t._id, iso);
                          }
                        }}
                        initialFocus
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
