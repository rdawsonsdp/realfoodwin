"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule {
  id: string;
  scope: "global" | "profile";
  rule: string;
  active: boolean;
  priority: number;
  profile_filter: Record<string, unknown> | null;
  updated_at: string;
}

export function SystemRuleRow({ rule }: { rule: Rule }) {
  const router = useRouter();
  const [active, setActive] = useState(rule.active);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/admin/system-rules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: rule.id, active: !active }),
    });
    setActive(!active);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this rule?")) return;
    setBusy(true);
    await fetch(`/api/admin/system-rules?id=${rule.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <li className={`card p-4 flex items-start gap-4 ${active ? "" : "opacity-50"}`}>
      <button
        onClick={toggle}
        disabled={busy}
        className={`mt-1 w-10 h-6 rounded-pill relative transition-colors flex-shrink-0 ${
          active ? "bg-sunrise" : "bg-ink/15"
        }`}
        aria-label={active ? "Active — click to disable" : "Disabled — click to enable"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-pill transition-transform ${
            active ? "translate-x-4" : ""
          }`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-sunrise-700">
            {rule.scope}
          </span>
          <span className="text-xs text-ink-muted">priority {rule.priority}</span>
          {rule.profile_filter && (
            <code className="text-xs bg-cream px-1.5 py-0.5 rounded">
              {JSON.stringify(rule.profile_filter)}
            </code>
          )}
        </div>
        <p className="text-sm text-ink leading-relaxed">{rule.rule}</p>
      </div>

      <button
        onClick={remove}
        disabled={busy}
        className="btn-ghost py-1 px-2 text-xs text-coral hover:bg-coral-soft/30"
        aria-label="Delete rule"
      >
        Delete
      </button>
    </li>
  );
}
