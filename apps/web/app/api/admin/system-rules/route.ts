import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gateAdmin() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: { code: "forbidden" } }, { status: 403 }) };
  }
  return { user };
}

function adminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

const CreateSchema = z.object({
  scope: z.enum(["global", "profile"]),
  rule: z.string().min(3).max(500),
  active: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  profile_filter: z.record(z.unknown()).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  rule: z.string().min(3).max(500).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const { data, error } = await adminClient()
    .from("system_rules")
    .insert({
      scope: parsed.data.scope,
      rule: parsed.data.rule,
      active: parsed.data.active ?? true,
      priority: parsed.data.priority ?? 50,
      profile_filter: parsed.data.profile_filter ?? null,
      created_by: gate.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "rule_save_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { rule: data } });
}

export async function PATCH(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const { id, ...patch } = parsed.data;
  const { data, error } = await adminClient()
    .from("system_rules")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "rule_update_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { rule: data } });
}

export async function DELETE(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }
  await adminClient().from("system_rules").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
