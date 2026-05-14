import { Nav } from "@/components/Nav";
import { SwapHero } from "@/components/SwapHero";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        <SwapHero isLoggedIn={!!user} />
      </main>
      <footer className="max-w-6xl mx-auto px-6 py-12 text-center text-sm text-ink-muted">
        <p>Real Food Win never sells, shares, or monetizes your data.</p>
        <p className="mt-2 italic">Replace ultra-processed food with real food, family by family.</p>
      </footer>
    </>
  );
}
