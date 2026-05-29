"use client";

// Temporary observability panel for the swap agent — shows WHY (narrative +
// tuned-for-you reasons) and HOW (model, latency, source, merged prefs, user
// context that flowed into the prompt) for the most recent swap on /home-v3.
// Remove this component (and the `debug` field on /api/swap) once we're done
// debugging.

import type { SwapResult } from "@/components/SwapResultCard";

export interface AgentDebug {
  source: "library" | "llm" | "cache";
  model: string | null;
  prompt_version: string | null;
  request: string;
  merged_preferences: Record<string, unknown> | null;
  avoid_titles: string[] | null;
  feedback: string | null;
  user_context: {
    has_profile: boolean;
    has_household: boolean;
    household_member_count: number;
    summary: string | null;
    recent_wins: string[];
    recent_misses: string[];
    top_rated: string[];
    low_rated: string[];
    expert_reviewer_notes: string[];
    admin_coaching_notes: string[];
    cuisine_affinity: string[];
    occasion_patterns: string[];
    dismissal_reasons: string[];
    system_rules: string[];
  } | null;
  user_prompt: string | null;
}

interface Props {
  result: SwapResult | null;
  debug: AgentDebug | null;
  loading: boolean;
}

const SOURCE_LABEL: Record<AgentDebug["source"], string> = {
  llm: "🧠 LLM (sonnet)",
  library: "📚 Library (curated)",
  cache: "⚡ Cache",
};

export function AgentDebugPanel({ result, debug, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-6 rounded-soft bg-paper/90 text-ink ring-1 ring-ink/10 px-4 py-3 shadow-sm">
        <Header />
        <p className="text-sm text-ink/60 italic">Asking the agent…</p>
      </div>
    );
  }
  if (!result && !debug) {
    return (
      <div className="mt-6 rounded-soft bg-paper/80 text-ink ring-1 ring-ink/10 px-4 py-3 shadow-sm">
        <Header />
        <p className="text-sm text-ink/60">
          Run a swap and the agent&apos;s reasoning will show up here.
        </p>
      </div>
    );
  }

  const output = result?.output ?? null;
  const reasons = output?.tuned_for_you_reasons ?? [];
  const narrative = output?.narrative ?? null;
  const ctx = debug?.user_context ?? null;

  return (
    <div className="mt-6 rounded-soft bg-paper text-ink ring-1 ring-ink/10 px-4 py-4 shadow-sm space-y-4">
      <Header />

      {/* WHY */}
      {(narrative || reasons.length > 0) && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700">
            Why this swap
          </p>
          {narrative && (
            <p className="text-sm leading-relaxed text-ink-soft">{narrative}</p>
          )}
          {reasons.length > 0 && (
            <ul className="text-sm space-y-1 list-disc pl-5 text-ink-soft">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* HOW: pipeline metadata */}
      {debug && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700">
            How — pipeline
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip label={SOURCE_LABEL[debug.source]} />
            {result?.cached && <Chip label="🗂 from cache" />}
            {result?.latencyMs != null && (
              <Chip label={`⏱ ${result.latencyMs}ms`} />
            )}
            {debug.model && <Chip label={`model: ${debug.model}`} />}
            {debug.prompt_version && (
              <Chip label={`prompt: ${debug.prompt_version}`} />
            )}
          </div>
        </section>
      )}

      {/* HOW: agent inputs */}
      {debug && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700">
            How — agent inputs
          </p>
          <KeyValue label="Query" value={debug.request || "(image only)"} />
          {debug.feedback && (
            <KeyValue label="Feedback" value={debug.feedback} />
          )}
          {debug.avoid_titles && debug.avoid_titles.length > 0 && (
            <KeyValue
              label="Avoid titles"
              value={debug.avoid_titles.join(", ")}
            />
          )}
          {debug.merged_preferences && (
            <details className="text-xs">
              <summary className="cursor-pointer text-ink/70 hover:text-ink">
                Merged preferences (incl. coach memory)
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-ink/5 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
                {JSON.stringify(debug.merged_preferences, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* HOW: user context digest */}
      {ctx && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700">
            How — user context digest
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip label={ctx.has_profile ? "✓ profile" : "no profile"} />
            <Chip
              label={
                ctx.has_household
                  ? `✓ household (${ctx.household_member_count})`
                  : "no household"
              }
            />
            <Chip label={`wins: ${ctx.recent_wins.length}`} />
            <Chip label={`misses: ${ctx.recent_misses.length}`} />
            <Chip label={`top-rated: ${ctx.top_rated.length}`} />
            <Chip label={`low-rated: ${ctx.low_rated.length}`} />
            <Chip
              label={`admin notes: ${ctx.admin_coaching_notes.length}`}
            />
            <Chip
              label={`expert notes: ${ctx.expert_reviewer_notes.length}`}
            />
            <Chip
              label={`cuisines: ${ctx.cuisine_affinity.length}`}
            />
          </div>
          {ctx.summary && (
            <KeyValue label="Summary" value={ctx.summary} />
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-ink/70 hover:text-ink">
              Full context digest
            </summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded bg-ink/5 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
              {JSON.stringify(ctx, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {/* HOW: full prompt sent to Claude */}
      {debug?.user_prompt && (
        <section className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700">
            How — full prompt sent to Claude
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-ink/70 hover:text-ink">
              Show composed user prompt
            </summary>
            <pre className="mt-1 max-h-72 overflow-auto rounded bg-ink/5 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
              {debug.user_prompt}
            </pre>
          </details>
        </section>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-2 text-sm font-bold text-ink">
        <span aria-hidden>🔍</span> Agent decision
      </p>
      <span className="text-[10px] uppercase tracking-wider text-ink/40">
        debug · temporary
      </span>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-ink/5 ring-1 ring-ink/10 px-2 py-0.5 text-xs text-ink">
      {label}
    </span>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="font-semibold text-ink/70">{label}:</span>{" "}
      <span className="text-ink/85 break-words">{value}</span>
    </div>
  );
}

