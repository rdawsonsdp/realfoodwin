import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  event_type: z.string().min(1).max(64),
  target_type: z.string().max(32).optional(),
  target_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
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

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    event_type: parsed.data.event_type,
    target_type: parsed.data.target_type ?? null,
    target_id: parsed.data.target_id ?? null,
    metadata: parsed.data.metadata ?? {},
    client_platform: "web",
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "event_log_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
