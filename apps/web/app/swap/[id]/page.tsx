import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Nav } from "@/components/Nav";
import { SwapResultCard, type SwapResult } from "@/components/SwapResultCard";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SwapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseServer();

  // Read with the service-role client so users (and impersonated personas) can
  // still open swaps from their Kitchen even if RLS would block the row. UUIDs
  // are unguessable — acceptable for the prototype.
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const [{ data: { user } }, { data: swap }] = await Promise.all([
    supabase.auth.getUser(),
    admin.from("swaps").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!swap) return notFound();

  type SwapOutput = NonNullable<SwapResult["output"]>;
  const storedOutput = swap.output as SwapOutput | null;

  const recipeJson = swap.recipe as Partial<SwapOutput["recipe"]> & {
    title?: string;
  } | null;
  const output: SwapOutput =
    storedOutput ??
    {
      title: recipeJson?.title ?? "Saved swap",
      recipe: {
        ingredients: recipeJson?.ingredients ?? [],
        steps: recipeJson?.steps ?? [],
        time_min: recipeJson?.time_min ?? 0,
        difficulty: recipeJson?.difficulty,
        meal_type: recipeJson?.meal_type,
      },
      nutrition: (swap.nutrition as SwapOutput["nutrition"]) ?? {},
      narrative: swap.narrative ?? "",
      tuned_for_you_reasons: [],
    };

  const result: SwapResult = {
    query: swap.swap_target ?? output.title,
    output,
    latencyMs: null,
    cached: true,
    swapId: swap.id,
  };

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/kitchen" className="btn-ghost mb-6 print:hidden">
          ← Kitchen
        </Link>
        <SwapResultCard result={result} isLoggedIn={!!user} />
      </main>
    </>
  );
}
