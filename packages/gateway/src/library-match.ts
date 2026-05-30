// Library-first matcher for the swap pipeline.
//
// Goal: return a curated recipe / product from the Real Food Win library in
// under 1.5s of LLM time. Falls back to null when nothing in the library is a
// decent fit — the swap runner then escalates to the full Sonnet generator.
//
// Flow:
//   1. Look up swap_query_cache by lower(query). Fresh hit → return immediately.
//   2. Embed the query via Voyage.
//   3. pgvector cosine top-K on recipes / brand_products (whichever goals ask for).
//   4. Haiku reads the shortlist and picks the best fit (or null).
//   5. Fetch full DB rows for the picks.
//   6. Write the result back to swap_query_cache.

import { getServiceSupabase } from "./supabase";
import { embed } from "./llm/voyage";
import { callWithTool, type ToolDefinition } from "./llm/anthropic";

// Cosine similarity threshold above which we trust pgvector's top candidate
// outright and skip the Haiku judge. Tune here if precision/recall drifts.
const BYPASS_COSINE_THRESHOLD = 0.85;

export type SwapGoal = "recipe" | "product";

export interface MatchedRecipe {
  id: string;
  title: string;
  description: string | null;
  meal_type: string | null;
  time_min: number | null;
  ingredients: unknown;
  steps: unknown;
}

export interface MatchedProduct {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
}

export interface LibraryMatchResult {
  recipe: MatchedRecipe | null;
  products: MatchedProduct[];
  // True when we got SOME candidates back from pgvector (regardless of
  // whether Haiku ultimately picked any). Lets the caller distinguish
  // "library has nothing relevant" (genuine no-match) from "library hasn't
  // been embedded yet" (skip gracefully, don't tell the user "no products").
  hadCandidates: boolean;
  cached: boolean;
  source: "cache" | "live";
  durationMs: number;
  // Per-step breakdown for the trace. Null when the step didn't run (e.g.,
  // cache hit short-circuits embed/pgvector/judge).
  timings: {
    cache_ms: number | null;
    embed_ms: number | null;
    pgvector_ms: number | null;
    judge_ms: number | null;
  };
  // Haiku judge's one-sentence rationale. Surfaced for the agent_traces row
  // so we can see why a candidate was or wasn't picked.
  judgeReason: string | null;
  // Cosine similarity of the winning candidate (recipe OR best product).
  // Loose proxy for "match strength".
  topSimilarity: number | null;
}

export interface LibraryMatchInput {
  query: string;
  goals: SwapGoal[]; // [] means "any" — try both
  topK?: number;
}

const JUDGE_TOOL: ToolDefinition = {
  name: "pick_library_match",
  description:
    "Given the user's swap query and a shortlist of curated library candidates, pick the best fit for each requested goal.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["recipe_id", "product_ids", "reason"],
    properties: {
      recipe_id: {
        type: ["string", "null"],
        description: "Best-fit recipe ID, or null if none fit. Only when 'recipe' in goals.",
      },
      product_ids: {
        type: "array",
        items: { type: "string" },
        maxItems: 8,
        description: "Fitting product IDs, best first. [] if none. Only when 'product' in goals.",
      },
      reason: {
        type: "string",
        maxLength: 200,
        description: "One sentence on why this is (or isn't) a fit.",
      },
    },
  },
};

const JUDGE_SYSTEM = `You are the Real Food Win library matcher.

You receive a user's swap query (what they're trying to replace, e.g.
"chocolate nougat bar", "Snickers", "Doritos") and a SHORTLIST of curated
real-food alternatives — recipes and / or brand products.

Your job: pick the candidates that actually match what the user wants.

Hard rules:
- Only pick candidates that genuinely solve the user's craving. If the query
  is "chocolate nougat bar" and a candidate is "pickled herring," do NOT
  pick it just because it's the highest cosine result.
- Be willing to return null / [] when nothing in the shortlist is a real fit.
  A miss is fine — the system falls back to fresh LLM generation. Don't
  force a bad match.
- For products: prefer items that share the dominant *form factor* with the
  query (bar → bars, chip → chips, drink → drinks, broth → broths).
- For recipes: prefer items that match the *flavor profile* or *category*
  (sweet treat → dessert; salty crunch → snack; dinner → dinner).
- Include EVERY product candidate that is a genuine match for the user's
  query — the UI shows them as "Other ideas" so the user can browse all
  curated real-food alternatives, not just one. If five different snickers-
  style bars all fit, return all five (best fit first). Don't withhold a
  genuine fit just to keep the list short.
- Return exactly one recipe ID or null (never multiple recipes).

Output ONLY via the pick_library_match tool.`;

