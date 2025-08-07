// models/Track.ts
export interface Track {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  img: string;
}
