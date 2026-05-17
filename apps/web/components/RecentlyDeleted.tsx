"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import {
  getRecentlyDeleted,
  removeRecentlyDeleted,
  type DeletedEntry,
} from "@/lib/recentlyDeleted";

export function RecentlyDeleted() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeletedEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      setItems(getRecentlyDeleted());
    }
    refresh();
    window.addEventListener("rfw:recently-deleted-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rfw:recently-deleted-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function restore(e: DeletedEntry) {
    const key = `${e.target_type}:${e.target_id}`;
    setBusyId(key);
    try {
      await apiPost("/api/kitchen", { [`${e.target_type}_id`]: e.target_id });
      removeRecentlyDeleted(e.target_type, e.target_id);
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Restore failed:", err);
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-pill bg-paper text-ink ring-1 ring-ink/10 px-4 py-2 text-sm font-semibold shadow-card hover:bg-honey/60 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        🗑 Recently deleted ({items.length})
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] card p-2 z-30 max-h-96 overflow-y-auto">
            <p className="text-xs text-ink-muted px-2 py-1.5">
              Removed in the last 24 hours. Tap to restore.
            </p>
            <ul className="divide-y divide-ink/5">
              {items.map((e) => {
                const key = `${e.target_type}:${e.target_id}`;
                const ago = formatAgo(e.deleted_at);
                return (
                  <li key={key} className="flex items-center gap-2 py-2 px-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate" title={e.title}>
                        {e.title}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {e.target_type} · {ago}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restore(e)}
                      disabled={busyId === key}
                      className="btn-secondary py-1 text-xs"
                    >
                      {busyId === key ? "Restoring…" : "↺ Restore"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleString();
}
