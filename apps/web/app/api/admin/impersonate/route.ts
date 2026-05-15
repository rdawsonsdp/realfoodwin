import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo-only impersonation. Uses the service role to generate a magic-link OTP
// for the target email, then verifies it server-side to mint a session cookie
// — effectively a "sign in as" button without needing the user's mailbox.
//
// Guarded by an env allowlist: ADMIN_IMPERSONATE_EMAILS=comma-separated list
// of currently-signed-in emails that are allowed to use this. Defaults to
// allowing anyone in dev (NODE_ENV=development) for the prototype.

const Schema = z.object({ email: z.string().email() });

function isAllowedImpersonator(email: string): boolean {
  const allowlist = process.env.ADMIN_IMPERSONATE_EMAILS;
  if (!allowlist) return process.env.NODE_ENV !== "production";
  return allowlist.split(",").map((e) => e.trim().toLowerCase()).includes(email.toLowerCase());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }

  // 1. Authorization: caller must already be signed in AND on the allowlist (or in dev).
  const supabase = createSupabaseServer();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller?.email) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }
  if (!isAllowedImpersonator(caller.email)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Not on the impersonation allowlist." } },
      { status: 403 },
    );
  }

  // 2. Generate a magic-link OTP for the target email via the admin client.
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      {
        error: {
          code: "link_failed",
          message: linkErr?.message ?? "Could not generate impersonation token.",
        },
      },
      { status: 500 },
    );
  }

  // 3. Sign out current user, then verify the OTP on the SERVER-bound client
  //    so the new session cookie lands on this response.
  await supabase.auth.signOut();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr) {
    return NextResponse.json(
      { error: { code: "session_mint_failed", message: verifyErr.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { signed_in_as: parsed.data.email } });
}
