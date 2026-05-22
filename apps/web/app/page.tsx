import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SwapHero } from "@/components/SwapHero";
import { HeroSplash } from "@/components/HeroSplash";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in users go straight to the swap-first home. The classic layout
  // (Coach greeting + Fresh Finds + classic SwapHero) has been retired —
  // /home-v3 is the canonical home now.
  if (user) redirect("/home-v3");

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <HeroSplash />
        <SwapHero isLoggedIn={false} />
      </main>
      <footer className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 text-center text-sm text-paper/60">
        <p>Real Food Win never sells, shares, or monetizes your data.</p>
        <p className="mt-2 italic">
          Replace ultra-processed food with real food, family by family.
        </p>
      </footer>
    </>
  );
}
