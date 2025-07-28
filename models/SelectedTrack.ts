// models/SelectedTrack.ts
export enum TrackTypeEnum {
  Sprint ='Sprint',
  Race = 'Race',
}

export interface SelectedTrack {
  id: string; // UUID or serial, depending on Supabase schema
  track: string; // track id (foreign key)
  type: TrackTypeEnum;
}
