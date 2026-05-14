import { z } from "zod";

export const PROMPT_VERSION = "recipe_iterator@2026-05-14-001";

export const SYSTEM_PROMPT = `You are the Real Food Win Recipe Iterator.

You take an existing real-food recipe and a modification request from the user, and return a modified recipe that honors the request while staying within Real Food Win's principles (real ingredients only, no ultra-processed substitutes, respects allergies). The modified recipe is a VARIANT — keep the spirit of the parent recipe.

Common modification patterns:
- "make this dairy-free" → swap dairy for plausible whole-food alternatives (coconut milk, cashew cream, tahini)
- "scale to N" → recompute ingredient quantities
- "make it faster" → simplify steps, parallelize, or substitute quick-cook ingredients
- "make it kid-friendlier" → reduce spice, soften textures, lean familiar
- "use what I have" → adapt around the user's listed ingredients
- free-text → interpret broadly; if you can't honor the request without going non-real-food, return your best interpretation and explain in change_summary

Rules:
- NEVER include an allergen from the user's profile or any household member.
- Keep instructions clear and tight. Beginners should be able to follow.
- "change_summary" must be 2–5 bullets describing exactly what changed and why.
- If the request would require ultra-processed ingredients (e.g., "make it like the box mix"), politely decline in change_summary and offer the closest real-food version.

Output ONLY via the iterate_recipe tool.`;

export const TOOL = {
  name: "iterate_recipe",
  description: "Return the modified recipe and a change summary.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      recipe: {
        type: "object",
        properties: {
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "string" },
                unit: { type: "string" },
              },
              required: ["name", "quantity"],
            },
          },
          steps: { type: "array", items: { type: "string" } },
          time_min: { type: "number" },
          difficulty: {
            type: "string",
            enum: ["beginner", "comfortable", "confident"],
          },
          meal_type: { type: "string" },
        },
        required: ["ingredients", "steps", "time_min"],
      },
      change_summary: {
        type: "array",
        items: { type: "string" },
        description: "2-5 bullets describing what changed and why",
      },
    },
    required: ["title", "recipe", "change_summary"],
  },
} as const;

export const OutputSchema = z.object({
  title: z.string(),
  recipe: z.object({
    ingredients: z.array(
      z.object({
        name: z.string(),
        quantity: z.string(),
        unit: z.string().optional(),
      }),
    ),
    steps: z.array(z.string()),
    time_min: z.number(),
    difficulty: z.enum(["beginner", "comfortable", "confident"]).optional(),
    meal_type: z.string().optional(),
  }),
  change_summary: z.array(z.string()).min(1).max(8),
});

export type RecipeIteratorOutput = z.infer<typeof OutputSchema>;
