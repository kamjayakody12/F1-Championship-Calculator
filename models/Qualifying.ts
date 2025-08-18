// models/Qualifying.ts

export interface Qualifying {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key - references selected_tracks.id)
  position: number; // qualifying position (1-20)
  driver: string; // driver id (foreign key)
}
