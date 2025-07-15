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
  id: string;
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
      .then((tracks: Track[]) => {
        console.log('Loaded all tracks:', tracks); // Debug log
        setAllTracks(tracks);
      });

    // Load the currently selected tracks for the season
    fetch("/api/selected-tracks")
      .then((r) => r.json())
      .then((arr: { track: Track }[]) => {
        console.log('Loaded selected tracks:', arr); // Debug log
        const selected = arr.map((s) => s.track).filter(track => track && track.id && track.id.trim() !== '');
        console.log('Filtered selected tracks:', selected); // Debug log
        setSelectedTracks(selected);
      });
  }, []);

  // Handles the reordering of tracks
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedTracks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Adds a track to the selected list
  function addTrack(track: Track) {
    if (!selectedTracks.find((t) => t.id === track.id)) {
      setSelectedTracks([...selectedTracks, track]);
    }
  }

  // Removes a track from the selected list
  function removeTrack(trackId: string) {
    console.log('Removing track with ID:', trackId); // Debug log
    console.log('Selected tracks before removal:', selectedTracks); // Debug log
    
    const updatedTracks = selectedTracks.filter((t) => t.id !== trackId);
    console.log('Selected tracks after removal:', updatedTracks); // Debug log
    
    setSelectedTracks(updatedTracks);
  }

  // Saves the reordered and selected tracks
  async function saveSeasonTracks() {
    setIsSaving(true);
    const trackIds = selectedTracks
      .map((t) => t.id)
      .filter(id => id && id.trim() !== ''); // Filter out empty IDs

    console.log('Saving track IDs:', trackIds); // Debug log

    if (trackIds.length === 0) {
      alert('No valid tracks to save. Please select some tracks first.');
      setIsSaving(false);
      return;
    }

    try {
      // This PUT request should go to an endpoint that overwrites the existing list
      const response = await fetch("/api/selected-tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds }),
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response headers:', Object.fromEntries(response.headers.entries())); // Debug log

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError); // Debug log
          const textError = await response.text();
          console.error('Raw error response:', textError); // Debug log
          alert(`Error saving tracks: HTTP ${response.status} - ${textError}`);
          return;
        }
        
        console.error('API Error:', errorData); // Debug log
        alert(`Error saving tracks: ${errorData.error || `HTTP ${response.status}`}`);
        return;
      }

      const result = await response.json();
      console.log('Save result:', result); // Debug log
      alert("Season tracks saved!");
    } catch (error) {
      console.error('Network error:', error); // Debug log
      alert(`Network error: ${error}`);
    } finally {
      setIsSaving(false);
    }
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
              .filter(track => !selectedTracks.some(sel => sel.id === track.id))
              .map((track) => (
                <div
                  key={track.id}
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
              items={selectedTracks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-[500px] overflow-auto">
                {selectedTracks.map((track) => (
                  <SortableTrackItem
                    key={track.id}
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