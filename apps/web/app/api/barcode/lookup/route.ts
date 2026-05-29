// POST /api/barcode/lookup
// Body: { barcode: string }
// Returns: { ok: true, data: { name, brand, source, timings } } | { ok: false }
//
// Resolves a scanned barcode through the cascade (local cache → negative
// cache → Open Food Facts → unknown). On unknown we return 404 so the client
// knows to fall back to passing the raw code to the swap engine.
//
// Every call writes a row to barcode_lookup_logs so we have p50/p95/hit-rate
// data over time without spelunking through console logs.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { resolveBarcode } from "@/lib/barcode-resolver";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  barcode: z.string().min(6).max(32),
});

function admin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_error" } },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthenticated" } },
      { status: 401 },
    );
  }

  let result;
  try {
    result = await resolveBarcode(parsed.data.barcode);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/barcode/lookup] resolver threw:", err);
    void (async () => {
      try {
        await admin().from("barcode_lookup_logs").insert({
          barcode: parsed.data.barcode,
          user_id: user.id,
          source: "error",
          client_platform: "web",
        });
      } catch {
        // non-fatal
      }
    })();
    return NextResponse.json(
      { ok: false, error: { code: "resolver_error" } },
      { status: 500 },
    );
  }

  const { resolved, timings, normalizedBarcode } = result;

  // Fire-and-forget metrics write. We don't want logging to block the user.
  void (async () => {
    try {
      await admin().from("barcode_lookup_logs").insert({
        barcode: normalizedBarcode || parsed.data.barcode,
        user_id: user.id,
        source: timings.source,
        db_lookup_ms: timings.db_lookup_ms,
        negative_cache_ms: timings.negative_cache_ms,
        off_fetch_ms: timings.off_fetch_ms,
        db_upsert_ms: timings.db_upsert_ms,
        total_ms: timings.total_ms,
        client_platform: "web",
      });
    } catch {
      // non-fatal
    }
  })();

  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found" }, data: { timings } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: { ...resolved, timings },
  });
}
