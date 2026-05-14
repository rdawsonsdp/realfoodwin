import { NextResponse } from "next/server";
import { z } from "zod";
import { runSwapGenerator } from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs"; // Anthropic SDK needs Node, not Edge
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  query: z.string().min(2).max(120),
  product_id: z.string().uuid().optional(),
  skip_cache: z.boolean().optional(),
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
    const result = await runSwapGenerator({
      userId: user?.id ?? null,
      productId: parsed.data.product_id ?? null,
      request: parsed.data.query,
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
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/swap]", err);
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
