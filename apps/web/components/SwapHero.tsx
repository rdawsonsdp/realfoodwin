"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { SwapResultCard, type SwapResult } from "./SwapResultCard";

const EXAMPLES = ["Snickers", "Doritos", "Oreos", "Big Mac", "Pop-Tarts"];

export function SwapHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

      if (data.swap?.id && isLoggedIn) {
        router.push(`/swap/${data.swap.id}`);
        return;
      }
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    void runSwap(query.trim());
  }

  if (result) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setResult(null);
            setQuery("");
          }}
          className="btn-ghost"
        >
          ← Try another
        </button>
        <SwapResultCard result={result} isLoggedIn={isLoggedIn} />
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
            placeholder="Try 'Snickers' or 'Doritos'…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-5 py-4 bg-transparent outline-none text-lg placeholder:text-ink-muted"
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
      </form>

      {error && (
        <div className="max-w-2xl mx-auto card p-4 border border-coral/30 bg-coral-soft/30 text-ink">
          <strong>Something went wrong:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="max-w-2xl mx-auto card p-8 animate-fade-up">
          <div className="space-y-3">
            <div className="h-4 bg-honey/40 rounded animate-shimmer bg-gradient-to-r from-honey/30 via-cream to-honey/30 bg-[length:200%_100%]" />
            <div className="h-4 bg-honey/40 rounded animate-shimmer bg-gradient-to-r from-honey/30 via-cream to-honey/30 bg-[length:200%_100%] w-3/4" />
            <div className="h-4 bg-honey/40 rounded animate-shimmer bg-gradient-to-r from-honey/30 via-cream to-honey/30 bg-[length:200%_100%] w-5/6" />
          </div>
          <p className="text-sm text-ink-muted mt-6 italic">
            Asking our food coach for the best real-food version…
          </p>
        </div>
      )}
    </div>
  );
}
