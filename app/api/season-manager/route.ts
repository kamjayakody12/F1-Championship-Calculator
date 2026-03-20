import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { adminSupabase } from "@/utils/supabase/admin";
import { createNextSeason } from "@/lib/season-lifecycle";
import { finalizeSeasonIfComplete } from "@/lib/season-lifecycle";

async function snapshotSeasonDataset(seasonId: string) {
  const [{ data: teams, error: teamsError }, { data: drivers, error: driversError }] = await Promise.all([
    supabase.from("teams").select("id, name, logo, carImage, points"),
    supabase.from("drivers").select("id, name, team, driver_number, image, points"),
  ]);
  if (teamsError || driversError) {
    throw new Error(teamsError?.message || driversError?.message || "Failed to load teams/drivers");
  }

  const [{ data: selectedTracks, error: selectedTracksError }, { data: schedules, error: schedulesError }, { data: results, error: resultsError }] =
    await Promise.all([
      supabase.from("selected_tracks").select("id, track, type").eq("season_id", seasonId),
      supabase.from("schedules").select("id, track, date").eq("season_id", seasonId),
      supabase
        .from("results")
        .select("id, track, driver, team_id, finishing_position, qualified_position, pole, fastestlap, racefinished")
        .eq("season_id", seasonId),
    ]);

  if (selectedTracksError || schedulesError || resultsError) {
    throw new Error(selectedTracksError?.message || schedulesError?.message || resultsError?.message || "Failed to load season race data");
  }

  // Replace snapshot rows for season with latest user-entered data.
  await Promise.all([
    adminSupabase.from("season_teams").delete().eq("season_id", seasonId),
    adminSupabase.from("season_drivers").delete().eq("season_id", seasonId),
    adminSupabase.from("season_selected_tracks").delete().eq("season_id", seasonId),
    adminSupabase.from("season_schedules").delete().eq("season_id", seasonId),
    adminSupabase.from("season_results").delete().eq("season_id", seasonId),
  ]);

  // Preserve the team a driver was assigned to *within this season*.
  // If the global drivers table has been updated for a future season, we must NOT override
  // the historical season team mapping when snapshotting season_* tables.
  const { data: seasonDriverEntries, error: seasonDriverEntriesError } = await adminSupabase
    .from("season_driver_entries")
    .select("driver_id, team_id")
    .eq("season_id", seasonId);

  if (seasonDriverEntriesError) {
    throw new Error(seasonDriverEntriesError.message || "Failed to load season driver entries");
  }

  const seasonTeamByDriverId = new Map<string, string | null>(
    (seasonDriverEntries || []).map((e: any) => [e.driver_id, e.team_id ?? null])
  );

  const seasonTeams = (teams || []).map((t: any) => ({
    season_id: seasonId,
    team_id: t.id,
    name: t.name,
    logo: t.logo || null,
    car_image: t.carImage || null,
    // New seasons should start at 0 points regardless of the global teams/drivers table.
    points: 0,
  }));
  const seasonDrivers = (drivers || []).map((d: any) => ({
    season_id: seasonId,
    driver_id: d.id,
    team_id: seasonTeamByDriverId.get(d.id) ?? d.team ?? null,
    name: d.name,
    driver_number: d.driver_number || null,
    image: d.image || null,
    // New seasons should start at 0 points regardless of the global teams/drivers table.
    points: 0,
  }));
  const seasonSelectedTracks = (selectedTracks || []).map((st: any) => ({
    season_id: seasonId,
    selected_track_id: st.id,
    track_id: st.track || null,
    type: st.type,
  }));
  const seasonSchedules = (schedules || []).map((s: any) => ({
    season_id: seasonId,
    schedule_id: s.id,
    selected_track_id: s.track,
    date: s.date || null,
  }));
  const seasonResults = (results || []).map((r: any) => ({
    season_id: seasonId,
    result_id: r.id,
    selected_track_id: r.track,
    driver_id: r.driver,
    team_id: r.team_id || null,
    finishing_position: r.finishing_position ?? null,
    qualified_position: r.qualified_position ?? null,
    pole: r.pole ?? false,
    fastestlap: r.fastestlap ?? false,
    racefinished: r.racefinished ?? true,
  }));

  if (seasonTeams.length) {
    const { error } = await adminSupabase.from("season_teams").insert(seasonTeams);
    if (error) throw new Error(error.message);
  }
  if (seasonDrivers.length) {
    const { error } = await adminSupabase.from("season_drivers").insert(seasonDrivers);
    if (error) throw new Error(error.message);
  }
  if (seasonSelectedTracks.length) {
    const { error } = await adminSupabase.from("season_selected_tracks").insert(seasonSelectedTracks);
    if (error) throw new Error(error.message);
  }
  if (seasonSchedules.length) {
    const { error } = await adminSupabase.from("season_schedules").insert(seasonSchedules);
    if (error) throw new Error(error.message);
  }
  if (seasonResults.length) {
    const { error } = await adminSupabase.from("season_results").insert(seasonResults);
    if (error) throw new Error(error.message);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");

  if (!seasonId) {
    const { data, error } = await supabase.from("seasons").select("*").order("season_number", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  const [season, teams, drivers, selectedTracks, schedules, results] = await Promise.all([
    supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle(),
    supabase.from("season_teams").select("*").eq("season_id", seasonId),
    supabase.from("season_drivers").select("*").eq("season_id", seasonId),
    supabase.from("season_selected_tracks").select("*").eq("season_id", seasonId),
    supabase.from("season_schedules").select("*").eq("season_id", seasonId),
    supabase.from("season_results").select("*").eq("season_id", seasonId),
  ]);

  if (season.error || teams.error || drivers.error || selectedTracks.error || schedules.error || results.error) {
    return NextResponse.json({ error: "Failed to fetch season dataset" }, { status: 500 });
  }

  return NextResponse.json({
    season: season.data,
    teams: teams.data || [],
    drivers: drivers.data || [],
    selectedTracks: selectedTracks.data || [],
    schedules: schedules.data || [],
    results: results.data || [],
  });
}

export async function POST() {
  try {
    const created = await createNextSeason();
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create season" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { seasonId, finalize } = await request.json();
  if (!seasonId) return NextResponse.json({ error: "seasonId is required" }, { status: 400 });

  try {
    await snapshotSeasonDataset(seasonId);

    if (finalize) {
      const outcome = await finalizeSeasonIfComplete(seasonId);
      if (!outcome.finalized) {
        return NextResponse.json(
          { error: "Season cannot be finalized yet. Ensure all selected tracks have results." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to save season dataset" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { seasonId } = await request.json();
  if (!seasonId) return NextResponse.json({ error: "seasonId is required" }, { status: 400 });

  const { error } = await adminSupabase.from("seasons").delete().eq("id", seasonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
