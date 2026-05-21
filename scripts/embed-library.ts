/**
 * One-time backfill: embed every recipe and brand_product so the swap
 * matcher can do pgvector cosine top-N before calling Claude.
 *
 * Uses batched Voyage requests (128 inputs per call) so 415+ rows backfill in
 * ~5 API calls — comfortably within the free-tier 3 RPM / 10K TPM limit.
 *
 * Run:
 *   cd apps/web && pnpm exec tsx ../../scripts/embed-library.ts
 *
 * Idempotent: only embeds rows where embedding is null. Pass --all to
 * overwrite everything.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: "apps/web/.env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { embedBatch } from "@realfoodwin/gateway";

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

// Voyage allows up to 128 inputs and ~120K tokens per request. Our recipe /
// product texts are short (<200 tokens each), so 100 per batch is safe.
const BATCH_SIZE = 100;
// Free-tier rate limit is 3 RPM; pace ourselves at 25s between batches to
// stay well under that.
const BETWEEN_BATCH_MS = 25_000;

interface Row {
  id: string;
  text: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedTable(table: "recipes" | "brand_products", rows: Row[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (let batchIdx = 0; batchIdx * BATCH_SIZE < rows.length; batchIdx++) {
    const batch = rows.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    if (batchIdx > 0) {
      console.log(`  [${table}] waiting ${BETWEEN_BATCH_MS / 1000}s to stay under rate limit…`);
      await sleep(BETWEEN_BATCH_MS);
    }
    try {
      const vectors = await embedBatch(
        batch.map((r) => r.text),
        "document",
      );
      // Persist sequentially — Supabase updates are cheap, no need to batch.
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i]!;
        const v = vectors[i];
        if (!v) {
          failed++;
          continue;
        }
        const { error } = await admin
          .from(table)
          .update({ embedding: v.vector as unknown as string })
          .eq("id", row.id);
        if (error) {
          failed++;
          console.error(`  ✗ [${table}] ${row.text.slice(0, 50)}: ${error.message}`);
        } else {
          ok++;
        }
      }
      console.log(`  [${table}] batch ${batchIdx + 1}: embedded ${batch.length} rows (running total ${ok})`);
    } catch (err) {
      failed += batch.length;
      console.error(`  ✗ [${table}] batch ${batchIdx + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok, failed };
}

async function fetchRecipes(): Promise<Row[]> {
  let q = admin.from("recipes").select("id, title, description");
  if (!overwrite) q = q.is("embedding", null);
  const { data, error } = await q;
  if (error) throw new Error(`recipes fetch: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    text: [r.title as string, (r.description as string | null) ?? ""].filter(Boolean).join(" — "),
  }));
}

async function fetchProducts(): Promise<Row[]> {
  let q = admin.from("brand_products").select("id, name, description, brands(name)");
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
  console.log(`  ${recipes.length} recipes to embed (${Math.ceil(recipes.length / BATCH_SIZE)} batches)`);
  const recipeResult = await embedTable("recipes", recipes);

  if (recipes.length > 0) {
    console.log(`  waiting ${BETWEEN_BATCH_MS / 1000}s before products…`);
    await sleep(BETWEEN_BATCH_MS);
  }

  console.log("\nFetching brand_products…");
  const products = await fetchProducts();
  console.log(
    `  ${products.length} brand_products to embed (${Math.ceil(products.length / BATCH_SIZE)} batches)`,
  );
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
