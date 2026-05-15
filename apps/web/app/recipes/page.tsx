import Link from "next/link";
import { Nav } from "@/components/Nav";
import { RecipeCardActions } from "@/components/RecipeCardActions";
import { AverageStars } from "@/components/AverageStars";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const supabase = createSupabaseServer();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, time_min, difficulty, meal_type, tags, ingredients")
    .order("created_at", { ascending: false });

  // Pull aggregate ratings for every recipe in one shot.
  const ids = (recipes ?? []).map((r) => r.id);
  const aggMap = new Map<string, { avg: number; count: number }>();
  if (ids.length > 0) {
    const { data: aggs } = await supabase
      .from("recipe_ratings_aggregate")
      .select("target_id, avg_stars, rating_count")
      .eq("target_type", "recipe")
      .in("target_id", ids);
    for (const a of aggs ?? []) {
      aggMap.set(a.target_id, {
        avg: Number(a.avg_stars),
        count: a.rating_count,
      });
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Recipe library</h1>
          <p className="text-ink-soft mt-2">
            Real-food versions of the stuff you already love. Tap to open, or text / share a recipe straight from the card.
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes?.map((r) => {
            const ingCount = Array.isArray(r.ingredients) ? r.ingredients.length : 0;
            const metaParts = [
              r.meal_type ?? "Recipe",
              r.time_min ? `${r.time_min} min` : null,
              ingCount > 0 ? `${ingCount} ingredients` : null,
            ].filter(Boolean);
            const meta = metaParts.join(" · ");
            return (
              <div
                key={r.id}
                className="card hover:shadow-warm hover:-translate-y-0.5 transition-all flex flex-col"
              >
                <Link
                  href={`/recipes/${r.id}`}
                  className="block p-5 flex-1"
                >
                  <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                    {meta}
                  </div>
                  <h3 className="font-bold text-ink mb-2">{r.title}</h3>
                  <div className="mt-1">
                    <AverageStars
                      avg={aggMap.get(r.id)?.avg}
                      count={aggMap.get(r.id)?.count}
                    />
                  </div>
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {r.tags.slice(0, 4).map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-pill bg-honey/40">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="px-3 pb-2 pt-1 border-t border-ink/5 bg-paper/60 flex items-center justify-between">
                  <Link
                    href={`/recipes/${r.id}`}
                    className="text-sm text-sunrise font-semibold px-2 py-2"
                  >
                    View →
                  </Link>
                  <RecipeCardActions
                    recipeId={r.id}
                    title={r.title}
                    meta={metaParts.slice(0, 2).join(" · ")}
                  />
                </div>
              </div>
            );
          }) ?? <p className="text-ink-muted">No recipes yet.</p>}
        </div>
      </main>
    </>
  );
}
