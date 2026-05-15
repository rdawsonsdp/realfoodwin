"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

interface Props {
  recipeId: string;
  isLoggedIn: boolean;
  alreadySaved: boolean;
}

export function SaveRecipeButton({ recipeId, isLoggedIn, alreadySaved }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!isLoggedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/recipes/${recipeId}`)}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/kitchen", { recipe_id: recipeId });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-3 print:hidden">
        <span className="btn-secondary cursor-default" aria-disabled>
          ✓ Saved to My Kitchen
        </span>
        <a href="/kitchen" className="btn-ghost">View Kitchen →</a>
      </div>
    );
  }

  return (
    <div className="print:hidden">
      <button onClick={onSave} disabled={saving} className="btn-primary">
        {saving
          ? "Saving…"
          : isLoggedIn
            ? "Save to My Kitchen"
            : "Save to My Kitchen — Sign in"}
      </button>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}
