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
  description: z.string().max(2000).optional().nullable(),
});

const CreateBody = z.union([
  RecipeSchema,
  // Bulk: array of recipes plus optional upsert flag. With upsert=true the
  // server uses the lower(title) unique index to match existing rows and
  // update them in place — the same path the seed migrations use.
  z.object({
    recipes: z.array(RecipeSchema),
    upsert: z.boolean().optional().default(false),
  }),
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
  // Narrow the CreateBody union explicitly. `in` narrowing here isn't enough
  // because TS keeps the original union in the else branch — assert via a
  // typed local so the row-loop sees `Recipe` rather than the union.
  type Recipe = z.infer<typeof RecipeSchema>;
  type BulkBody = { recipes: Recipe[]; upsert?: boolean };
  const payload = parsed.data as Recipe | BulkBody;
  const bulk: BulkBody | null =
    typeof payload === "object" && payload !== null && "recipes" in payload
      ? (payload as BulkBody)
      : null;
  const list: Recipe[] = bulk ? bulk.recipes : [payload as Recipe];
  const upsert = bulk?.upsert === true;

  const rows = list.map((r) => ({
    title: r.title,
    ingredients: normalizeIngredients(r.ingredients),
    steps: r.steps,
    time_min: r.time_min ?? null,
    difficulty: r.difficulty ?? null,
    meal_type: r.meal_type ?? null,
    tags: r.tags ?? [],
    description: r.description ?? null,
  }));

  // Bulk upsert: the recipes table has a unique index on lower(title), but
  // PostgREST upsert doesn't honor expression indexes. So we do it manually:
  // fetch existing IDs by lowercased title, split into insert vs update sets.
  if (upsert) {
    const lcTitles = rows.map((r) => r.title.toLowerCase());
    const { data: existing, error: lookupErr } = await admin
      .from("recipes")
      .select("id, title");
    if (lookupErr) {
      return NextResponse.json(
        { error: { code: "recipe_save_failed", message: lookupErr.message } },
        { status: 500 },
      );
    }
    const titleToId = new Map<string, string>();
    for (const e of existing ?? []) {
      titleToId.set((e.title as string).toLowerCase(), e.id as string);
    }
    const toInsert: typeof rows = [];
    const toUpdate: Array<{ id: string; patch: (typeof rows)[number] }> = [];
    for (const r of rows) {
      const id = titleToId.get(r.title.toLowerCase());
      if (id) toUpdate.push({ id, patch: r });
      else toInsert.push(r);
    }

    const inserted = toInsert.length
      ? await admin.from("recipes").insert(toInsert).select()
      : { data: [] as unknown[], error: null };
    if (inserted.error) {
      return NextResponse.json(
        { error: { code: "recipe_save_failed", message: inserted.error.message } },
        { status: 500 },
      );
    }
    const updated: unknown[] = [];
    for (const u of toUpdate) {
      const { data: updRow, error: updErr } = await admin
        .from("recipes")
        .update(u.patch)
        .eq("id", u.id)
        .select()
        .single();
      if (updErr) {
        return NextResponse.json(
          { error: { code: "recipe_update_failed", message: updErr.message } },
          { status: 500 },
        );
      }
      if (updRow) updated.push(updRow);
    }
    void lcTitles;
    return NextResponse.json({
      ok: true,
      data: {
        recipes: [...(inserted.data ?? []), ...updated],
        count: (inserted.data?.length ?? 0) + updated.length,
        inserted: inserted.data?.length ?? 0,
        updated: updated.length,
      },
    });
  }

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
