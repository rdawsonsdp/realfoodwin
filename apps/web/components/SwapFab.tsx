"use client";

// SwapFab — the always-on swap entry. Floating camera button at the bottom-
// right, sitting above the mobile tab bar (which the body reserves 5rem for
// via pb-20). Tapping opens the SwapModal.

import { useState } from "react";
import { SwapModal } from "./SwapModal";

export function SwapFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Start a new swap"
          className="fixed z-[80] bottom-24 md:bottom-8 right-4 md:right-6 inline-flex items-center gap-2 rounded-pill bg-coral text-white shadow-warm hover:brightness-95 active:scale-95 transition-all pl-4 pr-5 py-3 font-semibold"
        >
          <span aria-hidden className="text-xl leading-none">
            📷
          </span>
          <span className="text-sm md:text-base">Swap</span>
        </button>
      )}
      <SwapModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
