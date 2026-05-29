"use client";

// SwapHero (v3) — the single dominant action on the logged-in home page.
//
// A paper card with an editable composer in the center ("Swap …") and three
// input-mode chips anchored in the lower right: voice, photo, scan. Submit
// posts to /api/swap and renders the result in a popup overlay so the user
// never leaves the home page.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceButton } from "@/components/VoiceButton";
import { BarcodeButton } from "@/components/BarcodeButton";
import { SwapResultCard, type SwapResult } from "@/components/SwapResultCard";
import {
  SwapPreferences,
  EMPTY_PREFS,
  type SwapPrefsValue,
} from "@/components/SwapPreferences";
import { ThemePicker } from "@/components/home-v3/ThemePicker";
import {
  AgentDebugPanel,
  type AgentDebug,
} from "@/components/home-v3/AgentDebugPanel";
import { SwapLoader } from "@/components/home-v3/SwapLoader";
import { compressImage, type PickedImage } from "@/lib/image-compress";
import type { Quote } from "@/lib/quotes";

interface Props {
  greeting: string;
  quote: Quote;
  themeId: string;
  hasCustomBg: boolean;
}

export function SwapHero({ greeting, quote, themeId, hasCustomBg }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);
  // Stays populated after the popup closes so the debug panel below the card
  // keeps showing the most recent agent decision.
  const [lastResult, setLastResult] = useState<SwapResult | null>(null);
  const [lastDebug, setLastDebug] = useState<AgentDebug | null>(null);
  const [noMatchMessage, setNoMatchMessage] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<SwapPrefsValue>(EMPTY_PREFS);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const popupOpen =
    result !== null || noMatchMessage !== null || prefsOpen;

  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllPopups();
    };
    document.body.classList.add("overflow-hidden");
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", onKey);
    };
  }, [popupOpen]);

  function closePopup() {
    setResult(null);
    setNoMatchMessage(null);
    setQuery("");
    router.refresh();
  }

  function closeAllPopups() {
    setPrefsOpen(false);
    closePopup();
  }

  async function submit(img: PickedImage | null, q: string) {
    if (!img && q.trim().length < 2) {
      setError("Type a product, snap a photo, or scan a barcode.");
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: q.trim(),
          preferences: prefs,
          ...(img ? { image: { media_type: img.mediaType, data: img.data } } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as {
        data?: {
          swap?: { id: string } | null;
          output?: SwapResult["output"] | null;
          latency_ms?: number | null;
          cached?: boolean;
          no_match?: boolean;
          message?: string;
          debug?: AgentDebug | null;
        };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
      }
      const data = json?.data;
      if (data?.no_match) {
        setNoMatchMessage(
          data.message ??
            `No curated swap yet for "${q.trim()}". Try a different product.`,
        );
        setLoading(false);
        return;
      }
      if (data?.output) {
        const next: SwapResult = {
          query: q.trim(),
          output: data.output,
          latencyMs: data.latency_ms ?? null,
          cached: data.cached ?? false,
          swapId: data.swap?.id ?? null,
        };
        setResult(next);
        setLastResult(next);
        setLastDebug(data.debug ?? null);
        // Increment the user's swap counts/streak. /api/swap already logs a
        // `viewed_swap` event; this is the "ran a swap on /home-v3" signal
        // that the SwapCounter query (MADE_EVENT_TYPES) picks up.
        void fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            event_type: "home_v3_swap",
            target_type: data.swap?.id ? "swap" : null,
            target_id: data.swap?.id ?? undefined,
            metadata: { query: q.trim() },
          }),
        }).catch(() => {});
        setLoading(false);
        return;
      }
      throw new Error("Got an empty response.");
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && /aborted/i.test(err.message));
      setError(
        aborted
          ? "That took too long — try again, or type the product name."
          : err instanceof Error
            ? err.message
            : String(err),
      );
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    let compressed: PickedImage;
    try {
      compressed = await compressImage(file);
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error
          ? `Couldn't read that photo (${err.message}).`
          : "Couldn't read that photo.",
      );
      return;
    }
    await submit(compressed, query || "");
  }

  return (
    <>
    <section className="text-center">
      <p className="text-white text-lg md:text-2xl font-extrabold tracking-tight mb-5 drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
        {greeting}
      </p>
      <div
        className="relative mx-auto w-full max-w-md aspect-square
                   rounded-[2rem] bg-paper text-ink shadow-card
                   ring-1 ring-paper/30 overflow-hidden"
      >
        <SwapLoader show={loading} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <div className="mb-8 max-w-[26ch]">
            <p className="text-balance text-[20px] md:text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
              &ldquo;{quote.text}&rdquo;
            </p>
            <p className="mt-2 text-xs md:text-sm font-medium text-ink/55">
              — {quote.author}
            </p>
          </div>

          <div className="w-full">
            <div className="flex items-center gap-2 rounded-pill border-2 border-ink/40 bg-white px-3 py-2 shadow-sm focus-within:border-ink transition-colors">
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Type a product…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit(null, query);
                  }
                }}
                disabled={loading}
                className="flex-1 min-w-0 px-2 py-1.5 bg-transparent outline-none text-base text-ink placeholder:text-ink/55"
              />
              <button
                type="button"
                onClick={() => void submit(null, query)}
                disabled={loading || query.trim().length < 2}
                className="rounded-pill bg-ink hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-paper text-sm font-semibold px-3.5 py-1.5 transition"
              >
                {loading ? "…" : "Find"}
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-coral max-w-[28ch]">{error}</p>
          )}
        </div>

        {/* Lower-left: preferences as a labeled pill so the affordance is
            obvious — users were missing the bare gear. */}
        <div className="absolute bottom-3 left-3">
          <button
            type="button"
            aria-label="Customize Swap"
            title="Customize Swap"
            onClick={() => setPrefsOpen(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-pill bg-ink/15 hover:bg-ink/25 active:scale-95 transition text-sm font-semibold text-ink ring-1 ring-ink/20 disabled:opacity-50"
          >
            <span aria-hidden className="text-lg leading-none">⚙️</span>
            <span className="leading-none">Customize Swap</span>
          </button>
        </div>

        {/* Lower-right action chips: voice · photo · scan. */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          <VoiceButton
            disabled={loading}
            onTranscript={(t, isFinal) => {
              setQuery(t);
              if (isFinal && t.trim().length >= 2) void submit(null, t);
            }}
          />
          <button
            type="button"
            aria-label="Snap a photo"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="w-11 h-11 rounded-full bg-ink/15 hover:bg-ink/25 active:scale-95 transition flex items-center justify-center text-xl ring-1 ring-ink/20 disabled:opacity-50"
          >
            <span aria-hidden>📷</span>
          </button>
          <BarcodeButton
            disabled={loading}
            onScan={async (code) => {
              setLoading(true);
              setError(null);
              try {
                const resolveResp = await fetch("/api/barcode/lookup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ barcode: code }),
                });
                if (resolveResp.ok) {
                  const json = (await resolveResp.json()) as {
                    data?: {
                      name?: string;
                      brand?: string | null;
                      timings?: Record<string, number | string | null>;
                    };
                  };
                  if (json.data?.timings) {
                    // eslint-disable-next-line no-console
                    console.log("[barcode]", json.data.timings);
                  }
                  const name = json.data?.name?.trim();
                  if (name) {
                    const friendly = json.data?.brand
                      ? `${json.data.brand} ${name}`.trim()
                      : name;
                    setQuery(friendly);
                    await submit(null, friendly);
                    return;
                  }
                }
                setQuery(code);
                await submit(null, code);
              } catch {
                setQuery(code);
                await submit(null, code);
              } finally {
                setLoading(false);
              }
            }}
          />
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-4 text-sm md:text-base text-paper/70 max-w-[28ch] mx-auto">
        One small upgrade. That&apos;s the whole game.
      </p>

      <AgentDebugPanel
        result={lastResult}
        debug={lastDebug}
        loading={loading && !lastResult}
      />
    </section>

    {(result !== null || noMatchMessage !== null) && (
      <div
        className="fixed inset-0 z-[90] bg-ink/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
        onClick={closePopup}
        role="dialog"
        aria-modal="true"
        aria-label="Swap result"
      >
        <div
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-paper text-ink rounded-t-soft md:rounded-soft shadow-warm animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-20 flex items-center justify-end bg-paper/95 backdrop-blur-sm px-3 py-2 border-b border-ink/10">
            <button
              type="button"
              onClick={closePopup}
              aria-label="Close"
              className="w-9 h-9 rounded-full bg-ink/5 hover:bg-ink/10 text-ink text-xl leading-none flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <div className="p-4 md:p-6">
            {result ? (
              <>
                <SwapResultActions result={result} />
                <SwapResultCard result={result} isLoggedIn={true} hideSaveButton />
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-lg font-semibold mb-2">No swap yet</p>
                <p className="text-sm text-ink/70 max-w-[36ch] mx-auto">
                  {noMatchMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {prefsOpen && (
      <div
        className="fixed inset-0 z-[95] bg-ink/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
        onClick={() => setPrefsOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Swap preferences"
      >
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-paper text-ink rounded-t-soft md:rounded-soft shadow-warm animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink/10 sticky top-0 bg-paper z-10">
            <p className="text-sm uppercase tracking-[0.16em] font-bold text-forest-700">
              ⚙️ Preferences
            </p>
            <button
              type="button"
              onClick={() => setPrefsOpen(false)}
              aria-label="Close"
              className="w-9 h-9 rounded-full hover:bg-ink/5 text-ink text-xl leading-none flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <div className="p-4 md:p-6">
            <SwapPreferences
              value={prefs}
              onChange={setPrefs}
              disabled={loading}
              defaultExpanded
            />
            <details className="mt-6 border-t border-ink/10 pt-4 group">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-ink/80">
                  <span aria-hidden>🎨</span> Customize View
                </span>
                <span
                  aria-hidden
                  className="text-ink/50 text-sm transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="mt-3 rounded-soft bg-honey/30 ring-1 ring-honey/60 px-3 py-2 text-xs text-ink/80 flex items-start gap-2">
                <span aria-hidden className="text-base leading-none">💡</span>
                <p>
                  Pick a color, pattern, or upload your own photo for your
                  home screen. Changes save instantly and follow you to every
                  device you sign in on.
                </p>
              </div>
              <ThemePicker currentThemeId={themeId} hasCustomBg={hasCustomBg} />
            </details>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Icon row above the SwapResultCard inside the result popup. 🍳 saves the
// swap into the user's Kitchen (recipe_box_entries); 🛒 pushes the swap's
// ingredients into grocery_items. Both buttons flip to a checked state once
// they succeed so the user can see the action landed.
function SwapResultActions({ result }: { result: SwapResult }) {
  const [savingKitchen, setSavingKitchen] = useState(false);
  const [savedKitchen, setSavedKitchen] = useState(false);
  const [savingGrocery, setSavingGrocery] = useState(false);
  const [savedGrocery, setSavedGrocery] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ingredients = result.output?.recipe?.ingredients ?? [];
  const canKitchen = !!result.swapId;
  const canGrocery = ingredients.length > 0;

  async function saveKitchen() {
    if (!result.swapId) return;
    setSavingKitchen(true);
    setErr(null);
    try {
      const res = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swap_id: result.swapId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Save failed (${res.status})`);
      }
      setSavedKitchen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingKitchen(false);
    }
  }

  async function saveGrocery() {
    if (ingredients.length === 0) return;
    setSavingGrocery(true);
    setErr(null);
    try {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          swap_id: result.swapId,
          items: ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? null,
          })),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Save failed (${res.status})`);
      }
      setSavedGrocery(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingGrocery(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 gap-3">
        <ActionPill
          label="Add to Kitchen"
          doneLabel="In My Kitchen"
          emoji="🍳"
          busy={savingKitchen}
          done={savedKitchen}
          disabled={!canKitchen || savingKitchen || savedKitchen}
          onClick={saveKitchen}
          variant="forest"
        />
        <ActionPill
          label="Add to Grocery List"
          doneLabel="On Grocery List"
          emoji="🛒"
          busy={savingGrocery}
          done={savedGrocery}
          disabled={!canGrocery || savingGrocery || savedGrocery}
          onClick={saveGrocery}
          variant="coral"
        />
      </div>
      {err && (
        <p className="mt-2 text-xs text-coral" title={err}>
          {err}
        </p>
      )}
    </div>
  );
}

function ActionPill({
  label,
  doneLabel,
  emoji,
  busy,
  done,
  disabled,
  onClick,
  variant,
}: {
  label: string;
  doneLabel: string;
  emoji: string;
  busy: boolean;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "forest" | "coral";
}) {
  const palette =
    variant === "forest"
      ? "bg-forest-700 text-white hover:brightness-110 shadow-warm"
      : "bg-coral text-white hover:brightness-110 shadow-warm";
  const donePalette = "bg-sage-soft text-forest-700 ring-2 ring-forest-700/30";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={done ? doneLabel : label}
      title={done ? doneLabel : label}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-soft px-4 py-3 md:py-3.5 text-sm md:text-base font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-90 ${
        done ? donePalette : palette
      }`}
    >
      <span aria-hidden className="text-xl md:text-2xl leading-none">
        {busy ? "…" : done ? "✓" : emoji}
      </span>
      <span className="leading-none">{busy ? "Saving…" : done ? doneLabel : label}</span>
    </button>
  );
}
