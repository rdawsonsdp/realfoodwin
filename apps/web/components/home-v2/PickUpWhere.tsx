// "Pick up where you left off" — friction reduction (Clear's "make it easy").
// Three most recent saves from My Kitchen. If empty, hide the section entirely
// rather than show a fake row.

import Link from "next/link";
import type { PickUpItem } from "@/lib/home-v2-stats";

interface Props {
  items: PickUpItem[];
}

export function PickUpWhere({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-sm uppercase tracking-[0.16em] font-semibold text-paper/70 mb-3">
        Pick up where you left off
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            className="rounded-soft bg-paper ring-1 ring-ink/5 shadow-card px-4 py-3 hover:shadow-warm hover:-translate-y-0.5 transition-all"
          >
            <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">
              {it.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Saved {timeAgo(it.saved_at)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
