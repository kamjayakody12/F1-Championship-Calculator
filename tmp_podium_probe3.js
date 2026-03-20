const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((l) => !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function parseMs(d) {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

(async () => {
  const [schedulesRes, selectedTracksRes, resultsRes, driversRes] = await Promise.all([
    supabase.from("schedules").select("*"),
    supabase.from("selected_tracks").select("*, track(*)"),
    supabase.from("results").select("*"),
    supabase.from("drivers").select("id,name,teams(name,logo)")
  ]);

  const schedules = schedulesRes.data || [];
  const selectedTracks = selectedTracksRes.data || [];
  const results = resultsRes.data || [];
  const drivers = driversRes.data || [];

  console.log({ schedules: schedules.length, selectedTracks: selectedTracks.length, results: results.length, drivers: drivers.length });

  const effectiveSchedules =
    schedules.length > 0
      ? schedules
      : selectedTracks.map((st, idx) => ({ track: st.id, date: `1970-01-${String(idx + 1).padStart(2, "0")}` }));

  const selectedTrackById = new Map(selectedTracks.map((st) => [st.id, st]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  const schedulesDesc = [...effectiveSchedules]
    .map((s) => ({ s, ms: parseMs(s.date) }))
    .filter((x) => x.ms !== null)
    .sort((a, b) => b.ms - a.ms);

  console.log(
    "top schedule candidates",
    schedulesDesc.slice(0, 3).map((x) => ({ track: x.s.track, date: x.s.date }))
  );

  const nowMs = Date.now();

  let found = null;

  const findWeekend = (preferredType) => {
    for (const { s } of schedulesDesc) {
      const schMs = parseMs(s.date);
      if (schMs === null) continue;
      if (schMs > nowMs) continue;

      const selectedTrack = selectedTrackById.get(s.track);
      if (!selectedTrack?.id) continue;

      const physicalTrackId = selectedTrack.track?.id;
      const candidateTrackIds = Array.from(
        new Set(
          [s.track, selectedTrack.id, physicalTrackId].filter(Boolean).map((x) => String(x))
        )
      );

      const trackResults = results.filter((r) => {
        const rTrack = r.track == null ? "" : String(r.track);
        return candidateTrackIds.includes(rTrack) && r.racefinished !== false;
      });

      if (trackResults.length === 0) continue;

      const eventType = selectedTrack.type || selectedTrack.track?.type || "Race";
      if (preferredType === "Race" && eventType !== "Race") continue;

      found = { selectedTrack, schedule: s, trackResults, eventType };
      return true;
    }
    return false;
  };

  findWeekend("Race");
  if (!found) findWeekend("Any");

  console.log(
    "found",
    found
      ? {
          eventType: found.eventType,
          selectedTrackId: found.selectedTrack.id,
          scheduleTrack: found.schedule.track,
          count: found.trackResults.length
        }
      : null
  );

  if (!found) return;

  const finished = found.trackResults
    .map((r) => {
      const posRaw = r.finishing_position ?? r.position;
      const posNum = Number(posRaw);
      return { driverId: r.driver, position: Number.isFinite(posNum) ? posNum : Infinity };
    })
    .filter((x) => Number.isFinite(x.position) && x.position !== Infinity)
    .sort((a, b) => a.position - b.position);

  const top3 = [];
  const seen = new Set();
  for (const row of finished) {
    const key = String(row.driverId);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    top3.push(row);
    if (top3.length >= 3) break;
  }

  console.log(
    "top3",
    top3.map((t) => ({ pos: t.position, driverId: t.driverId, name: driverById.get(t.driverId)?.name }))
  );
})();
