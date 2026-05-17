import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Live activity feed — last 100 events across every user.
export default async function AdminActivityPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const [eventsRes, topQueriesRes] = await Promise.all([
    admin
      .from("events")
      .select("id, user_id, event_type, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("swaps")
      .select("swap_target, created_at")
      .not("user_id", "is", null)
      .not("swap_target", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const events = eventsRes.data ?? [];
  const userIds = Array.from(new Set(events.map((e) => e.user_id).filter(Boolean)));
  const { data: users } = await admin
    .from("users")
    .select("id, email, display_name")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const userMap = new Map<string, { email: string; display_name: string | null }>();
  for (const u of users ?? []) {
    userMap.set(u.id, { email: u.email, display_name: u.display_name });
  }

  // Top queries this week.
  const queryCounts = new Map<string, number>();
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const s of topQueriesRes.data ?? []) {
    if (!s.swap_target) continue;
    if (new Date(s.created_at).getTime() < oneWeekAgo) continue;
    queryCounts.set(s.swap_target, (queryCounts.get(s.swap_target) ?? 0) + 1);
  }
  const topQueries = Array.from(queryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <section>
        <h2 className="text-lg font-bold mb-3 text-paper">Live activity</h2>
        <div className="card divide-y divide-ink/5">
          {events.length === 0 ? (
            <div className="p-6 text-ink-muted text-sm">No events yet.</div>
          ) : (
            events.map((e) => {
              const u = e.user_id ? userMap.get(e.user_id) : null;
              const meta = (e.metadata as Record<string, unknown> | null) ?? {};
              const summary = (meta.summary as string | undefined) ?? null;
              const query = (meta.query as string | undefined) ?? null;
              const stars = (meta.stars as number | undefined) ?? null;
              const tone = eventTone(e.event_type);
              return (
                <div
                  key={e.id}
                  className="px-5 py-3 flex items-start gap-4 hover:bg-paper/60 transition-colors"
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-pill flex-shrink-0 ${tone}`}
                  >
                    {prettyEvent(e.event_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink">
                      <strong>{u?.display_name ?? u?.email ?? "anonymous"}</strong>
                      <span className="text-ink-muted">
                        {" — "}
                        {summary ??
                          (query ? `searched "${query}"` : `${e.target_type ?? "event"}`)}
                        {stars ? ` (${stars}/5)` : ""}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3 text-paper">Top queries (7d)</h2>
        <div className="card p-5">
          {topQueries.length === 0 ? (
            <p className="text-ink-muted text-sm">No swaps in the last 7 days.</p>
          ) : (
            <ol className="space-y-2">
              {topQueries.map(([q, n], i) => (
                <li key={q} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    <span className="text-ink-muted mr-2">{i + 1}.</span>
                    {q}
                  </span>
                  <span className="text-xs text-ink-muted">{n}×</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <p className="text-xs text-paper/60 mt-4 italic">
          Reload to refresh. Cron-based auto-refresh comes with Phase 2.
        </p>
      </section>
    </div>
  );
}

function eventTone(type: string): string {
  if (
    type === "made_it_loved" ||
    type === "rated_loved" ||
    type === "saved_to_kitchen"
  )
    return "bg-sage-soft text-ink";
  if (
    type === "made_it_not_for_me" ||
    type === "rated_meh" ||
    type === "dismissed_swap"
  )
    return "bg-coral-soft text-ink";
  if (type === "iterated_recipe") return "bg-honey text-ink";
  return "bg-cream text-ink-soft";
}

function prettyEvent(type: string): string {
  return type.replace(/_/g, " ");
}
