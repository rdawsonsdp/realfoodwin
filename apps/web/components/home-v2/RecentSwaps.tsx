// Recent swaps — a memory aid plus a recommendation signal.
//
// Lists the last N swaps the user generated, even if they didn't save or make
// them. Each row has an inline 1-5 star rating. Ratings serve two purposes:
//   1. The user gets a quick way to tell us "more like this / less like this"
//   2. The recommender (Phase 2) learns each user's palate from these signals
//
// Each rating writes through to /api/ratings → recipe_ratings + a mirrored
// `events` row (handled by the existing route). No confetti here on purpose —
// confetti was being overused; we use the existing StarRating component with
// celebrate={false} so the pulse stays but the falling food doesn't.

import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import type { RecentSwap } from "@/lib/home-v2-stats";

interface Props {
  items: RecentSwap[];
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffHr = (Date.now() - d.getTime()) / (60 * 60 * 1000);
  if (diffHr < 1) return "just now";
  if (diffHr < 24) return `${Math.floor(diffHr)}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function RecentSwaps({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm uppercase tracking-[0.16em] font-semibold text-paper/70">
          Recent swaps
        </h2>
        <p className="text-xs text-paper/60 italic">
          Rate one — I&apos;ll learn what you love.
        </p>
      </div>

      <div className="rounded-soft bg-paper ring-1 ring-ink/5 shadow-card divide-y divide-ink/8">
        {items.map((s) => (
          <div
            key={s.id}
            className="px-4 py-3 md:px-5 md:py-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <Link
                href={`/swap/${s.id}`}
                className="block hover:text-sunrise-700 transition-colors"
              >
                <p className="text-sm md:text-base font-semibold text-ink leading-snug line-clamp-1">
                  {s.title}
                </p>
              </Link>
              <p className="text-xs text-ink-muted mt-0.5">
                {s.query ? <>Swapped from <span className="font-medium">{s.query}</span> · </> : null}
                {timeAgo(s.createdAt)}
              </p>
            </div>
            <StarRating
              targetType="swap"
              targetId={s.id}
              targetLabel={s.title}
              initialStars={s.userStars ?? undefined}
              size="sm"
              celebrateOnRate={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
