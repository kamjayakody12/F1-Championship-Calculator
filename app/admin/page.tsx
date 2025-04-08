"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TRACKS } from "@/lib/tracks";
import DataTable from "@/components/ui/data-table"; // Default export

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);

  // Fetch drivers from API
  async function fetchDrivers() {
    const res = await fetch("/api/drivers", { method: "GET" });
    const data = await res.json();
    setDrivers(data);
  }

  // Fetch race results for a selected track
  async function fetchResultsForTrack(track: string) {
    const res = await fetch(`/api/results?track=${encodeURIComponent(track)}`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        setResults(
          data.map((result: any) => ({
            position: result.position,
            driverId: result.driver,
            pole: result.pole,
            fastestLap: result.fastestLap,
          }))
        );
      } else {
        // Initialize empty rows based on the number of drivers
        setResults(
          Array.from({ length: drivers.length }, (_, i) => ({
            position: i + 1,
            driverId: "",
            pole: false,
            fastestLap: false,
          }))
        );
      }
    }
  }

  useEffect(() => {
    fetchDrivers();
  }, []);

  // If no track is selected, initialize results with empty rows based on drivers count
  useEffect(() => {
    if (!selectedTrack) {
      setResults(
        Array.from({ length: drivers.length }, (_, i) => ({
          position: i + 1,
          driverId: "",
          pole: false,
          fastestLap: false,
        }))
      );
    }
  }, [drivers, selectedTrack]);

  function handleTrackChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const track = e.target.value;
    setSelectedTrack(track);
    if (track) {
      fetchResultsForTrack(track);
    }
  }

  // Callback functions to update results
  function updateDriver(position: number, newDriverId: string) {
    setResults((prev) =>
      prev.map((row) => (row.position === position ? { ...row, driverId: newDriverId } : row))
    );
  }
  function togglePole(position: number) {
    setResults((prev) =>
      prev.map((row) =>
        row.position === position ? { ...row, pole: !row.pole } : row
      )
    );
  }
  function toggleFastestLap(position: number) {
    setResults((prev) =>
      prev.map((row) =>
        row.position === position ? { ...row, fastestLap: !row.fastestLap } : row
      )
    );
  }

  async function submitResults() {
    if (!selectedTrack) {
      alert("Please select a track");
      return;
    }
    const incomplete = results.filter((row) => !row.driverId);
    if (incomplete.length > 0) {
      alert("Please select a driver for every position.");
      return;
    }
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: selectedTrack, results }),
    });
    if (res.ok) {
      alert("Results saved!");
      fetchResultsForTrack(selectedTrack);
    }
  }

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <Link href="/admin/drivers">
          <Button>Manage Drivers</Button>
        </Link>
        <Link href="/admin/teams">
          <Button>Manage Teams</Button>
        </Link>
      </div>
      {/* Race Results Section */}
      <div className="mt-10">
        <h2 className="text-3xl font-bold mb-4">Race Results</h2>
        <div className="mb-4">
          <label className="block mb-1 font-medium">Select Track</label>
          <select
            className="border rounded px-3 py-2 focus:outline-none"
            value={selectedTrack}
            onChange={handleTrackChange}
          >
            <option value="">-- Select a Track --</option>
            {TRACKS.map((track) => (
              <option key={track} value={track}>
                {track}
              </option>
            ))}
          </select>
        </div>
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
