import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { AdminRecipeForm } from "@/components/AdminRecipeForm";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: recipe } = await admin
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/recipes" className="btn-ghost-on-dark inline-flex">← Back to recipes</Link>
        <DeleteRecipeButton recipeId={id} title={recipe.title} />
      </div>
      <h2 className="text-2xl font-bold text-paper">Edit recipe</h2>
      <AdminRecipeForm
        mode="edit"
        initial={{
          id: recipe.id,
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          time_min: recipe.time_min,
          difficulty: recipe.difficulty,
          meal_type: recipe.meal_type,
          tags: recipe.tags ?? [],
        }}
      />
    </div>
  );
}
