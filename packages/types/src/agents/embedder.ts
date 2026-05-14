import { z } from 'zod';

/**
 * Voyage embedding dimensionality. Locked at 1024 to match the
 * pgvector column definition in the `embeddings` and `user_summaries` tables.
 */
export const EMBEDDING_DIM = 1024 as const;

/**
 * Source types that can be embedded. Strings match the values stored in
 * `embeddings.source_type`.
 */
export const EmbeddingSourceTypeSchema = z.enum([
  'user_profile',
  'user_summary',
  'recipe_box_entry',
  'made_it_event',
  'not_for_me_event',
  'community_caption',
  'canonical_swap',
  'recipe_library',
]);
export type EmbeddingSourceType = z.infer<typeof EmbeddingSourceTypeSchema>;

/**
 * Input to the Embedder agent.
 */
export const EmbedderInputSchema = z.object({
  text: z.string().min(1),
  source_type: EmbeddingSourceTypeSchema,
  source_id: z.string().uuid(),
  user_id: z.string().uuid().nullable().default(null),
  household_id: z.string().uuid().nullable().default(null),
});
export type EmbedderInput = z.infer<typeof EmbedderInputSchema>;

/**
 * Output of the Embedder agent. The vector length is enforced at 1024 to
 * match the pgvector column.
 */
export const EmbedderOutputSchema = z.object({
  vector: z.array(z.number()).length(EMBEDDING_DIM),
});
export type EmbedderOutput = z.infer<typeof EmbedderOutputSchema>;
