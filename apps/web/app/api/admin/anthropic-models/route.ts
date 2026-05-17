import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live probe of the Anthropic API key configured on this deployment. Returns
// the list of models the key can actually call, plus a masked fingerprint of
// the key itself so the admin can confirm which credential is in use.

export async function GET() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminRequest(user?.email ?? null)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: { code: "missing_key", message: "ANTHROPIC_API_KEY is not set on this deployment." } },
      { status: 500 },
    );
  }

  const fingerprint = `${key.slice(0, 12)}…${key.slice(-6)} (${key.length} chars)`;

  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      {
        error: {
          code: "anthropic_error",
          message: payload?.error?.message ?? `Anthropic returned ${res.status}`,
          details: { status: res.status, fingerprint, raw: payload },
        },
      },
      { status: 502 },
    );
  }

  type ModelRow = { id: string; display_name?: string; created_at?: string };
  const models: ModelRow[] = Array.isArray(payload?.data) ? payload.data : [];

  return NextResponse.json({
    ok: true,
    data: {
      fingerprint,
      count: models.length,
      helicone_configured: !!process.env.HELICONE_API_KEY,
      models: models.map((m) => ({
        id: m.id,
        display_name: m.display_name ?? null,
        created_at: m.created_at ?? null,
      })),
    },
  });
}
