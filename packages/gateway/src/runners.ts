import {
  SwapGenerator,
  RecipeIterator,
  QuizSummary,
  RecipeBuilder,
} from "@realfoodwin/agents";
import {
  callWithTool,
  callWithToolAndWebSearch,
  callText,
  type ImageInput,
} from "./llm/anthropic";
import { embed } from "./llm/voyage";
import { getServiceSupabase } from "./supabase";
import { loadUserContext, composePromptBlocks } from "./context";
import { logAgentCall, calculateCost } from "./logging";
import { cacheSwap, getCachedSwap } from "./cache";
import { NoLibraryProductsError, SchemaValidationError } from "./errors";
import {
  matchLibrary,
  type MatchedRecipe,
  type MatchedProduct,
  type SwapGoal,
} from "./library-match";

export type ClientPlatform = "ios" | "android" | "web";

// Domains we refuse to write into the library. Marketplaces, big-box, and
// known review/listicle hosts aren't "the brand's own site" and embedding
// their URLs into brand_products would mislead the matcher.
const BLOCKED_PERSIST_DOMAINS = new Set([
  "amazon.com",
  "www.amazon.com",
  "walmart.com",
  "www.walmart.com",
  "target.com",
  "www.target.com",
  "instacart.com",
  "www.instacart.com",
  "thrivemarket.com",
  "www.thrivemarket.com",
  "ebay.com",
  "etsy.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "reddit.com",
  "www.reddit.com",
  "youtube.com",
  "www.youtube.com",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
]);

function isBrandSiteUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (BLOCKED_PERSIST_DOMAINS.has(host)) return false;
    // Heuristic: listicle/blog paths often live under /best, /review,
    // /roundup. Skip if the URL path screams "review article".
    const path = u.pathname.toLowerCase();
    if (/\b(best|review|roundup|vs|versus)\b/.test(path)) return false;
    return true;
  } catch {
    return false;
  }
}

// Find an existing brand by name (case-insensitive). Returns null when the
// brand isn't already in the catalog — we DO NOT auto-create brands; the
// authorized-brand list is curated by the Real Food Win team.
async function findAuthorizedBrand(name: string): Promise<string | null> {
  const sb = getServiceSupabase();
  const trimmed = name.trim();
  const { data: existing } = await sb
    .from("brands")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  return existing ? (existing as { id: string }).id : null;
}

interface PersistInput {
  brandName: string;
  productName: string;
  description: string | null;
  productUrl: string;
  imageUrl: string | null;
}

