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
      {/* Toolbar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search your kitchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[180px] p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
        />

        <div className="flex flex-wrap gap-1">
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`px-3 py-1.5 rounded-pill text-xs font-semibold capitalize transition-colors ${
                meal === m
                  ? "bg-sunrise text-white"
                  : "bg-white ring-1 ring-ink/10 text-ink-soft hover:ring-sunrise/30"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="px-3 py-1.5 rounded-soft text-sm bg-white border border-ink/10 ml-auto"
          aria-label="Sort"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted">
          {q ? `Nothing matches "${q}".` : "No saved items in this view yet."}
        </div>
      ) : byMeal ? (
        // Grouped by meal type
        <div className="space-y-10">
          {byMeal.map((g) => (
            <section key={g.key}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 capitalize">
                  {g.key === "other" ? "Other" : g.key}
                </h2>
                <span className="text-xs text-ink-muted">
                  {g.items.length} {g.items.length === 1 ? "recipe" : "recipes"}
                </span>
              </div>
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

function Grid({ items }: { items: KitchenItem[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((entry) => (
        <div
          key={entry.id}
          className="card hover:shadow-warm hover:-translate-y-0.5 transition-all"
        >
          <Link href={entry.href} className="block p-5 pb-3">
            <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
              {entry.kicker}
            </div>
            <h3 className="font-bold text-ink leading-snug">{entry.title}</h3>
            {entry.narrative && (
              <p className="text-sm text-ink-soft mt-2 line-clamp-2">
                {entry.narrative}
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="flex flex-wrap gap-1">
                {entry.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2 py-0.5 rounded-pill bg-honey/40"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="text-xs text-ink-muted">
                {new Date(entry.saved_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
          <div className="px-5 pb-4">
            <KitchenCardActions
              targetType={entry.target_type}
              targetId={entry.target_id}
              targetLabel={entry.title}
              entryId={entry.id}
              initialMadeIt={entry.made_it}
              initialStars={entry.rating}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
