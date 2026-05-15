// 5 personas for the 30-day test harness. Real American grocery products
// per persona's lifestyle. Behavior rates calibrated to feel human, not uniform.

export type AgeRange = "toddler" | "kid" | "teen" | "adult";
export type SkillLevel = "beginner" | "comfortable" | "confident";

export interface Persona {
  slug: string;
  email: string;
  name: string;
  bio: string; // shown in /admin/personas
  household_name: string;
  profile: {
    dietary_pattern: string[];
    allergies: string[];
    household_composition: string;
    top_goal: string;
    weeknight_time: number;
    skill_level: SkillLevel;
  };
  household_members: { name: string; age_range: AgeRange | null; allergies: string[] }[];
  // Real foods this person would actually search for.
  queryPool: string[];
  behavior: {
    swapsPerDay: number;
    saveRate: number; // 0..1, fraction of swaps saved to kitchen
    iterateRate: number; // 0..1, fraction of saved swaps that get iterated
    madeItRate: number; // 0..1, fraction of saved swaps that get a made-it event
    madeItLovedRatio: number; // 0..1, of madeIt, fraction that are loved vs not-for-me
    dismissRate: number; // 0..1, viewed-but-dismissed
  };
  // Common iteration phrases this persona would actually type.
  iterationPool: string[];
  // When set, distribute exactly this many swaps across the 30-day window
  // instead of using swapsPerDay × DAYS. Used for the real user's seed run.
  totalSwapsOverride?: number;
  // When true, ensurePersona will NOT overwrite an existing user's profile.
  preserveExistingProfile?: boolean;
}