// Insert a Sonnet-discovered product into brand_products with an embedding
// so future "snickers"-style queries hit the library instead of paying for
// another web fallback. Returns the product id, or null if we declined to
// persist (bad domain, duplicate, error).
async function persistDiscoveredProduct(input: PersistInput): Promise<string | null> {
  if (!isBrandSiteUrl(input.productUrl)) return null;
  const sb = getServiceSupabase();

  // Dedupe by URL OR by (brand, name) — either match means it's already
  // in the library and we should leave it alone.
  const { data: byUrl } = await sb
    .from("brand_products")
    .select("id")
    .eq("product_url", input.productUrl)
    .maybeSingle();
  if (byUrl) return (byUrl as { id: string }).id;

  const brandId = await findAuthorizedBrand(input.brandName);
  if (!brandId) {
    // Sonnet returned a product from a brand we haven't authorized. The
    // web_search tool's allowed_domains should have prevented this, but
    // belt-and-suspenders: refuse to persist.
    return null;
  }
  const { data: byName } = await sb
    .from("brand_products")
    .select("id")
    .eq("brand_id", brandId)
    .ilike("name", input.productName.trim())
    .maybeSingle();
  if (byName) return (byName as { id: string }).id;

  // Embed the product text the same way the offline backfill does
  // (title + description) so similarity scoring lines up.
  const embedText = `${input.brandName.trim()}: ${input.productName.trim()}${
    input.description ? ` — ${input.description}` : ""
  }`;
  let embedding: number[] | null = null;
  try {
    const { vector } = await embed(embedText, "document");
    embedding = vector;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[persistDiscoveredProduct] embed failed, inserting without vector:", err);
  }

  const { data: inserted, error } = await sb
    .from("brand_products")
    .insert({
      brand_id: brandId,
      name: input.productName.trim(),
      description: input.description,
      product_url: input.productUrl,
      image_url: input.imageUrl,
      tags: ["auto_web"],
      embedding,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    // eslint-disable-next-line no-console
    console.warn("[persistDiscoveredProduct] insert failed:", error?.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

// System-prompt suffix used when Sonnet runs with the web_search tool. The
// search is restricted at the tool level (allowed_domains) to the brand
// websites listed in our `brands` table — these are the brands the Real
// Food Win team has explicitly authorized. The prompt mirrors that
// constraint so the model knows the bound.
function buildWebSearchPromptSuffix(authorizedHostnames: string[]): string {
  const list = authorizedHostnames.length
    ? authorizedHostnames.map((h) => `  - ${h}`).join("\n")
    : "  (no brand websites are currently configured)";
  return `

You have access to the web_search tool. The tool is RESTRICTED to a curated
list of authorized real-food brand websites — you cannot browse the open web,
only these brand sites:
${list}

Use web_search ONLY when:
- The user is asking for a real-food packaged product to BUY (goal: product), AND
- You don't already know a specific authorized-brand product that's a strong fit.

When you search:
- Search for the food category + brand name OR keywords like "shop", "products".
- Read product pages from the authorized brand sites listed above.
- If a clear authorized-brand product surfaces, set product_url to its direct
  page on the brand's own site and brand_name to the brand. Do not invent URLs.
- If NO authorized brand carries a fit, do NOT recommend a non-authorized
  product. Fall back to a recipe (write it from your own knowledge).

Do NOT search for recipes — write recipes from your own knowledge.
Do NOT run more than 3 searches for any one request.`;
}

// Pulls the list of authorized brand hostnames from the brands.website_url
// column. We strip scheme + path and dedupe. Used to bound the web_search
// tool's allowed_domains.
async function getAuthorizedBrandHostnames(): Promise<string[]> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("brands")
      .select("website_url")
      .not("website_url", "is", null);
    const hosts = new Set<string>();
    for (const row of (data ?? []) as Array<{ website_url: string | null }>) {
      const url = row.website_url?.trim();
      if (!url) continue;
      try {
        const u = new URL(url.startsWith("http") ? url : `https://${url}`);
        const host = u.hostname.replace(/^www\./, "");
        if (host) hosts.add(host);
      } catch {
        // skip malformed
      }
    }
    return Array.from(hosts).sort();
  } catch {
    return [];
  }
}

// ---------------- Swap Generator ----------------

export interface SwapPreferencesInput {
  goals?: ("recipe" | "product")[];
  dietary_styles?: string[];
  allergens?: string[];
  max_prep_minutes?: number | null;
  prioritize?: string[];
  must_include?: string[];
  // Soft avoids from coach memory (dislikes, learned aversions). Rendered as a
  // "prefer to avoid" line — not a hard allergen constraint, but a strong hint.
  avoid_soft?: string[];
}

export interface SwapGeneratorRunInput {
  userId: string | null;
  productId?: string | null;
  request: string; // typed query or product name (may be blank if image-only)
  image?: ImageInput;
  preferences?: SwapPreferencesInput | null;
  avoidTitles?: string[] | null;
  feedback?: string | null;
  clientPlatform: ClientPlatform;
  skipCache?: boolean;
  // Per-request trace id minted by /api/swap. Threads through agent_calls and
  // events so a single id walks the whole pipeline.
  requestId?: string | null;
}

// Structured per-request trace payload. The /api/swap route writes this to
// the agent_traces table verbatim and the client surfaces it in the debug
// panel below the swap card. classification_reasoning is the implicit
// routing tag, not a real classifier output.
export interface SwapTrace {
  request_id: string | null;
  classification_reasoning:
    | "cache_hit"
    | "library_hit"
    | "library_miss_llm_fallback"
    | "library_miss_web_fallback"
    | "image_route"
    | "product_only_no_match";
  classification_confidence: number | null;
  source_chosen: "cache" | "library" | "llm" | "web" | "not_found";
  source_reasoning: string | null;
  db_match_found: boolean;
  library_recipe_id: string | null;
  library_product_ids: string[];
  category_implicit: string | null;
  recommendations: Array<{ id: string | null; title: string; kind: "primary" | "alternate" }>;
  latency_cache_ms: number | null;
  latency_embed_ms: number | null;
  latency_pgvector_ms: number | null;
  latency_judge_ms: number | null;
  latency_llm_ms: number | null;
  latency_web_ms: number | null;
  latency_total_ms: number;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  web_searches: string[];
  web_urls_fetched: string[];
  library_written: boolean;
  library_written_product_id: string | null;
}

// Convert a curated library match into a SwapGenerator.OutputSchema-shaped
// result. We don't try to fake the LLM's analysis fields (nutrition,
// ingredient_analysis, tuned_for_you) — we stub them with a single honest
// "from the Real Food Win library" line so the response shape stays valid
// without inventing data. The UI can show extra detail when it exists; the
// library hit is the curated content, that's the value.
function buildSwapOutputFromLibrary(
  recipe: MatchedRecipe | null,
  products: MatchedProduct[],
): SwapGenerator.SwapGeneratorOutput {
  if (recipe) {
    const ingredients = Array.isArray(recipe.ingredients)
      ? (recipe.ingredients as Array<{
          name?: string;
          quantity?: string;
          unit?: string;
        }>).map((ing) => ({
          name: String(ing.name ?? ""),
          quantity: String(ing.quantity ?? ""),
          ...(ing.unit ? { unit: String(ing.unit) } : {}),
        }))
      : [];
    const steps = Array.isArray(recipe.steps)
      ? (recipe.steps as unknown[]).map((s) => String(s))
      : [];
    const productAlternates = products.slice(0, 7).map((p) => ({
      title: `${p.brand_name}: ${p.name}`,
      narrative: p.description ?? "",
      ...(p.product_url ? { product_url: p.product_url } : {}),
      brand_name: p.brand_name,
      ...(p.image_url ? { product_image_url: p.image_url } : {}),
    }));
    return {
      title: recipe.title,
      recipe: {
        ingredients,
        steps,
        time_min: recipe.time_min ?? 0,
        ...(recipe.meal_type ? { meal_type: recipe.meal_type } : {}),
      },
      narrative: recipe.description ?? "Curated from the Real Food Win recipe library.",
      tuned_for_you_reasons: [
        "Hand-picked from the Real Food Win recipe library",
        "Whole-food ingredients only — no seed oils, no ultra-processed shortcuts",
      ],
      alternates: productAlternates,
    };
  }

  const [primary, ...rest] = products;
  if (!primary) throw new Error("buildSwapOutputFromLibrary called with empty match");
  return {
    title: `${primary.brand_name}: ${primary.name}`,
    recipe: { ingredients: [], steps: [], time_min: 0 },
    narrative:
      primary.description ?? `${primary.brand_name} — curated from the Real Food Win brand list.`,
    tuned_for_you_reasons: [
      `From ${primary.brand_name}, a brand on the Real Food Win curated list`,
      "Whole-food ingredients only",
    ],
    ...(primary.product_url ? { product_url: primary.product_url } : {}),
    brand_name: primary.brand_name,
    ...(primary.image_url ? { product_image_url: primary.image_url } : {}),
    alternates: rest.slice(0, 7).map((p) => ({
      title: `${p.brand_name}: ${p.name}`,
      narrative: p.description ?? "",
      ...(p.product_url ? { product_url: p.product_url } : {}),
      brand_name: p.brand_name,
      ...(p.image_url ? { product_image_url: p.image_url } : {}),
    })),
  };
}

function formatPreferences(p: SwapPreferencesInput | null | undefined): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.goals && p.goals.length && p.goals.length < 2) {
    lines.push(`Goal: ${p.goals[0] === "recipe" ? "a real-food recipe" : "a real-food product they can buy"}`);
  }
  if (p.dietary_styles?.length) lines.push(`Dietary style: ${p.dietary_styles.join(", ")}`);
  if (p.allergens?.length) lines.push(`Must AVOID (allergens): ${p.allergens.join(", ")}`);
  if (p.avoid_soft?.length) lines.push(`Prefer to avoid (user has told the coach they dislike these — don't lead with them): ${p.avoid_soft.join(", ")}`);
  if (p.max_prep_minutes != null) lines.push(`Max prep time: ${p.max_prep_minutes} minutes`);
  if (p.prioritize?.length) lines.push(`Prioritize: ${p.prioritize.join(", ")}`);
  if (p.must_include?.length) lines.push(`Must include: ${p.must_include.join(", ")}`);
  if (!lines.length) return "";
  return `\n\nUser preferences for this swap (treat as hard constraints):\n- ${lines.join("\n- ")}`;
}

