import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { SwapReviewForm } from "@/components/SwapReviewForm";

export const dynamic = "force-dynamic";

interface SwapOutput {
  title?: string;
  tagline?: string;
  narrative?: string;
  tuned_for_you_reasons?: string[];
  recipe?: {
    ingredients?: Array<{ name: string; quantity?: string; unit?: string } | string>;
    time_min?: number;
    difficulty?: string;
  };
}

interface ReviewQueueParams {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ filter?: "unreviewed" | "all" }>;
}

export default async function ReviewQueuePage({ params, searchParams }: ReviewQueueParams) {
  const { userId } = await params;
  const { filter = "unreviewed" } = await searchParams;

  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: user } = await admin
    .from("users")
    .select("id, email, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (!user) notFound();

  const { data: swaps } = await admin
    .from("swaps")
    .select("id, swap_target, output, narrative, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  const swapList = swaps ?? [];
  const swapIds = swapList.map((s) => s.id);

  const { data: reviewsRaw } = swapIds.length
    ? await admin
        .from("admin_swap_reviews")
        .select("swap_id, stars, note")
        .in("swap_id", swapIds)
    : { data: [] };
  const reviewMap = new Map<string, { stars: number; note: string | null }>();
  for (const r of reviewsRaw ?? []) {
    reviewMap.set(r.swap_id, { stars: r.stars, note: r.note });
  }

  const filtered = filter === "unreviewed"
    ? swapList.filter((s) => !reviewMap.has(s.id))
    : swapList;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin/review" className="btn-ghost mb-2">← Back</Link>
          <h2 className="text-2xl font-bold">{user.display_name ?? user.email}</h2>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="flex gap-1">
          <FilterTab href={`/admin/review/${userId}?filter=unreviewed`} active={filter === "unreviewed"}>
            Unreviewed ({swapList.filter((s) => !reviewMap.has(s.id)).length})
          </FilterTab>
          <FilterTab href={`/admin/review/${userId}?filter=all`} active={filter === "all"}>
            All ({swapList.length})
          </FilterTab>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted">
          {filter === "unreviewed"
            ? "No unreviewed swaps. Switch to All to update existing reviews."
            : "No swaps yet for this user."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => {
            const out = (s.output ?? null) as SwapOutput | null;
            const existing = reviewMap.get(s.id);
            return (
              <article key={s.id} className="card overflow-hidden">
                <header className="px-5 py-4 bg-paper/50 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                      {new Date(s.created_at).toLocaleString()} · {s.swap_target ?? "—"}
                    </p>
                    <h3 className="font-bold text-lg">
                      {out?.title ?? "(no title)"}
                    </h3>
                  </div>
                  {existing && (
                    <span className="text-xs px-2 py-1 rounded-pill bg-honey/40 font-semibold">
                      Already rated {existing.stars}/5
                    </span>
                  )}
                </header>

                <div className="px-5 py-4 grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-sunrise-700 mb-2">
                      What Sonnet said
                    </h4>
                    {out?.narrative && (
                      <p className="text-sm text-ink-soft mb-3">{out.narrative}</p>
                    )}
                    {out?.tuned_for_you_reasons && out.tuned_for_you_reasons.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {out.tuned_for_you_reasons.map((r, i) => (
                          <li key={i} className="text-ink-soft">
                            <span className="text-sunrise mr-1">▸</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-ink-muted mt-3">
                      {out?.recipe?.time_min ? `${out.recipe.time_min} min · ` : ""}
                      {out?.recipe?.difficulty ?? ""}
                      {Array.isArray(out?.recipe?.ingredients)
                        ? ` · ${out.recipe.ingredients.length} ingredients`
                        : ""}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-sunrise-700 mb-2">
                      Your review
                    </h4>
                    <SwapReviewForm
                      swapId={s.id}
                      initialStars={existing?.stars ?? null}
                      initialNote={existing?.note ?? null}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
        active
          ? "bg-sunrise text-white"
          : "bg-white ring-1 ring-ink/10 text-ink-soft hover:ring-sunrise/30"
      }`}
    >
      {children}
    </Link>
  );
}
