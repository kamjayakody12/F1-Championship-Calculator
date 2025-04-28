// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import DataTable, { ResultRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";

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

  // 2️⃣ Load track names
  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((arr: { name: string }[]) =>
        setTracks(arr.map((t) => t.name))
      );
  }, []);

  // 3️⃣ Seed empty results whenever driver list changes
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

  // 4️⃣ When the user picks a round, fetch saved results (or reset)
  function handleTrackChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const track = e.target.value;
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

  // 5️⃣ Table callbacks
  function updateDriver(pos: number, id: string) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === pos ? { ...r, driverId: id } : r
      )
    );
  }
  function togglePole(pos: number) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === pos ? { ...r, pole: !r.pole } : r
      )
    );
  }
  function toggleFastestLap(pos: number) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === pos
          ? { ...r, fastestLap: !r.fastestLap }
          : r
      )
    );
  }

  // 6️⃣ Submit back to your API
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

      {/* —───────── Track selector */}
      <div className="mb-4 max-w-sm">
        <label className="block mb-1 font-medium">Select Track</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={selectedTrack}
          onChange={handleTrackChange}
        >
          <option value="">-- Select a Track --</option>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* —───────── Results table + Save */}
      {selectedTrack && results.length > 0 && (
        <>
          <DataTable
            data={results}
            drivers={drivers}
            updateDriver={updateDriver}
            togglePole={togglePole}
            toggleFastestLap={toggleFastestLap}
          />
          <Button
            onClick={submitResults}
            className="mt-4 bg-blue-600 text-white"
          >
            Save Results
          </Button>
        </>
      )}
    </div>
  );
}
