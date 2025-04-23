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

export default function ManageTracksPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((data) => {
        if (data.length) {
          // existing saved tracks—use their real _id
          setTracks(
            data.map((t: any) => ({
              _id: t._id,
              name: t.name,
              date: t.date.slice(0, 10),
            }))
          );
        } else {
          // no saved tracks yet—seed with track names as temporary IDs
          setTracks(
            TRACKS.map((name) => ({
              _id: name,          // unique temp ID
              name,
              date: new Date().toISOString().slice(0, 10),
            }))
          );
        }
      });
  }, []);
  

  function handleDateChange(id: string, newIsoDate: string) {
    setTracks(prev =>
        prev.map(t => t._id === id ? { ...t, date: newIsoDate } : t)
      );      
  }

  async function saveAll() {
    for (const t of tracks) {
      if (t._id) {
        await fetch("/api/tracks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t._id, date: t.date }),
        });
      } else {
        const res = await fetch("/api/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: t.name, date: t.date }),
        });
        const created = await res.json();
        t._id = created._id;
      }
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
            <tr key={t.name}>
              <td className="border p-2">{t.name}</td>
              <td className="border p-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {t.date
                        ? format(new Date(t.date), "PPP")
                        : <span className="text-muted-foreground">Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={t.date ? new Date(t.date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const iso = date.toISOString().slice(0, 10);
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
