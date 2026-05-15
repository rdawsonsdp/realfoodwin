"use client";

import { useEffect, useMemo, useState } from "react";

// Falling-food confetti — fires when the user completes a rating, save, or
// made-it action. Emoji-based, fully CSS-animated, no deps. Each piece gets
// per-instance CSS variables so we share a single keyframe.

const FOODS = [
  "🫐", "🍓", "🍊", "🍎", "🥕", "🥬", "🥑", "🍋", "🍇",
  "🌶️", "🍑", "🥝", "🍐", "🍌", "🍅", "🌽", "🥦",
];

interface Piece {
  id: number;
  food: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotateStart: number;
  rotateEnd: number;
}

interface Props {
  active: boolean;
  count?: number;
  onDone?: () => void;
}

// Renders nothing when inactive. When toggled active, fires once. Re-fires when
// the `active` prop transitions false→true (parent should toggle).

export function FoodConfetti({ active, count = 36, onDone }: Props) {
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (active) {
      setRunKey((k) => k + 1);
    }
  }, [active]);

  // Generate pieces fresh each run so each celebration looks different.
  const pieces = useMemo<Piece[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      food: FOODS[Math.floor(Math.random() * FOODS.length)]!,
      x: Math.random() * 100,
      size: 18 + Math.random() * 26,
      delay: Math.random() * 0.7,
      duration: 2.5 + Math.random() * 2.5,
      drift: -25 + Math.random() * 50,
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 720 - 360,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onDone?.(), 5500);
    return () => clearTimeout(t);
  }, [active, runKey, onDone]);

  if (!active || pieces.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <span
          key={`${runKey}-${p.id}`}
          className="absolute select-none"
          style={
            {
              left: `${p.x}vw`,
              top: "-10vh",
              fontSize: `${p.size}px`,
              willChange: "transform, opacity",
              animation: `food-fall ${p.duration}s ${p.delay}s ease-in forwards`,
              ["--rs"]: `${p.rotateStart}deg`,
              ["--re"]: `${p.rotateEnd}deg`,
              ["--drift"]: `${p.drift}vw`,
            } as React.CSSProperties
          }
        >
          {p.food}
        </span>
      ))}
      <style jsx global>{`
        @keyframes food-fall {
          0% {
            transform: translate(0, 0) rotate(var(--rs, 0deg));
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--drift, 0vw), 115vh) rotate(var(--re, 360deg));
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
