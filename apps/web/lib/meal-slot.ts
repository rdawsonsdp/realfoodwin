// Time-of-day → meal slot mapping for the v2 home coach.
// The slot drives which curated coach card we show (the "cue" in James Clear's
// four laws: make the right choice obvious at the moment it matters).
//
// v1: timezone is hardcoded to America/Los_Angeles. We compute the local hour
// from the browser-agnostic Intl API so server-rendered output matches whatever
// time we'd show the user. Per-user tz capture is a later upgrade.

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner" | "wind_down";

const DEFAULT_TZ = "America/Los_Angeles";

export interface MealSlotInfo {
  slot: MealSlot;
  label: string; // "Snack window"
  icon: string; // single glyph used in the colored tile (no photos in v1)
  tile: string; // tailwind classes for the swap tile background
  cuePrefix: string; // "It's almost lunch."
}

const SLOT_INFO: Record<MealSlot, Omit<MealSlotInfo, "slot">> = {
  breakfast: {
    label: "Breakfast window",
    icon: "🌅",
    tile: "bg-honey/40 text-ink",
    cuePrefix: "Morning fuel matters.",
  },
  lunch: {
    label: "Lunch window",
    icon: "🥗",
    tile: "bg-sage-soft text-ink",
    cuePrefix: "Lunch sets the afternoon.",
  },
  snack: {
    label: "Snack window",
    icon: "🍎",
    tile: "bg-coral-soft text-ink",
    cuePrefix: "The 3pm slump is real.",
  },
  dinner: {
    label: "Dinner window",
    icon: "🍽",
    tile: "bg-sunrise-100 text-ink",
    cuePrefix: "Dinner is the easiest swap to win.",
  },
  wind_down: {
    label: "Wind-down window",
    icon: "🌙",
    tile: "bg-forest-100 text-ink",
    cuePrefix: "Late-night cravings hit different.",
  },
};

// Read the local hour in DEFAULT_TZ regardless of where the code runs.
function localHourIn(tz: string, d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  // formatToParts so we can pull the hour cleanly without locale quirks.
  for (const part of fmt.formatToParts(d)) {
    if (part.type === "hour") return parseInt(part.value, 10);
  }
  return d.getHours();
}

export function getMealSlot(d: Date = new Date(), tz: string = DEFAULT_TZ): MealSlot {
  const h = localHourIn(tz, d);
  if (h >= 5 && h < 10) return "breakfast";
  if (h >= 10 && h < 14) return "lunch";
  if (h >= 14 && h < 17) return "snack";
  if (h >= 17 && h < 21) return "dinner";
  return "wind_down"; // 21:00–04:59
}

export function mealSlotInfo(slot: MealSlot): MealSlotInfo {
  return { slot, ...SLOT_INFO[slot] };
}

// Localized "3:14 PM" string for the hero strip.
export function localClock(d: Date = new Date(), tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

// "Good morning" / "Good afternoon" / "Good evening" tied to the slot, not the
// raw hour — so wind-down still says "Good evening" instead of slipping to
// "Good morning" at 23:00.
export function slotGreeting(slot: MealSlot): string {
  if (slot === "breakfast") return "Good morning";
  if (slot === "lunch") return "Good afternoon";
  if (slot === "snack") return "Good afternoon";
  if (slot === "dinner") return "Good evening";
  return "Good evening";
}

export const DEFAULT_TIMEZONE = DEFAULT_TZ;
