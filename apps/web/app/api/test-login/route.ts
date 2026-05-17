import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo-only "test login" gate. Single shared password gives anyone with the
// dev secret the ability to either sign in as a synthetic admin (full admin
// portal access — model picker, personas, retention, etc.) or mint a session
// for any email to walk the app from that persona's perspective.
//
// Disabled in production unless TEST_LOGIN_PASSWORD is explicitly set.

const Schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("admin"), password: z.string().min(1) }),
  z.object({
    mode: z.literal("impersonate"),
    password: z.string().min(1),
    email: z.string().email(),
  }),
]);

const ADMIN_COOKIE = "rfw-test-admin";

function expectedPassword(): string | null {
  if (process.env.TEST_LOGIN_PASSWORD) return process.env.TEST_LOGIN_PASSWORD;
  if (process.env.NODE_ENV !== "production") return "realfood";
  return null;
}

function adminEmail(): string {
  return process.env.TEST_ADMIN_EMAIL ?? "admin@realfoodwin.test";
}

async function mintSession(email: string): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    return {
      ok: false,
      status: 500,
      body: {
        error: {
          code: "link_failed",
          message: linkErr?.message ?? "Could not generate session token.",
        },
      },
    };
  }

  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr) {
    return {
      ok: false,
      status: 500,
      body: { error: { code: "session_mint_failed", message: verifyErr.message } },
    };
  }
  return { ok: true };
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

  const targetEmail = parsed.data.mode === "admin" ? adminEmail() : parsed.data.email;
  const minted = await mintSession(targetEmail);
  if (!minted.ok) {
    return NextResponse.json(minted.body, { status: minted.status });
  }

  const res = NextResponse.json({
    ok: true,
    data: {
      mode: parsed.data.mode,
      signed_in_as: targetEmail,
      redirect: parsed.data.mode === "admin" ? "/admin" : "/",
    },
  });

  // Cookie unlocks /admin/* regardless of ADMIN_IMPERSONATE_EMAILS — only set
  // on the admin path of the flow. httpOnly so client JS can't forge it.
  if (parsed.data.mode === "admin") {
    res.cookies.set(ADMIN_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
  } else {
    // Impersonating a regular user clears any prior admin cookie.
    res.cookies.set(ADMIN_COOKIE, "", { maxAge: 0, path: "/" });
  }

  return res;
}
