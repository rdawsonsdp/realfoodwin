// Server-side swap counts for the v3 home page.
//
// The v3 home is single-action — Swap — with one metric on display:
// swap count for today / week / month / lifetime. This file is the
// query layer for that metric.
//
// Reads from the append-only `events` table using the same event_types
// home-v2-stats counts as a "made" swap: `home_v2_made_swap` (the gold
// signal) and `made_it` (legacy/cross-feature compat). "Saves" are not
// counted here — only completed swaps.
//
// Day boundaries use the project default timezone (America/Los_Angeles).
// When per-user timezone lands, swap DEFAULT_TIMEZONE for the resolved tz.

import { createSupabaseServer } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/meal-slot";

export interface SwapCounts {
  today: number;
  week: number;
  month: number;
  lifetime: number;
}

const MADE_EVENT_TYPES = ["home_v2_made_swap", "made_it"] as const;

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

function localYearMonth(d: Date, tz: string): string {
  return toLocalDateKey(d, tz).slice(0, 7); // YYYY-MM
}

export async function getSwapCounts(
  userId: string,
  now: Date = new Date(),
): Promise<SwapCounts> {
  const supabase = createSupabaseServer();
  const tz = DEFAULT_TIMEZONE;

  // Pull 31 days of made-events to cover today/week/month locally. Lifetime
  // is a separate head:count query so we don't have to fetch the full
  // history just to display a number.
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

  const [recentRes, lifetimeRes] = await Promise.all([
    supabase
      .from("events")
      .select("created_at")
      .eq("user_id", userId)
      .in("event_type", MADE_EVENT_TYPES as unknown as string[])
      .gte("created_at", thirtyOneDaysAgo.toISOString()),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("event_type", MADE_EVENT_TYPES as unknown as string[]),
  ]);

  const recent = recentRes.data ?? [];
  const todayKey = toLocalDateKey(now, tz);
  const monthKey = localYearMonth(now, tz);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let today = 0;
  let week = 0;
  let month = 0;
  for (const row of recent) {
    const created = new Date(row.created_at);
    const dayKey = toLocalDateKey(created, tz);
    if (dayKey === todayKey) today++;
    if (created >= weekStart) week++;
    if (dayKey.slice(0, 7) === monthKey) month++;
  }

  return {
    today,
    week,
    month,
    lifetime: lifetimeRes.count ?? 0,
  };
}
