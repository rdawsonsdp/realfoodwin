import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminRecipesPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: recipes } = await admin
    .from("recipes")
    .select("id, title, meal_type, difficulty, time_min, tags, ingredients, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-paper/80 text-sm">
          Manage the canonical recipe library. New recipes are public to all users and feed into the Recommender / RAG.
        </p>
        <Link href="/admin/recipes/new" className="btn-primary py-2 px-4 text-sm">
          + Add recipe
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="text-left px-5 py-3">Title</th>
              <th className="text-left px-5 py-3">Meal</th>
              <th className="text-left px-5 py-3">Difficulty</th>
              <th className="text-right px-5 py-3">Time</th>
              <th className="text-right px-5 py-3">Ingredients</th>
              <th className="text-left px-5 py-3">Tags</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {(recipes ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-paper/50">
                <td className="px-5 py-3 font-semibold">{r.title}</td>
                <td className="px-5 py-3 text-ink-muted capitalize">{r.meal_type ?? "—"}</td>
                <td className="px-5 py-3 text-ink-muted capitalize">{r.difficulty ?? "—"}</td>
                <td className="px-5 py-3 text-right">{r.time_min ?? "—"}{r.time_min ? " min" : ""}</td>
                <td className="px-5 py-3 text-right text-ink-muted">
                  {Array.isArray(r.ingredients) ? r.ingredients.length : 0}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.tags ?? []).slice(0, 3).map((t: string) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded-pill bg-honey/40">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/recipes/${r.id}`}
                    className="btn-ghost py-1.5 px-3 text-xs"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(recipes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-ink-muted">
                  No recipes yet. Add the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
