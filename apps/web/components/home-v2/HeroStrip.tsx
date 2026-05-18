// Top strip on the v2 home — greeting, local clock, and the meal-slot tag.
// This is the "obvious" cue (Clear, Law 1): the user sees *what time it is*
// and *what kind of food window they're in* before anything else.
//
// Renders on the server so the first paint has the correct slot — no flicker.

import {
  type MealSlot,
  localClock,
  mealSlotInfo,
  slotGreeting,
} from "@/lib/meal-slot";

interface Props {
  firstName: string;
  slot: MealSlot;
  now: Date;
}

export function HeroStrip({ firstName, slot, now }: Props) {
  const info = mealSlotInfo(slot);
  return (
    <section className="mb-6 md:mb-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-paper">
          {slotGreeting(slot)}, {firstName}.
        </h1>
        <span className="text-paper/70 text-sm md:text-base font-medium tabular-nums">
          {localClock(now)}
        </span>
      </div>
      <p className="mt-1 text-sm md:text-base text-paper/80">
        <span className="mr-2">{info.icon}</span>
        <span className="font-medium">{info.label}</span>
      </p>
    </section>
  );
}
