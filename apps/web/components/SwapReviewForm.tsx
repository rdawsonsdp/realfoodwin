"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

interface Props {
  swapId: string;
  initialStars?: number | null;
  initialNote?: string | null;
}

export function SwapReviewForm({ swapId, initialStars, initialNote }: Props) {
  const router = useRouter();
  const [stars, setStars] = useState(initialStars ?? 0);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    if (stars === 0) return;
    setSaving(true);
    try {
      await apiPost("/api/admin/review", {
        swap_id: swapId,
        stars,
        note: note.trim() || undefined,
      });
      setSavedAt(Date.now());
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const justSaved = savedAt && Date.now() - savedAt < 2500;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Reviewer rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              disabled={saving}
              className={`text-2xl leading-none transition-transform hover:scale-110 ${
                n <= stars ? "text-sunrise" : "text-ink/15"
              }`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
        {stars > 0 && <span className="text-sm text-ink-muted">{stars}/5</span>}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: why? (this note feeds the prompt — &quot;too complex for a beginner&quot;, &quot;perfect texture but skip the maple&quot;)"
        rows={2}
        className="w-full p-2.5 text-sm rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted italic">
          Saved reviews flow into the user's next swap prompt as <code className="bg-cream px-1 rounded">&lt;expert_reviewer_notes&gt;</code>.
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving || stars === 0}
          className="btn-primary py-1.5 px-4 text-sm"
        >
          {saving ? "Saving…" : justSaved ? "✓ Saved" : initialStars ? "Update" : "Save review"}
        </button>
      </div>
    </div>
  );
}
