import { z } from 'zod';
import { InlineRecipeSchema, NutritionFactsSchema } from './recipe.js';

/**
 * Source of a product record in the `products` table.
 */
export const ProductSourceSchema = z.enum(['open_food_facts', 'sonnet', 'manual']);
export type ProductSource = z.infer<typeof ProductSourceSchema>;

/**
 * Product — mirrors the `products` table.
 * The `products` table is the barcode resolution cache.
 */
export const ProductSchema = z.object({
  id: z.string().uuid(),
  /** Nullable: products typed in by hand may not have a barcode. */
  barcode: z.string().nullable().default(null),
  name: z.string().min(1),
  brand: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  /**
   * Canonical list of ingredients as printed on the label (or Sonnet's best
   * reconstruction). Plain strings; not the structured `Ingredient` shape used
   * for recipes.
   */
  canonical_ingredients: z.array(z.string()).default([]),
  nutrition_facts: NutritionFactsSchema.nullable().default(null),
  source: ProductSourceSchema,
  /**
   * 0..1 confidence in this record. Used to flag Sonnet-resolved products
   * for human review (Phase 2 admin dashboard).
   */
  confidence: z.number().min(0).max(1).default(1),
  last_refreshed: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

/**
 * Concern level for a single ingredient in the source product.
 * 'fine' means actively OK (a positive signal to surface to the user).
 */
export const ConcernLevelSchema = z.enum(['high', 'medium', 'low', 'fine']);
export type ConcernLevel = z.infer<typeof ConcernLevelSchema>;

/**
 * Per-ingredient analysis emitted by the Swap Generator.
 */
export const IngredientAnalysisSchema = z.object({
  item: z.string().min(1),
  concern_level: ConcernLevelSchema,
  explanation: z.string().min(1),
});
export type IngredientAnalysis = z.infer<typeof IngredientAnalysisSchema>;

/**
 * Nutrition comparison shown on the swap result page.
 * Keeps both sides plus a flat diff that the UI can render without recomputing.
 */
export const SwapNutritionSchema = z.object({
  original: NutritionFactsSchema.nullable().default(null),
  swap: NutritionFactsSchema.nullable().default(null),
  /**
   * Highlight bullets the UI can show ("60% less sugar", "3x more fiber").
   * Sonnet emits these so the math + framing stay in one place.
   */
  highlights: z.array(z.string()).default([]),
});
export type SwapNutrition = z.infer<typeof SwapNutritionSchema>;

/**
 * Swap — mirrors the `swaps` table.
 *
 * - `user_id` is nullable: anonymous/canonical swaps live in this table too.
 * - `base_swap_id` is nullable: when present, this is the personalized variant
 *   of an existing canonical swap (cache key for the Gateway).
 */
export const SwapSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  user_id: z.string().uuid().nullable().default(null),
  base_swap_id: z.string().uuid().nullable().default(null),

  recipe: InlineRecipeSchema,
  nutrition: SwapNutritionSchema,
  /** The "why this is better" paragraph shown above the recipe. */
  narrative: z.string().min(1),
  ingredient_analysis: z.array(IngredientAnalysisSchema).default([]),

  /**
   * 2-4 short strings explaining which parts of the user's profile drove
   * the personalization. Populates the "Tuned for you" affordance.
   * Empty for canonical (un-personalized) swaps.
   */
  tuned_for_you_reasons: z.array(z.string()).default([]),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Swap = z.infer<typeof SwapSchema>;
