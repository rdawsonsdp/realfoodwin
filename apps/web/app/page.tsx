// Public landing page for anonymous visitors. Logged-in users get redirected
// to /home-v3 immediately so they never see this.
//
// The visual structure mirrors /home-v3 (marketing pill + two-tone "Real
// Food Diet Swaps" headline + subhead + dominant Scan CTA) so the brand
// hits the same way before and after sign-up. Below the hero we replace the
// logged-in surface (swap composer, streak counter, recent-swaps row) with
// sign-up CTAs and a short "what you get" panel that motivates account
// creation.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTheme } from "@/lib/home-themes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home-v3");

  // Use the default home theme so the anon and logged-in landings feel like
  // the same surface — same forest-green background, same coral accents.
  const theme = getTheme(undefined);
  const toneClass = theme.tone === "ink" ? "text-ink" : "text-paper";

  return (
    <div
      className={`min-h-screen ${toneClass}`}
      style={{ background: theme.background }}
    >
      <Nav />
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-14">
        {/* Hero — identical structure to /home-v3 so the brand is consistent
            from the moment a visitor lands. */}
        <section className="text-center">
          <div className="mb-6">
            <span className="inline-block rounded-pill ring-1 ring-coral/50 px-4 py-1.5 text-coral text-[10px] md:text-xs font-bold tracking-[0.18em] uppercase">
              Replace ultra-processed food with real food
            </span>
            <h1 className="mt-5 text-paper text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
              <span className="text-coral">Real Food</span>{" "}
              <span className="italic font-serif">Diet Swaps</span>
            </h1>
            <p className="mt-4 text-paper/85 text-sm md:text-base max-w-[44ch] mx-auto leading-snug">
              Scan any junk-food product and we&apos;ll show you the real-food
              version with ingredients, nutrition comparison, and a recipe you
              can make today.
            </p>
          </div>

          {/* Dominant Scan CTA — mirrors the in-app /home-v3 affordance. For
              anonymous visitors this routes to /sign-in which carries them
              back to /scan after auth. */}
          <Link
            href="/sign-in?next=/scan"
            className="mx-auto block w-full max-w-md mb-5 rounded-pill bg-coral text-white shadow-warm hover:brightness-95 active:scale-[0.98] transition-all px-5 py-5 md:py-6 text-center"
            aria-label="Start scanning — sign up free"
          >
            <span className="inline-flex items-center gap-3 text-lg md:text-xl font-extrabold">
              <span aria-hidden className="text-2xl md:text-3xl">📷</span>
              Start scanning — free
            </span>
            <span className="block mt-0.5 text-xs md:text-sm font-medium text-white/85">
              Create an account in 30 seconds
            </span>
          </Link>

          <p className="text-xs text-paper/60">
            Already a member?{" "}
            <Link href="/sign-in" className="font-semibold text-paper hover:text-coral underline">
              Sign in
            </Link>
          </p>
        </section>

        {/* "What you get" panel — replaces the logged-in features (swap
            counter + recent swaps carousel) with concrete reasons to create
            an account. */}
        <section className="mt-12 md:mt-16">
          <p className="text-center text-xs uppercase tracking-[0.18em] font-bold text-paper/70 mb-5">
            What you get
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Feature
              emoji="📷"
              title="One-tap scanning"
              body="Barcode or photo — point and we identify the product. Most scans resolve in under 2 seconds."
            />
            <Feature
              emoji="🍳"
              title="Real recipes you'll cook"
              body="Every swap comes with a complete recipe, nutrition, and a list of what was wrong with the original."
            />
            <Feature
              emoji="🏷️"
              title="Real products to buy"
              body="When you don't feel like cooking, we surface authorized real-food brands that you can buy direct."
            />
          </ul>
        </section>

        {/* Secondary sign-up nudge at the bottom so the call to action is
            never more than a screen away on mobile. */}
        <section className="mt-12 md:mt-16 rounded-soft bg-paper/5 ring-1 ring-paper/20 px-5 py-6 md:px-8 md:py-8 text-center">
          <h2 className="text-paper text-xl md:text-2xl font-extrabold tracking-tight">
            Ready to try a swap?
          </h2>
          <p className="mt-2 text-sm md:text-base text-paper/75 max-w-[44ch] mx-auto">
            Sign up free and the first thing you&apos;ll see is the camera.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-in?next=/scan"
              className="inline-flex items-center justify-center rounded-pill bg-coral text-white shadow-warm hover:brightness-95 active:scale-[0.98] transition-all px-6 py-3 text-sm md:text-base font-bold"
            >
              Create my account
            </Link>
            <Link
              href="/brands"
              className="inline-flex items-center justify-center rounded-pill ring-1 ring-paper/40 text-paper hover:bg-paper/10 transition-all px-6 py-3 text-sm md:text-base font-semibold"
            >
              Browse real brands
            </Link>
          </div>
        </section>
      </main>
      <footer
        className={`text-center text-xs py-8 ${theme.tone === "ink" ? "text-ink/60" : "text-paper/40"}`}
      >
        <p>Real Food Win never sells, shares, or monetizes your data.</p>
        <p className="mt-1 italic">
          Replace ultra-processed food with real food, family by family.
        </p>
      </footer>
    </div>
  );
}

function Feature({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-soft bg-paper/5 ring-1 ring-paper/15 px-4 py-4 text-left">
      <p className="text-3xl leading-none" aria-hidden>
        {emoji}
      </p>
      <p className="mt-3 text-paper font-bold text-base leading-tight">
        {title}
      </p>
      <p className="mt-1.5 text-sm text-paper/75 leading-snug">{body}</p>
    </li>
  );
}
