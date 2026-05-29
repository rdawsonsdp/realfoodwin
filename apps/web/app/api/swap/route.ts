import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runSwapGenerator,
  ModelNotFoundError,
  NoLibraryProductsError,
  type SwapPreferencesInput,
} from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getMemorySummary } from "@/lib/coach-memory";

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

  try {
    const result = await runSwapGenerator({
      userId: user?.id ?? null,
      productId: parsed.data.product_id ?? null,
      request: parsed.data.query ?? "",
      image: parsed.data.image
        ? { mediaType: parsed.data.image.media_type, data: parsed.data.image.data }
        : undefined,
      preferences: mergedPreferences,
      avoidTitles: parsed.data.avoid_titles ?? null,
      feedback: parsed.data.feedback ?? null,
      clientPlatform: "web",
      skipCache: parsed.data.skip_cache,
    });

    // Append a behavioral event so the user's signal trail grows from the first interaction.
    if (user?.id) {
      await supabase.from("events").insert({
        user_id: user.id,
        event_type: "viewed_swap",
        target_type: "swap",
        target_id: result.swap?.id ?? null,
        client_platform: "web",
        metadata: { query: parsed.data.query, cached: result.cached },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        cached: result.cached,
        swap: result.swap,
        output: "output" in result ? result.output : null,
        latency_ms: "latencyMs" in result ? result.latencyMs : null,
        source: "source" in result ? result.source : "llm",
        library_hit: "libraryHit" in result ? result.libraryHit : null,
        debug: "debug" in result ? result.debug : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/swap]", err);
    if (err instanceof NoLibraryProductsError) {
      // Not a real failure — the user asked for a product, none of our
      // curated brands carry it. 200 with a clean "no match" payload so the
      // UI can show a helpful message instead of an error toast.
      return NextResponse.json({
        ok: true,
        data: {
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
