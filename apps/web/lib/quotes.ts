// Daily motivational quote pool for the v3 logged-in home.
//
// Quote is picked by UTC day-of-year so every user sees the same line on a
// given calendar day, and the line rotates without any DB or per-user state.
// Add more entries to extend the pool — order does not matter; the modulo
// just cycles through. Keep each text short (≤ ~18 words) so it fits the
// hero card on a 360px viewport without dwarfing the search input.

export type Quote = {
  text: string;
  author: string;
};

export const QUOTES: Quote[] = [
  {
    text: "Habits are the compound interest of self-improvement.",
    author: "James Clear",
  },
  {
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
  },
  {
    text: "Every action you take is a vote for the type of person you wish to become.",
    author: "James Clear",
  },
  {
    text: "Small habits don't add up. They compound.",
    author: "James Clear",
  },
  {
    text: "The most effective form of motivation is progress.",
    author: "James Clear",
  },
  {
    text: "Success is the product of daily habits — not once-in-a-lifetime transformations.",
    author: "James Clear",
  },
  {
    text: "Your outcomes are a lagging measure of your habits.",
    author: "James Clear",
  },
  {
    text: "The quality of our lives depends on the quality of our habits.",
    author: "James Clear",
  },
  {
    text: "Goals are good for setting direction. Systems are best for making progress.",
    author: "James Clear",
  },
  {
    text: "Motion is not action.",
    author: "James Clear",
  },
  {
    text: "Time magnifies the margin between success and failure.",
    author: "James Clear",
  },
  {
    text: "The most powerful outcomes are delayed.",
    author: "James Clear",
  },
  {
    text: "Be more concerned with your current trajectory than your current results.",
    author: "James Clear",
  },
  {
    text: "Habits are the entry point, not the end point.",
    author: "James Clear",
  },
  {
    text: "Get 1% better every day. After a year, you're 37 times better.",
    author: "James Clear",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Will Durant",
  },
  {
    text: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
  },
  {
    text: "Small daily improvements are the key to staggering long-term results.",
    author: "Robin Sharma",
  },
];

// Return today's quote. Uses UTC day so the rotation flips at the same moment
// for every user regardless of timezone — keeps "did you see today's quote?"
// conversations consistent.
export function getQuoteForToday(date: Date = new Date()): Quote {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((utc - yearStart) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length]!;
}
