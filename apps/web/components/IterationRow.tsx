"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

const PRESETS = [
  "Make it dairy-free",
  "Scale to 6 servings",
  "Make it faster",
  "Make it kid-friendlier",
  "Use what I have",
];

export function IterationRow({
  parentRecipe,
  parentRecipeId,
  onIterated,
}: {
  parentRecipe: unknown;
  parentRecipeId: string | null;
  onIterated: (
    out: {
      title: string;
      recipe: {
        ingredients: { name: string; quantity: string; unit?: string }[];
        steps: string[];
        time_min: number;
      };
      change_summary: string[];
    } | null,
  ) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [customText, setCustomText] = useState("");
  const [changes, setChanges] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function iterate(modification: string) {
    setLoading(true);
    setError(null);
    setChanges(null);
    try {
      const data = await apiPost<{ output: Parameters<typeof onIterated>[0] }>(
        "/api/iterate",
        {
          parent_recipe: parentRecipe,
          modification,
          parent_recipe_id: parentRecipeId ?? undefined,
        },
      );
      onIterated(data.output);
      if (data.output) setChanges(data.output.change_summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setOpenModal(false);
      setCustomText("");
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-3">
        Tweak this
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            disabled={loading}
            onClick={() => iterate(p)}
            className="chip flex-shrink-0 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
        <button
          disabled={loading}
          onClick={() => setOpenModal(true)}
          className="chip flex-shrink-0 disabled:opacity-50 bg-sunrise/10 text-sunrise-700"
        >
          Modify…
        </button>
      </div>

      {loading && (
        <p className="text-sm text-ink-muted italic mt-3">Iterating…</p>
      )}

      {changes && (
        <div className="mt-4 p-4 rounded-soft bg-sage-soft/40 border border-sage/20">
          <h4 className="text-sm font-semibold mb-2">Changes</h4>
          <ul className="text-sm text-ink-soft space-y-1">
            {changes.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-coral mt-3">{error}</p>
      )}

      {openModal && (
        <div className="fixed inset-0 bg-ink/40 z-50 grid place-items-center p-6">
          <div className="card max-w-md w-full p-6 animate-fade-up">
            <h3 className="text-lg font-bold mb-3">Tell us what to change</h3>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g., make it less spicy and add chickpeas"
              rows={3}
              className="w-full p-3 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpenModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button
                disabled={loading || customText.trim().length < 3}
                onClick={() => iterate(customText.trim())}
                className="btn-primary py-2"
              >
                Iterate
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
