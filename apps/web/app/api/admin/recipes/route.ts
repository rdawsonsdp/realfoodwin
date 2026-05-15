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

const IngredientSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    quantity: z.string().optional().default(""),
    unit: z.string().optional(),
  }),
]);

const RecipeSchema = z.object({
  title: z.string().min(2).max(200),
  ingredients: z.array(IngredientSchema).default([]),
  steps: z.array(z.string()).default([]),
  time_min: z.number().int().positive().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().nullable(),
  meal_type: z.string().max(40).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

const CreateBody = z.union([
  RecipeSchema,
  z.object({ recipes: z.array(RecipeSchema) }), // bulk create
]);

const UpdateBody = z.object({
  id: z.string().uuid(),
  patch: RecipeSchema.partial(),
});

// Normalize ingredient strings into the JSON shape we store.
function normalizeIngredients(input: z.infer<typeof IngredientSchema>[]) {
  return input.map((ing) =>
    typeof ing === "string"
      ? { name: ing, quantity: "", unit: "" }
      : { name: ing.name, quantity: ing.quantity ?? "", unit: ing.unit ?? "" },
  );
}

export async function POST(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const admin = adminClient();
  const list = "recipes" in parsed.data ? parsed.data.recipes : [parsed.data];

  const rows = list.map((r) => ({
    title: r.title,
    ingredients: normalizeIngredients(r.ingredients),
    steps: r.steps,
    time_min: r.time_min ?? null,
    difficulty: r.difficulty ?? null,
    meal_type: r.meal_type ?? null,
    tags: r.tags ?? [],
  }));

  const { data, error } = await admin.from("recipes").insert(rows).select();
  if (error) {
    return NextResponse.json(
      { error: { code: "recipe_save_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { recipes: data, count: data?.length ?? 0 } });
}

export async function PATCH(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", details: parsed.error.format() } },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { ...parsed.data.patch };
  if (parsed.data.patch.ingredients) {
    patch.ingredients = normalizeIngredients(parsed.data.patch.ingredients);
  }

  const { data, error } = await adminClient()
    .from("recipes")
    .update(patch)
    .eq("id", parsed.data.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: { code: "recipe_update_failed", message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: { recipe: data } });
}

export async function DELETE(req: Request) {
  const gate = await gateAdmin();
  if ("error" in gate) return gate.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: { code: "validation_error" } }, { status: 400 });
  }
  await adminClient().from("recipes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
