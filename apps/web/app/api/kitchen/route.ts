import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveSchema = z
  .object({
    recipe_id: z.string().uuid().optional(),
    swap_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string()).default([]),
  })
  .refine(
    (v) =>
      [v.recipe_id, v.swap_id, v.variant_id].filter(Boolean).length === 1,
    { message: "Provide exactly one of recipe_id, swap_id, or variant_id" },
  );

export async function GET() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated" } }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recipe_box_entries")
    .select("*, recipes(*), swaps(*), recipe_variants(*)")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: "kitchen_read_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: { entries: data ?? [] } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
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
    .from("recipe_box_entries")
    .insert({
      user_id: user.id,
      recipe_id: parsed.data.recipe_id ?? null,
      swap_id: parsed.data.swap_id ?? null,
      variant_id: parsed.data.variant_id ?? null,
      notes: parsed.data.notes ?? null,
      tags: parsed.data.tags,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "kitchen_save_failed", message: error.message } },
      { status: 500 },
    );
  }

  await supabase.from("events").insert({
    user_id: user.id,
    event_type: "saved_to_kitchen",
    target_type: parsed.data.recipe_id ? "recipe" : parsed.data.swap_id ? "swap" : "variant",
    target_id:
      parsed.data.recipe_id ?? parsed.data.swap_id ?? parsed.data.variant_id ?? null,
    client_platform: "web",
  });

  return NextResponse.json({ ok: true, data: { entry: data } });
}

const DeleteSchema = z
  .object({
    entry_id: z.string().uuid().optional(),
    recipe_id: z.string().uuid().optional(),
    swap_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      [v.entry_id, v.recipe_id, v.swap_id, v.variant_id].filter(Boolean).length === 1,
    { message: "Provide exactly one of entry_id, recipe_id, swap_id, or variant_id" },
  );

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

  let q = supabase
    .from("recipe_box_entries")
    .delete({ count: "exact" })
    .eq("user_id", user.id);
  if (parsed.data.entry_id) q = q.eq("id", parsed.data.entry_id);
  else if (parsed.data.recipe_id) q = q.eq("recipe_id", parsed.data.recipe_id);
  else if (parsed.data.swap_id) q = q.eq("swap_id", parsed.data.swap_id);
  else if (parsed.data.variant_id) q = q.eq("variant_id", parsed.data.variant_id);

  const { error, count } = await q;
  if (error) {
    return NextResponse.json(
      { error: { code: "kitchen_delete_failed", message: error.message } },
      { status: 500 },
    );
  }
  if (!count) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No matching kitchen entry." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: { removed: count } });
}

const PatchSchema = z
  .object({
    entry_id: z.string().uuid().optional(),
    recipe_id: z.string().uuid().optional(),
    swap_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    notes: z.string().max(2000).nullable(),
  })
  .refine(
    (v) =>
      [v.entry_id, v.recipe_id, v.swap_id, v.variant_id].filter(Boolean).length === 1,
    { message: "Provide exactly one of entry_id, recipe_id, swap_id, or variant_id" },
  );

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

  let q = supabase
    .from("recipe_box_entries")
    .update({ notes: parsed.data.notes })
    .eq("user_id", user.id);
  if (parsed.data.entry_id) q = q.eq("id", parsed.data.entry_id);
  else if (parsed.data.recipe_id) q = q.eq("recipe_id", parsed.data.recipe_id);
  else if (parsed.data.swap_id) q = q.eq("swap_id", parsed.data.swap_id);
  else if (parsed.data.variant_id) q = q.eq("variant_id", parsed.data.variant_id);

  const { data, error } = await q.select().maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: { code: "kitchen_update_failed", message: error.message } },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No matching kitchen entry." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: { entry: data } });
}
