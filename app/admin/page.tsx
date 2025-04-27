"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import DataTable, { ResultRow } from "@/components/ui/data-table"; 
// We no longer import TRACKS here; we’ll fetch them from /api/tracks

export default function AdminDashboard() {
  // === State ===
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);    // list of track **names** from DB
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [results, setResults] = useState<ResultRow[]>([]);

  // === 1) Load drivers for your Results dropdowns ===
  async function fetchDrivers() {
    const res = await fetch("/api/drivers");
    const data = await res.json();
    setDrivers(data);
  }
  useEffect(() => {
    fetchDrivers();
  }, []);

  // === 2) Load tracks (round names) from MongoDB via /api/tracks ===
  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    const data: { _id: string; name: string }[] = await res.json();
    // We only need the `name` field for your dropdown value
    setTracks(data.map((t) => t.name));
  }
  useEffect(() => {
    fetchTracks();
  }, []);

  // === 3) When drivers change (or on first load), seed results rows ===
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

  // === 4) Handle track selection ===
  function handleTrackChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const track = e.target.value;
    setSelectedTrack(track);
    if (!track) return;

    // Fetch existing results for that round
    fetch(`/api/results?track=${encodeURIComponent(track)}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (data.length) {
          // Map back into our ResultRow shape
          setResults(
            data.map((row) => ({
              position: row.position,
              driverId: row.driver,
              pole: row.pole,
              fastestLap: row.fastestLap,
            }))
          );
        } else {
          // No saved results → re-seed empty rows
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

  // === 5) Callbacks for DataTable meta props ===
  function updateDriver(position: number, newDriverId: string) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === position ? { ...r, driverId: newDriverId } : r
      )
    );
  }
  function togglePole(position: number) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === position ? { ...r, pole: !r.pole } : r
      )
    );
  }
  function toggleFastestLap(position: number) {
    setResults((prev) =>
      prev.map((r) =>
        r.position === position
          ? { ...r, fastestLap: !r.fastestLap }
          : r
      )
    );
  }

  // === 6) Submit results back to /api/results ===
  async function submitResults() {
    if (!selectedTrack) {
      alert("Please select a track");
      return;
    }
    // Ensure every row has a driver
    if (results.some((r) => !r.driverId)) {
      alert("Select a driver for every position");
      return;
    }
    await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track: selectedTrack,
        results,
      }),
    });
    alert("Results saved!");
  }

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>

      {/* Navigation */}
      <div className="flex gap-4">
        <Link href="/admin/drivers">
          <Button>Manage Drivers</Button>
        </Link>
        <Link href="/admin/teams">
          <Button>Manage Teams</Button>
        </Link>
        <Link href="/admin/schedule">
          <Button>Manage Schedules</Button>
        </Link>
      </div>

      {/* Race Results */}
      <div className="mt-10">
        <h2 className="text-3xl font-bold mb-4">Race Results</h2>

        {/* 4) Dropdown now driven by DB-loaded `tracks` array */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Select Track</label>
          <select
            className="border rounded px-3 py-2 focus:outline-none"
            value={selectedTrack}
            onChange={handleTrackChange}
          >
            <option value="">-- Select a Track --</option>
            {tracks.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* 5+6) Results table + Save button */}
        {selectedTrack && results.length > 0 && (
          <>
            <DataTable
              data={results}
              drivers={drivers}
              updateDriver={updateDriver}
              togglePole={togglePole}
              toggleFastestLap={toggleFastestLap}
            />
            <Button className="mt-4" onClick={submitResults}>
              Save Results
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
