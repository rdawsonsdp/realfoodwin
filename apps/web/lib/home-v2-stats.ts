// Server-side stats for the v2 home page chain.
//
// Reads from the existing append-only `events` table (0005_behavioral.sql)
// using these event_types:
//   - 'home_v2_made_swap'   : the gold habit signal (counted on the chain)
//   - 'home_v2_saved_swap'  : intent — kept for analytics but not counted
//   - 'made_it'             : (legacy/existing) also counted as a "made" swap
//                             so users who already use the rest of the app
//                             see their existing activity reflected here
//
// Recipe pulse pulls from `recipe_box_entries` (saves) and the same `made_it`
// events scoped to recipe targets.
//
// All "day" boundaries use America/Los_Angeles for v1 — see lib/meal-slot.ts.

import { createSupabaseServer } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/meal-slot";

export interface DayBar {
  date: string; // YYYY-MM-DD in local tz
  weekday: string; // M T W T F S S
  count: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekStats {
  thisWeekMade: number;
  lastWeekMade: number;
  bars: DayBar[]; // exactly 7 entries, oldest → newest, today is last
  recipesSavedThisWeek: number;
  recipesMadeThisWeek: number;
  // Card IDs the user has made in the last 3 days — feed into selection so the
  // coach card avoids immediate repeats.
  recentlyMadeCardIds: string[];
  // True iff yesterday had zero "made" swaps. Drives the "never miss twice"
  // nudge — but only show it after today is also still zero, i.e. yesterday
  // was the first miss.
  yesterdayMissed: boolean;
  // True iff today already has at least one "made" swap.
  todayHasSwap: boolean;
  // Today's day key (local).
  todayLocalDate: string;
}

const SHORT_WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

// Format a Date as YYYY-MM-DD in a given tz. We use Intl rather than
// shifting Date arithmetic so DST changes don't bite us.
function toLocalDateKey(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function localWeekdayIdx(d: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd as keyof typeof map] ?? 0;
}

// Build the 7-day window ending today (local). Returns YYYY-MM-DD keys.
function build7DayWindow(now: Date, tz: string): { key: string; weekday: string }[] {
  const days: { key: string; weekday: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    // Step i UTC-days back, then read the local key. Good enough for a 7-day
    // window — even with DST the off-by-one is at most one hour.
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days.push({ key: toLocalDateKey(d, tz), weekday: SHORT_WEEKDAY[localWeekdayIdx(d, tz)]! });
  }
  return days;
}

export async function getWeekStats(userId: string, now: Date = new Date()): Promise<WeekStats> {
  const supabase = createSupabaseServer();
  const tz = DEFAULT_TIMEZONE;

  // Pull events for the last 14 days so we can compute both this-week and
  // last-week with one round trip.
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [eventsRes, savesRes] = await Promise.all([
    supabase
      .from("events")
      .select("event_type, target_type, target_id, metadata, created_at")
      .eq("user_id", userId)
      .gte("created_at", fourteenDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("recipe_box_entries")
      .select("id, saved_at")
      .eq("user_id", userId)
      .gte("saved_at", fourteenDaysAgo.toISOString()),
  ]);

  const events =
    (eventsRes.data as
      | {
          event_type: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }[]
      | null) ?? [];
  const saves = (savesRes.data as { id: string; saved_at: string }[] | null) ?? [];

  // Build 7-day chain (this week) and last-week sum.
  const window = build7DayWindow(now, tz);
  const windowKeys = new Set(window.map((d) => d.key));
  const todayKey = window[window.length - 1]!.key;

  const madeByDay = new Map<string, number>();
  let lastWeekMade = 0;
  const recentlyMadeCardIds: string[] = [];
  let recipesMadeThisWeek = 0;

  for (const ev of events) {
    const key = toLocalDateKey(new Date(ev.created_at), tz);
    const isMadeSwap = ev.event_type === "home_v2_made_swap" || ev.event_type === "made_it";

    if (isMadeSwap) {
      if (windowKeys.has(key)) {
        madeByDay.set(key, (madeByDay.get(key) ?? 0) + 1);
        if (ev.target_type === "recipe") recipesMadeThisWeek += 1;
      } else {
        // Falls in the prior 7-day window.
        lastWeekMade += 1;
      }

      // Track recently-made coach card IDs (last 3 days) so the selector skips them.
      const cardId =
        ev.metadata && typeof ev.metadata === "object"
          ? ((ev.metadata as Record<string, unknown>)["coach_card_id"] as string | undefined)
          : undefined;
      if (cardId) {
        const dayAge =
          (now.getTime() - new Date(ev.created_at).getTime()) / (24 * 60 * 60 * 1000);
        if (dayAge <= 3) recentlyMadeCardIds.push(cardId);
      }
    }
  }

  const bars: DayBar[] = window.map((d, i) => ({
    date: d.key,
    weekday: d.weekday,
    count: madeByDay.get(d.key) ?? 0,
    isToday: i === window.length - 1,
    isFuture: false,
  }));

  const thisWeekMade = bars.reduce((s, b) => s + b.count, 0);

  // Recipes saved this week (last 7 local days).
  let recipesSavedThisWeek = 0;
  for (const row of saves) {
    const key = toLocalDateKey(new Date(row.saved_at), tz);
    if (windowKeys.has(key)) recipesSavedThisWeek += 1;
  }

  const yesterdayKey = window[window.length - 2]!.key;
  const yesterdayMissed = (madeByDay.get(yesterdayKey) ?? 0) === 0;
  const todayHasSwap = (madeByDay.get(todayKey) ?? 0) > 0;

  return {
    thisWeekMade,
    lastWeekMade,
    bars,
    recipesSavedThisWeek,
    recipesMadeThisWeek,
    recentlyMadeCardIds,
    yesterdayMissed,
    todayHasSwap,
    todayLocalDate: todayKey,
  };
}

// Coach's Notes — recent made swaps mapped back to their card so we can
// surface the educational "why this worked" content. Deduped by card so the
// same swap doesn't repeat; the most recent occurrence wins. Hidden in UI when
// the list is empty (no made history yet).
export interface CoachNote {
  cardId: string;
  occurredAt: string;
  timesThisFortnight: number;
}

export async function getCoachNotes(userId: string, limit = 3, days = 14): Promise<CoachNote[]> {
  const supabase = createSupabaseServer();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("events")
    .select("event_type, metadata, created_at")
    .eq("user_id", userId)
    .in("event_type", ["home_v2_made_swap", "made_it"])
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (!data) return [];

  type EvRow = {
    event_type: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  // Dedupe by card id, keeping the most recent occurrence, while counting
  // total occurrences so the UI can say "you've made this 3 times".
  const byCard = new Map<string, { occurredAt: string; count: number }>();
  for (const row of data as EvRow[]) {
    const cardId =
      row.metadata && typeof row.metadata === "object"
        ? ((row.metadata as Record<string, unknown>)["coach_card_id"] as string | undefined)
        : undefined;
    if (!cardId) continue;
    const existing = byCard.get(cardId);
    if (existing) {
      existing.count += 1;
    } else {
      byCard.set(cardId, { occurredAt: row.created_at, count: 1 });
    }
  }

  return Array.from(byCard.entries())
    .slice(0, limit)
    .map(([cardId, v]) => ({
      cardId,
      occurredAt: v.occurredAt,
      timesThisFortnight: v.count,
    }));
}

// Recent swap rows the user has generated. Used both to remind them what they
// swapped (memory aid) and to collect ratings (recommendation signal).
export interface RecentSwap {
  id: string;
  title: string;
  query: string | null; // the junk-food query they typed, e.g. "Snickers"
  narrative: string | null;
  createdAt: string;
  userStars: number | null; // their prior rating, if any
}

export async function getRecentSwaps(userId: string, limit = 5): Promise<RecentSwap[]> {
  const supabase = createSupabaseServer();
  const { data: swaps } = await supabase
    .from("swaps")
    .select("id, recipe, output, narrative, swap_target, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!swaps || swaps.length === 0) return [];

  type SwapRow = {
    id: string;
    recipe: { title?: string } | null;
    output: { title?: string } | null;
    narrative: string | null;
    swap_target: string | null;
    created_at: string;
  };

  const ids = (swaps as SwapRow[]).map((s) => s.id);

  // Pull any existing ratings for these swaps in one round trip.
  const { data: ratings } = await supabase
    .from("recipe_ratings")
    .select("target_id, stars")
    .eq("user_id", userId)
    .eq("target_type", "swap")
    .in("target_id", ids);

  const starsById = new Map<string, number>();
  for (const r of (ratings as { target_id: string; stars: number }[] | null) ?? []) {
    starsById.set(r.target_id, r.stars);
  }

  return (swaps as SwapRow[]).map((s) => {
    const title = s.output?.title ?? s.recipe?.title ?? s.swap_target ?? "Saved swap";
    return {
      id: s.id,
      title,
      query: s.swap_target,
      narrative: s.narrative,
      createdAt: s.created_at,
      userStars: starsById.get(s.id) ?? null,
    };
  });
}

// Pull the user's three most recently saved kitchen entries (for the
// "Pick up where you left off" rail).
export interface PickUpItem {
  id: string;
  title: string;
  href: string;
  saved_at: string;
}

export async function getPickUpItems(userId: string, limit = 3): Promise<PickUpItem[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("recipe_box_entries")
    .select(
      "id, saved_at, recipe_id, swap_id, variant_id, recipes:recipe_id(title), swaps:swap_id(narrative, product_id)",
    )
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  type RawEntry = {
    id: string;
    saved_at: string;
    recipe_id: string | null;
    swap_id: string | null;
    variant_id: string | null;
    recipes: { title: string } | { title: string }[] | null;
    swaps: { narrative: string | null; product_id: string | null } | { narrative: string | null; product_id: string | null }[] | null;
  };

  return (data as RawEntry[]).map((row): PickUpItem => {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    const swap = Array.isArray(row.swaps) ? row.swaps[0] : row.swaps;
    let title = "Saved item";
    let href = "/kitchen";
    if (recipe?.title) {
      title = recipe.title;
      href = "/kitchen";
    } else if (row.swap_id) {
      // Pull the first ~40 chars of the narrative as a title hint.
      title = swap?.narrative ? swap.narrative.split(/[.!?\n]/)[0]!.slice(0, 60) : "Saved swap";
      href = `/swap/${row.swap_id}`;
    } else if (row.variant_id) {
      title = "Recipe variant";
      href = "/kitchen";
    }
    return { id: row.id, title, href, saved_at: row.saved_at };
  });
}
