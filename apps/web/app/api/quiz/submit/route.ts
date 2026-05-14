import { NextResponse } from "next/server";
import { z } from "zod";
import { runQuizSummary } from "@realfoodwin/gateway";
import { embed } from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matches the 5-question quiz (spec 4.1) with snake_case wire format.
const RequestSchema = z.object({
  dietary_pattern: z.array(z.string()),
  allergies: z.array(z.string()),
  allergies_other: z.string().nullable().optional(),
  household_composition: z.string().nullable(),
  household_members: z
    .array(
      z.object({
        name: z.string(),
        age_range: z.enum(["toddler", "kid", "teen", "adult"]).nullable(),
        allergies: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  top_goal: z.string().nullable(),
  weeknight_time: z.number().int().nullable(),
  skill_level: z.enum(["beginner", "comfortable", "confident"]).nullable(),
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
      { error: { code: "unauthenticated" } },
      { status: 401 },
    );
  }

  const profile = parsed.data;

  // 1. Upsert the profile.
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      dietary_pattern: profile.dietary_pattern,
      allergies: profile.allergies,
      household_composition: profile.household_composition,
      top_goal: profile.top_goal,
      weeknight_time: profile.weeknight_time,
      skill_level: profile.skill_level,
      quiz_completed_at: new Date().toISOString(),
      quiz_last_step: 5,
      extra: { allergies_other: profile.allergies_other ?? null },
    },
    { onConflict: "user_id" },
  );

  if (profileErr) {
    return NextResponse.json(
      { error: { code: "profile_save_failed", message: profileErr.message } },
      { status: 500 },
    );
  }

  // 2. Insert household member profiles (replace existing for simplicity).
  if (profile.household_members.length > 0) {
    const { data: userRow } = await supabase
      .from("users")
      .select("household_id")
      .eq("id", user.id)
      .single();

    if (userRow?.household_id) {
      // Service-role write to bypass RLS for the delete+insert sweep.
      const admin = createClient(
        requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false } },
      );
      await admin
        .from("household_member_profiles")
        .delete()
        .eq("household_id", userRow.household_id);
      await admin.from("household_member_profiles").insert(
        profile.household_members.map((m) => ({
          household_id: userRow.household_id,
          name: m.name,
          age_range: m.age_range,
          allergies: m.allergies,
        })),
      );
    }
  }

  // 3. Synchronously generate the user_summary so the first personalized swap feels alive.
  let summary: string | null = null;
  try {
    const result = await runQuizSummary({
      userId: user.id,
      quizAnswers: profile,
      clientPlatform: "web",
    });
    summary = result.summary;
  } catch (err) {
    // Summary failure shouldn't block the user — they can still see swaps,
    // just without the narrative. Logged as warning.
    // eslint-disable-next-line no-console
    console.warn("[/api/quiz/submit] summary generation failed:", err);
  }

  // 4. Persist + embed the summary (if generated).
  if (summary) {
    const admin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    let embedding: number[] | null = null;
    try {
      const result = await embed(summary, "document");
      embedding = result.vector;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[/api/quiz/submit] embedding failed (Voyage key?):", err);
    }

    await admin.from("user_summaries").upsert(
      {
        user_id: user.id,
        summary_text: summary,
        embedding: embedding as unknown as string, // pgvector accepts the typed array; Supabase JS sends it as-is
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  return NextResponse.json({ ok: true, data: { summary } });
}
