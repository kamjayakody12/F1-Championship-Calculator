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
  } = useSortable({ id: track._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab', // To indicate it's draggable
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 touch-none"
    >
      <span>{track.name}</span>
      <Button
        onClick={(e) => {
          e.stopPropagation(); // prevent drag from starting on button click
          removeTrack(track._id);
        }}
        size="sm"
        variant="destructive"
      >
        Remove
      </Button>
    </div>
  );
}