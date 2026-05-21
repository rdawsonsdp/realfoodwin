/**
 * One-time backfill: embed every recipe and brand_product so the swap
 * matcher can do pgvector cosine top-N before calling Claude.
 *
 * Run:
 *   cd apps/web && pnpm exec tsx ../../scripts/embed-library.ts
 *
 * Re-running is safe — by default it only embeds rows where embedding is
 * still null. Pass --all to overwrite.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: "apps/web/.env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { embed } from "@realfoodwin/gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const overwrite = process.argv.includes("--all");

async function processWithConcurrency<T>(
  items: T[],
  worker: (item: T, idx: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let next = 0;
  async function pull() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => pull()));
}

interface Row {
  id: string;
  text: string;
}

async function embedTable(
  table: "recipes" | "brand_products",
  rows: Row[],
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  await processWithConcurrency(
    rows,
    async (r, idx) => {
      try {
        const { vector } = await embed(r.text, "document");
        const { error } = await admin
          .from(table)
          .update({ embedding: vector as unknown as string })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        ok++;
        if ((idx + 1) % 20 === 0) {
          console.log(`  [${table}] ${idx + 1}/${rows.length} done`);
        }
      } catch (err) {
        failed++;
        console.error(
          `  ✗ [${table}] ${r.text.slice(0, 50)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    4,
  );
  return { ok, failed };
}

async function fetchRecipes(): Promise<Row[]> {
  let q = admin.from("recipes").select("id, title, description, embedding");
  if (!overwrite) q = q.is("embedding", null);
  const { data, error } = await q;
  if (error) throw new Error(`recipes fetch: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    text: [r.title as string, (r.description as string | null) ?? ""].filter(Boolean).join(" — "),
  }));
}

async function fetchProducts(): Promise<Row[]> {
  let q = admin
    .from("brand_products")
    .select("id, name, description, brands(name), embedding");
  if (!overwrite) q = q.is("embedding", null);
  const { data, error } = await q;
  if (error) throw new Error(`brand_products fetch: ${error.message}`);
  return (data ?? []).map((r) => {
    const brand = (r as { brands?: { name?: string } | { name?: string }[] | null }).brands;
    const brandName = Array.isArray(brand) ? brand[0]?.name : brand?.name;
    const parts = [
      brandName ? `${brandName}:` : null,
      r.name as string,
      (r.description as string | null) ?? "",
    ].filter(Boolean);
    return { id: r.id as string, text: parts.join(" ") };
  });
}

async function main() {
  console.log(`Mode: ${overwrite ? "re-embed all rows" : "only rows with null embedding"}`);
  const start = Date.now();

  console.log("\nFetching recipes…");
  const recipes = await fetchRecipes();
  console.log(`  ${recipes.length} recipes to embed`);
  const recipeResult = await embedTable("recipes", recipes);

  console.log("\nFetching brand_products…");
  const products = await fetchProducts();
  console.log(`  ${products.length} brand_products to embed`);
  const productResult = await embedTable("brand_products", products);

  const totalMin = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\nDone in ${totalMin} min.`);
  console.log(`  recipes:        ${recipeResult.ok} ok, ${recipeResult.failed} failed`);
  console.log(`  brand_products: ${productResult.ok} ok, ${productResult.failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
