"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

interface Note {
  id: string;
  note: string;
  active: boolean;
  updated_at: string;
}

interface Props {
  targetUserId: string;
  initialNotes: Note[];
}

const PROMPTS = [
  "Linda doesn't like maple syrup in savory dishes — never use it.",
  "Sarah's kids don't eat anything spicier than mild salsa.",
  "Marcus wants ≥30g protein per recipe, no exceptions.",
  "Skip cilantro for this user — they think it tastes like soap.",
];

export function CoachingNotes({ targetUserId, initialNotes }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const placeholder = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  async function add() {
    if (draft.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await apiPost<{ note: Note }>("/api/admin/coaching", {
        target_user_id: targetUserId,
        note: draft.trim(),
      });
      setNotes((curr) => [res.note, ...curr]);
      setDraft("");
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(note: Note) {
    await fetch("/api/admin/coaching", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: note.id, active: !note.active }),
    });
    setNotes((curr) =>
      curr.map((n) => (n.id === note.id ? { ...n, active: !n.active } : n)),
    );
    router.refresh();
  }

  async function remove(note: Note) {
    if (!confirm("Delete this coaching note?")) return;
    await fetch(`/api/admin/coaching?id=${note.id}`, { method: "DELETE" });
    setNotes((curr) => curr.filter((n) => n.id !== note.id));
    router.refresh();
  }

  return (
    <div className="bg-honey/20 border-t border-honey/40 px-6 py-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-sunrise-700 mb-3 flex items-center gap-2">
        <span>🎯 Coach the AI</span>
        <span className="text-ink-muted normal-case font-normal text-[11px] tracking-normal">
          Free-text directives — flow into <code className="bg-cream px-1 rounded">&lt;admin_coaching_notes&gt;</code> on every Sonnet call for this user.
        </span>
      </h3>

      <div className="flex gap-2 mb-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="flex-1 p-2.5 text-sm rounded-soft bg-white border border-ink/10 outline-none focus:border-sunrise resize-none"
        />
        <button
          onClick={add}
          disabled={saving || draft.trim().length < 3}
          className="btn-primary py-2 px-4 text-sm self-start"
        >
          {saving ? "…" : "Add"}
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 bg-white rounded-soft p-3 ring-1 ring-ink/5 ${
                n.active ? "" : "opacity-50"
              }`}
            >
              <button
                onClick={() => toggle(n)}
                className={`mt-0.5 w-9 h-5 rounded-pill relative transition-colors flex-shrink-0 ${
                  n.active ? "bg-sunrise" : "bg-ink/15"
                }`}
                aria-label={n.active ? "Disable" : "Enable"}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-pill transition-transform ${
                    n.active ? "translate-x-4" : ""
                  }`}
                />
              </button>
              <p className="text-sm text-ink leading-relaxed flex-1">{n.note}</p>
              <button
                onClick={() => remove(n)}
                className="text-xs text-coral hover:underline flex-shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
