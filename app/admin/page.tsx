// app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface ResultRow {
  position: number;
  driverId: string;
  pole: boolean;
  fastestLap: boolean;
}

// Base points for positions 1–10
const positionPointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export default function AdminDashboardPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [results, setResults] = useState<ResultRow[]>([]);

  // 1️⃣ Fetch drivers for the dropdown
  useEffect(() => {
    fetch("/api/drivers")
      .then((r) => r.json())
      .then(setDrivers);
  }, []);

  // 2️⃣ Fetch only the tracks you’ve selected
  useEffect(() => {
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { track: { name: string } }[]) =>
        setTracks(arr.map((s) => s.track.name))
      );
  }, []);

  // 3️⃣ Whenever drivers change, (re)seed an “empty” results set
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

  // 4️⃣ Called when you pick a round
  function handleTrackChange(track: string) {
    setSelectedTrack(track);
    if (!track) return;

    fetch(`/api/results?track=${encodeURIComponent(track)}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (data.length) {
          // load saved rows
          setResults(
            data.map((row) => ({
              position: row.position,
              driverId: row.driver,
              pole: row.pole,
              fastestLap: row.fastestLap,
            }))
          );
        } else {
          // no saved → reset empties
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

  // 5️⃣ Row‐level callbacks
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

  // 6️⃣ Save everything
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

  // compute total points
  function computePoints(r: ResultRow) {
    const base = r.position <= 10 ? positionPointsMapping[r.position - 1] : 0;
    return base + (r.pole ? 1 : 0) + (r.fastestLap ? 1 : 0);
  }

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold mb-6">Race Results</h1>

      {/* Track selector */}
      <div className="mb-6 max-w-sm">
        <label className="block mb-2 font-medium">Select Track</label>
        <Select value={selectedTrack} onValueChange={handleTrackChange}>
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

      {/* Only show table once a track is chosen */}
      {selectedTrack && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full table-auto divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Pos", "Driver", "Pole", "Fastest Lap", "Pts"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide sm:px-6 sm:py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r) => (
                  <tr
                    key={r.position}
                    className="hover:bg-gray-50 transition-colors sm:hover:bg-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                      {r.position}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap sm:px-6">
                      <Select
                        value={r.driverId}
                        onValueChange={(id) => updateDriver(r.position, id)}
                      >
                        <SelectTrigger className="w-40 text-sm sm:w-48">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((d) => (
                            <SelectItem key={d._id} value={d._id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm sm:px-6">
                      <Checkbox
                        checked={r.pole}
                        onCheckedChange={() => togglePole(r.position)}
                        aria-label="Pole"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm sm:px-6">
                      <Checkbox
                        checked={r.fastestLap}
                        onCheckedChange={() => toggleFastestLap(r.position)}
                        aria-label="Fastest lap"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium text-gray-900 sm:px-6">
                      {computePoints(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex left">
            <Button onClick={submitResults}>Save Results</Button>
          </div>
        </>
      )}
    </div>
  );
}
