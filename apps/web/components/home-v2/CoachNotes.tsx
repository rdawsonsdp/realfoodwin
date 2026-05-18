// Coach's Notes — look-back coaching with educational depth.
//
// Pulls the user's recent made swaps (last 14 days), dedupes them by coach card,
// and surfaces the `coaching` paragraph from the card library — the science behind
// the swap. The goal isn't to congratulate; it's to *teach* while we coach, so
// the user starts to know what they're doing, not just follow our suggestions.
//
// Hidden entirely when the user has no logged made swaps yet — a fresh account
// shouldn't see an empty "your wins" section.

import type { CoachNote } from "@/lib/home-v2-stats";
import { cardById } from "@/data/coach-cards";
import { mealSlotInfo } from "@/lib/meal-slot";

interface Props {
  notes: CoachNote[];
}

function timeAgo(iso: string): string {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "last week";
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function CoachNotes({ notes }: Props) {
  if (notes.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm uppercase tracking-[0.16em] font-semibold text-paper/70 mb-3">
        Coach&apos;s notes
      </h2>
      <div className="space-y-3">
        {notes.map((n) => {
          const card = cardById(n.cardId);
          if (!card) return null;
          const info = mealSlotInfo(card.slot);
          const repeat = n.timesThisFortnight;
          return (
            <article
              key={n.cardId}
              className="rounded-soft bg-paper ring-1 ring-ink/5 shadow-card px-5 py-4 md:px-6 md:py-5"
            >
              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                <span aria-hidden className="text-lg leading-none">
                  {info.icon}
                </span>
                <p className="text-xs uppercase tracking-[0.16em] font-semibold text-ink-muted">
                  {info.label.replace(" window", "")} · {timeAgo(n.occurredAt)}
                </p>
                {repeat > 1 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-pill bg-sage-soft text-forest-700">
                    {repeat}× this fortnight
                  </span>
                )}
              </div>
              <p className="text-base md:text-lg font-semibold text-ink leading-snug">
                {card.replacement}
                <span className="text-ink-muted font-normal"> — instead of {card.instead_of}</span>
              </p>
              <p className="mt-2 text-sm md:text-[15px] text-ink-soft leading-relaxed">
                {card.coaching}
              </p>
              {repeat > 1 && (
                <p className="mt-2 text-xs italic text-forest-700">
                  You&apos;ve made this {repeat} times — clearly a winner. Keep it in
                  the rotation.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
