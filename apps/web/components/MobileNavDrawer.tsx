"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TestLoginButton } from "./TestLoginButton";

export type NavLink = {
  href: string;
  label: string;
  tone?: "warn";
};

interface Props {
  links: NavLink[];
  isLoggedIn: boolean;
}

// Mobile-only hamburger drawer. Slides down from the top, locks body scroll
// while open, and dismisses on link click + tap-outside + Escape. Lives next
// to the inline desktop nav, hidden via parent class on md+.
export function MobileNavDrawer({ links, isLoggedIn }: Props) {
  const [open, setOpen] = useState(false);

  // Lock the body scroll while the drawer is open so the page beneath
  // doesn't ghost-scroll when the user drags inside the drawer panel.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("scroll-locked");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("scroll-locked");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-11 h-11 rounded-pill text-ink hover:bg-honey/40 transition-colors"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-ink/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-x-0 top-0 bg-paper text-ink shadow-warm rounded-b-soft animate-fade-up safe-top"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="font-bold text-lg tracking-tight">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-pill hover:bg-honey/40"
                aria-label="Close menu"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <ul className="px-2 pb-4 divide-y divide-ink/5">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={
                      "flex items-center px-4 py-4 min-h-[52px] text-base font-semibold rounded-soft transition-colors " +
                      (l.tone === "warn"
                        ? "text-sunrise-700 hover:bg-sunrise/10"
                        : "text-ink hover:bg-honey/40")
                    }
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {!isLoggedIn && (
                <li>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="flex items-center px-4 py-4 min-h-[52px] text-base font-semibold text-ink hover:bg-honey/40 rounded-soft"
                  >
                    Sign in
                  </Link>
                </li>
              )}
              <li className="px-4 pt-4">
                <TestLoginButton />
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
