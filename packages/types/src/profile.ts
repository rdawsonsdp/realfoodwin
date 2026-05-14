import { z } from 'zod';

/**
 * Dietary patterns the user can follow.
 * Per spec 4.1 question 1 — multi-select; 'none' is a valid choice (not an empty array).
 */
export const DietaryPatternSchema = z.enum([
  'none',
  'gluten-free',
  'dairy-free',
  'vegetarian',
  'vegan',
  'paleo',
  'keto',
  'low-sugar',
]);
export type DietaryPattern = z.infer<typeof DietaryPatternSchema>;

/**
 * Allergies / hard avoids.
 * Per spec 4.1 question 2 — multi-select, REQUIRED (cannot skip for safety).
 * 'other' is paired with a free-text field captured in QuizAnswers / UserProfile.
 */
export const AllergySchema = z.enum([
  'peanut',
  'tree-nuts',
  'dairy',
  'eggs',
  'soy',
  'shellfish',
  'gluten',
  'other',
]);
export type Allergy = z.infer<typeof AllergySchema>;

/**
 * Top goal the user is trying to achieve. Single-select.
 */
export const TopGoalSchema = z.enum([
  'more-energy',
  'lose-weight',
  'feed-kids-better',
  'reduce-inflammation',
  'get-off-ultra-processed',
  'just-curious',
]);
export type TopGoal = z.infer<typeof TopGoalSchema>;

/**
 * Weeknight cooking time bucket.
 */
export const WeeknightTimeSchema = z.enum(['15', '30', '45+']);
export type WeeknightTime = z.infer<typeof WeeknightTimeSchema>;

/**
 * Self-reported cooking skill.
 */
export const SkillLevelSchema = z.enum(['beginner', 'comfortable', 'confident']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

/**
 * Age range bucket for a child / household member.
 */
export const AgeRangeSchema = z.enum(['toddler', 'kid', 'teen']);
export type AgeRange = z.infer<typeof AgeRangeSchema>;

/**
 * Household composition shape.
 */
export const HouseholdCompositionSchema = z.enum([
  'just-me',
  'me-plus-partner',
  'family-with-kids',
]);
export type HouseholdComposition = z.infer<typeof HouseholdCompositionSchema>;

/**
 * Household member profile.
 * Mirrors the `household_member_profiles` table.
 * In v1 these are informational only (no auth).
 */
export const HouseholdMemberProfileSchema = z.object({
  id: z.string().uuid(),
  household_id: z.string().uuid(),
  name: z.string().min(1),
  age_range: AgeRangeSchema.nullable(),
  allergies: z.array(AllergySchema).default([]),
  /** Free-text "avoids" — soft preferences, not safety-critical allergies. */
  avoids: z.array(z.string()).default([]),
  /** Free-text description for the agent to use, e.g. "picky about texture". */
  notes: z.string().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type HouseholdMemberProfile = z.infer<typeof HouseholdMemberProfileSchema>;

/**
 * The kids sub-block on the household question. Only present when
 * household_composition === 'family-with-kids'.
 */
export const KidsBlockSchema = z.object({
  count: z.number().int().min(1).max(20),
  age_ranges: z.array(AgeRangeSchema).min(1),
});
export type KidsBlock = z.infer<typeof KidsBlockSchema>;

/**
 * UserProfile — mirrors the `user_profiles` table.
 * snake_case wire format matches the database columns.
 */
export const UserProfileSchema = z.object({
  user_id: z.string().uuid(),
  household_id: z.string().uuid(),

  // Question 1
  dietary_pattern: z.array(DietaryPatternSchema).default([]),

  // Question 2 (required)
  allergies: z.array(AllergySchema).default([]),
  /** Free-text companion when 'other' is selected in allergies. */
  allergies_other: z.string().nullable().default(null),

  // Question 3
  household_composition: HouseholdCompositionSchema.nullable().default(null),
  kids: KidsBlockSchema.nullable().default(null),

  // Question 4
  top_goal: TopGoalSchema.nullable().default(null),

  // Question 5
  weeknight_time: WeeknightTimeSchema.nullable().default(null),
  skill_level: SkillLevelSchema.nullable().default(null),

  /** Quiz progress — true once all skippable steps have been seen and allergies answered. */
  quiz_completed: z.boolean().default(false),
  /** The last quiz step the user reached (1-5); supports resumable flow. */
  quiz_last_step: z.number().int().min(0).max(5).default(0),

  /**
   * Flexible bag of extra profile fields — used for things the agent infers
   * over time (e.g., "avoids cilantro", "prefers sheet-pan meals"). JSON column.
   */
  extras: z.record(z.unknown()).default({}),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

/* -------------------------------------------------------------------------- */
/* Quiz answers — discriminated union per step                                */
/* -------------------------------------------------------------------------- */

/**
 * Each step of the quiz produces one of these answer payloads.
 * The `step` discriminator drives the union; this is what mobile/web POST
 * to the quiz endpoint one screen at a time.
 *
 * Step 2 (allergies) is the only step that cannot be skipped.
 */
export const QuizAnswerStep1Schema = z.object({
  step: z.literal(1),
  skipped: z.boolean().default(false),
  dietary_pattern: z.array(DietaryPatternSchema).default([]),
});

export const QuizAnswerStep2Schema = z.object({
  step: z.literal(2),
  /** Required — cannot be skipped per spec 4.1. */
  skipped: z.literal(false).default(false),
  allergies: z.array(AllergySchema),
  allergies_other: z.string().nullable().default(null),
});

export const QuizAnswerStep3Schema = z.object({
  step: z.literal(3),
  skipped: z.boolean().default(false),
  household_composition: HouseholdCompositionSchema.nullable().default(null),
  kids: KidsBlockSchema.nullable().default(null),
});

export const QuizAnswerStep4Schema = z.object({
  step: z.literal(4),
  skipped: z.boolean().default(false),
  top_goal: TopGoalSchema.nullable().default(null),
});

export const QuizAnswerStep5Schema = z.object({
  step: z.literal(5),
  skipped: z.boolean().default(false),
  weeknight_time: WeeknightTimeSchema.nullable().default(null),
  skill_level: SkillLevelSchema.nullable().default(null),
});

export const QuizAnswerSchema = z.discriminatedUnion('step', [
  QuizAnswerStep1Schema,
  QuizAnswerStep2Schema,
  QuizAnswerStep3Schema,
  QuizAnswerStep4Schema,
  QuizAnswerStep5Schema,
]);
export type QuizAnswer = z.infer<typeof QuizAnswerSchema>;

/**
 * The aggregated bag of quiz answers — what the agent sees once the user
 * has completed (or partially completed) the flow.
 */
export const QuizAnswersSchema = z.object({
  step_1: QuizAnswerStep1Schema.optional(),
  step_2: QuizAnswerStep2Schema.optional(),
  step_3: QuizAnswerStep3Schema.optional(),
  step_4: QuizAnswerStep4Schema.optional(),
  step_5: QuizAnswerStep5Schema.optional(),
});
export type QuizAnswers = z.infer<typeof QuizAnswersSchema>;
