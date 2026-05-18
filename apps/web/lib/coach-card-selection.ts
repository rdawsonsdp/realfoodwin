// Pick the right coach card for a user at a given moment.
//
// Rules (in order):
//   1. Filter by current meal slot (the obvious cue).
//   2. Exclude cards the user has *made* in the last 3 days, so variety builds
//      naturally — Clear's "make it attractive" depends on novelty.
//   3. Deterministic pick within the eligible set, seeded by user_id + local
//      day + slot. Stable across refreshes within the same slot/day, so the
//      card doesn't shuffle every time the user reopens the page.
//   4. "Show another" advances by one card within the eligible set (the client
//      passes a `cursor` integer).
//
// If everything's been used recently, fall back to the full slot pool (better
// to repeat than to show nothing).

import type { CoachCard } from "@/data/coach-cards";
import { cardsForSlot } from "@/data/coach-cards";
import type { MealSlot } from "@/lib/meal-slot";

export interface SelectCoachCardArgs {
  userId: string;
  slot: MealSlot;
  // Card IDs the user has marked "made" in the last 3 days (excluded).
  recentlyMadeIds?: string[];
  // Local date string YYYY-MM-DD — keeps the pick stable across refreshes
  // until the day rolls over.
  localDate: string;
  // 0 = first card, 1 = "show another", 2 = next, ...
  cursor?: number;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function selectCoachCard(args: SelectCoachCardArgs): CoachCard {
  const { userId, slot, recentlyMadeIds = [], localDate, cursor = 0 } = args;

  const pool = cardsForSlot(slot);
  const recent = new Set(recentlyMadeIds);
  const fresh = pool.filter((c) => !recent.has(c.id));

  // If everything's been recently made, fall back to the whole pool — better
  // to repeat a good swap than to show the user an empty screen.
  const eligible = fresh.length > 0 ? fresh : pool;

  const base = hashSeed(`${userId}|${localDate}|${slot}`);
  const idx = (base + cursor) % eligible.length;
  return eligible[idx]!;
}
