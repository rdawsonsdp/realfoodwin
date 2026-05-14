import { z } from 'zod';
import { InlineRecipeSchema } from '../recipe.js';
import {
  HouseholdMemberProfileSchema,
  UserProfileSchema,
} from '../profile.js';
import { RagHitSchema } from './swap-generator.js';

/**
 * Input to the Recipe Iterator agent.
 *
 * `parent_recipe` is what the user is iterating on (could be from a swap,
 * a library recipe, or another variant). `modification` is the natural
 * language change request — either a chip choice ("make this dairy-free")
 * or a free-text input from the "Modify..." sheet.
 */
export const RecipeIteratorInputSchema = z.object({
  user_id: z.string().uuid(),
  household_id: z.string().uuid(),

  parent_recipe_id: z.string().uuid(),
  parent_recipe: InlineRecipeSchema,

  modification: z.string().min(1),

  user_profile: UserProfileSchema.nullable(),
  household_members: z.array(HouseholdMemberProfileSchema).default([]),
  user_summary: z.string().nullable(),

  recent_wins: z.array(RagHitSchema).default([]),
  recent_misses: z.array(RagHitSchema).default([]),
});
export type RecipeIteratorInput = z.infer<typeof RecipeIteratorInputSchema>;

/**
 * Output of the Recipe Iterator agent.
 */
export const RecipeIteratorOutputSchema = z.object({
  recipe: InlineRecipeSchema,
  /**
   * Short bullets describing what changed from the parent.
   * Surfaced in the UI ("Swapped butter for olive oil", "Cut total time to 22 min").
   */
  change_summary: z.array(z.string().min(1)).min(1).max(8),
});
export type RecipeIteratorOutput = z.infer<typeof RecipeIteratorOutputSchema>;
