// app/admin/tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface Track {
  _id: string;
  name: string;
}
interface Schedule {
  trackId: string;
  date: string; // "YYYY-MM-DD"
}
interface TrackRow {
  trackId: string;
  name: string;
  date: string;
}

export default function ManageSchedulesPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rows, setRows] = useState<TrackRow[]>([]);

  // 1) load all 24 tracks
  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((data: Track[]) => setTracks(data));
  }, []);

  // 2) load existing schedules
  useEffect(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((data: Schedule[]) => setSchedules(data));
  }, []);

  // 3) whenever tracks or schedules change, merge into rows
  useEffect(() => {
    if (!tracks.length) return;
    const merged = tracks.map((t) => {
      const sch = schedules.find((s) => s.trackId === t._id);
      return {
        trackId: t._id,
        name: t.name,
        date: sch?.date ?? new Date().toISOString().slice(0, 10),
      };
    });
    setRows(merged);
  }, [tracks, schedules]);

  // 4) update one row’s date locally
  function handleDateChange(trackId: string, newDate: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.trackId === trackId ? { ...r, date: newDate } : r
      )
    );
  }

  // 5) save all rows back to schedules endpoint
  async function saveAll() {
    await Promise.all(
      rows.map((r) =>
        fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: r.trackId, date: r.date }),
        })
      )
    );
    alert("Schedule saved!");
    // refresh schedules from server
    const fresh = await fetch("/api/schedules").then((r) => r.json());
    setSchedules(fresh);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Track Schedule</h1>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Track</th>
            <th className="border p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.trackId}>
              <td className="border p-2">{r.name}</td>
              <td className="border p-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[180px] justify-start text-left"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(new Date(r.date), "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={new Date(r.date)}
                      onSelect={(d) => {
                        if (d) {
                          handleDateChange(
                            r.trackId,
                            d.toISOString().slice(0, 10)
                          );
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

      <Button className="mt-4" onClick={saveAll}>
        Save Schedule
      </Button>
    </div>
  );
}
