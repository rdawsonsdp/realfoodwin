"use client";

import { useState } from "react";
import { OCCASIONS } from "@/lib/cuisines";

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: (occasions: string[]) => void;
  saving?: boolean;
}

// Modal that pops when the user hits "Save to My Kitchen". Lets them tag
// the occasion so the agent learns when they cook what.

export function OccasionPicker({ open, onCancel, onConfirm, saving }: Props) {
  const [chosen, setChosen] = useState<string[]>([]);
  if (!open) return null;

  function toggle(v: string) {
    setChosen((curr) => (curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v]));
  }

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 grid place-items-center p-6"
      onClick={onCancel}
    >
      <div
        className="card max-w-md w-full p-6 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-1">When will you cook this?</h3>
        <p className="text-sm text-ink-soft mb-4">
          Optional — tag the occasion so I learn when you reach for what.
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {OCCASIONS.map((o) => {
            const on = chosen.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill ring-1 transition-all text-sm ${
                  on
                    ? "bg-sunrise text-white ring-sunrise"
                    : `${o.tone} ring-ink/10 hover:ring-sunrise/40`
                }`}
              >
                <span>{o.emoji}</span>
                <span className="font-medium">{o.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between gap-2">
          <button onClick={() => onConfirm([])} className="btn-ghost">
            Skip
          </button>
          <button
            onClick={() => onConfirm(chosen)}
            disabled={saving}
            className="btn-primary py-2"
          >
            {saving ? "Saving…" : `Save${chosen.length > 0 ? ` with ${chosen.length} tag${chosen.length > 1 ? "s" : ""}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
