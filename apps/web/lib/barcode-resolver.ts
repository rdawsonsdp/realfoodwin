// Resolve a scanned barcode (UPC/EAN/etc.) to a human-readable product name
// with a three-tier cascade:
//
//   1. SELECT from public.products WHERE barcode = $1
//        ← instant after warmup. The cache fills naturally over time as users
//          scan things.
//   2. fetch Open Food Facts API
//        ← free, ~3M products globally. ~200-500ms.
//        ← write-through: when found, insert/upsert into products so the next
//          scan of the same code is a cache hit.
//   3. unknown
//        ← let the caller decide (fall back to passing the raw barcode to the
//          swap engine, or asking the user to take a photo).
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

function admin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

// Normalize a barcode for storage + lookup. OFF returns codes with leading
// zeros sometimes; the underlying upcs in our DB may or may not match. We
// store and search the raw digit string the scanner produced.
function normalize(code: string): string {
  return code.replace(/\D+/g, "");
}

// Open Food Facts product shape (only the fields we care about — there are
// hundreds more we ignore).
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
        // OFF asks identifying clients use a UA so they can debug heavy users
        // and reach out if usage patterns look broken.
        "User-Agent": "RealFoodWin/1.0 (hello@realfoodwin.org)",
      },
      // Don't let a slow OFF request hang the swap flow forever.
      signal: AbortSignal.timeout(2500),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as OFFResponse;
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    // Network error / timeout — treat as "not found" so the caller can
    // gracefully fall back rather than surface a scary error to the user.
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

export async function resolveBarcode(code: string): Promise<ResolvedBarcode | null> {
  const barcode = normalize(code);
  if (!barcode) return null;

  // 1) Cache hit.
  const supabase = createSupabaseServer();
  const { data: cached } = await supabase
    .from("products")
    .select("name, brand")
    .eq("barcode", barcode)
    .maybeSingle();
  if (cached && (cached as { name?: string }).name) {
    return {
      name: (cached as { name: string }).name,
      brand: (cached as { brand: string | null }).brand ?? null,
      source: "cache",
    };
  }

  // 2) Open Food Facts.
  const off = await fetchOpenFoodFacts(barcode);
  if (off) {
    const name = bestName(off);
    if (name) {
      const brand = firstBrand(off);
      // Write-through. Use service role so RLS doesn't block. upsert on the
      // unique `barcode` column so a concurrent scan from two clients won't
      // collide.
      const ingredients =
        off.ingredients_text
          ?.split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean) ?? [];
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
      } catch {
        // Cache failure is non-fatal — we still have the lookup result to
        // return to the user.
      }
      return { name, brand, source: "open_food_facts" };
    }
  }

  // 3) Unknown — let the caller fall back.
  return null;
}
