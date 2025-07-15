// app/admin/manage-tracks/SortableTrackItem.tsx
"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Track } from "./page"; // Import the Track interface
import { Button } from "@/components/ui/button";

interface SortableTrackItemProps {
  track: Track;
  removeTrack: (trackId: string) => void;
}

export function SortableTrackItem({ track, removeTrack }: SortableTrackItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Remove button clicked for track:', track.id); // Debug log
    removeTrack(track.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
    >
      {/* Drag area - only this part is draggable */}
      <div
        {...attributes}
        {...listeners}
        className="flex-1 cursor-grab active:cursor-grabbing touch-none"
      >
        <span>{track.name}</span>
      </div>
      
      {/* Button area - separate from drag area */}
      <div className="ml-2">
        <Button
          onClick={handleRemoveClick}
          size="sm"
          variant="destructive"
          className="touch-none"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}