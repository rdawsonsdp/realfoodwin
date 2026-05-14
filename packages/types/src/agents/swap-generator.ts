import { z } from 'zod';
import {
  HouseholdMemberProfileSchema,
  UserProfileSchema,
} from '../profile.js';
import { ProductSchema } from '../swap.js';
import {
  IngredientAnalysisSchema,
  SwapNutritionSchema,
} from '../swap.js';
import { InlineRecipeSchema } from '../recipe.js';

/**
 * Lightweight RAG hit injected into every Sonnet prompt.
 * The Gateway pulls these from pgvector; agents don't query directly.
 */
export const RagHitSchema = z.object({
  source_type: z.string().min(1),
  source_id: z.string().uuid(),
  summary: z.string().min(1),
  /** Similarity score (0..1) used for debugging / ordering. */
  score: z.number().min(0).max(1).optional(),
});
export type RagHit = z.infer<typeof RagHitSchema>;

/**
 * Input to the Swap Generator agent.
 *
 * The Gateway is responsible for populating profile / summary / RAG fields
 * before invoking the agent; agents are pure functions over this struct.
 */
export const SwapGeneratorInputSchema = z.object({
  user_id: z.string().uuid().nullable(),
  household_id: z.string().uuid().nullable(),

  /** The product we are swapping away from. */
  product: ProductSchema,

  /** Null for anonymous swaps. */
  user_profile: UserProfileSchema.nullable(),

  /** Other household members the agent should consider (allergies, ages). */
  household_members: z.array(HouseholdMemberProfileSchema).default([]),

  /** ~150-word narrative from the nightly summary job. Null on cold start. */
  user_summary: z.string().nullable(),

  recent_wins: z.array(RagHitSchema).default([]),
  recent_misses: z.array(RagHitSchema).default([]),
  similar_saved: z.array(RagHitSchema).default([]),
});
export type SwapGeneratorInput = z.infer<typeof SwapGeneratorInputSchema>;

/**
 * Output of the Swap Generator agent — this is the structured tool-use
 * payload Sonnet returns. The Gateway persists it to the `swaps` table.
 */
export const SwapGeneratorOutputSchema = z.object({
  recipe: InlineRecipeSchema,
  nutrition: SwapNutritionSchema,
  ingredient_analysis: z.array(IngredientAnalysisSchema).default([]),
  /** The "why this is better" paragraph shown above the recipe. */
  narrative: z.string().min(1),
  /**
   * 2-4 short bullets that explain which parts of the user's profile drove
   * the personalization. Populates the "Tuned for you" affordance.
   */
  tuned_for_you_reasons: z.array(z.string().min(1)).min(2).max(4),
});
export type SwapGeneratorOutput = z.infer<typeof SwapGeneratorOutputSchema>;
