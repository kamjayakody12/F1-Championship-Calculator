"use client";

import { useEffect, useMemo, useState } from "react";

type Particle = {
  left: string;
  delay: string;
  duration: string;
  size: number;
  color: string;
  rotate: string;
};

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#7C3AED", "#60A5FA", "#F97316", "#22C55E"];

export default function SeasonConfetti() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 70 }).map(() => ({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.2}s`,
        duration: `${3.8 + Math.random() * 2.4}s`,
        size: 6 + Math.floor(Math.random() * 7),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: `${Math.floor(Math.random() * 360)}deg`,
      })),
    []
  );

  if (!mounted) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
        {particles.map((p, i) => (
          <span
            key={`confetti-${i}`}
            className="absolute top-[-12vh] confetti-piece"
            style={{
              left: p.left,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
              transform: `rotate(${p.rotate})`,
            }}
          />
        ))}
      </div>
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-12vh) rotate(0deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translateY(115vh) rotate(540deg);
            opacity: 0.95;
          }
        }

        .confetti-piece {
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-iteration-count: 1;
          border-radius: 2px;
          will-change: transform, opacity;
        }
      `}</style>
    </>
  );
}

