import Link from "next/link";
import { AdminRecipeForm } from "@/components/AdminRecipeForm";

export default function NewRecipePage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/recipes" className="btn-ghost">← Back to recipes</Link>
      <h2 className="text-2xl font-bold">Add a recipe</h2>
      <AdminRecipeForm mode="create" />
    </div>
  );
}
