"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Track {
  _id: string;
  name: string;
  active: boolean;
}

export default function ManageTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);

  // Load all rounds (with their active flag)
  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then(setTracks);
  }, []);

  // Toggle active in UI + persist immediately
  async function toggle(id: string, nowActive: boolean) {
    // Optimistic UI
    setTracks((t) =>
      t.map((trk) => (trk._id === id ? { ...trk, active: nowActive } : trk))
    );
    // Persist
    await fetch("/api/tracks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: nowActive }),
    });
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Season Tracks</h1>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">Round</th>
            <th className="border p-2">Included?</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((trk) => (
            <tr key={trk._id}>
              <td className="border p-2">{trk.name}</td>
              <td className="border p-2 text-center">
                <input
                  type="checkbox"
                  checked={trk.active}
                  onChange={(e) => toggle(trk._id, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
