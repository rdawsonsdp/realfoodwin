import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
});

const PostSchema = z.object({
  swap_id: z.string().uuid().optional().nullable(),
  items: z.array(ItemSchema).min(1).max(40),
});

export async function GET() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: "grocery_read_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { items: data ?? [] } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const rows = parsed.data.items.map((it) => ({
    user_id: user.id,
    swap_id: parsed.data.swap_id ?? null,
    name: it.name,
    quantity: it.quantity ?? null,
    unit: it.unit ?? null,
  }));

  const { data, error } = await supabase
    .from("grocery_items")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json(
      { error: { code: "grocery_insert_failed", message: error.message } },
      { status: 500 },
    );
  }

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "added_to_grocery",
    target_type: parsed.data.swap_id ? "swap" : null,
    target_id: parsed.data.swap_id ?? null,
    client_platform: "web",
    metadata: { count: rows.length },
  });

  return NextResponse.json({ ok: true, data: { items: data ?? [], added: rows.length } });
}

const PatchSchema = z.object({
  item_id: z.string().uuid(),
  checked: z.boolean(),
});

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("grocery_items")
    .update({ checked: parsed.data.checked })
    .eq("id", parsed.data.item_id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: { code: "grocery_update_failed", message: error.message } },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: { code: "not_found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: { item: data } });
}

const DeleteSchema = z.object({ item_id: z.string().uuid() });

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const { error, count } = await supabase
    .from("grocery_items")
    .delete({ count: "exact" })
    .eq("id", parsed.data.item_id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json(
      { error: { code: "grocery_delete_failed", message: error.message } },
      { status: 500 },
    );
  }
  if (!count) {
    return NextResponse.json(
      { error: { code: "not_found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: { removed: count } });
}
