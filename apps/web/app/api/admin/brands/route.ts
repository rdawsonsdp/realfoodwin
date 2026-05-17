import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { isAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BrandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  category: z.string().max(80).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  certifications: z.array(z.string()).max(20).optional().nullable(),
});

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  brand_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  product_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  tags: z.array(z.string()).max(20).optional().nullable(),
  sort_order: z.number().int().optional(),
});

async function gate() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminRequest(user?.email ?? null)) {
    return { ok: false as const, status: 403 };
  }
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  return { ok: true as const, admin };
}

export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });

  const body = await req.json().catch(() => null) as { kind?: string; payload?: unknown } | null;
  if (!body?.kind) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }

  if (body.kind === "brand_upsert") {
    const parsed = BrandSchema.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "validation_error", details: parsed.error.format() } }, { status: 400 });
    }
    const row = parsed.data;
    const { data, error } = await g.admin
      .from("brands")
      .upsert({ ...row, id: row.id ?? undefined }, { onConflict: "id" })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: { code: "save_failed", message: error.message } }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: { brand: data } });
  }

  if (body.kind === "brand_delete") {
    const idSchema = z.object({ id: z.string().uuid() });
    const parsed = idSchema.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
    }
    const { error } = await g.admin.from("brands").delete().eq("id", parsed.data.id);
    if (error) {
      return NextResponse.json({ error: { code: "delete_failed", message: error.message } }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: { id: parsed.data.id } });
  }

  if (body.kind === "product_upsert") {
    const parsed = ProductSchema.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "validation_error", details: parsed.error.format() } }, { status: 400 });
    }
    const row = parsed.data;
    const { data, error } = await g.admin
      .from("brand_products")
      .upsert({ ...row, id: row.id ?? undefined }, { onConflict: "id" })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: { code: "save_failed", message: error.message } }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: { product: data } });
  }

  if (body.kind === "product_delete") {
    const idSchema = z.object({ id: z.string().uuid() });
    const parsed = idSchema.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
    }
    const { error } = await g.admin.from("brand_products").delete().eq("id", parsed.data.id);
    if (error) {
      return NextResponse.json({ error: { code: "delete_failed", message: error.message } }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: { id: parsed.data.id } });
  }

  return NextResponse.json({ error: { code: "unknown_kind" } }, { status: 400 });
}
