import {
  SwapGenerator,
  RecipeIterator,
  QuizSummary,
  RecipeBuilder,
} from "@realfoodwin/agents";
import { callWithTool, callText, type ImageInput } from "./llm/anthropic";
import { embed } from "./llm/voyage";
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
      return { cached: true, swap: hit, debug };
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

  try {
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

    const parsed = SwapGenerator.OutputSchema.safeParse(result.toolInput);
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
    return { cached: false, swap: saved, output: parsed.data, latencyMs: Date.now() - start, debug };
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
