"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KitchenCardActions } from "./KitchenCardActions";

type Sort = "recent" | "rating" | "made-it";

export interface KitchenItem {
  id: string;
  href: string;
  title: string;
  kicker: string;
  meal_type: string | null;
  saved_at: string;
  narrative: string | null;
  tags: string[];
  rating: number | null;
  made_it: boolean;
  target_type: "swap" | "recipe" | "variant";
  target_id: string;
}

const MEAL_TYPES = ["all", "breakfast", "lunch", "dinner", "snack", "dessert", "side"];
const SORT_LABEL: Record<Sort, string> = {
  recent: "Recently saved",
  rating: "Highest rated",
  "made-it": "Made-it first",
};

export function KitchenBrowser({ items }: { items: KitchenItem[] }) {
  const [meal, setMeal] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let arr = items;
    if (meal !== "all") arr = arr.filter((i) => i.meal_type === meal);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((i) => {
        return (
          i.title.toLowerCase().includes(needle) ||
          i.tags.some((t) => t.toLowerCase().includes(needle)) ||
          (i.narrative ?? "").toLowerCase().includes(needle)
        );
      });
    }
    const sorted = [...arr];
    if (sort === "rating") {
      sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "made-it") {
      sorted.sort((a, b) => Number(b.made_it) - Number(a.made_it));
    } else {
      sorted.sort((a, b) => (a.saved_at < b.saved_at ? 1 : -1));
    }
    return sorted;
  }, [items, meal, sort, q]);

  // Group by meal_type when "all" — provides the "by food type" view.
  const byMeal = useMemo(() => {
    if (meal !== "all" || sort !== "recent") return null;
    const map = new Map<string, KitchenItem[]>();
    for (const i of filtered) {
      const key = i.meal_type ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    // Stable order: real meal types first, "other" last.
    const order = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "other"];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ key: k, items: map.get(k)! }));
  }, [filtered, meal, sort]);

  return (
    <div className="space-y-6">
      {/* Toolbar — search up top on phones; chips scroll horizontally to
          avoid breaking the row at 360px. Sort dropdown sits below. */}
      <div className="card p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search your kitchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-3 text-base rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="px-3 py-3 text-base rounded-soft bg-white border border-ink/10 md:ml-auto"
            aria-label="Sort"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-1 overflow-x-auto scroll-row">
          <div className="flex flex-nowrap md:flex-wrap gap-1.5 px-1 pb-0.5">
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className={`flex-shrink-0 px-3.5 py-2 min-h-[36px] rounded-pill text-xs font-semibold capitalize transition-colors ${
                  meal === m
                    ? "bg-sunrise text-white"
                    : "bg-white ring-1 ring-ink/10 text-ink-soft hover:ring-sunrise/30"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted">
          {q ? `Nothing matches "${q}".` : "No saved items in this view yet."}
        </div>
      ) : byMeal ? (
        // Grouped by meal type — each group reads like a divider tab in a
        // physical recipe-card box.
        <div className="space-y-8">
          {byMeal.map((g) => (
            <section key={g.key}>
              <CategoryDivider
                label={g.key === "other" ? "Other" : g.key}
                count={g.items.length}
                tone={mealTone(g.key)}
              />
              <Grid items={g.items} />
            </section>
          ))}
        </div>
      ) : (
        // Flat list (sorted by rating or made-it, or filtered by single meal type)
        <Grid items={filtered} />
      )}
    </div>
  );
}

// Pick a color tone per meal_type so each divider + card-tab stripe is
// visually distinct, like the colored dividers in a real recipe box.
function mealTone(key: string): "coral" | "honey" | "sage" | "forest" | "neutral" {
  switch (key) {
    case "breakfast":
      return "honey";
    case "lunch":
      return "sage";
    case "dinner":
      return "forest";
    case "snack":
      return "coral";
    case "dessert":
      return "coral";
    case "side":
      return "sage";
    default:
      return "neutral";
  }
}

function tabClasses(tone: ReturnType<typeof mealTone>): string {
  switch (tone) {
    case "coral":
      return "bg-coral text-white";
    case "honey":
      return "bg-honey text-ink";
    case "sage":
      return "bg-sage-soft text-forest-700";
    case "forest":
      return "bg-forest-700 text-paper";
    default:
      return "bg-ink/60 text-paper";
  }
}

function stripeClass(tone: ReturnType<typeof mealTone>): string {
  switch (tone) {
    case "coral":
      return "bg-coral";
    case "honey":
      return "bg-honey";
    case "sage":
      return "bg-sage";
    case "forest":
      return "bg-forest-700";
    default:
      return "bg-ink/40";
  }
}

function CategoryDivider({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: ReturnType<typeof mealTone>;
}) {
  return (
    <div className="mb-4 flex items-end gap-3">
      <div
        className={`inline-flex items-center gap-2 rounded-t-soft px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] shadow-card ${tabClasses(tone)}`}
      >
        <span className="capitalize">{label}</span>
        <span className="opacity-80 text-[10px]">·</span>
        <span className="opacity-80">{count}</span>
      </div>
      <span className="flex-1 border-b border-dashed border-paper/30 mb-1" />
    </div>
  );
}

function Grid({ items }: { items: KitchenItem[] }) {
  // Wider cards (max 2 per row even on lg) so each one feels like an index
  // card from a recipe box rather than a tile in a dense grid. Stays single
  // column on mobile — the natural "stacked" pattern the user asked for.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((entry) => {
        const tone = mealTone(entry.meal_type ?? "other");
        return (
          <article
            key={entry.id}
            className="relative bg-paper text-ink rounded-soft ring-1 ring-ink/10 shadow-card hover:shadow-warm hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            {/* Colored top stripe — like the colored band on an index card. */}
            <span aria-hidden className={`absolute top-0 left-0 right-0 h-1.5 ${stripeClass(tone)}`} />

            <Link href={entry.href} className="block px-5 pt-5 pb-3">
              {/* Stamp-style kicker. */}
              <span
                className={`inline-block rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-bold ${tabClasses(tone)}`}
              >
                {entry.kicker}
              </span>
              <h3 className="mt-2 font-bold text-ink text-base md:text-lg leading-snug">
                {entry.title}
              </h3>
              {/* Recipe-card rule line. */}
              <span aria-hidden className="block mt-2 mb-3 border-b border-dashed border-ink/15" />
              {entry.narrative && (
                <p className="text-sm text-ink-soft line-clamp-3 leading-relaxed">
                  {entry.narrative}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="text-[11px] px-2 py-0.5 rounded-pill bg-honey/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-ink-muted">
                  Saved {new Date(entry.saved_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
            <div className="px-5 pb-4 pt-1 border-t border-ink/5 bg-paper/60">
              <KitchenCardActions
                targetType={entry.target_type}
                targetId={entry.target_id}
                targetLabel={entry.title}
                entryId={entry.id}
                initialMadeIt={entry.made_it}
                initialStars={entry.rating}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
