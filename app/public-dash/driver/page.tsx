import { supabase } from "@/lib/db";
import Link from "next/link";
import { cookies } from "next/headers";
import { PUBLIC_SEASON_COOKIE_NAME } from "@/lib/public-season";

function extractImageUrl(htmlString: string): string {
  if (!htmlString) return "";
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : "";
}

const teamColorMap: { [key: string]: string } = {
  "Red Bull": "hsl(220, 100%, 30%)",
  Mercedes: "hsl(180, 100%, 50%)",
  Mclaren: "hsl(25, 100%, 50%)",
  Ferrari: "hsl(0, 100%, 50%)",
  Sauber: "hsl(120, 100%, 40%)",
  "Aston Martin": "hsl(120, 100%, 25%)",
  RB: "hsl(230, 70%, 22%)",
  Haas: "hsl(0, 0%, 50%)",
  Alpine: "hsl(300, 100%, 35%)",
  Williams: "hsl(205, 90%, 50%)",
};

// Add alpha to an hsl color string (e.g., "hsl(220, 100%, 30%)" -> "hsl(220 100% 30% / 0.4)")
function addAlphaToHsl(color: string, alpha: number): string {
  const m = color.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/);
  if (!m) return color;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return `hsl(${h} ${s}% ${l}% / ${alpha})`;
}

function setHslLightness(color: string, lightnessPercent: number): string {
  // Normalize perceived brightness while keeping the team hue/saturation.
  const m = color.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/);
  if (!m) return color;
  const h = Number(m[1]);
  const s = Number(m[2]);
  return `hsl(${h}, ${s}%, ${lightnessPercent}%)`;
}

