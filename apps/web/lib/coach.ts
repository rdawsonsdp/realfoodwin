// Coach personality — warm, encouraging, food-coach voice. Used in greetings,
// empty states, success copy. Never preachy, never medical, never corporate.

function firstName(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName && displayName.trim()) {
    return displayName.trim().split(/\s+/)[0]!;
  }
  if (email) return email.split("@")[0]!;
  return "friend";
}

export function timeOfDay(d: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function timeGreeting(d: Date = new Date()): string {
  const t = timeOfDay(d);
  return t === "morning" ? "Good morning" : t === "afternoon" ? "Good afternoon" : "Good evening";
}

interface CoachContext {
  displayName?: string | null;
  email?: string | null;
  hasSwapsToday?: boolean;
  hasKitchenSaves?: boolean;
  topGoal?: string | null;
}

// Pick a stable line per day per user (deterministic on day-of-year + name).
function pickStable<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length]!;
}

const PROMPTS_MORNING = [
  "Let's swap something healthy today.",
  "What's in the pantry that we can upgrade?",
  "What's on the menu this morning?",
  "Coffee in hand — what are we cooking up?",
];
const PROMPTS_AFTERNOON = [
  "Snack attack? Let's find a real-food version.",
  "Lunch break — let's plan dinner.",
  "What's tonight looking like?",
  "Got a craving? Tell me what — I've got an upgrade.",
];
const PROMPTS_EVENING = [
  "What sounds good for dinner?",
  "Let's swap tonight's ultra-processed pick.",
  "End-of-day cravings — name it, I've got real food in mind.",
  "Weeknight rescue mode. What are we fixing?",
];

const PROMPTS_GOAL: Record<string, string[]> = {
  "feed-kids-better": [
    "Kids hungry? Let's find something they'll eat and you'll feel good about.",
    "What's the kid-snack we're upgrading today?",
  ],
  "lose-weight": [
    "Let's find a lighter version of what you'd eat anyway.",
    "Lower-cal swap — say the word.",
  ],
  "reduce-inflammation": [
    "Anti-inflammatory mode. What's on the swap list?",
    "Let's find a cleaner version of your usual.",
  ],
  "get-off-ultra-processed": [
    "Name the ultra-processed thing — I'll find the real-food version.",
    "What's the package we're ditching today?",
  ],
  "more-energy": [
    "Steady-energy swap coming up. What's the target?",
    "Let's find food that fuels, not crashes.",
  ],
  "just-curious": [
    "Pick anything in your pantry — let's see what real-food looks like.",
    "Got something you're curious about? Let's swap it.",
  ],
};

export interface Greeting {
  headline: string;
  prompt: string;
}

export function buildGreeting(ctx: CoachContext, d: Date = new Date()): Greeting {
  const name = firstName(ctx.displayName, ctx.email);
  const headline = `${timeGreeting(d)}, ${name}.`;

  const dayKey = `${d.toISOString().slice(0, 10)}|${name}`;
  let pool: string[];
  if (ctx.topGoal && PROMPTS_GOAL[ctx.topGoal]) {
    pool = [...PROMPTS_GOAL[ctx.topGoal]!];
    // Mix in a time-of-day line so it varies.
    pool.push(...timePool(d));
  } else {
    pool = timePool(d);
  }
  const prompt = pickStable(pool, dayKey);

  return { headline, prompt };
}

function timePool(d: Date): string[] {
  const t = timeOfDay(d);
  return t === "morning"
    ? PROMPTS_MORNING
    : t === "afternoon"
      ? PROMPTS_AFTERNOON
      : PROMPTS_EVENING;
}

// Empty / success / encouragement lines used across the app.
export const COACH_COPY = {
  emptyKitchen: "Your kitchen is quiet. Let's fix that — try a swap above.",
  savedCelebration: "Locked in. Cook it this week and tell me how it lands.",
  ratedThanks: "Got it. Every rating tunes me to your palate.",
  madeItLoved: "Beautiful. That's how we build a real-food kitchen.",
  quizDone: "Now I know who I'm cooking with. Let's find your first real-food win.",
  signedOut: "See you soon — your kitchen will be right here.",
};
