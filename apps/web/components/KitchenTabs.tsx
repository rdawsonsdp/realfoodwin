"use client";

// KitchenTabs — wraps both "My Kitchen" (the user's saved recipes/swaps)
// and "Real Food Kitchen" (the curated recipe library) under one page,
// with a unified search bar that hits both sources.
//
// When the search box is empty we show the active tab's full UI as-is
// (KitchenBrowser or RecipeLibrary, each with its own filters). When the
// user types, we replace both with a single merged result list so they
// can see hits from either kitchen without flipping tabs.

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { KitchenBrowser, type KitchenItem } from "./KitchenBrowser";
import { RecipeLibrary, type RecipeRow } from "./RecipeLibrary";
import { AverageStars } from "./AverageStars";

type Tab = "mine" | "real-food";

interface Props {
  myItems: KitchenItem[];
  recipes: RecipeRow[];
  ratings: Record<string, { avg: number; count: number }>;
  /** Initial tab from the ?tab= query param. */
  initialTab?: Tab;
}

interface MergedHit {
  key: string;
  source: "mine" | "real-food";
  title: string;
  kicker: string;
  href: string;
  mealType: string | null;
  tags: string[];
  rating?: { avg: number; count: number };
}

export function KitchenTabs({
  myItems,
  recipes,
  ratings,
  initialTab = "mine",
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");

  // Mirror tab into the URL so reloads preserve state and shareable links work.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);

  const searching = query.trim().length >= 2;

  const hits: MergedHit[] = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    const out: MergedHit[] = [];

    for (const it of myItems) {
      const hay = `${it.title} ${it.kicker} ${(it.tags ?? []).join(" ")}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({
          key: `mine:${it.id}`,
          source: "mine",
          title: it.title,
          kicker: it.kicker,
          href: it.href,
          mealType: it.meal_type,
          tags: it.tags ?? [],
        });
      }
    }

    for (const r of recipes) {
      const ingredients = Array.isArray(r.ingredients)
        ? (r.ingredients as { name?: string }[])
            .map((i) => i?.name)
            .filter(Boolean)
            .join(" ")
        : "";
      const hay = `${r.title} ${r.description ?? ""} ${(r.tags ?? []).join(" ")} ${ingredients}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({
          key: `recipe:${r.id}`,
          source: "real-food",
          title: r.title,
          kicker: r.meal_type ?? "Recipe",
          href: `/recipes/${r.id}`,
          mealType: r.meal_type,
          tags: r.tags ?? [],
          rating: ratings[r.id],
        });
      }
    }
    return out;
  }, [query, searching, myItems, recipes, ratings]);

  const mineCount = myItems.length;
  const realCount = recipes.length;

  return (
    <div>
      <div className="mb-5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-pill bg-paper/15 ring-1 ring-paper/20 p-1 backdrop-blur-sm self-start">
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={pill(tab === "mine")}
          >
            My Kitchen{" "}
            <span className="ml-1 text-[10px] opacity-70">({mineCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("real-food")}
            className={pill(tab === "real-food")}
          >
            Real Food Kitchen{" "}
            <span className="ml-1 text-[10px] opacity-70">({realCount})</span>
          </button>
        </div>
        <div className="flex-1 flex items-center gap-2 rounded-pill bg-paper text-ink ring-1 ring-ink/15 px-3 py-1.5 shadow-card focus-within:ring-coral transition">
          <span aria-hidden className="text-ink-muted text-sm">🔍</span>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search both kitchens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none text-base text-ink placeholder:text-ink/50 py-1"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-ink-muted hover:text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-ink/5"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {searching ? (
        <SearchResults query={query} hits={hits} />
      ) : tab === "mine" ? (
        <KitchenBrowser items={myItems} />
      ) : (
        <RecipeLibrary recipes={recipes} ratings={ratings} />
      )}
    </div>
  );
}

function pill(isActive: boolean): string {
  return `px-3 md:px-4 py-1.5 rounded-pill text-sm font-semibold transition ${
    isActive ? "bg-paper text-ink shadow-card" : "text-paper/80 hover:text-paper"
  }`;
}

function SearchResults({
  query,
  hits,
}: {
  query: string;
  hits: MergedHit[];
}) {
  if (hits.length === 0) {
    return (
      <div className="card p-6 md:p-10 text-center">
        <p className="text-ink-soft">
          No matches for <strong>{query}</strong> in either kitchen.
        </p>
      </div>
    );
  }
  const mine = hits.filter((h) => h.source === "mine");
  const real = hits.filter((h) => h.source === "real-food");
  return (
    <div className="space-y-6">
      {mine.length > 0 && (
        <Section
          label="From My Kitchen"
          badgeClass="bg-coral text-white"
          hits={mine}
        />
      )}
      {real.length > 0 && (
        <Section
          label="From Real Food Kitchen"
          badgeClass="bg-forest-700 text-paper"
          hits={real}
        />
      )}
    </div>
  );
}

function Section({
  label,
  badgeClass,
  hits,
}: {
  label: string;
  badgeClass: string;
  hits: MergedHit[];
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-paper/80 mb-2">
        {label} <span className="opacity-60">({hits.length})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {hits.map((h) => (
          <Link
            key={h.key}
            href={h.href}
            className="card p-4 hover:shadow-warm hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-[10px] uppercase tracking-[0.14em] font-bold px-2 py-0.5 rounded-pill ${badgeClass}`}
              >
                {label === "From My Kitchen" ? "Mine" : "Real Food"}
              </span>
              {h.rating && h.rating.count > 0 && (
                <AverageStars
                  avg={h.rating.avg}
                  count={h.rating.count}
                  size="sm"
                />
              )}
            </div>
            <p className="text-base font-semibold text-ink leading-tight line-clamp-2">
              {h.title}
            </p>
            <p className="text-xs text-ink-muted mt-1">{h.kicker}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
