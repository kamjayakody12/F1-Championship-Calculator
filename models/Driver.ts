// models/Driver.ts

export interface Driver {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  driver_number: number | null; // Driver number (1-99)
  team: string; // team id (foreign key)
  points: number;
  image?: string | null;
}
