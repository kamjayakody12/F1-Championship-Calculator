import { useState, useEffect } from "react";
import { supabase } from "@/lib/db";
import { DriverRow, RaceResult, DriverStatsData } from "./types";
import { extractImageUrl, calculateResultPoints } from "./utils";

export function useDriverStandings() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<DriverStatsData[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        { data: driversData },
        { data: teamsData },
        { data: results },
        { data: schedules },
        { data: tracksData },
        { data: selectedTracks },
        { data: rules },
      ] = await Promise.all([
        supabase.from("drivers").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("results").select("*"),
        supabase.from("schedules").select("*"),
        supabase.from("tracks").select("*"),
        supabase.from("selected_tracks").select("*, track(*)"),
        supabase
          .from("rules")
          .select("polegivespoint, fastestlapgivespoint")
          .eq("id", 1)
          .single(),
      ]);

      if (
        !driversData ||
        !teamsData ||
        !results ||
        !schedules ||
        !tracksData ||
        !selectedTracks ||
        !rules
      ) {
        throw new Error("Failed to fetch data");
      }

      // Create lookup maps
      const teamMap = new Map(teamsData.map((t: any) => [t.id, t]));
      const driverMap = new Map(driversData.map((d: any) => [d.id, d]));
      const trackMap = new Map(tracksData.map((t: any) => [t.id, t.name]));
      const selectedTrackMap = new Map(
        selectedTracks.map((st: any) => [st.id, st])
      );

      setTracks(tracksData);

      // Process race results
      const raceResults = processRaceResults(
        results,
        driverMap,
        teamMap,
        trackMap,
        selectedTrackMap,
        schedules,
        rules
      );

      // Calculate driver statistics
      const driverStats = calculateDriverStats(
        driversData,
        teamMap,
        raceResults
      );
      setStatsData(driverStats);

      // Calculate progression and distribution data
      const {
        progressionData,
        distributionData: distData,
        rankingEvolution,
      } = calculateChartData(
        driversData,
        raceResults,
        schedules,
        selectedTrackMap,
        tracksData
      );

      setChartData(progressionData);
      setDistributionData(distData);
      setRankingData(rankingEvolution);

      // Set driver standings
      const enrichedDrivers = enrichDriverData(driversData, teamMap);
      setDrivers(enrichedDrivers);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  };

  return {
    drivers,
    chartData,
    rankingData,
    statsData,
    distributionData,
    tracks,
    loading,
  };
}

// Helper functions (these would ideally be in separate service files)
function processRaceResults(
  results: any[],
  driverMap: Map<string, any>,
  teamMap: Map<string, any>,
  trackMap: Map<string, string>,
  selectedTrackMap: Map<string, any>,
  schedules: any[],
  rules: any
): RaceResult[] {
  return results.map((result: any) => {
    const driver = driverMap.get(result.driver);
    const team = teamMap.get(driver?.team || "");
    const schedule = schedules.find((s: any) => {
      const st = selectedTrackMap.get(s.track);
      return st?.track?.id === result.track;
    });

    const selectedTrack = selectedTrackMap.get(schedule?.track || "");
    const eventType = selectedTrack?.type || "Race";
    const points = calculateResultPoints(result, rules, eventType);

    return {
      track: result.track,
      trackName: trackMap.get(result.track) || "Unknown",
      date: schedule?.date || "",
      position: result.finishing_position ?? result.position,
      driver: result.driver,
      driverName: driver?.name || "Unknown",
      teamId: driver?.team || "",
      teamName: team?.name || "Unknown",
      points,
      pole: result.pole || false,
      fastestlap: result.fastestlap || false,
      racefinished: result.racefinished !== false,
    };
  });
}

function calculateDriverStats(
  driversData: any[],
  teamMap: Map<string, any>,
  raceResults: RaceResult[]
): DriverStatsData[] {
  const driverStats = new Map<string, DriverStatsData>();

  // Initialize stats for all drivers
  driversData.forEach((d: any) => {
    const team = teamMap.get(d.team);
    driverStats.set(d.id, {
      driverId: d.id,
      driverName: d.name,
      teamName: team?.name || "Unknown",
      teamLogo: extractImageUrl(team?.logo || ""),
      wins: 0,
      podiums: 0,
      pointsFinishes: 0,
      poles: 0,
      dnfs: 0,
    });
  });

  // Count statistics from race results
  raceResults.forEach((res) => {
    const stats = driverStats.get(res.driver);
    if (!stats) return;

    if (res.pole) stats.poles++;

    if (!res.racefinished) {
      stats.dnfs++;
      return;
    }

    if (res.position >= 1 && res.position <= 10) stats.pointsFinishes++;
    if (res.position === 1) stats.wins++;
    if (res.position >= 1 && res.position <= 3) stats.podiums++;
  });

  return Array.from(driverStats.values())
    .filter((s) => s.wins + s.podiums + s.pointsFinishes + s.poles + s.dnfs > 0)
    .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);
}

