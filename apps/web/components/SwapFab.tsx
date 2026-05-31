"use client";

// SwapFab — the always-on Scan entry. Big circular camera button at the
// bottom-right of every authenticated screen, sitting above the mobile tab
// bar (which the body reserves 5rem for via pb-20). Tapping opens the
// camera-first SwapModal.
//
// Hidden on routes that already render a giant inline Scan CTA (/home-v3,
// the anon landing /, and /scan itself), since a second floating button
// there is redundant. Visible everywhere else — Kitchen, Brands, settings,
// etc. — so the camera is always one tap away from any page.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SwapModal } from "./SwapModal";

const HIDE_ON_PATHS = ["/", "/home-v3", "/scan"];

export function SwapFab() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  if (
    HIDE_ON_PATHS.some((p) =>
      p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return null;
  }

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
