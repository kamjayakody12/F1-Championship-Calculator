// app/admin/manage-tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TrackTypeEnum } from "@/models/SelectedTrack";
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

export interface Track {
  id: string;
  name: string;
}

export interface SelectedTrack {
  id: string;
  track: Track;
  type: TrackTypeEnum;
}

export default function ManageTracksPage() {
  const [selectedTracks, setSelectedTracks] = useState<SelectedTrack[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);

  // New track form state
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [trackType, setTrackType] = useState<TrackTypeEnum>(TrackTypeEnum.Race);
  const [open, setOpen] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetch("/api/tracks").then((r) => r.json()).then(setAllTracks);
    fetch("/api/selected-tracks").then((r) => r.json()).then(setSelectedTracks);
  }, []);

  // Get all tracks for selection (allow duplicates)
  const availableTracks = allTracks;

  // --- ADD SELECTED TRACK ---
  async function addSelectedTrack(e?: React.FormEvent) {
    e?.preventDefault();
    
    if (!selectedTrackId) {
      toast.error("Please select a track.");
      return;
    }

    try {
      const response = await fetch("/api/selected-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackId,
          type: trackType,
        }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        toast.error("Failed to add track: " + errorMsg);
        return;
      }

      // Reset form
      setSelectedTrackId("");
      setTrackType(TrackTypeEnum.Race);
      setOpen(false);

      // Refresh data
      const data = await fetch("/api/selected-tracks").then((r) => r.json());
      setSelectedTracks(data);
      
      toast.success("Track added successfully!");
    } catch (error) {
      toast.error("Failed to add track: " + error);
    }
  }

  // --- UPDATE TRACK TYPE ---
  async function updateTrackType(trackId: string, newType: TrackTypeEnum) {
    try {
      const response = await fetch("/api/selected-tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          trackId, 
          type: newType 
        }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        toast.error("Failed to update track type: " + errorMsg);
        return;
      }

      // Refresh data
      const data = await fetch("/api/selected-tracks").then((r) => r.json());
      setSelectedTracks(data);
      
      toast.success("Track type updated successfully!");
    } catch (error) {
      toast.error("Failed to update track type: " + error);
    }
  }

  // --- DELETE SELECTED TRACK ---
  async function deleteSelectedTrack(trackId: string) {
    try {
      const response = await fetch("/api/selected-tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        toast.error("Failed to delete track: " + errorMsg);
        return;
      }

      // Refresh data
      const data = await fetch("/api/selected-tracks").then((r) => r.json());
      setSelectedTracks(data);
      
      toast.success("Track removed successfully!");
    } catch (error) {
      toast.error("Failed to delete track: " + error);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Add-Track Dialog */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Season Tracks
        </h1>

        <Dialog onOpenChange={(isOpen) => !isOpen && setOpen(false)}>
          <DialogTrigger asChild>
            <Button variant="default">Add Track</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Track to Season</DialogTitle>
              <DialogDescription>
                Select a track and its type for the current season.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addSelectedTrack} className="grid gap-4 py-4">
              {/* Track Selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="track-select" className="text-right">
                  Track
                </Label>
                <div className="col-span-3">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {selectedTrackId
                          ? availableTracks.find((track) => track.id === selectedTrackId)?.name
                          : "Select track..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search tracks..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No track found.</CommandEmpty>
                          <CommandGroup>
                            {availableTracks.map((track) => (
                              <CommandItem
                                key={track.id}
                                value={track.name}
                                onSelect={() => {
                                  setSelectedTrackId(track.id);
                                  setOpen(false);
                                }}
                              >
                                {track.name}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    selectedTrackId === track.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Track Type */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type-select" className="text-right">
                  Type
                </Label>
                <Select
                  value={trackType}
                  onValueChange={(value) => setTrackType(value as TrackTypeEnum)}
                >
                  <SelectTrigger id="type-select" className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TrackTypeEnum.Race}>
                      {TrackTypeEnum.Race}
                    </SelectItem>
                    <SelectItem value={TrackTypeEnum.Sprint}>
                      {TrackTypeEnum.Sprint}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit">Add Track</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selected Tracks Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {["Track Name", "Type", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-600">
            {selectedTracks.map((selectedTrack) => (
              <tr
                key={selectedTrack.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {selectedTrack.track.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Select
                    value={selectedTrack.type}
                    onValueChange={(value) =>
                      updateTrackType(selectedTrack.id, value as TrackTypeEnum)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TrackTypeEnum.Race}>
                        {TrackTypeEnum.Race}
                      </SelectItem>
                      <SelectItem value={TrackTypeEnum.Sprint}>
                        {TrackTypeEnum.Sprint}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSelectedTrack(selectedTrack.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}