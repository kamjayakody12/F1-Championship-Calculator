// models/Schedule.ts

export interface Schedule {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key)
  date: string; // ISO date string
}
