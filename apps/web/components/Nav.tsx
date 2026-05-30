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

  // Pick the friendliest label we have for the logged-in user. Prefer the
  // display_name they set; fall back to the email local-part. Shown in the
  // header so it's obvious which account is signed in.
  let userLabel: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName = (profile as { display_name?: string | null } | null)?.display_name?.trim();
    userLabel = displayName || user.email?.split("@")[0] || null;
  }

  // Single source of truth for both the desktop inline row and the mobile
  // drawer — keeps the two presentations in sync without duplicating logic.
  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/brands", label: "Brands" },
    ...(user
      ? ([{ href: "/kitchen", label: "The Kitchen" }] as NavLink[])
      : [{ href: "/kitchen?tab=real-food", label: "Recipes" } as NavLink]),
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
            {userLabel && (
              <Link
                href="/settings"
                className="ml-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/80 hover:text-ink px-2 py-1.5 rounded-pill hover:bg-ink/5 max-w-[14ch] truncate"
                title={`Signed in as ${userLabel}`}
              >
                <span aria-hidden>👤</span>
                <span className="truncate">{userLabel}</span>
              </Link>
            )}
            {!user && (
              <Link href="/sign-in" className="btn-secondary ml-2 py-2">
                Sign in
              </Link>
            )}
            <div className="ml-2 pl-2 border-l border-ink/10">
              <TestLoginButton />
            </div>
          </nav>

          {/* Mobile — Test Login + Sign-in CTA + hamburger drawer. Test Login
              sits in the header (not in the drawer) so the modal pops over
              everything without the drawer being in the way. */}
          <div className="md:hidden flex items-center gap-1">
            {userLabel && (
              <span
                className="text-xs font-semibold text-ink/70 truncate max-w-[8ch]"
                title={`Signed in as ${userLabel}`}
              >
                {userLabel}
              </span>
            )}
            <TestLoginButton />
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
