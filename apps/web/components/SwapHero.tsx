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
import { TryAnotherSurvey } from "./TryAnotherSurvey";
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
  const [retryingVersion, setRetryingVersion] = useState(false);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [badModel, setBadModel] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);
  const [showTrySurvey, setShowTrySurvey] = useState(false);
  const searchParams = useSearchParams();

  async function runSwap(
    q: string,
    img?: PickedImage | null,
    opts?: { skipCache?: boolean; avoidTitles?: string[]; isRetry?: boolean },
  ) {
    if (opts?.isRetry) {
      setRetryingVersion(true);
    } else {
      setLoading(true);
      setResult(null);
      setSeenTitles([]);
    }
    setError(null);
    setErrorCode(null);
    setBadModel(null);
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
        ...(opts?.skipCache ? { skip_cache: true } : {}),
        ...(opts?.avoidTitles && opts.avoidTitles.length
          ? { avoid_titles: opts.avoidTitles }
          : {}),
      });

      const nextResult: SwapResult = {
        query: q || "(photo)",
        output: data.output,
        latencyMs: data.latency_ms,
        cached: data.cached,
        swapId: data.swap?.id ?? null,
      };
      setResult(nextResult);
      const title = data.output?.title;
      if (title) {
        setSeenTitles((prev) =>
          prev.includes(title) ? prev : [...prev, title].slice(-8),
        );
      }
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
      setRetryingVersion(false);
    }
  }

  async function onTryAnotherVersion() {
    if (!result) return;
    await runSwap(result.query === "(photo)" ? "" : result.query, image, {
      skipCache: true,
      avoidTitles: seenTitles,
      isRetry: true,
    });
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

  function backToSwapScreen() {
    setShowDismiss(false);
    setResult(null);
    setQuery("");
    clearPickedImage();
    setSeenTitles([]);
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setShowTrySurvey(true)}
            className="inline-flex items-center gap-2 rounded-pill bg-coral text-white px-5 py-2.5 text-sm font-semibold shadow-warm hover:brightness-95 active:scale-[0.98] transition-all"
            aria-label="Try again with a different swap"
          >
            <span aria-hidden>🔄</span> Try again?
          </button>
        </div>
        {showDismiss ? (
          <DismissSurvey
            swapId={result.swapId}
            query={result.query}
            onDone={backToSwapScreen}
          />
        ) : (
          <SwapResultCard
            result={result}
            isLoggedIn={isLoggedIn}
            onTryAnotherVersion={onTryAnotherVersion}
            retryingVersion={retryingVersion}
          />
        )}
        {showTrySurvey && (
          <TryAnotherSurvey
            swapId={result.swapId}
            query={result.query}
            onDone={() => {
              setShowTrySurvey(false);
              backToSwapScreen();
            }}
            onCancel={() => setShowTrySurvey(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="badge-tuned mx-auto">Replace ultra-processed food with real food</div>
        {/* Hero copy responsive — was text-5xl on phones (48px), now starts at
            text-3xl so it fits a 360px viewport without breaking words. */}
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-[1.1] md:leading-[1.05] tracking-tight text-paper">
          <span className="text-coral">Real Food</span>{" "}
          <span className="italic font-serif">Diet Swaps</span>
        </h1>
        <p className="text-base md:text-lg text-paper/80">
          Type any product and press Enter — we'll show you the real food version with ingredients, nutrition comparison, and a recipe you can make today.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <div className="card p-2 flex items-center gap-1.5 sm:gap-2 shadow-warm">
          {/* text-base = 16px so iOS doesn't auto-zoom on focus. inputMode=search
              gives the right software keyboard with a "search" return key. */}
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder={image ? "Add a note (optional)…" : "Type or say 'Snickers'…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 min-w-0 px-3 sm:px-5 py-4 bg-transparent outline-none text-base sm:text-lg placeholder:text-ink-muted"
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
          {/* Icon-only on <sm to keep the row from blowing out at 360px;
              labels resume at sm: where there's space. */}
          <button
            type="submit"
            disabled={loading || (!image && query.trim().length < 2)}
            className="btn-primary px-4 sm:px-6"
            aria-label="Find swap"
          >
            <span className="sm:hidden text-xl leading-none" aria-hidden>
              →
            </span>
            <span className="hidden sm:inline">
              {loading ? "Cooking…" : "Find swap →"}
            </span>
          </button>
        </div>

        {image && (
          <div className="mt-3 flex items-center gap-3 max-w-2xl mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt="Uploaded preview"
              className="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-soft border border-ink/10 flex-shrink-0"
            />
            <div className="text-xs sm:text-sm text-ink-soft flex-1 min-w-0">
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
