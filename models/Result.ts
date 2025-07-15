// models/Result.ts

export interface Result {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key)
  position: number;
  driver: string; // driver id (foreign key)
  pole: boolean;
  fastestLap: boolean;
}