export const PERSONAS: Persona[] = [
  {
    slug: "sarah-mom",
    email: "sarah.parker+rfw-demo@realfoodwin.test",
    name: "Sarah Parker",
    bio: "34, working mom of two. Her son Leo (6) has a peanut + tree-nut allergy. Lives in the snack aisle and is determined to feed the kids better.",
    household_name: "The Parker Household",
    profile: {
      dietary_pattern: [],
      allergies: ["peanut", "tree-nuts"],
      household_composition: "family-with-kids",
      top_goal: "feed-kids-better",
      weeknight_time: 30,
      skill_level: "comfortable",
    },
    household_members: [
      { name: "Mike", age_range: "adult", allergies: [] },
      { name: "Leo", age_range: "kid", allergies: ["peanut", "tree-nuts"] },
      { name: "Ivy", age_range: "toddler", allergies: [] },
    ],
    queryPool: [
      "Goldfish crackers", "Cheez-Its", "Pop-Tarts", "Lunchables Pizza", "Capri Sun",
      "Kraft Mac and Cheese", "Eggo waffles", "Hi-C juice boxes", "Fruit by the Foot",
      "Gushers", "Teddy Grahams", "Animal Crackers", "Honey Nut Cheerios", "Lucky Charms",
      "Frosted Flakes", "Trix cereal", "Tyson chicken nuggets", "Bagel Bites",
      "Hot Pockets pepperoni pizza", "Pillsbury crescent rolls", "Smucker's Uncrustables",
      "Doritos Cool Ranch", "Cheetos", "Lay's", "Oreos", "Chips Ahoy",
      "Nutter Butter", "Ritz crackers", "Wonder Bread", "Sunny D",
      "Yoplait Trix yogurt", "Go-Gurt", "Pillsbury Toaster Strudel", "store-bought chicken nuggets",
      "Lunchables Turkey and Cheddar", "Welch's fruit snacks", "Skinny Pop popcorn",
      "Frito-Lay variety pack", "Cinnamon Toast Crunch", "Cookie Crisp",
    ],
    behavior: {
      swapsPerDay: 5,
      saveRate: 0.6,
      iterateRate: 0.25,
      madeItRate: 0.5,
      madeItLovedRatio: 0.75,
      dismissRate: 0.1,
    },
    iterationPool: [
      "Make it nut-free (Leo's allergy)", "Make it kid-friendlier", "Pack-lunch friendly",
      "Scale to 4", "Make it faster — weeknight",
    ],
  },

  {
    slug: "marcus-fitness",
    email: "marcus.cole+rfw-demo@realfoodwin.test",
    name: "Marcus Cole",
    bio: "28, software engineer. Lifts 4x/week, cuts in summer. Lives on protein bars and energy drinks. Wants to lean down without giving up snacking.",
    household_name: "Marcus's Place",
    profile: {
      dietary_pattern: ["low-sugar"],
      allergies: [],
      household_composition: "just-me",
      top_goal: "lose-weight",
      weeknight_time: 15,
      skill_level: "beginner",
    },
    household_members: [],
    queryPool: [
      "Quest protein bar", "Clif bar", "Power Bar", "Built Bar", "Pure Protein bar",
      "Muscle Milk", "Premier Protein shake", "Atkins shake", "Naked Juice green machine",
      "Vitaminwater", "Gatorade", "Powerade", "Red Bull", "Monster energy",
      "Bang energy drink", "Celsius energy drink", "Slim Jim", "Jack Link's jerky",
      "Pop Chips", "Quest protein chips", "Kind bar", "RX Bar", "Larabar",
      "Detour protein bar", "instant oatmeal packets", "Frosted Mini-Wheats",
      "Special K cereal", "Cinnamon Toast Crunch", "Pop-Tarts", "Eggo waffles",
      "Hot Pockets philly cheese steak", "Lean Cuisine pasta", "Healthy Choice frozen meal",
      "Tyson frozen chicken strips", "frozen burrito", "Slimfast shake",
      "Gatorade protein bar", "Method protein cookies", "Belvita breakfast biscuits",
      "Nature Valley granola bar",
    ],
    behavior: {
      swapsPerDay: 5,
      saveRate: 0.4,
      iterateRate: 0.4,
      madeItRate: 0.3,
      madeItLovedRatio: 0.6,
      dismissRate: 0.15,
    },
    iterationPool: [
      "Boost the protein to 30g+", "Make it under 15 min", "No added sugar",
      "Higher fiber", "Use what's in a college kitchen",
    ],
  },

  {
    slug: "linda-inflammation",
    email: "linda.hayes+rfw-demo@realfoodwin.test",
    name: "Linda Hayes",
    bio: "52, empty nester. Diagnosed gluten sensitivity. Reading every label, swapping condiments and pantry staples to fight inflammation.",
    household_name: "The Hayes Pantry",
    profile: {
      dietary_pattern: ["gluten-free", "low-sugar"],
      allergies: ["gluten"],
      household_composition: "me-plus-partner",
      top_goal: "reduce-inflammation",
      weeknight_time: 45,
      skill_level: "confident",
    },
    household_members: [{ name: "David", age_range: "adult", allergies: [] }],
    queryPool: [
      "Heinz ketchup", "Hellmann's mayo", "Hidden Valley ranch dressing", "Italian dressing",
      "Kikkoman soy sauce", "Worcestershire sauce", "Sweet Baby Ray's BBQ sauce",
      "Cup Noodles", "Maruchan ramen", "store-bought croutons", "Hidden Valley ranch packet",
      "Oreo cookies", "Wheat Thins", "Triscuits", "Saltines", "Honey Maid graham crackers",
      "Pillsbury biscuits", "Bisquick", "Daisy sour cream", "French onion dip",
      "Tostitos queso dip", "salsa con queso", "Velveeta", "Oscar Mayer bologna",
      "deli ham", "Ragu pasta sauce", "Prego marinara", "Stouffer's lasagna",
      "Hungry-Man dinner", "Mrs. Dash seasoning", "Cool Whip", "Reddi-wip",
      "Pillsbury cinnamon rolls", "Country Crock margarine", "Smart Balance",
      "Newman's Own Caesar dressing", "Wishbone Italian", "Ken's Steakhouse dressing",
      "Aunt Jemima syrup", "Log Cabin syrup",
    ],
    behavior: {
      swapsPerDay: 5,
      saveRate: 0.75,
      iterateRate: 0.5,
      madeItRate: 0.6,
      madeItLovedRatio: 0.8,
      dismissRate: 0.05,
    },
    iterationPool: [
      "Make it gluten-free", "Lower the sugar", "Anti-inflammatory ingredients only",
      "Scale to 2 servings", "Make it a make-ahead",
    ],
  },

  {
    slug: "tyler-emma-vegan",
    email: "tyler.fox+rfw-demo@realfoodwin.test",
    name: "Tyler & Emma Fox",
    bio: "30, vegan couple, both work in tech. Confident in the kitchen, want whole-food versions of the ultra-processed vegan products they live on.",
    household_name: "Tyler & Emma's Kitchen",
    profile: {
      dietary_pattern: ["vegan", "dairy-free"],
      allergies: [],
      household_composition: "me-plus-partner",
      top_goal: "get-off-ultra-processed",
      weeknight_time: 30,
      skill_level: "confident",
    },
    household_members: [{ name: "Emma", age_range: "adult", allergies: [] }],
    queryPool: [
      "Beyond Burger", "Impossible Burger", "Morningstar Farms patty", "Tofurky deli slices",
      "Boca Burger", "Field Roast sausage", "Daiya cheddar shreds", "Violife feta",
      "Tofutti cream cheese", "Forager cashew yogurt", "So Delicious coconut ice cream",
      "Halo Top dairy-free", "Oatly oat milk", "Almond Breeze almond milk",
      "JUST Mayo", "Vegenaise", "Earth Balance buttery spread", "Miyoko's vegan butter",
      "plant-based chicken nuggets", "Daiya pizza", "Amy's frozen burrito",
      "Chao cheese", "Ripple plant milk", "vegan sausages", "Lightlife Smart Bacon",
      "Beyond breakfast sausage", "Silk cashew creamer", "vegan yogurt", "JUST Egg",
      "Trader Joe's frozen vegetable masala", "Gardein crispy chicken", "MorningStar bacon strips",
      "Tofurky kielbasa", "Field Roast Frankfurter", "Lightlife tempeh bacon",
      "Califia oat creamer", "Daiya cheesecake", "So Delicious chocolate ice cream",
      "Oatly chocolate milk", "vegan pepperoni",
    ],
    behavior: {
      swapsPerDay: 5,
      saveRate: 0.7,
      iterateRate: 0.45,
      madeItRate: 0.5,
      madeItLovedRatio: 0.7,
      dismissRate: 0.05,
    },
    iterationPool: [
      "Keep it fully plant-based", "Use what's in season", "Make it Sunday meal-prep friendly",
      "Higher protein (plant-based)", "Make it date-night good",
    ],
  },

  {
    slug: "jessica-curious",
    email: "jessica.lee+rfw-demo@realfoodwin.test",
    name: "Jessica Lee",
    bio: "41, working mom, casual user. Heard about Real Food Win at a school event. Browses occasionally, saves rarely, mostly skeptical.",
    household_name: "The Lee Family",
    profile: {
      dietary_pattern: [],
      allergies: [],
      household_composition: "family-with-kids",
      top_goal: "just-curious",
      weeknight_time: 15,
      skill_level: "beginner",
    },
    household_members: [
      { name: "Brian", age_range: "adult", allergies: [] },
      { name: "Avery", age_range: "kid", allergies: [] },
    ],
    queryPool: [
      "Diet Coke", "Crystal Light", "Splenda", "Sweet'N Low", "Coffee Mate",
      "International Delight creamer", "Folgers instant coffee", "Lipton tea bags",
      "Cool Whip", "Velveeta", "Cheez Whiz", "Easy Mac", "Orville Redenbacher popcorn",
      "Doritos", "Cheetos", "Lay's potato chips", "Pringles", "Ritz crackers",
      "Saltines", "Wonder Bread", "Pop-Tarts", "Eggo waffles", "McDonald's cheeseburger",
      "Taco Bell crunchwrap", "Coca-Cola", "Sprite", "Mountain Dew", "Dr Pepper",
      "Tropicana orange juice", "Sunny D", "Frosted Flakes", "Captain Crunch",
      "Cinnamon Toast Crunch", "Hostess Twinkies", "Little Debbie Swiss Rolls",
      "Drumstick ice cream", "Klondike bar", "Häagen-Dazs cookie dough", "Magnum bar",
    ],
    behavior: {
      swapsPerDay: 5,
      saveRate: 0.25,
      iterateRate: 0.1,
      madeItRate: 0.15,
      madeItLovedRatio: 0.55,
      dismissRate: 0.3,
    },
    iterationPool: [
      "Simpler — fewer steps", "Make it 5 min", "Use stuff I already have",
      "Less weird ingredients", "Make it more like the original",
    ],
  },

  // The real account holder — used for the 100-swap personal seed run.
  // preserveExistingProfile so if he's already filled out the quiz, we don't
  // overwrite his answers.
  {
    slug: "rdawson",
    email: "rdawson@strategicdataproducts.com",
    name: "Rob Dawson",
    bio: "Founder. Real user account — 100-swap personalized seed run.",
    household_name: "The Dawson Household",
    profile: {
      dietary_pattern: ["low-sugar"],
      allergies: [],
      household_composition: "family-with-kids",
      top_goal: "get-off-ultra-processed",
      weeknight_time: 30,
      skill_level: "comfortable",
    },
    household_members: [],
    queryPool: [
      // A broad pool across the things a busy founder actually grabs.
      "Cheez-Its", "Goldfish", "Pop-Tarts", "Eggo waffles", "Frosted Flakes",
      "Cinnamon Toast Crunch", "Honey Nut Cheerios", "Lucky Charms",
      "Doritos", "Cheetos", "Lay's potato chips", "Pringles", "Ritz crackers",
      "Triscuits", "Wheat Thins", "Saltines", "Oreos", "Chips Ahoy",
      "Hot Pockets", "Lean Cuisine", "Stouffer's mac and cheese",
      "Bagel Bites", "DiGiorno pizza", "Tyson chicken nuggets",
      "Pillsbury cinnamon rolls", "Pillsbury biscuits", "Bisquick",
      "Kraft Mac and Cheese", "Velveeta", "Cheez Whiz", "Easy Mac",
      "Ranch dressing", "Hidden Valley ranch", "Heinz ketchup", "Hellmann's mayo",
      "Sweet Baby Ray's BBQ sauce", "Italian dressing", "Caesar dressing",
      "Red Bull", "Monster", "Gatorade", "Powerade", "Vitaminwater",
      "Quest protein bar", "Clif bar", "Kind bar", "Larabar", "RX Bar",
      "Slim Jim", "Jack Link's jerky", "Pop-Tarts", "Belvita",
      "Skippy peanut butter", "Smucker's jelly", "Wonder Bread", "Sunny D",
      "Capri Sun", "Hi-C", "Fruit by the Foot", "Gushers", "Welch's fruit snacks",
      "Lunchables", "Smucker's Uncrustables", "Drumstick ice cream",
      "Klondike bar", "Häagen-Dazs", "Ben & Jerry's", "Magnum bar",
      "Hostess Twinkies", "Little Debbie Swiss Rolls", "Cool Whip", "Reddi-wip",
      "Coffee Mate", "International Delight creamer", "Folgers coffee",
      "Diet Coke", "Coca-Cola", "Sprite", "Mountain Dew", "Dr Pepper",
      "Tropicana orange juice", "Naked Juice green machine",
      "McDonald's Big Mac", "McDonald's fries", "Taco Bell crunchwrap",
      "Chipotle burrito", "Chick-fil-A nuggets", "Subway turkey sub",
      "frozen burrito", "Healthy Choice frozen meal", "Hungry-Man dinner",
      "Velveeta shells", "Pasta Roni", "Rice-A-Roni", "Hamburger Helper",
      "Cup Noodles", "Maruchan ramen", "Bisquick", "Pillsbury crescent rolls",
    ],
    behavior: {
      swapsPerDay: 4, // base — overridden by totalSwapsOverride
      saveRate: 0.55,
      iterateRate: 0.35,
      madeItRate: 0.4,
      madeItLovedRatio: 0.7,
      dismissRate: 0.1,
    },
    iterationPool: [
      "Make it faster — weeknight", "Scale to 4 servings", "Lower the sugar",
      "Family-friendly", "Use what's in a Midwestern kitchen",
      "Higher protein", "No special equipment",
    ],
    totalSwapsOverride: 100,
    preserveExistingProfile: true,
  },
];

export function pickRandom<T>(arr: T[], rand: () => number = Math.random): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

// Deterministic seeded RNG so re-running produces the same history (helpful for debugging).
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
