"use client";

import { useState } from "react";
import Link from "next/link";

// Per-swap preferences that augment whatever's stored on the user's profile.
// Sent as a structured object to /api/swap and stitched into the AI prompt.

export interface SwapPrefsValue {
  goals: ("recipe" | "product")[];
  dietary_styles: string[];
  allergens: string[];
  max_prep_minutes: number | null;
  prioritize: string[];
  must_include: string[];
}

export const EMPTY_PREFS: SwapPrefsValue = {
  goals: ["recipe", "product"],
  dietary_styles: [],
  allergens: [],
  max_prep_minutes: null,
  prioritize: [],
  must_include: [],
};

const DIETARY_STYLES = ["Keto", "Vegan", "Kosher", "Gluten-Free"];
const ALLERGENS = ["Milk", "Eggs", "Fish", "Shellfish", "Tree Nuts", "Peanuts", "Wheat", "Soybeans", "Sesame"];
const PREP_TIMES: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
];
const PRIORITIZE = ["High Protein", "Low Fat", "Low Calorie"];

interface Props {
  value: SwapPrefsValue;
  onChange: (v: SwapPrefsValue) => void;
  disabled?: boolean;
}

export function SwapPreferences({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mustInput, setMustInput] = useState("");

  function toggleArr<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  function setGoal(goal: "recipe" | "product", checked: boolean) {
    const next = checked
      ? Array.from(new Set([...value.goals, goal]))
      : value.goals.filter((g) => g !== goal);
    onChange({ ...value, goals: next.length === 0 ? [goal] : next });
  }

  function addMustInclude() {
    const trimmed = mustInput.trim();
    if (!trimmed) return;
    if (value.must_include.includes(trimmed)) return;
    onChange({ ...value, must_include: [...value.must_include, trimmed] });
    setMustInput("");
  }

  const selectedCount =
    value.dietary_styles.length +
    value.allergens.length +
    value.prioritize.length +
    value.must_include.length +
    (value.max_prep_minutes != null ? 1 : 0);

  return (
    <div className="max-w-2xl mx-auto mt-3">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-2 rounded-pill bg-paper text-ink ring-1 ring-ink/10 px-4 py-2 text-sm font-semibold shadow-card hover:bg-honey/60 transition-colors"
        >
          <span aria-hidden>⚙️</span>
          {expanded
            ? "Hide preferences"
            : selectedCount
            ? `Preferences (${selectedCount})`
            : "Show preferences"}
        </button>
      </div>

      {expanded && (
        <div className="card mt-3 overflow-hidden">
          {/* Persistent-preferences banner. Sits outside the fieldset so it
              doesn't go opaque when the form is disabled mid-submit, and so the
              CTA is always tappable. */}
          <div className="flex items-center justify-between gap-3 bg-cream/40 px-5 py-3 border-b border-ink/10">
            <p className="text-xs text-ink-soft leading-snug">
              These chips only apply to <strong>this swap</strong>. To set permanent preferences (allergies, diet style, etc.), edit your profile.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-pill bg-sunrise text-white text-xs font-semibold px-3 py-1.5 hover:brightness-95 whitespace-nowrap shadow-warm"
            >
              <EditIcon />
              <span>Edit profile</span>
            </Link>
          </div>
          <fieldset
            disabled={disabled}
            className="p-5 space-y-5 text-sm disabled:opacity-60"
          >
          <Section label="What do you want?">
            <div className="flex flex-wrap gap-4">
              <Check
                checked={value.goals.includes("recipe")}
                onChange={(c) => setGoal("recipe", c)}
                label="Get a real food recipe"
              />
              <Check
                checked={value.goals.includes("product")}
                onChange={(c) => setGoal("product", c)}
                label="Find a real food product"
              />
            </div>
          </Section>

          <Section label="Dietary style">
            <ChipGroup
              options={DIETARY_STYLES}
              selected={value.dietary_styles}
              onToggle={(s) =>
                onChange({ ...value, dietary_styles: toggleArr(value.dietary_styles, s) })
              }
            />
          </Section>

          <Section label="Food allergens (avoid)">
            <ChipGroup
              options={ALLERGENS}
              selected={value.allergens}
              onToggle={(s) => onChange({ ...value, allergens: toggleArr(value.allergens, s) })}
            />
          </Section>

          <Section label="Max prep time">
            <div className="flex flex-wrap gap-2">
              {PREP_TIMES.map((t) => {
                const active = value.max_prep_minutes === t.value;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => onChange({ ...value, max_prep_minutes: t.value })}
                    className={
                      "px-4 py-2 min-h-[40px] rounded-pill text-sm border transition-colors " +
                      (active
                        ? "bg-sunrise text-white border-sunrise"
                        : "bg-paper text-ink-soft border-ink/15 hover:bg-cream")
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label="Prioritize">
            <ChipGroup
              options={PRIORITIZE}
              selected={value.prioritize}
              onToggle={(s) => onChange({ ...value, prioritize: toggleArr(value.prioritize, s) })}
            />
          </Section>

          <Section label="Must include (press enter to add)">
            <div className="space-y-2">
              <input
                type="text"
                inputMode="text"
                value={mustInput}
                onChange={(e) => setMustInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMustInclude();
                  }
                }}
                placeholder="e.g. chickpeas"
                className="w-full px-3 py-3 text-base rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
              />
              {value.must_include.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {value.must_include.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 bg-sage-soft px-3 py-1 rounded-pill text-xs"
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...value,
                            must_include: value.must_include.filter((x) => x !== m),
                          })
                        }
                        className="text-ink-muted hover:text-coral"
                        aria-label={`Remove ${m}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>
          </fieldset>
        </div>
      )}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] tracking-widest uppercase text-ink-muted text-center mb-2">{label}</h4>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={
              "px-3.5 py-2 min-h-[40px] rounded-pill text-sm border transition-colors " +
              (active
                ? "bg-sage text-white border-sage"
                : "bg-paper text-ink-soft border-ink/15 hover:bg-cream")
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-sunrise"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
