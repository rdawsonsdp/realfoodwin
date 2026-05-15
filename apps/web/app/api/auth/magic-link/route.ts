import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv, optionalEnv } from "@/lib/env";
import {
  magicLinkHtml,
  magicLinkSubject,
  magicLinkText,
} from "@/lib/email/magic-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(80).optional(),
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

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const redirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(parsed.data.redirect_to ?? "/")}`;
  const resendKey = optionalEnv("RESEND_API_KEY");

  // Path A: Resend is configured → generate the link ourselves and send a branded email.
  if (resendKey) {
    try {
      const admin = createClient(
        requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { data: existing } = await admin
        .from("users")
        .select("id, display_name")
        .eq("email", parsed.data.email.toLowerCase())
        .maybeSingle();
      const isReturning = !!existing;

      // For NEW users: pre-create the auth account so the handle_new_auth_user
      // trigger sees the name in user_metadata and sets display_name.
      // For RETURNING users without a name yet: backfill display_name now.
      if (!isReturning && parsed.data.first_name) {
        await admin.auth.admin.createUser({
          email: parsed.data.email,
          email_confirm: true,
          user_metadata: { name: parsed.data.first_name },
        });
      } else if (
        isReturning &&
        parsed.data.first_name &&
        !existing?.display_name
      ) {
        await admin
          .from("users")
          .update({ display_name: parsed.data.first_name })
          .eq("id", existing!.id);
      }

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: parsed.data.email,
        options: { redirectTo },
      });

      if (linkErr || !linkData?.properties?.action_link) {
        // eslint-disable-next-line no-console
        console.error("[/api/auth/magic-link] generateLink failed", linkErr);
        return NextResponse.json(
          {
            error: {
              code: "auth_link_failed",
              message: linkErr?.message ?? "Failed to generate sign-in link.",
            },
          },
          { status: 500 },
        );
      }

      const actionLink = linkData.properties.action_link;
      const fromAddress = optionalEnv("RESEND_FROM") ?? "Real Food Win <onboarding@resend.dev>";
      const resend = new Resend(resendKey);

      const firstName = parsed.data.first_name ?? existing?.display_name ?? null;

      const { error: sendErr } = await resend.emails.send({
        from: fromAddress,
        to: parsed.data.email,
        subject: magicLinkSubject(isReturning, firstName),
        html: magicLinkHtml({ url: actionLink, isReturning, firstName }),
        text: magicLinkText({ url: actionLink, isReturning, firstName }),
      });

      if (sendErr) {
        // eslint-disable-next-line no-console
        console.error("[/api/auth/magic-link] Resend send failed", sendErr);
        return NextResponse.json(
          {
            error: {
              code: "email_send_failed",
              message: sendErr.message ?? "Could not send sign-in email.",
            },
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        data: {
          message: "Check your inbox for a sign-in link.",
          via: "resend",
          is_returning: isReturning,
        },
      });
    } catch (err) {
      // Fall through to Supabase default if anything in the branded path explodes.
      // eslint-disable-next-line no-console
      console.warn("[/api/auth/magic-link] branded path failed, falling back to Supabase default:", err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[FLAG] RESEND_API_KEY not set — sending magic-link via Supabase's default (unbranded) email. Drop in RESEND_API_KEY for the branded version.",
    );
  }

  // Path B: Fall back to Supabase's built-in email. Pass `data` so the trigger
  // picks up the name on first sign-in.
  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo,
      data: parsed.data.first_name ? { name: parsed.data.first_name } : undefined,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "auth_send_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: { message: "Check your inbox for a sign-in link.", via: "supabase_default" },
  });
}
