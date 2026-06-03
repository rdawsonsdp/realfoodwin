import {
  SwapGenerator,
  RecipeIterator,
  QuizSummary,
  RecipeBuilder,
  composeSystemPrompt,
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
    | "image_identified_library_hit"
    | "product_only_no_match"
    | "whole_food_passthrough";
  classification_confidence: number | null;
  source_chosen: "cache" | "library" | "llm" | "web" | "not_found" | "whole_food";
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
  // Haiku-vision identification leg of the two-stage image flow. Null when
  // the request didn't include a photo. Tracked separately so the trace can
  // show both the cheap ID hop and the (optional) library/LLM follow-up.
  latency_image_id_ms: number | null;
  latency_total_ms: number;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  web_searches: string[];
  web_urls_fetched: string[];
  library_written: boolean;
  library_written_product_id: string | null;
  // Fields persisted so the Observability admin tab can rebuild the same
  // panel the user-facing /home-v3 debug panel shows, from DB only.
  merged_preferences: SwapPreferencesInput | null;
  avoid_titles: string[] | null;
  feedback: string | null;
  user_context: SwapDebug["user_context"];
  user_prompt: string | null;
  model: string | null;
  prompt_version: string | null;
}

// Convert a curated library match into a SwapGenerator.OutputSchema-shaped
// result. We don't try to fake the LLM's analysis fields (nutrition,
// ingredient_analysis, tuned_for_you) — we stub them with a single honest
// "from the Real Food Win library" line so the response shape stays valid
// without inventing data. The UI can show extra detail when it exists; the
// library hit is the curated content, that's the value.
// Whole foods that don't need swapping. Singulars only (we strip a trailing
// 's' before matching so "apples" and "apple" both hit). Categories help the
// trace row tell at a glance which group was matched.
const WHOLE_FOOD_REGISTRY: Array<{
  category: string;
  canonical: string;
  aliases: string[];
}> = [
  { category: "fruit",  canonical: "Apples",      aliases: ["apple"] },
  { category: "fruit",  canonical: "Bananas",     aliases: ["banana"] },
  { category: "fruit",  canonical: "Oranges",     aliases: ["orange"] },
  { category: "fruit",  canonical: "Pears",       aliases: ["pear"] },
  { category: "fruit",  canonical: "Peaches",     aliases: ["peach"] },
  { category: "fruit",  canonical: "Plums",       aliases: ["plum"] },
  { category: "fruit",  canonical: "Cherries",    aliases: ["cherry"] },
  { category: "fruit",  canonical: "Grapes",      aliases: ["grape"] },
  { category: "fruit",  canonical: "Strawberries",aliases: ["strawberry"] },
  { category: "fruit",  canonical: "Blueberries", aliases: ["blueberry"] },
  { category: "fruit",  canonical: "Raspberries", aliases: ["raspberry"] },
  { category: "fruit",  canonical: "Blackberries",aliases: ["blackberry"] },
  { category: "fruit",  canonical: "Pineapple",   aliases: ["pineapple"] },
  { category: "fruit",  canonical: "Mangoes",     aliases: ["mango"] },
  { category: "fruit",  canonical: "Watermelon",  aliases: ["watermelon"] },
  { category: "fruit",  canonical: "Cantaloupe",  aliases: ["cantaloupe", "melon"] },
  { category: "fruit",  canonical: "Avocado",     aliases: ["avocado"] },
  { category: "fruit",  canonical: "Lemons",      aliases: ["lemon"] },
  { category: "fruit",  canonical: "Limes",       aliases: ["lime"] },
  { category: "fruit",  canonical: "Figs",        aliases: ["fig"] },
  { category: "fruit",  canonical: "Medjool dates", aliases: ["date", "dates", "medjool date"] },
  { category: "veg",    canonical: "Broccoli",    aliases: ["broccoli"] },
  { category: "veg",    canonical: "Cauliflower", aliases: ["cauliflower"] },
  { category: "veg",    canonical: "Carrots",     aliases: ["carrot"] },
  { category: "veg",    canonical: "Celery",      aliases: ["celery"] },
  { category: "veg",    canonical: "Spinach",     aliases: ["spinach"] },
  { category: "veg",    canonical: "Kale",        aliases: ["kale"] },
  { category: "veg",    canonical: "Arugula",     aliases: ["arugula"] },
  { category: "veg",    canonical: "Romaine lettuce", aliases: ["lettuce", "romaine"] },
  { category: "veg",    canonical: "Cucumbers",   aliases: ["cucumber"] },
  { category: "veg",    canonical: "Bell peppers", aliases: ["bell pepper", "pepper"] },
  { category: "veg",    canonical: "Tomatoes",    aliases: ["tomato"] },
  { category: "veg",    canonical: "Onions",      aliases: ["onion"] },
  { category: "veg",    canonical: "Garlic",      aliases: ["garlic"] },
  { category: "veg",    canonical: "Zucchini",    aliases: ["zucchini"] },
  { category: "veg",    canonical: "Eggplant",    aliases: ["eggplant"] },
  { category: "veg",    canonical: "Asparagus",   aliases: ["asparagus"] },
  { category: "veg",    canonical: "Brussels sprouts", aliases: ["brussels sprout", "brussel sprout"] },
  { category: "veg",    canonical: "Cabbage",     aliases: ["cabbage"] },
  { category: "veg",    canonical: "Sweet potatoes", aliases: ["sweet potato", "yam"] },
  { category: "veg",    canonical: "Potatoes",    aliases: ["potato"] },
  { category: "veg",    canonical: "Mushrooms",   aliases: ["mushroom"] },
  { category: "veg",    canonical: "Beets",       aliases: ["beet"] },
  { category: "veg",    canonical: "Radishes",    aliases: ["radish"] },
  { category: "veg",    canonical: "Squash",      aliases: ["squash", "butternut", "acorn squash"] },
  { category: "veg",    canonical: "Corn",        aliases: ["corn"] },
  { category: "veg",    canonical: "Peas",        aliases: ["pea"] },
  { category: "veg",    canonical: "Green beans", aliases: ["green bean", "string bean"] },
  { category: "protein",canonical: "Eggs",        aliases: ["egg"] },
  { category: "protein",canonical: "Chicken",     aliases: ["chicken"] },
  { category: "protein",canonical: "Turkey",      aliases: ["turkey"] },
  { category: "protein",canonical: "Beef",        aliases: ["beef", "steak", "ground beef"] },
  { category: "protein",canonical: "Pork",        aliases: ["pork"] },
  { category: "protein",canonical: "Lamb",        aliases: ["lamb"] },
  { category: "protein",canonical: "Bison",       aliases: ["bison"] },
  { category: "protein",canonical: "Salmon",      aliases: ["salmon"] },
  { category: "protein",canonical: "Tuna",        aliases: ["tuna"] },
  { category: "protein",canonical: "Cod",         aliases: ["cod"] },
  { category: "protein",canonical: "Halibut",     aliases: ["halibut"] },
  { category: "protein",canonical: "Sardines",    aliases: ["sardine"] },
  { category: "protein",canonical: "Shrimp",      aliases: ["shrimp"] },
  { category: "nuts",   canonical: "Almonds",     aliases: ["almond"] },
  { category: "nuts",   canonical: "Walnuts",     aliases: ["walnut"] },
  { category: "nuts",   canonical: "Pecans",      aliases: ["pecan"] },
  { category: "nuts",   canonical: "Cashews",     aliases: ["cashew"] },
  { category: "nuts",   canonical: "Pistachios",  aliases: ["pistachio"] },
  { category: "nuts",   canonical: "Hazelnuts",   aliases: ["hazelnut"] },
  { category: "nuts",   canonical: "Macadamia nuts", aliases: ["macadamia"] },
  { category: "nuts",   canonical: "Brazil nuts", aliases: ["brazil nut"] },
  { category: "nuts",   canonical: "Pine nuts",   aliases: ["pine nut"] },
  { category: "nuts",   canonical: "Pumpkin seeds", aliases: ["pumpkin seed", "pepita"] },
  { category: "nuts",   canonical: "Sunflower seeds", aliases: ["sunflower seed"] },
  { category: "nuts",   canonical: "Chia seeds",  aliases: ["chia"] },
  { category: "nuts",   canonical: "Flax seeds",  aliases: ["flax", "flax seed", "flaxseed"] },
  { category: "nuts",   canonical: "Hemp seeds",  aliases: ["hemp seed", "hemp"] },
  { category: "grain",  canonical: "Quinoa",      aliases: ["quinoa"] },
  { category: "grain",  canonical: "Brown rice",  aliases: ["brown rice", "rice"] },
  { category: "grain",  canonical: "Oats",        aliases: ["oat", "oatmeal", "rolled oats"] },
  { category: "grain",  canonical: "Buckwheat",   aliases: ["buckwheat"] },
  { category: "grain",  canonical: "Millet",      aliases: ["millet"] },
  { category: "legume", canonical: "Lentils",     aliases: ["lentil"] },
  { category: "legume", canonical: "Chickpeas",   aliases: ["chickpea", "garbanzo"] },
  { category: "legume", canonical: "Black beans", aliases: ["black bean"] },
  { category: "legume", canonical: "Kidney beans",aliases: ["kidney bean"] },
  { category: "legume", canonical: "Pinto beans", aliases: ["pinto bean"] },
  { category: "legume", canonical: "Navy beans",  aliases: ["navy bean"] },
  { category: "fat",    canonical: "Olive oil",   aliases: ["olive oil", "extra virgin olive oil"] },
  { category: "fat",    canonical: "Avocado oil", aliases: ["avocado oil"] },
  { category: "fat",    canonical: "Coconut oil", aliases: ["coconut oil"] },
  { category: "fat",    canonical: "Grass-fed butter", aliases: ["butter", "grass fed butter", "ghee"] },
  { category: "sweet",  canonical: "Raw honey",   aliases: ["honey", "raw honey"] },
  { category: "herb",   canonical: "Fresh basil", aliases: ["basil"] },
  { category: "herb",   canonical: "Fresh parsley", aliases: ["parsley"] },
  { category: "herb",   canonical: "Fresh cilantro", aliases: ["cilantro"] },
  { category: "herb",   canonical: "Fresh mint",  aliases: ["mint"] },
  { category: "herb",   canonical: "Fresh rosemary", aliases: ["rosemary"] },
  { category: "herb",   canonical: "Fresh thyme", aliases: ["thyme"] },
  { category: "herb",   canonical: "Fresh dill",  aliases: ["dill"] },
];

