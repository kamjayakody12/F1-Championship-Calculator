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
import { toast } from "sonner";
import type { Rules } from "@/models/Rules";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";


interface ResultRow {
  position: number;
  driverId: string;
  pole: boolean;
  fastestLap: boolean;
  racefinished : boolean;
}

const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

export default function AdminDashboardPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tracks, setTracks] = useState<{ id: string; trackId: string; name: string; type: string }[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [selectedTrackType, setSelectedTrackType] = useState<string>("");
  const [selectedTrackValue, setSelectedTrackValue] = useState<string>("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/drivers").then((r) => r.json()).then(setDrivers);
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { id: string; track: { id: string; name: string }; type: string }[]) =>
        setTracks(arr.map((s) => ({ 
          id: s.id, // selected_tracks.id
          trackId: s.track.id, // tracks.id 
          name: s.track.name, 
          type: s.type 
        })))
      );
  }, []);

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then(setRules);
  }, []);

  useEffect(() => {
    setResults(
      drivers.map((driver, i) => ({
        position: i + 1,
        driverId: "",
        pole: false,
        fastestLap: false,
        currentPoints: driver.points || 0,
        racefinished: true,
      }))
    );
  }, [drivers]);

  function handleTrackChange(trackIdAndType: string) {
    const [selectedTrackId, trackType] = trackIdAndType.split('|');
    
    setSelectedTrackId(selectedTrackId);
    setSelectedTrackType(trackType || "");
    setSelectedTrackValue(trackIdAndType);
    
    // Find the selected track to get the actual track name
    const selectedTrackData = tracks.find(t => t.id === selectedTrackId);
    setSelectedTrack(selectedTrackData?.name || "");
    
    if (!selectedTrackId) return;
    fetch(`/api/results?track=${encodeURIComponent(selectedTrackId)}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (data.length) {
          setIsUpdating(true);
          setResults(
            data.map((row) => {
              const driver = drivers.find((d) => d.id === row.driver);
              return {
                position: row.position,
                driverId: row.driver,
                pole: !!row.pole, // ensure boolean
                fastestLap: !!row.fastestlap, // ensure boolean
                currentPoints: driver ? driver.points : 0,
                racefinished: !!row.racefinished,
              };
            })
          );
        } else {
          setIsUpdating(false);
          setResults(
            drivers.map((driver, i) => ({
              position: i + 1,
              driverId: "",
              pole: false,
              fastestLap: false,
              currentPoints: driver.points || 0,
              racefinished: true
            }))
          );
        }
      });
  }

  function updateDriver(pos: number, id: string) {
    setResults((prev) =>
      prev.map((r) => (r.position === pos ? { ...r, driverId: id } : r))
    );
  }
  function togglePole(pos: number) {
    setResults((prev) =>
      prev.map((r) => {
        if (r.position === pos) {
          return { ...r, pole: !r.pole };
        } else {
          // Remove pole from all other drivers when this one gets pole
          return { ...r, pole: false };
        }
      })
    );
  }
  function toggleRaceFinished(pos: number) {
    setResults((prev) =>
      prev.map((r) => (r.position === pos ? { ...r, racefinished: !r.racefinished} : r))
    );
  }
  function toggleFastestLap(pos: number) {
    setResults((prev) =>
      prev.map((r) => {
        if (r.position === pos) {
          return { ...r, fastestLap: !r.fastestLap };
        } else {
          // Remove fastest lap from all other drivers when this one gets fastest lap
          return { ...r, fastestLap: false };
        }
      })
    );
  }

  async function submitResults() {
    if (!selectedTrackId) {
      toast.error("Please select a track");
      return;
    }
    if (results.some((r) => !r.driverId))
      return toast.error("Select a driver for every position");
    
    const method = isUpdating ? "PUT" : "POST";
    const endpoint = isUpdating ? `/api/results/${selectedTrackId}` : "/api/results";
    
    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          track: selectedTrackId, // Use selected_tracks.id
          trackType: selectedTrackType,
          results 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${isUpdating ? 'update' : 'save'} results`);
      }
      
      toast.success(isUpdating ? "Results updated!" : "Results saved!");
    } catch (error) {
      toast.error(`Failed to ${isUpdating ? 'update' : 'save'} results`);
      console.error(error);
    }
  }

  function computePoints(r: ResultRow) {
    if (!rules) return 0;
    
    // If driver didn't finish the race, they get zero points
    if (!r.racefinished) return 0;
    
    // Choose point system based on track type
    const pointsMapping = selectedTrackType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
    const maxPositions = selectedTrackType === 'Sprint' ? 8 : 10;
    
    const base = r.position <= maxPositions ? pointsMapping[r.position - 1] : 0;
    
    const poleBonus = rules.polegivespoint && r.pole ? 1 : 0;
    const fastestLapBonus = rules.fastestlapgivespoint && r.fastestLap ? 1 : 0;
    
    return base + poleBonus + fastestLapBonus;
  }

  // Helper to get available drivers for a given position (no duplicates)
  function availableDrivers(currentPosition: number) {
    return drivers.filter(
      (d) =>
        !results.some(
          (r) =>
            r.position !== currentPosition &&
            r.driverId === d.id
        )
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Race Results
      </h1>

      <div className="mb-6 max-w-sm">
        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Select Track
        </label>
        <Select value={selectedTrackValue} onValueChange={handleTrackChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="-- Select a Track --" />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((t) => (
              <SelectItem key={`${t.id}-${t.type}`} value={`${t.id}|${t.type}`}>
                {t.name} ({t.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTrackId && rules && (
        <>
          {selectedTrackType && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Event Type: <span className="font-bold">{selectedTrackType}</span>
                {isUpdating && (
                  <span className="ml-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs rounded-md font-medium">
                    Updating Existing Results
                  </span>
                )}
                {selectedTrackType === 'Sprint' && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
                    (Points: 8-7-6-5-4-3-2-1 for top 8 positions)
                  </span>
                )}
                {selectedTrackType === 'Race' && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
                    (Points: 25-18-15-12-10-8-6-4-2-1 for top 10 positions)
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    Pos
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    Driver
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    <div className="flex flex-col items-center">
                      <span>Race</span>
                      <span>Finished</span>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    Pole
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    <div className="flex flex-col items-center">
                      <span>Fastest</span>
                      <span>Lap</span>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide sm:px-6 sm:py-3">
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                {results.map((r) => (
                  <tr
                    key={r.position}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors sm:hover:bg-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 sm:px-6">
                      {r.position}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap sm:px-6">
                      <Select
                        value={r.driverId || "none"}
                        onValueChange={(id) => updateDriver(r.position, id === "none" ? "" : id)}
                      >
                        <SelectTrigger className="w-40 text-sm sm:w-48">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {availableDrivers(r.position).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={!!r.racefinished}
                          onCheckedChange={() => toggleRaceFinished(r.position)}
                          aria-label="Race Finished"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={!!r.pole}
                          onCheckedChange={() => togglePole(r.position)}
                          aria-label="Pole"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={!!r.fastestLap}
                          onCheckedChange={() => toggleFastestLap(r.position)}
                          aria-label="Fastest Lap"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100 sm:px-6">
                      {computePoints(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button onClick={submitResults}>
              {isUpdating ? "Update Results" : "Save Results"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}