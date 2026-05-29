import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  runSwapGenerator,
  ModelNotFoundError,
  NoLibraryProductsError,
  type SwapPreferencesInput,
  type SwapTrace,
} from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getMemorySummary } from "@/lib/coach-memory";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs"; // Anthropic SDK needs Node, not Edge
export const dynamic = "force-dynamic";

function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = it.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it.trim());
  }
  return out;
}

function admin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function inputTypeOf(query: string, hasImage: boolean): "text" | "image" | "barcode" | "voice" {
  if (hasImage) return "image";
  // Pure-digit queries from BarcodeButton come through the barcode resolver
  // (which renames them with the resolved brand+name), but on resolver
  // failures we send the raw digits along — treat those as 'barcode'.
  if (/^\d{6,18}$/.test(query.trim())) return "barcode";
  return "text";
}

async function writeTrace(
  trace: SwapTrace,
  ctx: {
    userId: string | null;
    inputType: "text" | "image" | "barcode" | "voice";
    inputQuery: string | null;
    inputImagePresent: boolean;
    inputMeta: Record<string, unknown>;
    swapId: string | null;
    clientPlatform: "ios" | "android" | "web";
  },
): Promise<void> {
  try {
    await admin().from("agent_traces").insert({
      request_id: trace.request_id,
      user_id: ctx.userId,
      input_type: ctx.inputType,
      input_query: ctx.inputQuery,
      input_image_present: ctx.inputImagePresent,
      input_meta: ctx.inputMeta,
      category_implicit: trace.category_implicit,
      classification_reasoning: trace.classification_reasoning,
      classification_confidence: trace.classification_confidence,
      source_chosen: trace.source_chosen,
      source_reasoning: trace.source_reasoning,
      db_match_found: trace.db_match_found,
      library_recipe_id: trace.library_recipe_id,
      library_product_ids: trace.library_product_ids,
      swap_id: ctx.swapId,
      recommendations: trace.recommendations,
      latency_cache_ms: trace.latency_cache_ms,
      latency_embed_ms: trace.latency_embed_ms,
      latency_pgvector_ms: trace.latency_pgvector_ms,
      latency_judge_ms: trace.latency_judge_ms,
      latency_llm_ms: trace.latency_llm_ms,
      latency_total_ms: trace.latency_total_ms,
      tokens_input: trace.tokens_input,
      tokens_output: trace.tokens_output,
      cost_usd: trace.cost_usd,
      client_platform: ctx.clientPlatform,
    });
  } catch (err) {
    // Trace logging must never break the user-facing call.
    // eslint-disable-next-line no-console
    console.error("[/api/swap] failed to write agent_traces:", err);
  }
}

const ImageSchema = z.object({
  media_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  data: z.string().min(100).max(8_000_000), // base64; ~6MB raw cap
});

const PreferencesSchema = z
  .object({
    goals: z.array(z.enum(["recipe", "product"])).optional(),
    dietary_styles: z.array(z.string().max(40)).max(20).optional(),
    allergens: z.array(z.string().max(40)).max(30).optional(),
    max_prep_minutes: z.number().int().positive().nullable().optional(),
    prioritize: z.array(z.string().max(40)).max(10).optional(),
    must_include: z.array(z.string().max(80)).max(20).optional(),
  })
  .optional();

