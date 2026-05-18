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
    }
  }, [open]);

  async function handleFile(file: File) {
    const compressed = await compress(file);
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
    try {
      const data = await apiPost<{
        swap: { id: string } | null;
      }>("/api/swap", {
        query: q.trim(),
        ...(img ? { image: { media_type: img.mediaType, data: img.data } } : {}),
      });
      if (data.swap?.id) {
        onClose();
        router.push(`/swap/${data.swap.id}`);
      } else {
        // Some flows (legacy product hits) don't return a swap id — fall back to
        // routing home with the query so the SwapHero there can render results.
        onClose();
        router.push(`/?q=${encodeURIComponent(q.trim())}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
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
        className="relative w-full max-w-lg bg-paper text-ink rounded-t-soft md:rounded-soft shadow-warm overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink/10">
          <p className="text-sm uppercase tracking-[0.16em] font-bold text-forest-700">
            Start a swap
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

        <div className="p-5 md:p-6 space-y-4">
          {/* Primary camera CTA — most common path, biggest target. */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="w-full rounded-soft bg-coral hover:brightness-95 text-white px-5 py-6 md:py-7 shadow-warm transition-all active:scale-[0.99] disabled:opacity-60"
          >
            <div className="flex items-center justify-center gap-3">
              <span aria-hidden className="text-3xl md:text-4xl leading-none">
                📷
              </span>
              <div className="text-left">
                <p className="text-lg md:text-xl font-bold">Snap a photo</p>
                <p className="text-sm font-normal opacity-90">
                  The fastest way — point at any food
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
              onScan={(code) => {
                // Submit the detected code as the query. The swap API + LLM can
                // interpret a bare barcode; future enhancement: resolve via
                // Open Food Facts first for a friendlier product name.
                setQuery(code);
                void submit(null, code);
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

// JPEG compression — same algorithm as the existing PhotoUploadButton so the
// modal stays consistent with the home-page swap input.
async function compress(file: File): Promise<PickedImage> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
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
