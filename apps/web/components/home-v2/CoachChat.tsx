"use client";

// Conversational coach chat — streams tokens from /api/coach/chat and shows
// quiet "noted" pills when the agent records a new memory mid-conversation.
//
// Two visual states:
//   * Collapsed (default) — last assistant turn + input. Doesn't dominate the page.
//   * Expanded — full scrollable transcript. Tap the title bar to toggle.
//
// State is local to the component for v1 — no persisted transcript across reloads
// yet. The memory summary persists in the DB, so the *relationship* survives even
// when the visible transcript resets.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  firstName: string;
  // Server-rendered opening turn so the conversation starts warm and personal.
  openingTurn: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface NotedPill {
  id: string;
  memory_type: string;
  subject: string;
}

export function CoachChat({ firstName, openingTurn }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: openingTurn },
  ]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [notedThisTurn, setNotedThisTurn] = useState<NotedPill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript on new content when expanded.
  useEffect(() => {
    if (expanded && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns, streamingText, expanded]);

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    setError(null);
    setNotedThisTurn([]);

    const userTurn: Turn = { role: "user", content: text };
    const history = [...turns, userTurn];
    setTurns(history);
    setStreaming(true);
    setStreamingText("");

    try {
      const resp = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Note: the assistant's opening turn was generated server-side, so it
        // belongs in the messages history Claude sees too.
        body: JSON.stringify({ messages: history }),
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`Coach unavailable (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";
      let summaryUpdated = false;

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by blank lines.
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "text") {
              accumulated += ev.delta;
              setStreamingText(accumulated);
            } else if (ev.type === "tool") {
              setNotedThisTurn((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-${prev.length}`,
                  memory_type: ev.memory_type ?? "note",
                  subject: ev.subject ?? "",
                },
              ]);
            } else if (ev.type === "done") {
              summaryUpdated = !!ev.summary_updated;
              break readLoop;
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          } catch {
            // Ignore malformed frames.
          }
        }
      }

      setTurns([...history, { role: "assistant", content: accumulated }]);
      setStreamingText("");
      // If we wrote to memory, refresh the server-rendered page so the
      // memory-aware sections (recent activity, coach's notes) catch up.
      if (summaryUpdated) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStreamingText("");
    } finally {
      setStreaming(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // In collapsed view, show only the most recent assistant turn.
  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");
  const displayText = streaming && streamingText ? streamingText : lastAssistant?.content ?? "";

  return (
    <section className="mb-8 rounded-soft bg-paper ring-1 ring-ink/5 shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full px-5 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3 hover:bg-honey/15 transition text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg leading-none">
            💬
          </span>
          <span className="text-sm uppercase tracking-[0.16em] font-semibold text-ink">
            How&apos;s it going, {firstName}?
          </span>
        </div>
        <span className="text-ink-muted text-xs">
          {expanded ? "Collapse ▴" : "Expand ▾"}
        </span>
      </button>

      <div className="px-5 pb-4 md:px-6 md:pb-5">
        {expanded ? (
          <div
            ref={transcriptRef}
            className="max-h-[420px] overflow-y-auto space-y-3 mb-3 pr-1"
          >
            {turns.map((t, i) => (
              <ChatBubble key={i} role={t.role}>
                {t.content}
              </ChatBubble>
            ))}
            {streaming && streamingText && (
              <ChatBubble role="assistant" streaming>
                {streamingText}
              </ChatBubble>
            )}
          </div>
        ) : (
          <ChatBubble role="assistant" streaming={streaming}>
            {displayText || (
              <span className="text-ink-muted italic">…</span>
            )}
          </ChatBubble>
        )}

        {/* Quiet "noted" pills — show subject + type, persist for this turn only. */}
        {notedThisTurn.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {notedThisTurn.map((n) => (
              <span
                key={n.id}
                className="inline-flex items-center gap-1 rounded-pill bg-sage-soft text-forest-700 px-2.5 py-1 text-xs font-medium animate-fade-up"
              >
                <span aria-hidden>📌</span>
                noted: {n.memory_type === "dislike" ? "no " : ""}
                {n.subject}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-coral">{error}</p>
        )}

        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            disabled={streaming}
            placeholder="Tell me how it's going…"
            rows={1}
            className="flex-1 px-3 py-2.5 min-h-[44px] text-sm md:text-base rounded-soft border border-ink/15 bg-paper text-ink placeholder:text-ink-muted focus:outline-none focus:border-coral resize-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={streaming || draft.trim().length === 0}
            className="rounded-pill bg-sunrise-500 hover:bg-sunrise-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 shadow-warm transition-colors"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({
  role,
  streaming,
  children,
}: {
  role: "user" | "assistant";
  streaming?: boolean;
  children: React.ReactNode;
}) {
  if (role === "assistant") {
    return (
      <div className="text-sm md:text-base text-ink leading-relaxed whitespace-pre-wrap">
        {children}
        {streaming && <span className="inline-block w-1.5 h-4 bg-ink/40 ml-1 animate-pulse rounded-sm align-middle" />}
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="inline-block max-w-[85%] bg-honey/40 text-ink rounded-soft px-3 py-2 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}
