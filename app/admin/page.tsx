"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TRACKS } from "@/lib/tracks";

// Interface for each row in the results table
interface ResultRow {
  position: number;
  driverId: string;
  pole: boolean;
  fastestLap: boolean;
}

// Points mapping for positions 1 to 10
const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export default function AdminDashboard() {
  // Navigation section (for managing drivers and teams)
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");

  // Results state will be reinitialized based on the number of drivers
  const [results, setResults] = useState<ResultRow[]>([]);

  // Fetch drivers for the dropdown
  async function fetchDrivers() {
    const res = await fetch("/api/drivers", { method: "GET" });
    const data = await res.json();
    setDrivers(data);
  }

  useEffect(() => {
    fetchDrivers();
  }, []);

  // When drivers update, set the results table rows equal to the number of drivers.
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

  // Handle track selection
  function handleTrackChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedTrack(e.target.value);
  }

  // Update a result row when a driver is selected
  function handleDriverChange(position: number, driverId: string) {
    setResults((prev) =>
      prev.map((row) =>
        row.position === position ? { ...row, driverId } : row
      )
    );
  }

  // Toggle bonus checkboxes
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
        row.position === position
          ? { ...row, fastestLap: !row.fastestLap }
          : row
      )
    );
  }

  // Submit results to the API
  async function submitResults() {
    if (!selectedTrack) {
      alert("Please select a track");
      return;
    }

    // Ensure every row has a selected driver
    const incompleteRows = results.filter((row) => !row.driverId);
    if (incompleteRows.length > 0) {
      alert("Please select a driver for every position.");
      return;
    }

    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track: selectedTrack,
        results,
      }),
    });
    if (res.ok) {
      alert("Results saved!");
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
            <table className="border-collapse w-full mt-6">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Pos</th>
                  <th className="p-2 text-left">Driver</th>
                  <th className="p-2 text-left">Pole?</th>
                  <th className="p-2 text-left">Fastest Lap?</th>
                  <th className="p-2 text-left">Points</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  // Compute base points for positions 1-10
                  const basePoints =
                    row.position <= 10
                      ? positionPointsMapping[row.position - 1]
                      : 0;
                  // Add bonus for pole and fastest lap
                  const bonusPoints =
                    (row.pole ? 1 : 0) + (row.fastestLap ? 1 : 0);
                  const totalPoints = basePoints + bonusPoints;

                  return (
                    <tr key={row.position} className="border-b">
                      <td className="p-2">{row.position}</td>
                      <td className="p-2">
                        <select
                          className="border rounded px-2 py-1"
                          value={row.driverId}
                          onChange={(e) =>
                            handleDriverChange(row.position, e.target.value)
                          }
                        >
                          <option value="">-- Select Driver --</option>
                          {drivers.map((driver) => (
                            <option key={driver._id} value={driver._id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.pole}
                          onChange={() => togglePole(row.position)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.fastestLap}
                          onChange={() => toggleFastestLap(row.position)}
                        />
                      </td>
                      <td className="p-2">{totalPoints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Button className="mt-4" onClick={submitResults}>
              Save Results
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
