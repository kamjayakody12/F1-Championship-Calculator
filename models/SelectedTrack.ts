// models/SelectedTrack.ts

export interface SelectedTrack {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key)
  created_at?: string;
  updated_at?: string;
}
