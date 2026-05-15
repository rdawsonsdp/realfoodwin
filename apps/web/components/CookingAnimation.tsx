"use client";

import { useEffect, useState } from "react";

const FOODS = ["🥕", "🥑", "🍅", "🌽", "🥬", "🍳", "🧄", "🌶️"];

const PHRASES = [
  "Asking our food coach…",
  "Picking the best real-food ingredients…",
  "Reading your kitchen…",
  "Tuning to your weeknight time…",
  "Plating it up…",
];

export function CookingAnimation() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-2xl mx-auto card p-10 animate-fade-up text-center">
      <div className="flex justify-center items-end gap-3 h-16 mb-6">
        {FOODS.map((food, i) => (
          <span
            key={i}
            className="text-3xl md:text-4xl inline-block"
            style={{
              animation: `cook-bounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
            }}
          >
            {food}
          </span>
        ))}
      </div>

      <div className="h-6 relative overflow-hidden">
        {PHRASES.map((p, i) => (
          <p
            key={i}
            className="absolute inset-0 text-ink-soft italic transition-all duration-500"
            style={{
              opacity: i === phraseIdx ? 1 : 0,
              transform:
                i === phraseIdx
                  ? "translateY(0)"
                  : i === (phraseIdx - 1 + PHRASES.length) % PHRASES.length
                    ? "translateY(-100%)"
                    : "translateY(100%)",
            }}
          >
            {p}
          </p>
        ))}
      </div>

      <div className="mt-6 mx-auto h-1 max-w-xs bg-honey/30 rounded-pill overflow-hidden">
        <div
          className="h-full bg-sunrise rounded-pill"
          style={{
            width: "40%",
            animation: "cook-slide 1.6s ease-in-out infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes cook-bounce {
          0%, 100% {
            transform: translateY(0) rotate(0deg) scale(1);
          }
          25% {
            transform: translateY(-12px) rotate(-8deg) scale(1.05);
          }
          50% {
            transform: translateY(-20px) rotate(0deg) scale(1.1);
          }
          75% {
            transform: translateY(-12px) rotate(8deg) scale(1.05);
          }
        }
        @keyframes cook-slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </div>
  );
}
