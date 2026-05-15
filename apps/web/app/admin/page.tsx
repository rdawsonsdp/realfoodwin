import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Admin overview — top-line metrics across the whole system.
export default async function AdminOverviewPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const [users, swaps, saves, madeIt, ratings, agentCalls, costSum] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("swaps").select("id", { count: "exact", head: true }).not("user_id", "is", null),
    admin.from("recipe_box_entries").select("id", { count: "exact", head: true }),
    admin.from("events").select("id", { count: "exact", head: true }).eq("event_type", "made_it_loved"),
    admin.from("recipe_ratings").select("id", { count: "exact", head: true }),
    admin.from("agent_calls").select("id", { count: "exact", head: true }),
    admin.from("agent_calls").select("cost_usd"),
  ]);

  const totalCost = (costSum.data ?? []).reduce(
    (acc, r) => acc + Number(r.cost_usd ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <section className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Stat label="Users" value={users.count ?? 0} icon="👤" />
        <Stat label="Total Swaps" value={swaps.count ?? 0} icon="🍳" />
        <Stat label="Saves" value={saves.count ?? 0} icon="📖" />
        <Stat label="Made it ❤️" value={madeIt.count ?? 0} icon="🏆" />
        <Stat label="Ratings" value={ratings.count ?? 0} icon="⭐" />
        <Stat label="Agent calls" value={agentCalls.count ?? 0} icon="🤖" />
        <Stat label="LLM spend" value={`$${totalCost.toFixed(2)}`} icon="💸" />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold mb-3">Jump to</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/personas" className="btn-secondary py-2">Personas</Link>
          <Link href="/admin/activity" className="btn-secondary py-2">Live activity</Link>
          <Link href="/admin/llm" className="btn-secondary py-2">LLM spend & latency</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-ink">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-muted mt-1">{label}</div>
    </div>
  );
}
