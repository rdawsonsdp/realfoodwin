"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { IterationRow } from "./IterationRow";
import { RecipeActions } from "./RecipeActions";
import { StarRating } from "./StarRating";
import { FoodConfetti } from "./FoodConfetti";

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
    product_url?: string | null;
    brand_name?: string | null;
    product_image_url?: string | null;
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
  onTryAnotherVersion,
  retryingVersion,
}: {
  result: SwapResult;
  isLoggedIn: boolean;
  onTryAnotherVersion?: () => void;
  retryingVersion?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [currentOutput, setCurrentOutput] = useState(result.output);

  useEffect(() => {
    if (result.output) setCelebrate(true);
  }, [result.query]);

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
      setCelebrate(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const isProduct =
    !!currentOutput.product_url &&
    currentOutput.recipe.ingredients.length === 0 &&
    currentOutput.recipe.steps.length === 0;

  if (isProduct) {
    return (
      <article className="card overflow-hidden animate-fade-up">
        <header className="p-8 bg-gradient-to-br from-honey/30 via-cream to-paper">
          <div className="flex items-center justify-between mb-4">
            <span className="badge-tuned">Tuned for you · Product pick</span>
            {result.latencyMs && (
              <span className="text-xs text-ink-muted">
                {result.cached ? "Cached" : `Generated in ${(result.latencyMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft mb-2">
            Real-food product for <strong>{result.query}</strong>
          </p>
          <div className="flex flex-col md:flex-row md:items-center gap-6 mt-4">
            {currentOutput.product_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentOutput.product_image_url}
                alt={currentOutput.title}
                className="w-32 h-32 object-contain rounded-soft bg-white p-2 shadow-card"
                loading="lazy"
              />
            ) : (
              <div className="w-32 h-32 rounded-soft bg-cream grid place-items-center text-3xl font-bold text-ink-muted shadow-card">
                {currentOutput.title?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {currentOutput.brand_name && (
                <p className="text-xs uppercase tracking-[0.18em] text-ink-muted mb-1">
                  {currentOutput.brand_name}
                </p>
              )}
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight break-words">
                {currentOutput.title}
              </h2>
              {currentOutput.tagline && (
                <p className="text-lg text-ink-soft mt-2">{currentOutput.tagline}</p>
              )}
            </div>
          </div>
        </header>

        <div className="px-8 py-5 bg-white border-y border-ink/5">
          <p className="text-ink-soft leading-relaxed">{currentOutput.narrative}</p>
        </div>

        <div className="p-8 flex flex-wrap items-center gap-3 print:hidden">
          <a
            href={currentOutput.product_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Visit on {currentOutput.brand_name ?? "the brand site"} →
          </a>
          {onTryAnotherVersion && (
            <button
              type="button"
              onClick={onTryAnotherVersion}
              disabled={retryingVersion}
              className="btn-secondary"
            >
              {retryingVersion ? "Cooking another…" : "🔄 Try another version"}
            </button>
          )}
        </div>

        <FoodConfetti active={celebrate} onDone={() => setCelebrate(false)} />
      </article>
    );
  }

  const reasonsCount = currentOutput.tuned_for_you_reasons.length;
  const concernCount = currentOutput.ingredient_analysis?.length ?? 0;
  const ingCount = currentOutput.recipe.ingredients.length;
  const stepCount = currentOutput.recipe.steps.length;
  const nutritionKeys = currentOutput.nutrition
    ? Object.entries(currentOutput.nutrition).filter(([, v]) => v != null).length
    : 0;

  return (
    <article className="card overflow-hidden animate-fade-up">
      {/* Hero — the only thing visible until the user starts unfolding */}
      <header className="p-8 bg-gradient-to-br from-honey/30 via-cream to-paper">
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
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {currentOutput.title}
        </h2>
        {currentOutput.tagline && (
          <p className="text-lg text-ink-soft mt-3">{currentOutput.tagline}</p>
        )}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-muted">
            {currentOutput.recipe.time_min} min
            {currentOutput.recipe.difficulty && ` · ${currentOutput.recipe.difficulty}`}
            {currentOutput.recipe.meal_type && ` · ${currentOutput.recipe.meal_type}`}
          </span>
          {onTryAnotherVersion && (
            <>
              <span className="text-ink-muted text-xs">·</span>
              <button
                onClick={onTryAnotherVersion}
                disabled={retryingVersion}
                className="text-xs px-3 py-1.5 rounded-pill border border-sunrise/40 text-sunrise-700 hover:bg-sunrise/10 disabled:opacity-50 inline-flex items-center gap-1"
                title="Generate a different real-food swap from the same query"
              >
                {retryingVersion ? "Cooking another…" : "🔄 Try another version"}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Print / share actions — uses the same shape the recipe detail page does */}
      <div className="px-8 py-3 bg-paper border-y border-ink/5 print:hidden">
        <RecipeActions
          recipe={{
            title: currentOutput.title,
            ingredients: currentOutput.recipe.ingredients,
            steps: currentOutput.recipe.steps,
            time_min: currentOutput.recipe.time_min,
            difficulty: currentOutput.recipe.difficulty ?? null,
            meal_type: currentOutput.recipe.meal_type ?? null,
          }}
          shareUrl={result.swapId ? `/swap/${result.swapId}` : undefined}
        />
      </div>

      {/* Quick teaser — one line that hints there's more, encouraging the user to dig in */}
      <div className="px-8 py-4 bg-white border-y border-ink/5">
        <p className="text-sm text-ink-soft">
          {reasonsCount > 0 ? (
            <>
              <span className="text-sunrise font-semibold">↓ Tap below</span> to see the {reasonsCount}{" "}
              {reasonsCount === 1 ? "reason" : "reasons"} this fits you, the recipe, and what's wrong with the original.
            </>
          ) : (
            <>
              <span className="text-sunrise font-semibold">↓ Tap below</span> to see the recipe and what's wrong with the original.
            </>
          )}
        </p>
      </div>

      {/* Disclosure stack — each section opens independently */}
      <div className="divide-y divide-ink/5">
        {reasonsCount > 0 && (
          <Disclosure
            title="Why this for you"
            count={`${reasonsCount} ${reasonsCount === 1 ? "reason" : "reasons"}`}
            accent="bg-sunrise/10 text-sunrise-700"
          >
            <ul className="space-y-2">
              {currentOutput.tuned_for_you_reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-ink-soft">
                  <span className="text-sunrise flex-shrink-0">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        <Disclosure
          title="Why this is better"
          count="The narrative"
          accent="bg-sage-soft text-ink"
        >
          <p className="text-ink-soft leading-relaxed">{currentOutput.narrative}</p>
        </Disclosure>

        {concernCount > 0 && (
          <Disclosure
            title="What's in the original"
            count={`${concernCount} flagged ingredient${concernCount === 1 ? "" : "s"}`}
            accent="bg-coral-soft text-ink"
          >
            <div className="space-y-2">
              {currentOutput.ingredient_analysis!.map((ia, i) => (
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
          </Disclosure>
        )}

        <Disclosure
          title="The recipe"
          count={`${ingCount} ingredients · ${stepCount} steps`}
          accent="bg-honey/40 text-ink"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
              <ul className="space-y-1 text-ink-soft">
                {currentOutput.recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm">
                    <strong className="text-ink">
                      {ing.quantity}
                      {ing.unit ? ` ${ing.unit}` : ""}
                    </strong>{" "}
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
        </Disclosure>

        {nutritionKeys > 0 && (
          <Disclosure
            title="Nutrition"
            count={`${nutritionKeys} measure${nutritionKeys === 1 ? "" : "s"} per serving`}
            accent="bg-paper text-ink"
          >
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Object.entries(currentOutput.nutrition!).map(([k, v]) =>
                v == null ? null : (
                  <div key={k} className="p-3 rounded-soft bg-paper text-center">
                    <div className="text-xl font-bold text-ink">{v}</div>
                    <div className="text-xs uppercase tracking-wider text-ink-muted">
                      {k.replace(/_/g, " ")}
                    </div>
                  </div>
                ),
              )}
            </div>
          </Disclosure>
        )}

        {isLoggedIn && result.swapId && (
          <Disclosure
            title="Tweak this"
            count="Make it dairy-free, scale to 6, or freehand"
            accent="bg-sunrise/10 text-sunrise-700"
          >
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
          </Disclosure>
        )}
      </div>

      {/* Always-visible: rating + save */}
      {result.swapId && (
        <div className="px-8 py-5 bg-paper/40 border-t border-ink/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-sunrise-700 font-semibold mb-1">
                Rate this swap
              </p>
              <p className="text-sm text-ink-muted">
                Your ratings teach the coach your palate.
              </p>
            </div>
            <StarRating
              targetType="swap"
              targetId={result.swapId}
              targetLabel={`${result.query} swap → ${currentOutput.title}`}
              size="lg"
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
      )}

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

      <FoodConfetti active={celebrate} onDone={() => setCelebrate(false)} />
    </article>
  );
}

// Native <details> based disclosure with a styled summary row + chevron.
// Keeps each section accessible (keyboard, screen reader) and animates open.
function Disclosure({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex items-center gap-3 px-8 py-4 cursor-pointer hover:bg-paper/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <span
          className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-pill flex-shrink-0 ${accent}`}
        >
          {title}
        </span>
        <span className="text-sm text-ink-muted flex-1 truncate">{count}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-muted group-open:rotate-180 transition-transform flex-shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-8 pb-6 pt-1 animate-fade-up">{children}</div>
    </details>
  );
}
