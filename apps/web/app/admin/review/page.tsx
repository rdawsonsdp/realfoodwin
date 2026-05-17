import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Index — per-user review counts so the reviewer can pick where to dig in.
export default async function ReviewIndexPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: users } = await admin
    .from("users")
    .select("id, email, display_name");

  const rows = await Promise.all(
    (users ?? []).map(async (u) => {
      const [{ count: totalSwaps }, reviewsRes] = await Promise.all([
        admin
          .from("swaps")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id),
        admin
          .from("admin_swap_reviews")
          .select("stars")
          .eq("target_user_id", u.id),
      ]);
      const reviewed = reviewsRes.data?.length ?? 0;
      const avgStars = reviewed
        ? reviewsRes.data!.reduce((a, r) => a + r.stars, 0) / reviewed
        : null;
      return {
        ...u,
        totalSwaps: totalSwaps ?? 0,
        reviewed,
        unreviewed: (totalSwaps ?? 0) - reviewed,
        avgStars,
      };
    }),
  );

  rows.sort((a, b) => b.totalSwaps - a.totalSwaps);

  return (
    <div className="space-y-4">
      <p className="text-paper/80 text-sm">
        Rate each user's AI output. Your stars + notes feed into that user's next prompt as expert-reviewer guidance, helping the model converge on what works for them.
      </p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="text-left px-5 py-3">User</th>
              <th className="text-right px-5 py-3">Swaps</th>
              <th className="text-right px-5 py-3">Reviewed</th>
              <th className="text-right px-5 py-3">Avg ⭐</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-paper/50">
                <td className="px-5 py-3">
                  <div className="font-semibold">{r.display_name ?? r.email}</div>
                  <div className="text-xs text-ink-muted">{r.email}</div>
                </td>
                <td className="px-5 py-3 text-right">{r.totalSwaps}</td>
                <td className="px-5 py-3 text-right">
                  {r.reviewed}{" "}
                  <span className="text-ink-muted text-xs">
                    ({r.unreviewed} unreviewed)
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {r.avgStars !== null ? (
                    <strong>{r.avgStars.toFixed(1)}</strong>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/review/${r.id}`}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
