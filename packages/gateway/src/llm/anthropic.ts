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

// HARD-CODED model IDs — bypassing the app_settings lookup until the picker
// flow is verified end-to-end. To re-enable runtime override, swap
// resolveModel() back to the DB-backed implementation in git history.
export const MODELS: Record<ModelTier, string> = {
  sonnet: "claude-sonnet-4-5-20250929",
  haiku: "claude-haiku-4-5-20251001",
};

async function resolveModel(tier: ModelTier): Promise<string> {
  return MODELS[tier];
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
    // The SDK defaults to a 10-minute timeout and 2 retries. A swap request
    // must never be able to sit on a stalled generation for minutes — that's
    // the "app hung" symptom. Cap the wall-clock per call and retry once.
    // Per-call overrides (opts.timeoutMs) tighten this further for the fast
    // classify hop.
    timeout: 60_000,
    maxRetries: 1,
  });
  return cached;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string; // base64-encoded, no data: URL prefix
}

export interface ToolCallOptions {
  tier: ModelTier;
  system: string;
  user: string;
  tool: ToolDefinition;
  image?: ImageInput;
  images?: ImageInput[]; // multi-photo input; merged with `image` if both set
  maxTokens?: number;
  temperature?: number;
  heliconeUserId?: string;
  // Per-call wall-clock cap (ms). Overrides the client default (60s). The fast
  // classify→swap hop sets this tight (~12s) so a slow Haiku call falls
  // through to Sonnet quickly instead of compounding latency.
  timeoutMs?: number;
  // Per-call retry override. The fast path sets 0 so a timeout fails straight
  // through to Sonnet instead of retrying (a retry would double the latency
  // the timeout was meant to bound).
  maxRetries?: number;
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

  const allImages: ImageInput[] = [
    ...(opts.image ? [opts.image] : []),
    ...(opts.images ?? []),
  ];
  const userContent: Anthropic.MessageParam["content"] =
    allImages.length > 0
      ? [
          ...allImages.map(
            (img): Anthropic.ImageBlockParam => ({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.data },
            }),
          ),
          { type: "text", text: opts.user },
        ]
      : opts.user;

  try {
    const resp = await c.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: userContent }],
      // Anthropic SDK types are slightly mismatched against our generic schema record; cast is intentional.
      tools: [opts.tool as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: opts.tool.name },
    }, opts.timeoutMs != null || opts.maxRetries != null
      ? {
          ...(opts.timeoutMs != null ? { timeout: opts.timeoutMs } : {}),
          ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
        }
      : undefined);

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

// Web-search-enabled tool call. Sonnet receives BOTH the swap_generator
// function tool AND the Anthropic-hosted web_search server tool, with
// tool_choice 'auto' so the model decides how many times to search before
// emitting the final swap. We extract the search queries it ran and the URLs
// it fetched from the returned content blocks so the agent_traces row can
// show "what Sonnet looked at to write this swap."
export interface WebSearchToolCallOptions extends ToolCallOptions {
  // Cap on web_search calls per request — protects cost. 5 is generous.
  maxWebSearches?: number;
  // Domains the web_search tool may fetch from. We restrict to the authorized
  // brands in our `brands` table — Sonnet cannot roam the wider internet.
  // Each entry is a bare hostname like "honeymamas.com" (no scheme, no path).
  allowedDomains?: string[];
}

export interface WebSearchToolCallResult extends ToolCallResult {
  webSearches: string[];
  webUrlsFetched: string[];
}

export async function callWithToolAndWebSearch(
  opts: WebSearchToolCallOptions,
): Promise<WebSearchToolCallResult> {
  const c = client();
  const start = Date.now();
  const model = await resolveModel(opts.tier);

  const allImages: ImageInput[] = [
    ...(opts.image ? [opts.image] : []),
    ...(opts.images ?? []),
  ];
  const userContent: Anthropic.MessageParam["content"] =
    allImages.length > 0
      ? [
          ...allImages.map(
            (img): Anthropic.ImageBlockParam => ({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.data },
            }),
          ),
          { type: "text", text: opts.user },
        ]
      : opts.user;

  // Web search tool is a SERVER tool — Anthropic runs it on our behalf and
  // returns the results inline. Our function tool stays in the same array;
  // tool_choice 'auto' lets the model pick. allowed_domains restricts the
  // tool to authorized brand sites only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSearchTool: any = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: opts.maxWebSearches ?? 5,
    ...(opts.allowedDomains && opts.allowedDomains.length > 0
      ? { allowed_domains: opts.allowedDomains }
      : {}),
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp: any = await c.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: userContent }],
      // Anthropic SDK types don't yet include the web_search server tool; cast through.
      tools: [
        webSearchTool,
        opts.tool as unknown as Anthropic.Tool,
      ] as unknown as Anthropic.Tool[],
      tool_choice: { type: "auto" },
    });

    // Find the function-tool emission for our swap_generator.
    const block = (resp.content as Array<{ type: string; [k: string]: unknown }>).find(
      (c) => c.type === "tool_use" && (c as { name?: string }).name === opts.tool.name,
    );
    if (!block) {
      throw new AnthropicCallError("Model did not return the expected tool_use block", {
        content: resp.content,
      });
    }
    const toolInput = (block as { input?: unknown }).input;

    // Walk the content blocks for server_tool_use (queries) and
    // web_search_tool_result (URLs Sonnet fetched). Block names are defensive
    // — exact shape varies by SDK minor version.
    const webSearches: string[] = [];
    const webUrlsFetched: string[] = [];
    for (const c of resp.content as Array<{
      type: string;
      name?: string;
      input?: { query?: string };
      content?: Array<{ type?: string; url?: string }>;
    }>) {
      if (c.type === "server_tool_use" && c.name === "web_search" && c.input?.query) {
        webSearches.push(c.input.query);
      }
      if (c.type === "web_search_tool_result" && Array.isArray(c.content)) {
        for (const r of c.content) {
          if (r?.url) webUrlsFetched.push(r.url);
        }
      }
    }

    return {
      toolInput,
      usage: {
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
      model,
      webSearches,
      webUrlsFetched,
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
