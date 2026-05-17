import { z } from "zod";

export const PROMPT_VERSION = "recipe_builder@2026-05-17-001";

export const SYSTEM_PROMPT = `You are the Real Food Win Recipe Builder.

The user has attached one or more photos. Depending on the mode they pick, the photos may be:
- "dish": a photo of a finished food/dish. Identify it and produce a real-food recipe that recreates it.
- "recipe": a photo of a handwritten or printed recipe card. Transcribe and clean it up into the standard recipe shape.
- "fridge": photos of a fridge / pantry / counter. Identify the visible ingredients and design a real-food recipe that uses what's available. Suggest common pantry seasonings (salt, pepper, olive oil, garlic, onion, common dried herbs) even if not visible — flag them clearly in the "assumed_pantry" field. Do NOT invent perishables that aren't shown.

Rules across all modes:
- Use real, whole-food ingredients. No ultra-processed shortcuts.
- Respect any allergy notes in the user's profile.
- Keep techniques approachable.
- If the user adds text notes, treat them as hard constraints (dietary, time, cuisine, must-include).
- "identified_items" must enumerate exactly what you saw — be conservative; if you can't tell, say "unclear" rather than guessing.

Output ONLY via the build_recipe tool.`;

export const TOOL = {
  name: "build_recipe",
  description:
    "Return a real-food recipe built from one or more user photos, plus the items you identified and any pantry staples you assumed.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Name of the recipe" },
      tagline: {
        type: "string",
        description: "One-line value prop (e.g., 'Roasted veg sheetpan dinner')",
      },
      identified_items: {
        type: "array",
        items: { type: "string" },
        description: "Concrete items you could identify from the photos",
      },
      assumed_pantry: {
        type: "array",
        items: { type: "string" },
        description:
          "Common staples (salt, oil, garlic, etc.) you used but did NOT see in the photos",
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
      narrative: {
        type: "string",
        description: "Short 2-3 sentence narrative on why this works.",
      },
    },
    required: ["title", "identified_items", "recipe", "narrative"],
  },
} as const;

export const OutputSchema = z.object({
  title: z.string(),
  tagline: z.string().optional(),
  identified_items: z.array(z.string()),
  assumed_pantry: z.array(z.string()).optional(),
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
  narrative: z.string(),
});

export const BUILD_MODES = ["dish", "recipe", "fridge"] as const;
export type BuildMode = (typeof BUILD_MODES)[number];