// Debug payload surfaced from the swap pipeline so the UI can show why/how the
// agent picked this swap. Temporary observability — remove once we're confident.
export interface SwapDebug {
  source: "library" | "llm" | "cache";
  model: string | null;
  prompt_version: string | null;
  request: string;
  merged_preferences: SwapPreferencesInput | null;
  avoid_titles: string[] | null;
  feedback: string | null;
  user_context: {
    has_profile: boolean;
    has_household: boolean;
    household_member_count: number;
    summary: string | null;
    recent_wins: string[];
    recent_misses: string[];
    top_rated: string[];
    low_rated: string[];
    expert_reviewer_notes: string[];
    admin_coaching_notes: string[];
    cuisine_affinity: string[];
    occasion_patterns: string[];
    dismissal_reasons: string[];
    system_rules: string[];
  } | null;
  user_prompt: string | null;
}

function digestUserContext(ctx: Awaited<ReturnType<typeof loadUserContext>>): SwapDebug["user_context"] {
  return {
    has_profile: ctx.profile !== null,
    has_household: ctx.household !== null,
    household_member_count: ctx.householdMembers.length,
    summary: ctx.summary,
    recent_wins: ctx.recentWins,
    recent_misses: ctx.recentMisses,
    top_rated: ctx.topRated,
    low_rated: ctx.lowRated,
    expert_reviewer_notes: ctx.expertReviewerNotes,
    admin_coaching_notes: ctx.adminCoachingNotes,
    cuisine_affinity: ctx.cuisineAffinity,
    occasion_patterns: ctx.occasionPatterns,
    dismissal_reasons: ctx.dismissalReasons,
    system_rules: ctx.systemRules,
  };
}

