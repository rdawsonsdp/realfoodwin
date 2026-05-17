import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Scorecard } from "@/components/Scorecard";
import { KitchenBrowser, type KitchenItem } from "@/components/KitchenBrowser";
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

export default async function KitchenPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/kitchen"));

  const [entriesRes, swapsCountRes, madeItCountRes, ratingsRes, madeItRes] = await Promise.all([
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
  ]);

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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 flex-wrap">
            <RecentlyDeleted />
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-paper">My Kitchen</h1>
              <p className="text-paper/80 mt-2">
                {entries.length} saved {entries.length === 1 ? "recipe" : "recipes"} · organized by meal, sortable by rating, searchable.
              </p>
            </div>
          </div>
          <Link href="/kitchen/build" className="btn-primary">
            <span aria-hidden>🛠</span> Build a recipe from a photo
          </Link>
        </header>

        <Scorecard
          swaps={swapCount}
          saved={savedCount}
          madeIt={madeItCount}
          rated={ratingsCount}
          level={level}
          points={pointsInLevel}
          pointsToNextLevel={POINTS_PER_LEVEL}
        />

        {items.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink-soft mb-4">
              Your kitchen is quiet. Let's fix that — find a swap and save it.
            </p>
            <Link href="/" className="btn-primary">Find a swap</Link>
          </div>
        ) : (
          <KitchenBrowser items={items} />
        )}
      </main>
    </>
  );
}
