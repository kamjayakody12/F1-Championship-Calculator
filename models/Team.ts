// models/Team.ts

export interface Team {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  points: number;
}
