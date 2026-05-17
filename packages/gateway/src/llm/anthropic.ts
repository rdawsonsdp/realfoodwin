import Anthropic from "@anthropic-ai/sdk";
import { AnthropicCallError, ModelNotFoundError } from "../errors";

function rethrowAsCallError(err: unknown, model: string): never {
  if (err instanceof Anthropic.APIError && err.status === 404) {
    throw new ModelNotFoundError(model, { status: 404, message: err.message });
  }
  if (err instanceof AnthropicCallError || err instanceof ModelNotFoundError) throw err;
  throw new AnthropicCallError(err instanceof Error ? err.message : String(err), err);
}

export type ModelTier = "sonnet" | "haiku";

// Defaults. The actual runtime model can be overridden at /admin/models without
// a redeploy — see resolveModel() below which reads app_settings.
export const MODELS: Record<ModelTier, string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

import { getServiceSupabase } from "../supabase";

// Cached for 60s so we don't hit the DB on every LLM call but also pick up
// admin changes within a minute.
const cache = { sonnet: MODELS.sonnet, haiku: MODELS.haiku, expires: 0 };

async function resolveModel(tier: ModelTier): Promise<string> {
  const now = Date.now();
  if (now > cache.expires) {
    try {
      const sb = getServiceSupabase();
      const { data } = await sb
        .from("app_settings")
        .select("key, value")
        .in("key", ["model.sonnet", "model.haiku"]);
      const map = new Map<string, string>(
        (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
      );
      cache.sonnet = map.get("model.sonnet") ?? MODELS.sonnet;
      cache.haiku = map.get("model.haiku") ?? MODELS.haiku;
    } catch {
      // Fall back to defaults if the lookup fails (e.g., during local dev
      // before app_settings exists).
    }
    cache.expires = now + 60_000;
  }
  return cache[tier];
}

// USD per 1M tokens — directional, revise when prices change.
export const PRICING: Record<ModelTier, { input: number; output: number }> = {
  sonnet: { input: 3.0, output: 15.0 },
  haiku: { input: 1.0, output: 5.0 },
};

let cached: Anthropic | null = null;

function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicCallError("ANTHROPIC_API_KEY not set");

  const useHelicone = !!process.env.HELICONE_API_KEY;
  cached = new Anthropic({
    apiKey,
    baseURL: useHelicone ? "https://anthropic.helicone.ai/v1" : undefined,
    defaultHeaders: useHelicone
      ? { "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}` }
      : undefined,
  });
  return cached;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCallOptions {
  tier: ModelTier;
  system: string;
  user: string;
  tool: ToolDefinition;
  maxTokens?: number;
  temperature?: number;
  heliconeUserId?: string;
}

export interface ToolCallResult {
  toolInput: unknown;
  usage: { input_tokens: number; output_tokens: number };
  latencyMs: number;
  model: string;
}

export async function callWithTool(opts: ToolCallOptions): Promise<ToolCallResult> {
  const c = client();
  const start = Date.now();
  const model = await resolveModel(opts.tier);

  try {
    const resp = await c.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      // Anthropic SDK types are slightly mismatched against our generic schema record; cast is intentional.
      tools: [opts.tool as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: opts.tool.name },
    });

    const block = resp.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new AnthropicCallError("Model did not return a tool_use block", {
        content: resp.content,
      });
    }

    return {
      toolInput: block.input,
      usage: {
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
      model,
    };
  } catch (err) {
    rethrowAsCallError(err, model);
  }
}

export interface TextCallOptions {
  tier: ModelTier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TextCallResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  latencyMs: number;
  model: string;
}

export async function callText(opts: TextCallOptions): Promise<TextCallResult> {
  const c = client();
  const start = Date.now();
  const model = await resolveModel(opts.tier);
  try {
    const resp = await c.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1000,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    return {
      text,
      usage: {
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
      model,
    };
  } catch (err) {
    rethrowAsCallError(err, model);
  }
}
