"use client";

import { useEffect, useMemo, useState } from "react";

// Quick burst of food emoji from the center of the screen. Fires once per
// `active` toggle (false → true). No raining/falling — pieces shoot outward
// on a random angle, fade, and disappear in under a second.

const FOODS = [
  "🫐", "🍓", "🍊", "🍎", "🥕", "🥬", "🥑", "🍋", "🍇",
  "🌶️", "🍑", "🥝", "🍐", "🍌", "🍅", "🌽", "🥦",
];

interface Piece {
  id: number;
  food: string;
  size: number;
  /** Distance from origin in vmin. */
  distance: number;
  /** Direction in degrees. */
  angle: number;
  rotateEnd: number;
  delay: number;
}

interface Props {
  active: boolean;
  count?: number;
  onDone?: () => void;
}

export function FoodConfetti({ active, count = 22, onDone }: Props) {
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (active) setRunKey((k) => k + 1);
  }, [active]);

  const pieces = useMemo<Piece[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      food: FOODS[Math.floor(Math.random() * FOODS.length)]!,
      size: 22 + Math.random() * 18,
      distance: 22 + Math.random() * 22,
      angle: Math.random() * 360,
      rotateEnd: Math.random() * 720 - 360,
      delay: Math.random() * 0.05,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(t);
  }, [active, runKey, onDone]);

  if (!active || pieces.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = `${Math.cos(rad) * p.distance}vmin`;
        const ty = `${Math.sin(rad) * p.distance}vmin`;
        return (
          <span
            key={`${runKey}-${p.id}`}
            className="absolute select-none"
            style={
              {
                left: "50%",
                top: "50%",
                fontSize: `${p.size}px`,
                willChange: "transform, opacity",
                animation: `food-burst 800ms ${p.delay}s cubic-bezier(0.16, 0.84, 0.44, 1) forwards`,
                ["--tx"]: tx,
                ["--ty"]: ty,
                ["--re"]: `${p.rotateEnd}deg`,
              } as React.CSSProperties
            }
          >
            {p.food}
          </span>
        );
      })}
      <style jsx global>{`
        @keyframes food-burst {
          0% {
            transform: translate(-50%, -50%) scale(0.4) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate(
                calc(-50% + var(--tx, 0)),
                calc(-50% + var(--ty, 0))
              )
              scale(1) rotate(var(--re, 360deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
