import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface AggRow {
  date: string; // YYYY-MM-DD (local date the call was made)
  agent_name: string;
  model: string;
  count: number;
  totalCost: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

function localDay(ts: string): string {
  // ISO timestamp → YYYY-MM-DD in the viewer's locale (server-rendered, so
  // this resolves to America/Los_Angeles for the demo deployment).
  return new Date(ts).toLocaleDateString("en-CA");
}

export default async function AdminLlmPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: calls } = await admin
    .from("agent_calls")
    .select("agent_name, model, cost_usd, latency_ms, input_tokens, output_tokens, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = calls ?? [];
  const byDateAgent = new Map<string, AggRow>();
  let totalCost = 0;
  let errors = 0;

  for (const c of rows) {
    const d = localDay(c.created_at);
    const k = `${d}|${c.agent_name}|${c.model}`;
    const r = byDateAgent.get(k) ?? {
      date: d,
      agent_name: c.agent_name,
      model: c.model,
      count: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
    r.count += 1;
    r.totalCost += Number(c.cost_usd ?? 0);
    r.avgLatencyMs += c.latency_ms ?? 0;
    r.totalInputTokens += c.input_tokens ?? 0;
    r.totalOutputTokens += c.output_tokens ?? 0;
    byDateAgent.set(k, r);
    totalCost += Number(c.cost_usd ?? 0);
    if (c.status === "error") errors += 1;
  }
  for (const r of byDateAgent.values()) r.avgLatencyMs = Math.round(r.avgLatencyMs / r.count);

  // Sort: newest date first, then agent name A→Z, then model A→Z within the
  // same agent so duplicate models in a row stay grouped.
  const agentRows = Array.from(byDateAgent.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.agent_name !== b.agent_name) return a.agent_name.localeCompare(b.agent_name);
    return a.model.localeCompare(b.model);
  });

  return (
    <div className="space-y-6">
      <section className="grid md:grid-cols-4 gap-4">
        <Stat label="Total calls" value={rows.length} icon="🤖" />
        <Stat label="Total spend" value={`$${totalCost.toFixed(2)}`} icon="💸" />
        <Stat label="Errors" value={errors} icon="⚠️" />
        <Stat
          label="Avg cost/call"
          value={rows.length > 0 ? `$${(totalCost / rows.length).toFixed(4)}` : "$0"}
          icon="📊"
        />
      </section>

      <section className="card overflow-hidden">
        <h2 className="text-lg font-bold p-5 pb-3">Spend by date &amp; agent</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-paper text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-5 py-3">Agent</th>
              <th className="text-left px-5 py-3">Model</th>
              <th className="text-right px-5 py-3">Calls</th>
              <th className="text-right px-5 py-3">Spend</th>
              <th className="text-right px-5 py-3">Avg latency</th>
              <th className="text-right px-5 py-3">In tokens</th>
              <th className="text-right px-5 py-3">Out tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {agentRows.map((r, idx) => {
              const isNewDate = idx === 0 || agentRows[idx - 1]!.date !== r.date;
              return (
                <tr key={`${r.date}|${r.agent_name}|${r.model}`} className="hover:bg-paper/50">
                  <td className="px-5 py-3 text-ink-muted whitespace-nowrap">
                    {isNewDate ? r.date : ""}
                  </td>
                  <td className="px-5 py-3 font-semibold">{r.agent_name}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.model}</td>
                  <td className="px-5 py-3 text-right">{r.count}</td>
                  <td className="px-5 py-3 text-right font-bold">
                    ${r.totalCost.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-muted">
                    {r.avgLatencyMs.toLocaleString()} ms
                  </td>
                  <td className="px-5 py-3 text-right text-ink-muted">
                    {r.totalInputTokens.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-muted">
                    {r.totalOutputTokens.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {agentRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-ink-muted">
                  No agent calls logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-muted mt-1">{label}</div>
    </div>
  );
}
