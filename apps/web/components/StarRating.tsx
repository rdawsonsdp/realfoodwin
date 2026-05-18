"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { FoodConfetti } from "./FoodConfetti";

type Size = "sm" | "md" | "lg";

interface Props {
  targetType: "recipe" | "swap" | "variant";
  targetId: string;
  targetLabel?: string;
  initialStars?: number;
  averageStars?: number;
  ratingCount?: number;
  size?: Size;
  // When the user rates, you can refresh server-rendered pages by passing this.
  onRated?: (stars: number) => void;
  isLoggedIn?: boolean;
  // Opt out of the FoodConfetti celebration on 4-5 stars. Used in lists where
  // confetti would be too much (e.g. the home page recent-swaps row).
  celebrateOnRate?: boolean;
}

const SIZES: Record<Size, { star: string; gap: string }> = {
  sm: { star: "text-base leading-none", gap: "gap-0.5" },
  md: { star: "text-2xl leading-none", gap: "gap-1" },
  lg: { star: "text-4xl leading-none", gap: "gap-1.5" },
};

export function StarRating({
  targetType,
  targetId,
  targetLabel,
  initialStars,
  averageStars,
  ratingCount,
  size = "md",
  onRated,
  isLoggedIn = true,
  celebrateOnRate = true,
}: Props) {
  const router = useRouter();
  const [stars, setStars] = useState(initialStars ?? 0);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  async function rate(s: number) {
    if (!isLoggedIn) {
      router.push("/sign-in?next=" + encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/"));
      return;
    }
    setStars(s);
    setSaving(true);
    setPulse(true);
    try {
      await apiPost("/api/ratings", {
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        stars: s,
      });
      onRated?.(s);
      // 4 or 5 stars: celebrate with falling food. 1-3: gentle pulse only.
      if (s >= 4 && celebrateOnRate) setCelebrate(true);
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("rating failed", err);
    } finally {
      setSaving(false);
      setTimeout(() => setPulse(false), 1200);
    }
  }

  const display = hover || stars;
  const cls = SIZES[size];

  return (
    <div className="inline-flex items-center gap-3">
      <div
        className={`flex items-center ${cls.gap}`}
        onMouseLeave={() => setHover(0)}
        role="group"
        aria-label="Rate this recipe"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              disabled={saving}
              onMouseEnter={() => setHover(n)}
              onClick={() => rate(n)}
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
              className={`${cls.star} transition-all duration-150 ${
                filled ? "text-sunrise drop-shadow-sm" : "text-ink/15"
              } hover:scale-125 hover:rotate-[-4deg] disabled:cursor-not-allowed`}
              style={{
                animation: pulse && filled ? "rate-pop 600ms ease-out" : undefined,
                animationDelay: `${(n - 1) * 60}ms`,
              }}
            >
              ★
            </button>
          );
        })}
      </div>
      {stars > 0 && pulse && (
        <span className="text-sm font-semibold text-sunrise-700 animate-fade-up">
          Thanks! +5 pts
        </span>
      )}
      {!pulse && (
        <div className="text-sm text-ink-muted">
          {stars > 0 ? (
            <span>You: {stars}/5</span>
          ) : averageStars != null && ratingCount && ratingCount > 0 ? (
            <span>
              <strong className="text-ink">{averageStars.toFixed(1)}</strong>{" "}
              <span className="text-ink-muted">
                ({ratingCount} {ratingCount === 1 ? "rating" : "ratings"})
              </span>
            </span>
          ) : (
            <span className="italic">Be the first to rate</span>
          )}
        </div>
      )}

      <FoodConfetti active={celebrate} onDone={() => setCelebrate(false)} />

      <style jsx>{`
        @keyframes rate-pop {
          0%   { transform: scale(1) rotate(0); }
          30%  { transform: scale(1.6) rotate(-12deg); }
          60%  { transform: scale(1.2) rotate(6deg); }
          100% { transform: scale(1) rotate(0); }
        }
      `}</style>
    </div>
  );
}
