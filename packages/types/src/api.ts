import { z } from 'zod';
import { ClientPlatformSchema } from './event.js';
import {
  HouseholdMemberProfileSchema,
  QuizAnswerSchema,
  QuizAnswersSchema,
  UserProfileSchema,
} from './profile.js';
import { RecipeVariantSchema } from './recipe.js';
import { ProductSchema, SwapSchema } from './swap.js';

/* -------------------------------------------------------------------------- */
/* Envelope                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Rate limit info — reserved for future use. The free-tier counter is
 * 5 total + 1/day for anonymous users (spec 4.1); this struct lets the
 * client display remaining quota.
 */
export const RateLimitInfoSchema = z.object({
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  /** Unix epoch seconds when the window resets. */
  reset_at: z.number().int().nonnegative(),
  /** Optional bucket identifier (e.g. 'anonymous_daily', 'anonymous_total'). */
  bucket: z.string().optional(),
});
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

/**
 * Standard success envelope. Generic over the payload type.
 *
 * NOTE: we keep `ApiSuccess` as a type-only wrapper because Zod can't
 * generically infer payload schemas without a factory call. Call
 * `apiSuccess(schema)` to get a runtime validator for a specific endpoint.
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
  rate_limit?: RateLimitInfo;
}

/**
 * Standard error envelope.
 *
 * `code` is intentionally an open string (with a recommended set) so we can
 * add error codes without a coordinated client/server release. Clients should
 * branch on `code` for known cases and fall back to `message` for display.
 *
 * Recommended codes:
 *   - 'unauthenticated' | 'forbidden'
 *   - 'rate_limited'
 *   - 'not_found'
 *   - 'validation_error'
 *   - 'barcode_unresolved'
 *   - 'agent_failed'
 *   - 'internal_error'
 */
export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  code: z.string().min(1),
  message: z.string().min(1),
  /** Optional per-field validation issues (Zod-style flattened). */
  fields: z.record(z.array(z.string())).optional(),
  /** Optional rate-limit context (e.g. when code === 'rate_limited'). */
  rate_limit: RateLimitInfoSchema.optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Factory: builds a Zod schema for an `ApiSuccess<T>` given the payload schema.
 * Use at the API boundary to validate responses on the client.
 */
export const apiSuccess = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    ok: z.literal(true),
    data: payload,
    rate_limit: RateLimitInfoSchema.optional(),
  });

/* -------------------------------------------------------------------------- */
/* /api/scan                                                                  */
/* -------------------------------------------------------------------------- */

export const ScanRequestSchema = z.object({
  barcode: z.string().min(1),
  client_platform: ClientPlatformSchema,
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const ScanResponseDataSchema = z.object({
  product: ProductSchema,
  /** Populated when the Gateway returned a personalized swap inline. */
  swap: SwapSchema.nullable().default(null),
});
export type ScanResponseData = z.infer<typeof ScanResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/* /api/swap                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Triggered by text search ("Snickers") or by an explicit regenerate.
 * Exactly one of `product_id` or `query` must be provided.
 */
export const SwapRequestSchema = z.union([
  z.object({
    product_id: z.string().uuid(),
    client_platform: ClientPlatformSchema,
    /** Force a fresh generation, bypassing the swap cache. */
    regenerate: z.boolean().optional().default(false),
  }),
  z.object({
    query: z.string().min(1),
    client_platform: ClientPlatformSchema,
    regenerate: z.boolean().optional().default(false),
  }),
]);
export type SwapRequest = z.infer<typeof SwapRequestSchema>;

export const SwapResponseDataSchema = z.object({
  swap: SwapSchema,
});
export type SwapResponseData = z.infer<typeof SwapResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/* /api/iterate                                                               */
/* -------------------------------------------------------------------------- */

export const IterateRequestSchema = z.object({
  parent_recipe_id: z.string().uuid(),
  modification: z.string().min(1),
  client_platform: ClientPlatformSchema,
});
export type IterateRequest = z.infer<typeof IterateRequestSchema>;

export const IterateResponseDataSchema = z.object({
  variant: RecipeVariantSchema,
});
export type IterateResponseData = z.infer<typeof IterateResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/* /api/quiz                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Posted once per quiz screen (resumable mid-flow — spec 4.1).
 */
export const QuizSubmitRequestSchema = z.object({
  answer: QuizAnswerSchema,
  client_platform: ClientPlatformSchema,
});
export type QuizSubmitRequest = z.infer<typeof QuizSubmitRequestSchema>;

export const QuizSubmitResponseDataSchema = z.object({
  profile: UserProfileSchema,
  /** Indicates the quiz finished and a personalized regeneration is ready. */
  completed: z.boolean(),
});
export type QuizSubmitResponseData = z.infer<typeof QuizSubmitResponseDataSchema>;

/**
 * GET /api/quiz — returns the current state of the quiz for resumable flow.
 */
export const QuizStateResponseDataSchema = z.object({
  profile: UserProfileSchema,
  answers: QuizAnswersSchema,
});
export type QuizStateResponseData = z.infer<typeof QuizStateResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/* /api/kitchen                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Save to My Kitchen. Exactly one of recipe_id / swap_id / variant_id is set.
 */
export const KitchenSaveRequestSchema = z
  .object({
    recipe_id: z.string().uuid().optional(),
    swap_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    client_platform: ClientPlatformSchema,
  })
  .refine(
    (v) =>
      [v.recipe_id, v.swap_id, v.variant_id].filter(Boolean).length === 1,
    {
      message: 'Provide exactly one of recipe_id, swap_id, or variant_id',
    },
  );
export type KitchenSaveRequest = z.infer<typeof KitchenSaveRequestSchema>;

export const RecipeBoxEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  recipe_id: z.string().uuid().nullable().default(null),
  swap_id: z.string().uuid().nullable().default(null),
  variant_id: z.string().uuid().nullable().default(null),
  saved_at: z.string().datetime(),
  notes: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
});
export type RecipeBoxEntry = z.infer<typeof RecipeBoxEntrySchema>;

export const KitchenSaveResponseDataSchema = z.object({
  entry: RecipeBoxEntrySchema,
});
export type KitchenSaveResponseData = z.infer<typeof KitchenSaveResponseDataSchema>;

/* -------------------------------------------------------------------------- */
/* /api/household                                                             */
/* -------------------------------------------------------------------------- */

export const HouseholdMemberUpsertRequestSchema = z.object({
  /** Omit for create; provide for update. */
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  age_range: HouseholdMemberProfileSchema.shape.age_range,
  allergies: HouseholdMemberProfileSchema.shape.allergies,
  avoids: HouseholdMemberProfileSchema.shape.avoids,
  notes: HouseholdMemberProfileSchema.shape.notes,
});
export type HouseholdMemberUpsertRequest = z.infer<
  typeof HouseholdMemberUpsertRequestSchema
>;

export const HouseholdMembersResponseDataSchema = z.object({
  members: z.array(HouseholdMemberProfileSchema),
});
export type HouseholdMembersResponseData = z.infer<
  typeof HouseholdMembersResponseDataSchema
>;

/* -------------------------------------------------------------------------- */
/* /api/events                                                                */
/* -------------------------------------------------------------------------- */

export const EventLogRequestSchema = z.object({
  event_type: z.string().min(1),
  target_type: z.string().min(1),
  target_id: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
  client_platform: ClientPlatformSchema,
});
export type EventLogRequest = z.infer<typeof EventLogRequestSchema>;

export const EventLogResponseDataSchema = z.object({
  id: z.string().uuid(),
});
export type EventLogResponseData = z.infer<typeof EventLogResponseDataSchema>;
