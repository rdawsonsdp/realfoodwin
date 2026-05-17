import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo-only "test login" gate. Single shared password gives anyone with the
// dev secret the ability to mint a session for any email — used to walk the
// app from different personas' perspectives without real magic-link auth.
//
// Disabled in production unless TEST_LOGIN_PASSWORD is explicitly set.

const Schema = z.object({
  password: z.string().min(1),
  email: z.string().email(),
});

function expectedPassword(): string | null {
  if (process.env.TEST_LOGIN_PASSWORD) return process.env.TEST_LOGIN_PASSWORD;
  if (process.env.NODE_ENV !== "production") return "realfood";
  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }

  const expected = expectedPassword();
  if (!expected) {
    return NextResponse.json(
      { error: { code: "disabled", message: "Test login is disabled in this environment." } },
      { status: 403 },
    );
  }
  if (parsed.data.password !== expected) {
    return NextResponse.json(
      { error: { code: "bad_password", message: "Incorrect password." } },
      { status: 401 },
    );
  }

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
          message: linkErr?.message ?? "Could not generate session token.",
        },
      },
      { status: 500 },
    );
  }

  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
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
