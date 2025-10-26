// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DriverRow {
  id: string;
  name: string;
  points: number;
  team: string;
  teamName: string;
  teamLogo: string;
}

export interface RaceResult {
  track: string;
  trackName: string;
  date: string;
  position: number;
  driver: string;
  driverName: string;
  teamId: string;
  teamName: string;
  points: number;
  pole: boolean;
  fastestlap: boolean;
  racefinished: boolean;
}

export interface DriverStatsData {
  driverId: string;
  driverName: string;
  teamName: string;
  teamLogo: string;
  wins: number;
  podiums: number;
  pointsFinishes: number;
  poles: number;
  dnfs: number;
}

export interface Track {
  id: string;
  name: string;
  img?: string;
}

export interface ChartDataPoint {
  race: string;
  raceIndex: number;
  date: string;
  [driverName: string]: any;
}
