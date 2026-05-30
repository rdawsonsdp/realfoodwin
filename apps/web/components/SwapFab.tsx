"use client";

// SwapFab — the always-on Scan entry. Big circular camera button at the
// bottom-right of every authenticated screen, sitting above the mobile tab
// bar (which the body reserves 5rem for via pb-20). Tapping opens the
// camera-first SwapModal.
//
// Visible on /home-v3 too. The thumb-reachable FAB is the primary in-store
// affordance — when the user pulls out their phone in an aisle, they should
// see this button without having to look. The inline camera entry on
// SwapHero stays as a secondary path inside the composer.

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
          aria-label="Scan a product"
          title="Scan a product"
          className="fixed z-[80] bottom-24 md:bottom-8 right-4 md:right-6 inline-flex flex-col items-center justify-center gap-0.5 rounded-full bg-coral text-white shadow-warm hover:brightness-95 active:scale-95 transition-all w-16 h-16 md:w-20 md:h-20 ring-4 ring-paper/30"
        >
          <span aria-hidden className="text-2xl md:text-3xl leading-none">
            📷
          </span>
          <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider leading-none">
            Scan
          </span>
        </button>
      )}
      <SwapModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
