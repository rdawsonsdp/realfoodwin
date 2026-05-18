"use client";

// NextUpCard — the lookahead. Stays one play ahead of hunger by surfacing the
// next meal slot's swap before the user gets there. Lighter visual weight than
// the main CoachCard (smaller type, no large cue line) so it doesn't compete
// for attention — it queues the next move.
//
// Actions:
//   * Save for later (primary) → writes home_v2_saved_swap, comes back in
//     "Pick up where you left off" if the user wants it at meal time.
//   * Show another → rotate within the same slot.
//   * I made it → in case the user actually eats early ("having lunch at
//     10:30, I'll log it now").

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoachCard } from "@/data/coach-cards";
import { mealSlotInfo } from "@/lib/meal-slot";

interface Props {
  initialCard: CoachCard;
  rotation: CoachCard[];
  initialCursor: number;
  // "Lunch · in 35m" / "Tomorrow's breakfast · in 9h"
  whenLabel: string;
}

export function NextUpCard({ initialCard, rotation, initialCursor, whenLabel }: Props) {
  const router = useRouter();
  const [card, setCard] = useState<CoachCard>(initialCard);
  const [cursor, setCursor] = useState(initialCursor);
  const [reward, setReward] = useState<"made" | "saved" | null>(null);
  const info = mealSlotInfo(card.slot);

  function logEvent(eventType: "home_v2_made_swap" | "home_v2_saved_swap") {
    return fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        metadata: {
          coach_card_id: card.id,
          meal_slot: card.slot,
          instead_of: card.instead_of,
          replacement: card.replacement,
          source: "home_v2_next_up",
        },
      }),
    });
  }

  function handleSave() {
    setReward("saved");
    logEvent("home_v2_saved_swap").catch(() => {});
    setTimeout(() => setReward(null), 1800);
  }

  function handleMadeIt() {
    setReward("made");
    logEvent("home_v2_made_swap")
      .then(() => router.refresh())
      .catch(() => {});
    setTimeout(() => setReward(null), 1800);
  }

  function handleShowAnother() {
    if (rotation.length === 0) return;
    const next = (cursor + 1) % rotation.length;
    setCursor(next);
    setCard(rotation[next]!);
    setReward(null);
  }

  return (
    <div className="px-5 py-4 md:px-6 md:py-5">
      {/* Slim eyebrow: meal slot + relative time. */}
      <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
        <span aria-hidden className="text-base leading-none">
          {info.icon}
        </span>
        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-forest-700">
          {whenLabel}
        </p>
      </div>

      {/* The swap. Smaller heading than TODAY'S PLAY by design. */}
      <p className="text-base md:text-lg font-bold text-ink leading-snug">
        {card.replacement}
      </p>
      <p className="text-xs md:text-sm text-ink-muted mt-0.5">
        Instead of {card.instead_of}
      </p>

      {reward === "saved" && (
        <p className="mt-2 text-xs font-medium text-forest-600 animate-fade-up">
          ✓ Saved for {info.label.replace(" window", "").toLowerCase()}.
        </p>
      )}
      {reward === "made" && (
        <p className="mt-2 text-xs font-medium text-sunrise-700 animate-fade-up">
          ✓ Logged. Eating ahead — that&apos;s real-food planning.
        </p>
      )}

      {/* Slim action row — Save is primary, the other two are quiet text buttons. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-pill bg-paper ring-1 ring-ink/15 hover:ring-ink/30 text-ink text-xs md:text-sm font-semibold px-3.5 py-1.5 transition"
        >
          Save for later
        </button>
        <button
          type="button"
          onClick={handleMadeIt}
          className="text-xs md:text-sm font-medium text-sunrise-700 hover:text-sunrise-600 px-2 py-1.5 transition"
        >
          I made it
        </button>
        {rotation.length > 1 && (
          <button
            type="button"
            onClick={handleShowAnother}
            className="text-xs md:text-sm text-ink-muted hover:text-ink px-2 py-1.5 transition"
          >
            Show another →
          </button>
        )}
      </div>
    </div>
  );
}
