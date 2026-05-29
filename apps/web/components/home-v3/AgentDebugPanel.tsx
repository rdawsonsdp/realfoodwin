"use client";

// Temporary observability panel for the swap agent — shows WHY (narrative +
// tuned-for-you reasons) and HOW (model, latency, source, merged prefs, user
// context that flowed into the prompt) for the most recent swap on /home-v3.
// Remove this component (and the `debug` field on /api/swap) once we're done
// debugging.

import type { SwapResult } from "@/components/SwapResultCard";

export interface AgentTrace {
  request_id: string | null;
  classification_reasoning: string;
  classification_confidence: number | null;
  source_chosen: "cache" | "library" | "llm" | "web" | "not_found";
  source_reasoning: string | null;
  db_match_found: boolean;
  library_recipe_id: string | null;
  library_product_ids: string[];
  category_implicit: string | null;
  recommendations: Array<{ id: string | null; title: string; kind: "primary" | "alternate" }>;
  latency_cache_ms: number | null;
  latency_embed_ms: number | null;
  latency_pgvector_ms: number | null;
  latency_judge_ms: number | null;
  latency_llm_ms: number | null;
  latency_web_ms: number | null;
  latency_total_ms: number;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  web_searches: string[];
  web_urls_fetched: string[];
  library_written: boolean;
  library_written_product_id: string | null;
  // What the user actually sent in this turn — included so the panel can
  // open with "what you selected" instead of starting at routing jargon.
  input_type: "text" | "image" | "barcode" | "voice";
  input_query: string | null;
  input_image_present: boolean;
}

// Returns the search-method label + the literal thing the user sent.
function inputDescription(trace: AgentTrace): { method: string; what: string } {
  const q = trace.input_query?.trim() ?? "";
  switch (trace.input_type) {
    case "image":
      return {
        method: "Photo",
        what: q ? `(with note: “${q}”)` : "a product photo",
      };
    case "barcode":
      return { method: "Barcode scan", what: q ? `→ “${q}”` : "(unresolved)" };
    case "voice":
      return { method: "Voice", what: q ? `“${q}”` : "(no transcript)" };
    default:
      return { method: "Typed", what: q ? `“${q}”` : "(empty)" };
  }
}

// Pulls the preferences the user had set when this swap fired. Returns an
// array of plain-English chips — empty if nothing was set.
function preferenceLines(debug: AgentDebug | null): string[] {
  const prefs = debug?.merged_preferences as
    | {
        goals?: string[];
        allergens?: string[];
        dietary_styles?: string[];
        max_prep_minutes?: number | null;
        prioritize?: string[];
        must_include?: string[];
      }
    | null
    | undefined;
  if (!prefs) return [];
  const out: string[] = [];
  const goals = prefs.goals ?? [];
  if (goals.length === 1) {
    out.push(goals[0] === "recipe" ? "Wants: a recipe" : "Wants: a product to buy");
  } else if (goals.length >= 2) {
    out.push("Wants: recipe or product");
  }
  if (prefs.dietary_styles?.length) out.push(`Diet: ${prefs.dietary_styles.join(", ")}`);
  if (prefs.allergens?.length) out.push(`Avoiding: ${prefs.allergens.join(", ")}`);
  if (prefs.max_prep_minutes) out.push(`Max prep: ${prefs.max_prep_minutes} min`);
  if (prefs.must_include?.length)
    out.push(`Must include: ${prefs.must_include.join(", ")}`);
  if (prefs.prioritize?.length)
    out.push(`Prioritizing: ${prefs.prioritize.join(", ")}`);
  return out;
}

