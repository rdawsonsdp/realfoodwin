import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  swap_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  note: z.string().max(2000).optional(),
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
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Admin only." } },
      { status: 403 },
    );
  }

  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  // Look up target user from the swap.
  const { data: swap } = await admin
    .from("swaps")
    .select("user_id")
    .eq("id", parsed.data.swap_id)
    .maybeSingle();
  if (!swap?.user_id) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Swap has no associated user." } },
      { status: 404 },
    );
  }

  const { data, error } = await admin
    .from("admin_swap_reviews")
    .upsert(
      {
        swap_id: parsed.data.swap_id,
        reviewer_user_id: user.id,
        target_user_id: swap.user_id,
        stars: parsed.data.stars,
        note: parsed.data.note ?? null,
      },
      { onConflict: "swap_id,reviewer_user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "review_save_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { review: data } });
}
