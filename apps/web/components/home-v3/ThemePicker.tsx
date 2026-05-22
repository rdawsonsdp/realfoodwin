"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HOME_THEMES } from "@/lib/home-themes";

interface Props {
  currentThemeId: string;
}

export function ThemePicker({ currentThemeId }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentThemeId);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(id: string) {
    if (id === selected) return;
    setSaving(id);
    setErr(null);
    try {
      const res = await fetch("/api/profile/ui", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Save failed (${res.status})`);
      }
      setSelected(id);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-[0.16em] font-bold text-ink/70">
          Background
        </p>
        {err && <span className="text-xs text-coral truncate max-w-[18ch]">{err}</span>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {HOME_THEMES.map((t) => {
          const isActive = t.id === selected;
          const isBusy = saving === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => void pick(t.id)}
              disabled={!!saving}
              title={`${t.name} — ${t.description}`}
              aria-label={`${t.name} — ${t.description}`}
              aria-pressed={isActive}
              className={`relative rounded-soft overflow-hidden ring-2 transition active:scale-[0.98] disabled:cursor-not-allowed ${
                isActive
                  ? "ring-coral shadow-card"
                  : "ring-ink/15 hover:ring-ink/40"
              }`}
            >
              <span
                className="block w-full h-16"
                style={{ background: t.swatch }}
                aria-hidden
              />
              <span className="block text-[11px] font-semibold py-1 px-2 bg-paper text-ink truncate">
                {isBusy ? "Saving…" : t.name}
              </span>
              {isActive && (
                <span
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-coral text-white text-[11px] font-bold flex items-center justify-center"
                  aria-hidden
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
