"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { pushRecentlyDeleted, removeRecentlyDeleted } from "@/lib/recentlyDeleted";

interface Props {
  recipeId: string;
  isLoggedIn: boolean;
  alreadySaved: boolean;
  initialNotes?: string | null;
}

type Status = "idle" | "working" | "saved" | "removed" | "saving-notes";

export function SaveRecipeButton({
  recipeId,
  isLoggedIn,
  alreadySaved,
  initialNotes,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(alreadySaved ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const notesDirty = notes !== savedNotes;

  async function save() {
    if (!isLoggedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/recipes/${recipeId}`)}`);
      return;
    }
    setStatus("working");
    setError(null);
    try {
      await apiPost("/api/kitchen", {
        recipe_id: recipeId,
        notes: notes.trim() || undefined,
      });
      removeRecentlyDeleted("recipe", recipeId);
      setSavedNotes(notes);
      setStatus("saved");
      setUndoVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }

  async function saveNotes() {
    setStatus("saving-notes");
    setError(null);
    try {
      await apiPatch("/api/kitchen", {
        recipe_id: recipeId,
        notes: notes.trim() || null,
      });
      setSavedNotes(notes);
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("saved");
    }
  }

  async function remove() {
    setStatus("working");
    setError(null);
    try {
      await apiDelete("/api/kitchen", { recipe_id: recipeId });
      pushRecentlyDeleted({ target_type: "recipe", target_id: recipeId, title: "Recipe" });
      setStatus("removed");
      setSavedNotes("");
      setUndoVisible(true);
      window.setTimeout(() => setUndoVisible(false), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("saved");
    }
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

  // Already in the kitchen — no "Save to My Kitchen" button. Surface a notes
  // field instead; the only thing left to save is the notes themselves, and
  // only when they're dirty.
  if (status === "saved" || (status === "working" && alreadySaved) || status === "saving-notes") {
    return (
      <div className="flex flex-col gap-3 w-full print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
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
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Your notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tweaks, family reactions, what you'd change next time…"
            rows={3}
            className="input mt-1 resize-none"
          />
        </label>
        {notesDirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveNotes}
              disabled={status === "saving-notes"}
              className="btn-primary"
            >
              {status === "saving-notes" ? "Saving notes…" : "Save notes"}
            </button>
            <button
              type="button"
              onClick={() => setNotes(savedNotes)}
              disabled={status === "saving-notes"}
              className="btn-ghost"
            >
              Discard
            </button>
          </div>
        )}
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full print:hidden">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tweaks, family reactions, what you'd change next time…"
          rows={3}
          className="input mt-1 resize-none"
        />
      </label>
      <button onClick={save} disabled={status === "working"} className="btn-primary self-start">
        {status === "working"
          ? "Saving…"
          : isLoggedIn
          ? notes.trim() ? "Save to My Kitchen with notes" : "Save to My Kitchen"
          : "Save to My Kitchen — Sign in"}
      </button>
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