// Compact Levenshtein. Two-row DP, early exit when min row > maxAllowed so
// we don't pay full O(n*m) when the strings are obviously different. Used by
// matchWholeFood() for typo correction.
function editDistance(a: string, b: string, maxAllowed: number): number {
  if (Math.abs(a.length - b.length) > maxAllowed) return maxAllowed + 1;
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > maxAllowed) return maxAllowed + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

function matchWholeFood(rawQuery: string): { canonical: string; category: string } | null {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2 || q.length > 32) return null;
  // Strip a trailing 's' for naive plural → singular.
  const stripped = q.endsWith("s") ? q.slice(0, -1) : q;
  // 1. Exact match first — cheap.
  for (const entry of WHOLE_FOOD_REGISTRY) {
    for (const alias of entry.aliases) {
      if (alias === q || alias === stripped) {
        return { canonical: entry.canonical, category: entry.category };
      }
    }
  }
  // 2. Fuzzy fall-back: edit distance ≤1 for short queries (≤5 chars), ≤2
  // for longer. "aple" → "apple", "brocoli" → "broccoli". Cap at distance 1
  // for very short queries so "an" doesn't match "egg". Pick the smallest
  // distance across all aliases.
  const maxDist = q.length <= 5 ? 1 : 2;
  let best: { entry: (typeof WHOLE_FOOD_REGISTRY)[number]; dist: number } | null = null;
  for (const entry of WHOLE_FOOD_REGISTRY) {
    for (const alias of entry.aliases) {
      const d = Math.min(editDistance(q, alias, maxDist), editDistance(stripped, alias, maxDist));
      if (d <= maxDist && (!best || d < best.dist)) {
        best = { entry, dist: d };
      }
    }
  }
  if (best) return { canonical: best.entry.canonical, category: best.entry.category };
  return null;
}

