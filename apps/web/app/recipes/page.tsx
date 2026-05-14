import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const supabase = createSupabaseServer();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, time_min, difficulty, meal_type, tags")
    .order("created_at", { ascending: false });

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Recipe library</h1>
          <p className="text-ink-soft mt-2">Real-food versions of the stuff you already love.</p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes?.map((r) => (
            <article key={r.id} className="card p-5 hover:shadow-warm transition-shadow">
              <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                {r.meal_type ?? "Recipe"} · {r.time_min ?? "—"} min
              </div>
              <h3 className="font-bold text-ink mb-2">{r.title}</h3>
              {r.tags && r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {r.tags.slice(0, 4).map((t: string) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-pill bg-honey/40">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </article>
          )) ?? <p className="text-ink-muted">No recipes yet.</p>}
        </div>
      </main>
    </>
  );
}
