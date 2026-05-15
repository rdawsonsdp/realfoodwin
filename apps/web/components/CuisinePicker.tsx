"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { CUISINES } from "@/lib/cuisines";

interface Props {
  initial: string[];
}

export function CuisinePicker({ initial }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggle(value: string) {
    setSelected((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value],
    );
  }

  async function save() {
    setSaving(true);
    try {
      await apiPost("/api/profile/cuisine", { cuisine_affinity: selected });
      setSavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(selected.sort()) !== JSON.stringify([...initial].sort());

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Pick the cuisines you like — the AI uses these to suggest more interesting swaps. Pick a few, or all of them.
      </p>
      <div className="flex flex-wrap gap-2">
        {CUISINES.map((c) => {
          const on = selected.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggle(c.value)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-pill ring-1 transition-all ${
                on
                  ? "bg-sunrise text-white ring-sunrise shadow-warm"
                  : `${c.tone} ring-ink/10 text-ink hover:ring-sunrise/40`
              }`}
            >
              <span>{c.emoji}</span>
              <span className="text-sm font-semibold">{c.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          {selected.length === 0
            ? "No cuisines selected — pick a few"
            : `${selected.length} selected`}
        </span>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-sm text-sage font-semibold">Saved ✓</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary py-2 px-4 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save tastes"}
          </button>
        </div>
      </div>
    </div>
  );
}
