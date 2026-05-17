import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { TestLoginButton } from "./TestLoginButton";
import { MobileNavDrawer, type NavLink } from "./MobileNavDrawer";
import { MobileTabBar } from "./MobileTabBar";

export async function Nav() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminRequest(user?.email ?? null);

  // Single source of truth for both the desktop inline row and the mobile
  // drawer — keeps the two presentations in sync without duplicating logic.
  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/recipes", label: "Recipes" },
    { href: "/brands", label: "Brands" },
    ...(user
      ? ([{ href: "/kitchen", label: "My Kitchen" }] as NavLink[])
      : []),
    ...(user && isAdmin
      ? ([{ href: "/admin", label: "Admin", tone: "warn" }] as NavLink[])
      : []),
    ...(user ? ([{ href: "/settings", label: "Account" }] as NavLink[]) : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-paper/90 border-b border-ink/5 text-ink safe-top">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <div className="w-8 h-8 rounded-soft bg-forest grid place-items-center text-paper font-bold shadow-warm transition-transform group-hover:scale-105 flex-shrink-0">
              ◯
            </div>
            <span className="font-bold text-lg tracking-tight truncate">
              Real Food Win
            </span>
          </Link>

          {/* Desktop inline nav — hidden on <md, replaced by hamburger */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "btn-ghost" +
                  (l.tone === "warn"
                    ? " text-sunrise-700 hover:bg-sunrise/10"
                    : "")
                }
              >
                {l.label}
              </Link>
            ))}
            {!user && (
              <Link href="/sign-in" className="btn-secondary ml-2 py-2">
                Sign in
              </Link>
            )}
            <div className="ml-2 pl-2 border-l border-ink/10">
              <TestLoginButton />
            </div>
          </nav>

          {/* Mobile — hamburger drawer + test-login folded into it */}
          <div className="md:hidden flex items-center gap-1">
            {!user && (
              <Link
                href="/sign-in"
                className="btn-secondary py-2 px-4 text-sm"
              >
                Sign in
              </Link>
            )}
            <MobileNavDrawer links={links} isLoggedIn={!!user} />
          </div>
        </div>
      </header>

      {/* Mobile-only bottom tab bar with the 3-4 most-used destinations. */}
      <MobileTabBar isLoggedIn={!!user} />
    </>
  );
}
