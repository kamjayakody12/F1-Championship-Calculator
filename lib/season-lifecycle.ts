import { supabase } from "@/lib/db";
import { adminSupabase } from "@/utils/supabase/admin";

type SeasonRow = {
  id: string;
  season_number: number;
  is_finalized?: boolean | null;
};

async function snapshotSeasonEntries(seasonId: string): Promise<void> {
  const { data: drivers, error: driversError } = await supabase
    .from("drivers")
    .select("id, team");
  if (driversError) throw new Error(driversError.message);

  const entries = (drivers || []).map((d: any) => ({
    season_id: seasonId,
    driver_id: d.id,
    team_id: d.team || null,
    is_active: true,
  }));
  if (entries.length === 0) return;

  const { error: upsertError } = await adminSupabase
    .from("season_driver_entries")
    .upsert(entries, { onConflict: "season_id,driver_id" });
  if (upsertError) throw new Error(upsertError.message);
}

export async function getLatestSeason(): Promise<SeasonRow | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, season_number, is_finalized")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function createNextSeason(): Promise<SeasonRow> {
  const latest = await getLatestSeason();
  const seasonNumber = latest ? Number(latest.season_number) + 1 : 1;

  const { data, error } = await adminSupabase
    .from("seasons")
    .insert([
      {
        season_number: seasonNumber,
        is_finalized: false,
        winning_driver: null,
        winning_constructor: null,
      },
    ])
    .select("id, season_number, is_finalized")
    .single();
  if (error) throw new Error(error.message);
  await snapshotSeasonEntries((data as SeasonRow).id);
  return data as SeasonRow;
}

export async function resolveOrCreateActiveSeason(preferredSeasonId?: string | null): Promise<SeasonRow> {
  if (preferredSeasonId) {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, season_number, is_finalized")
      .eq("id", preferredSeasonId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as SeasonRow;
  }

  const { data, error } = await supabase
    .from("seasons")
    .select("id, season_number, is_finalized")
    .eq("is_finalized", false)
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as SeasonRow;

  return createNextSeason();
}

export async function getSeasonTeamForDriver(seasonId: string, driverId: string): Promise<string | null> {
  const { data: entry, error: entryError } = await supabase
    .from("season_driver_entries")
    .select("team_id")
    .eq("season_id", seasonId)
    .eq("driver_id", driverId)
    .maybeSingle();
  if (entryError) throw new Error(entryError.message);
  if (entry) return entry.team_id || null;

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("team")
    .eq("id", driverId)
    .maybeSingle();
  if (driverError) throw new Error(driverError.message);

  const teamId = driver?.team || null;
  const { error: upsertError } = await adminSupabase
    .from("season_driver_entries")
    .upsert(
      [{ season_id: seasonId, driver_id: driverId, team_id: teamId, is_active: true }],
      { onConflict: "season_id,driver_id" }
    );
  if (upsertError) throw new Error(upsertError.message);
  return teamId;
}

export async function assertSeasonAllowsRaceListMutation(seasonId: string): Promise<void> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, is_finalized")
    .eq("id", seasonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Season not found");
  if (data.is_finalized) {
    throw new Error("Season is finalized. You cannot add or remove races for this season.");
  }
}

export async function finalizeSeasonIfComplete(seasonId: string): Promise<{ finalized: boolean }> {
  const { data: tracks, error: tracksError } = await supabase
    .from("selected_tracks")
    .select("id")
    .eq("season_id", seasonId);
  if (tracksError) throw new Error(tracksError.message);

  if (!tracks || tracks.length === 0) return { finalized: false };

  const selectedTrackIds = tracks.map((t) => t.id);
  const { data: finishedTracks, error: finishedTracksError } = await supabase
    .from("results")
    .select("track")
    .eq("season_id", seasonId)
    .in("track", selectedTrackIds);
  if (finishedTracksError) throw new Error(finishedTracksError.message);

  const finishedTrackSet = new Set((finishedTracks || []).map((r: any) => r.track));
  if (finishedTrackSet.size < selectedTrackIds.length) return { finalized: false };

  const { data: rules, error: rulesError } = await supabase
    .from("rules")
    .select("polegivespoint, fastestlapgivespoint")
    .eq("id", 1)
    .single();
  if (rulesError) throw new Error(rulesError.message);

  const { data: seasonResults, error: seasonResultsError } = await supabase
    .from("results")
    .select("track, driver, team_id, finishing_position, pole, fastestlap, racefinished, selected_tracks(type)")
    .eq("season_id", seasonId);
  if (seasonResultsError) throw new Error(seasonResultsError.message);

  const racePoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1];
  const driverTotals = new Map<string, number>();
  const constructorTotals = new Map<string, number>();

  for (const row of seasonResults || []) {
    const driverId = (row as any).driver as string | null;
    if (!driverId) continue;

    if ((row as any).racefinished === false) {
      if (!driverTotals.has(driverId)) driverTotals.set(driverId, 0);
      continue;
    }

    const type = ((row as any).selected_tracks as any)?.type === "Sprint" ? "Sprint" : "Race";
    const mapping = type === "Sprint" ? sprintPoints : racePoints;
    const maxPositions = type === "Sprint" ? 8 : 10;
    const pos = Number((row as any).finishing_position || 0);
    const base = pos > 0 && pos <= maxPositions ? mapping[pos - 1] : 0;
    const bonus =
      (rules.polegivespoint && (row as any).pole ? 1 : 0) +
      (rules.fastestlapgivespoint && (row as any).fastestlap ? 1 : 0);
    const earned = base + bonus;

    driverTotals.set(driverId, (driverTotals.get(driverId) || 0) + earned);
    const teamId = (row as any).team_id as string | null;
    if (teamId) {
      constructorTotals.set(teamId, (constructorTotals.get(teamId) || 0) + earned);
    }
  }

  let winningDriver: string | null = null;
  let maxDriverPts = -1;
  for (const [driverId, pts] of driverTotals.entries()) {
    if (pts > maxDriverPts) {
      maxDriverPts = pts;
      winningDriver = driverId;
    }
  }

  let winningConstructor: string | null = null;
  let maxConstructorPts = -1;
  for (const [teamId, pts] of constructorTotals.entries()) {
    if (pts > maxConstructorPts) {
      maxConstructorPts = pts;
      winningConstructor = teamId;
    }
  }

  const { error: updateError } = await adminSupabase
    .from("seasons")
    .update({
      is_finalized: true,
      finalized_at: new Date().toISOString(),
      winning_driver: winningDriver,
      winning_constructor: winningConstructor,
    })
    .eq("id", seasonId);
  if (updateError) throw new Error(updateError.message);

  return { finalized: true };
}
