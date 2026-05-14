import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase Auth redirects here after the user clicks the magic-link email.
// The URL contains a `code` query param we exchange for a session.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[/api/auth/callback] exchange failed:", error);
      return NextResponse.redirect(`${url.origin}/sign-in?error=callback_failed`);
    }
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
