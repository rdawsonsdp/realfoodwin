"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

const SONNET_OPTIONS = [
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-6",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
];

const HAIKU_OPTIONS = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-latest",
  "claude-3-5-haiku-20241022",
];

interface Props {
  initialSonnet: string;
  initialHaiku: string;
  sonnetUpdated: string | null;
  haikuUpdated: string | null;
}

export function ModelSelector({
  initialSonnet,
  initialHaiku,
  sonnetUpdated,
  haikuUpdated,
}: Props) {
  const router = useRouter();
  const [sonnet, setSonnet] = useState(initialSonnet);
  const [haiku, setHaiku] = useState(initialHaiku);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = sonnet !== initialSonnet || haiku !== initialHaiku;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/models", { sonnet, haiku });
      setSavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSavedAt(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-6 space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <ModelField
          label="Sonnet (user-facing)"
          tip="Used for Swap Generator, Recipe Iterator, Recipe Builder."
          value={sonnet}
          options={SONNET_OPTIONS}
          updated={sonnetUpdated}
          onChange={setSonnet}
        />
        <ModelField
          label="Haiku (background)"
          tip="Used for Quiz Summary, nightly user_summaries, Classifier, Recommender."
          value={haiku}
          options={HAIKU_OPTIONS}
          updated={haikuUpdated}
          onChange={setHaiku}
        />
      </div>

      <div className="flex items-center justify-between border-t border-ink/5 pt-4">
        {savedAt ? (
          <span className="text-sm text-sage font-semibold">
            ✓ Saved — gateway picks up within 60s
          </span>
        ) : error ? (
          <span className="text-sm text-coral">{error}</span>
        ) : (
          <span className="text-sm text-ink-muted italic">
            {dirty ? "Unsaved changes" : "All set"}
          </span>
        )}
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="btn-primary py-2 px-4 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save model overrides"}
        </button>
      </div>
    </section>
  );
}

function ModelField({
  label,
  tip,
  value,
  options,
  updated,
  onChange,
}: {
  label: string;
  tip: string;
  value: string;
  options: string[];
  updated: string | null;
  onChange: (v: string) => void;
}) {
  const inList = options.includes(value);
  return (
    <div>
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink-muted font-semibold">
          {label}
        </span>
        <p className="text-xs text-ink-muted mt-0.5 mb-2">{tip}</p>
        <select
          value={inList ? value : "__custom__"}
          onChange={(e) => {
            if (e.target.value === "__custom__") return;
            onChange(e.target.value);
          }}
          className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise font-mono text-sm"
        >
          {options.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          {!inList && <option value="__custom__">— custom (below) —</option>}
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste a custom model ID"
          className="w-full mt-2 p-2.5 rounded-soft bg-white border border-ink/10 outline-none focus:border-sunrise font-mono text-xs"
        />
      </label>
      {updated && (
        <p className="text-xs text-ink-muted mt-2">
          Last changed {new Date(updated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
