"use client";

// The single most important component on the v2 home — the cue+routine+reward
// unit. James Clear's four laws mapped to one card:
//
//   Obvious     → meal-slot tag, cue line, habit-stack prompt
//   Attractive  → "instead of X, try Y" upgrade framing + identity line
//   Easy        → primary button is one tap ("I made it"). No form.
//   Satisfying  → 480ms win-pulse on tap, count bumps in the chain below,
//                 identity micro-copy fades in. No confetti.
//
// The card is a client component because the tap → animation → POST cycle is
// inherently interactive. Initial state (selected card, recently-made IDs) is
// passed from the server so the first paint is correct.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CoachCard } from "@/data/coach-cards";
import { mealSlotInfo } from "@/lib/meal-slot";

interface Props {
  initialCard: CoachCard;
  // The card library pre-filtered to this user's current slot, in the order
  // the selector ranked them. We rotate through this on "Show another".
  rotation: CoachCard[];
  // Stable seed inputs so "Show another" stays deterministic per user/day.
  initialCursor: number;
  // When true, the component renders without its own outer ring/shadow/margin
  // because it lives inside the shared CoachDashboard frame.
  inDashboard?: boolean;
}

export function CoachCard({ initialCard, rotation, initialCursor, inDashboard }: Props) {
  const router = useRouter();
  const [card, setCard] = useState<CoachCard>(initialCard);
  const [cursor, setCursor] = useState(initialCursor);
  const [pulse, setPulse] = useState(false);
  const [reward, setReward] = useState<"made" | "saved" | null>(null);
  const [, startTransition] = useTransition();
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
          source: "home_v2",
        },
      }),
    });
  }

  function handleMadeIt() {
    setPulse(true);
    setReward("made");
    // Fire-and-forget the log — we don't block the visible reward on the
    // network. router.refresh() pulls fresh stats on success.
    logEvent("home_v2_made_swap")
      .then(() => startTransition(() => router.refresh()))
      .catch(() => {
        /* swallow — the visible reward is the truth; a retry queue is a v2 problem */
      });
    setTimeout(() => setPulse(false), 520);
  }

  function handleSave() {
    setReward("saved");
    logEvent("home_v2_saved_swap").catch(() => {});
    setTimeout(() => setReward(null), 1800);
  }

  function handleShowAnother() {
    if (rotation.length === 0) return;
    const next = (cursor + 1) % rotation.length;
    setCursor(next);
    setCard(rotation[next]!);
    setReward(null);
  }

  // When in the shared dashboard frame we drop our own ring/shadow/margin so
  // the parent owns the card chrome and the three sections feel like one box.
  const wrapperCls = inDashboard ? "" : "mb-8";
  const innerCls = inDashboard
    ? `relative overflow-hidden ${pulse ? "animate-win-pulse" : ""}`
    : `relative rounded-soft bg-paper ring-1 ring-ink/5 shadow-card overflow-hidden ${
        pulse ? "animate-win-pulse" : ""
      }`;

  return (
    <section className={wrapperCls}>
      <div className={innerCls}>
        {/* Meal-slot tile — colored block + icon, no photos in v1. */}
        <div
          className={`${info.tile} px-5 py-4 md:px-6 md:py-5 flex items-center gap-3`}
        >
          <span className="text-3xl md:text-4xl leading-none" aria-hidden>
            {info.icon}
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink/70">
              {info.label.replace(" window", "")} swap
            </p>
            <p className="text-base md:text-lg font-semibold text-ink leading-tight">
              {card.cue}
            </p>
          </div>
        </div>

        <div className="px-5 py-5 md:px-6 md:py-6">
          <p className="text-sm text-ink-muted mb-1">Instead of {card.instead_of}</p>
          <h3 className="text-xl md:text-2xl font-bold tracking-tight text-ink leading-tight">
            {card.replacement}
          </h3>

          <p className="mt-3 text-sm md:text-base text-ink-soft italic">
            {card.habit_stack}
          </p>
          <p className="mt-2 text-sm text-ink-muted">{card.why}</p>

          {/* The reward / identity micro-copy. Renders after a tap to reinforce
              the new identity (Clear: "make it satisfying" via identity). */}
          {reward === "made" && (
            <p className="mt-4 text-sm font-medium text-sunrise-700 animate-fade-up">
              ✓ Logged. {card.identity}
            </p>
          )}
          {reward === "saved" && (
            <p className="mt-4 text-sm font-medium text-forest-600 animate-fade-up">
              Saved to your kitchen.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleMadeIt}
              className="rounded-pill bg-sunrise-500 hover:bg-sunrise-600 text-white text-sm md:text-base font-semibold px-5 py-2.5 shadow-warm transition-colors"
            >
              I made it
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-pill bg-paper ring-1 ring-ink/15 hover:ring-ink/30 text-ink text-sm md:text-base font-medium px-5 py-2.5 transition"
            >
              Save for later
            </button>
            {rotation.length > 1 && (
              <button
                type="button"
                onClick={handleShowAnother}
                className="rounded-pill text-ink-soft hover:text-ink text-sm md:text-base font-medium px-3 py-2.5 transition"
              >
                Show another →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
