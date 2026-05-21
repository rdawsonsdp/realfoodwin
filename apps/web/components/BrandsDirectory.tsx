"use client";

import { useMemo, useState } from "react";
import type { BrandRow, BrandProduct } from "@/app/brands/page";

const ALL = "All";

export function BrandsDirectory({ brands }: { brands: BrandRow[] }) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      if (b.category && b.category.trim()) set.add(b.category.trim());
    }
    return [ALL, ...Array.from(set).sort()];
  }, [brands]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    m.set(ALL, brands.length);
    for (const b of brands) {
      const c = (b.category ?? "").trim() || "Other";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [brands]);

  const [active, setActive] = useState<string>(ALL);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return brands.filter((b) => {
      const matchesCat = active === ALL || (b.category ?? "").trim() === active;
      if (!matchesCat) return false;
      if (!needle) return true;
      const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [brands, active, q]);

  if (brands.length === 0) {
    return <p className="text-paper/70 text-center">No brands yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto scroll-row -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {categories.map((c) => {
            const isActive = c === active;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition-colors ${
                  isActive
                    ? "bg-coral text-paper ring-coral"
                    : "bg-cream/10 text-paper/90 ring-paper/20 hover:bg-cream/20"
                }`}
              >
                {c}
                <span className={`ml-1.5 text-xs ${isActive ? "text-paper/80" : "text-paper/60"}`}>
                  {counts.get(c) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brands…"
          className="w-full md:max-w-sm rounded-full bg-cream/10 ring-1 ring-paper/20 px-4 py-2 text-sm text-paper placeholder:text-paper/50 focus:outline-none focus:ring-2 focus:ring-coral"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-paper/70 text-center py-8">No brands match.</p>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {filtered.map((b) => (
            <li key={b.id}>
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrandCard({ brand }: { brand: BrandRow }) {
  const href = brand.website_url ?? brand.url ?? null;
  const products = (brand.brand_products ?? [])
    .slice()
    .sort(
      (a, b) =>
        ((a as { sort_order?: number }).sort_order ?? 0) -
        ((b as { sort_order?: number }).sort_order ?? 0),
    );

  return (
    <article className="card p-4 h-full flex flex-col gap-3">
      <header className="flex items-center gap-3">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logo_url}
            alt={`${brand.name} logo`}
            className="w-14 h-14 object-contain rounded-soft bg-paper"
            loading="lazy"
          />
        ) : (
          <div className="w-14 h-14 rounded-soft bg-gradient-to-br from-cream to-honey/40 ring-1 ring-ink/10 grid place-items-center text-2xl">
            🥗
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base text-ink truncate">{brand.name}</h2>
          {brand.category && (
            <p className="text-xs uppercase tracking-[0.14em] text-coral font-semibold truncate">
              {brand.category}
            </p>
          )}
        </div>
      </header>

      {brand.description && (
        <p className="text-sm text-ink-muted leading-snug">{brand.description}</p>
      )}

      {products.length > 0 && <BrandProductsRow products={products} brandName={brand.name} />}

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${brand.name}`}
          className="mt-auto inline-flex items-center justify-between text-sm font-semibold text-coral hover:text-coral/80"
        >
          <span className="truncate">{stripScheme(href)}</span>
          <span className="ml-2 shrink-0">Visit →</span>
        </a>
      )}
    </article>
  );
}

function BrandProductsRow({ products, brandName }: { products: BrandProduct[]; brandName: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-muted mb-1.5">
        Products we like
      </p>
      <div className="flex gap-2 overflow-x-auto scroll-row -mx-1 px-1 pb-1">
        {products.map((p) => (
          <a
            key={p.id}
            href={p.product_url ?? "#"}
            target={p.product_url ? "_blank" : undefined}
            rel={p.product_url ? "noopener noreferrer" : undefined}
            className="rounded-soft ring-1 ring-ink/10 p-2 w-36 shrink-0 bg-paper hover:shadow-warm transition-shadow flex flex-col gap-1.5"
            aria-label={`${brandName}: ${p.name}`}
          >
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="w-full h-20 object-contain bg-paper rounded-soft"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-20 rounded-soft bg-gradient-to-br from-cream to-honey/40 ring-1 ring-ink/10 grid place-items-center text-2xl">
                🥗
              </div>
            )}
            <div className="text-xs font-semibold text-ink line-clamp-2 leading-tight">
              {p.name}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