export default async function DriverTilesPage({
  searchParams,
}: {
  searchParams?: Promise<{ seasonId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const seasonId =
    resolvedSearchParams?.seasonId ||
    cookieStore.get(PUBLIC_SEASON_COOKIE_NAME)?.value ||
    "";
  const [{ data: drivers }, { data: teamsData }, { data: seasonEntries }] = await Promise.all([
    supabase.from("drivers").select("*"),
    supabase.from("teams").select("id, name, logo, carImage"),
    (seasonId
      ? supabase
          .from("season_driver_entries")
          .select("driver_id, team_id")
          .eq("season_id", seasonId)
      : Promise.resolve({ data: [] as any[] })),
  ]);

  if (!drivers) {
    return (
      <div className="p-4 md:p-8">Failed to load drivers.</div>
    );
  }

  const teamById = new Map((teamsData || []).map((t: any) => [String(t.id), t]));
  const seasonTeamByDriverId = new Map<string, string | null>(
    ((seasonEntries as any[]) || []).map((e: any) => [String(e.driver_id), e.team_id || null])
  );

  const normalizedDrivers = (drivers || []).map((d: any) => {
    const resolvedTeamId = seasonId
      ? (seasonTeamByDriverId.get(String(d.id)) ?? null)
      : (d.team || null);
    const resolvedTeam = resolvedTeamId ? teamById.get(String(resolvedTeamId)) : null;
    return {
      ...d,
      team: resolvedTeamId,
      teams: resolvedTeam
        ? {
            name: resolvedTeam.name,
            logo: resolvedTeam.logo,
            carImage: resolvedTeam.carImage,
          }
        : null,
    };
  });

  const teamAssignedDrivers = normalizedDrivers.filter((d: any) => !!d.team);
  const sortedDrivers = [...teamAssignedDrivers].sort((a: any, b: any) => (b.points || 0) - (a.points || 0));

  // Group by team (expects drivers table to have a `team` FK)
  const teamMap = new Map<
    string,
    {
      teamName: string;
      teamLogoUrl: string;
      teamCarUrl: string;
      base: string;
      drivers: any[];
    }
  >();

  for (const d of sortedDrivers) {
    const teamId = String(d.team ?? d.teams?.name ?? "unknown-team");
    const teamName: string = d.teams?.name || "Unknown";
    const teamLogoUrl: string = extractImageUrl(d.teams?.logo || "");
    const rawCar: string = d.teams?.carImage || "";
    const teamCarUrl: string = extractImageUrl(rawCar) || rawCar;
    const base = teamColorMap[teamName] || "hsl(0, 0%, 20%)";

    const existing = teamMap.get(teamId);
    if (existing) {
      existing.drivers.push(d);
    } else {
      teamMap.set(teamId, { teamName, teamLogoUrl, teamCarUrl, base, drivers: [d] });
    }
  }

  const teams = Array.from(teamMap.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName)
  );

  function isSpecialTeam(teamName: string): boolean {
    const isMclaren = teamName?.toLowerCase() === "mclaren";
    const isRB = teamName === "RB";
    const isStakeF1 = teamName === "Stake F1 Team";
    return isMclaren || isRB || isStakeF1;
  }

  function DriverCard({
    driver,
    base,
    side,
    teamName,
    embedded = false,
  }: {
    driver: any;
    base: string;
    side: "left" | "right";
    teamName: string;
    embedded?: boolean;
  }) {
    const driverImg: string = driver?.image || "";
    // Corner fade (subtle, not a hard glow).
    const baseCornerFadeLeft = addAlphaToHsl(
      setHslLightness(base, teamName === "RB" ? 42 : 36),
      teamName === "RB" ? 0.36 : 0.28
    );
    const baseCornerFadeRight = addAlphaToHsl(
      setHslLightness(base, teamName === "RB" ? 40 : 34),
      teamName === "RB" ? 0.32 : 0.24
    );
    const baseTop = setHslLightness(base, 30);
    const overlay = addAlphaToHsl(baseTop, 0.25);
    // Side-aware gradient so "team color fade" doesn't appear at the top-right of right-side tiles.
    const gradient =
      side === "left"
        ? `linear-gradient(to bottom right, ${overlay} 0%, rgba(0,0,0,0.0) 55%)`
        : `linear-gradient(to top left, ${overlay} 0%, rgba(0,0,0,0.0) 55%)`;
    const driverNumber = driver?.driver_number ?? null;
    const numberFill = addAlphaToHsl(
      teamName === "RB" ? setHslLightness(base, 60) : base,
      teamName === "RB" ? 0.38 : 0.22
    );
    const rbGlowColor = addAlphaToHsl(setHslLightness(base, 60), 1);

    const containerStyles = embedded
      ? {
          backgroundColor: undefined,
          backgroundImage: `${gradient}, radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "auto, 12px 12px",
          backgroundPosition: "center, 0 0",
          minHeight: 340,
          border: undefined,
          ["--driver-tile-glow" as any]: teamName === "RB" ? rbGlowColor : addAlphaToHsl(base, 0.95),
          ["--driver-tile-glow-blur" as any]: teamName === "RB" ? "44px" : "30px",
        }
      : {
          backgroundColor: "transparent",
          backgroundImage: `${gradient}, radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "auto, 12px 12px",
          backgroundPosition: "center, 0 0",
          minHeight: 340,
          border: `1px solid ${addAlphaToHsl(baseTop, 0.45)}`,
          ["--driver-tile-glow" as any]: teamName === "RB" ? rbGlowColor : addAlphaToHsl(base, 0.95),
          ["--driver-tile-glow-blur" as any]: teamName === "RB" ? "44px" : "30px",
        };

    return (
      <div
        className={`group relative overflow-hidden ${embedded ? "" : "rounded-2xl shadow"} w-full driver-tile-beam-parent ${side === "left" ? "driver-card-left" : "driver-card-right"}`}
        style={containerStyles as any}
      >
        {/* Team-colored corner fade (different per side) */}
        {side === "left" ? (
          <div
            className="pointer-events-none absolute top-0 left-0 w-28 h-28 z-0"
            style={{
              background: `radial-gradient(circle at 0% 0%, ${baseCornerFadeLeft} 0%, rgba(0,0,0,0) 78%)`,
            }}
          />
        ) : (
          <div
            className="pointer-events-none absolute bottom-0 right-0 w-24 h-24 z-0"
            style={{
              background: `radial-gradient(circle at 100% 100%, ${baseCornerFadeRight} 0%, rgba(0,0,0,0) 82%)`,
            }}
          />
        )}

        {/* Driver number (background, behind driver image) */}
        <div
          className="driver-number-beam pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 leading-none transition-transform duration-200 group-hover:scale-[1.03]"
          style={{
            fontSize: 240,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "-0.06em",
            color: numberFill,
            WebkitTextStroke: "0px transparent",
            textShadow: "0 14px 40px rgba(0,0,0,0.55)",
            fontFamily:
              '"Arial Black", Impact, Haettenschweiler, "Franklin Gothic Heavy", system-ui, sans-serif',
            opacity: driverNumber ? 1 : 0.35,
          }}
        >
          {driverNumber ?? "—"}
        </div>

        {driverImg ? (
          <img
            src={driverImg}
            alt={`${driver?.name || "Driver"}`}
            className="pointer-events-none select-none absolute bottom-0 -translate-x-1/2 z-[2]"
            style={{
              // Push driver toward the inner edge (center gap between teammates)
              left: side === "left" ? "72%" : "28%",
              height: 330,
              objectFit: "contain",
              opacity: 0.96,
              WebkitMaskImage:
                "radial-gradient(140% 140% at 75% 70%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0) 100%)",
              maskImage:
                "radial-gradient(140% 140% at 75% 70%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0) 100%)",
            }}
          />
        ) : null}

        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 z-[3]"
          style={{
            height: embedded ? 56 : 80,
            background: embedded
              ? "linear-gradient(to top, rgba(11,11,12,0.72) 0%, rgba(11,11,12,0.28) 45%, rgba(11,11,12,0) 100%)"
              : "linear-gradient(to top, rgba(11,11,12,0.96) 0%, rgba(11,11,12,0.55) 35%, rgba(11,11,12,0) 100%)",
          }}
        />

        <div
          className="driver-name-beam absolute top-5 z-[5] flex flex-col gap-1 transition-transform duration-200 group-hover:scale-[1.06]"
          style={{
            left: side === "left" ? 18 : "auto",
            right: side === "right" ? 18 : "auto",
            textAlign: side === "right" ? "right" : "left",
          }}
        >
          <div
            className="text-white/90 leading-tight"
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              fontFamily:
                '"Arial Black", Impact, Haettenschweiler, "Franklin Gothic Heavy", system-ui, sans-serif',
              textShadow: "0 2px 0 rgba(0,0,0,0.35)",
            }}
          >
            {driver?.name || "TBD"}
          </div>
        </div>
      </div>
    );
  }

  function EmptyDriverCard({ base }: { base: string }) {
    const overlay = addAlphaToHsl(base, 0.15);
    const gradient = `linear-gradient(135deg, ${overlay} 0%, rgba(0,0,0,0.0) 55%)`;

    return (
      <div
        className="relative overflow-hidden rounded-2xl shadow w-full flex items-center justify-center"
        style={{
          backgroundColor: "transparent",
          backgroundImage: gradient,
          minHeight: 340,
          border: `1px dashed ${addAlphaToHsl(base, 0.45)}`,
        }}
      >
        <div className="text-white/50 text-sm">No teammate</div>
      </div>
    );
  }

  function TeamLogoCard({
    teamName,
    teamLogoUrl,
    teamCarUrl,
    base,
    embedded = false,
  }: {
    teamName: string;
    teamLogoUrl: string;
    teamCarUrl: string;
    base: string;
    embedded?: boolean;
  }) {
    const special = isSpecialTeam(teamName);
    const baseTop = setHslLightness(base, 30);

    return (
      <div
        className={`relative overflow-hidden ${embedded ? "" : "rounded-2xl shadow"} w-full flex flex-col items-center justify-start gap-3 driver-team-logo-beam-parent pt-6 pb-28`}
        style={{
          backgroundColor: "transparent",
          backgroundImage: embedded
            ? `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`
            : undefined,
          backgroundSize: embedded ? "12px 12px" : undefined,
          backgroundPosition: embedded ? "center, 0 0" : undefined,
          minHeight: 340,
          border: embedded ? undefined : `1px solid ${addAlphaToHsl(baseTop, 0.45)}`,
        }}
      >
        {teamLogoUrl ? (
          <img
            src={teamLogoUrl}
            alt={`${teamName} logo`}
            className="pointer-events-none select-none object-contain driver-team-logo-beam absolute inset-1 z-0"
            style={{
              width: "115%",
              height: "115%",
              opacity: 0.22,
              // Use the team's base color for the animated glow
              ["--driver-team-logo-glow" as any]:
                teamName === "RB"
                  ? addAlphaToHsl(setHslLightness(base, 60), 0.95)
                  : addAlphaToHsl(base, 0.9),
              // Hide/disappear the bottom part of the faded logo where the car overlaps
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,1) 55%, rgba(0,0,0,1) 100%)",
              maskImage:
                "linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,1) 55%, rgba(0,0,0,1) 100%)",
            }}
          />
        ) : (
          <span className="inline-block w-24 h-24 bg-white/10 rounded-2xl" />
        )}
        {/* Single team car in the middle tile */}
        {teamCarUrl ? (
          <img
            src={teamCarUrl}
            alt={`${teamName} car`}
            className="pointer-events-none select-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[2] block"
            style={{
              height: 110,
              width: "86%",
              objectFit: "contain",
              opacity: 1,
              filter: "drop-shadow(0 14px 30px rgba(0,0,0,0.55))",
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 gap-6">
        {teams.map((t) => {
          const left = t.drivers[0] || null;
          const right = t.drivers[1] || null;

          return (
            <div
              key={`${t.teamName}-${t.drivers?.[0]?.id || "team"}`}
              className="team-row-beam-parent relative overflow-hidden rounded-2xl shadow border border-border bg-transparent"
              style={{ minHeight: 340 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[0.85fr_1.3fr_0.85fr] items-stretch">
                {left ? (
                  <DriverCard
                    driver={left}
                    base={t.base}
                    side="left"
                    teamName={t.teamName}
                    embedded
                  />
                ) : (
                  <EmptyDriverCard base={t.base} />
                )}

                <TeamLogoCard
                  teamName={t.teamName}
                  teamLogoUrl={t.teamLogoUrl}
                  teamCarUrl={t.teamCarUrl}
                  base={t.base}
                  embedded
                />

                {right ? (
                  <DriverCard
                    driver={right}
                    base={t.base}
                    side="right"
                    teamName={t.teamName}
                    embedded
                  />
                ) : (
                  <EmptyDriverCard base={t.base} />
                )}
              </div>

              {/* Overlay hit areas for a single-tile interaction model */}
              <Link
                href={`/public-dash/driver-stats?driverId=${encodeURIComponent(left?.id || "")}`}
                className="team-zone-left hidden md:block absolute inset-y-0 left-0 z-20"
                style={{ width: "30%" }}
                aria-label={`Open ${left?.name || "left driver"} stats`}
              />
              <Link
                href={`/public-dash/constructor-stats?team=${encodeURIComponent(t.teamName)}`}
                className="team-zone-middle hidden md:block absolute inset-y-0 z-20"
                style={{ left: "30%", width: "40%" }}
                aria-label={`Open ${t.teamName} constructor stats`}
              />
              <Link
                href={`/public-dash/driver-stats?driverId=${encodeURIComponent(right?.id || "")}`}
                className="team-zone-right hidden md:block absolute inset-y-0 right-0 z-20"
                style={{ width: "30%" }}
                aria-label={`Open ${right?.name || "right driver"} stats`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


