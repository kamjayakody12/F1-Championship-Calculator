// app/admin/manage-tracks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";

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
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isAddingTrack, setIsAddingTrack] = useState(false);

  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [trackType, setTrackType] = useState<TrackTypeEnum>(TrackTypeEnum.Race);
  const [isAddTrackDialogOpen, setIsAddTrackDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoadingInitialData(true);
      try {
        const [tracksResponse, selectedTracksResponse, seasonsResponse] = await Promise.all([
          fetch("/api/tracks"),
          fetch(`/api/selected-tracks${selectedSeasonId ? `?seasonId=${encodeURIComponent(selectedSeasonId)}` : ""}`),
          fetch("/api/season-manager"),
        ]);

        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json();
          setAllTracks(tracksData);
        } else {
          toast.error("Failed to fetch available tracks.");
        }

        if (selectedTracksResponse.ok) {
          const selectedTracksData = await selectedTracksResponse.json();
          setSelectedTracks(selectedTracksData);
        } else {
          toast.error("Failed to fetch current season tracks.");
        }
        if (seasonsResponse.ok) {
          const seasonsData = await seasonsResponse.json();
          setSeasons(seasonsData || []);
          if (!selectedSeasonId && Array.isArray(seasonsData) && seasonsData[0]?.id) {
            setSelectedSeasonId(seasonsData[0].id);
          }
        }
      } catch (error: any) {
        toast.error("Error fetching data: " + error.message);
      } finally {
        setIsLoadingInitialData(false);
      }
    }
    fetchData();
  }, [selectedSeasonId]);
  console.log('isLoadingInitialData', isLoadingInitialData);
  const availableTracks = allTracks;

  async function addSelectedTrack(e?: React.FormEvent) {
    e?.preventDefault();

    if (!selectedTrackId) {
      toast.error("Please select a track.");
      return;
    }

    if (!selectedSeasonId) {
      toast.error("Please create/select a season first from the Schedule tab.");
      return;
    }
    const selectedSeason = seasons.find((s: any) => s.id === selectedSeasonId);
    if (selectedSeason?.is_finalized) {
      toast.error("This season is finalized. Create a new season in Schedule tab.");
      return;
    }

    setIsAddingTrack(true);
    try {
      const response = await fetch("/api/selected-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackId,
          type: trackType,
          seasonId: selectedSeasonId,
        }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || response.statusText || errorMsg;
        } catch (e) {
          errorMsg = response.statusText || errorMsg;
        }
        toast.error("Failed to add track: " + errorMsg);
        return;
      }

      setSelectedTrackId("");
      setTrackType(TrackTypeEnum.Race);
      setIsAddTrackDialogOpen(false); // Close the main dialog

      await response.json();
      const data = await fetch(`/api/selected-tracks?seasonId=${encodeURIComponent(selectedSeasonId)}`).then((r) => r.json());
      setSelectedTracks(data);

      toast.success("Track added successfully!");
    } catch (error: any) {
      toast.error("Failed to add track: " + error.message);
    } finally {
      setIsAddingTrack(false);
    }
  }

  async function updateTrackType(selectedTrackIdToUpdate: string, newType: TrackTypeEnum) {
    try {
      const response = await fetch("/api/selected-tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrackIdToUpdate,
          type: newType,
        }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || response.statusText || errorMsg;
        } catch (e) {
          errorMsg = response.statusText || errorMsg;
        }
        toast.error("Failed to update track type: " + errorMsg);
        return;
      }

      const data = await fetch(`/api/selected-tracks?seasonId=${encodeURIComponent(selectedSeasonId)}`).then((r) => r.json());
      setSelectedTracks(data);

      toast.success("Track type updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update track type: " + error.message);
    }
  }

  async function deleteSelectedTrack(trackIdToDelete: string) {
    try {
      const response = await fetch("/api/selected-tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: trackIdToDelete, seasonId: selectedSeasonId }),
      });

      if (!response.ok) {
        let errorMsg = "Unknown error";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || response.statusText || errorMsg;
        } catch (e) {
          errorMsg = response.statusText || errorMsg;
        }
        toast.error("Failed to delete track: " + errorMsg);
        return;
      }

      const data = await fetch(`/api/selected-tracks?seasonId=${encodeURIComponent(selectedSeasonId)}`).then((r) => r.json());
      setSelectedTracks(data);

      toast.success("Track removed successfully!");
    } catch (error: any) {
      toast.error("Failed to delete track: " + error.message);
    }
  }
  return (
    <div className="p-6 space-y-6">
      {/* Header and Add-Track Dialog */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Season Tracks
        </h1>
        <div className="w-64">
          <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
            <SelectTrigger>
              <SelectValue placeholder="Select season" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  Season {s.season_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog onOpenChange={setIsAddTrackDialogOpen} open={isAddTrackDialogOpen}>
          <DialogTrigger>
            <Button variant="default">Add Track</Button>
          </DialogTrigger>
          <DialogContent className="sm:min-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Track to Season</DialogTitle>
              <DialogDescription>
                Select a track and its type for the current season.
              </DialogDescription>
            </DialogHeader>
            {seasons.find((s: any) => s.id === selectedSeasonId)?.is_finalized && (
              <p className="text-sm text-muted-foreground">
                Selected season is finalized. Create a new season from the Schedule tab.
              </p>
            )}
            {!selectedSeasonId && (
              <p className="text-sm text-muted-foreground">
                No season selected. Create or select a season in the Schedule tab first.
              </p>
            )}
            <form onSubmit={addSelectedTrack} className="grid gap-4 py-4">
              {/* Track Selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="track-select" className="text-right">
                  Track
                </Label>
                <div className="col-span-3">
                  <Select
                    value={selectedTrackId}
                    onValueChange={(value) => setSelectedTrackId(value)}
                    disabled={isLoadingInitialData}
                  >
                    <SelectTrigger id="track-select">
                      <SelectValue
                        placeholder={
                          isLoadingInitialData
                            ? "Loading tracks..."
                            : "Select a track"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTracks.map((track) => (
                        <SelectItem key={track.id} value={track.id}>
                          {track.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    {Object.values(TrackTypeEnum).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isAddingTrack || isLoadingInitialData || !selectedTrackId || !selectedSeasonId}
                >
                  {isAddingTrack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Track
                </Button>
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
            {isLoadingInitialData ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" /> Loading tracks...
                </td>
              </tr>
            ) : selectedTracks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No tracks added to this season yet. Click "Add Track" to get started.
                </td>
              </tr>
            ) : (
              selectedTracks.map((selectedTrack) => (
                <tr
                  key={selectedTrack.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {selectedTrack.track?.name || 'N/A'}
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
                        {Object.values(TrackTypeEnum).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!!seasons.find((s: any) => s.id === selectedSeasonId)?.is_finalized}
                      onClick={() => deleteSelectedTrack(selectedTrack.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}