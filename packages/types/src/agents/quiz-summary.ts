import { z } from 'zod';
import { QuizAnswersSchema } from '../profile.js';

/**
 * Input to the Quiz Summary agent.
 *
 * Runs once at the end of the quiz to turn the structured answers into a
 * short narrative the user (and downstream agents) can read back. The
 * narrative also seeds the user_summaries table before the first nightly
 * job ever runs.
 */
export const QuizSummaryInputSchema = z.object({
  user_id: z.string().uuid(),
  household_id: z.string().uuid(),
  answers: QuizAnswersSchema,
});
export type QuizSummaryInput = z.infer<typeof QuizSummaryInputSchema>;

/**
 * Output of the Quiz Summary agent.
 */
export const QuizSummaryOutputSchema = z.object({
  /** ~150-word narrative paragraph. */
  narrative: z.string().min(1),
  /**
   * "We learned" bullets — short, first-person, surfaced post-quiz so the
   * user feels seen. Typically 3-6 items.
   */
  we_learned: z.array(z.string().min(1)).min(2).max(8),
});
export type QuizSummaryOutput = z.infer<typeof QuizSummaryOutputSchema>;
