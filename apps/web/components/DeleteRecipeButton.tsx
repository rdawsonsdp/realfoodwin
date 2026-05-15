"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/recipes?id=${recipeId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/recipes");
      router.refresh();
    } else {
      setBusy(false);
      alert("Delete failed.");
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="btn-ghost text-coral text-sm hover:bg-coral-soft/30"
    >
      {busy ? "Deleting…" : "Delete recipe"}
    </button>
  );
}
