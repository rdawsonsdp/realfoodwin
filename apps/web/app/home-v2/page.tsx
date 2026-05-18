// v2 home — the coach-led, time-aware, habit-building variant. Lives next to
// the original / so we can compare the two in production.
//
// Architecture: a single server component fetches the user, profile, slot,
// coach card rotation, and weekly stats in parallel, then composes the
// (mostly server-rendered) sections. Only the CoachCard is a client island
// (it owns the tap → pulse → POST cycle).

import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HomeViewToggle } from "@/components/HomeViewToggle";
import { HeroStrip } from "@/components/home-v2/HeroStrip";
import { CoachCard } from "@/components/home-v2/CoachCard";
import { WeekChain } from "@/components/home-v2/WeekChain";
import { RecipePulse } from "@/components/home-v2/RecipePulse";
import { PickUpWhere } from "@/components/home-v2/PickUpWhere";
import { getMealSlot, DEFAULT_TIMEZONE } from "@/lib/meal-slot";
import { cardsForSlot } from "@/data/coach-cards";
import { selectCoachCard } from "@/lib/coach-card-selection";
import { getWeekStats, getPickUpItems } from "@/lib/home-v2-stats";

export const dynamic = "force-dynamic"; // time-of-day depends on now()

function firstNameFrom(displayName: string | null, email: string | null | undefined): string {
  if (displayName && displayName.trim()) return displayName.trim().split(/\s+/)[0]!;
  if (email) return email.split("@")[0]!;
  return "friend";
}

function localDateKey(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function HomeV2() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // v2 home is signed-in only. Anonymous visitors get the regular landing.
  if (!user) redirect("/");

  const now = new Date();
  const slot = getMealSlot(now);
  const localDate = localDateKey(now, DEFAULT_TIMEZONE);

  const [userRow, stats, pickUp] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    getWeekStats(user.id, now),
    getPickUpItems(user.id, 3),
  ]);

  const firstName = firstNameFrom(
    (userRow.data as { display_name?: string | null } | null)?.display_name ?? null,
    user.email,
  );

  // Rotation for "Show another" — cards in this slot the user hasn't made
  // in the last 3 days. We compute the rotation order using the same seed
  // logic as selectCoachCard so cursor 0/1/2 stay consistent.
  const slotPool = cardsForSlot(slot);
  const recent = new Set(stats.recentlyMadeCardIds);
  const fresh = slotPool.filter((c) => !recent.has(c.id));
  const rotation = fresh.length > 0 ? fresh : slotPool;

  const initialCard = selectCoachCard({
    userId: user.id,
    slot,
    recentlyMadeIds: stats.recentlyMadeCardIds,
    localDate,
    cursor: 0,
  });
  const initialCursor = rotation.findIndex((c) => c.id === initialCard.id);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <HomeViewToggle active="coach" />
        <HeroStrip firstName={firstName} slot={slot} now={now} />
        <CoachCard
          initialCard={initialCard}
          rotation={rotation}
          initialCursor={Math.max(0, initialCursor)}
        />
        <WeekChain stats={stats} />
        <RecipePulse saved={stats.recipesSavedThisWeek} made={stats.recipesMadeThisWeek} />
        <PickUpWhere items={pickUp} />
      </main>
      <footer className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 text-center text-sm text-paper/60">
        <p className="italic">Replace ultra-processed food with real food, family by family.</p>
      </footer>
    </>
  );
}
