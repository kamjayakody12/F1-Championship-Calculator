import { useState, useEffect } from 'react';
import { supabase } from '@/lib/db';
import {
  Team,
  RaceResult,
  TeamStatsData,
  Track,
  ChartDataPoint,
  DistributionDataPoint,
} from './types';
import { extractImageUrl } from './constants';

export const useConstructorStandings = (seasonId?: string) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [rankingData, setRankingData] = useState<ChartDataPoint[]>([]);
  const [statsData, setStatsData] = useState<TeamStatsData[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionDataPoint[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [seasonId]);

  const fetchData = async () => {
    try {
      let [
        { data: driversData },
        { data: teamsDataData },
        { data: resultsData },
        { data: schedulesData },
        { data: tracksDataData },
        { data: selectedTracksData },
        { data: seasonEntries },
        { data: seasonDrivers },
        { data: rulesData },
      ] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('teams').select('*'),
        (seasonId
          ? supabase.from('results').select('*').eq('season_id', seasonId)
          : supabase.from('results').select('*')),
        (seasonId
          ? supabase.from('schedules').select('*').eq('season_id', seasonId)
          : supabase.from('schedules').select('*')),
        supabase.from('tracks').select('*'),
        (seasonId
          ? supabase.from('selected_tracks').select('*, track(*)').eq('season_id', seasonId)
          : supabase.from('selected_tracks').select('*, track(*)')),
        (seasonId
          ? supabase
              .from("season_driver_entries")
              .select("driver_id, team_id")
              .eq("season_id", seasonId)
          : Promise.resolve({ data: [] as any[] })),
        (seasonId
          ? supabase
              .from("season_drivers")
              .select("driver_id, team_id")
              .eq("season_id", seasonId)
          : Promise.resolve({ data: [] as any[] })),
        supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single(),
      ]);

      const seasonTeamByDriverId = new Map<string, string | null>();
      ((seasonDrivers as any[]) || []).forEach((d: any) => {
        seasonTeamByDriverId.set(String(d.driver_id), d.team_id || null);
      });
      ((seasonEntries as any[]) || []).forEach((e: any) => {
        seasonTeamByDriverId.set(String(e.driver_id), e.team_id || null);
      });

      const drivers = (driversData || []).map((d: any) => ({
        ...d,
        team: seasonId ? (seasonTeamByDriverId.get(String(d.id)) ?? d.team ?? null) : d.team,
      }));
      const teamsData = teamsDataData || [];
      const results = resultsData || [];
      const schedules = schedulesData || [];
      const tracksData = tracksDataData || [];
      const selectedTracks = selectedTracksData || [];
      const rules = rulesData;

      if (!tracksData || !rules || !selectedTracks) {
        throw new Error('Failed to fetch data');
      }

      setTracks(tracksData);

      const trackMap = new Map(tracksData.map((track) => [track.id, track.name]));
      const selectedTrackMap = new Map(selectedTracks.map((st: any) => [st.id, st]));
      const driverMap = new Map(drivers.map((driver: any) => [driver.id, driver]));
      const teamsWithDrivers = teamsData.filter((team: any) =>
        drivers.some((driver) => driver.team === team.id) ||
        results.some((result: any) => {
          const resolvedTeamId =
            (seasonId ? seasonTeamByDriverId.get(String(result.driver)) : null) ||
            (result as any).team_id ||
            driverMap.get(result.driver)?.team ||
            "";
          return resolvedTeamId === team.id;
        })
      );
      const teamMap = new Map(teamsWithDrivers.map((team) => [team.id, team]));
      const normalizedSchedules = (schedules || []).length
        ? schedules
        : (selectedTracks || []).map((st: any, idx: number) => ({
            track: st.id,
            date: `1970-01-${String(idx + 1).padStart(2, "0")}`,
          }));
      const sortedSchedules = normalizedSchedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Process race results
      const raceResults: RaceResult[] = results.map((result) => {
        const driver = driverMap.get(result.driver);
        const resolvedTeamId =
          (seasonId ? seasonTeamByDriverId.get(String(result.driver)) : null) ||
          (result as any).team_id ||
          driver?.team ||
          '';
        const team = teamMap.get(resolvedTeamId);
        const selectedTrack = selectedTrackMap.get(result.track);
        const physicalTrackId =
          selectedTrack?.track?.id ||
          selectedTrack?.tracks?.id ||
          selectedTrack?.track ||
          result.track;
        const trackName =
          selectedTrack?.track?.name ||
          selectedTrack?.tracks?.name ||
          trackMap.get(physicalTrackId) ||
          'Unknown Track';
        const schedule = normalizedSchedules.find((s) => s.track === result.track);

        const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

        // Calculate points - DNF drivers get 0 points regardless of position
        let points = 0;
        
        // Only calculate points if the driver finished the race
        if (result.racefinished !== false) {
          const pos = (result as any).finishing_position ?? result.position;
          
          const eventType = selectedTrack?.type || 'Race';
          
          const pointsMapping = eventType === 'Sprint' ? sprintPointsMapping : racePointsMapping;
          const maxPositions = eventType === 'Sprint' ? 8 : 10;
          const basePoints = pos <= maxPositions ? pointsMapping[(pos || 0) - 1] : 0;
          const bonusPoints =
            (rules.polegivespoint && result.pole ? 1 : 0) +
            (rules.fastestlapgivespoint && result.fastestlap ? 1 : 0);
          points = basePoints + bonusPoints;
        }
        
        // Safety check: Force 0 points for DNF
        if (result.racefinished === false) {
          points = 0;
        }

        return {
          track: result.track,
          trackName,
          date: schedule?.date || '',
          position: (result as any).finishing_position ?? result.position,
          driver: result.driver,
          driverName: driver?.name || 'Unknown',
          teamId: resolvedTeamId,
          teamName: team?.name || 'Unknown',
          points,
          pole: result.pole || false,
          fastestlap: result.fastestlap || false,
          racefinished: result.racefinished !== false,
        };
      });

      const participatingDriverIds = new Set(raceResults.map((r) => String(r.driver)));

      // Calculate team statistics (only for teams with drivers)
      const teamStats = new Map<string, TeamStatsData>();
      teamsWithDrivers.forEach((team) => {
        teamStats.set(team.id, {
          teamName: team.name,
          teamLogo: extractImageUrl(team.logo || ''),
          wins: 0,
          podiums: 0,
          pointsFinishes: 0,
          poles: 0,
          dnfs: 0,
        });
      });

      raceResults.forEach((result) => {
        const stats = teamStats.get(result.teamId);
        if (!stats) return;

        if (result.pole) stats.poles++;

        if (!result.racefinished) {
          stats.dnfs++;
          return;
        }

        const posForStats = (result as any).finishing_position ?? result.position;
        if (posForStats === 1) stats.wins++;
        if (posForStats >= 1 && posForStats <= 3) stats.podiums++;
        if (posForStats >= 1 && posForStats <= 10) stats.pointsFinishes++;
      });

      const structuredStatsArray = Array.from(teamStats.values())
        .filter((stats) => stats.wins + stats.podiums + stats.pointsFinishes + stats.poles + stats.dnfs > 0)
        .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);

      setStatsData(structuredStatsArray);

      // ============================================================================
      // CHART DATA GENERATION - MATCHING DRIVER STANDINGS LOGIC
      // ============================================================================
      
      // Group schedules by physical track (to combine sprint + race)
      const trackGroups = new Map<string, any[]>();
      sortedSchedules.forEach((schedule: any, originalRaceIndex: number) => {
        const st = selectedTrackMap.get(schedule.track);
        const physicalTrackId =
          st?.track?.id ||
          st?.tracks?.id ||
          st?.track ||
          schedule.track;



        if (!physicalTrackId) return;

        if (!trackGroups.has(physicalTrackId)) trackGroups.set(physicalTrackId, []);
        trackGroups.get(physicalTrackId)!.push({ schedule, originalRaceIndex, selectedTrack: st });
      });



      // Calculate points progression BY TRACK (combining sprint + race for same track)
      const teamPointsProgression = new Map<string, { [trackIndex: number]: number }>();
      teamsWithDrivers.forEach((team: any) => teamPointsProgression.set(team.id, {}));

      // Build chart data arrays
      // Track-grouped cumulative points (used for ranking evolution + keep distribution logic stable)
      const trackChartDataArray: ChartDataPoint[] = [];
      const distributionRows: DistributionDataPoint[] = [];
      let trackIndex = 0;

      // Process each track group (which may contain sprint + race)
      trackGroups.forEach((schedulesForTrack, trackId) => {
        // Get the selected_track IDs for this track (there may be multiple for sprint+race)
        const selectedTrackIds = schedulesForTrack.map((s: any) => s.schedule.track);

        // Get all results for ANY of the selected tracks (sprint or race) for this physical track
        const allResultsForTrack = raceResults.filter((r) => selectedTrackIds.includes(r.track));

        if (allResultsForTrack.length === 0) return;

        const first = schedulesForTrack[0];
        const st = first.selectedTrack;
        const trackName = st?.track?.name || st?.tracks?.name || trackMap.get(trackId) || "Unknown";



        // Calculate points earned by each team at THIS TRACK (sprint + race combined)
        const teamPointsThisTrack = new Map<string, number>();
        allResultsForTrack.forEach((r) => {
          const curr = teamPointsThisTrack.get(r.teamId) || 0;
          teamPointsThisTrack.set(r.teamId, curr + r.points);
        });

        // Update cumulative progression
        teamsWithDrivers.forEach((team: any) => {
          const prog = teamPointsProgression.get(team.id) || {};
          const prevTotal = trackIndex > 0 ? prog[trackIndex - 1] || 0 : 0;
          const pointsEarnedHere = teamPointsThisTrack.get(team.id) || 0;
          prog[trackIndex] = prevTotal + pointsEarnedHere;
          teamPointsProgression.set(team.id, prog);
        });

        // Progression data point
        const dataPoint: ChartDataPoint = {
          race: `${trackName} (${new Date(first.schedule.date).toLocaleDateString()})`,
          raceIndex: trackIndex,
          date: first.schedule.date,
        };

        teamsWithDrivers.forEach((team: any) => {
          const prog = teamPointsProgression.get(team.id) || {};
          dataPoint[team.name] = prog[trackIndex] || 0;
        });

        trackChartDataArray.push(dataPoint);

        // Distribution data point - points earned at this specific track ONLY
        const distRow: DistributionDataPoint = {
          race: `${trackName} (${new Date(first.schedule.date).toLocaleDateString()})`,
          trackNameOnly: trackName,
          selectedTrackId: st?.id || '',
          date: first.schedule.date,
        };

        // Use teamPointsThisTrack which contains ONLY points from this track
        teamsWithDrivers.forEach((team: any) => {
          distRow[team.name] = teamPointsThisTrack.get(team.id) || 0;
        });

        distributionRows.push(distRow);
        trackIndex++;
      });



      // Use the same progression structure as driver standings:
      // group schedules by physical track (combine sprint + race) and show cumulative points by team.
      setChartData(trackChartDataArray);
      setDistributionData(distributionRows);

      // Calculate ranking evolution
      const rankingDataArray: ChartDataPoint[] = trackChartDataArray.map((raceData) => {
        const raceStandings = teamsWithDrivers
          .map((team) => ({
            teamId: team.id,
            teamName: team.name,
            points: (raceData[team.name] as number) || 0,
          }))
          .sort((a, b) => b.points - a.points);

        const rankingPoint: ChartDataPoint = {
          race: raceData.race,
          raceIndex: raceData.raceIndex,
          date: raceData.date,
        };

        raceStandings.forEach((standing, position) => {
          rankingPoint[standing.teamName] = position + 1;
        });

        return rankingPoint;
      });

      setRankingData(rankingDataArray);

      // Calculate current constructor points (only for teams with drivers)
      const teamPointsMap = new Map<string, number>();
      raceResults.forEach((r) => {
        if (!r.teamId) return;
        teamPointsMap.set(r.teamId, (teamPointsMap.get(r.teamId) || 0) + (r.points || 0));
      });
      const teamsWithPoints = teamsWithDrivers.map((team) => {
        const teamDrivers = drivers.filter(
          (driver) =>
            driver.team === team.id &&
            participatingDriverIds.has(String(driver.id))
        );
        const constructorPoints = teamPointsMap.get(team.id) || 0;
        return { ...team, constructorPoints, drivers: teamDrivers };
      });

      const sortedTeams = teamsWithPoints.sort((a, b) => (b.constructorPoints || 0) - (a.constructorPoints || 0));
      setTeams(sortedTeams);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  return {
    teams,
    chartData,
    rankingData,
    statsData,
    distributionData,
    tracks,
    loading,
  };
};
