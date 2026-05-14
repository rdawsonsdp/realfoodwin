import Link from "next/link";
import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function KitchenPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/kitchen"));

  const { data: entries } = await supabase
    .from("recipe_box_entries")
    .select("*, recipes(title, time_min, meal_type, tags), swaps(narrative, recipe), recipe_variants(modification, recipe)")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">My Kitchen</h1>
          <p className="text-ink-soft mt-2">
            {entries?.length ?? 0} saved {entries?.length === 1 ? "recipe" : "recipes"}
          </p>
        </header>

        {!entries || entries.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink-soft mb-4">Your kitchen is empty. Find a swap and save it.</p>
            <Link href="/" className="btn-primary">Find a swap</Link>
          </div>
        ) : (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sunrise-700 mb-4">
              Lately
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => {
                const recipe = entry.recipes ?? entry.swaps?.recipe ?? entry.recipe_variants?.recipe;
                const title =
                  entry.recipes?.title ??
                  (recipe as { title?: string } | null)?.title ??
                  "Saved swap";
                const subtitle =
                  entry.recipes?.meal_type ??
                  entry.recipe_variants?.modification ??
                  "From a swap";
                return (
                  <div key={entry.id} className="card p-5 hover:shadow-warm transition-shadow">
                    <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                      {subtitle}
                    </div>
                    <h3 className="font-bold text-ink">{title}</h3>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {entry.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-pill bg-honey/40">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
