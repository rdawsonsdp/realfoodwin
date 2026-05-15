import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  sonnet: z.string().min(2).max(100),
  haiku: z.string().min(2).max(100),
});

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const rows = [
    { key: "model.sonnet", value: parsed.data.sonnet, updated_by: user.id },
    { key: "model.haiku", value: parsed.data.haiku, updated_by: user.id },
  ];

  const { error } = await admin
    .from("app_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) {
    return NextResponse.json(
      { error: { code: "save_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { sonnet: parsed.data.sonnet, haiku: parsed.data.haiku } });
}
