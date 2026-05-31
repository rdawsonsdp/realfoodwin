"use client";

// SwapModal — the everywhere-accessible swap entry. Opened from the floating
// camera button (SwapFab) on any page.
//
// Layout is intentionally camera-first because user research said the most
// common swap will be photo-based: a giant "Snap a photo" primary CTA fills
// the top of the modal. Text / voice / barcode sit below as alternatives.
//
// On submit we POST to /api/swap directly (not via the home page's SwapHero)
// and navigate to /swap/[id] for the result. This keeps the modal self-
// contained and lets it be opened from /kitchen, /settings, anywhere.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { VoiceButton } from "./VoiceButton";
import { BarcodeButton } from "./BarcodeButton";
import { SwapResultCard, type SwapResult } from "./SwapResultCard";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PickedImage {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

export function SwapModal({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);

  // Body scroll lock + ESC to close while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.classList.add("overflow-hidden");
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reset form when reopened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setImage(null);
      setError(null);
      setLoading(false);
      setResult(null);
    }
  }, [open]);

  async function handleFile(file: File) {
    // Set loading immediately so the user sees feedback while we compress —
    // iOS HEIC decode can take 1–3 seconds on older phones.
    setLoading(true);
    setError(null);
    let compressed: PickedImage;
    try {
      compressed = await compress(file);
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error
          ? `Couldn't read that photo (${err.message}). Try choosing from your library instead.`
          : "Couldn't read that photo. Try choosing from your library.",
      );
      return;
    }
    setImage(compressed);
    // Auto-submit on photo capture — the user already framed it; another tap
    // would feel like friction. Text/voice still require an explicit Submit.
    await submit(compressed, query || "");
  }

  async function submit(img: PickedImage | null, q: string) {
    if (!img && q.trim().length < 2) {
      setError("Type at least 2 characters or take a photo.");
      return;
    }
    setLoading(true);
    setError(null);
    // Hard client timeout: the Anthropic image call can take 30–45s, so we
    // give the request 90s. If we don't get a response in that window the
    // user is told plainly rather than staring at a frozen modal forever.
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
        data?: {
          swap?: { id: string } | null;
          output?: SwapResult["output"] | null;
          latency_ms?: number | null;
          cached?: boolean;
        };
        error?: { message?: string; code?: string };
      } | null;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
      }
      const data = json?.data;
      if (data?.output) {
        // Show the swap as an inline overlay on this same page — no
        // navigation. The user can dismiss and stay in context.
        setResult({
          query: q.trim(),
          output: data.output,
          latencyMs: data.latency_ms ?? null,
          cached: data.cached ?? false,
          swapId: data.swap?.id ?? null,
        });
      } else if (data?.swap?.id) {
        // Cached or legacy path with no inline output — fall back to the
        // dedicated swap page rather than rendering nothing.
        onClose();
        router.push(`/swap/${data.swap.id}`);
      } else {
        setError("Got an empty response from the swap agent. Try again?");
      }
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && /aborted/i.test(err.message));
      setError(
        aborted
          ? "That took too long — the AI didn't respond in 90 seconds. Try again, or type the product name instead."
          : err instanceof Error
          ? err.message
          : String(err),
      );
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-ink/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Start a swap"
    >
      <div
        className={`relative w-full ${result ? "max-w-3xl max-h-[90dvh] overflow-y-auto" : "max-w-lg overflow-hidden"} bg-paper text-ink rounded-t-soft md:rounded-soft shadow-warm animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between bg-paper/95 backdrop-blur-sm px-5 py-3 border-b border-ink/10">
          <p className="text-sm uppercase tracking-[0.16em] font-bold text-forest-700">
            {result ? "Your swap" : "Start a swap"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full hover:bg-ink/5 text-ink text-xl leading-none flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {result ? (
          <div className="p-4 md:p-6">
            <SwapResultCard result={result} isLoggedIn={true} />
          </div>
        ) : (
        <div className="p-5 md:p-6 space-y-4">
          {/* Primary camera CTA — most common path, biggest target. */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-soft bg-coral hover:brightness-95 text-white px-5 py-6 md:py-7 shadow-warm transition-all active:scale-[0.99] disabled:opacity-90"
          >
            <div className="flex items-center justify-center gap-3">
              {loading ? (
                <Spinner />
              ) : (
                <span aria-hidden className="text-3xl md:text-4xl leading-none">
                  📷
                </span>
              )}
              <div className="text-left">
                <p className="text-lg md:text-xl font-bold">
                  {loading ? "Analyzing your photo…" : "Snap a photo"}
                </p>
                <p className="text-sm font-normal opacity-90">
                  {loading
                    ? "This usually takes 10–30 seconds."
                    : "The fastest way — point at any food"}
                </p>
              </div>
            </div>
          </button>

          {/* Secondary: pick from library */}
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            disabled={loading}
            className="w-full text-xs text-ink-muted underline hover:text-ink transition"
          >
            …or choose a photo from your library
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink/10" />
            <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">or</span>
            <div className="flex-1 h-px bg-ink/10" />
          </div>

          {/* Text + voice + barcode row */}
          <div className="flex items-center gap-2 rounded-soft border border-ink/15 px-2 py-1.5">
            <input
              ref={textRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Type a product like 'Snickers'…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(null, query);
                }
              }}
              disabled={loading}
              className="flex-1 min-w-0 px-2 py-2.5 bg-transparent outline-none text-base placeholder:text-ink-muted"
            />
            <VoiceButton
              onTranscript={(t, isFinal) => {
                setQuery(t);
                if (isFinal && t.trim().length >= 2) void submit(null, t);
              }}
              disabled={loading}
            />
            <BarcodeButton
              disabled={loading}
              onScan={async (code) => {
                // Cascade: try our local cache + Open Food Facts first to turn
                // the bare UPC into a friendly product name. If unknown, fall
                // back to passing the raw code to the swap engine — Claude can
                // sometimes identify it from memory.
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
                      const friendlyQuery = json.data?.brand
                        ? `${json.data.brand} ${name}`.trim()
                        : name;
                      setQuery(friendlyQuery);
                      await submit(null, friendlyQuery);
                      return;
                    }
                  }
                  // Resolver miss → fall back to raw code.
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
            <button
              type="button"
              onClick={() => void submit(null, query)}
              disabled={loading || query.trim().length < 2}
              className="rounded-pill bg-sunrise-500 hover:bg-sunrise-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 shadow-warm transition-colors"
            >
              {loading ? "…" : "Find"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-coral">{error}</p>
          )}
        </div>
        )}

        {/* Hidden inputs that the buttons trigger */}
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
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block w-7 h-7 md:w-8 md:h-8 rounded-full border-[3px] border-white/40 border-t-white animate-spin"
    />
  );
}

// JPEG compression — same algorithm as the existing PhotoUploadButton so the
// modal stays consistent with the home-page swap input. iOS Safari can deliver
// HEIC files that createImageBitmap can't decode; we fall back to <img>+canvas
// so the user still gets a JPEG to send to the API.
async function compress(file: File): Promise<PickedImage> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file);
  } catch {
    src = await loadViaImg(file);
  }
  const srcW = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const srcH = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (!srcW || !srcH) throw new Error("Image had no dimensions");
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(src, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82,
    ),
  );
  const data = await blobToBase64(blob);
  return { mediaType: "image/jpeg", data, previewUrl: URL.createObjectURL(blob) };
}

// Fallback path for browsers (mostly Safari) that can't pass HEIC through
// createImageBitmap. We render the file via a normal <img> tag first, which
// triggers the browser's native HEIC decoder, then read the pixels off a
// canvas. The decoded image is always raster RGB so the subsequent JPEG
// re-encode in compress() is straightforward.
function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Browser couldn't decode the image"));
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader result not a string"));
        return;
      }
      // Strip "data:image/jpeg;base64," prefix.
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
