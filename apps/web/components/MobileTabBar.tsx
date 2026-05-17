"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mobile-only bottom tab bar. Hidden on md+ via `.mobile-tabbar` class. Hides
// itself on auth + admin + quiz pages to avoid cluttering full-screen flows.
export function MobileTabBar({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname() ?? "/";

  const hideOn = ["/sign-in", "/admin", "/quiz"];
  if (hideOn.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  // The four most-used destinations. Account swaps to Sign in when logged out
  // so the tab never goes to a forced-auth redirect for an anonymous visitor.
  const tabs = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/kitchen", label: "Kitchen", icon: "🍳" },
    { href: "/recipes", label: "Recipes", icon: "🥬" },
    isLoggedIn
      ? { href: "/settings", label: "Account", icon: "👤" }
      : { href: "/sign-in", label: "Sign in", icon: "👤" },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="mobile-tabbar" aria-label="Primary mobile">
      {tabs.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "flex flex-col items-center justify-center flex-1 min-h-[56px] py-1.5 text-[11px] font-semibold transition-colors " +
              (active
                ? "text-coral"
                : "text-ink-soft hover:text-ink")
            }
            aria-current={active ? "page" : undefined}
          >
            <span className="text-lg leading-none" aria-hidden>
              {t.icon}
            </span>
            <span className="mt-0.5">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
