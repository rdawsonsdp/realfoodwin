// POST /api/barcode/lookup
// Body: { barcode: string }
// Returns: { ok: true, data: { name, brand, source } } | { ok: false }
//
// Resolves a scanned barcode through the cascade (local cache → Open Food
// Facts → unknown). On unknown we return 404 so the client knows to fall back
// to passing the raw code to the swap engine.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { resolveBarcode } from "@/lib/barcode-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  barcode: z.string().min(6).max(32),
});

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

  const resolved = await resolveBarcode(parsed.data.barcode);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, data: resolved });
}