function calculateChartData(
  driversData: any[],
  raceResults: RaceResult[],
  schedules: any[],
  selectedTrackMap: Map<string, any>,
  tracksData: any[]
) {
  const sortedSchedules = schedules.sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Group results by track
  const trackGroups = new Map<string, any[]>();
  sortedSchedules.forEach((schedule: any, originalRaceIndex: number) => {
    const st = selectedTrackMap.get(schedule.track);
    const trackId = st?.track?.id;
    if (!trackId) return;

    if (!trackGroups.has(trackId)) trackGroups.set(trackId, []);
    trackGroups
      .get(trackId)!
      .push({ schedule, originalRaceIndex, selectedTrack: st });
  });

  // Calculate points progression
  const driverPointsProgression = new Map<
    string,
    { [raceIndex: number]: number }
  >();
  driversData.forEach((d: any) => driverPointsProgression.set(d.id, {}));

  sortedSchedules.forEach((schedule: any, idx: number) => {
    const st = selectedTrackMap.get(schedule.track);
    const raceResultsForTrack = raceResults.filter((r) => r.track === st?.id);
    const driverPointsThisRace = new Map<string, number>();

    raceResultsForTrack.forEach((r) => {
      const curr = driverPointsThisRace.get(r.driver) || 0;
      driverPointsThisRace.set(r.driver, curr + r.points);
    });

    driversData.forEach((d: any) => {
      const cur = driverPointsProgression.get(d.id) || {};
      const prev = idx > 0 ? cur[idx - 1] || 0 : 0;
      const add = driverPointsThisRace.get(d.id) || 0;
      cur[idx] = prev + add;
      driverPointsProgression.set(d.id, cur);
    });
  });

  // Build chart data arrays
  const progressionData: any[] = [];
  const distributionData: any[] = [];
  let completedRoundIndex = 0;

  trackGroups.forEach((schedulesForTrack, trackId) => {
    const hasResults = schedulesForTrack.some(({ schedule }: any) => {
      const st = selectedTrackMap.get(schedule.track);
      const rr = raceResults.filter((r) => r.track === st?.id);
      return rr.length > 0;
    });

    if (!hasResults) return;

    const first = schedulesForTrack[0];
    const st = first.selectedTrack;

    // Progression data point
    const dataPoint: any = {
      race: `${st?.track?.name || "Unknown"} (${new Date(
        first.schedule.date
      ).toLocaleDateString()})`,
      raceIndex: completedRoundIndex,
      date: first.schedule.date,
    };

    driversData.forEach((d: any) => {
      const lastSchedule = schedulesForTrack[schedulesForTrack.length - 1];
      const prog = driverPointsProgression.get(d.id) || {};
      dataPoint[d.name] = prog[lastSchedule.originalRaceIndex] || 0;
    });

    progressionData.push(dataPoint);

    // Distribution data point
    const distRow: any = {
      race: `${st?.track?.name || "Unknown"} (${new Date(
        first.schedule.date
      ).toLocaleDateString()})`,
      trackNameOnly: st?.track?.name || "Unknown",
      selectedTrackId: st?.id,
      date: first.schedule.date,
    };

    driversData.forEach((d: any) => {
      let raw = 0;
      schedulesForTrack.forEach(({ originalRaceIndex }: any) => {
        const prog = driverPointsProgression.get(d.id) || {};
        const prev = originalRaceIndex > 0 ? prog[originalRaceIndex - 1] || 0 : 0;
        const eventPoints = (prog[originalRaceIndex] || 0) - prev;
        raw += Math.max(0, eventPoints);
      });
      distRow[d.name] = raw;
    });

    distributionData.push(distRow);
    completedRoundIndex++;
  });

  // Calculate ranking evolution
  const rankingEvolution: any[] = [];
  progressionData.forEach((raceData, raceIndex) => {
    const isLastRace = raceIndex === progressionData.length - 1;

    const standings = driversData
      .map((d: any) => ({
        driverId: d.id,
        driverName: d.name,
        points: isLastRace ? d.points || 0 : raceData[d.name] || 0,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.driverName.localeCompare(b.driverName);
      });

    const point: any = {
      race: raceData.race,
      raceIndex: raceData.raceIndex,
      date: raceData.date,
    };

    standings.forEach((s, pos) => {
      point[s.driverName] = pos + 1;
    });

    rankingEvolution.push(point);
  });

  return { progressionData, distributionData, rankingEvolution };
}

function enrichDriverData(
  driversData: any[],
  teamMap: Map<string, any>
): DriverRow[] {
  return driversData
    .map((d: any) => {
      const team = teamMap.get(d.team);
      return {
        id: d.id,
        name: d.name,
        points: d.points || 0,
        team: d.team,
        teamName: team?.name || "Unknown",
        teamLogo: extractImageUrl(team?.logo || ""),
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name);
    });
}