const RequestSchema = z
  .object({
    query: z.string().max(200).optional().default(""),
    product_id: z.string().uuid().optional(),
    skip_cache: z.boolean().optional(),
    image: ImageSchema.optional(),
    preferences: PreferencesSchema,
    avoid_titles: z.array(z.string().max(160)).max(8).optional(),
    feedback: z.string().max(500).optional(),
  })
  .refine((v) => (v.query && v.query.trim().length >= 2) || v.image, {
    message: "Provide a query (2+ chars) or an image.",
  });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The multiplier: anything the coach has learned about this user (dislikes,
  // likes, allergies) flows into every swap, not just the chat. Layered on top
  // of any user-supplied preferences for this request — user intent wins on
  // conflicts because the merge order keeps memory items behind explicit input.
  let mergedPreferences: SwapPreferencesInput | null = parsed.data.preferences ?? null;
  if (user?.id) {
    const mem = await getMemorySummary(user.id).catch(() => null);
    if (mem) {
      const dislikeSubjects = mem.dislikes.map((d) => d.subject);
      const allergySubjects = mem.dislikes
        .filter((d) => /allerg/i.test(d.note ?? ""))
        .map((d) => d.subject);
      const likeSubjects = mem.likes.map((l) => l.subject);
      const base: SwapPreferencesInput = mergedPreferences ?? {};
      mergedPreferences = {
        ...base,
        allergens: dedup([...(base.allergens ?? []), ...allergySubjects]),
        avoid_soft: dedup([...(base.avoid_soft ?? []), ...dislikeSubjects]),
        prioritize: dedup([...(base.prioritize ?? []), ...likeSubjects]),
      };
    }
  }

  const requestId = randomUUID();
  const query = parsed.data.query ?? "";
  const hasImage = !!parsed.data.image;
  const inputType = inputTypeOf(query, hasImage);

  try {
    const result = await runSwapGenerator({
      userId: user?.id ?? null,
      productId: parsed.data.product_id ?? null,
      request: query,
      image: parsed.data.image
        ? { mediaType: parsed.data.image.media_type, data: parsed.data.image.data }
        : undefined,
      preferences: mergedPreferences,
      avoidTitles: parsed.data.avoid_titles ?? null,
      feedback: parsed.data.feedback ?? null,
      clientPlatform: "web",
      skipCache: parsed.data.skip_cache,
      requestId,
    });

    // Persist the per-request trace row. Fire-and-forget so trace writes never
    // block the user-facing response.
    if ("trace" in result && result.trace) {
      void writeTrace(result.trace, {
        userId: user?.id ?? null,
        inputType,
        inputQuery: query || null,
        inputImagePresent: hasImage,
        inputMeta: { product_id: parsed.data.product_id ?? null },
        swapId: result.swap?.id ?? null,
        clientPlatform: "web",
      });
    }

    // Append a behavioral event so the user's signal trail grows from the first interaction.
    if (user?.id) {
      await supabase.from("events").insert({
        user_id: user.id,
        event_type: "viewed_swap",
        target_type: "swap",
        target_id: result.swap?.id ?? null,
        client_platform: "web",
        metadata: { query, cached: result.cached },
        request_id: requestId,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        request_id: requestId,
        cached: result.cached,
        swap: result.swap,
        output: "output" in result ? result.output : null,
        latency_ms: "latencyMs" in result ? result.latencyMs : null,
        source: "source" in result ? result.source : "llm",
        library_hit: "libraryHit" in result ? result.libraryHit : null,
        debug: "debug" in result ? result.debug : null,
        trace: "trace" in result ? result.trace : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/swap]", err);
    if (err instanceof NoLibraryProductsError) {
      // Not a real failure — the user asked for a product, none of our
      // curated brands carry it. 200 with a clean "no match" payload so the
      // UI can show a helpful message instead of an error toast.
      void writeTrace(
        {
          request_id: requestId,
          classification_reasoning: "product_only_no_match",
          classification_confidence: null,
          source_chosen: "not_found",
          source_reasoning: null,
          db_match_found: false,
          library_recipe_id: null,
          library_product_ids: [],
          category_implicit: null,
          recommendations: [],
          latency_cache_ms: null,
          latency_embed_ms: null,
          latency_pgvector_ms: null,
          latency_judge_ms: null,
          latency_llm_ms: null,
          latency_total_ms: 0,
          tokens_input: null,
          tokens_output: null,
          cost_usd: null,
        },
        {
          userId: user?.id ?? null,
          inputType,
          inputQuery: query || null,
          inputImagePresent: hasImage,
          inputMeta: { product_id: parsed.data.product_id ?? null },
          swapId: null,
          clientPlatform: "web",
        },
      );
      return NextResponse.json({
        ok: true,
        data: {
          request_id: requestId,
          cached: false,
          swap: null,
          output: null,
          latency_ms: null,
          source: "library",
          no_match: true,
          message: err.message,
          query: (err.details as { query?: string } | undefined)?.query ?? null,
        },
      });
    }
    if (err instanceof ModelNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "model_not_found",
            message: err.message,
            details: err.details,
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "swap_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