function buildSwapOutputFromLibrary(
  recipe: MatchedRecipe | null,
  products: MatchedProduct[],
): SwapGenerator.SwapGeneratorOutput {
  // Library content is hand-curated by the Real Food Win team, so these
  // markers hold across the catalog. They're the floor — the LLM path emits a
  // richer, item-specific set; library swaps get this trustworthy baseline.
  const LIBRARY_DEFAULT_GOOD_MARKERS: SwapGenerator.GoodMarker[] = [
    "whole_food",
    "no_seed_oils",
    "no_artificial_anything",
  ];
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
      bad_markers: [],
      good_markers: [...LIBRARY_DEFAULT_GOOD_MARKERS, "made_fresh" as const],
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
    bad_markers: [],
    good_markers: LIBRARY_DEFAULT_GOOD_MARKERS,
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
  source: "library" | "llm" | "cache" | "whole_food";
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
        latency_image_id_ms: null,
        latency_total_ms: Date.now() - overallStart,
        tokens_input: null,
        tokens_output: null,
        cost_usd: null,
        web_searches: [],
        web_urls_fetched: [],
        library_written: false,
        library_written_product_id: null,
        merged_preferences: input.preferences ?? null,
        avoid_titles: input.avoidTitles ?? null,
        feedback: input.feedback ?? null,
        user_context: null,
        user_prompt: null,
        model: null,
        prompt_version: null,
      };
      return { cached: true, swap: hit, debug, trace };
    }
  }

  // Helper: run the curated library matcher against a query, and on a hit
  // build/persist a SwapGenerator-shaped output + SwapTrace. Returns null on
  // miss so the caller can fall through to Sonnet. Used by BOTH the text
  // path and the new image-identified path (Stage B of the two-stage flow).
  async function tryLibraryHit(opts: {
    query: string;
    classification: SwapTrace["classification_reasoning"];
    latencyImageIdMs: number | null;
  }) {
    const goals: SwapGoal[] = (input.preferences?.goals as SwapGoal[] | undefined) ?? [];
    const productOnly = goals.length === 1 && goals[0] === "product";
    const libraryStart = Date.now();
    const match = await matchLibrary({ query: opts.query, goals });
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
        classification_reasoning: opts.classification,
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
        latency_image_id_ms: opts.latencyImageIdMs,
        latency_total_ms: Date.now() - overallStart,
        tokens_input: null,
        tokens_output: null,
        cost_usd: null,
        web_searches: [],
        web_urls_fetched: [],
        library_written: false,
        library_written_product_id: null,
        merged_preferences: input.preferences ?? null,
        avoid_titles: input.avoidTitles ?? null,
        feedback: input.feedback ?? null,
        user_context: null,
        user_prompt: null,
        model: null,
        prompt_version: null,
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
    // Only surface the explicit "no products found" message when the matcher
    // actually had candidates to consider and Haiku rejected them all. If the
    // library is empty (no embeddings yet, fresh deploy), let the caller fall
    // through to the existing Sonnet path so the app stays useful.
    if (productOnly && match.hadCandidates) {
      throw new NoLibraryProductsError(input.request);
    }
    return null;
  }

  // Stage A of the photo flow: tiny Haiku-vision call to identify the product
  // in the photo. We stash the result so Stage B can run the regular library
  // matcher on the identified name. On library hit we return ~2-4s instead of
  // the ~32s/$0.045 Sonnet-with-vision path.
  let photoIdentifiedQuery: string | null = null;
  let photoIdLatencyMs: number | null = null;
  if (input.image) {
    const idStart = Date.now();
    try {
      const idResult = await callWithTool({
        tier: "haiku",
        system:
          "You identify food products from photos. Respond ONLY via the identify_product tool.",
        user:
          "Identify the food/product in this photo. If the photo shows packaging, prefer the brand + exact product name from the label.",
        tool: SwapGenerator.PHOTO_ID_TOOL,
        image: input.image,
        maxTokens: 200,
        heliconeUserId: input.userId ?? "anonymous",
      });
      photoIdLatencyMs = Date.now() - idStart;
      const id = idResult.toolInput as {
        product_name?: string;
        brand?: string | null;
        confidence?: string;
      };
      if (id.product_name && id.product_name.trim().length >= 2) {
        const name = id.product_name.trim();
        photoIdentifiedQuery =
          id.brand && !name.toLowerCase().includes(id.brand.toLowerCase())
            ? `${id.brand} ${name}`.trim()
            : name;
      }
    } catch (err) {
      photoIdLatencyMs = Date.now() - idStart;
      // Identification failure is non-fatal: fall through to the existing
      // Sonnet-with-image path so the user still gets a swap.
      // eslint-disable-next-line no-console
      console.warn("[runSwapGenerator] Haiku photo-id failed, falling through:", err);
    }

    if (photoIdentifiedQuery) {
      try {
        const hit = await tryLibraryHit({
          query: photoIdentifiedQuery,
          classification: "image_identified_library_hit",
          latencyImageIdMs: photoIdLatencyMs,
        });
        if (hit) return hit;
      } catch (err) {
        if (err instanceof NoLibraryProductsError) throw err;
        // eslint-disable-next-line no-console
        console.warn(
          "[runSwapGenerator] image-identified library match failed, falling through:",
          err,
        );
      }
    }
  }

  // Whole-food shortcut: if the query is a single recognizable whole food
  // ("apples", "broccoli", "salmon", "eggs"), there's nothing to swap — it
  // already IS real food. Return an instant "already real food" response so
  // we don't burn 20+ seconds and a Sonnet call telling the user that apples
  // are good.
  if (!input.image && input.request.trim().length >= 2) {
    const wholeFoodHit = matchWholeFood(input.request);
    if (wholeFoodHit) {
      const output: SwapGenerator.SwapGeneratorOutput = {
        title: wholeFoodHit.canonical,
        tagline: "Already a real food — no swap needed.",
        recipe: { ingredients: [], steps: [], time_min: 0 },
        narrative:
          `${wholeFoodHit.canonical} is a whole food on its own — there's nothing ultra-processed to swap. Eat it as-is, or use it in a recipe. If you want recipe ideas that use ${wholeFoodHit.canonical.toLowerCase()}, try a more specific search like "${wholeFoodHit.canonical.toLowerCase()} dessert" or "${wholeFoodHit.canonical.toLowerCase()} snack".`,
        tuned_for_you_reasons: [
          "This is a whole, unprocessed food — Real Food Win has nothing to improve here.",
          "No additives, no ultra-processing, nothing to swap.",
        ],
        bad_markers: [],
        good_markers: ["whole_food"],
        alternates: [],
      };
      let saved = null;
      if (input.userId) {
        saved = await cacheSwap({
          user_id: input.userId,
          product_id: input.productId ?? null,
          recipe: output.recipe,
          nutrition: {},
          narrative: output.narrative,
          output,
          swap_target: input.request,
        });
      }
      const debug: SwapDebug = {
        source: "whole_food",
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
        classification_reasoning: "whole_food_passthrough",
        classification_confidence: 1.0,
        source_chosen: "whole_food",
        source_reasoning: `Recognized "${input.request.trim()}" as a single whole food.`,
        db_match_found: false,
        library_recipe_id: null,
        library_product_ids: [],
        category_implicit: wholeFoodHit.category,
        recommendations: [],
        latency_cache_ms: null,
        latency_embed_ms: null,
        latency_pgvector_ms: null,
        latency_judge_ms: null,
        latency_llm_ms: null,
        latency_web_ms: null,
        latency_image_id_ms: null,
        latency_total_ms: Date.now() - overallStart,
        tokens_input: null,
        tokens_output: null,
        cost_usd: null,
        web_searches: [],
        web_urls_fetched: [],
        library_written: false,
        library_written_product_id: null,
        merged_preferences: input.preferences ?? null,
        avoid_titles: input.avoidTitles ?? null,
        feedback: input.feedback ?? null,
        user_context: null,
        user_prompt: null,
        model: null,
        prompt_version: null,
      };
      return {
        cached: false,
        swap: saved,
        output,
        latencyMs: Date.now() - overallStart,
        source: "whole_food" as const,
        debug,
        trace,
      };
    }
  }

  // Library-first matcher (text path). Photo swaps that reach here have
  // already failed Stage A/B above. Every text query gets a sub-2s curated
  // lookup before falling through to a fresh LLM generation. When the user
  // explicitly asked for a PRODUCT and the brand catalog has no match, we
  // surface "no products found" rather than letting Claude invent SKUs that
  // aren't in our directory.
  if (!input.image && input.request.trim().length >= 2) {
    try {
      const hit = await tryLibraryHit({
        query: input.request,
        classification: "library_hit",
        latencyImageIdMs: null,
      });
      if (hit) return hit;
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
  // search needed). Text-only fallback gets the web_search tool — BUT ONLY
  // when the user explicitly asked for a product to buy. The
  // buildWebSearchPromptSuffix system prompt forbids web_search for recipe
  // queries; sending the tool anyway just registered Sonnet for a 47s no-op
  // (real trace: "Grilled cheese" library miss burned 6k input + 2.8k output
  // tokens and never called web_search once). Gate it here so we don't pay
  // for a tool the prompt won't let the model use.
  const goals = (input.preferences?.goals ?? []) as string[];
  const userAskedForProduct = goals.includes("product");
  const useWebSearch = !input.image && userAskedForProduct;
  let webSearches: string[] = [];
  let webUrlsFetched: string[] = [];
  let toolInput: unknown = null;

  try {
    if (useWebSearch) {
      const authorizedHostnames = await getAuthorizedBrandHostnames();
      try {
        const result = await callWithToolAndWebSearch({
          tier: "sonnet",
          system:
            composeSystemPrompt(SwapGenerator.SYSTEM_PROMPT) +
            buildWebSearchPromptSuffix(authorizedHostnames),
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
      } catch (webErr) {
        // Sonnet sometimes ends the turn after web_search without emitting our
        // function tool (stop_reason pause_turn / end_turn with text only).
        // Rather than 500-ing the user, retry without the web_search tool so
        // the model is forced to call generate_swap.
        // eslint-disable-next-line no-console
        console.warn(
          "[runSwapGenerator] web_search path failed, retrying without web_search:",
          webErr instanceof Error ? webErr.message : String(webErr),
        );
        const result = await callWithTool({
          tier: "sonnet",
          system: composeSystemPrompt(SwapGenerator.SYSTEM_PROMPT),
          user: userPrompt,
          tool: SwapGenerator.TOOL,
          heliconeUserId: input.userId ?? "anonymous",
        });
        usage = result.usage;
        model = result.model;
        toolInput = result.toolInput;
      }
    } else {
      const result = await callWithTool({
        tier: "sonnet",
        system: composeSystemPrompt(SwapGenerator.SYSTEM_PROMPT),
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
      // Carries the Haiku-ID hop's latency through when this Sonnet call is
      // the fallback leg of the two-stage image flow (library missed on the
      // identified name). Null on the pure text path.
      latency_image_id_ms: photoIdLatencyMs,
      latency_total_ms: Date.now() - overallStart,
      tokens_input: usage.input_tokens,
      tokens_output: usage.output_tokens,
      cost_usd: calculateCost("sonnet", usage),
      web_searches: webSearches,
      web_urls_fetched: webUrlsFetched,
      library_written: libraryWritten,
      library_written_product_id: libraryWrittenProductId,
      merged_preferences: input.preferences ?? null,
      avoid_titles: input.avoidTitles ?? null,
      feedback: input.feedback ?? null,
      user_context: digestUserContext(ctx),
      user_prompt: userPrompt,
      model: model || null,
      prompt_version: SwapGenerator.PROMPT_VERSION,
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
      system: composeSystemPrompt(RecipeIterator.SYSTEM_PROMPT),
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
      system: composeSystemPrompt(RecipeBuilder.SYSTEM_PROMPT),
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