export async function runSwapGenerator(input: SwapGeneratorRunInput) {
  const overallStart = Date.now();
  const requestId = input.requestId ?? null;

  // Cache hit?
  if (input.userId && input.productId && !input.skipCache) {
    const hit = await getCachedSwap(input.userId, input.productId);
    if (hit) {
      const debug: SwapDebug = {
        source: "cache",
        model: null,
        prompt_version: null,
        request: input.request,
        merged_preferences: input.preferences ?? null,
        avoid_titles: input.avoidTitles ?? null,
        feedback: input.feedback ?? null,
        user_context: null,
        user_prompt: null,
      };
      const trace: SwapTrace = {
        request_id: requestId,
        classification_reasoning: "cache_hit",
        classification_confidence: null,
        source_chosen: "cache",
        source_reasoning: null,
        db_match_found: true,
        library_recipe_id: null,
        library_product_ids: [],
        category_implicit: null,
        recommendations: [{ id: hit?.id ?? null, title: "(cached swap)", kind: "primary" }],
        latency_cache_ms: null,
        latency_embed_ms: null,
        latency_pgvector_ms: null,
        latency_judge_ms: null,
        latency_llm_ms: null,
        latency_web_ms: null,
        latency_total_ms: Date.now() - overallStart,
        tokens_input: null,
        tokens_output: null,
        cost_usd: null,
        web_searches: [],
        web_urls_fetched: [],
        library_written: false,
        library_written_product_id: null,
      };
      return { cached: true, swap: hit, debug, trace };
    }
  }

  // Library-first matcher. Photo swaps need vision so they always hit Sonnet,
  // but every text query gets a sub-2s curated lookup before we fall through
  // to a fresh LLM generation. When the user explicitly asked for a PRODUCT
  // and the brand catalog has no match, we surface "no products found" rather
  // than letting Claude invent SKUs that aren't in our directory.
  if (!input.image && input.request.trim().length >= 2) {
    const goals: SwapGoal[] = (input.preferences?.goals as SwapGoal[] | undefined) ?? [];
    const productOnly = goals.length === 1 && goals[0] === "product";
    const libraryStart = Date.now();
    try {
      const match = await matchLibrary({ query: input.request, goals });
      if (match.recipe || match.products.length > 0) {
        const output = buildSwapOutputFromLibrary(match.recipe, match.products);
        let saved = null;
        if (input.userId) {
          saved = await cacheSwap({
            user_id: input.userId,
            product_id: input.productId ?? null,
            recipe: output.recipe,
            nutrition: output.nutrition ?? {},
            narrative: output.narrative,
            output,
            swap_target: input.request,
          });
        }
        const debug: SwapDebug = {
          source: "library",
          model: null,
          prompt_version: null,
          request: input.request,
          merged_preferences: input.preferences ?? null,
          avoid_titles: input.avoidTitles ?? null,
          feedback: input.feedback ?? null,
          user_context: null,
          user_prompt: null,
        };
        const recommendations: SwapTrace["recommendations"] = [
          { id: match.recipe?.id ?? null, title: output.title, kind: "primary" as const },
          ...match.products.slice(0, 8).map((p, i) => ({
            id: p.id,
            title: `${p.brand_name}: ${p.name}`,
            kind: i === 0 && !match.recipe ? ("primary" as const) : ("alternate" as const),
          })),
        ].filter((r, i, arr) => arr.findIndex((x) => x.title === r.title) === i);
        const trace: SwapTrace = {
          request_id: requestId,
          classification_reasoning: "library_hit",
          classification_confidence: match.topSimilarity,
          source_chosen: "library",
          source_reasoning: match.judgeReason,
          db_match_found: true,
          library_recipe_id: match.recipe?.id ?? null,
          library_product_ids: match.products.map((p) => p.id),
          category_implicit:
            match.recipe?.meal_type ?? match.products[0]?.brand_name ?? null,
          recommendations,
          latency_cache_ms: match.timings.cache_ms,
          latency_embed_ms: match.timings.embed_ms,
          latency_pgvector_ms: match.timings.pgvector_ms,
          latency_judge_ms: match.timings.judge_ms,
          latency_llm_ms: null,
          latency_web_ms: null,
          latency_total_ms: Date.now() - overallStart,
          tokens_input: null,
          tokens_output: null,
          cost_usd: null,
          web_searches: [],
          web_urls_fetched: [],
          library_written: false,
          library_written_product_id: null,
        };
        return {
          cached: false,
          swap: saved,
          output,
          latencyMs: Date.now() - libraryStart,
          source: "library" as const,
          libraryHit: {
            recipeId: match.recipe?.id ?? null,
            productIds: match.products.map((p) => p.id),
            fromCache: match.cached,
          },
          debug,
          trace,
        };
      }
      // Only surface the explicit "no products found" message when the
      // matcher actually had candidates to consider and Haiku rejected them
      // all. If the library is empty (no embeddings yet, fresh deploy),
      // fall through to the existing Sonnet path so the app stays useful.
      if (productOnly && match.hadCandidates) {
        throw new NoLibraryProductsError(input.request);
      }
    } catch (err) {
      if (err instanceof NoLibraryProductsError) throw err;
      // Any other matcher failure (missing embeddings, Voyage down, etc.) is
      // a fallthrough — Sonnet still works.
      // eslint-disable-next-line no-console
      console.warn("[runSwapGenerator] library match failed, falling through:", err);
    }
  }

  const ctx = await loadUserContext(input.userId);
  const baseRequest = input.image
    ? input.request.trim()
      ? `${input.request} (the user also attached a photo of the food — identify it from the image and confirm in the swap_summary)`
      : "Identify the food shown in the attached photo and produce a real-food swap for it."
    : input.request;
  const avoidBlock =
    input.avoidTitles && input.avoidTitles.length > 0
      ? `\n\nThe user has already seen these swaps for the same request and wants something genuinely different — do NOT propose any of these or close variations: ${input.avoidTitles
          .map((t) => `"${t}"`)
          .join(", ")}.`
      : "";
  const feedbackBlock = input.feedback?.trim()
    ? `\n\nUser said about the previous swap: "${input.feedback.trim()}". Treat this as a hard constraint when picking BOTH the primary and the alternates.`
    : "";
  const requestText =
    baseRequest + formatPreferences(input.preferences) + avoidBlock + feedbackBlock;
  const userPrompt = composePromptBlocks(ctx, requestText);

  const start = Date.now();
  let status: "success" | "error" = "success";
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";

  // Image-route uses the plain tool call (vision identifies the food, no
  // search needed). Text-only fallback gets the web_search tool: the model
  // decides what to search for, reads result pages, and writes a swap that
  // can include a REAL brand product URL.
  const useWebSearch = !input.image;
  let webSearches: string[] = [];
  let webUrlsFetched: string[] = [];
  let toolInput: unknown = null;

  try {
    if (useWebSearch) {
      const authorizedHostnames = await getAuthorizedBrandHostnames();
      const result = await callWithToolAndWebSearch({
        tier: "sonnet",
        system:
          SwapGenerator.SYSTEM_PROMPT + buildWebSearchPromptSuffix(authorizedHostnames),
        user: userPrompt,
        tool: SwapGenerator.TOOL,
        heliconeUserId: input.userId ?? "anonymous",
        maxWebSearches: 5,
        allowedDomains: authorizedHostnames,
      });
      usage = result.usage;
      model = result.model;
      webSearches = result.webSearches;
      webUrlsFetched = result.webUrlsFetched;
      toolInput = result.toolInput;
    } else {
      const result = await callWithTool({
        tier: "sonnet",
        system: SwapGenerator.SYSTEM_PROMPT,
        user: userPrompt,
        tool: SwapGenerator.TOOL,
        image: input.image,
        heliconeUserId: input.userId ?? "anonymous",
      });
      usage = result.usage;
      model = result.model;
      toolInput = result.toolInput;
    }

    const parsed = SwapGenerator.OutputSchema.safeParse(toolInput);
    if (!parsed.success) {
      status = "error";
      throw new SchemaValidationError("Swap output failed schema", parsed.error.format());
    }

    // Persist a swap row for any logged-in user so Save / Iterate / Kitchen can
    // reference it. product_id may be null for text-search queries — that's fine.
    let saved = null;
    if (input.userId) {
      saved = await cacheSwap({
        user_id: input.userId,
        product_id: input.productId ?? null,
        recipe: parsed.data.recipe,
        nutrition: parsed.data.nutrition ?? {},
        narrative: parsed.data.narrative,
        output: parsed.data,
        swap_target: input.request,
      });
    }

    const debug: SwapDebug = {
      source: "llm",
      model: model || null,
      prompt_version: SwapGenerator.PROMPT_VERSION,
      request: input.request,
      merged_preferences: input.preferences ?? null,
      avoid_titles: input.avoidTitles ?? null,
      feedback: input.feedback ?? null,
      user_context: digestUserContext(ctx),
      user_prompt: userPrompt,
    };
    const llmMs = Date.now() - start;
    const altRecs: SwapTrace["recommendations"] = (parsed.data.alternates ?? [])
      .slice(0, 8)
      .map((a) => ({
        id: null,
        title: a.title,
        kind: "alternate" as const,
      }));

    // Library write-through: if Sonnet returned a product (URL + brand) AFTER
    // running the web_search tool, persist it back so future searches hit the
    // curated path. Skip writes if the product clearly came from training
    // knowledge (no web search ran) — that signal is less trustworthy.
    let libraryWritten = false;
    let libraryWrittenProductId: string | null = null;
    if (
      useWebSearch &&
      webSearches.length > 0 &&
      parsed.data.product_url &&
      parsed.data.brand_name
    ) {
      try {
        libraryWrittenProductId = await persistDiscoveredProduct({
          brandName: parsed.data.brand_name,
          productName: parsed.data.title,
          description: parsed.data.tagline ?? parsed.data.narrative ?? null,
          productUrl: parsed.data.product_url,
          imageUrl: parsed.data.product_image_url ?? null,
        });
        libraryWritten = libraryWrittenProductId !== null;
      } catch (err) {
        // Write-through is best-effort; the user already has their answer.
        // eslint-disable-next-line no-console
        console.warn("[runSwapGenerator] library write-through failed:", err);
      }
    }

    const sourceChosen: SwapTrace["source_chosen"] = useWebSearch && webSearches.length > 0 ? "web" : "llm";
    const classification: SwapTrace["classification_reasoning"] = input.image
      ? "image_route"
      : webSearches.length > 0
        ? "library_miss_web_fallback"
        : "library_miss_llm_fallback";

    const trace: SwapTrace = {
      request_id: requestId,
      classification_reasoning: classification,
      classification_confidence: null,
      source_chosen: sourceChosen,
      source_reasoning: null,
      db_match_found: false,
      library_recipe_id: null,
      library_product_ids: [],
      category_implicit: parsed.data.recipe?.meal_type ?? null,
      recommendations: [
        { id: saved?.id ?? null, title: parsed.data.title, kind: "primary" },
        ...altRecs,
      ],
      latency_cache_ms: null,
      latency_embed_ms: null,
      latency_pgvector_ms: null,
      latency_judge_ms: null,
      latency_llm_ms: llmMs,
      latency_web_ms: useWebSearch ? llmMs : null,
      latency_total_ms: Date.now() - overallStart,
      tokens_input: usage.input_tokens,
      tokens_output: usage.output_tokens,
      cost_usd: calculateCost("sonnet", usage),
      web_searches: webSearches,
      web_urls_fetched: webUrlsFetched,
      library_written: libraryWritten,
      library_written_product_id: libraryWrittenProductId,
    };
    return { cached: false, swap: saved, output: parsed.data, latencyMs: llmMs, debug, trace };
  } finally {
    await logAgentCall({
      user_id: input.userId,
      agent_name: "swap_generator",
      model,
      prompt_version: SwapGenerator.PROMPT_VERSION,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: calculateCost("sonnet", usage),
      latency_ms: Date.now() - start,
      status,
      client_platform: input.clientPlatform,
      request_id: requestId,
    });
  }
}

