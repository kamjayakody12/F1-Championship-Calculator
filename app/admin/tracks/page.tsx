"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TRACKS } from "@/lib/tracks";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface TrackRow {
  _id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function ManageTracksPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (data.length) {
          setTracks(
            data.map((t) => ({
              _id: t._id,
              name: t.name,
              date: t.date.slice(0, 10),
            }))
          );
        } else {
          setTracks(
            TRACKS.map((name) => ({
              _id: name,
              name,
              date: new Date().toISOString().slice(0, 10),
            }))
          );
        }
      })
      .catch(() => {
        setTracks(
          TRACKS.map((name) => ({
            _id: name,
            name,
            date: new Date().toISOString().slice(0, 10),
          }))
        );
      });
  }, []);

  function handleDateChange(id: string, newIsoDate: string) {
    setTracks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, date: newIsoDate } : t))
    );
  }

  async function saveAll() {
    // Loop through each track row
    for (const t of tracks) {
      await fetch("/api/tracks", {
        method: "POST",                // ← POST, not PUT
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: t._id,                   // existing _id or temp name
          name: t.name,                // only used if creating
          date: t.date,                
        }),
      });
    }
    alert("Schedule saved!");
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
          {tracks.map((t) => (
            <tr key={t._id}>
              <td className="border p-2">{t.name}</td>
              <td className="border p-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {t.date
                        ? format(parseLocalDate(t.date), "PPP")
                        : <span className="text-muted-foreground">Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={t.date ? parseLocalDate(t.date) : undefined}
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
      <Button className="mt-4" onClick={saveAll}>
        Save Schedule
      </Button>
    </div>
  );
}
