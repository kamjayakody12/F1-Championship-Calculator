// app/admin/manage-tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface Track {
  _id: string;
  name: string;
}

export default function ManageTracksPage() {
  // all rounds
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  // the original set we fetched from the server
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  // your UI toggles
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // 1️⃣ on mount, load both collections
  useEffect(() => {
    // load full calendar
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((tracks: Track[]) => setAllTracks(tracks));

    // load only your picks
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { track: Track }[]) => {
        const sel = new Set(arr.map((s) => s.track._id));
        setInitialSelected(sel);
        setSelectedIds(new Set(sel));
      });
  }, []);

  // 2️⃣ just update UI state when you click a checkbox
  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // 3️⃣ save everything at once
  async function saveSeasonTracks() {
    setIsSaving(true);
    // compute diffs
    const toAdd = Array.from(selectedIds).filter((id) => !initialSelected.has(id));
    const toRemove = Array.from(initialSelected).filter((id) => !selectedIds.has(id));

    // batch POST additions
    await Promise.all(
      toAdd.map((trackId) =>
        fetch("/api/selected-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        })
      )
    );

    // batch DELETE removals
    await Promise.all(
      toRemove.map((trackId) =>
        fetch("/api/selected-tracks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        })
      )
    );

    // reset initial to reflect saved state
    setInitialSelected(new Set(selectedIds));
    setIsSaving(false);
    alert("Season tracks saved!");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Manage Season Tracks
      </h1>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Round
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Include?
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {allTracks.map((t) => (
              <tr
                key={t._id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {t.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <Checkbox
                    checked={selectedIds.has(t._id)}
                    onCheckedChange={() => handleToggle(t._id)}
                    aria-label={`Include ${t.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={saveSeasonTracks} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Season Tracks"}
      </Button>
    </div>
  );
}
