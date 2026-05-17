"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";

const DIETARY = [
  { value: "none", label: "None — I eat everything" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "dairy-free", label: "Dairy-free" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "paleo", label: "Paleo" },
  { value: "keto", label: "Keto" },
  { value: "low-sugar", label: "Low-sugar" },
];

const ALLERGIES = [
  { value: "peanut", label: "Peanut" },
  { value: "tree-nuts", label: "Tree nuts" },
  { value: "dairy", label: "Dairy" },
  { value: "eggs", label: "Eggs" },
  { value: "soy", label: "Soy" },
  { value: "shellfish", label: "Shellfish" },
  { value: "gluten", label: "Gluten" },
];

const HOUSEHOLD = [
  { value: "just-me", label: "Just me" },
  { value: "me-plus-partner", label: "Me + partner" },
  { value: "family-with-kids", label: "Family with kids" },
];

const GOALS = [
  { value: "more-energy", label: "More energy" },
  { value: "lose-weight", label: "Lose weight" },
  { value: "feed-kids-better", label: "Feed kids better" },
  { value: "reduce-inflammation", label: "Reduce inflammation" },
  { value: "get-off-ultra-processed", label: "Get off ultra-processed food" },
  { value: "just-curious", label: "Just curious" },
];

const WEEKNIGHT = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45+ min" },
];

const SKILL = [
  { value: "beginner" as const, label: "Beginner" },
  { value: "comfortable" as const, label: "Comfortable" },
  { value: "confident" as const, label: "Confident" },
];

export interface ProfileEditorValue {
  dietary_pattern: string[];
  allergies: string[];
  allergies_other: string;
  household_composition: string | null;
  top_goal: string | null;
  weeknight_time: number | null;
  skill_level: "beginner" | "comfortable" | "confident" | null;
}

function labelFor(list: { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return "—";
  return list.find((x) => x.value === value)?.label ?? value;
}

export function ProfileEditor({ initial }: { initial: ProfileEditorValue }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileEditorValue>(initial);

  const initialKey = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== initialKey,
    [draft, initialKey],
  );

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/profile/update", {
        dietary_pattern: draft.dietary_pattern,
        allergies: draft.allergies,
        allergies_other: draft.allergies_other.trim() || null,
        household_composition: draft.household_composition,
        top_goal: draft.top_goal,
        weeknight_time: draft.weeknight_time,
        skill_level: draft.skill_level,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(initial);
    setError(null);
    setEditing(false);
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Your profile</h2>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={cancel} disabled={saving} className="btn-ghost py-2">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary py-2 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-secondary py-2">
            Update profile
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-muted">Dietary pattern</dt>
          <dd>
            {draft.dietary_pattern.length
              ? draft.dietary_pattern.map((v) => labelFor(DIETARY, v)).join(", ")
              : "—"}
          </dd>
          <dt className="text-ink-muted">Allergies</dt>
          <dd>
            {draft.allergies.length || draft.allergies_other
              ? [
                  ...draft.allergies.map((v) => labelFor(ALLERGIES, v)),
                  draft.allergies_other.trim() || null,
                ]
                  .filter(Boolean)
                  .join(", ")
              : "—"}
          </dd>
          <dt className="text-ink-muted">Cooking for</dt>
          <dd>{labelFor(HOUSEHOLD, draft.household_composition)}</dd>
          <dt className="text-ink-muted">Top goal</dt>
          <dd>{labelFor(GOALS, draft.top_goal)}</dd>
          <dt className="text-ink-muted">Weeknight time</dt>
          <dd>
            {draft.weeknight_time ? `${draft.weeknight_time} min` : "—"}
          </dd>
          <dt className="text-ink-muted">Skill level</dt>
          <dd>{draft.skill_level ?? "—"}</dd>
        </dl>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Dietary pattern</label>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, dietary_pattern: toggle(draft.dietary_pattern, d.value) })
                  }
                  className={`text-left px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.dietary_pattern.includes(d.value)
                      ? "border-sunrise bg-sunrise/10 text-ink"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Allergies</label>
            <div className="grid grid-cols-2 gap-2">
              {ALLERGIES.map((al) => (
                <button
                  key={al.value}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, allergies: toggle(draft.allergies, al.value) })
                  }
                  className={`text-left px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.allergies.includes(al.value)
                      ? "border-coral bg-coral-soft/30 text-ink"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {al.label}
                </button>
              ))}
            </div>
            <input
              value={draft.allergies_other}
              onChange={(e) => setDraft({ ...draft, allergies_other: e.target.value })}
              placeholder="Other (free text)…"
              className="mt-2 w-full px-3 py-2.5 text-sm rounded-soft bg-white border border-ink/10 outline-none focus:border-sunrise"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Cooking for</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {HOUSEHOLD.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, household_composition: opt.value })}
                  className={`px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.household_composition === opt.value
                      ? "border-sunrise bg-sunrise/10 text-ink"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Top goal</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, top_goal: g.value })}
                  className={`text-left px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.top_goal === g.value
                      ? "border-sunrise bg-sunrise/10 text-ink"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Weeknight time</label>
            <div className="grid grid-cols-3 gap-2">
              {WEEKNIGHT.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, weeknight_time: opt.value })}
                  className={`px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.weeknight_time === opt.value
                      ? "border-sunrise bg-sunrise/10"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Skill level</label>
            <div className="grid grid-cols-3 gap-2">
              {SKILL.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, skill_level: opt.value })}
                  className={`px-3 py-2.5 min-h-[44px] rounded-soft border text-sm transition-all ${
                    draft.skill_level === opt.value
                      ? "border-sunrise bg-sunrise/10"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-coral">Couldn't save: {error}</p>
          )}
        </div>
      )}
    </section>
  );
}
