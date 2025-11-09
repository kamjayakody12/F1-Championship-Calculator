export interface Driver {
  id: string;
  name: string;
  points: number;
  team: string;
}

export interface Team {
  id: string;
  name: string;
  points: number;
  constructorPoints: number;
  drivers: Driver[];
  logo?: string;
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

export interface TeamStatsData {
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
  [teamName: string]: string | number;
}

export interface DistributionDataPoint {
  race: string;
  trackNameOnly: string;
  selectedTrackId: string;
  date: string;
  [teamName: string]: string | number;
}
