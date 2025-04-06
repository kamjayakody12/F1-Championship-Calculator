// app/admin/drivers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverPoints, setDriverPoints] = useState("");

  // Fetch drivers
  async function fetchDrivers() {
    const res = await fetch("/api/drivers", { method: "GET" });
    const data = await res.json();
    setDrivers(data);
  }

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Add a new driver
  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: driverName,
        points: Number(driverPoints),
      }),
    });
    if (res.ok) {
      setDriverName("");
      setDriverPoints("");
      fetchDrivers();
    }
  }

  // Delete driver
  async function deleteDriver(driverId: string) {
    const res = await fetch("/api/drivers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    if (res.ok) fetchDrivers();
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Manage Drivers</h1>
      <ul>
        {drivers.map((driver) => (
          <li key={driver._id} className="flex items-center gap-4 py-2">
            <span>
              <strong>{driver.name}</strong> - {driver.points} points
            </span>
            <Button variant="outline" onClick={() => deleteDriver(driver._id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={addDriver} className="mt-6 flex flex-col gap-2 w-64">
        <Input
          placeholder="Driver Name"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
        />
        <Input
          placeholder="Points"
          type="number"
          value={driverPoints}
          onChange={(e) => setDriverPoints(e.target.value)}
        />
        <Button type="submit">Add Driver</Button>
      </form>
    </div>
  );
}
