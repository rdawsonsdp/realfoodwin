import { Nav } from "@/components/Nav";
import { RecipeLibrary, type RecipeRow } from "@/components/RecipeLibrary";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const supabase = createSupabaseServer();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, time_min, difficulty, meal_type, tags, ingredients")
    .order("created_at", { ascending: false });

  const rows: RecipeRow[] = recipes ?? [];

  // Pull aggregate ratings for every recipe in one shot.
  const ids = rows.map((r) => r.id);
  const ratings: Record<string, { avg: number; count: number }> = {};
  if (ids.length > 0) {
    const { data: aggs } = await supabase
      .from("recipe_ratings_aggregate")
      .select("target_id, avg_stars, rating_count")
      .eq("target_type", "recipe")
      .in("target_id", ids);
    for (const a of aggs ?? []) {
      ratings[a.target_id] = {
        avg: Number(a.avg_stars),
        count: a.rating_count,
      };
    }
  }

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            Real Food <span className="italic font-serif text-sage">Recipes</span>
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl mx-auto">
            Simple, fast, and affordable meals that your whole family will actually want to eat — no complicated techniques or expensive superfoods required.
          </p>
        </header>

        <RecipeLibrary recipes={rows} ratings={ratings} />
      </main>
    </>
  );
}
