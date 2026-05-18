// Curated coach card library for the v2 home page.
//
// Each card is the *cue + routine + reward* James Clear talks about, condensed
// into one screen unit. Voice: warm-friend health coach. Never preach. Frame
// every swap as an upgrade, never as deprivation.
//
// v1 has no food photos — the card uses a colored tile + a single glyph driven
// by meal slot. That keeps coaching front-and-center (vs. food-marketing aesthetic)
// and lets us ship 30+ cards without imagery.
//
// `coaching` is the deeper "why this works" — surfaced after a user has *made*
// a swap, in the look-back Coach's Notes section. Goal: educate while we coach,
// so the user starts to know what they're doing, not just follow.

import type { MealSlot } from "@/lib/meal-slot";

export interface CoachCard {
  id: string;
  slot: MealSlot;
  instead_of: string;
  replacement: string;
  cue: string;
  habit_stack: string;
  why: string; // one-liner shown on the front of the card
  identity: string; // "Real-food eaters reach for…" — surfaced after action
  coaching: string; // 2-3 sentence depth shown in Coach's Notes after they make it
  tags?: string[];
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
    coaching:
      "Eggs are one of the most complete proteins on the planet — choline for the brain, leucine for muscle, vitamin D, B12. Pairing them with avocado adds monounsaturated fat that slows digestion, so blood sugar climbs gently from 7am to 11am instead of spiking and dropping. That's why your 10:30 inbox felt manageable instead of cookie-shaped.",
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
    coaching:
      "A typical flavored yogurt has 18-24g of added sugar — about a candy bar's worth before 9am. Plain Greek yogurt is mostly casein protein, which digests slowly and keeps you full for hours. The honey and berries deliver sweetness with fiber attached, so the sugar enters your bloodstream at a manageable pace.",
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
    coaching:
      "Rolled oats are a beta-glucan fiber powerhouse — it gels in your gut and slows glucose absorption. Add almond butter and the protein-fat-fiber trio means even energy until lunch. Granola bars marketed as 'healthy' are usually 60% refined sugar and oils that crash you within an hour.",
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
    coaching:
      "Fast-food breakfast sandwiches are fried in industrial seed oils that are repeatedly heated — chemistry that drives inflammation over time. Your home pan with butter or olive oil delivers the same satisfaction, real eggs (with the yolk's nutrients intact), and you control the salt. Five minutes saves your gut and your wallet.",
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
    coaching:
      "When you blend whole fruit at home, the fiber stays — that's what blunts the sugar spike. Bottled smoothies often strain the fiber out or use fruit-juice concentrate, which is essentially sweetened water. Adding nut butter introduces fat that further smooths the glucose curve and keeps you satisfied past 10am.",
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
    coaching:
      "One cup of cottage cheese has ~25g of protein for ~200 calories — denser than nearly any breakfast you can buy in a wrapper. Pastries are usually 30g+ of refined sugar and 0 protein, which is why you're hungry again in 90 minutes. Real fruit adds vitamin C and just enough natural sweetness to satisfy.",
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
    coaching:
      "Two tablespoons of chia seeds bring ~10g of fiber and a respectable dose of omega-3s. They absorb up to 12x their weight in liquid, which is why chia pudding keeps you full longer than the calories suggest. Most breakfast cereals deliver the opposite ratio: ~10g sugar, ~1g fiber.",
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
    coaching:
      "Chickpeas are slow-digesting starch wrapped in fiber and ~15g of plant protein per cup. Olive oil's monounsaturated fat adds satiety without inflammation. Fast-food combos hit ~1,200 calories with refined carbs and seed oils — the calorie math is similar but your afternoon energy isn't even close.",
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
    coaching:
      "A frozen lunch entrée routinely carries 800-1,400mg of sodium — sometimes more than half your daily intake — plus emulsifiers and gums that recent research suggests irritate the gut lining. Your leftovers from last night cost you nothing extra, took zero new prep, and you know every ingredient that went in.",
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
    coaching:
      "A canned tuna lunch delivers ~25g of high-quality protein and a hit of omega-3s for ~$2. The same convenience pack on the shelf gives you ~10g of protein, plus nitrates and added sugars. Tuna with olive oil instead of mayo adds anti-inflammatory fat instead of seed oil.",
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
    coaching:
      "Condensed canned soup typically lists ~890mg sodium per serving (and most of us eat the whole can, doubling that). Homemade lets you salt to your taste, and the slow-cooked beans plus vegetables deliver fiber, magnesium, and potassium — the trio your nervous system runs on. One Sunday pot covers four weekday lunches.",
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
    coaching:
      "Most fast-casual sauces are seed-oil mayonnaise bases with high-fructose corn syrup or sugar early in the ingredient list — that's where the addictive 'something extra' comes from. Hummus delivers the same creamy mouthfeel with chickpea protein and olive oil. Same satisfaction signal, very different metabolic story.",
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
    coaching:
      "Quinoa is a complete protein — rare for a grain — and brings magnesium and slow-burn carbs. Tahini adds calcium and the kind of fat that actually helps you absorb the fat-soluble vitamins in the roasted veg. Drive-thru bowls usually finish with a sweetened, seed-oil-based dressing that erases most of the nutritional win.",
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
    coaching:
      "The apple's fiber slows the natural sugars; the almond butter's protein and fat further blunt the glucose curve. M&Ms spike blood sugar in ~30 minutes and drop it just as fast — by 3:45 you'd be hungrier than before. This swap gives you ~90 minutes of steady energy with no rebound craving.",
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
    coaching:
      "Cocoa above 70% is rich in flavanols, which research links to improved blood-flow and lower blood pressure. Almonds add vitamin E and the kind of fat that makes the chocolate satisfying in small portions. Sweetened trail mix with M&Ms is mostly the candy by weight — closer to dessert than to a stable snack.",
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
    coaching:
      "Snack-pack pudding is roughly 20g of sugar and ~2g of protein — calorie for calorie, that's a guaranteed crash. Greek yogurt flips that ratio: ~17g protein, minimal sugar (and the honey you add lands gently because the protein and fat slow its absorption). Plus the live cultures support a healthier gut microbiome over time.",
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
    coaching:
      "Chickpea-based hummus delivers ~8g of plant protein and ~7g of fiber per half cup — exactly the macros that fight an afternoon crash. The vegetables triple the fiber and pile on micronutrients that processed crackers can't carry. Crunch satisfaction is partly oral, partly cognitive — your brain doesn't care if it's a chip.",
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
    coaching:
      "Most 'protein bars' deliver 15-20g of protein alongside sugar alcohols (which cause GI distress), seed oils, and glycerin syrups that aren't doing your gut any favors. Cottage cheese matches the protein, brings natural casein for slow release, and pineapple adds bromelain — an enzyme that helps digestion. Wrapper-free.",
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
    coaching:
      "Two eggs deliver ~12g of complete protein and significant choline — a nutrient most adults under-consume that matters for memory and mood. Vending packs are designed around shelf stability and texture, not satiety, which is why you can finish a whole bag and still be hungry. Eggs are the original snack technology.",
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
    coaching:
      "Plain popcorn is whole-grain corn — high fiber, surprisingly low calorie for the volume. Microwave bags pack flavorings, hydrogenated oils, and (in some brands) PFAS coatings on the liner. Stovetop in olive oil delivers the same crunch with monounsaturated fat that's actively good for your heart.",
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
    coaching:
      "Most mainstream jerky is sweetened with brown sugar or corn syrup, preserved with sodium nitrite, and flavored with MSG-family compounds. Clean-ingredient jerky and biltong (a South African air-dried beef) keep the protein dense — ~11g per ounce — and skip the sugar that makes it taste closer to candy.",
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
    coaching:
      "A medium banana brings ~420mg of potassium — important for muscle and nerve function, and most American diets are short on it. Peanut butter (the kind with just peanuts and salt) adds protein and fat that turn the banana's natural sugar into steady energy. Granola bars are typically 30%+ added sugar held together by oils.",
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
    coaching:
      "Chicken thighs are richer in iron and zinc than breasts and stay forgiving in the oven — almost impossible to dry out. Roasting vegetables in olive oil caramelizes their natural sugars (called the Maillard reaction) which is what makes 'real food' actually taste good. Frozen dinners deliver flavor with salt and additives because the cook can't bring the heat.",
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
    coaching:
      "A jar of crushed tomatoes delivers lycopene — an antioxidant that's actually more bioavailable when cooked. Real parmesan brings calcium and umami without the powder coating's emulsifiers. Boxed kits hit you with ~700mg of sodium per serving and a list of ingredients your grandparent couldn't pronounce.",
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
    coaching:
      "Ground beef seared hard in a cast iron develops a crust through the Maillard reaction — the same flavor source as the chain burger, minus the seed-oil deep-fry environment. You control the bun quality, the fat ratio, and the salt. Twelve minutes from craving to plate, and your gut doesn't have to process the additive list.",
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
    coaching:
      "A taco seasoning packet is typically maltodextrin, anti-caking agents, MSG, and just a sprinkle of actual spice. Five whole spices from your rack deliver more flavor and antioxidant compounds — cumin, paprika, and garlic each bring their own anti-inflammatory profile. Bonus: a $5 spice rack lasts months versus packet after packet.",
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
    coaching:
      "Salmon is the single best dietary source of EPA and DHA omega-3s — the fats your brain literally builds itself with. Twelve minutes in a hot pan gets you a perfect crust without the soy-sauce sodium load of a takeout roll. Sautéed greens add folate and the kind of fat-soluble vitamins that need the salmon's fat to absorb.",
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
    coaching:
      "A frozen stir-fry bag is heavy on rice/noodles and light on actual protein and vegetables — that's how it stays cheap. Cooked-at-home, you typically double the chicken and quadruple the broccoli for the same calorie count. Fresh ginger and garlic bring active compounds (gingerol and allicin) that the frozen versions can't preserve.",
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
    coaching:
      "Slow-cooked beef breaks down its collagen into gelatin — the kind of nourishing broth that's been a staple in every traditional food culture for a reason. Beans add fiber and resistant starch that feed your gut microbiome. Canned versions sub in stabilizers like modified food starch to mimic that body, plus enough sodium to keep them shelf-stable for years.",
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
    coaching:
      "Cottage cheese is rich in casein — a slow-digesting protein athletes use specifically before sleep because it releases amino acids over 6-8 hours. Cinnamon helps modulate blood sugar overnight. Ice cream's sugar load can spike then crash your blood sugar at 3am, which is one of the most reliable sources of a 'why am I awake' moment.",
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
    coaching:
      "Two squares of 70%+ dark chocolate hit the same reward pathways as the pint but in ~80 calories rather than 800 — your brain doesn't actually need more than that. Chamomile contains apigenin, a compound that binds to brain receptors that promote drowsiness. The ritual of brewing tea is itself a sleep cue — your body learns the sequence.",
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
    coaching:
      "Bananas contain magnesium and tryptophan — the precursor to serotonin and melatonin, your sleep hormones. Peanut butter's fat slows the natural sugar release so your insulin doesn't spike right before bed. Chips, by contrast, are engineered to be 'bottomless' — the salt-fat-crunch combo overrides your fullness signal, which is why the bag disappears.",
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
    coaching:
      "A piece of real aged cheese delivers fat, protein, and calcium — and the small portion is naturally self-limiting (you don't crave a second). Apple's fiber adds slow sugar release. Cookies are engineered to bypass satiety: refined flour and sugar with no fiber and minimal protein, which is why 'just one' rarely is.",
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
    coaching:
      "Greek yogurt's casein protein digests slowly — perfect for overnight muscle recovery without spiking blood sugar. Walnuts are one of the few plant sources of melatonin and bring ALA omega-3s your brain uses overnight. Late-night cereal is concentrated sugar that crashes between 2-3am, the exact window where insomnia often starts.",
  },
];

export function cardsForSlot(slot: import("@/lib/meal-slot").MealSlot): CoachCard[] {
  return COACH_CARDS.filter((c) => c.slot === slot);
}

export function cardById(id: string): CoachCard | undefined {
  return COACH_CARDS.find((c) => c.id === id);
}
