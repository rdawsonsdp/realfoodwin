"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

interface Props {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    title?: string;
    description?: string | null;
    ingredients?: Array<{ name: string; quantity?: string; unit?: string } | string>;
    steps?: string[];
    time_min?: number | null;
    difficulty?: string | null;
    meal_type?: string | null;
    tags?: string[];
  };
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "dessert", "side"];
const DIFFICULTIES: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];

function ingToText(ing: { name: string; quantity?: string; unit?: string } | string): string {
  if (typeof ing === "string") return ing;
  const q = [ing.quantity, ing.unit].filter(Boolean).join(" ");
  return q ? `${q} ${ing.name}` : ing.name;
}

export function AdminRecipeForm({ mode, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [ingredients, setIngredients] = useState<string>(
    (initial?.ingredients ?? []).map(ingToText).join("\n"),
  );
  const [steps, setSteps] = useState<string>(
    (initial?.steps ?? []).join("\n\n"),
  );
  const [timeMin, setTimeMin] = useState<string>(
    initial?.time_min ? String(initial.time_min) : "",
  );
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "");
  const [mealType, setMealType] = useState<string>(initial?.meal_type ?? "");
  const [tags, setTags] = useState<string>((initial?.tags ?? []).join(", "));
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkJson, setBulkJson] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkUpsert, setBulkUpsert] = useState(true);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        ingredients: ingredients
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => ({ name: s, quantity: "", unit: "" })),
        steps: steps
          .split(/\n\n+/)
          .map((s) => s.trim())
          .filter(Boolean),
        time_min: timeMin ? Number(timeMin) : null,
        difficulty: (difficulty || null) as "easy" | "medium" | "hard" | null,
        meal_type: mealType || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (mode === "edit" && initial?.id) {
        const res = await fetch("/api/admin/recipes", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: initial.id, patch: payload }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message ?? "Update failed");
      } else {
        await apiPost("/api/admin/recipes", payload);
      }
      router.push("/admin/recipes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function bulkUpload() {
    setSaving(true);
    setError(null);
    setBulkResult(null);
    try {
      const parsed = JSON.parse(bulkJson);
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed.recipes
          ? parsed.recipes
          : [parsed];
      const res = (await apiPost("/api/admin/recipes", {
        recipes: arr,
        upsert: bulkUpsert,
      })) as { data?: { inserted?: number; updated?: number; count?: number } };
      const ins = res.data?.inserted ?? res.data?.count ?? arr.length;
      const upd = res.data?.updated ?? 0;
      setBulkResult(`Imported ${ins} new, updated ${upd}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {mode === "create" && (
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setShowBulk(false)}
            className={`px-3 py-1.5 rounded-pill text-xs font-semibold ${
              !showBulk ? "bg-sunrise text-white" : "bg-white ring-1 ring-ink/10"
            }`}
          >
            Single recipe
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className={`px-3 py-1.5 rounded-pill text-xs font-semibold ${
              showBulk ? "bg-sunrise text-white" : "bg-white ring-1 ring-ink/10"
            }`}
          >
            Bulk paste (JSON)
          </button>
        </div>
      )}

      {showBulk ? (
        <div className="card p-5 space-y-3">
          <p className="text-sm text-ink-soft">
            Paste a JSON array of recipes, or an object with a <code className="bg-cream px-1 rounded">recipes</code> key.
            With <strong>Upsert</strong> on, existing rows are matched by title (case-insensitive) and updated; new titles are inserted.
          </p>
          <textarea
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
            placeholder={`[\n  {\n    "title": "Real-Food Smash Burger",\n    "description": "Crispy-edged smash burgers on cast iron…",\n    "ingredients": ["1 lb grass-fed ground beef", "..."],\n    "steps": ["Heat the pan", "..."],\n    "time_min": 20,\n    "difficulty": "medium",\n    "meal_type": "dinner",\n    "tags": ["beef", "burger"]\n  }\n]`}
            rows={18}
            className="w-full p-3 text-xs font-mono rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
          />
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
            <input
              type="checkbox"
              checked={bulkUpsert}
              onChange={(e) => setBulkUpsert(e.target.checked)}
              className="w-4 h-4 accent-sunrise"
            />
            Upsert by title (update existing instead of failing on duplicate)
          </label>
          {error && <p className="text-sm text-coral">{error}</p>}
          {bulkResult && <p className="text-sm text-emerald-700 font-semibold">{bulkResult}</p>}
          <div className="flex gap-2 items-center">
            <button
              onClick={bulkUpload}
              disabled={saving || bulkJson.trim().length < 5}
              className="btn-primary"
            >
              {saving ? "Importing…" : bulkUpsert ? "Import / update recipes" : "Import recipes"}
            </button>
            {bulkResult && (
              <button
                onClick={() => router.push("/admin/recipes")}
                className="btn-secondary py-2"
              >
                Back to list →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-6 space-y-5">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homemade Real-Food Snickers Bars"
              className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
            />
          </Field>

          <Field label="Description (1–2 sentences shown on recipe cards)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="A no-bake, date-sweetened take on the classic Snickers bar with chewy almond nougat and dark chocolate."
              className="w-full p-2.5 text-sm rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
            />
          </Field>

          <Field label="Ingredients (one per line)">
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={8}
              placeholder={"1 cup pitted Medjool dates\n1/2 cup natural peanut butter\n..."}
              className="w-full p-2.5 text-sm rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
            />
          </Field>

          <Field label="Steps (separate by blank lines)">
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={10}
              placeholder={"Line a baking dish with parchment.\n\nProcess the dates into a paste.\n\n..."}
              className="w-full p-2.5 text-sm rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise resize-none"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Time (minutes)">
              <input
                type="number"
                min={1}
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
                className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
              />
            </Field>
            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
              >
                <option value="">—</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Meal type">
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
              >
                <option value="">—</option>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Tags (comma separated)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="no-bake, gluten-free, kid-friendly"
              className="w-full p-2.5 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
            />
          </Field>

          {error && <p className="text-sm text-coral">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => router.push("/admin/recipes")}
              className="btn-secondary py-2"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || title.trim().length < 2}
              className="btn-primary py-2"
            >
              {saving ? "Saving…" : mode === "edit" ? "Update recipe" : "Create recipe"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
