// app/admin/drivers/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

const NO_TEAM = "no-team";

export default function AdminDriversPage() {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverNumber, setDriverNumber] = useState("");
  const [driverTeamId, setDriverTeamId] = useState("");
  const [driverImageFile, setDriverImageFile] = useState<File | null>(null);

  async function uploadDriverImage(file: File, suggestedName: string): Promise<string | null> {
    try {
      const ext = file.name.split(".").pop() || "png";
      const safeName = (suggestedName as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
      const path = `drivers/${Date.now()}-${safeName}.${ext}`;
      const { error } = await supabase.storage.from("driver-images").upload(path, file, { upsert: true });
      if (error) {
        toast.error("Image upload failed: " + error.message);
        return null;
      }
      const { data } = supabase.storage.from("driver-images").getPublicUrl(path);
      return data?.publicUrl || null;
    } catch {
      toast.error("Image upload error");
      return null;
    }
  }

  useEffect(() => {
    // Optional: log session to verify authenticated role for Storage RLS
    supabase.auth.getSession().then(({ data }) => {
      console.log('Supabase session (admin/drivers):', data.session?.user?.email ?? null)
    })
    fetchDrivers();
    fetchTeams();
  }, [supabase.auth]);

  async function fetchDrivers() {
    const res = await fetch("/api/drivers");
    if (res.ok) {
      const data = await res.json();
      setDrivers(data);
    } else {
      toast.error("Failed to fetch drivers");
    }
  }

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data);
    } else {
      toast.error("Failed to fetch teams");
    }
  }


  // Function to check if driver number is already taken
  function isDriverNumberTaken(driverNumber: string, excludeDriverId?: string): boolean {
    if (!driverNumber) return false; // Allow empty numbers
    const num = parseInt(driverNumber);
    return drivers.some(driver => 
      driver.driver_number === num && 
      (!excludeDriverId || driver.id !== excludeDriverId)
    );
  }

  async function addDriver(e?: React.FormEvent) {
    e?.preventDefault();
    if (!driverName.trim()) {
      toast.error("Please enter a driver name");
      return;
    }
    if (!driverTeamId) {
      toast.error("Please select a team.");
      return;
    }
    if (driverNumber && isDriverNumberTaken(driverNumber)) {
      toast.error(`Driver number ${driverNumber} is already taken.`);
      return;
    }

    let imageUrl: string | undefined = undefined;
    if (driverImageFile) {
      const uploaded = await uploadDriverImage(driverImageFile, driverName || "driver");
      if (!uploaded) return; // abort on failed upload
      imageUrl = uploaded;
    }

    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: driverName,
        driver_number: driverNumber ? parseInt(driverNumber) : null,
        teamId: driverTeamId,
        image: imageUrl,
      }),
    });

    if (res.ok) {
      setDriverName("");
      setDriverNumber("");
      setDriverTeamId("");
      setDriverImageFile(null);
      fetchDrivers();
      toast.success("Driver added successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to add driver: " + errorMsg);
    }
  }

  async function updateDriverTeam(driverId: string, newTeamId: string) {
    const res = await fetch("/api/drivers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId,
        teamId: newTeamId,
      }),
    });

    if (res.ok) {
      fetchDrivers();
      toast.success("Driver team updated successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to update driver: " + errorMsg);
    }
  }

  async function deleteDriver(driverId: string) {
    const res = await fetch("/api/drivers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });

    if (res.ok) {
      fetchDrivers();
      toast.success("Driver deleted successfully!");
    } else {
      let errorMsg = "Unknown error";
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // ignore JSON parse error
      }
      toast.error("Failed to delete driver: " + errorMsg);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Add-Driver Dialog */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Drivers
        </h1>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default">Add Driver</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
              <DialogDescription>
                Fill out the fields below to create a new driver.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addDriver} className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driver-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="driver-name"
                  className="col-span-3"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver Name"
                  required
                />
              </div>
              {/* Driver Number */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driver-number" className="text-right">
                  Number
                </Label>
                <Input
                  id="driver-number"
                  type="number"
                  className="col-span-3"
                  value={driverNumber}
                  onChange={(e) => setDriverNumber(e.target.value)}
                  placeholder="Driver Number"
                  min="1"
                  max="99"
                />
              </div>
              {/* Team */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="team-select" className="text-right">
                  Team
                </Label>
                <Select
                  value={driverTeamId || NO_TEAM}
                  onValueChange={(val) =>
                    setDriverTeamId(val === NO_TEAM ? "" : val)
                  }
                >
                  <SelectTrigger id="team-select">
                    <SelectValue placeholder="Select Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM} key={NO_TEAM}>Select Team</SelectItem>
                    {teams.map((team: Record<string, unknown>) => (
                      <SelectItem key={team.id as string} value={(team.id as string).toString()}>
                        {team.name as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Image (upload from device) */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driver-image-file" className="text-right">
                  Image File
                </Label>
                <Input
                  id="driver-image-file"
                  type="file"
                  accept="image/*"
                  className="col-span-3"
                  onChange={(e) => setDriverImageFile(e.target.files?.[0] || null)}
                />
              </div>
              <DialogFooter>
                <Button type="submit">Add Driver</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Drivers Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {["Name", "Number", "Points", "Team", "Actions"].map((h) => (
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
               {drivers.map((driver: Record<string, unknown>) => {
              const currentTeamId =
                (driver.team as Record<string, unknown>)?.id?.toString() ??
                (typeof driver.team === "string" ? driver.team : NO_TEAM);

              return (
                <tr
                  key={driver.id as string}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {driver.name as string}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {(driver.driver_number as number) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {(driver.points as number) || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <Select
                      value={currentTeamId}
                      onValueChange={(newTeamId) =>
                        updateDriverTeam(
                          driver.id as string,
                          newTeamId === NO_TEAM ? "" : newTeamId
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>No Team</SelectItem>
                        {teams.map((team: Record<string, unknown>) => (
                          <SelectItem key={team.id as string} value={(team.id as string).toString()}>
                            {team.name as string}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {/* Edit Driver Dialog */}
                    <EditDriverContent 
                      driver={driver} 
                      onSaved={fetchDrivers}
                      isDriverNumberTaken={isDriverNumberTaken}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteDriver(driver.id as string)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditDriverContent({ 
  driver, 
  onSaved, 
  isDriverNumberTaken 
}: { 
  driver: Record<string, unknown>; 
  onSaved: () => void;
  isDriverNumberTaken: (driverNumber: string, excludeDriverId?: string) => boolean;
}) {
  const supabase = createClient();
  const [name, setName] = useState((driver.name as string) || "");
  const [driverNumber, setDriverNumber] = useState((driver.driver_number as string) || "");
  const [points, setPoints] = useState((driver.points as number) || 0);
  const [image] = useState<string>((driver.image as string) || "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function upload(file: File): Promise<string | null> {
    try {
      const ext = file.name.split(".").pop() || "png";
      const safeName = (name || "driver").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
      const path = `drivers/${Date.now()}-${safeName}.${ext}`;
      const { error } = await supabase.storage.from("driver-images").upload(path, file, { upsert: false });
      if (error) { toast.error("Image upload failed: " + error.message); return null; }
      const { data } = supabase.storage.from("driver-images").getPublicUrl(path);
      return data?.publicUrl || null;
    } catch {
      toast.error("Image upload error");
      return null;
    }
  }

  async function save() {
    if (!(name as string).trim()) {
      toast.error("Please enter a driver name");
      return;
    }

    // Check for duplicate driver number (excluding current driver)
    if (driverNumber && isDriverNumberTaken(driverNumber, driver.id as string)) {
      toast.error(`Driver number ${driverNumber} is already taken.`);
      return;
    }

    setSaving(true);
    let imageUrl = image;
    if (file) {
      const uploaded = await upload(file);
      if (!uploaded) { setSaving(false); return; }
      imageUrl = uploaded;
    }

    const res = await fetch("/api/drivers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        driverId: driver.id as string, 
        name: (name as string).trim(),
        driver_number: driverNumber ? parseInt(driverNumber as string) : null,
        points: points ? parseInt(points.toString()) : 0,
        image: imageUrl,
      }),
    });
    
    setSaving(false);
    if (res.ok) {
      onSaved();
      toast.success("Driver updated successfully!");
      setOpen(false); // Close the dialog
    } else {
      let msg = "Unknown error";
      try { const { error } = await res.json(); msg = error || msg; } catch {}
      toast.error("Failed to update driver: " + msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit Driver</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Driver</DialogTitle>
          <DialogDescription>Update all information for {driver.name as string}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-driver-name" className="text-right">
              Name
            </Label>
            <Input
              id="edit-driver-name"
              className="col-span-3"
              value={name as string}
              onChange={(e) => setName(e.target.value)}
              placeholder="Driver Name"
              required
            />
          </div>

          {/* Driver Number */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-driver-number" className="text-right">
              Number
            </Label>
            <Input
              id="edit-driver-number"
              type="number"
              className="col-span-3"
              value={driverNumber as string}
              onChange={(e) => setDriverNumber(e.target.value)}
              placeholder="Driver Number"
              min="1"
              max="99"
            />
          </div>

          {/* Points */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-driver-points" className="text-right">
              Points
            </Label>
            <Input
              id="edit-driver-points"
              type="number"
              className="col-span-3"
              value={points as number}
              onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              placeholder="Points"
              min="0"
            />
          </div>

          {/* Image */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-driver-image-file" className="text-right">
              Image
            </Label>
            <Input
              id="edit-driver-image-file"
              type="file"
              accept="image/*"
              className="col-span-3"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
