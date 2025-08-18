// models/Result.ts

export interface Result {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key)
  finishing_position: number; // Race finishing position
  driver: string; // driver id (foreign key)
  qualified_position?: number; // qualifying position for this driver (derived from qualifying table)
  pole: boolean;
  fastestlap: boolean;
  racefinished: boolean;
}
