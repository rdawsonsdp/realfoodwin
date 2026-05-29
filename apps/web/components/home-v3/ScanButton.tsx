"use client";

// ScanButton — one button on the SwapHero that handles BOTH the barcode and
// photo flows. Tapping it:
//   * On browsers that support BarcodeDetector (Chrome on Android, Safari iOS
//     17+, desktop Chrome): opens an in-page camera modal. Barcode detection
//     runs continuously in the background; the user can either point at a
//     UPC/EAN and let it auto-submit, or tap the "Use this photo" button to
//     capture the current frame and submit it to the swap engine as an image.
//   * On unsupported browsers: opens the native camera/photo picker via a
//     hidden file input so photo mode still works.
//
// Replaces the previous pattern where SwapHero had two separate buttons
// (📷 photo and ▥ barcode). One affordance is enough — the user already has
// the camera open, they shouldn't have to decide barcode-vs-photo before
// they look through the lens.

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const BarcodeDetector: any;

interface Props {
  disabled?: boolean;
  onScan: (code: string) => void | Promise<void>;
  onPhoto: (file: File) => void | Promise<void>;
}

export function ScanButton({ disabled, onScan, onPhoto }: Props) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (!open || !supported) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (BarcodeDetector as any)({
          formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128", "qr_code"],
        });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              const code = codes[0].rawValue;
              cleanup();
              setOpen(false);
              void onScan(code);
              return;
            }
          } catch {
            // Frame skipped; continue.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, supported, onScan]);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setError(null);
  }

  function close() {
    cleanup();
    setOpen(false);
    setCapturing(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || capturing) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("could not capture frame");
      const file = new File([blob], "scan.jpg", { type: "image/jpeg" });
      cleanup();
      setOpen(false);
      void onPhoto(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
      setCapturing(false);
    }
  }

  function handleClick() {
    if (supported === null) return; // detection hasn't run yet
    if (supported === false) {
      // No BarcodeDetector → just trigger the native camera picker (photo only).
      fileInputRef.current?.click();
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label="Scan a barcode or take a photo"
        title="Scan a barcode or take a photo"
        className="w-11 h-11 rounded-full bg-ink/15 hover:bg-ink/25 active:scale-95 transition flex items-center justify-center text-xl ring-1 ring-ink/20 disabled:opacity-50"
      >
        <span aria-hidden>📷</span>
      </button>

      {/* Native fallback for browsers without BarcodeDetector. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void onPhoto(file);
          e.target.value = "";
        }}
      />

      {error && !open && (
        <span className="text-xs text-coral ml-2 self-center">{error}</span>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-ink/90 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Scan or photo"
        >
          <div
            className="relative w-full max-w-md aspect-square bg-ink rounded-soft overflow-hidden shadow-warm"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-8 border-2 border-paper/80 rounded-soft pointer-events-none" />
            <p className="absolute top-3 left-3 right-3 text-center text-paper text-sm font-medium drop-shadow">
              Point at a barcode — or tap the camera to capture a photo
            </p>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={close}
                className="rounded-pill bg-paper/90 text-ink text-sm font-semibold px-4 py-2 shadow-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={capturing}
                className="inline-flex items-center gap-2 rounded-pill bg-coral text-white text-sm font-bold px-5 py-2 shadow-warm hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <span aria-hidden>📷</span>
                {capturing ? "Capturing…" : "Use this photo"}
              </button>
            </div>

            {error && (
              <p className="absolute bottom-16 left-3 right-3 text-center text-coral-soft text-sm">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
