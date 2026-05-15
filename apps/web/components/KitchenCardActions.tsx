"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { FoodConfetti } from "./FoodConfetti";

interface Props {
  targetType: "swap" | "recipe" | "variant";
  targetId: string;
  targetLabel: string;
  initialMadeIt: boolean;
  initialStars: number | null;
}

// Tiny in-card action bar: chef-hat "I made it!" toggle + inline 5-star rating.
// All clicks stopPropagation so they don't fire the wrapping <Link> navigation.

export function KitchenCardActions({
  targetType,
  targetId,
  targetLabel,
  initialMadeIt,
  initialStars,
}: Props) {
  const router = useRouter();
  const [madeIt, setMadeIt] = useState(initialMadeIt);
  const [stars, setStars] = useState(initialStars ?? 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function toggleMadeIt(e: React.MouseEvent) {
    stop(e);
    if (madeIt || busy) return;
    setBusy(true);
    setMadeIt(true);
    setCelebrate(true);
    try {
      await apiPost("/api/events", {
        event_type: "made_it_loved",
        target_type: targetType,
        target_id: targetId,
        metadata: {
          summary: `Made the ${targetLabel} — loved it`,
        },
      });
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setMadeIt(false);
    } finally {
      setBusy(false);
    }
  }

  async function rate(e: React.MouseEvent, n: number) {
    stop(e);
    setStars(n);
    setBusy(true);
    if (n >= 4) setCelebrate(true);
    try {
      await apiPost("/api/ratings", {
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        stars: n,
      });
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const display = hover || stars;

  return (
    <div
      className="flex items-center gap-3 mt-3 pt-3 border-t border-ink/5"
      onClick={stop}
    >
      <button
        type="button"
        onClick={toggleMadeIt}
        disabled={madeIt || busy}
        aria-label={madeIt ? "Marked as made it" : "Mark as made it"}
        title={madeIt ? "You made it!" : "I made it!"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-bold transition-all ${
          madeIt
            ? "bg-sage text-white shadow-warm"
            : "bg-white ring-1 ring-ink/10 text-ink-soft hover:ring-sunrise/40 hover:text-ink hover:scale-105"
        }`}
      >
        <span className="text-base leading-none">{madeIt ? "👨‍🍳" : "🍴"}</span>
        <span>{madeIt ? "Made it!" : "I made it"}</span>
      </button>

      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
        role="group"
        aria-label="Rate this"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={(e) => rate(e, n)}
            onMouseEnter={() => setHover(n)}
            disabled={busy}
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            className={`text-base leading-none transition-transform hover:scale-125 ${
              n <= display ? "text-sunrise" : "text-ink/15"
            }`}
          >
            ★
          </button>
        ))}
        {stars > 0 && (
          <span className="text-xs text-ink-muted ml-1">{stars}/5</span>
        )}
      </div>

      <FoodConfetti active={celebrate} onDone={() => setCelebrate(false)} />
    </div>
  );
}
