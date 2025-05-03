// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import DataTable, { ResultRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AdminDashboardPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [results, setResults] = useState<ResultRow[]>([]);

  // 1️⃣ Load drivers
  useEffect(() => {
    fetch("/api/drivers")
      .then((r) => r.json())
      .then(setDrivers);
  }, []);

  // 2️⃣ ***NEW*** → Load only the tracks you chose
  useEffect(() => {
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { track: { name: string } }[]) =>
        setTracks(arr.map((s) => s.track.name))
      );
  }, []);

  // 3️⃣ Seed blank rows whenever drivers change
  useEffect(() => {
    setResults(
      Array.from({ length: drivers.length }, (_, i) => ({
        position: i + 1,
        driverId: "",
        pole: false,
        fastestLap: false,
      }))
    );
  }, [drivers]);

  function handleTrackChange(track: string) {
    setSelectedTrack(track);
    if (!track) return;
    fetch(`/api/results?track=${encodeURIComponent(track)}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (data.length) {
          setResults(
            data.map((row) => ({
              position: row.position,
              driverId: row.driver,
              pole: row.pole,
              fastestLap: row.fastestLap,
            }))
          );
        } else {
          // reset empty if none saved
          setResults(
            Array.from({ length: drivers.length }, (_, i) => ({
              position: i + 1,
              driverId: "",
              pole: false,
              fastestLap: false,
            }))
          );
        }
      });
  }

  // 5️⃣ Table callbacks (unchanged)…
  function updateDriver(pos: number, id: string) {
    setResults((prev) =>
      prev.map((r) => (r.position === pos ? { ...r, driverId: id } : r))
    );
  }
  function togglePole(pos: number) {
    setResults((prev) =>
      prev.map((r) => (r.position === pos ? { ...r, pole: !r.pole } : r))
    );
  }
  function toggleFastestLap(pos: number) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === pos ? { ...r, fastestLap: !r.fastestLap } : r
      )
    );
  }

  // 6️⃣ Submit results (unchanged)…
  async function submitResults() {
    if (!selectedTrack) {
      alert("Please select a track");
      return;
    }
    if (results.some((r) => !r.driverId)) {
      alert("Select a driver for every position");
      return;
    }
    await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: selectedTrack, results }),
    });
    alert("Results saved!");
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Race Results</h1>

      {/* Track selector now uses your saved list */}
      <div className="mb-4 max-w-sm">
        <label className="block mb-1 font-medium">Select Track</label>
        <Select
          value={selectedTrack}
          onValueChange={handleTrackChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="-- Select a Track --" />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results table + Save */}
      {selectedTrack && results.length > 0 && (
        <>
          <DataTable
            data={results}
            drivers={drivers}
            updateDriver={updateDriver}
            togglePole={togglePole}
            toggleFastestLap={toggleFastestLap}
          />
          <Button onClick={submitResults} className="mt-4">
            Save Results
          </Button>
        </>
      )}
    </div>
  );
}
