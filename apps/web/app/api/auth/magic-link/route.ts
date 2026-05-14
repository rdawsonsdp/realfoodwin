import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
  redirect_to: z.string().optional(),
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
  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(parsed.data.redirect_to ?? "/")}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "auth_send_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: { message: "Check your inbox for a sign-in link." },
  });
}
