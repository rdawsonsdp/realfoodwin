"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiPost } from "@/lib/api";
import { pushRecentlyDeleted, removeRecentlyDeleted } from "@/lib/recentlyDeleted";

interface Props {
  recipeId: string;
  isLoggedIn: boolean;
  alreadySaved: boolean;
}

type Status = "idle" | "working" | "saved" | "removed";

export function SaveRecipeButton({ recipeId, isLoggedIn, alreadySaved }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(alreadySaved ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  async function save() {
    if (!isLoggedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/recipes/${recipeId}`)}`);
      return;
    }
    setStatus("working");
    setError(null);
    try {
      await apiPost("/api/kitchen", { recipe_id: recipeId });
      removeRecentlyDeleted("recipe", recipeId);
      setStatus("saved");
      setUndoVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }

  async function remove() {
    setStatus("working");
    setError(null);
    try {
      await apiDelete("/api/kitchen", { recipe_id: recipeId });
      // Save into the per-browser recovery cache so the user can still get it
      // back from "Recently deleted" on the kitchen page after the inline
      // undo affordance fades.
      pushRecentlyDeleted({ target_type: "recipe", target_id: recipeId, title: "Recipe" });
      setStatus("removed");
      setUndoVisible(true);
      // Hide the undo affordance after 8s; user can also reload to lose it.
      window.setTimeout(() => setUndoVisible(false), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("saved");
    }
  }

  if (status === "saved" || status === "working" && alreadySaved) {
    return (
      <div className="flex items-center gap-3 print:hidden">
        <span className="btn-secondary cursor-default" aria-disabled>
          ✓ In My Kitchen
        </span>
        <a href="/kitchen" className="btn-ghost">View Kitchen →</a>
        <button
          type="button"
          onClick={remove}
          disabled={status === "working"}
          className="btn-ghost text-coral hover:text-coral hover:bg-coral/10"
        >
          {status === "working" ? "Removing…" : "Remove"}
        </button>
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    );
  }

  if (status === "removed") {
    return (
      <div className="flex items-center gap-3 print:hidden">
        <span className="text-sm text-ink-soft">Removed from your kitchen.</span>
        {undoVisible && (
          <button onClick={save} className="btn-secondary py-2">
            ↺ Undo
          </button>
        )}
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    );
  }

  return (
    <div className="print:hidden">
      <button onClick={save} disabled={status === "working"} className="btn-primary">
        {status === "working"
          ? "Saving…"
          : isLoggedIn
          ? "Save to My Kitchen"
          : "Save to My Kitchen — Sign in"}
      </button>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}
