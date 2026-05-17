import { NextResponse } from "next/server";
import { z } from "zod";
import { runRecipeBuilder, ModelNotFoundError } from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ImageSchema = z.object({
  media_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  data: z.string().min(100).max(8_000_000),
});

const RequestSchema = z.object({
  mode: z.enum(["dish", "recipe", "fridge"]),
  images: z.array(ImageSchema).min(1).max(6),
  notes: z.string().max(500).optional(),
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

  try {
    const result = await runRecipeBuilder({
      userId: user?.id ?? null,
      mode: parsed.data.mode,
      images: parsed.data.images.map((i) => ({
        mediaType: i.media_type,
        data: i.data,
      })),
      notes: parsed.data.notes,
      clientPlatform: "web",
    });

    return NextResponse.json({
      ok: true,
      data: {
        output: result.output,
        latency_ms: result.latencyMs,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/recipes/build]", err);
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
          code: "build_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
