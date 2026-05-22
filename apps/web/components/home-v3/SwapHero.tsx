"use client";

// SwapHero (v3) — the single dominant action on the logged-in home page.
//
// A paper card with an editable composer in the center ("Swap …") and three
// input-mode chips anchored in the lower right: voice, photo, scan. Submit
// posts to /api/swap and navigates to /swap/[id] — same contract as the
// shared SwapModal, just inline so the page itself is the composer.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceButton } from "@/components/VoiceButton";
import { BarcodeButton } from "@/components/BarcodeButton";
import { compressImage, type PickedImage } from "@/lib/image-compress";
import type { Quote } from "@/lib/quotes";

interface Props {
  greeting: string;
  quote: Quote;
}

export function SwapHero({ greeting, quote }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

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
          ...(img ? { image: { media_type: img.mediaType, data: img.data } } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { swap?: { id: string } | null };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
      }
      const swapId = json?.data?.swap?.id;
      if (swapId) {
        router.push(`/swap/${swapId}`);
      } else {
        router.push(`/?q=${encodeURIComponent(q.trim())}`);
      }
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
    <section className="text-center">
      <p className="text-paper/70 text-sm md:text-base font-medium mb-4">
        {greeting}
      </p>
      <div
        className="relative mx-auto w-full max-w-md aspect-square
                   rounded-[2rem] bg-paper text-ink shadow-card
                   ring-1 ring-paper/30 overflow-hidden"
      >
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
                    data?: { name?: string; brand?: string | null };
                  };
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
    </section>
  );
}
