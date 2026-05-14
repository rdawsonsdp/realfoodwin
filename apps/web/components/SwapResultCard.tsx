"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { IterationRow } from "./IterationRow";

export interface SwapResult {
  query: string;
  output: {
    title: string;
    tagline?: string;
    recipe: {
      ingredients: { name: string; quantity: string; unit?: string }[];
      steps: string[];
      time_min: number;
      difficulty?: string;
      meal_type?: string;
    };
    nutrition?: Record<string, number | undefined>;
    ingredient_analysis?: {
      item: string;
      concern_level: "fine" | "low" | "medium" | "high";
      explanation: string;
    }[];
    narrative: string;
    tuned_for_you_reasons: string[];
  } | null;
  latencyMs: number | null;
  cached: boolean;
  swapId: string | null;
}

const CONCERN_COLORS: Record<string, string> = {
  high: "bg-coral text-white",
  medium: "bg-coral-soft text-ink",
  low: "bg-honey text-ink",
  fine: "bg-sage-soft text-ink",
};

export function SwapResultCard({
  result,
  isLoggedIn,
}: {
  result: SwapResult;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentOutput, setCurrentOutput] = useState(result.output);

  if (!currentOutput) {
    return <div className="card p-8">No result.</div>;
  }

  async function onSave() {
    if (!isLoggedIn) {
      const ret = `/?q=${encodeURIComponent(result.query)}`;
      router.push(`/sign-in?next=${encodeURIComponent("/quiz?after=" + ret)}`);
      return;
    }
    if (!result.swapId) return;
    setSaving(true);
    try {
      await apiPost("/api/kitchen", { swap_id: result.swapId });
      setSaved(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="card overflow-hidden animate-fade-up">
      <div className="p-8 pb-4 bg-gradient-to-br from-honey/30 via-cream to-paper">
        <div className="flex items-center justify-between mb-4">
          <span className="badge-tuned">Tuned for you</span>
          {result.latencyMs && (
            <span className="text-xs text-ink-muted">
              {result.cached ? "Cached" : `Generated in ${(result.latencyMs / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
        <p className="text-sm text-ink-soft mb-2">
          Real-food swap for <strong>{result.query}</strong>
        </p>
        <h2 className="text-3xl font-bold tracking-tight">{currentOutput.title}</h2>
        {currentOutput.tagline && (
          <p className="text-lg text-ink-soft mt-2">{currentOutput.tagline}</p>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">
        {currentOutput.tuned_for_you_reasons.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-3">
              Why this for you
            </h3>
            <ul className="space-y-2">
              {currentOutput.tuned_for_you_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-ink-soft">
                  <span className="text-sunrise flex-shrink-0">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-3">
            Why this is better
          </h3>
          <p className="text-ink-soft leading-relaxed">{currentOutput.narrative}</p>
        </section>

        {currentOutput.ingredient_analysis && currentOutput.ingredient_analysis.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-3">
              What's in the original
            </h3>
            <div className="space-y-2">
              {currentOutput.ingredient_analysis.map((ia, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-soft bg-paper">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-pill flex-shrink-0 ${
                      CONCERN_COLORS[ia.concern_level] ?? "bg-honey text-ink"
                    }`}
                  >
                    {ia.concern_level}
                  </span>
                  <div>
                    <strong className="text-ink">{ia.item}</strong>
                    <p className="text-sm text-ink-soft">{ia.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700">
              The recipe
            </h3>
            <span className="text-sm text-ink-muted">
              {currentOutput.recipe.time_min} min
              {currentOutput.recipe.difficulty && ` · ${currentOutput.recipe.difficulty}`}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
              <ul className="space-y-1 text-ink-soft">
                {currentOutput.recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm">
                    <strong className="text-ink">{ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}</strong>{" "}
                    {ing.name}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Steps</h4>
              <ol className="space-y-2 text-ink-soft list-decimal list-inside">
                {currentOutput.recipe.steps.map((s, i) => (
                  <li key={i} className="text-sm leading-relaxed">{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {currentOutput.nutrition && Object.keys(currentOutput.nutrition).length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-3">
              Nutrition (per serving)
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Object.entries(currentOutput.nutrition).map(([k, v]) =>
                v == null ? null : (
                  <div key={k} className="p-3 rounded-soft bg-paper text-center">
                    <div className="text-xl font-bold text-ink">{v}</div>
                    <div className="text-xs uppercase tracking-wider text-ink-muted">
                      {k.replace(/_/g, " ").replace(/g$/, "g").replace(/mg$/, "mg")}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {isLoggedIn && result.swapId && (
          <IterationRow
            parentRecipe={currentOutput.recipe}
            parentRecipeId={null}
            onIterated={(out) => {
              if (out)
                setCurrentOutput({
                  ...currentOutput,
                  title: out.title,
                  recipe: out.recipe,
                });
            }}
          />
        )}
      </div>

      <div className="p-6 bg-paper border-t border-ink/5">
        {saved ? (
          <button className="btn-secondary w-full" disabled>
            ✓ Saved to My Kitchen
          </button>
        ) : (
          <button onClick={onSave} disabled={saving} className="btn-primary w-full">
            {saving ? "Saving…" : isLoggedIn ? "Save to My Kitchen" : "Save to My Kitchen — Sign up to keep this"}
          </button>
        )}
      </div>
    </article>
  );
}
