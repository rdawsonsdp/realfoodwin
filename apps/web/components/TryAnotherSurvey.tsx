"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { VoiceButton } from "./VoiceButton";

const QUICK_REASONS = [
  { value: "just-looking", label: "Just looking", emoji: "👀" },
  { value: "want-variations", label: "Just trying different variations", emoji: "🔄" },
  { value: "too-complex", label: "Too complex", emoji: "🤯" },
  { value: "weird-ingredients", label: "Weird ingredients", emoji: "🤔" },
  { value: "too-time-consuming", label: "Too time-consuming", emoji: "⏱" },
  { value: "doesnt-fit-diet", label: "Doesn't fit my diet", emoji: "🥦" },
  { value: "missing-ingredients", label: "Don't have those ingredients", emoji: "🛒" },
  { value: "not-what-i-wanted", label: "Not what I wanted", emoji: "❓" },
];

interface Props {
  swapId: string | null;
  query: string;
  onDone: () => void;
  onCancel: () => void;
}

// Quick "why didn't this work?" survey shown before we whisk the user back to
// the swap screen. Captures one of the preset reasons OR a free-form note
// (voice-enabled), logs to events, then continues.

export function TryAnotherSurvey({ swapId, query, onDone, onCancel }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send(reason: string | null, finalCustom: string) {
    setSubmitting(true);
    try {
      await apiPost("/api/events", {
        event_type: reason ? "try_another_reason" : "try_another_skipped",
        target_type: swapId ? "swap" : null,
        target_id: swapId ?? undefined,
        metadata: {
          query,
          reason: reason ?? "skip",
          custom: finalCustom.trim() || undefined,
          summary: reason
            ? `Try another for "${query}" — ${reason}${
                finalCustom.trim() ? `: ${finalCustom.trim()}` : ""
              }`
            : `Try another for "${query}" — no reason given`,
        },
      });
    } catch {
      // anonymous users hit auth — that's fine, just continue
    } finally {
      onDone();
    }
  }

  function submitChosen() {
    const reason = picked ?? (custom.trim() ? "other" : null);
    void send(reason, custom);
  }

  return (
    <div
      className="bottom-sheet-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bottom-sheet p-5 md:p-6 space-y-5 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-grabber" aria-hidden />
        <header>
          <h2 className="text-xl font-bold text-ink">
            <span aria-hidden>🔄</span> What should we try next?
          </h2>
          <p className="text-sm text-ink-soft">
            One tap helps the AI pick something better next time.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setPicked(r.value);
                // One-tap commits: log and continue.
                void send(r.value, custom);
              }}
              disabled={submitting}
              className={
                "chip transition-all " +
                (picked === r.value ? "ring-2 ring-coral bg-honey" : "")
              }
            >
              <span aria-hidden>{r.emoji}</span> {r.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-ink">
            Or tell me in your own words
          </label>
          <div className="flex gap-2 items-start">
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Tap the mic or type — what were you actually looking for?"
              rows={3}
              disabled={submitting}
              className="flex-1 px-3 py-2 text-base rounded-soft border border-ink/15 bg-paper text-ink focus:outline-none focus:border-coral resize-none"
            />
            <div className="self-stretch flex items-center">
              <VoiceButton
                disabled={submitting}
                onTranscript={(text, isFinal) => {
                  if (!text) return;
                  setCustom((prev) => {
                    if (!prev) return text;
                    if (isFinal) return `${prev.trim()} ${text}`.trim();
                    return prev;
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-ink/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost text-sm"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => send(null, "")}
              disabled={submitting}
              className="btn-ghost text-sm"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={submitChosen}
              disabled={submitting || (!picked && !custom.trim())}
              className="btn-primary"
            >
              {submitting ? "Saving…" : "Submit & try again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
