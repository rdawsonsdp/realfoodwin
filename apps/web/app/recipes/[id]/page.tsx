import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RecipeActions } from "@/components/RecipeActions";
import { SaveRecipeButton } from "@/components/SaveRecipeButton";
import { StarRating } from "@/components/StarRating";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseServer();

  const [{ data: recipe }, { data: { user } }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!recipe) return notFound();

  // Has the current user already saved this recipe to their kitchen?
  let alreadySaved = false;
  let myRating: number | null = null;
  if (user) {
    const [savedRes, ratingRes] = await Promise.all([
      supabase
        .from("recipe_box_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("recipe_id", id)
        .maybeSingle(),
      supabase
        .from("recipe_ratings")
        .select("stars")
        .eq("user_id", user.id)
        .eq("target_type", "recipe")
        .eq("target_id", id)
        .maybeSingle(),
    ]);
    alreadySaved = !!savedRes.data;
    myRating = ratingRes.data?.stars ?? null;
  }

  // Average rating across all users.
  const { data: agg } = await supabase
    .from("recipe_ratings_aggregate")
    .select("avg_stars, rating_count")
    .eq("target_type", "recipe")
    .eq("target_id", id)
    .maybeSingle();

  // Normalize ingredients into a typed array — seeded content stores them as
  // either string[] or {name, quantity, unit}[] depending on the import pass.
  const rawIngredients = (recipe.ingredients ?? []) as Array<Ingredient | string>;
  const ingredients: Ingredient[] = rawIngredients.map((ing) =>
    typeof ing === "string" ? { name: ing, quantity: "", unit: "" } : ing,
  );

  const steps = (recipe.steps ?? []) as string[];
  const tags = (recipe.tags ?? []) as string[];

  const meta = [
    recipe.time_min ? `${recipe.time_min} min` : null,
    recipe.difficulty,
    recipe.meal_type,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10 print:py-0 print:px-0 print:max-w-full">
        <Link href="/recipes" className="btn-ghost-on-dark mb-6 inline-flex print:hidden">
          ← Recipes
        </Link>

        <article className="card overflow-hidden print:shadow-none print:border-0 print:rounded-none print:bg-white">
          {/* Hero */}
          <header className="p-8 md:p-10 bg-gradient-to-br from-honey/30 via-cream to-paper print:bg-white">
            <div className="flex items-start justify-between gap-6 mb-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                {recipe.meal_type ?? "Recipe"}
              </p>
              <span className="badge-tuned print:hidden">Real Food Win</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              {recipe.title}
            </h1>
            {meta && <p className="text-ink-soft mt-3 text-lg">{meta}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 print:hidden">
                {tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-pill bg-honey/40 text-ink">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Rating row */}
          <div className="px-8 md:px-10 py-5 border-t border-ink/5 bg-paper/40">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-sunrise-700 font-semibold mb-1.5">
                  Rate this recipe
                </p>
                <p className="text-sm text-ink-muted">
                  Your ratings help the coach pick what to suggest next.
                </p>
              </div>
              <StarRating
                targetType="recipe"
                targetId={id}
                targetLabel={recipe.title}
                initialStars={myRating ?? 0}
                averageStars={agg?.avg_stars ? Number(agg.avg_stars) : undefined}
                ratingCount={agg?.rating_count ?? 0}
                size="lg"
                isLoggedIn={!!user}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-8 md:px-10 py-5 border-y border-ink/5 bg-white flex flex-wrap items-center justify-between gap-4">
            <RecipeActions
              recipe={{
                title: recipe.title,
                ingredients,
                steps,
                time_min: recipe.time_min,
                difficulty: recipe.difficulty,
                meal_type: recipe.meal_type,
              }}
              shareUrl={`/recipes/${id}`}
            />
            <SaveRecipeButton
              recipeId={id}
              isLoggedIn={!!user}
              alreadySaved={alreadySaved}
            />
          </div>

          {/* Body */}
          <div className="p-8 md:p-10 grid md:grid-cols-[1fr_2fr] gap-10 print:grid-cols-[1fr_2fr] print:gap-6">
            {/* Ingredients column */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-4">
                Ingredients
              </h2>
              <ul className="space-y-2.5">
                {ingredients.map((ing, i) => (
                  <li key={i} className="flex gap-3 text-ink-soft leading-relaxed">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-pill bg-sunrise mt-2 flex-shrink-0"
                      aria-hidden
                    />
                    <span>
                      {ing.quantity && (
                        <strong className="text-ink mr-1">
                          {ing.quantity}
                          {ing.unit ? ` ${ing.unit}` : ""}
                        </strong>
                      )}
                      {ing.name}
                    </span>
                  </li>
                ))}
              </ul>
              {tags.length > 0 && (
                <div className="hidden print:block mt-6 pt-4 border-t border-ink/10 text-xs text-ink-muted">
                  Tags: {tags.join(", ")}
                </div>
              )}
            </section>

            {/* Steps column */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-4">
                Method
              </h2>
              <ol className="space-y-5">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-pill bg-sunrise text-white font-bold text-sm grid place-items-center print:bg-ink/10 print:text-ink">
                      {i + 1}
                    </span>
                    <p className="text-ink-soft leading-relaxed pt-1.5">{s}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Footer (print only — branding) */}
          <div className="hidden print:block px-10 py-6 border-t border-ink/10 text-center text-sm text-ink-soft">
            <p className="italic">Replace ultra-processed food with real food, family by family.</p>
            <p className="mt-1 text-xs">Real Food Win · realfoodwin.org</p>
          </div>
        </article>
      </main>
    </>
  );
}