// ---------------- Recipe Iterator ----------------

export interface RecipeIteratorRunInput {
  userId: string | null;
  parentRecipe: unknown; // full parent recipe JSON
  modificationRequest: string;
  clientPlatform: ClientPlatform;
}

export async function runRecipeIterator(input: RecipeIteratorRunInput) {
  const ctx = await loadUserContext(input.userId);
  const requestBlock = `Parent recipe:\n${JSON.stringify(input.parentRecipe, null, 2)}\n\nModification request: ${input.modificationRequest}`;
  const userPrompt = composePromptBlocks(ctx, requestBlock);

  const start = Date.now();
  let status: "success" | "error" = "success";
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";

  try {
    const result = await callWithTool({
      tier: "sonnet",
      system: RecipeIterator.SYSTEM_PROMPT,
      user: userPrompt,
      tool: RecipeIterator.TOOL,
      heliconeUserId: input.userId ?? "anonymous",
    });
    usage = result.usage;
    model = result.model;

    const parsed = RecipeIterator.OutputSchema.safeParse(result.toolInput);
    if (!parsed.success) {
      status = "error";
      throw new SchemaValidationError(
        "Recipe iterator output failed schema",
        parsed.error.format(),
      );
    }
    return { output: parsed.data, latencyMs: Date.now() - start };
  } finally {
    await logAgentCall({
      user_id: input.userId,
      agent_name: "recipe_iterator",
      model,
      prompt_version: RecipeIterator.PROMPT_VERSION,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: calculateCost("sonnet", usage),
      latency_ms: Date.now() - start,
      status,
      client_platform: input.clientPlatform,
    });
  }
}

