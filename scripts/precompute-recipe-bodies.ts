/**
 * One-time backfill: for every row in public.recipes that has no ingredients
 * or steps yet, ask Sonnet to generate a clean, whole-food version of the
 * dish based on the seeded title + description. The result is written back to
 * the same row so the swap pipeline can serve it as a pure DB read.
 *
 * Run:
 *   cd apps/web && pnpm exec tsx ../../scripts/precompute-recipe-bodies.ts
 *
 * Why apps/web? .env.local lives there. The script auto-loads it.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: "apps/web/.env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callWithTool, type ToolDefinition } from "@realfoodwin/gateway";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SYSTEM = `You are a real-food recipe author for Real Food Win.

You are given a recipe TITLE and a short DESCRIPTION. Produce the full
ingredient list and cooking steps for that dish, staying faithful to the
description.

Hard rules:
- Whole-food ingredients only. No seed oils (canola, soybean, sunflower,
  vegetable, "vegetable oil blend", margarine). Allowed fats: olive oil,
  avocado oil, coconut oil, butter, ghee, animal tallow.
- No "natural flavors", no maltodextrin, no artificial sweeteners.
- Sweeteners must be honey, maple syrup, or dates unless the title says
  otherwise.
- Keep the ingredient list short and recognizable (8-15 items typical).
- Steps are concise and home-kitchen friendly (5-9 steps typical).
- Respect prep time hints in the description.`;

const TOOL: ToolDefinition = {
  name: "emit_recipe_body",
  description: "Emit the structured ingredient list and step-by-step instructions for the recipe.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["ingredients", "steps"],
    properties: {
      ingredients: {
        type: "array",
        minItems: 3,
        maxItems: 25,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            quantity: { type: "string", maxLength: 40 },
            unit: { type: "string", maxLength: 30 },
          },
        },
      },
      steps: {
        type: "array",
        minItems: 2,
        maxItems: 15,
        items: { type: "string", minLength: 4, maxLength: 600 },
      },
    },
  },
};

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  time_min: number | null;
  meal_type: string | null;
  ingredients: unknown;
  steps: unknown;
}

function isEmpty(json: unknown): boolean {
  if (!Array.isArray(json)) return true;
  return json.length === 0;
}

async function generateOne(r: RecipeRow): Promise<{ ingredients: unknown; steps: unknown } | null> {
  const userPrompt = [
    `TITLE: ${r.title}`,
    r.description ? `DESCRIPTION: ${r.description}` : null,
    r.meal_type ? `MEAL TYPE: ${r.meal_type}` : null,
    r.time_min ? `TARGET TOTAL TIME: ${r.time_min} minutes (prep + cook combined)` : null,
    "",
    "Emit the recipe body via the tool. Stay faithful to the title and description.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await callWithTool({
      tier: "sonnet",
      system: SYSTEM,
      user: userPrompt,
      tool: TOOL,
      maxTokens: 1500,
      temperature: 0.4,
    });
    const parsed = result.toolInput as { ingredients: unknown; steps: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch (err) {
    console.error(`  ✗ ${r.title.slice(0, 50)}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function processWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function pull() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => pull()));
  return out;
}

async function main() {
  const onlyMissing = !process.argv.includes("--all");
  console.log(`Mode: ${onlyMissing ? "only recipes missing ingredients/steps" : "all recipes (overwrite)"}`);

  const { data, error } = await admin
    .from("recipes")
    .select("id, title, description, time_min, meal_type, ingredients, steps")
    .order("title");
  if (error) {
    console.error("Failed to fetch recipes:", error.message);
    process.exit(1);
  }

  const all = (data ?? []) as RecipeRow[];
  const targets = onlyMissing
    ? all.filter((r) => isEmpty(r.ingredients) || isEmpty(r.steps))
    : all;

  console.log(`Found ${all.length} recipes total, ${targets.length} need bodies.`);
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let okCount = 0;
  let failCount = 0;
  const start = Date.now();

  await processWithConcurrency(
    targets,
    async (r, idx) => {
      const body = await generateOne(r);
      if (!body) {
        failCount++;
        return;
      }
      const { error: updErr } = await admin
        .from("recipes")
        .update({ ingredients: body.ingredients, steps: body.steps })
        .eq("id", r.id);
      if (updErr) {
        console.error(`  ✗ ${r.title.slice(0, 50)}: db update failed — ${updErr.message}`);
        failCount++;
        return;
      }
      okCount++;
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      const ing = Array.isArray(body.ingredients) ? body.ingredients.length : 0;
      const stp = Array.isArray(body.steps) ? body.steps.length : 0;
      console.log(
        `  [${idx + 1}/${targets.length} · ${elapsed}s] ✓ ${r.title.slice(0, 60)} (${ing} ing, ${stp} steps)`,
      );
    },
    4,
  );

  const totalMin = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\nDone in ${totalMin} min. OK: ${okCount} · Failed: ${failCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
