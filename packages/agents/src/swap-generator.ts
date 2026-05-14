import { z } from "zod";

export const PROMPT_VERSION = "swap_generator@2026-05-14-001";

export const SYSTEM_PROMPT = `You are the Real Food Win Swap Generator.

Real Food Win helps families replace ultra-processed food with real food. Given a junk-food product, you return a real-food alternative as a complete recipe — with nutrition, an ingredient analysis of the original product, and a short narrative that explains why this swap is better. You ALSO return 2–4 short "tuned for you" reasons that explicitly reference what about THIS user drove your choices (their allergies, household, time budget, skill level, top goal, prior wins/misses).

Rules:
- Use only real, whole-food ingredients. No additives, no ultra-processed ingredients.
- Respect every allergy in the user's profile and every household member's allergies. NEVER include an allergen.
- Match the user's weeknight_time budget when possible. If skill_level is "beginner," keep techniques simple.
- The narrative is 2–3 sentences, plain language, no medical claims. Do not say things like "fights inflammation" or "boosts immunity."
- Ingredient analysis: list the most concerning ingredients in the ORIGINAL product (high-fructose corn syrup, hydrogenated oils, artificial colors, etc.) with concern_level and a one-sentence plain-language explanation.
- "tuned_for_you_reasons" must reference SPECIFIC user context (e.g., "Your 6-year-old's tree-nut allergy — no nuts in this recipe" not "Allergen-friendly").
- If a household member is a kid, lean toward kid-friendly textures and flavors.
- If the user's top_goal is "lose-weight" or "reduce-inflammation," lean lower-sugar / lower-refined-carb.
- If you don't know the user's preferences, default to broadly appealing real-food versions.

Output ONLY via the generate_swap tool.`;

export const TOOL = {
  name: "generate_swap",
  description:
    "Return the personalized real-food swap with recipe, nutrition, ingredient analysis, narrative, and tuned-for-you reasons.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Name of the real-food alternative" },
      tagline: {
        type: "string",
        description: "One-line value prop (e.g., 'Same satisfying sweet, real ingredients')",
      },
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
      nutrition: {
        type: "object",
        properties: {
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          sugar_g: { type: "number" },
          sodium_mg: { type: "number" },
          fiber_g: { type: "number" },
        },
      },
      ingredient_analysis: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            concern_level: {
              type: "string",
              enum: ["fine", "low", "medium", "high"],
            },
            explanation: { type: "string" },
          },
          required: ["item", "concern_level", "explanation"],
        },
      },
      narrative: {
        type: "string",
        description:
          "Why this swap is better — 2-3 sentences, plain language, no medical claims",
      },
      tuned_for_you_reasons: {
        type: "array",
        items: { type: "string" },
        description:
          "2-4 short strings explaining what about THIS user drove the choices",
      },
    },
    required: ["title", "recipe", "narrative", "tuned_for_you_reasons"],
  },
} as const;

export const OutputSchema = z.object({
  title: z.string(),
  tagline: z.string().optional(),
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
  nutrition: z
    .object({
      calories: z.number().optional(),
      protein_g: z.number().optional(),
      carbs_g: z.number().optional(),
      fat_g: z.number().optional(),
      sugar_g: z.number().optional(),
      sodium_mg: z.number().optional(),
      fiber_g: z.number().optional(),
    })
    .optional(),
  ingredient_analysis: z
    .array(
      z.object({
        item: z.string(),
        concern_level: z.enum(["fine", "low", "medium", "high"]),
        explanation: z.string(),
      }),
    )
    .optional(),
  narrative: z.string(),
  tuned_for_you_reasons: z.array(z.string()).min(2).max(4),
});

export type SwapGeneratorOutput = z.infer<typeof OutputSchema>;
