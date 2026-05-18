// Generate the coach's *opening* line for the chat — the first thing the user
// sees when /home-v2 loads. It must reference the user's actual recent activity
// so it feels like a relationship, not a chatbot greeting. No LLM call here —
// purely template-driven so first paint is instant and consistent.

import { cardById } from "@/data/coach-cards";
import type { CoachNote, RecentSwap } from "@/lib/home-v2-stats";
import type { CoachMemorySummary } from "@/lib/coach-memory";

interface Args {
  firstName: string;
  notes: CoachNote[]; // most-recent-made coach cards (with repeat counts)
  recentSwaps: RecentSwap[]; // most recently generated swaps
  thisWeekMade: number;
  yesterdayMissed: boolean;
  todayHasSwap: boolean;
  hasMemorySummary: boolean;
  memorySummary: CoachMemorySummary | null;
}

export function buildOpeningTurn(args: Args): string {
  const {
    firstName,
    notes,
    recentSwaps,
    thisWeekMade,
    yesterdayMissed,
    todayHasSwap,
    hasMemorySummary,
    memorySummary,
  } = args;

  // 1. Strongest hook: a repeated coach card (clearly working for them)
  const repeated = notes.find((n) => n.timesThisFortnight >= 2);
  if (repeated) {
    const card = cardById(repeated.cardId);
    if (card) {
      return `Hey ${firstName} — you've made the ${card.replacement.toLowerCase()} ${repeated.timesThisFortnight} times lately. How's it landing? Anything you'd tweak?`;
    }
  }

  // 2. A single recent made swap.
  if (notes.length > 0) {
    const card = cardById(notes[0]!.cardId);
    if (card) {
      return `Hey ${firstName} — you tried the ${card.replacement.toLowerCase()} recently. How's it going? Tell me what worked, what didn't.`;
    }
  }

  // 3. A recently generated (but maybe not made) swap.
  if (recentSwaps.length > 0) {
    const s = recentSwaps[0]!;
    const target = s.query ?? "your last swap";
    return `Hey ${firstName} — saw you swapped ${target} the other day. How's that going? Anything you want me to remember about your taste?`;
  }

  // 4. Returning user with memory but no recent activity.
  if (hasMemorySummary && memorySummary) {
    const dislike = memorySummary.dislikes[0]?.subject;
    if (dislike) {
      return `Hey ${firstName} — been a minute. I remember you're not into ${dislike}. What's been on your plate lately?`;
    }
    return `Hey ${firstName} — what's been on your plate this week? Catch me up.`;
  }

  // 5. Has a streak going.
  if (thisWeekMade >= 3) {
    return `Hey ${firstName} — ${thisWeekMade} swaps this week, that's real momentum. What's been the easiest? What's been hard?`;
  }

  // 6. Yesterday was a miss — gentle re-engage.
  if (yesterdayMissed && !todayHasSwap && thisWeekMade > 0) {
    return `Hey ${firstName} — quiet day yesterday. No pressure. What's making swaps easy or hard for you right now?`;
  }

  // 7. Cold start (no history at all).
  return `Hey ${firstName}. I'm your real-food coach — your job is to swap one thing at a time, mine is to make it easy. To start: what's a snack or meal you eat almost every day that you'd love a real-food version of?`;
}
