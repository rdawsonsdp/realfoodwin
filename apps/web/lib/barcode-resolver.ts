// Resolve a scanned barcode (UPC/EAN/etc.) to a human-readable product name
// with a four-tier cascade:
//
//   1. SELECT from public.products WHERE barcode = $1
//        ← instant after warmup. The cache fills naturally over time as users
//          scan things.
//   2. Negative cache lookup (public.barcode_misses).
//        ← skips a known-bad OFF round-trip. TTL guards against permanent
//          dead entries when OFF adds a product later.
//   3. fetch Open Food Facts API
//        ← free, ~3M products globally. ~200-500ms.
//        ← write-through (fire-and-forget): when found, upsert into products
//          so the next scan of the same code is a cache hit. We don't await
//          the write — it doesn't need to block the user.
//        ← on miss, write to barcode_misses so we don't re-fetch.
//   4. unknown
//        ← let the caller decide (fall back to passing the raw barcode to the
//          swap engine, or asking the user to take a photo).
//
// Every call returns a `timings` payload alongside the result so /api/barcode/
// lookup can log it to barcode_lookup_logs and surface it to the debug panel.
//
// Writes go through the service-role client because products INSERT is
// RLS-locked to service_role (see migration 0010_rls_policies.sql — no INSERT
// policy for authenticated, so RLS denies writes from the anon/auth-scoped
// client).

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export interface ResolvedBarcode {
  name: string;
  brand: string | null;
  source: "cache" | "open_food_facts";
}

export interface BarcodeTimings {
  source: "cache" | "negative_cache" | "open_food_facts" | "not_found" | "error";
  db_lookup_ms: number | null;
  negative_cache_ms: number | null;
  off_fetch_ms: number | null;
  db_upsert_ms: number | null;
  total_ms: number;
}

export interface BarcodeResolveResult {
  resolved: ResolvedBarcode | null;
  timings: BarcodeTimings;
  normalizedBarcode: string;
}

// 30 days — after that, re-check OFF in case the product was added.
const NEGATIVE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function admin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function normalize(code: string): string {
  return code.replace(/\D+/g, "");
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  countries?: string;
  ingredients_text?: string;
}

interface OFFResponse {
  status: 0 | 1;
  product?: OFFProduct;
}

async function fetchOpenFoodFacts(code: string): Promise<OFFProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,generic_name,brands,categories,countries,ingredients_text`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "RealFoodWin/1.0 (hello@realfoodwin.org)",
      },
      signal: AbortSignal.timeout(2500),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as OFFResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

function bestName(p: OFFProduct): string | null {
  const candidate =
    p.product_name_en?.trim() ||
    p.product_name?.trim() ||
    p.generic_name?.trim();
  return candidate || null;
}

function firstBrand(p: OFFProduct): string | null {
  if (!p.brands) return null;
  const first = p.brands.split(",")[0]?.trim();
  return first || null;
}

export async function resolveBarcode(code: string): Promise<BarcodeResolveResult> {
  const totalStart = Date.now();
  const barcode = normalize(code);
  const timings: BarcodeTimings = {
    source: "not_found",
    db_lookup_ms: null,
    negative_cache_ms: null,
    off_fetch_ms: null,
    db_upsert_ms: null,
    total_ms: 0,
  };
  if (!barcode) {
    timings.total_ms = Date.now() - totalStart;
    return { resolved: null, timings, normalizedBarcode: "" };
  }

  // 1) Products cache hit.
  const supabase = createSupabaseServer();
  const dbStart = Date.now();
  const { data: cached } = await supabase
    .from("products")
    .select("name, brand")
    .eq("barcode", barcode)
    .maybeSingle();
  timings.db_lookup_ms = Date.now() - dbStart;
  if (cached && (cached as { name?: string }).name) {
    timings.source = "cache";
    timings.total_ms = Date.now() - totalStart;
    return {
      resolved: {
        name: (cached as { name: string }).name,
        brand: (cached as { brand: string | null }).brand ?? null,
        source: "cache",
      },
      timings,
      normalizedBarcode: barcode,
    };
  }

  // 2) Negative cache hit (we tried OFF recently and it had nothing).
  const negStart = Date.now();
  const { data: negHit } = await supabase
    .from("barcode_misses")
    .select("checked_at")
    .eq("barcode", barcode)
    .maybeSingle();
  timings.negative_cache_ms = Date.now() - negStart;
  if (negHit) {
    const checkedAtMs = new Date((negHit as { checked_at: string }).checked_at).getTime();
    if (Date.now() - checkedAtMs < NEGATIVE_CACHE_TTL_MS) {
      timings.source = "negative_cache";
      timings.total_ms = Date.now() - totalStart;
      return { resolved: null, timings, normalizedBarcode: barcode };
    }
    // Stale — fall through to re-check OFF.
  }

  // 3) Open Food Facts.
  const offStart = Date.now();
  const off = await fetchOpenFoodFacts(barcode);
  timings.off_fetch_ms = Date.now() - offStart;
  if (off) {
    const name = bestName(off);
    if (name) {
      const brand = firstBrand(off);
      const ingredients =
        off.ingredients_text
          ?.split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean) ?? [];
      // Fire-and-forget. We have the answer the user needs; the cache fill
      // doesn't have to block the response. Time the write for observability
      // but return as soon as the fetch resolves.
      const upsertStart = Date.now();
      // Fire-and-forget; PostgrestFilterBuilder is a PromiseLike, so wrap in
      // a real Promise so we can catch without blocking.
      void (async () => {
        try {
          await admin()
            .from("products")
            .upsert(
              {
                barcode,
                name,
                brand,
                category: off.categories?.split(",")[0]?.trim() || null,
                canonical_ingredients: ingredients.slice(0, 30),
                source: "open_food_facts",
                confidence: "high",
                last_refreshed: new Date().toISOString(),
              },
              { onConflict: "barcode" },
            );
          timings.db_upsert_ms = Date.now() - upsertStart;
        } catch {
          // non-fatal
        }
      })();
      timings.source = "open_food_facts";
      timings.total_ms = Date.now() - totalStart;
      return {
        resolved: { name, brand, source: "open_food_facts" },
        timings,
        normalizedBarcode: barcode,
      };
    }
  }

  // OFF returned nothing usable → write to negative cache so we don't re-hit.
  // Fire-and-forget; we have the answer the user needs (none).
  void (async () => {
    try {
      await admin()
        .from("barcode_misses")
        .upsert({ barcode, checked_at: new Date().toISOString() }, { onConflict: "barcode" });
    } catch {
      // non-fatal
    }
  })();

  // 4) Unknown.
  timings.source = "not_found";
  timings.total_ms = Date.now() - totalStart;
  return { resolved: null, timings, normalizedBarcode: barcode };
}