// Legacy single-line summary (kept for fallback / accessibility).
function summarizeUserSelection(
  trace: AgentTrace,
  debug: AgentDebug | null,
): string {
  const prefs = debug?.merged_preferences as
    | {
        goals?: string[];
        allergens?: string[];
        dietary_styles?: string[];
        max_prep_minutes?: number | null;
        prioritize?: string[];
        must_include?: string[];
      }
    | null
    | undefined;
  const q = trace.input_query?.trim();

  let action: string;
  switch (trace.input_type) {
    case "image":
      action = q
        ? `You took a photo and added the note “${q}”`
        : "You uploaded a photo of a product";
      break;
    case "barcode":
      action = q
        ? `You scanned a barcode that resolved to “${q}”`
        : "You scanned a barcode";
      break;
    case "voice":
      action = q ? `You spoke “${q}”` : "You used voice input";
      break;
    default:
      action = q ? `You searched for “${q}”` : "You started a swap";
  }

  const bits: string[] = [];
  const goals = prefs?.goals ?? [];
  if (goals.length === 1) {
    bits.push(goals[0] === "recipe" ? "wanting a recipe" : "wanting a real-food product to buy");
  } else if (goals.length >= 2) {
    bits.push("open to a recipe or a product");
  }
  if (prefs?.dietary_styles?.length) {
    bits.push(`diet: ${prefs.dietary_styles.join(", ")}`);
  }
  if (prefs?.allergens?.length) {
    bits.push(`avoiding ${prefs.allergens.join(", ")}`);
  }
  if (prefs?.max_prep_minutes) {
    bits.push(`max ${prefs.max_prep_minutes}-min prep`);
  }
  if (prefs?.must_include?.length) {
    bits.push(`must include ${prefs.must_include.join(", ")}`);
  }
  if (prefs?.prioritize?.length) {
    bits.push(`prioritizing ${prefs.prioritize.join(", ")}`);
  }

  return bits.length > 0 ? `${action}, ${bits.join("; ")}.` : `${action}.`;
}

// Plain-English summary of what the agent did for this swap. Lives below the
// "you selected" line so the reader can compare intent → routing decision.
function summarize(trace: AgentTrace): string {
  const productCount = trace.library_product_ids.length;
  switch (trace.classification_reasoning) {
    case "cache_hit":
      return "Reused a recently-cached swap for this product — no new model call this time.";
    case "library_hit": {
      const parts: string[] = [];
      if (trace.library_recipe_id) parts.push("a curated recipe");
      if (productCount > 0)
        parts.push(`${productCount} curated product${productCount === 1 ? "" : "s"}`);
      const what = parts.length > 0 ? parts.join(" + ") : "a curated match";
      return `Matched against the curated library — ${what} fit your search.`;
    }
    case "library_miss_llm_fallback":
      return "No curated match — Claude wrote this from its training knowledge (no live web search).";
    case "library_miss_web_fallback": {
      const q = trace.web_searches.length;
      const u = trace.web_urls_fetched.length;
      const search = `searched the web (${q} ${q === 1 ? "query" : "queries"}, ${u} ${u === 1 ? "page" : "pages"})`;
      const writeback = trace.library_written
        ? " and added the discovered product to the library so future searches hit it directly."
        : ".";
      return `No curated match — Claude ${search}${writeback}`;
    }
    case "image_route":
      return "You uploaded a photo — Claude identified the food and generated a swap.";
    case "product_only_no_match":
      return "You asked for a product-only swap, but the curated catalog has nothing relevant. No swap returned.";
    default:
      return `Routed via ${trace.classification_reasoning}.`;
  }
}

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
  trace: AgentTrace | null;
  loading: boolean;
}

const SOURCE_LABEL: Record<AgentDebug["source"], string> = {
  llm: "🧠 LLM (sonnet)",
  library: "📚 Library (curated)",
  cache: "⚡ Cache",
};

