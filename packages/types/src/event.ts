import { z } from 'zod';

/**
 * Behavioral event types. The `events` table is append-only.
 * Covers both passive signals (viewed_swap, copied) and active touchpoints
 * (made_it_loved / made_it_not_for_me).
 */
export const EventTypeSchema = z.enum([
  'viewed_swap',
  'saved_recipe',
  'made_it_loved',
  'made_it_not_for_me',
  'iterated_recipe',
  'shared',
  'copied',
  'regenerated',
  'dismissed',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Which client emitted the event.
 */
export const ClientPlatformSchema = z.enum(['ios', 'android', 'web']);
export type ClientPlatform = z.infer<typeof ClientPlatformSchema>;

/**
 * What the event refers to. Kept open-ended (string) so we can add target
 * types without a migration, but the common values are documented in code.
 *
 * Common values: 'swap' | 'recipe' | 'variant' | 'recipe_box_entry' | 'product'
 */
export const EventTargetTypeSchema = z.string().min(1);
export type EventTargetType = z.infer<typeof EventTargetTypeSchema>;

/**
 * Event — mirrors the `events` table. APPEND-ONLY.
 */
export const EventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_type: EventTypeSchema,
  target_type: EventTargetTypeSchema,
  /** UUID of the target row (swap/recipe/variant/etc). */
  target_id: z.string().uuid(),
  /**
   * Open-ended JSON metadata. For example: `made_it_not_for_me` may carry a
   * `reason` string; `iterated_recipe` may carry the modification request.
   */
  metadata: z.record(z.unknown()).default({}),
  client_platform: ClientPlatformSchema,
  created_at: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

/**
 * Shape for inserting a new event (no id / created_at yet).
 */
export const EventInsertSchema = EventSchema.omit({
  id: true,
  created_at: true,
}).extend({
  metadata: z.record(z.unknown()).optional(),
});
export type EventInsert = z.infer<typeof EventInsertSchema>;
