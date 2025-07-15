// models/Track.ts

export interface Track {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  created_at?: string; // optional, if using timestamps in Supabase
  updated_at?: string;
}
