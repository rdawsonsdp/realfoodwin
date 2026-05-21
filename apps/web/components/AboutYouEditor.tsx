"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export interface AboutYouEditorProps {
  initialText: string;
  generatedAt: string | null;
}

export function AboutYouEditor({ initialText, generatedAt }: AboutYouEditorProps) {
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMsg("Can't be empty");
      return;
    }
    setStatus("saving");
    setErrorMsg(null);
    try {
      await apiPost("/api/profile/summary", { summary_text: trimmed });
      setStatus("saved");
      setEditing(false);
      startTransition(() => router.refresh());
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function cancel() {
    setText(initialText);
    setEditing(false);
    setStatus("idle");
    setErrorMsg(null);
  }

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-xl font-bold">About You</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary py-2">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            maxLength={2000}
            className="w-full px-3 py-2 text-sm rounded-soft bg-white border border-ink/10 outline-none focus:border-sunrise leading-relaxed text-ink"
            placeholder="What should the coach remember about you? Diet history, what's worked, what hasn't, anything that should shape your swaps…"
          />
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>{text.length} / 2000</span>
            <span>Used by the AI for every recommendation.</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            {status === "error" && (
              <span className="text-sm text-coral font-semibold mr-auto">{errorMsg ?? "Failed"}</span>
            )}
            <button type="button" onClick={cancel} className="btn-ghost-on-dark">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={status === "saving" || isPending}
              className="btn-primary disabled:opacity-50"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-ink-soft leading-relaxed whitespace-pre-wrap">{text}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-ink-muted">
              {generatedAt ? `Updated ${new Date(generatedAt).toLocaleDateString()}` : ""}
            </p>
            {status === "saved" && (
              <span className="text-sm text-emerald-700 font-semibold">Saved ✓</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
