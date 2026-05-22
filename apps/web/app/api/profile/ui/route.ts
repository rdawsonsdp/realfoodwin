import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HOME_THEMES, CUSTOM_THEME_ID } from "@/lib/home-themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Max custom-background payload (base64). 400KB keeps the ui_prefs row well
// under the JSONB sweet spot. The client compresses before sending, but we
// enforce here too so a hostile client can't bloat the row.
const MAX_CUSTOM_BG_BYTES = 400 * 1024;

const Schema = z
  .object({
    theme: z
      .string()
      .refine(
        (id) =>
          id === CUSTOM_THEME_ID || HOME_THEMES.some((t) => t.id === id),
        { message: "Unknown theme id" },
      )
      .optional(),
    custom_bg: z
      .string()
      .max(MAX_CUSTOM_BG_BYTES * 2, { message: "Background image too large" })
      .regex(/^data:image\/(jpeg|png|webp);base64,/, {
        message: "Custom background must be a base64 image data URL",
      })
      .nullable()
      .optional(),
  })
  .refine(
    (v) => v.theme !== undefined || v.custom_bg !== undefined,
    { message: "Nothing to update" },
  );

export async function GET() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("user_preferences")
    .select("ui_prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: { code: "read_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { ui_prefs: data?.ui_prefs ?? {} } });
}

export async function PATCH(req: Request) {
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

  // Read-modify-write so we don't stomp other keys (e.g. future surfaces).
  const existing = await supabase
    .from("user_preferences")
    .select("ui_prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  const merged = {
    ...(existing.data?.ui_prefs ?? {}),
    ...parsed.data,
  };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, ui_prefs: merged },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json(
      { error: { code: "save_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { ui_prefs: merged } });
}
