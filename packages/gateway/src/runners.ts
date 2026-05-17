import {
  SwapGenerator,
  RecipeIterator,
  QuizSummary,
} from "@realfoodwin/agents";
import { callWithTool, callText, type ImageInput } from "./llm/anthropic";
import { embed } from "./llm/voyage";
import { loadUserContext, composePromptBlocks } from "./context";
import { logAgentCall, calculateCost } from "./logging";
import { cacheSwap, getCachedSwap } from "./cache";
import { SchemaValidationError } from "./errors";

export type ClientPlatform = "ios" | "android" | "web";

// ---------------- Swap Generator ----------------

export interface SwapPreferencesInput {
  goals?: ("recipe" | "product")[];
  dietary_styles?: string[];
  allergens?: string[];
  max_prep_minutes?: number | null;
  prioritize?: string[];
  must_include?: string[];
}

export interface SwapGeneratorRunInput {
  userId: string | null;
  productId?: string | null;
  request: string; // typed query or product name (may be blank if image-only)
  image?: ImageInput;
  preferences?: SwapPreferencesInput | null;
  clientPlatform: ClientPlatform;
  skipCache?: boolean;
}

function formatPreferences(p: SwapPreferencesInput | null | undefined): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.goals && p.goals.length && p.goals.length < 2) {
    lines.push(`Goal: ${p.goals[0] === "recipe" ? "a real-food recipe" : "a real-food product they can buy"}`);
  }
  if (p.dietary_styles?.length) lines.push(`Dietary style: ${p.dietary_styles.join(", ")}`);
  if (p.allergens?.length) lines.push(`Must AVOID (allergens): ${p.allergens.join(", ")}`);
  if (p.max_prep_minutes != null) lines.push(`Max prep time: ${p.max_prep_minutes} minutes`);
  if (p.prioritize?.length) lines.push(`Prioritize: ${p.prioritize.join(", ")}`);
  if (p.must_include?.length) lines.push(`Must include: ${p.must_include.join(", ")}`);
  if (!lines.length) return "";
  return `\n\nUser preferences for this swap (treat as hard constraints):\n- ${lines.join("\n- ")}`;
}

export async function runSwapGenerator(input: SwapGeneratorRunInput) {
  // Cache hit?
  if (input.userId && input.productId && !input.skipCache) {
    const hit = await getCachedSwap(input.userId, input.productId);
    if (hit) return { cached: true, swap: hit };
  }

  const ctx = await loadUserContext(input.userId);
  const baseRequest = input.image
    ? input.request.trim()
      ? `${input.request} (the user also attached a photo of the food — identify it from the image and confirm in the swap_summary)`
      : "Identify the food shown in the attached photo and produce a real-food swap for it."
    : input.request;
  const requestText = baseRequest + formatPreferences(input.preferences);
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

    return { cached: false, swap: saved, output: parsed.data, latencyMs: Date.now() - start };
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

// ---------------- Embedder (Voyage) ----------------

export interface EmbedRunInput {
  text: string;
  inputType?: "document" | "query";
}

export async function runEmbedder(input: EmbedRunInput) {
  return await embed(input.text, input.inputType ?? "document");
}
