import { z } from "zod";

export const PROMPT_VERSION = "swap_generator@2026-05-29-001";

// Visual-marker taxonomy. The agent emits ZERO OR MORE keys from each list
// for every swap. The UI turns each key into an emoji-labeled pill so the
// "why this is bad / why this is good" story reads visually first.
//
// BAD markers describe the ORIGINAL ultra-processed product the user is
// trying to replace (rendered in coral). GOOD markers describe the
// real-food swap (rendered in sage). Both lists are closed enums — the
// agent must only use these keys so the UI knows how to render each one.
export const BAD_MARKERS = [
  "seed_oils",
  "hfcs",
  "refined_sugar",
  "artificial_colors",
  "artificial_flavors",
  "artificial_sweeteners",
  "msg",
  "hydrogenated_oils",
  "synthetic_preservatives",
  "fried",
  "ultra_processed",
  "gmo",
] as const;

export const GOOD_MARKERS = [
  "whole_food",
  "no_seed_oils",
  "no_added_sugar",
  "no_artificial_anything",
  "organic",
  "grass_fed",
  "high_protein",
  "high_fiber",
  "made_fresh",
  "low_sugar",
  "dairy_free",
  "gluten_free",
] as const;

export type BadMarker = (typeof BAD_MARKERS)[number];
export type GoodMarker = (typeof GOOD_MARKERS)[number];

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
- If the user's preferences say their goal is "a real-food product they can buy" (and not a recipe), DO NOT invent a recipe. Instead, recommend a single real-food packaged product:
    - Set "title" to the exact product name (brand + product).
    - Fill product_url with a direct link to that product on the brand's own site (no marketplaces).
    - Fill brand_name with the brand.
    - Fill product_image_url with a direct image of the product if you know one, otherwise leave it null.
    - In this case the recipe should be an empty placeholder ({ "ingredients": [], "steps": [], "time_min": 0 }).
    - tagline can summarize the product in one short line.
- ALWAYS include 2-3 alternates in the "alternates" field. Each alternate is a genuinely different swap — different cuisine, different protein, different format, different cook time. These should NOT repeat the primary or each other. Keep them light: just a title, tagline, narrative, and (for product mode) product_url + brand_name; or (for recipe mode) a short recipe with ingredients + steps. The user will rotate through these without us re-querying.
- If you received a "User said:" feedback note about a previous swap, treat it as a hard constraint when picking BOTH the primary and the alternates.

Visual markers (bad_markers, good_markers): the UI renders these as colored emoji pills so the user can read the story at a glance. Emit ONLY keys from these closed taxonomies:

bad_markers (describe what's WRONG with the ORIGINAL ultra-processed product the user is swapping FROM — coral pills):
  seed_oils              - contains canola, soy, sunflower, safflower, cottonseed, rapeseed, or corn oil
  hfcs                   - contains high-fructose corn syrup
  refined_sugar          - significant added refined sugar (cane sugar, dextrose, etc.)
  artificial_colors      - contains FD&C colors (Red 40, Yellow 5, etc.)
  artificial_flavors     - contains "natural flavor" or "artificial flavor" additives
  artificial_sweeteners  - contains aspartame, sucralose, ace-K, saccharin
  msg                    - contains monosodium glutamate or hidden MSG (autolyzed yeast, etc.)
  hydrogenated_oils      - contains hydrogenated or partially-hydrogenated oils (trans fat)
  synthetic_preservatives- contains BHT, BHA, sodium benzoate, TBHQ, calcium propionate
  fried                  - deep-fried or pan-fried in seed oil
  ultra_processed        - NOVA classification 4 (made primarily of extracted/refined ingredients)
  gmo                    - likely contains GMO ingredients (corn, soy, sugar beet derivatives)

good_markers (describe what's RIGHT about the REAL-FOOD swap you're recommending — sage pills):
  whole_food             - all ingredients are whole, recognizable foods
  no_seed_oils           - cooked in butter, ghee, tallow, olive, avocado, or coconut oil — no seed oils
  no_added_sugar         - sweetness comes only from whole-food sources (dates, fruit, honey)
  no_artificial_anything - no artificial colors, flavors, sweeteners, or preservatives
  organic                - made with organic ingredients
  grass_fed              - features grass-fed dairy or meat
  high_protein           - >=15g protein per serving
  high_fiber             - >=5g fiber per serving
  made_fresh             - prepared from scratch, not packaged
  low_sugar              - <=5g total sugar per serving
  dairy_free             - contains no dairy
  gluten_free            - contains no gluten

Pick markers HONESTLY. If a swap actually uses dates as the sweetener, emit no_added_sugar. If the original product genuinely contains MSG (even hidden), emit msg. Don't emit a good marker just because it sounds nice — every pill we show should be true.
Emit 2-5 bad markers for a typical ultra-processed original. Emit 3-6 good markers for a typical real-food swap.

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
      bad_markers: {
        type: "array",
        items: { type: "string", enum: BAD_MARKERS as unknown as string[] },
        description:
          "Keys describing what is WRONG with the ORIGINAL ultra-processed product (rendered as coral pills). 2-5 recommended.",
      },
      good_markers: {
        type: "array",
        items: { type: "string", enum: GOOD_MARKERS as unknown as string[] },
        description:
          "Keys describing what is RIGHT about the REAL-FOOD swap (rendered as sage pills). 3-6 recommended.",
      },
      product_url: {
        type: ["string", "null"],
        description:
          "When the goal is a real-food product (not a recipe), a direct URL to this product on the brand's own site. Leave null otherwise.",
      },
      brand_name: {
        type: ["string", "null"],
        description: "Brand name when recommending a product. Null otherwise.",
      },
      product_image_url: {
        type: ["string", "null"],
        description:
          "Image URL of the recommended product when one is known. Null otherwise.",
      },
      alternates: {
        type: "array",
        description:
          "2-3 alternate swap ideas the user can rotate to without us re-querying. Each must be genuinely different from the primary and from each other.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            tagline: { type: "string" },
            narrative: { type: "string" },
            product_url: { type: ["string", "null"] },
            brand_name: { type: ["string", "null"] },
            product_image_url: { type: ["string", "null"] },
            recipe: {
              type: ["object", "null"],
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
            },
          },
          required: ["title", "narrative"],
        },
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
  bad_markers: z.array(z.enum(BAD_MARKERS)).optional().default([]),
  good_markers: z.array(z.enum(GOOD_MARKERS)).optional().default([]),
  product_url: z.string().url().nullish(),
  brand_name: z.string().nullish(),
  product_image_url: z.string().url().nullish(),
  alternates: z
    .array(
      z.object({
        title: z.string(),
        tagline: z.string().optional(),
        narrative: z.string(),
        product_url: z.string().url().nullish(),
        brand_name: z.string().nullish(),
        product_image_url: z.string().url().nullish(),
        recipe: z
          .object({
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
          })
          .nullish(),
      }),
    )
    .max(5)
    .optional(),
});

export type SwapGeneratorOutput = z.infer<typeof OutputSchema>;
