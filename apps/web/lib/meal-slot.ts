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

// ---------------------------------------------------------------------------
// Proactive coaching — the "next up" lookahead. We want the coach to stay one
// move ahead of hunger: while you're still in breakfast, surface the lunch
// play. While in snack, queue dinner. The user always sees what's coming.
// ---------------------------------------------------------------------------

const SLOT_SEQUENCE: MealSlot[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "wind_down",
];

// Hour-of-day (local) when the *next* slot begins, indexed by the current slot.
// Mirrors the boundaries in getMealSlot. wind_down rolls over to next-day 5am.
const NEXT_BOUNDARY: Record<MealSlot, number> = {
  breakfast: 10,
  lunch: 14,
  snack: 17,
  dinner: 21,
  wind_down: 5, // 5am the following day
};

export function nextMealSlot(slot: MealSlot): MealSlot {
  const idx = SLOT_SEQUENCE.indexOf(slot);
  return SLOT_SEQUENCE[(idx + 1) % SLOT_SEQUENCE.length]!;
}

// Read the local hour + minute in tz as a single fractional number.
function localFracHour(tz: string, d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  let h = 0;
  let m = 0;
  for (const part of fmt.formatToParts(d)) {
    if (part.type === "hour") h = parseInt(part.value, 10);
    if (part.type === "minute") m = parseInt(part.value, 10);
  }
  return h + m / 60;
}

// When does the next slot begin, as a Date (UTC instant)? Used to render
// "Lunch · 11:00 AM" or "in 2h" on the NEXT UP card.
export function nextSlotStartTime(
  slot: MealSlot,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Date {
  const target = NEXT_BOUNDARY[slot];
  const local = localFracHour(tz, now);

  let deltaHours: number;
  if (slot === "wind_down") {
    // After 9pm, the next slot is tomorrow's 5am breakfast. If somehow we're
    // in the 0-5am pre-dawn window (also wind_down), the next slot is today's
    // 5am — closer than waiting 24 more hours.
    deltaHours = local < target ? target - local : 24 - local + target;
  } else {
    deltaHours = target - local;
    // Defensive: if the local clock crept past the target (e.g. function
    // called *during* the boundary minute), don't return a Date in the past.
    if (deltaHours < 0) deltaHours += 24;
  }
  return new Date(now.getTime() + deltaHours * 60 * 60 * 1000);
}

// Friendly relative label: "in 2h", "in 35m", "starting now".
export function nextSlotRelative(
  slot: MealSlot,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  const start = nextSlotStartTime(slot, now, tz);
  const mins = Math.round((start.getTime() - now.getTime()) / 60000);
  if (mins <= 1) return "starting now";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  return `in ${hours}h`;
}