function buildShortlistText(
  recipes: MatchedRecipe[],
  products: MatchedProduct[],
): string {
  const blocks: string[] = [];
  if (recipes.length > 0) {
    blocks.push("RECIPE CANDIDATES (cosine-shortlisted):");
    for (const r of recipes) {
      blocks.push(
        `- [${r.id}] ${r.title}${r.meal_type ? ` (${r.meal_type})` : ""}${r.time_min ? ` · ${r.time_min}min` : ""}\n    ${r.description ?? ""}`,
      );
    }
  }
  if (products.length > 0) {
    blocks.push("\nPRODUCT CANDIDATES (cosine-shortlisted):");
    for (const p of products) {
      blocks.push(
        `- [${p.id}] ${p.brand_name}: ${p.name}\n    ${p.description ?? ""}`,
      );
    }
  }
  return blocks.join("\n");
}

interface CacheHit {
  recipe_id: string | null;
  product_ids: string[];
  goals: string[];
  expires_at: string;
}

async function readCache(query: string): Promise<CacheHit | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("swap_query_cache")
    .select("recipe_id, product_ids, goals, expires_at")
    .eq("query_lc", query)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as unknown as CacheHit;
}

async function writeCache(
  queryLc: string,
  goals: SwapGoal[],
  recipeId: string | null,
  productIds: string[],
): Promise<void> {
  const sb = getServiceSupabase();
  await sb.from("swap_query_cache").upsert(
    {
      query_lc: queryLc,
      recipe_id: recipeId,
      product_ids: productIds,
      goals: goals,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "query_lc" },
  );
}

async function fetchRecipeById(id: string): Promise<MatchedRecipe | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("recipes")
    .select("id, title, description, meal_type, time_min, ingredients, steps")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as MatchedRecipe;
}

async function fetchProductsByIds(ids: string[]): Promise<MatchedProduct[]> {
  if (ids.length === 0) return [];
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("brand_products")
    .select("id, brand_id, name, description, product_url, image_url, brands(name)")
    .in("id", ids);
  if (error || !data) return [];
  // Preserve the requested order.
  const byId = new Map<string, MatchedProduct>();
  for (const row of data as unknown as Array<{
    id: string;
    brand_id: string;
    name: string;
    description: string | null;
    product_url: string | null;
    image_url: string | null;
    brands: { name?: string } | { name?: string }[] | null;
  }>) {
    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    byId.set(row.id, {
      id: row.id,
      brand_id: row.brand_id,
      brand_name: brand?.name ?? "",
      name: row.name,
      description: row.description,
      product_url: row.product_url,
      image_url: row.image_url,
    });
  }
  return ids.map((id) => byId.get(id)).filter((p): p is MatchedProduct => !!p);
}

