// Curated coach card library for the v2 home page.
//
// Each card is the *cue + routine + reward* James Clear talks about, condensed
// into one screen unit. Voice: warm-friend health coach. Never preach. Frame
// every swap as an upgrade, never as deprivation.
//
// v1 has no food photos — the card uses a colored tile + a single glyph driven
// by meal slot. That keeps coaching front-and-center (vs. food-marketing aesthetic)
// and lets us ship 30 cards without imagery.

import type { MealSlot } from "@/lib/meal-slot";

export interface CoachCard {
  id: string; // stable slug used as a seed and for de-duping
  slot: MealSlot;
  // The instead_of + replacement framing matters: Clear's "make it attractive"
  // is about presenting the new behavior as the better option, not policing
  // the old one. Both go on the card.
  instead_of: string;
  replacement: string;
  cue: string; // one-liner above the swap; the "obvious" moment
  habit_stack: string; // "After X, try Y." (Clear's habit stacking)
  why: string; // one short physiological/practical line
  identity: string; // "Real-food eaters reach for…" — surfaced after action
  tags?: string[]; // future filter (allergies/goals)
}

export const COACH_CARDS: CoachCard[] = [
  // -----------------------------------------------------------------------
  // BREAKFAST (5:00–9:59)  — set steady energy, avoid the 10am crash
  // -----------------------------------------------------------------------
  {
    id: "bk-eggs-avocado-toast",
    slot: "breakfast",
    instead_of: "Pop-Tart or sugary cereal",
    replacement: "Two eggs on sourdough with avocado",
    cue: "How you start sets the next four hours.",
    habit_stack: "After you pour your coffee, crack two eggs.",
    why: "Protein + fat hold blood sugar steady — no 10am crash.",
    identity: "Real-food eaters break fast with protein.",
  },
  {
    id: "bk-greek-yogurt-berries",
    slot: "breakfast",
    instead_of: "Flavored yogurt cups",
    replacement: "Plain Greek yogurt, berries, a drizzle of honey",
    cue: "Most flavored yogurts are dessert in disguise.",
    habit_stack: "After your morning glass of water, scoop the yogurt.",
    why: "Real protein, real fruit, a quarter of the sugar.",
    identity: "Real-food eaters read the label — and skip the sweetened cup.",
  },
  {
    id: "bk-overnight-oats",
    slot: "breakfast",
    instead_of: "Granola bar on the run",
    replacement: "Overnight oats with banana and almond butter",
    cue: "Mornings are easier when last night did half the work.",
    habit_stack: "After the dishes, jar tomorrow's oats.",
    why: "Slow carbs + nut fat = no shaky 11am.",
    identity: "Real-food eaters prep one thing ahead.",
  },
  {
    id: "bk-veggie-scramble",
    slot: "breakfast",
    instead_of: "Drive-thru breakfast sandwich",
    replacement: "Three-egg veggie scramble with cheese",
    cue: "Drive-thru breakfast is mostly seed oils and refined bread.",
    habit_stack: "After your shower, the pan is already warm.",
    why: "Same protein hit, real eggs, real cheese, no mystery oil.",
    identity: "Real-food eaters cook five minutes for themselves.",
  },
  {
    id: "bk-smoothie-real",
    slot: "breakfast",
    instead_of: "Bottled green smoothie",
    replacement: "Spinach, banana, almond milk, scoop of nut butter",
    cue: "Most bottled smoothies are fruit-juice sugar bombs.",
    habit_stack: "After you turn on the kettle, hit the blender.",
    why: "Fiber stays in, sugar stays low, you stay full.",
    identity: "Real-food eaters blend their own.",
  },
  {
    id: "bk-cottage-cheese-fruit",
    slot: "breakfast",
    instead_of: "Sugary breakfast pastry",
    replacement: "Cottage cheese with pineapple or peaches",
    cue: "Bakery breakfasts taste good and crash hard.",
    habit_stack: "After you check the calendar, scoop the curd.",
    why: "25g of protein, almost zero added sugar.",
    identity: "Real-food eaters fuel for the morning ahead.",
  },
  {
    id: "bk-chia-pudding",
    slot: "breakfast",
    instead_of: "Sugary breakfast cereal",
    replacement: "Chia pudding with coconut and berries",
    cue: "Breakfast cereal is dessert that asks to be eaten daily.",
    habit_stack: "After dinner, stir tomorrow's pudding.",
    why: "Fiber + fat, almost zero added sugar.",
    identity: "Real-food eaters prep tomorrow tonight.",
  },

  // -----------------------------------------------------------------------
  // LUNCH (10:00–13:59)  — sustained afternoon energy, no crash
  // -----------------------------------------------------------------------
  {
    id: "ln-big-salad",
    slot: "lunch",
    instead_of: "Fast-food combo meal",
    replacement: "Big salad: greens, chickpeas, feta, olive oil, lemon",
    cue: "Lunch sets the afternoon.",
    habit_stack: "After your morning meetings, build the bowl.",
    why: "Real fats keep you full, no 3pm crash.",
    identity: "Real-food eaters build the bowl.",
  },
  {
    id: "ln-leftover-protein-bowl",
    slot: "lunch",
    instead_of: "Frozen processed lunch",
    replacement: "Last night's protein over rice, greens, and salsa",
    cue: "Yesterday-you already did the hard part.",
    habit_stack: "After lunch alert pings, open the fridge.",
    why: "Real ingredients, two minutes, way less sodium.",
    identity: "Real-food eaters eat leftovers without apology.",
  },
  {
    id: "ln-tuna-real",
    slot: "lunch",
    instead_of: "Lunchable or deli pre-pack",
    replacement: "Tuna mixed with olive oil + lemon on whole-grain crackers",
    cue: "Pre-packed lunch kits skim on protein and load on sodium.",
    habit_stack: "After you fill your water bottle, crack the can.",
    why: "Five-minute lunch, twice the protein.",
    identity: "Real-food eaters make it themselves.",
  },
  {
    id: "ln-soup-real",
    slot: "lunch",
    instead_of: "Canned condensed soup",
    replacement: "Homemade veg + bean soup, batch from Sunday",
    cue: "Canned soup is mostly sodium and seed oil.",
    habit_stack: "After Sunday groceries, pot's already going.",
    why: "Real vegetables, real broth, lasts the week.",
    identity: "Real-food eaters cook once, eat five times.",
  },
  {
    id: "ln-wrap-real",
    slot: "lunch",
    instead_of: "Fast-casual wrap with mystery sauce",
    replacement: "Whole-grain wrap, hummus, grilled chicken, greens",
    cue: "The sauce is usually the problem.",
    habit_stack: "After you boil water for tea, build the wrap.",
    why: "Same satisfaction, real ingredients, half the sodium.",
    identity: "Real-food eaters know what's in the sauce.",
  },
  {
    id: "ln-grain-bowl",
    slot: "lunch",
    instead_of: "Drive-thru salad bowl",
    replacement: "Quinoa + roasted veg + chicken + tahini",
    cue: "Drive-thru bowls cost what real food costs to cook.",
    habit_stack: "After your inbox check, reheat the bowl.",
    why: "Real grains, real veg, no industrial dressing.",
    identity: "Real-food eaters skip the line.",
  },

  // -----------------------------------------------------------------------
  // SNACK (14:00–16:59)  — the 3pm slump, the M&M moment
  // -----------------------------------------------------------------------
  {
    id: "sn-apple-almond-butter",
    slot: "snack",
    instead_of: "M&Ms or candy bar",
    replacement: "Apple slices with almond butter",
    cue: "The 3pm slump is real.",
    habit_stack: "After your afternoon coffee, slice the apple.",
    why: "Protein + fiber = steady energy, no crash.",
    identity: "Real-food eaters reach for protein + fiber at 3pm.",
  },
  {
    id: "sn-dark-choc-nuts",
    slot: "snack",
    instead_of: "Trail mix with M&Ms",
    replacement: "A few squares of 70%+ dark chocolate + almonds",
    cue: "Sweet craving — but you don't need the candy aisle.",
    habit_stack: "After you stand up to stretch, grab the tin.",
    why: "Real cocoa, real fat, no crash.",
    identity: "Real-food eaters keep the good chocolate stocked.",
  },
  {
    id: "sn-greek-yogurt-honey",
    slot: "snack",
    instead_of: "Snack-pack pudding",
    replacement: "Greek yogurt with a drizzle of honey",
    cue: "Pudding cups are dessert pretending to be a snack.",
    habit_stack: "After your last meeting, scoop the cup.",
    why: "Real protein, slow sugar — no afternoon crash.",
    identity: "Real-food eaters know yogurt beats pudding.",
  },
  {
    id: "sn-hummus-veg",
    slot: "snack",
    instead_of: "Chips or crackers",
    replacement: "Hummus with carrots, cucumber, peppers",
    cue: "Crunchy craving — answer with veg, not chips.",
    habit_stack: "After you refill water, plate the veg.",
    why: "Real fiber, real chickpea protein, real crunch.",
    identity: "Real-food eaters keep veg pre-cut.",
  },
  {
    id: "sn-cottage-pineapple",
    slot: "snack",
    instead_of: "Sweetened protein bar",
    replacement: "Cottage cheese with pineapple chunks",
    cue: "Most protein bars are candy with extra protein.",
    habit_stack: "After your 3pm timer, scoop the curd.",
    why: "Same protein hit, no sugar alcohols, no industrial syrup.",
    identity: "Real-food eaters skip the wrapper.",
  },
  {
    id: "sn-hardboiled-eggs",
    slot: "snack",
    instead_of: "Vending-machine snack pack",
    replacement: "Two hard-boiled eggs with flaky salt",
    cue: "Vending machines have nothing for you here.",
    habit_stack: "After Sunday meal prep, boil six eggs.",
    why: "Walk-around protein, zero prep mid-week.",
    identity: "Real-food eaters batch-boil eggs.",
  },
  {
    id: "sn-popcorn-real",
    slot: "snack",
    instead_of: "Microwave popcorn",
    replacement: "Stovetop popcorn with olive oil + sea salt",
    cue: "Microwave popcorn is mostly the lining and the seed oil.",
    habit_stack: "After dinner is in the oven, pop the corn.",
    why: "Same craving, real fat, three minutes.",
    identity: "Real-food eaters pop their own.",
  },
  {
    id: "sn-jerky-real",
    slot: "snack",
    instead_of: "Beef jerky with sugar + nitrates",
    replacement: "Clean-ingredient jerky or biltong",
    cue: "Read the jerky label — most are candy-coated.",
    habit_stack: "After grocery day, stock the desk drawer.",
    why: "Walk-around protein, no industrial sugar.",
    identity: "Real-food eaters check the back of the bag.",
  },
  {
    id: "sn-banana-nut-butter",
    slot: "snack",
    instead_of: "Granola bar",
    replacement: "Banana split lengthwise with peanut butter",
    cue: "Granola bars are cookies with marketing.",
    habit_stack: "After you grab the fruit bowl, spread the butter.",
    why: "Real potassium, real protein, real fast.",
    identity: "Real-food eaters split the banana.",
  },

  // -----------------------------------------------------------------------
  // DINNER (17:00–20:59)  — the win that builds the family habit
  // -----------------------------------------------------------------------
  {
    id: "dn-sheet-pan-chicken",
    slot: "dinner",
    instead_of: "Frozen processed dinner",
    replacement: "Sheet-pan chicken thighs with vegetables",
    cue: "Dinner is the easiest swap to win.",
    habit_stack: "After you walk in the door, oven goes on.",
    why: "One pan, real protein, real veg, real cleanup.",
    identity: "Real-food eaters cook one pan.",
  },
  {
    id: "dn-pasta-real",
    slot: "dinner",
    instead_of: "Boxed pasta dinner kit",
    replacement: "Pasta with real tomatoes, garlic, olive oil, parmesan",
    cue: "Boxed pasta kits are mostly salt and powdered cheese.",
    habit_stack: "After the water boils, the rest is ten minutes.",
    why: "Same comfort, real ingredients you can name.",
    identity: "Real-food eaters cook from the pantry.",
  },
  {
    id: "dn-burger-real",
    slot: "dinner",
    instead_of: "Drive-thru burger",
    replacement: "Real-food smash burger on a buttered bun",
    cue: "You don't need a drive-thru for a great burger.",
    habit_stack: "After Friday work, the cast iron's already there.",
    why: "Real beef, real bun, your kitchen, twelve minutes.",
    identity: "Real-food eaters smash their own.",
  },
  {
    id: "dn-tacos-real",
    slot: "dinner",
    instead_of: "Taco meal kit with packet seasoning",
    replacement: "Ground beef + cumin, paprika, garlic — corn tortillas",
    cue: "Seasoning packets are 30% sodium and stabilizers.",
    habit_stack: "After taco-night text goes out, the pan is on.",
    why: "Five spices from the rack and it tastes better.",
    identity: "Real-food eaters keep cumin in the cabinet.",
  },
  {
    id: "dn-salmon-greens",
    slot: "dinner",
    instead_of: "Takeout sushi platter",
    replacement: "Pan-seared salmon over sautéed greens",
    cue: "Takeout sushi can be a sodium and seed-oil ride.",
    habit_stack: "After Tuesday yoga, the fillet is in the pan.",
    why: "Real omega-3, real greens, twelve minutes.",
    identity: "Real-food eaters sear their own fish.",
  },
  {
    id: "dn-stir-fry-real",
    slot: "dinner",
    instead_of: "Frozen stir-fry meal",
    replacement: "Stir-fry: chicken, broccoli, ginger, garlic, soy",
    cue: "Frozen stir-fry skimps on the protein.",
    habit_stack: "After the rice cooker beeps, the wok is hot.",
    why: "Same flavor profile, double the real ingredients.",
    identity: "Real-food eaters wok their own.",
  },
  {
    id: "dn-soup-stew",
    slot: "dinner",
    instead_of: "Canned chili or stew",
    replacement: "Slow-cooker beef stew or homemade chili",
    cue: "Canned stew is mostly salt and stabilizers.",
    habit_stack: "After breakfast, load the slow cooker.",
    why: "Eight ingredients, one pot, three nights of dinner.",
    identity: "Real-food eaters set it and forget it.",
  },

  // -----------------------------------------------------------------------
  // WIND-DOWN (21:00–04:59)  — the couch-snack moment, sleep-friendly
  // -----------------------------------------------------------------------
  {
    id: "wd-cottage-cheese-night",
    slot: "wind_down",
    instead_of: "Ice cream from the freezer",
    replacement: "Cottage cheese with a drizzle of honey + cinnamon",
    cue: "Late-night cravings hit different.",
    habit_stack: "After the show ends, scoop the curd, not the pint.",
    why: "Slow protein helps you sleep — no sugar crash at 3am.",
    identity: "Real-food eaters end the day with real food.",
  },
  {
    id: "wd-dark-choc-tea",
    slot: "wind_down",
    instead_of: "A pint of ice cream",
    replacement: "Two squares of dark chocolate + chamomile tea",
    cue: "The pint isn't the answer to a long day.",
    habit_stack: "After you brush your teeth, brew the tea.",
    why: "Real cocoa satisfies; tea cues sleep.",
    identity: "Real-food eaters keep the good chocolate close.",
  },
  {
    id: "wd-banana-pb-night",
    slot: "wind_down",
    instead_of: "Bag of chips on the couch",
    replacement: "Sliced banana with peanut butter",
    cue: "Chip-bag autopilot? Different snack, different night.",
    habit_stack: "After you sit on the couch, plate the fruit first.",
    why: "Real potassium + slow fat = better sleep, less crash.",
    identity: "Real-food eaters change the snack, change the night.",
  },
  {
    id: "wd-cheese-fruit",
    slot: "wind_down",
    instead_of: "Sleeve of cookies",
    replacement: "A piece of real cheese with apple slices",
    cue: "A small real-food plate beats a sleeve.",
    habit_stack: "After dinner cleanup, plate the cheese.",
    why: "Fat + fiber = satiety, no 1am wake-up.",
    identity: "Real-food eaters end the day deliberately.",
  },
  {
    id: "wd-greek-yogurt-night",
    slot: "wind_down",
    instead_of: "Late-night cereal bowl",
    replacement: "Greek yogurt with berries + walnuts",
    cue: "Late cereal is dessert in pajamas.",
    habit_stack: "After you turn off the TV, scoop the cup.",
    why: "Casein protein supports sleep; berries beat refined sugar.",
    identity: "Real-food eaters protect their sleep.",
  },
];

export function cardsForSlot(slot: import("@/lib/meal-slot").MealSlot): CoachCard[] {
  return COACH_CARDS.filter((c) => c.slot === slot);
}
