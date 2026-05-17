"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";

interface ModelRow {
  id: string;
  display_name: string | null;
  created_at: string | null;
}

interface ProbeData {
  fingerprint: string;
  count: number;
  helicone_configured?: boolean;
  models: ModelRow[];
}

type Tier = "sonnet" | "haiku";
type TestStatus = "ok" | "fail";
interface TestResult {
  status: TestStatus;
  message: string;
  latency_ms?: number;
  http_status?: number | null;
  helicone?: boolean;
}

export function AnthropicModelProbe() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProbeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<{ id: string; tier: Tier } | null>(null);
  const [savedRow, setSavedRow] = useState<{ id: string; tier: Tier } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

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

  async function testCall(modelId: string) {
    setTesting(modelId);
    try {
      const d = await apiPost<{ latency_ms: number; helicone: boolean }>("/api/admin/model-test-call", { model: modelId });
      setTests((t) => ({
        ...t,
        [modelId]: {
          status: "ok",
          message: `ok in ${d.latency_ms}ms${d.helicone ? " (via Helicone)" : ""}`,
          latency_ms: d.latency_ms,
          helicone: d.helicone,
        },
      }));
    } catch (err) {
      const anyErr = err as { message?: string; details?: { status?: number | null; helicone?: boolean } };
      setTests((t) => ({
        ...t,
        [modelId]: {
          status: "fail",
          message: anyErr?.message ?? String(err),
          http_status: anyErr?.details?.status ?? null,
          helicone: anyErr?.details?.helicone,
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  async function setTier(modelId: string, tier: Tier) {
    setBusyRow({ id: modelId, tier });
    setSavedRow(null);
    setError(null);
    try {
      await apiPost("/api/admin/models", { [tier]: modelId });
      setSavedRow({ id: modelId, tier });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyRow(null);
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
          {data.helicone_configured && (
            <p className="text-xs text-coral font-mono">
              ⚠ HELICONE_API_KEY is set — messages.create routes through
              anthropic.helicone.ai. The /v1/models listing above goes direct
              to Anthropic. If Test call returns 404 but listing succeeds,
              remove HELICONE_API_KEY (or fix the Helicone routing) and
              redeploy.
            </p>
          )}
          <ul className="divide-y divide-ink/10 border border-ink/10 rounded-soft overflow-hidden">
            {data.models.map((m) => {
              const justSavedSonnet = savedRow?.id === m.id && savedRow.tier === "sonnet";
              const justSavedHaiku = savedRow?.id === m.id && savedRow.tier === "haiku";
              const busy = busyRow?.id === m.id;
              const test = tests[m.id];
              return (
                <li key={m.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <code className="font-mono">{m.id}</code>
                      {m.display_name && (
                        <span className="text-ink-muted ml-2">{m.display_name}</span>
                      )}
                      {m.created_at && (
                        <span className="text-xs text-ink-muted ml-2">· {m.created_at.slice(0, 10)}</span>
                      )}
                    </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => testCall(m.id)}
                      disabled={testing === m.id}
                      className="btn-ghost text-xs px-2 py-1 border border-ink/10 rounded-pill disabled:opacity-50"
                      title="Issue a tiny live messages.create against this model"
                    >
                      {testing === m.id
                        ? "Testing…"
                        : tests[m.id]?.status === "ok"
                        ? "✓ Test OK"
                        : tests[m.id]?.status === "fail"
                        ? "✗ Test fail"
                        : "Test call"}
                    </button>
                    <button
                      onClick={() => setTier(m.id, "sonnet")}
                      disabled={busy}
                      className="btn-ghost text-xs px-2 py-1 border border-ink/10 rounded-pill disabled:opacity-50"
                      title="Use as the Sonnet tier (user-facing)"
                    >
                      {busyRow?.id === m.id && busyRow.tier === "sonnet"
                        ? "Saving…"
                        : justSavedSonnet
                        ? "✓ Sonnet"
                        : "Set as Sonnet"}
                    </button>
                    <button
                      onClick={() => setTier(m.id, "haiku")}
                      disabled={busy}
                      className="btn-ghost text-xs px-2 py-1 border border-ink/10 rounded-pill disabled:opacity-50"
                      title="Use as the Haiku tier (background)"
                    >
                      {busyRow?.id === m.id && busyRow.tier === "haiku"
                        ? "Saving…"
                        : justSavedHaiku
                        ? "✓ Haiku"
                        : "Set as Haiku"}
                    </button>
                  </div>
                  </div>
                  {test && (
                    <p
                      className={
                        "mt-1 text-xs font-mono " +
                        (test.status === "ok" ? "text-sage" : "text-coral")
                      }
                    >
                      {test.status === "ok" ? "✓ " : "✗ "}
                      {test.message}
                      {test.http_status ? ` · HTTP ${test.http_status}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-muted italic">
            Saves write straight to app_settings — the gateway picks them up within 60 seconds.
          </p>
        </div>
      )}
    </section>
  );
}
