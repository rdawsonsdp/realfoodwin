// Secondary metric strip — recipes saved + made this week. Lighter weight than
// the chain (one row, no chart) so it doesn't compete with the primary cue.
// Tap-through goes to /kitchen.

import Link from "next/link";

interface Props {
  saved: number;
  made: number;
}

export function RecipePulse({ saved, made }: Props) {
  return (
    <Link
      href="/kitchen"
      className="mb-8 block rounded-soft bg-paper/70 ring-1 ring-ink/5 px-5 py-4 hover:bg-paper transition group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-xs uppercase tracking-[0.16em] font-semibold text-ink-muted">
            Recipe pulse
          </span>
          <span className="text-sm text-ink-soft">
            <span className="font-semibold text-ink tabular-nums">{saved}</span> saved ·{" "}
            <span className="font-semibold text-ink tabular-nums">{made}</span> made
          </span>
        </div>
        <span className="text-ink-muted text-sm group-hover:text-ink transition">→</span>
      </div>
    </Link>
  );
}
