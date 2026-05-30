/**
 * One-shot pre-warming script for the swap_query_cache.
 *
 * Runs `matchLibrary` over a curated list of ~200 of the most-scanned
 * ultra-processed US grocery products. The matcher writes every result it
 * computes into swap_query_cache, so once this script has run, the FIRST
 * in-store scan of any of these products anywhere in the system hits a
 * sub-500ms cached path instead of the 3-5s live embed → pgvector → Haiku
 * pipeline.
 *
 * Idempotent: re-running just refreshes the cache rows.
 *
 * Run:
 *   corepack pnpm seed:swap-cache
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: "apps/web/.env.local" });

import { matchLibrary } from "@realfoodwin/gateway";

// ---------------------------------------------------------------------------
// Env sanity check
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `[prewarm] Missing required env vars: ${missing.join(", ")}\n` +
      `  Put them in .env.local at the repo root (or apps/web/.env.local).`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Query list — ~200 of the most-scanned ultra-processed US grocery products.
// Names mirror what a real shopper would type / what OCR / barcode-lookup
// returns. Mixes singular + plural where natural.
// ---------------------------------------------------------------------------

const QUERIES: string[] = [
  // --- Candy bars ---
  "Snickers",
  "Snickers bar",
  "KitKat",
  "Kit Kat",
  "Reese's Peanut Butter Cups",
  "Reese's",
  "Twix",
  "Hershey's chocolate bar",
  "Hershey's Kisses",
  "Milky Way",
  "Almond Joy",
  "Mounds",
  "100 Grand",
  "Butterfinger",
  "Baby Ruth",
  "Three Musketeers",
  "M&M's",
  "Peanut M&M's",
  "Skittles",
  "Starburst",
  "Twizzlers",
  "Sour Patch Kids",
  "Swedish Fish",
  "Jolly Rancher",
  "Tootsie Roll",
  "Tootsie Pop",
  "Payday",
  "Mr. Goodbar",
  "Krackel",
  "Take 5",
  "Whatchamacallit",
  "Heath bar",
  "Rolo",

  // --- Chips & salty snacks ---
  "Doritos",
  "Doritos Nacho Cheese",
  "Doritos Cool Ranch",
  "Cheetos",
  "Flamin' Hot Cheetos",
  "Cheetos Puffs",
  "Lay's potato chips",
  "Lay's Classic",
  "Ruffles",
  "Ruffles Cheddar Sour Cream",
  "Pringles",
  "Pringles Sour Cream and Onion",
  "Tostitos",
  "Tostitos Scoops",
  "Fritos",
  "Sun Chips",
  "Funyuns",
  "Cheez-It",
  "Cheez-Its",
  "Goldfish crackers",
  "Goldfish",
  "Chex Mix",
  "Bugles",
  "Combos",
  "Pirate's Booty",
  "Takis",
  "Slim Jim",
  "SunChips",

  // --- Sodas & sweetened drinks ---
  "Coca-Cola",
  "Coke",
  "Diet Coke",
  "Pepsi",
  "Diet Pepsi",
  "Sprite",
  "7UP",
  "Mountain Dew",
  "Dr Pepper",
  "Fanta",
  "Fanta Orange",
  "Root beer",
  "A&W Root Beer",
  "Mug Root Beer",
  "Sunkist",
  "Crush Orange",
  "Gatorade",
  "Powerade",
  "Red Bull",
  "Monster Energy",
  "Rockstar Energy",
  "Capri-Sun",
  "Capri Sun",
  "Kool-Aid",
  "Kool-Aid Jammers",
  "Hi-C",
  "SunnyD",
  "Snapple",
  "Arizona Iced Tea",
  "Yoo-hoo",
  "Minute Maid lemonade",
  "Tropicana Twister",
  "Vitaminwater",

  // --- Cereals ---
  "Cheerios",
  "Honey Nut Cheerios",
  "Frosted Flakes",
  "Rice Krispies",
  "Corn Flakes",
  "Cap'n Crunch",
  "Captain Crunch",
  "Lucky Charms",
  "Cocoa Puffs",
  "Cocoa Pebbles",
  "Fruity Pebbles",
  "Cinnamon Toast Crunch",
  "Apple Jacks",
  "Froot Loops",
  "Trix cereal",
  "Reese's Puffs",
  "Honey Bunches of Oats",
  "Frosted Mini-Wheats",
  "Raisin Bran",
  "Special K",
  "Golden Grahams",
  "Cookie Crisp",

  // --- Cookies & sweet crackers ---
  "Oreos",
  "Oreo",
  "Double Stuf Oreos",
  "Chips Ahoy",
  "Nutter Butter",
  "Nilla Wafers",
  "Famous Amos cookies",
  "Keebler Fudge Stripes",
  "Pepperidge Farm Milano",
  "Animal Crackers",
  "Teddy Grahams",
  "Graham crackers",
  "Ritz crackers",
  "Ritz Bits",
  "Saltines",
  "Wheat Thins",
  "Triscuit",
  "Club crackers",

  // --- Frozen meals & frozen snacks ---
  "Hot Pockets",
  "Lunchables",
  "Bagel Bites",
  "Eggo Waffles",
  "Toaster Strudel",
  "DiGiorno pizza",
  "Tombstone pizza",
  "Totino's Pizza Rolls",
  "Pizza Rolls",
  "Stouffer's Mac and Cheese",
  "Stouffer's Lasagna",
  "Hungry-Man dinner",
  "Marie Callender's pot pie",
  "Banquet pot pie",
  "TGI Fridays mozzarella sticks",
  "Tyson chicken nuggets",
  "Tyson popcorn chicken",
  "Jimmy Dean breakfast sandwich",
  "Hot Pocket pepperoni pizza",

  // --- Sweetened snacks & pastries ---
  "Pop-Tarts",
  "Pop Tarts",
  "Nutri-Grain bars",
  "Rice Krispies Treats",
  "Twinkies",
  "Hostess CupCakes",
  "Ding Dongs",
  "Ho Hos",
  "Zingers",
  "Little Debbie Oatmeal Creme Pies",
  "Little Debbie Swiss Rolls",
  "Little Debbie Cosmic Brownies",
  "Little Debbie Nutty Buddy",
  "Entenmann's donuts",
  "Krispy Kreme donut",
  "Dunkin Donuts donut",

  // --- Kid snacks ---
  "Fruit Roll-Ups",
  "Fruit by the Foot",
  "Gushers",
  "Dunkaroos",
  "Welch's Fruit Snacks",
  "Mott's Fruit Snacks",
  "Scooby-Doo fruit snacks",
  "Go-Gurt",
  "Gogurt",
  "Yoplait Trix yogurt",
  "Push Pop",
  "Ring Pop",
  "Pixy Stix",
  "Fun Dip",

  // --- Condiments, dressings, spreads ---
  "Heinz Ketchup",
  "Hellmann's Mayo",
  "Hellmann's mayonnaise",
  "Miracle Whip",
  "French's Mustard",
  "Hidden Valley Ranch dressing",
  "Ranch dressing",
  "Sweet Baby Ray's BBQ sauce",
  "BBQ sauce",
  "Kraft Singles",
  "Velveeta",
  "Cheez Whiz",
  "Jif peanut butter",
  "Skippy peanut butter",
  "Smucker's jelly",
  "Nutella",
  "Marshmallow Fluff",

  // --- Fast-food items by name ---
  "Big Mac",
  "Quarter Pounder",
  "McNuggets",
  "Chicken McNuggets",
  "McMuffin",
  "Egg McMuffin",
  "McChicken",
  "Whopper",
  "Burger King Whopper",
  "Crunchwrap Supreme",
  "Crunchwrap",
  "Taco Bell burrito",
  "KFC fried chicken",
  "Popeyes chicken sandwich",
  "Chick-fil-A nuggets",
  "Wendy's Frosty",
  "Domino's pizza",
  "Pizza Hut pizza",
  "Subway sandwich",

  // --- Breakfast/breads/instant ---
  "Wonder Bread",
  "Sara Lee bread",
  "Kraft Macaroni and Cheese",
  "Easy Mac",
  "Ramen noodles",
  "Maruchan ramen",
  "Cup Noodles",
  "Top Ramen",
  "Hamburger Helper",
  "Spam",
  "Vienna Sausages",
  "Oscar Mayer hot dogs",
  "Ball Park hot dogs",
  "Bologna",
  "Lunchables pizza",
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

async function main(): Promise<void> {
  const total = QUERIES.length;
  console.log(
    `[prewarm] Warming swap_query_cache with ${total} ultra-processed product queries…`,
  );
  console.log(`[prewarm] Delay between queries: ${DELAY_MS}ms`);

  let hits = 0;
  let misses = 0;
  let errors = 0;
  let cachedAlready = 0;
  const startedAt = Date.now();

  for (let i = 0; i < total; i++) {
    const query = QUERIES[i]!;
    const label = `[${pad(i + 1, 3)}/${total}]  ${query}`;
    const t0 = Date.now();
    try {
      const result = await matchLibrary({ query, goals: [] });
      const dt = Date.now() - t0;
      const recipeStr = result.recipe ? "recipe" : "no recipe";
      const productCount = result.products.length;
      const got = result.recipe !== null || productCount > 0;
      if (got) hits++;
      else misses++;
      if (result.cached) cachedAlready++;

      const summary = got
        ? `${recipeStr} + ${productCount} product${productCount === 1 ? "" : "s"}`
        : "no match";
      const sourceTag = result.cached ? " [cache]" : "";
      console.log(`${label} — ${summary} in ${dt}ms${sourceTag}`);
    } catch (err) {
      errors++;
      const dt = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${label} — ERROR in ${dt}ms: ${msg}`);
    }

    if (i < total - 1) await sleep(DELAY_MS);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n[prewarm] ───────────────────────────────────────────────");
  console.log(`[prewarm] Summary (${elapsed}s total)`);
  console.log(`[prewarm]   Total queries:   ${total}`);
  console.log(`[prewarm]   Hits (matched):  ${hits}`);
  console.log(`[prewarm]   Misses:          ${misses}`);
  console.log(`[prewarm]   Errors:          ${errors}`);
  console.log(`[prewarm]   Already-cached:  ${cachedAlready}`);
  console.log("[prewarm] ───────────────────────────────────────────────");
  console.log(
    `[prewarm] Done. swap_query_cache now contains warm entries for every` +
      ` non-erroring query above. First in-store scan of any of these names` +
      ` should now hit the sub-500ms cached path.`,
  );

  process.exit(errors > 0 && hits === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[prewarm] FATAL:", err);
  process.exit(1);
});
