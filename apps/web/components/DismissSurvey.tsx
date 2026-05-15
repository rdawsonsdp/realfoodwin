"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { DISMISS_REASONS } from "@/lib/cuisines";

interface Props {
  swapId: string | null;
  query: string;
  onDone: () => void;
}

// Compact 4-chip survey that shows when the user dismisses a swap result.
// Records the reason as an event so the agent stops repeating those mistakes.

export function DismissSurvey({ swapId, query, onDone }: Props) {
  const [submitted, setSubmitted] = useState(false);

  async function chooseReason(reason: string) {
    setSubmitted(true);
    try {
      await apiPost("/api/events", {
        event_type: "dismissed_swap",
        target_type: swapId ? "swap" : null,
        target_id: swapId ?? undefined,
        metadata: {
          query,
          reason,
          summary: `Dismissed ${query} swap — reason: ${reason}`,
        },
      });
    } catch {
      // anonymous users will hit auth — fine, just continue
    } finally {
      setTimeout(onDone, 600);
    }
  }

  return (
    <div className="card p-5 animate-fade-up">
      {submitted ? (
        <p className="text-center text-sage font-semibold">
          Got it — I'll keep that in mind.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-soft mb-3 text-center">
            Quick — what was off about that swap?
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {DISMISS_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => chooseReason(r.value)}
                className="chip"
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="text-center mt-3">
            <button onClick={onDone} className="btn-ghost text-xs">
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}
