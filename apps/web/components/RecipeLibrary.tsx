"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AverageStars } from "./AverageStars";
import { RecipeCardActions } from "./RecipeCardActions";

export interface RecipeRow {
  id: string;
  title: string;
  time_min: number | null;
  difficulty: string | null;
  meal_type: string | null;
  tags: string[] | null;
  ingredients: unknown;
}

interface Props {
  recipes: RecipeRow[];
  ratings: Record<string, { avg: number; count: number }>;
}

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drink", "Side"];

function normalize(m: string | null | undefined): string {
  if (!m) return "Other";
  const lower = m.trim().toLowerCase();
  return MEAL_ORDER.find((o) => o.toLowerCase() === lower) ?? capitalize(m.trim());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function RecipeLibrary({ recipes, ratings }: Props) {
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const allTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      const t = normalize(r.meal_type);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => {
      const ai = MEAL_ORDER.indexOf(a[0]);
      const bi = MEAL_ORDER.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const t = normalize(r.meal_type);
      if (selectedTypes.size > 0 && !selectedTypes.has(t)) return false;
      if (!q) return true;
      const hay =
        (r.title ?? "").toLowerCase() +
        " " +
        (r.tags ?? []).join(" ").toLowerCase() +
        " " +
        (Array.isArray(r.ingredients)
          ? (r.ingredients as unknown[])
              .map((i) =>
                typeof i === "string"
                  ? i
                  : i && typeof i === "object" && "name" in i
                  ? String((i as { name: unknown }).name ?? "")
                  : "",
              )
              .join(" ")
              .toLowerCase()
          : "");
      return hay.includes(q);
    });
  }, [recipes, selectedTypes, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, RecipeRow[]>();
    for (const r of filtered) {
      const t = normalize(r.meal_type);
      const list = m.get(t) ?? [];
      list.push(r);
      m.set(t, list);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const ai = MEAL_ORDER.indexOf(a[0]);
      const bi = MEAL_ORDER.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  function toggle(t: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl mx-auto">
        <div className="card p-2 flex items-center gap-2 shadow-warm">
          <span className="pl-3 text-ink-muted">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, ingredients, or cravings…"
            className="flex-1 px-3 py-3 bg-transparent outline-none text-base placeholder:text-ink-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="btn-ghost text-sm pr-3"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-8">
        <aside className="md:sticky md:top-20 self-start">
          <h2 className="font-bold text-ink mb-3 pb-2 border-b-2 border-sage">Meal Type</h2>
          <ul className="space-y-2">
            {allTypes.map(([t, count]) => (
              <li key={t}>
                <label className="flex items-center gap-2 cursor-pointer text-sm hover:text-ink">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(t)}
                    onChange={() => toggle(t)}
                    className="w-4 h-4 accent-sage"
                  />
                  <span className="flex-1">{t}</span>
                  <span className="text-xs text-ink-muted">{count}</span>
                </label>
              </li>
            ))}
          </ul>
          {selectedTypes.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTypes(new Set())}
              className="btn-ghost text-xs mt-3"
            >
              Clear filters
            </button>
          )}
        </aside>

        <section>
          <p className="text-sm text-ink-soft mb-4">
            Showing {filtered.length} recipe{filtered.length === 1 ? "" : "s"}
            {selectedTypes.size > 0 && (
              <span className="ml-2 text-ink-muted">
                · filtered to {Array.from(selectedTypes).join(", ")}
              </span>
            )}
          </p>

          {grouped.length === 0 ? (
            <p className="text-ink-muted">No recipes match the current filters.</p>
          ) : (
            <div className="space-y-10">
              {grouped.map(([type, rows]) => (
                <div key={type}>
                  <h3 className="text-xl font-bold mb-4 tracking-tight">{type}</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rows.map((r) => (
                      <RecipeCard key={r.id} r={r} rating={ratings[r.id]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RecipeCard({
  r,
  rating,
}: {
  r: RecipeRow;
  rating?: { avg: number; count: number };
}) {
  const ingCount = Array.isArray(r.ingredients) ? r.ingredients.length : 0;
  const metaParts = [
    r.meal_type ?? "Recipe",
    r.time_min ? `${r.time_min} min` : null,
    ingCount > 0 ? `${ingCount} ingredients` : null,
  ].filter(Boolean) as string[];
  const meta = metaParts.join(" · ");

  return (
    <div className="card hover:shadow-warm hover:-translate-y-0.5 transition-all flex flex-col">
      <Link href={`/recipes/${r.id}`} className="block p-5 flex-1">
        <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">{meta}</div>
        <h3 className="font-bold text-ink mb-2">{r.title}</h3>
        <div className="mt-1">
          <AverageStars avg={rating?.avg} count={rating?.count} />
        </div>
        {r.tags && r.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {r.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-pill bg-honey/40">
                {t}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="px-3 pb-2 pt-1 border-t border-ink/5 bg-paper/60 flex items-center justify-between">
        <Link href={`/recipes/${r.id}`} className="text-sm text-sunrise font-semibold px-2 py-2">
          View →
        </Link>
        <RecipeCardActions
          recipeId={r.id}
          title={r.title}
          meta={metaParts.slice(0, 2).join(" · ")}
        />
      </div>
    </div>
  );
}
