"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

interface ModelRow {
  id: string;
  display_name: string | null;
  created_at: string | null;
}

interface ProbeData {
  fingerprint: string;
  count: number;
  models: ModelRow[];
}

export function AnthropicModelProbe() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProbeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function probe() {
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<ProbeData>("/api/admin/anthropic-models");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card p-5 space-y-3">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold">Live probe — what does this deployment's key see?</h3>
          <p className="text-sm text-ink-soft">Calls Anthropic /v1/models with the ANTHROPIC_API_KEY on this server.</p>
        </div>
        <button onClick={probe} disabled={loading} className="btn-secondary">
          {loading ? "Probing…" : data ? "Refresh" : "Run probe"}
        </button>
      </header>

      {error && <p className="text-sm text-coral">{error}</p>}

      {data && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted font-mono">
            key: {data.fingerprint} · {data.count} models accessible
          </p>
          <ul className="divide-y divide-ink/10 border border-ink/10 rounded-soft overflow-hidden">
            {data.models.map((m) => (
              <li key={m.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <code className="font-mono">{m.id}</code>
                  {m.display_name && <span className="text-ink-muted ml-2">{m.display_name}</span>}
                </div>
                {m.created_at && <span className="text-xs text-ink-muted">{m.created_at.slice(0, 10)}</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted italic">
            Copy any ID above and paste it into the Sonnet/Haiku field, then save.
          </p>
        </div>
      )}
    </section>
  );
}
