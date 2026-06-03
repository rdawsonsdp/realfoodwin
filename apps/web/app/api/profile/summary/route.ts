import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { embed } from "@realfoodwin/gateway";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  summary_text: z.string().min(1).max(300),
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

  const text = parsed.data.summary_text.trim();

  // Re-embed so RAG retrieval reflects the user's edit. If Voyage is down or
  // the key is missing, persist text-only — embeddings can be backfilled later.
  let embedding: number[] | null = null;
  try {
    const result = await embed(text, "document");
    embedding = result.vector;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[/api/profile/summary] embedding failed:", err);
  }

  // user_summaries writes are service-role only per RLS (0010_rls_policies).
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { error } = await admin.from("user_summaries").upsert(
    {
      user_id: user.id,
      summary_text: text,
      ...(embedding ? { embedding: embedding as unknown as string } : {}),
      generated_at: new Date().toISOString(),
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
