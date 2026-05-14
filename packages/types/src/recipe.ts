import { z } from 'zod';

/**
 * Meal type for organizing the recipe box.
 */
export const MealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'drink',
  'side',
  'other',
]);
export type MealType = z.infer<typeof MealTypeSchema>;

/**
 * Recipe difficulty bucket.
 */
export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof DifficultySchema>;

/**
 * A single ingredient line.
 * Free-form quantity + unit to keep parsing flexible (Sonnet may emit "to taste",
 * "1-2", etc.) while still being machine-readable.
 */
export const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().nullable().default(null),
  unit: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

/**
 * A single step in the recipe.
 */
export const RecipeStepSchema = z.object({
  order: z.number().int().min(1),
  instruction: z.string().min(1),
  /** Optional timer hint in seconds — fuels in-recipe timers on mobile. */
  timer_seconds: z.number().int().min(0).nullable().default(null),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

/**
 * Nutrition facts.
 * All fields optional because Sonnet may not emit every value; sources vary.
 */
export const NutritionFactsSchema = z.object({
  calories: z.number().nonnegative().optional(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  sugar_g: z.number().nonnegative().optional(),
  sodium_mg: z.number().nonnegative().optional(),
  fiber_g: z.number().nonnegative().optional(),
  /** Optional per-serving label, e.g. "per cookie" / "per cup". */
  serving_label: z.string().optional(),
  servings: z.number().positive().optional(),
});
export type NutritionFacts = z.infer<typeof NutritionFactsSchema>;

/**
 * Recipe — mirrors the `recipes` table.
 * This is the canonical recipe shape used by both library recipes and the
 * inline recipe block on a `swap` (which is embedded as JSON on the swap row).
 */
export const RecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  ingredients: z.array(IngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).default([]),
  nutrition: NutritionFactsSchema.nullable().default(null),
  time_min: z.number().int().nonnegative().nullable().default(null),
  difficulty: DifficultySchema.nullable().default(null),
  meal_type: MealTypeSchema.nullable().default(null),
  tags: z.array(z.string()).default([]),
  /** Free-text source attribution, e.g. "Real Food Win" or imported origin. */
  source: z.string().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

/**
 * Lightweight inline recipe shape used inside `swaps.recipe` JSON.
 * Same as Recipe but without DB-only metadata (id, timestamps).
 */
export const InlineRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  ingredients: z.array(IngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).default([]),
  time_min: z.number().int().nonnegative().nullable().default(null),
  difficulty: DifficultySchema.nullable().default(null),
  meal_type: MealTypeSchema.nullable().default(null),
  tags: z.array(z.string()).default([]),
  servings: z.number().positive().nullable().default(null),
});
export type InlineRecipe = z.infer<typeof InlineRecipeSchema>;

/**
 * Recipe variant — produced by the Recipe Iterator agent.
 * Mirrors the `recipe_variants` table.
 */
export const RecipeVariantSchema = z.object({
  id: z.string().uuid(),
  parent_recipe_id: z.string().uuid(),
  user_id: z.string().uuid(),
  /** Free-text modification request, e.g. "make this dairy-free". */
  modification: z.string().min(1),
  recipe: InlineRecipeSchema,
  /** Short bullets describing what changed from the parent. */
  change_summary: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
});
export type RecipeVariant = z.infer<typeof RecipeVariantSchema>;
