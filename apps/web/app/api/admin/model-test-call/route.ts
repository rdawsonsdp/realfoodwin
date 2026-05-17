import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues a tiny live messages.create against a specific model ID using the
// deployed ANTHROPIC_API_KEY. Reports success or the exact API status/error
// so the admin can tell whether the failure is the model, the key, or the
// path between the SDK and Anthropic (e.g. Helicone).

const Schema = z.object({ model: z.string().min(2).max(120) });

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminRequest(user?.email ?? null)) {
    return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "missing_key", message: "ANTHROPIC_API_KEY not set." } },
      { status: 500 },
    );
  }

  const useHelicone = !!process.env.HELICONE_API_KEY;
  const client = new Anthropic({
    apiKey,
    baseURL: useHelicone ? "https://anthropic.helicone.ai/v1" : undefined,
    defaultHeaders: useHelicone
      ? { "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}` }
      : undefined,
  });

  const start = Date.now();
  try {
    const resp = await client.messages.create({
      model: parsed.data.model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Say 'ok'." }],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    return NextResponse.json({
      ok: true,
      data: {
        model: parsed.data.model,
        latency_ms: Date.now() - start,
        text,
        helicone: useHelicone,
      },
    });
  } catch (err) {
    const apiErr = err instanceof Anthropic.APIError ? err : null;
    return NextResponse.json(
      {
        error: {
          code: "call_failed",
          message: err instanceof Error ? err.message : String(err),
          details: {
            model: parsed.data.model,
            helicone: useHelicone,
            status: apiErr?.status ?? null,
            type: apiErr ? (apiErr as unknown as { error?: { type?: string } }).error?.type ?? null : null,
            latency_ms: Date.now() - start,
          },
        },
      },
      { status: 502 },
    );
  }
}
