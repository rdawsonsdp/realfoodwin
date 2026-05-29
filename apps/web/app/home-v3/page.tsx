// v3 home — swap-first. One action, one metric.
//
// The brand promise is "one swap at a time." This page reflects that:
// a single dominant CTA (SwapHero) and one tracked metric — swap count
// for today / week / month / lifetime. Everything else (coach view,
// history, recipes) is reachable via nav, never crowding the home
// surface. See ~/.claude/projects/.../memory/product_swap_first_home.md
// for the product principle that drives this layout.

import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SwapHero } from "@/components/home-v3/SwapHero";
import { SwapCounter } from "@/components/home-v3/SwapCounter";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSwapCounts } from "@/lib/swap-counts";
import { getQuoteForToday } from "@/lib/quotes";
import { getTheme, buildCustomTheme, CUSTOM_THEME_ID } from "@/lib/home-themes";

export const dynamic = "force-dynamic";

export default async function HomeV3() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const now = new Date();

  const [counts, prefsRow] = await Promise.all([
    getSwapCounts(user.id, now),
    supabase
      .from("user_preferences")
      .select("ui_prefs")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const quote = getQuoteForToday(now);
  const uiPrefs = (prefsRow.data?.ui_prefs ?? {}) as {
    theme?: string;
    custom_bg?: string | null;
  };
  const theme =
    uiPrefs.theme === CUSTOM_THEME_ID && uiPrefs.custom_bg
      ? buildCustomTheme(uiPrefs.custom_bg)
      : getTheme(uiPrefs.theme);
  const toneClass = theme.tone === "ink" ? "text-ink" : "text-paper";

  return (
    <div className={`min-h-screen ${toneClass}`} style={{ background: theme.background }}>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-14">
        <SwapHero
          quote={quote}
          themeId={theme.id}
          hasCustomBg={!!uiPrefs.custom_bg}
        />
        <SwapCounter counts={counts} />
      </main>
      <footer
        className={`text-center text-xs py-8 ${
          theme.tone === "ink" ? "text-ink/60" : "text-paper/40"
        }`}
      >
        One swap at a time.
      </footer>
    </div>
  );
}
