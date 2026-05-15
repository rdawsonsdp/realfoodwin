"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";
import { SwapResultCard, type SwapResult } from "./SwapResultCard";
import { CookingAnimation } from "./CookingAnimation";
import { VoiceButton } from "./VoiceButton";
import { CuisineChips } from "./CuisineChips";
import { DismissSurvey } from "./DismissSurvey";

const EXAMPLES = ["Snickers", "Doritos", "Oreos", "Big Mac", "Pop-Tarts"];

export function SwapHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);
  const searchParams = useSearchParams();

  async function runSwap(q: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<{
        cached: boolean;
        swap: { id: string } | null;
        output: SwapResult["output"] | null;
        latency_ms: number | null;
      }>("/api/swap", { query: q });

      setResult({
        query: q,
        output: data.output,
        latencyMs: data.latency_ms,
        cached: data.cached,
        swapId: data.swap?.id ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Auto-run when the URL carries ?q= — used to resume after the sign-in + quiz
  // detour so the "Save → sign in → quiz → personalized swap" loop completes
  // without the user retyping.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.length >= 2 && !result && !loading) {
      setQuery(q);
      void runSwap(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    void runSwap(query.trim());
  }

  if (result) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowDismiss(true)}
          className="btn-ghost"
        >
          ← Try another
        </button>
        {showDismiss ? (
          <DismissSurvey
            swapId={result.swapId}
            query={result.query}
            onDone={() => {
              setShowDismiss(false);
              setResult(null);
              setQuery("");
            }}
          />
        ) : (
          <SwapResultCard result={result} isLoggedIn={isLoggedIn} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="badge-tuned mx-auto">Replace ultra-processed food with real food</div>
        <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
          Type a junk food.
          <br />
          Get a <span className="text-sunrise">real-food swap.</span>
        </h1>
        <p className="text-lg text-ink-soft">
          Complete recipe. Nutrition comparison. Ingredient analysis. Tuned to your kitchen.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <div className="card p-2 flex items-center gap-2 shadow-warm">
          <input
            type="text"
            placeholder="Type or say 'Snickers'…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-5 py-4 bg-transparent outline-none text-lg placeholder:text-ink-muted"
          />
          <VoiceButton
            disabled={loading}
            onTranscript={(text, isFinal) => {
              setQuery(text);
              if (isFinal && text.trim().length >= 2) {
                void runSwap(text.trim());
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="btn-primary py-3"
          >
            {loading ? "Cooking…" : "Find swap →"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          <span className="text-sm text-ink-muted self-center mr-1">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                void runSwap(ex);
              }}
              className="chip"
            >
              {ex}
            </button>
          ))}
        </div>

        {isLoggedIn && (
          <CuisineChips
            onPick={(q) => {
              setQuery(q);
              void runSwap(q);
            }}
          />
        )}
      </form>

      {error && (
        <div className="max-w-2xl mx-auto card p-4 border border-coral/30 bg-coral-soft/30 text-ink">
          <strong>Something went wrong:</strong> {error}
        </div>
      )}

      {loading && <CookingAnimation />}
    </div>
  );
}
