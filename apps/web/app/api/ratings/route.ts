import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  target_type: z.enum(["recipe", "swap", "variant", "product"]),
  target_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  target_label: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recipe_ratings")
    .upsert(
      {
        user_id: user.id,
        target_type: parsed.data.target_type,
        target_id: parsed.data.target_id,
        target_label: parsed.data.target_label ?? null,
        stars: parsed.data.stars,
        comment: parsed.data.comment ?? null,
      },
      { onConflict: "user_id,target_type,target_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "rating_save_failed", message: error.message } },
      { status: 500 },
    );
  }

  // Mirror as an event so it shows up in the RAG history alongside saves / made-it.
  await supabase.from("events").insert({
    user_id: user.id,
    event_type: parsed.data.stars >= 4 ? "rated_loved" : "rated_meh",
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    metadata: {
      stars: parsed.data.stars,
      label: parsed.data.target_label,
      summary: `Rated ${parsed.data.target_label ?? "a recipe"} ${parsed.data.stars}/5`,
    },
    client_platform: "web",
  });

  return NextResponse.json({ ok: true, data: { rating: data } });
}
