import { NextResponse } from "next/server";
import { z } from "zod";
import { runRecipeIterator } from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  parent_recipe: z.unknown(),
  modification: z.string().min(2).max(280),
  parent_recipe_id: z.string().uuid().optional(),
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

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in to iterate." } },
      { status: 401 },
    );
  }

  try {
    const result = await runRecipeIterator({
      userId: user.id,
      parentRecipe: parsed.data.parent_recipe,
      modificationRequest: parsed.data.modification,
      clientPlatform: "web",
    });

    // Persist as a recipe_variant if we have a parent recipe id.
    let variant = null;
    if (parsed.data.parent_recipe_id) {
      const { data } = await supabase
        .from("recipe_variants")
        .insert({
          parent_recipe_id: parsed.data.parent_recipe_id,
          user_id: user.id,
          modification: parsed.data.modification,
          recipe: result.output,
        })
        .select()
        .single();
      variant = data;
    }

    await supabase.from("events").insert({
      user_id: user.id,
      event_type: "iterated_recipe",
      target_type: "recipe_variant",
      target_id: variant?.id ?? null,
      client_platform: "web",
      metadata: { modification: parsed.data.modification },
    });

    return NextResponse.json({
      ok: true,
      data: { output: result.output, variant, latency_ms: result.latencyMs },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/iterate]", err);
    return NextResponse.json(
      {
        error: {
          code: "iterate_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
