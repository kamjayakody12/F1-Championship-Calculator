// models/Driver.ts

export interface Driver {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  team: string; // team id (foreign key)
  points: number;
  image?: string | null;
}