// ---------------- Quiz Summary (Haiku) ----------------

export interface QuizSummaryRunInput {
  userId: string;
  quizAnswers: Record<string, unknown>;
  clientPlatform: ClientPlatform;
}

export async function runQuizSummary(input: QuizSummaryRunInput) {
  const userPrompt = `${QuizSummary.USER_PROMPT_PREFIX}\n\n${JSON.stringify(input.quizAnswers, null, 2)}`;

  const start = Date.now();
  let status: "success" | "error" = "success";
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";

  try {
    const result = await callText({
      tier: "haiku",
      system: QuizSummary.SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 400,
      temperature: 0.5,
    });
    usage = result.usage;
    model = result.model;
    return { summary: result.text.trim(), latencyMs: Date.now() - start };
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    await logAgentCall({
      user_id: input.userId,
      agent_name: "quiz_summary",
      model,
      prompt_version: QuizSummary.PROMPT_VERSION,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: calculateCost("haiku", usage),
      latency_ms: Date.now() - start,
      status,
      client_platform: input.clientPlatform,
    });
  }
}

// ---------------- Recipe Builder (multi-photo) ----------------

export interface RecipeBuilderRunInput {
  userId: string | null;
  mode: RecipeBuilder.BuildMode;
  images: ImageInput[];
  notes?: string;
  clientPlatform: ClientPlatform;
}