export function AgentDebugPanel({ result, debug, trace, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-6 rounded-soft bg-paper/90 text-ink ring-1 ring-ink/10 px-4 py-3 shadow-sm">
        <Header />
        <p className="text-sm text-ink/60 italic">Asking the agent…</p>
      </div>
    );
  }
  if (!result && !debug && !trace) {
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

      {/* TRACE — per-step latency, classification + source reasoning, picks,
          token + cost totals. Collapsed by default; this is testing-only. */}
      {trace && (
        <section>
          <details>
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] font-bold text-forest-700 select-none">
              Agent trace (testing only)
            </summary>
            <div className="mt-3 space-y-3">
              {/* Plain-English summary — what the user put in, what was set,
                  what we did. Structured so a non-engineer can read it.
                  summarizeUserSelection is kept as a single-line fallback for
                  screen readers (sr-only). */}
              <span className="sr-only">{summarizeUserSelection(trace, debug)}</span>
              <div className="rounded-soft bg-sage-soft/40 ring-1 ring-forest-700/15 px-3 py-3 space-y-2.5">
                <SummaryRow
                  label="In the swap window"
                  value={`${inputDescription(trace).method} — ${inputDescription(trace).what}`}
                />
                <SummaryRow
                  label="Preferences"
                  value={
                    preferenceLines(debug).length === 0
                      ? "None set"
                      : preferenceLines(debug).join(" · ")
                  }
                />
                <SummaryRow label="What we did" value={summarize(trace)} />
                {trace.web_searches.length > 0 && (
                  <SummaryRow
                    label="Searched"
                    value={trace.web_searches.map((q) => `“${q}”`).join(", ")}
                  />
                )}
                {trace.library_written && (
                  <SummaryRow
                    label="Library grew by"
                    value="One new authorized-brand product was added so future searches will be instant."
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Chip label={`classify: ${trace.classification_reasoning}`} />
                {trace.classification_confidence != null && (
                  <Chip label={`confidence: ${trace.classification_confidence.toFixed(3)}`} />
                )}
                <Chip label={`source: ${trace.source_chosen}`} />
                <Chip label={trace.db_match_found ? "✓ db match" : "✗ db match"} />
                {trace.category_implicit && (
                  <Chip label={`category: ${trace.category_implicit}`} />
                )}
              </div>
              {trace.source_reasoning && (
                <KeyValue label="Source reasoning" value={trace.source_reasoning} />
              )}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink/60 font-bold mb-1">
                  Latency breakdown (ms)
                </p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Chip label={`total: ${trace.latency_total_ms}`} />
                  {trace.latency_cache_ms != null && (
                    <Chip label={`cache: ${trace.latency_cache_ms}`} />
                  )}
                  {trace.latency_embed_ms != null && (
                    <Chip label={`embed: ${trace.latency_embed_ms}`} />
                  )}
                  {trace.latency_pgvector_ms != null && (
                    <Chip label={`pgvector: ${trace.latency_pgvector_ms}`} />
                  )}
                  {trace.latency_judge_ms != null && (
                    <Chip label={`judge: ${trace.latency_judge_ms}`} />
                  )}
                  {trace.latency_llm_ms != null && (
                    <Chip label={`llm: ${trace.latency_llm_ms}`} />
                  )}
                </div>
              </div>
              {(trace.tokens_input != null || trace.cost_usd != null) && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {trace.tokens_input != null && (
                    <Chip label={`tokens in: ${trace.tokens_input}`} />
                  )}
                  {trace.tokens_output != null && (
                    <Chip label={`tokens out: ${trace.tokens_output}`} />
                  )}
                  {trace.cost_usd != null && (
                    <Chip label={`cost: $${trace.cost_usd.toFixed(5)}`} />
                  )}
                </div>
              )}
              {trace.recommendations.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ink/60 font-bold mb-1">
                    Recommendations
                  </p>
                  <ol className="list-decimal pl-5 text-xs space-y-0.5 text-ink-soft">
                    {trace.recommendations.map((r, i) => (
                      <li key={`${r.title}-${i}`}>
                        <span
                          className={
                            r.kind === "primary"
                              ? "font-semibold text-ink"
                              : "text-ink-soft"
                          }
                        >
                          {r.title}
                        </span>{" "}
                        <span className="text-ink/40">— {r.kind}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {trace.request_id && (
                <p className="text-[10px] text-ink/40 font-mono">
                  request_id: {trace.request_id}
                </p>
              )}
            </div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 items-baseline">
      <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-forest-700">
        {label}
      </span>
      <span className="text-sm text-ink leading-snug">{value}</span>
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

