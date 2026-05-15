"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

interface Props {
  display: string;
  email: string;
  blurb: string;
  stats: { user_id: string | null; swaps: number; saves: number; madeIt: number };
}

export function PersonaCard({ display, email, blurb, stats }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function impersonate() {
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/admin/impersonate", { email });
      router.push("/kitchen");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const isSeeded = !!stats.user_id && stats.swaps > 0;

  return (
    <article className="card p-6">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-bold text-lg">{display}</h3>
          <p className="text-xs text-ink-muted">{email}</p>
        </div>
        {isSeeded ? (
          <span className="text-xs px-2 py-1 rounded-pill bg-sage-soft text-ink font-semibold">
            seeded
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-pill bg-honey/40 text-ink-muted">
            empty
          </span>
        )}
      </header>
      <p className="text-sm text-ink-soft mb-4">{blurb}</p>

      <div className="grid grid-cols-3 gap-2 text-center text-sm mb-5">
        <div className="p-2 rounded-soft bg-paper">
          <div className="text-xl font-bold">{stats.swaps}</div>
          <div className="text-xs text-ink-muted">Swaps</div>
        </div>
        <div className="p-2 rounded-soft bg-paper">
          <div className="text-xl font-bold">{stats.saves}</div>
          <div className="text-xs text-ink-muted">Saved</div>
        </div>
        <div className="p-2 rounded-soft bg-paper">
          <div className="text-xl font-bold">{stats.madeIt}</div>
          <div className="text-xs text-ink-muted">Made it</div>
        </div>
      </div>

      <button
        onClick={impersonate}
        disabled={loading || !stats.user_id}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "Signing in…" : !stats.user_id ? "Not yet seeded" : `Sign in as ${display.split(" ")[0]}`}
      </button>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </article>
  );
}
