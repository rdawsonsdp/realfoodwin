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

const PostSchema = z.object({
  target_user_id: z.string().uuid(),
  note: z.string().min(3).max(2000),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  note: z.string().min(3).max(2000).optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const { data, error } = await adminClient()
    .from("admin_coaching_notes")
    .insert({
      target_user_id: parsed.data.target_user_id,
      reviewer_user_id: gate.user.id,
      note: parsed.data.note,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "save_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { note: data } });
}

export async function PATCH(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }
  const { id, ...patch } = parsed.data;
  const { data, error } = await adminClient()
    .from("admin_coaching_notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { note: data } });
}

export async function DELETE(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  await adminClient().from("admin_coaching_notes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
