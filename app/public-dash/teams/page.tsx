"use client";

import { supabase } from "@/lib/db";
import { useEffect, useState } from "react";

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

function addAlphaToHsl(color: string, alpha: number): string {
  const m = color.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/);
  if (!m) return color;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  return `hsl(${h} ${s}% ${l}% / ${alpha})`;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: teamsData } = await supabase.from("teams").select("*");
        
        setTeams(teamsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4 md:p-8">Loading teams...</div>;
  }

  if (!teams.length) {
    return <div className="p-4 md:p-8">Failed to load teams.</div>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {teams.map((team: any) => {
          const teamName: string = team.name || "";
          const teamLogoUrl: string = extractImageUrl(team.logo || "");
          // carImage can be stored either as a raw URL or an <img> HTML snippet; support both
          const rawCar: string = team.carImage || "";
          const parsedCar = extractImageUrl(rawCar);
          const carImageUrl: string = parsedCar || rawCar;
                     const base = teamColorMap[teamName] || "hsl(0, 0%, 20%)";
           const overlay = addAlphaToHsl(base, 0.25);
           const gradient = `linear-gradient(135deg, ${overlay} 0%, rgba(0,0,0,0.0) 55%)`;

          return (
            <div
              key={team.id}
              className="relative overflow-hidden rounded-2xl shadow"
              style={{
                background: `#0b0b0c`,
                backgroundImage: gradient,
                minHeight: 220,
                border: `1px solid ${addAlphaToHsl(base, 0.45)}`,
              }}
            >
              {/* Team logo watermark (left → fade under to right) */}
              {teamLogoUrl ? (
                <img
                  src={teamLogoUrl}
                  alt={`${teamName} logo`}
                  className="pointer-events-none select-none absolute right-0 top-1/2 -translate-y-1/2 opacity-25 z-0"
                  style={{
                    width: (teamName === 'RB' || teamName === 'Stake F1 Team') ? 400 : 320,
                    height: (teamName === 'RB' || teamName === 'Stake F1 Team') ? 225 : 180,
                    objectFit: "contain",
                    WebkitMaskImage:
                      'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                    maskImage:
                      'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0) 100%)',
                    filter: 'blur(0.25px)',
                    transform: 'translateX(4%)',
                  }}
                />
              ) : null}

              {/* Car image at the bottom-left (user can provide direct URL to carImage) */}
              {carImageUrl ? (
                <img
                  className="absolute h-[100px] left-0 bottom-0 z-[1] block"
                  src={carImageUrl}
                  alt={`${teamName} car`}
                  style={{
                    maxWidth: '75%',
                    objectFit: 'contain',
                    objectPosition: 'left bottom'
                  }}
                />
              ) : null}



              {/* Text content */}
              <div className="relative z-[2] p-4 flex flex-col gap-1">
                <div className="text-white/90 text-lg font-semibold leading-tight">{teamName}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


