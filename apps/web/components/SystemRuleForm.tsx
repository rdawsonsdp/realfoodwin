"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

const PROFILE_PRESETS: { label: string; filter: Record<string, unknown> }[] = [
  { label: "Family with kids", filter: { household_composition: "family-with-kids" } },
  { label: "Beginner cook", filter: { skill_level: "beginner" } },
  { label: "Vegan", filter: { dietary_pattern: ["vegan"] } },
  { label: "Gluten-free", filter: { dietary_pattern: ["gluten-free"] } },
  { label: "Tree-nut allergy", filter: { allergies: ["tree-nuts"] } },
  { label: "Weight-loss goal", filter: { top_goal: "lose-weight" } },
];

export function SystemRuleForm() {
  const router = useRouter();
  const [rule, setRule] = useState("");
  const [scope, setScope] = useState<"global" | "profile">("global");
  const [filter, setFilter] = useState<Record<string, unknown> | null>(null);
  const [priority, setPriority] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (rule.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/system-rules", {
        scope,
        rule: rule.trim(),
        priority,
        profile_filter: scope === "profile" ? filter ?? {} : undefined,
      });
      setRule("");
      setFilter(null);
      setScope("global");
      setPriority(50);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-bold">Add a system rule</h3>
      <textarea
        value={rule}
        onChange={(e) => setRule(e.target.value)}
        placeholder="e.g., Never suggest more than 6 ingredients for beginner skill. / Avoid sesame for users with sesame allergy. / Default to 30-min weeknight time when not specified."
        rows={3}
        className="w-full p-3 text-sm rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">Scope:</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "global" | "profile")}
          className="px-3 py-1.5 rounded-soft border border-ink/10 bg-white text-sm"
        >
          <option value="global">Global (all users)</option>
          <option value="profile">Profile-matched</option>
        </select>

        <label className="text-sm font-semibold ml-3">Priority:</label>
        <input
          type="number"
          min={1}
          max={100}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-16 px-2 py-1.5 rounded-soft border border-ink/10 bg-white text-sm"
        />
      </div>

      {scope === "profile" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {PROFILE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setFilter(p.filter)}
                className={`chip ${JSON.stringify(filter) === JSON.stringify(p.filter) ? "bg-sunrise/20 ring-sunrise/40" : ""}`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilter(null)}
              className="chip"
            >
              Clear
            </button>
          </div>
          {filter && (
            <pre className="text-xs bg-paper p-2 rounded-soft border border-ink/10 overflow-x-auto">
              {JSON.stringify(filter, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        {error && <p className="text-sm text-coral">{error}</p>}
        <span />
        <button
          onClick={save}
          disabled={saving || rule.trim().length < 3}
          className="btn-primary py-2 px-4"
        >
          {saving ? "Saving…" : "Add rule"}
        </button>
      </div>
    </div>
  );
}
