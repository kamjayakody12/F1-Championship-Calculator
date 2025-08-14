import { supabase } from "@/lib/db";

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

function makeTileGradient(hsl: string): string {
  // Expecting hsl(h, s%, l%)
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/);
  if (!m) return hsl;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  const start = `hsl(${h}, ${s}%, ${Math.max(0, l - 8)}%)`;
  const end = `hsl(${h}, ${Math.max(20, s - 25)}%, ${Math.max(0, l - 20)}%)`;
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
}

// Add alpha to an hsl color string (e.g., "hsl(220, 100%, 30%)" -> "hsl(220 100% 30% / 0.4)")
function addAlphaToHsl(color: string, alpha: number): string {
  const m = color.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/);
  if (!m) return color;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return `hsl(${h} ${s}% ${l}% / ${alpha})`;
}

export default async function DriverTilesPage() {
  const { data: drivers } = await supabase
    .from("drivers")
    .select("*, teams(name, logo)");

  if (!drivers) {
    return (
      <div className="p-4 md:p-8">Failed to load drivers.</div>
    );
  }

  // Sort by points descending if available
  const sorted = [...drivers].sort((a: any, b: any) => (b.points || 0) - (a.points || 0));

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sorted.map((driver: any) => {
          const teamName: string = driver.teams?.name || "";
          const teamLogoUrl: string = extractImageUrl(driver.teams?.logo || "");
          const driverImg: string = driver.image || "";
          const base = teamColorMap[teamName] || "hsl(0, 0%, 20%)";
          // Black base with subtle team color glow from left → right
          const overlay = addAlphaToHsl(base, 0.25);
          const gradient = `linear-gradient(135deg, ${overlay} 0%, rgba(0,0,0,0.0) 55%)`;
          // Keep all portraits at the same visual scale to avoid size inconsistencies
          const nameLc = (driver.name || '').trim().toLowerCase();
          const scale = 1.0;
          // Extra push for specific images that still need more right alignment
          const extraRight = nameLc === 'dilon' ? 40 : 0;
          const nudgeRightPx = 24 + extraRight;
          const isMclaren = teamName?.toLowerCase() === 'mclaren';
          const logoW = isMclaren ? 320 : 420;
          const logoH = isMclaren ? 180 : 240;
          const logoOpacity = isMclaren ? 0.4 : 0.25;
          const logoFilter = isMclaren ? 'none' : 'blur(0.25px)';
          return (
            <div
              key={driver.id}
              className="relative overflow-hidden rounded-2xl shadow"
              style={{
                background: `#0b0b0c`,
                backgroundImage: gradient,
                minHeight: 340,
                border: `1px solid ${addAlphaToHsl(base, 0.45)}`,
              }}
            >
              {/* Team logo sits mostly to the left of the driver, fading underneath as it approaches the driver (right) */}
              {teamLogoUrl ? (
                <img
                  src={teamLogoUrl}
                  alt={`${teamName} logo`}
                  className="pointer-events-none select-none absolute right-20 top-1/2 -translate-y-1/2 z-0"
                  style={{
                    width: logoW,
                    height: logoH,
                    objectFit: "contain",
                    WebkitMaskImage:
                      'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                    maskImage:
                      'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                    filter: logoFilter,
                    opacity: logoOpacity,
                    transform: 'translateX(4%)',
                  }}
                />
              ) : null}

              {/* Driver image centered */}
              {driverImg ? (
                <img
                  src={driverImg}
                  alt={`${driver.name}`}
                  className="pointer-events-none select-none absolute right-0 bottom-0 z-[2]"
                  style={{
                    height: 330,
                    objectFit: "contain",
                    opacity: 0.96,
                    WebkitMaskImage:
                      'radial-gradient(140% 140% at 75% 70%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0) 100%)',
                    maskImage:
                      'radial-gradient(140% 140% at 75% 70%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0) 100%)',
                    transform: `translateX(${nudgeRightPx}px)`,
                  }}
                />
              ) : null}

              {/* Text content */}
              <div className="relative z-[1] p-6 pr-56 flex flex-col gap-1">
                <div className="text-white/90 text-xl font-semibold leading-tight">
                  {driver.name}
                </div>
                <div className="text-white/70 text-sm">
                  {teamName}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


