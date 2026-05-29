// Lightweight recent-swaps carousel for /home-v3. Sits below the SwapCounter
// streak so the user can rediscover swaps they ran in the last few sessions
// without leaving the home surface.
//
// Server component — no hooks, no client JS. Native horizontal scroll-snap
// keeps the interaction feeling app-like on mobile without shipping a
// carousel library. Cards are small (title + the original query + a relative
// timestamp) and link to /swap/[id].

import Link from "next/link";
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function RecentSwapsCarousel({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Recent swaps">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-xs md:text-sm uppercase tracking-[0.16em] font-bold text-paper/80">
          Recent swaps
        </h2>
        <Link
          href="/kitchen"
          className="text-xs font-semibold text-paper/70 hover:text-paper"
        >
          See all →
        </Link>
      </div>
      <div className="-mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <ul className="flex gap-3 pb-2">
          {items.map((s) => (
            <li key={s.id} className="snap-start shrink-0">
              <Link
                href={`/swap/${s.id}`}
                className="block w-44 md:w-52 h-full rounded-soft bg-paper text-ink ring-1 ring-ink/10 shadow-card px-3 py-3 hover:brightness-105 active:scale-[0.98] transition"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-coral truncate">
                  {s.query ?? "Swap"}
                </p>
                <p className="mt-1 text-sm font-bold leading-snug line-clamp-2">
                  {s.title}
                </p>
                <p className="mt-2 text-[11px] text-ink/55">{timeAgo(s.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
