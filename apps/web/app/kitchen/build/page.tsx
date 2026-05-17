import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RecipeBuilder } from "@/components/RecipeBuilder";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BuildRecipePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/kitchen/build"));

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/kitchen" className="btn-ghost-on-dark mb-6 inline-flex">
          ← Back to My Kitchen
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-paper">
            Build a <span className="italic font-serif text-coral">Recipe</span>
          </h1>
          <p className="text-paper/80 mt-3 text-lg">
            Snap a dish, a recipe card, or your fridge — we'll turn it into a real-food recipe you can cook tonight.
          </p>
        </header>

        <RecipeBuilder />
      </main>
    </>
  );
}
