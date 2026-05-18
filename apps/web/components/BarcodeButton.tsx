"use client";

// BarcodeButton — opens the camera and scans a UPC/EAN/QR using the
// browser-native BarcodeDetector API. When found, the detected code is
// returned to the parent which can submit it as the swap query.
//
// Support today (May 2026): Chrome on Android + desktop, Safari iOS 17+.
// On unsupported browsers we gracefully degrade — the button stays visible
// but tapping it explains the limitation and offers to take a photo instead.

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const BarcodeDetector: any;

interface Props {
  disabled?: boolean;
  onScan: (code: string) => void;
}

export function BarcodeButton({ disabled, onScan }: Props) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  // Open camera + start detection loop when the modal opens.
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
              cleanup();
              onScan(codes[0].rawValue);
              setOpen(false);
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

  function handleClick() {
    if (supported === false) {
      // Browser without BarcodeDetector — make it explicit rather than silent.
      setError("Barcode scanning isn't supported in this browser. Try a photo instead.");
      return;
    }
    setOpen(true);
  }

  function close() {
    cleanup();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-sunrise/10 transition-colors disabled:opacity-40 text-lg"
        aria-label="Scan a barcode"
        title="Scan a barcode"
      >
        ▥
      </button>

      {/* Inline error (only when unsupported and the user tried). */}
      {error && !open && (
        <span className="text-xs text-coral ml-2 self-center">{error}</span>
      )}

      {/* Camera modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-ink/90 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Scanning barcode"
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
            {/* Reticle */}
            <div className="absolute inset-8 border-2 border-paper/80 rounded-soft pointer-events-none" />
            <p className="absolute top-3 left-3 right-3 text-center text-paper text-sm font-medium">
              Point at a barcode
            </p>
            <button
              type="button"
              onClick={close}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-paper text-ink text-sm font-semibold px-5 py-2 shadow-card"
            >
              Cancel
            </button>
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
