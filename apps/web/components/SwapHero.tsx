"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { SwapResultCard, type SwapResult } from "./SwapResultCard";
import { CookingAnimation } from "./CookingAnimation";
import { VoiceButton } from "./VoiceButton";
import { PhotoUploadButton } from "./PhotoUploadButton";
import { SwapPreferences, EMPTY_PREFS, type SwapPrefsValue } from "./SwapPreferences";
import { DismissSurvey } from "./DismissSurvey";

const EXAMPLES = ["Snickers", "Doritos", "Oreos", "Big Mac", "Pop-Tarts"];

interface PickedImage {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

export function SwapHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [query, setQuery] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [prefs, setPrefs] = useState<SwapPrefsValue>(EMPTY_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [badModel, setBadModel] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);
  const searchParams = useSearchParams();

  async function runSwap(q: string, img?: PickedImage | null) {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setBadModel(null);
    setResult(null);
    try {
      const data = await apiPost<{
        cached: boolean;
        swap: { id: string } | null;
        output: SwapResult["output"] | null;
        latency_ms: number | null;
      }>("/api/swap", {
        query: q,
        preferences: prefs,
        ...(img ? { image: { media_type: img.mediaType, data: img.data } } : {}),
      });

      setResult({
        query: q || "(photo)",
        output: data.output,
        latencyMs: data.latency_ms,
        cached: data.cached,
        swapId: data.swap?.id ?? null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorCode(err.code);
        if (err.code === "model_not_found") {
          const m =
            typeof err.details === "object" && err.details && "model" in err.details
              ? String((err.details as { model: unknown }).model)
              : null;
          setBadModel(m);
        }
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  // Restore the user's per-swap preferences from the previous visit. Stored
  // per-browser via localStorage so the picks survive reloads without a DB
  // migration. The persona changes via Test Login don't clear it — preferences
  // travel with the browser, not the auth session.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("rfw.swapPrefs");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SwapPrefsValue>;
        setPrefs({ ...EMPTY_PREFS, ...parsed });
      }
    } catch {
      // Quota / private mode / parse failure — fall back to empty defaults.
    }
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem("rfw.swapPrefs", JSON.stringify(prefs));
    } catch {
      // Silently swallow — preferences just won't persist this session.
    }
  }, [prefs, prefsLoaded]);

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
    const q = query.trim();
    if (!image && q.length < 2) return;
    void runSwap(q, image);
  }

  function clearPickedImage() {
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
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
            placeholder={image ? "Add a note (optional)…" : "Type or say 'Snickers'…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-5 py-4 bg-transparent outline-none text-lg placeholder:text-ink-muted"
          />
          <PhotoUploadButton
            disabled={loading}
            onPicked={(img) => {
              clearPickedImage();
              setImage(img);
            }}
          />
          <VoiceButton
            disabled={loading}
            onTranscript={(text, isFinal) => {
              setQuery(text);
              if (isFinal && text.trim().length >= 2) {
                void runSwap(text.trim(), image);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || (!image && query.trim().length < 2)}
            className="btn-primary py-3"
          >
            {loading ? "Cooking…" : "Find swap →"}
          </button>
        </div>

        {image && (
          <div className="mt-3 flex items-center gap-3 max-w-2xl mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt="Uploaded preview"
              className="w-20 h-20 object-cover rounded-soft border border-ink/10"
            />
            <div className="text-sm text-ink-soft flex-1">
              Photo attached — we'll identify the food and suggest a real-food swap.
            </div>
            <button
              type="button"
              onClick={clearPickedImage}
              className="btn-ghost text-sm"
            >
              Remove
            </button>
          </div>
        )}

        <SwapPreferences value={prefs} onChange={setPrefs} disabled={loading} />

        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          <span className="text-sm text-ink-muted self-center mr-1">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                void runSwap(ex, image);
              }}
              className="chip"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {error && errorCode === "model_not_found" ? (
        <div className="max-w-2xl mx-auto card p-4 border border-honey/50 bg-honey/20 text-ink space-y-2">
          <div>
            <strong>Configured AI model is unavailable.</strong>{" "}
            {badModel && (
              <>
                The model <code className="bg-cream px-1.5 py-0.5 rounded">{badModel}</code> was not found at Anthropic.
              </>
            )}
          </div>
          <div className="text-sm text-ink-soft">
            An admin needs to pick a valid model — Sonnet 4.6 (<code>claude-sonnet-4-6</code>) is a safe default.
          </div>
          <Link href="/admin/models" className="btn-primary inline-block">
            Open Admin → Models
          </Link>
        </div>
      ) : error ? (
        <div className="max-w-2xl mx-auto card p-4 border border-coral/30 bg-coral-soft/30 text-ink">
          <strong>Something went wrong:</strong> {error}
        </div>
      ) : null}

      {loading && <CookingAnimation />}
    </div>
  );
}
