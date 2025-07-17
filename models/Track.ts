// models/Track.ts
export enum TrackTypeEnum {
  Sprint ='Sprint',
  Race = 'Race',
}

export interface Track {
  id: string; // UUID or serial, depending on Supabase schema
  name: string;
  type: TrackTypeEnum;
}
