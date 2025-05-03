// app/admin/manage-tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

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
      <h1 className="text-2xl font-bold mb-4">Manage Season Tracks</h1>

      <table className="min-w-full border-collapse mb-6">
        <thead>
          <tr>
            <th className="border p-2 text-left">Round</th>
            <th className="border p-2 text-center">Include?</th>
          </tr>
        </thead>
        <tbody>
          {allTracks.map((t) => (
            <tr key={t._id}>
              <td className="border p-2">{t.name}</td>
              <td className="border p-2 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(t._id)}
                  onChange={() => handleToggle(t._id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button onClick={saveSeasonTracks} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Season Tracks"}
      </Button>
    </div>
  );
}
