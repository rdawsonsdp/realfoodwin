// CoachDashboard — the morning dashboard at the top of /home-v2.
//
// Visually it's a coach's clipboard: dark metal clip at the top with two
// hinge dots, a cream "paper" body with very faint horizontal ruled lines,
// and dashed perforation dividers between three sections that read like the
// pages of a playbook:
//
//   1. Today's play  — the time-of-day swap suggestion (CoachCard)
//   2. Coach's call  — the conversational coach (CoachChat)
//   3. Yesterday's tape — the look-back education depth (CoachNotes)
//
// Each child receives `inDashboard={true}` so its own ring/shadow is stripped
// and this single frame owns the chrome.

import type { ReactNode } from "react";
import { localClock, mealSlotInfo, type MealSlot } from "@/lib/meal-slot";

interface Props {
  slot: MealSlot;
  now: Date;
  // The four sections — pre-built by the page so we don't have to thread
  // every prop through here. Pass `null` for any section that should hide.
  play: ReactNode;
  nextUp?: ReactNode | null;
  call: ReactNode;
  tape?: ReactNode | null;
}

export function CoachDashboard({ slot, now, play, nextUp, call, tape }: Props) {
  const info = mealSlotInfo(slot);
  const playLabel = `${info.label.replace(" window", "").toUpperCase()} PLAY`;

  // Faint ruled-paper background — a 28px repeating gradient. Tuned dark
  // enough to read as "lined paper" but not so dark it competes with text.
  const ruledPaper = {
    backgroundColor: "var(--paper, #FAF6EF)",
    backgroundImage:
      "repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, rgba(26, 26, 46, 0.06) 28px)",
  };

  return (
    <section className="mb-8 relative">
      {/* The clipboard frame. Slight outer ring + soft shadow so it feels
          like it's resting on the page. */}
      <div className="rounded-soft overflow-hidden ring-1 ring-ink/10 shadow-card">
        {/* Metal clip header — dark forest band, two hinge dots flanking a
            central label. The whole clip is one strip so it reads as
            hardware, not chrome. */}
        <div className="relative bg-forest-700 text-paper px-5 py-3 md:px-6 md:py-3.5">
          {/* Hinge dots */}
          <span
            aria-hidden
            className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-paper/30 ring-1 ring-paper/40 shadow-inner"
          />
          <span
            aria-hidden
            className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-paper/30 ring-1 ring-paper/40 shadow-inner"
          />
          {/* Central label */}
          <div className="text-center flex items-center justify-center gap-2 flex-wrap">
            <span aria-hidden className="text-lg leading-none">
              📋
            </span>
            <span className="text-[11px] md:text-xs uppercase tracking-[0.22em] font-bold">
              Today&apos;s playbook
            </span>
            <span className="text-[11px] md:text-xs font-semibold text-paper/70 tabular-nums">
              · {localClock(now)}
            </span>
          </div>
        </div>

        {/* Paper body — cream background with very faint ruled lines. The
            three children sit on top with dashed perforation between them. */}
        <div style={ruledPaper}>
          {/* Section 1: today's play */}
          <div className="relative">
            <div className="px-5 pt-4 md:px-6 md:pt-5">
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-forest-700">
                {playLabel}
              </p>
            </div>
            {play}
          </div>

          {/* Perforation */}
          <div aria-hidden className="mx-5 md:mx-6 border-t border-dashed border-ink/15" />

          {/* Section 1.5: next up — proactive lookahead. Only renders if the
              page passed a node. Visually quieter than TODAY'S PLAY by design;
              it's a queued move, not the headline. */}
          {nextUp && (
            <>
              <div className="relative">
                <div className="px-5 pt-4 md:px-6 md:pt-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-forest-700">
                    Next up
                  </p>
                </div>
                {nextUp}
              </div>
              <div aria-hidden className="mx-5 md:mx-6 border-t border-dashed border-ink/15" />
            </>
          )}

          {/* Section 2: coach's call */}
          <div className="relative">
            <div className="px-5 pt-4 md:px-6 md:pt-5">
              <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-forest-700">
                Coach&apos;s call
              </p>
            </div>
            {call}
          </div>

          {/* Section 3: yesterday's tape (only if there's something to show) */}
          {tape && (
            <>
              <div aria-hidden className="mx-5 md:mx-6 border-t border-dashed border-ink/15" />
              <div className="relative">
                <div className="px-5 pt-4 md:px-6 md:pt-5">
                  <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-forest-700">
                    Yesterday&apos;s tape
                  </p>
                </div>
                {tape}
              </div>
            </>
          )}

          {/* Tiny bottom spacer so the paper has air below the last section. */}
          <div className="h-2" />
        </div>
      </div>
    </section>
  );
}