const MODE_HINT: Record<RecipeBuilder.BuildMode, string> = {
  dish:
    "Mode: dish. The attached photos show a finished food or dish. Identify it and produce a real-food recipe that recreates it.",
  recipe:
    "Mode: recipe. The attached photos show a handwritten or printed recipe. Transcribe and clean it up into the standard recipe shape.",
  fridge:
    "Mode: fridge. The attached photos show a fridge / pantry / counter. Identify the visible ingredients and design a real-food recipe that uses what's available. Suggest common pantry seasonings (salt, pepper, oil, garlic, onion, common dried herbs) even if not visible, but flag them in assumed_pantry.",
};

export async function runRecipeBuilder(input: RecipeBuilderRunInput) {
  if (input.images.length === 0) {
    throw new SchemaValidationError("At least one image is required");
  }
  const ctx = await loadUserContext(input.userId);
  const userPrompt = composePromptBlocks(
    ctx,
    `${MODE_HINT[input.mode]}\n${input.notes ? `\nUser notes (hard constraints): ${input.notes}` : ""}`,
  );

  const start = Date.now();
  let status: "success" | "error" = "success";
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";

  try {
    const result = await callWithTool({
      tier: "sonnet",
      system: RecipeBuilder.SYSTEM_PROMPT,
      user: userPrompt,
      tool: RecipeBuilder.TOOL,
      images: input.images,
      heliconeUserId: input.userId ?? "anonymous",
    });
    usage = result.usage;
    model = result.model;

    const parsed = RecipeBuilder.OutputSchema.safeParse(result.toolInput);
    if (!parsed.success) {
      status = "error";
      throw new SchemaValidationError(
        "Recipe builder output failed schema",
        parsed.error.format(),
      );
    }
    return { output: parsed.data, latencyMs: Date.now() - start };
  } finally {
    await logAgentCall({
      user_id: input.userId,
      agent_name: "recipe_builder",
      model,
      prompt_version: RecipeBuilder.PROMPT_VERSION,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: calculateCost("sonnet", usage),
      latency_ms: Date.now() - start,
      status,
      client_platform: input.clientPlatform,
    });
  }
}

// ---------------- Embedder (Voyage) ----------------

export interface EmbedRunInput {
  text: string;
  inputType?: "document" | "query";
}

export async function runEmbedder(input: EmbedRunInput) {
  return await embed(input.text, input.inputType ?? "document");
}
