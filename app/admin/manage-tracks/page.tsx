// app/admin/manage-tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableTrackItem } from "./SortableTrackItem"; // We'll create this next

export interface Track {
  _id: string;
  name: string;
}

export default function ManageTracksPage() {
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Define sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  useEffect(() => {
    // Load all available tracks
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((tracks: Track[]) => setAllTracks(tracks));

    // Load the currently selected tracks for the season
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { track: Track }[]) => {
        const selected = arr.map((s) => s.track);
        setSelectedTracks(selected);
      });
  }, []);

  // Handles the reordering of tracks
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedTracks((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Adds a track to the selected list
  function addTrack(track: Track) {
    if (!selectedTracks.find((t) => t._id === track._id)) {
      setSelectedTracks([...selectedTracks, track]);
    }
  }

  // Removes a track from the selected list
  function removeTrack(trackId: string) {
    setSelectedTracks(selectedTracks.filter((t) => t._id !== trackId));
  }

  // Saves the reordered and selected tracks
  async function saveSeasonTracks() {
    setIsSaving(true);
    const trackIds = selectedTracks.map((t) => t._id);

    // This PUT request should go to an endpoint that overwrites the existing list
    await fetch("/api/selected-tracks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds }),
    });

    setIsSaving(false);
    alert("Season tracks saved!");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Manage Season Tracks
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Column for Available Tracks */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Available Tracks</h2>
          <div className="overflow-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-[500px]">
            {allTracks
              .filter(track => !selectedTracks.some(sel => sel._id === track._id))
              .map((track) => (
                <div
                  key={track._id}
                  className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600"
                >
                  <span>{track.name}</span>
                  <Button onClick={() => addTrack(track)} size="sm">
                    Add
                  </Button>
                </div>
              ))}
          </div>
        </div>

        {/* Column for Selected Tracks */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Selected Tracks (Drag to Reorder)</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedTracks.map(t => t._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-[500px] overflow-auto">
                {selectedTracks.map((track) => (
                  <SortableTrackItem
                    key={track._id}
                    track={track}
                    removeTrack={removeTrack}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={saveSeasonTracks} disabled={isSaving || selectedTracks.length === 0}>
          {isSaving ? "Saving..." : "Save Season Tracks"}
        </Button>
      </div>
    </div>
  );
}