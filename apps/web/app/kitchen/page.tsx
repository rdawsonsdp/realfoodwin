import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Scorecard } from "@/components/Scorecard";
import { type KitchenItem } from "@/components/KitchenBrowser";
import { KitchenTabs } from "@/components/KitchenTabs";
import { type RecipeRow } from "@/components/RecipeLibrary";
import { RecentlyDeleted } from "@/components/RecentlyDeleted";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const POINTS_PER_LEVEL = 100;
const PTS = { swap: 10, save: 15, made_it: 30, rating: 5 };

type KitchenEntry = {
  id: string;
  saved_at: string;
  tags: string[] | null;
  recipe_id: string | null;
  swap_id: string | null;
  variant_id: string | null;
  recipes: { title: string; time_min: number | null; meal_type: string | null; tags: string[] | null } | null;
  swaps: {
    narrative: string | null;
    recipe: { title?: string; meal_type?: string } | null;
    output: { title?: string; tagline?: string; recipe?: { meal_type?: string } } | null;
    swap_target: string | null;
  } | null;
  recipe_variants: { modification: string | null; recipe: { title?: string; meal_type?: string } | null } | null;
};

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/kitchen"));

  const { tab } = await searchParams;
  const initialTab: "mine" | "real-food" =
    tab === "real-food" ? "real-food" : "mine";

  const [entriesRes, swapsCountRes, madeItCountRes, ratingsRes, madeItRes, recipesRes] = await Promise.all([
    supabase
      .from("recipe_box_entries")
      .select(
        "*, recipes(title, time_min, meal_type, tags), swaps(narrative, recipe, output, swap_target), recipe_variants(modification, recipe)",
      )
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false }),
    supabase.from("swaps").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("events")
      .select("id, target_id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("event_type", "made_it_loved"),
    supabase
      .from("recipe_ratings")
      .select("target_type, target_id, stars")
      .eq("user_id", user.id),
    supabase
      .from("events")
      .select("target_id, target_type")
      .eq("user_id", user.id)
      .eq("event_type", "made_it_loved"),
    supabase
      .from("recipes")
      .select("id, title, time_min, difficulty, meal_type, tags, ingredients, description")
      .order("created_at", { ascending: false }),
  ]);

  const recipes: RecipeRow[] = recipesRes.data ?? [];
  const recipeIds = recipes.map((r) => r.id);
  const recipeRatings: Record<string, { avg: number; count: number }> = {};
  if (recipeIds.length > 0) {
    const { data: aggs } = await supabase
      .from("recipe_ratings_aggregate")
      .select("target_id, avg_stars, rating_count")
      .eq("target_type", "recipe")
      .in("target_id", recipeIds);
    for (const a of aggs ?? []) {
      recipeRatings[a.target_id] = {
        avg: Number(a.avg_stars),
        count: a.rating_count,
      };
    }
  }

  const entries = (entriesRes.data ?? []) as unknown as KitchenEntry[];
  const swapCount = swapsCountRes.count ?? 0;
  const savedCount = entries.length;
  const madeItCount = madeItCountRes.count ?? 0;
  const ratingsCount = (ratingsRes.data ?? []).length;

  const totalPoints =
    swapCount * PTS.swap + savedCount * PTS.save + madeItCount * PTS.made_it + ratingsCount * PTS.rating;
  const level = Math.max(1, Math.floor(totalPoints / POINTS_PER_LEVEL) + 1);
  const pointsInLevel = totalPoints - (level - 1) * POINTS_PER_LEVEL;

  // Build per-target lookup maps so we can attach rating + made-it to each entry.
  const ratingMap = new Map<string, number>();
  for (const r of ratingsRes.data ?? []) {
    if (r.target_type && r.target_id) ratingMap.set(`${r.target_type}:${r.target_id}`, r.stars);
  }
  const madeItSet = new Set<string>();
  for (const e of madeItRes.data ?? []) {
    if (e.target_type && e.target_id) madeItSet.add(`${e.target_type}:${e.target_id}`);
  }

  // Project each entry into the lighter KitchenItem shape used by the browser.
  const items: KitchenItem[] = entries
    .map((entry): KitchenItem | null => {
      const swapRecipe = entry.swaps?.recipe ?? null;
      const swapOutput = entry.swaps?.output ?? null;
      const variantRecipe = entry.recipe_variants?.recipe ?? null;
      const swapTarget = entry.swaps?.swap_target ?? null;

      let title: string;
      let kicker: string;
      let href: string;
      let mealType: string | null;
      let targetType: "swap" | "recipe" | "variant";
      let targetId: string;

      if (entry.recipes && entry.recipe_id) {
        title = entry.recipes.title;
        mealType = entry.recipes.meal_type;
        kicker = mealType ? `Recipe · ${mealType}` : "Recipe";
        href = `/recipes/${entry.recipe_id}`;
        targetType = "recipe";
        targetId = entry.recipe_id;
      } else if (entry.swaps && entry.swap_id) {
        const altTitle = swapOutput?.title ?? swapRecipe?.title ?? "your real-food swap";
        title = swapTarget ? `${swapTarget} swap → ${altTitle}` : altTitle;
        mealType = swapOutput?.recipe?.meal_type ?? swapRecipe?.meal_type ?? null;
        kicker = "Personalized swap";
        href = `/swap/${entry.swap_id}`;
        targetType = "swap";
        targetId = entry.swap_id;
      } else if (entry.recipe_variants && entry.variant_id) {
        const baseTitle = variantRecipe?.title ?? "Variant";
        const mod = entry.recipe_variants.modification;
        title = mod ? `${baseTitle} (${mod})` : baseTitle;
        mealType = variantRecipe?.meal_type ?? null;
        kicker = "Your variation";
        href = "#";
        targetType = "variant";
        targetId = entry.variant_id;
      } else {
        return null;
      }

      const key = `${targetType}:${targetId}`;
      const tags =
        (entry.tags && entry.tags.length ? entry.tags : entry.recipes?.tags ?? []) ?? [];

      return {
        id: entry.id,
        href,
        title,
        kicker,
        meal_type: mealType,
        saved_at: entry.saved_at,
        narrative: entry.swaps?.narrative ?? null,
        tags,
        rating: ratingMap.get(key) ?? null,
        made_it: madeItSet.has(key),
        target_type: targetType,
        target_id: targetId,
      };
    })
    .filter((x): x is KitchenItem => x !== null);

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <header className="mb-6 md:mb-8 flex items-start gap-3 md:gap-4 flex-wrap">
          <RecentlyDeleted />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-paper">The Kitchen</h1>
            <p className="text-paper/80 mt-2 text-sm md:text-base">
              {entries.length} saved · search both your kitchen and the Real Food Kitchen.
            </p>
          </div>
        </header>

        {/* Kitchen toolbar — square buttons; new tools land here over time. */}
        <section className="mb-8" aria-label="Kitchen tools">
          <p className="text-xs uppercase tracking-[0.18em] text-paper/60 mb-3">Tools</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 sm:flex sm:flex-wrap">
            <ToolTile
              href="/kitchen/build"
              icon="🛠"
              label="Build a recipe"
              hint="From a photo"
            />
          </div>
        </section>

        <Scorecard
          swaps={swapCount}
          saved={savedCount}
          madeIt={madeItCount}
          rated={ratingsCount}
          level={level}
          points={pointsInLevel}
          pointsToNextLevel={POINTS_PER_LEVEL}
        />

        <KitchenTabs
          myItems={items}
          recipes={recipes}
          ratings={recipeRatings}
          initialTab={initialTab}
        />
        {items.length === 0 && initialTab === "mine" && (
          <div className="card p-6 md:p-10 text-center mt-4">
            <p className="text-ink-soft mb-4">
              Your kitchen is quiet. Let's fix that — find a swap and save it.
            </p>
            <Link href="/home-v3" className="btn-primary">Find a swap</Link>
          </div>
        )}
      </main>
    </>
  );
}

function ToolTile({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center justify-center text-center gap-1 p-4 w-full sm:w-32 h-32 hover:shadow-warm hover:-translate-y-0.5 transition-all"
    >
      <div className="text-4xl leading-none" aria-hidden>
        {icon}
      </div>
      <div className="text-sm font-semibold text-ink mt-1 leading-tight">{label}</div>
      {hint && <div className="text-xs text-ink-muted leading-tight">{hint}</div>}
    </Link>
  );
}
