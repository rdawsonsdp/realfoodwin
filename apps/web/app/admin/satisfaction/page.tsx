import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Per-user satisfaction dashboard. Composite score:
//   40% loved-it ratio (made_it_loved / (made_it_loved + made_it_not_for_me))
//   30% avg rating (normalized to 0-1)
//   20% made-it rate (made_it / saves)
//   10% save rate (saves / swaps)
//
// All components in [0..1], score scaled 0-100. Missing components are skipped
// and weights renormalized.

interface UserMetrics {
  user_id: string;
  email: string;
  display_name: string | null;
  swaps: number;
  saves: number;
  madeItLoved: number;
  madeItNotForMe: number;
  ratings: number;
  avgRating: number | null;
  saveRate: number | null;
  madeItRate: number | null;
  lovedRatio: number | null;
  satisfactionScore: number | null;
}

export default async function AdminSatisfactionPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: users } = await admin
    .from("users")
    .select("id, email, display_name");

  const metrics: UserMetrics[] = await Promise.all(
    (users ?? []).map(async (u) => {
      const [swapsRes, savesRes, lovedRes, notForMeRes, ratingsRes] = await Promise.all([
        admin.from("swaps").select("id", { count: "exact", head: true }).eq("user_id", u.id),
        admin.from("recipe_box_entries").select("id", { count: "exact", head: true }).eq("user_id", u.id),
        admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("event_type", "made_it_loved"),
        admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("event_type", "made_it_not_for_me"),
        admin.from("recipe_ratings").select("stars").eq("user_id", u.id),
      ]);

      const swaps = swapsRes.count ?? 0;
      const saves = savesRes.count ?? 0;
      const madeItLoved = lovedRes.count ?? 0;
      const madeItNotForMe = notForMeRes.count ?? 0;
      const ratings = (ratingsRes.data ?? []).length;
      const avgRating =
        ratings > 0
          ? (ratingsRes.data ?? []).reduce((a, r) => a + (r.stars ?? 0), 0) / ratings
          : null;
      const saveRate = swaps > 0 ? saves / swaps : null;
      const madeItRate = saves > 0 ? (madeItLoved + madeItNotForMe) / saves : null;
      const lovedRatio =
        madeItLoved + madeItNotForMe > 0
          ? madeItLoved / (madeItLoved + madeItNotForMe)
          : null;

      // Composite — only include components that have data.
      const components: { val: number; weight: number }[] = [];
      if (lovedRatio !== null) components.push({ val: lovedRatio, weight: 0.4 });
      if (avgRating !== null) components.push({ val: avgRating / 5, weight: 0.3 });
      if (madeItRate !== null) components.push({ val: madeItRate, weight: 0.2 });
      if (saveRate !== null) components.push({ val: saveRate, weight: 0.1 });

      let satisfactionScore: number | null = null;
      if (components.length > 0) {
        const totalWeight = components.reduce((a, c) => a + c.weight, 0);
        const weighted = components.reduce((a, c) => a + c.val * c.weight, 0);
        satisfactionScore = Math.round((weighted / totalWeight) * 100);
      }

      return {
        user_id: u.id,
        email: u.email,
        display_name: u.display_name,
        swaps,
        saves,
        madeItLoved,
        madeItNotForMe,
        ratings,
        avgRating,
        saveRate,
        madeItRate,
        lovedRatio,
        satisfactionScore,
      };
    }),
  );

  metrics.sort((a, b) => (b.satisfactionScore ?? -1) - (a.satisfactionScore ?? -1));

  const overall = computeOverall(metrics);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-sunrise via-sunrise-600 to-coral text-white">
          <p className="text-xs uppercase tracking-[0.2em] opacity-80 mb-2">System satisfaction</p>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-extrabold leading-none">
              {overall.score !== null ? `${overall.score}` : "—"}
            </div>
            <div className="opacity-90 text-sm pb-1">/100 weighted across {metrics.length} users</div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-ink/5">
          <Slice label="Loved" sub="of made-it" pct={overall.loved} />
          <Slice label="Avg rating" sub="across users" pct={overall.avgRating} suffix="/5" raw />
          <Slice label="Made-it rate" sub="of saves" pct={overall.madeIt} />
          <Slice label="Save rate" sub="of swaps" pct={overall.save} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="text-lg font-bold p-5 pb-3">Per-user satisfaction</h2>
        <table className="w-full text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="text-left px-5 py-3">User</th>
              <th className="text-right px-5 py-3">Score</th>
              <th className="text-right px-5 py-3">Swaps</th>
              <th className="text-right px-5 py-3">Save rate</th>
              <th className="text-right px-5 py-3">Made-it</th>
              <th className="text-right px-5 py-3">Loved %</th>
              <th className="text-right px-5 py-3">Avg ⭐</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {metrics.map((m) => (
              <tr key={m.user_id} className="hover:bg-paper/50">
                <td className="px-5 py-3">
                  <div className="font-semibold">{m.display_name ?? m.email}</div>
                  <div className="text-xs text-ink-muted">{m.email}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  <ScoreBadge score={m.satisfactionScore} />
                </td>
                <td className="px-5 py-3 text-right">{m.swaps}</td>
                <td className="px-5 py-3 text-right">{fmtPct(m.saveRate)}</td>
                <td className="px-5 py-3 text-right">
                  {m.madeItLoved}
                  {m.madeItNotForMe > 0 && (
                    <span className="text-coral text-xs ml-1">/{m.madeItNotForMe}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">{fmtPct(m.lovedRatio)}</td>
                <td className="px-5 py-3 text-right">
                  {m.avgRating !== null ? (
                    <span>
                      <strong>{m.avgRating.toFixed(1)}</strong>
                      <span className="text-ink-muted text-xs"> ({m.ratings})</span>
                    </span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-paper/60 italic">
        Score formula: 40% loved-it ratio · 30% avg rating · 20% made-it rate · 10% save rate. Missing components are skipped and weights renormalized.
      </p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-ink-muted">—</span>;
  const tone =
    score >= 75 ? "bg-sage text-white" : score >= 50 ? "bg-honey text-ink" : "bg-coral text-white";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-pill text-xs font-bold ${tone}`}>
      {score}
    </span>
  );
}

function Slice({
  label,
  sub,
  pct,
  suffix,
  raw,
}: {
  label: string;
  sub: string;
  pct: number | null;
  suffix?: string;
  raw?: boolean;
}) {
  return (
    <div className="p-4 text-center">
      <div className="text-xl font-bold">
        {pct === null ? "—" : raw ? `${pct.toFixed(1)}${suffix ?? ""}` : fmtPct(pct)}
      </div>
      <div className="text-xs uppercase tracking-wider text-ink-muted mt-1">{label}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

function computeOverall(metrics: UserMetrics[]) {
  const valid = metrics.filter((m) => m.satisfactionScore !== null);
  if (valid.length === 0) {
    return { score: null, loved: null, madeIt: null, save: null, avgRating: null };
  }
  const sum = (k: keyof UserMetrics) =>
    metrics.reduce((a, m) => a + (typeof m[k] === "number" ? (m[k] as number) : 0), 0);
  const totalLoved = sum("madeItLoved");
  const totalNotFor = sum("madeItNotForMe");
  const totalSaves = sum("saves");
  const totalSwaps = sum("swaps");
  const totalRatings = metrics.reduce((a, m) => a + m.ratings, 0);
  const weightedRating =
    totalRatings > 0
      ? metrics.reduce((a, m) => a + (m.avgRating ?? 0) * m.ratings, 0) / totalRatings
      : null;
  return {
    score: Math.round(
      valid.reduce((a, m) => a + (m.satisfactionScore ?? 0), 0) / valid.length,
    ),
    loved: totalLoved + totalNotFor > 0 ? totalLoved / (totalLoved + totalNotFor) : null,
    madeIt: totalSaves > 0 ? (totalLoved + totalNotFor) / totalSaves : null,
    save: totalSwaps > 0 ? totalSaves / totalSwaps : null,
    avgRating: weightedRating,
  };
}
