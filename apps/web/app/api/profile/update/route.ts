import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Partial profile update from the Account page. Every field is optional so the
// caller can patch one slice at a time (e.g. just allergies) without resending
// everything. Anything sent overwrites the existing value.
const Schema = z.object({
  dietary_pattern: z.array(z.string().max(40)).max(20).optional(),
  allergies: z.array(z.string().max(40)).max(30).optional(),
  allergies_other: z.string().max(400).nullable().optional(),
  household_composition: z.string().max(40).nullable().optional(),
  top_goal: z.string().max(40).nullable().optional(),
  weeknight_time: z.number().int().min(5).max(240).nullable().optional(),
  skill_level: z.enum(["beginner", "comfortable", "confident"]).nullable().optional(),
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const patch: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.dietary_pattern !== undefined) patch.dietary_pattern = d.dietary_pattern;
  if (d.allergies !== undefined) patch.allergies = d.allergies;
  if (d.household_composition !== undefined) patch.household_composition = d.household_composition;
  if (d.top_goal !== undefined) patch.top_goal = d.top_goal;
  if (d.weeknight_time !== undefined) patch.weeknight_time = d.weeknight_time;
  if (d.skill_level !== undefined) patch.skill_level = d.skill_level;

  // allergies_other lives inside the existing `extra` jsonb pocket — merge,
  // don't clobber, so other extra fields survive.
  if (d.allergies_other !== undefined) {
    const { data: current } = await supabase
      .from("user_profiles")
      .select("extra")
      .eq("user_id", user.id)
      .maybeSingle();
    const prev = (current?.extra as Record<string, unknown> | null) ?? {};
    patch.extra = { ...prev, allergies_other: d.allergies_other };
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json(
      { error: { code: "save_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