export async function matchLibrary(
  input: LibraryMatchInput,
): Promise<LibraryMatchResult> {
  const start = Date.now();
  const queryLc = input.query.trim().toLowerCase();
  if (!queryLc) {
    return {
      recipe: null,
      products: [],
      hadCandidates: false,
      cached: false,
      source: "live",
      durationMs: 0,
      timings: { cache_ms: null, embed_ms: null, pgvector_ms: null, judge_ms: null },
      judgeReason: null,
      topSimilarity: null,
    };
  }
  const wantRecipe = input.goals.length === 0 || input.goals.includes("recipe");
  const wantProduct = input.goals.length === 0 || input.goals.includes("product");
  // Bumped from 10 → 15 so Haiku sees enough product candidates to populate a
  // multi-item "Other ideas" list (cap is 8 per JUDGE_TOOL, plus recipes).
  const topK = input.topK ?? 15;

  // 1. Cache lookup.
  // Only use a cached row when it actually searched every goal the current
  // request needs. A row written with goals=["recipe"] never searched the
  // product table, so its empty product_ids is "we didn't look," NOT
  // "we looked and found none" — reusing it would silently skip products on
  // later requests that want them. goals=[] in the cache row means we
  // searched both, so it's compatible with anything.
  const cacheStart = Date.now();
  const cached = await readCache(queryLc);
  const cacheMs = Date.now() - cacheStart;
  if (cached) {
    const cachedGoals = (cached.goals ?? []) as SwapGoal[];
    const cacheSearchedBoth = cachedGoals.length === 0;
    const cacheSearchedRecipe = cacheSearchedBoth || cachedGoals.includes("recipe");
    const cacheSearchedProduct = cacheSearchedBoth || cachedGoals.includes("product");
    const matchesGoals =
      (!wantRecipe || cacheSearchedRecipe) &&
      (!wantProduct || cacheSearchedProduct);
    if (matchesGoals) {
      const [recipe, products] = await Promise.all([
        cached.recipe_id && wantRecipe ? fetchRecipeById(cached.recipe_id) : Promise.resolve(null),
        wantProduct ? fetchProductsByIds(cached.product_ids) : Promise.resolve([]),
      ]);
      return {
        recipe,
        products,
        hadCandidates: true,
        cached: true,
        source: "cache",
        durationMs: Date.now() - start,
        timings: { cache_ms: cacheMs, embed_ms: null, pgvector_ms: null, judge_ms: null },
        judgeReason: null,
        topSimilarity: null,
      };
    }
  }

  // 2. Embed query.
  const embedStart = Date.now();
  const { vector } = await embed(input.query, "query");
  const embedMs = Date.now() - embedStart;
  const sb = getServiceSupabase();

  // 3. pgvector top-K shortlists.
  const pgvectorStart = Date.now();
  const [recipeRpc, productRpc] = await Promise.all([
    wantRecipe
      ? sb.rpc("match_recipes", { query_embedding: vector as unknown as string, k: topK })
      : Promise.resolve({ data: [] as unknown as Array<MatchedRecipe & { similarity: number }>, error: null }),
    wantProduct
      ? sb.rpc("match_brand_products", { query_embedding: vector as unknown as string, k: topK })
      : Promise.resolve({ data: [] as unknown as Array<MatchedProduct & { similarity: number }>, error: null }),
  ]);
  const recipeCandidates = (recipeRpc.data ?? []) as Array<MatchedRecipe & { similarity: number }>;
  const productCandidates = (productRpc.data ?? []) as Array<MatchedProduct & { similarity: number }>;
  const pgvectorMs = Date.now() - pgvectorStart;

  if (recipeCandidates.length === 0 && productCandidates.length === 0) {
    return {
      recipe: null,
      products: [],
      hadCandidates: false,
      cached: false,
      source: "live",
      durationMs: Date.now() - start,
      timings: { cache_ms: cacheMs, embed_ms: embedMs, pgvector_ms: pgvectorMs, judge_ms: null },
      judgeReason: null,
      topSimilarity: null,
    };
  }

  // 4. Haiku judge — but first, try the high-cosine bypass.
  //
  // The Haiku judge step costs 2.4-4.6s p50 from agent_traces and dominates
  // user-facing latency on every live library hit. When pgvector already
  // returns a candidate with cosine > BYPASS_COSINE_THRESHOLD, the embeddings
  // alone are confident enough — calling Haiku is just paying ~3s for a
  // rubber-stamp.
  const topRecipeSim = recipeCandidates[0]?.similarity ?? 0;
  const topProductSim = productCandidates[0]?.similarity ?? 0;
  const recipeQualifies = wantRecipe && topRecipeSim > BYPASS_COSINE_THRESHOLD;
  const productQualifies = wantProduct && topProductSim > BYPASS_COSINE_THRESHOLD;

  let pickedRecipeId: string | null = null;
  let pickedProductIds: string[] = [];
  let judgeMs: number;
  let judgeReason: string;

  if (recipeQualifies || productQualifies) {
    // Bypass path.
    if (wantRecipe && wantProduct) {
      // Recipe + products: take the recipe if it qualifies, plus up to 4
      // products that also clear the threshold.
      if (recipeQualifies) {
        pickedRecipeId = recipeCandidates[0]!.id;
      }
      pickedProductIds = productCandidates
        .filter((p) => p.similarity > BYPASS_COSINE_THRESHOLD)
        .slice(0, 4)
        .map((p) => p.id);
    } else if (wantProduct) {
      // Products only: take ALL that clear the threshold (up to 8), ordered
      // by similarity desc (pgvector already returns them that way).
      pickedProductIds = productCandidates
        .filter((p) => p.similarity > BYPASS_COSINE_THRESHOLD)
        .slice(0, 8)
        .map((p) => p.id);
    } else if (wantRecipe) {
      // Recipe only.
      pickedRecipeId = recipeCandidates[0]!.id;
    }
    const topSim = Math.max(
      recipeQualifies ? topRecipeSim : 0,
      productQualifies ? topProductSim : 0,
    );
    judgeReason = `bypassed: top cosine ${topSim.toFixed(3)} was a clear winner`;
    judgeMs = 0;
  } else {
    const judgeStart = Date.now();
    const userPrompt = [
      `USER QUERY: "${input.query.trim()}"`,
      `GOALS: ${input.goals.length ? input.goals.join(", ") : "either recipe or product"}`,
      "",
      buildShortlistText(recipeCandidates, productCandidates),
      "",
      'Pick the best library matches. If nothing is a genuine fit, set recipe_id to null and product_ids to []. Do not stretch.',
    ].join("\n");

    const judgeResult = await callWithTool({
      tier: "haiku",
      system: JUDGE_SYSTEM,
      user: userPrompt,
      tool: JUDGE_TOOL,
      maxTokens: 150,
      temperature: 0.0,
    });

    const judgement = judgeResult.toolInput as {
      recipe_id: string | null;
      product_ids: string[];
      reason: string;
    };
    judgeMs = Date.now() - judgeStart;

    // Defensive: only accept IDs that were in the shortlist (model could
    // hallucinate). And only honor the recipe / product pick if its goal
    // was actually requested.
    const recipeIds = new Set(recipeCandidates.map((r) => r.id));
    const productIds = new Set(productCandidates.map((p) => p.id));
    pickedRecipeId =
      wantRecipe && judgement.recipe_id && recipeIds.has(judgement.recipe_id)
        ? judgement.recipe_id
        : null;
    pickedProductIds = wantProduct
      ? (judgement.product_ids ?? []).filter((id) => productIds.has(id)).slice(0, 8)
      : [];
    judgeReason = judgement.reason ?? "";
  }

  // 5. Fetch full bodies.
  const [recipe, products] = await Promise.all([
    pickedRecipeId ? fetchRecipeById(pickedRecipeId) : Promise.resolve(null),
    fetchProductsByIds(pickedProductIds),
  ]);

  // 6. Write cache (only when there's something to cache — skip total misses
  // to keep the cache from poisoning future retries once embeddings improve).
  if (recipe || products.length > 0) {
    void writeCache(queryLc, input.goals, recipe?.id ?? null, products.map((p) => p.id));
  }

  // Winning candidate's cosine similarity — a loose match-strength proxy for
  // the trace. Picks the highest of (best picked recipe, best picked product).
  const pickedRecipeSim = pickedRecipeId
    ? recipeCandidates.find((r) => r.id === pickedRecipeId)?.similarity ?? null
    : null;
  const pickedProductSims = pickedProductIds
    .map((id) => productCandidates.find((p) => p.id === id)?.similarity ?? null)
    .filter((s): s is number => s != null);
  const topSimilarity =
    pickedRecipeSim != null || pickedProductSims.length > 0
      ? Math.max(pickedRecipeSim ?? 0, ...pickedProductSims)
      : null;

  return {
    recipe,
    products,
    hadCandidates: true,
    cached: false,
    source: "live",
    durationMs: Date.now() - start,
    timings: { cache_ms: cacheMs, embed_ms: embedMs, pgvector_ms: pgvectorMs, judge_ms: judgeMs },
    judgeReason: judgeReason || null,
    topSimilarity,
  };
}
