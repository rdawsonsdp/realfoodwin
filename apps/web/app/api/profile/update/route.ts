import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  dietary_pattern: z.array(z.string().max(40)).max(20),
  allergies: z.array(z.string().max(40)).max(20),
  allergies_other: z.string().max(200).nullable().optional(),
  household_composition: z.string().max(40).nullable(),
  top_goal: z.string().max(40).nullable(),
  weeknight_time: z.number().int().min(5).max(240).nullable(),
  skill_level: z.enum(["beginner", "comfortable", "confident"]).nullable(),
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

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("extra")
    .eq("user_id", user.id)
    .maybeSingle();

  const extra = {
    ...(existing?.extra ?? {}),
    allergies_other: parsed.data.allergies_other ?? null,
  };

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      dietary_pattern: parsed.data.dietary_pattern,
      allergies: parsed.data.allergies,
      household_composition: parsed.data.household_composition,
      top_goal: parsed.data.top_goal,
      weeknight_time: parsed.data.weeknight_time,
      skill_level: parsed.data.skill_level,
      extra,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: { code: "save_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
