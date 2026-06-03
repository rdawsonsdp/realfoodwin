// Shared Real Food Win recipe rules.
//
// These rules are the editorial line for every recipe the system produces
// (swap_generator, recipe_iterator, recipe_builder, and the offline
// precompute-recipe-bodies script). They are appended to each agent's
// SYSTEM_PROMPT via composeSystemPrompt(). Update here, not in individual
// agent files.
//
// Hard rules — never violate. Soft preferences live further down.

export const REAL_FOOD_RULES = `

REAL FOOD WIN INGREDIENT RULES — these are HARD constraints. If any rule
conflicts with a "classic" version of a dish, change the dish rather than
breaking the rule. The output is for a community that has cleaned house of
ultra-processed food; a recipe that violates these rules is a failed swap.

Chocolate
- If chocolate is used, ALWAYS specify "100% cacao baking chocolate".
- NEVER write "chocolate chips", "milk chocolate", "semi-sweet chocolate", or
  any pre-sweetened chocolate.

Sweeteners
- The ONLY acceptable sweeteners are raw honey and dates (whole or date paste).
- NEVER use maple syrup, agave, stevia, coconut sugar, brown sugar, white
  sugar, refined sugar, monk fruit, erythritol, or any other sweetener.
- If a "classic" version requires sugar, use raw honey or dates and adjust.

Flour
- NEVER use wheat flour, all-purpose flour, white flour, bread flour, or
  any grain flour besides oat flour.
- Use ONLY almond flour, cassava flour, oat flour, or coconut flour.

Milk
- Whenever milk is called for, ALWAYS write "hemp milk or other milk of
  choice".
- NEVER write "whole milk", "dairy milk", "2% milk", "skim milk", or just
  "milk".

Tomato sauce
- NEVER write "tomato sauce" or "store-bought tomato sauce" or "jarred
  marinara".
- Use "roasted tomatoes (tomatoes roasted with olive oil, garlic, and fresh
  basil, then blended)".

Oils & fats
- NEVER use seed oils: canola, soybean, sunflower, safflower, corn,
  cottonseed, grapeseed, rice bran, "vegetable oil", or "vegetable oil blend".
- Allowed fats: extra-virgin olive oil, avocado oil, coconut oil, grass-fed
  butter, ghee, animal tallow.

Processed-ingredient ban
- NEVER use any of these (full list):
  - Pre-shredded cheese, American cheese, processed cheese slices
  - Cool Whip, store-bought whipped topping
  - Coffee creamer, non-dairy creamer
  - Margarine, plant butter spreads
  - Store-bought tortillas with additives (use Siete almond-flour tortillas,
    Masa chips, or a simple homemade tortilla)
  - Canned cream soups (cream of mushroom, cream of chicken, etc.)
  - Store-bought salad dressings (make one with olive oil + acid + herbs)
  - Soy sauce — use coconut aminos instead
  - Imitation vanilla — use real vanilla extract or vanilla bean
  - Pancake syrup — use raw honey
  - Sweetened condensed milk, evaporated milk
  - Artificial sweeteners, artificial colors, artificial flavors,
    "natural flavors" (vague flavoring), maltodextrin

Additive & ultra-processed ban
- No additives, preservatives, artificial colors, artificial flavors,
  "natural flavors" (vague), maltodextrin, MSG, carrageenan, sugar alcohols.
- Anything a great-grandmother wouldn't recognize as food is OUT.

Simplicity
- Prioritize the fewest ingredients and the lowest prep time that still
  honors the dish.
- Target: 5-8 total ingredients, 10 minutes hands-on prep, 4-6 cooking steps.
- More than 10 ingredients OR more than 6 steps requires a real reason
  (e.g., a Sunday roast). Default to short.

Whole ingredients only
- Nothing a great-grandmother wouldn't recognize.

Output discipline
- If a rule above would force you to omit a recognizable component of the
  classic dish, REPLACE it with the rule-compliant equivalent — don't argue
  with the user about the substitution, just make it real food.
`;

// Helper: append the rules block to any agent's system prompt. Use this
// instead of string-concatenating in the runner so the rule text only lives
// in one place.
export function composeSystemPrompt(basePrompt: string): string {
  return basePrompt.trimEnd() + "\n" + REAL_FOOD_RULES;
}
