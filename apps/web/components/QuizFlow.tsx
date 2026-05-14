"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

type Step = 1 | 2 | 3 | 4 | 5;

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

const GOALS = [
  { value: "more-energy", label: "More energy" },
  { value: "lose-weight", label: "Lose weight" },
  { value: "feed-kids-better", label: "Feed kids better" },
  { value: "reduce-inflammation", label: "Reduce inflammation" },
  { value: "get-off-ultra-processed", label: "Get off ultra-processed food" },
  { value: "just-curious", label: "Just curious" },
];

interface Answers {
  dietary_pattern: string[];
  allergies: string[];
  allergies_other: string;
  household_composition: string | null;
  household_members: { name: string; age_range: "toddler" | "kid" | "teen" | "adult" | null; allergies: string[] }[];
  top_goal: string | null;
  weeknight_time: number | null;
  skill_level: "beginner" | "comfortable" | "confident" | null;
}

export function QuizFlow({ nextRoute }: { nextRoute: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [a, setA] = useState<Answers>({
    dietary_pattern: [],
    allergies: [],
    allergies_other: "",
    household_composition: null,
    household_members: [],
    top_goal: null,
    weeknight_time: null,
    skill_level: null,
  });

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function submit() {
    setSubmitting(true);
    try {
      await apiPost("/api/quiz/submit", {
        dietary_pattern: a.dietary_pattern,
        allergies: a.allergies,
        allergies_other: a.allergies_other || null,
        household_composition: a.household_composition,
        household_members: a.household_members,
        top_goal: a.top_goal,
        weeknight_time: a.weeknight_time,
        skill_level: a.skill_level,
      });
      router.push(nextRoute);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1.5 w-12 rounded-pill transition-colors ${
              n <= step ? "bg-sunrise" : "bg-ink/10"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <p className="text-sm text-ink-muted">Question 1 of 5</p>
            <h2 className="text-3xl font-bold tracking-tight">What's your eating style?</h2>
            <p className="text-ink-soft mt-2">Pick any that fit. None is fine.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY.map((d) => (
              <button
                key={d.value}
                onClick={() => setA({ ...a, dietary_pattern: toggle(a.dietary_pattern, d.value) })}
                className={`text-left px-4 py-3 rounded-soft border transition-all ${
                  a.dietary_pattern.includes(d.value)
                    ? "border-sunrise bg-sunrise/10 text-ink"
                    : "border-ink/10 bg-white hover:border-ink/20"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary">
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <p className="text-sm text-ink-muted">Question 2 of 5 · Can't skip — safety</p>
            <h2 className="text-3xl font-bold tracking-tight">Any allergies or hard avoids?</h2>
            <p className="text-ink-soft mt-2">We'll never put these in a recipe for you.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALLERGIES.map((al) => (
              <button
                key={al.value}
                onClick={() => setA({ ...a, allergies: toggle(a.allergies, al.value) })}
                className={`text-left px-4 py-3 rounded-soft border transition-all ${
                  a.allergies.includes(al.value)
                    ? "border-coral bg-coral-soft/30 text-ink"
                    : "border-ink/10 bg-white hover:border-ink/20"
                }`}
              >
                {al.label}
              </button>
            ))}
          </div>
          <input
            value={a.allergies_other}
            onChange={(e) => setA({ ...a, allergies_other: e.target.value })}
            placeholder="Other (free text)…"
            className="w-full p-3 rounded-soft bg-white border border-ink/10 outline-none focus:border-sunrise"
          />
          <p className="text-sm text-ink-muted">If none, leave blank and continue.</p>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-ghost">← Back</button>
            <button onClick={() => setStep(3)} className="btn-primary">Continue →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <p className="text-sm text-ink-muted">Question 3 of 5</p>
            <h2 className="text-3xl font-bold tracking-tight">Who are you cooking for?</h2>
          </div>
          <div className="space-y-2">
            {[
              { value: "just-me", label: "Just me" },
              { value: "me-plus-partner", label: "Me + partner" },
              { value: "family-with-kids", label: "Family with kids" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setA({ ...a, household_composition: opt.value })}
                className={`block w-full text-left px-4 py-3 rounded-soft border transition-all ${
                  a.household_composition === opt.value
                    ? "border-sunrise bg-sunrise/10 text-ink"
                    : "border-ink/10 bg-white hover:border-ink/20"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-ghost">← Back</button>
            <button onClick={() => setStep(4)} className="btn-primary">Continue →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <p className="text-sm text-ink-muted">Question 4 of 5</p>
            <h2 className="text-3xl font-bold tracking-tight">What's your top goal?</h2>
          </div>
          <div className="space-y-2">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => setA({ ...a, top_goal: g.value })}
                className={`block w-full text-left px-4 py-3 rounded-soft border transition-all ${
                  a.top_goal === g.value
                    ? "border-sunrise bg-sunrise/10 text-ink"
                    : "border-ink/10 bg-white hover:border-ink/20"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="btn-ghost">← Back</button>
            <button onClick={() => setStep(5)} className="btn-primary">Continue →</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <p className="text-sm text-ink-muted">Question 5 of 5</p>
            <h2 className="text-3xl font-bold tracking-tight">How about your kitchen?</h2>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Weeknight time you've got</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 15, label: "15 min" },
                { value: 30, label: "30 min" },
                { value: 45, label: "45+ min" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setA({ ...a, weeknight_time: opt.value })}
                  className={`px-4 py-3 rounded-soft border transition-all ${
                    a.weeknight_time === opt.value
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
              {[
                { value: "beginner" as const, label: "Beginner" },
                { value: "comfortable" as const, label: "Comfortable" },
                { value: "confident" as const, label: "Confident" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setA({ ...a, skill_level: opt.value })}
                  className={`px-4 py-3 rounded-soft border transition-all ${
                    a.skill_level === opt.value
                      ? "border-sunrise bg-sunrise/10"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(4)} className="btn-ghost">← Back</button>
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? "Saving…" : "Finish & personalize"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
