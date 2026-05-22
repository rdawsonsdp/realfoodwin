// SwapCounter (v3) — the only metric displayed on home-v3.
//
// Four numbers, one row: today / week / month / lifetime. Today carries
// the daily target (1 minimum, 7 ceiling for one-per-meal-slot); week and
// month show stretch targets. Lifetime is unbounded — pure compounding
// signal.

import type { SwapCounts } from "@/lib/swap-counts";

const DAILY_TARGET = 1;
const DAILY_CEILING = 7;
const WEEKLY_TARGET = 30;
const MONTHLY_TARGET = 70;

interface Props {
  counts: SwapCounts;
}

function Stat({
  label,
  value,
  goal,
  highlight = false,
}: {
  label: string;
  value: number;
  goal?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-2">
      <span
        className={`tabular-nums font-black leading-none ${
          highlight
            ? "text-4xl md:text-5xl text-paper"
            : "text-2xl md:text-3xl text-paper/90"
        }`}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] md:text-xs font-semibold uppercase tracking-[0.14em] text-paper/60">
        {label}
      </span>
      {goal && (
        <span className="mt-0.5 text-[10px] md:text-xs text-paper/45 tabular-nums">
          {goal}
        </span>
      )}
    </div>
  );
}

export function SwapCounter({ counts }: Props) {
  const todayMet = counts.today >= DAILY_TARGET;
  const todayGoal =
    counts.today >= DAILY_CEILING
      ? "max"
      : todayMet
        ? `+${counts.today - DAILY_TARGET}`
        : `of ${DAILY_TARGET}`;

  return (
    <section className="mt-8 md:mt-10">
      <div className="flex items-stretch justify-around gap-1 md:gap-4 rounded-2xl bg-paper/8 ring-1 ring-paper/15 py-4 md:py-5 px-2 md:px-4">
        <Stat label="Today" value={counts.today} goal={todayGoal} highlight />
        <div className="self-center w-px h-10 bg-paper/15" aria-hidden />
        <Stat label="Week" value={counts.week} goal={`of ${WEEKLY_TARGET}`} />
        <div className="self-center w-px h-10 bg-paper/15" aria-hidden />
        <Stat label="Month" value={counts.month} goal={`of ${MONTHLY_TARGET}`} />
        <div className="self-center w-px h-10 bg-paper/15" aria-hidden />
        <Stat label="Lifetime" value={counts.lifetime} />
      </div>
    </section>
  );
}
