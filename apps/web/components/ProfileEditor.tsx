"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api";

// Mirrors the QuizFlow lists so the same values flow into user_profiles.
// Keeping them duplicated (rather than importing the quiz module) so this
// editor stands on its own and tweaks here don't require touching the quiz.
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
  { value: "wheat", label: "Wheat" },
  { value: "corn", label: "Corn" },
  { value: "fish", label: "Fish" },
  { value: "sesame", label: "Sesame" },
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

const TIMES = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
];

const SKILLS = [
  { value: "beginner" as const, label: "Beginner" },
  { value: "comfortable" as const, label: "Comfortable" },
  { value: "confident" as const, label: "Confident" },
];

export interface ProfileEditorProps {
  initial: {
    dietary_pattern: string[];
    allergies: string[];
    allergies_other: string;
    household_composition: string | null;
    top_goal: string | null;
    weeknight_time: number | null;
    skill_level: "beginner" | "comfortable" | "confident" | null;
  };
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function ProfileEditor({ initial }: ProfileEditorProps) {
  const [state, setState] = useState(initial);
  const [customAllergy, setCustomAllergy] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function save() {
    setStatus("saving");
    setErrorMsg(null);
    try {
      await apiPost("/api/profile/update", state);
      setStatus("saved");
      startTransition(() => router.refresh());
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function addCustomAllergy() {
    const v = customAllergy.trim().toLowerCase();
    if (!v || state.allergies.includes(v)) return;
    setState({ ...state, allergies: [...state.allergies, v] });
    setCustomAllergy("");
  }

  return (
    <section className="card p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Your preferences</h2>
          <p className="text-sm text-ink-muted mt-1">
            Used by the AI for every food swap and recommendation. Saving updates instantly.
          </p>
        </div>
        <Link
          href="/quiz"
          aria-label="Edit preferences via guided quiz"
          className="btn-secondary py-2 shrink-0 inline-flex items-center gap-1.5"
        >
          <EditIcon />
          <span>Edit</span>
        </Link>
      </div>

      <Field label="Dietary pattern" hint="Pick any that fit. None is fine.">
        <ChipGroup
          options={DIETARY}
          values={state.dietary_pattern}
          onToggle={(v) => setState({ ...state, dietary_pattern: toggle(state.dietary_pattern, v) })}
          tone="sunrise"
        />
      </Field>

      <Field label="Allergies & hard avoids" hint="These will NEVER appear in your swaps.">
        <ChipGroup
          options={ALLERGIES}
          values={state.allergies}
          onToggle={(v) => setState({ ...state, allergies: toggle(state.allergies, v) })}
          tone="coral"
        />
        <div className="mt-3 flex gap-2">
          <input
            value={customAllergy}
            onChange={(e) => setCustomAllergy(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomAllergy();
              }
            }}
            placeholder="Add another (e.g. nightshades)…"
            className="flex-1 px-3 py-2 text-sm rounded-soft bg-white border border-ink/10 outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={addCustomAllergy}
            disabled={!customAllergy.trim()}
            className="btn-secondary py-2 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {state.allergies.filter((a) => !ALLERGIES.some((opt) => opt.value === a)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {state.allergies
              .filter((a) => !ALLERGIES.some((opt) => opt.value === a))
              .map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setState({ ...state, allergies: state.allergies.filter((x) => x !== a) })}
                  className="inline-flex items-center gap-1 rounded-full bg-coral-soft/40 text-ink px-3 py-1 text-xs font-semibold ring-1 ring-coral/30"
                  aria-label={`Remove ${a}`}
                >
                  {a}
                  <span className="text-coral">×</span>
                </button>
              ))}
          </div>
        )}
      </Field>

      <Field label="Cooking for">
        <ChipGroup
          options={HOUSEHOLD}
          values={state.household_composition ? [state.household_composition] : []}
          onToggle={(v) =>
            setState({
              ...state,
              household_composition: state.household_composition === v ? null : v,
            })
          }
          tone="sunrise"
        />
      </Field>

      <Field label="Top goal">
        <ChipGroup
          options={GOALS}
          values={state.top_goal ? [state.top_goal] : []}
          onToggle={(v) =>
            setState({ ...state, top_goal: state.top_goal === v ? null : v })
          }
          tone="sunrise"
        />
      </Field>

      <Field label="Weeknight time">
        <ChipGroup
          options={TIMES.map((t) => ({ value: String(t.value), label: t.label }))}
          values={state.weeknight_time != null ? [String(state.weeknight_time)] : []}
          onToggle={(v) => {
            const n = Number(v);
            setState({
              ...state,
              weeknight_time: state.weeknight_time === n ? null : n,
            });
          }}
          tone="sunrise"
        />
      </Field>

      <Field label="Skill level">
        <ChipGroup
          options={SKILLS.map((s) => ({ value: s.value, label: s.label }))}
          values={state.skill_level ? [state.skill_level] : []}
          onToggle={(v) =>
            setState({
              ...state,
              skill_level:
                state.skill_level === v ? null : (v as "beginner" | "comfortable" | "confident"),
            })
          }
          tone="sunrise"
        />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-ink/5">
        {status === "saved" && (
          <span className="text-sm text-emerald-700 font-semibold">Saved ✓</span>
        )}
        {status === "error" && (
          <span className="text-sm text-coral font-semibold">{errorMsg ?? "Failed"}</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={status === "saving" || isPending}
          className="btn-primary disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {hint && <p className="text-xs text-ink-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ChipGroup({
  options,
  values,
  onToggle,
  tone,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (v: string) => void;
  tone: "sunrise" | "coral";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = values.includes(o.value);
        const activeCls =
          tone === "coral"
            ? "border-coral bg-coral-soft/30 text-ink"
            : "border-sunrise bg-sunrise/10 text-ink";
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
              active ? activeCls : "border-ink/10 bg-white hover:border-ink/20 text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
