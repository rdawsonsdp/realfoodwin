"use client";

// ScanLanding — client component for /scan. Auto-opens the camera-first
// SwapModal on mount. If the modal is dismissed (user backs out), we show a
// "Scan another product" button so they can re-enter without leaving the
// page. After the first permission grant the camera should open in ~500ms.

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwapModal } from "./SwapModal";

export function ScanLanding() {
  const [open, setOpen] = useState(false);

  // Open the camera modal immediately on first mount. Doing it inside
  // useEffect (vs. useState initial value) defers to the client and avoids
  // hydration mismatch warnings.
  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 text-center">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-paper mb-3">
        Scan a product
      </h1>
      <p className="text-paper/80 text-sm md:text-base max-w-[40ch] mx-auto mb-8">
        Point your camera at a barcode or a product label. We&apos;ll find a
        real-food alternative in seconds.
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-col items-center gap-2 rounded-pill bg-coral text-white shadow-warm hover:brightness-95 active:scale-[0.98] transition-all px-8 py-5 md:py-6"
        aria-label="Open the camera"
      >
        <span aria-hidden className="text-4xl md:text-5xl leading-none">
          📷
        </span>
        <span className="text-base md:text-lg font-extrabold leading-none">
          {open ? "Camera is on" : "Open camera"}
        </span>
      </button>

      <p className="mt-8 text-xs text-paper/60">
        <Link href="/home-v3" className="hover:text-paper">
          ← Or type a product instead
        </Link>
      </p>

      <SwapModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
