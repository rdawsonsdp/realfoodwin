import {
  SwapGenerator,
  RecipeIterator,
  QuizSummary,
} from "@realfoodwin/agents";
import { callWithTool, callText } from "./llm/anthropic.js";
import { embed } from "./llm/voyage.js";
import { loadUserContext, composePromptBlocks } from "./context.js";
import { logAgentCall, calculateCost } from "./logging.js";
import { cacheSwap, getCachedSwap } from "./cache.js";
import { SchemaValidationError } from "./errors.js";

export type ClientPlatform = "ios" | "android" | "web";

// ---------------- Swap Generator ----------------

export interface SwapGeneratorRunInput {
  userId: string | null;
  productId?: string | null;
  request: string; // typed query or product name
  clientPlatform: ClientPlatform;
  skipCache?: boolean;
}

export async function runSwapGenerator(input: SwapGeneratorRunInput) {
  // Cache hit?
  if (input.userId && input.productId && !input.skipCache) {
    const hit = await getCachedSwap(input.userId, input.productId);
    if (hit) return { cached: true, swap: hit };
  }

  const ctx = await loadUserContext(input.userId);
  const userPrompt = composePromptBlocks(ctx, input.request);

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
      heliconeUserId: input.userId ?? "anonymous",
    });
    usage = result.usage;
    model = result.model;

    const parsed = SwapGenerator.OutputSchema.safeParse(result.toolInput);
    if (!parsed.success) {
      status = "error";
      throw new SchemaValidationError("Swap output failed schema", parsed.error.format());
    }

    // Cache + log
    let saved = null;
    if (input.userId && input.productId) {
      saved = await cacheSwap({
        user_id: input.userId,
        product_id: input.productId,
        recipe: parsed.data.recipe,
        nutrition: parsed.data.nutrition ?? {},
        narrative: parsed.data.narrative,
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
