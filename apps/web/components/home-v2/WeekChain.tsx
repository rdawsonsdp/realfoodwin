// The visible chain — Clear's "habit tracker" rendered for a week.
//
// Design rules:
//   • Bar chart, not a streak counter (a streak punishes one missed day;
//     a chart forgives it).
//   • Big number + week-over-week chip. Negative WoW is shown calmly, no red.
//   • "Never miss twice" nudge appears *only when* yesterday was zero AND
//     today is still zero. We never shame today.
//   • Identity micro-copy unlocks at 3+ active days this week.
//
// Server component — purely presentational, all data comes from getWeekStats.

import type { WeekStats } from "@/lib/home-v2-stats";

interface Props {
  stats: WeekStats;
}

export function WeekChain({ stats }: Props) {
  const { thisWeekMade, lastWeekMade, bars, yesterdayMissed, todayHasSwap } = stats;
  const delta = thisWeekMade - lastWeekMade;
  const activeDays = bars.filter((b) => b.count > 0).length;
  const showNeverMissTwice = yesterdayMissed && !todayHasSwap;
  const showIdentity = activeDays >= 3;

  // Bar visual: 0 → empty outline; 1+ → filled with subtle gradient.
  // Bar height scales softly: 1=40%, 2=65%, 3+=100%. Keeps the chart legible
  // without making one heavy day dwarf the others.
  function barHeight(count: number): string {
    if (count === 0) return "h-2";
    if (count === 1) return "h-5";
    if (count === 2) return "h-8";
    return "h-12";
  }

  return (
    <section className="mb-8 rounded-soft bg-paper ring-1 ring-ink/5 shadow-card px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-sm uppercase tracking-[0.16em] font-semibold text-ink-muted">
          Your week
        </h2>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <p className="text-4xl md:text-5xl font-bold tracking-tight text-ink tabular-nums">
          {thisWeekMade}
        </p>
        <p className="text-sm md:text-base text-ink-soft">
          {thisWeekMade === 1 ? "swap" : "swaps"} this week
        </p>
        {(delta !== 0 || lastWeekMade > 0) && (
          <span
            className={`text-xs md:text-sm font-semibold px-2 py-0.5 rounded-pill ${
              delta > 0
                ? "bg-sage-soft text-forest-700"
                : delta < 0
                  ? "bg-honey/40 text-ink"
                  : "bg-paper ring-1 ring-ink/10 text-ink-soft"
            }`}
          >
            {delta > 0 ? `+${delta}` : delta} vs last week
          </span>
        )}
      </div>

      {/* The chain itself */}
      <div className="mt-5 grid grid-cols-7 gap-2">
        {bars.map((b) => (
          <div key={b.date} className="flex flex-col items-center gap-1.5">
            <div className="h-14 flex items-end">
              <div
                className={`w-full rounded-md transition-all ${barHeight(b.count)} ${
                  b.count === 0
                    ? "bg-ink/8 ring-1 ring-ink/10"
                    : "bg-gradient-to-t from-sunrise-500 to-honey-400"
                } ${b.isToday ? "ring-2 ring-sunrise-700/30" : ""}`}
                aria-label={`${b.weekday} ${b.date}: ${b.count} swap${b.count === 1 ? "" : "s"}`}
              />
            </div>
            <span
              className={`text-xs ${b.isToday ? "font-semibold text-ink" : "text-ink-muted"}`}
            >
              {b.weekday}
            </span>
          </div>
        ))}
      </div>

      {/* Coach copy below the chart. */}
      {showNeverMissTwice && (
        <p className="mt-4 text-sm text-ink-soft border-l-2 border-coral pl-3 italic">
          Yesterday was a rest day — let&apos;s not make it two.
        </p>
      )}
      {!showNeverMissTwice && showIdentity && (
        <p className="mt-4 text-sm font-medium text-forest-700">
          {activeDays} active days — you&apos;re becoming a real-food eater.
        </p>
      )}
      {!showNeverMissTwice && !showIdentity && thisWeekMade > 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          Keep going. One swap at a time.
        </p>
      )}
      {!showNeverMissTwice && thisWeekMade === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          Fresh week. The first swap is the hardest — start above.
        </p>
      )}
    </section>
  );
}
