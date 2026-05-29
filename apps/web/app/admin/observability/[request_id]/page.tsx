// Per-trace deep-dive. Renders the same surface the user sees in the
// /home-v3 debug panel below the swap card, joined to the swap output for
// the WHY content (narrative + tuned-for-you reasons + alternates). This is
// what we'll point at in production to ask "why did the agent do that?"

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface SwapOutput {
  title?: string;
  tagline?: string;
  narrative?: string;
  tuned_for_you_reasons?: string[];
  ingredient_analysis?: Array<{
    item: string;
    concern_level: "fine" | "low" | "medium" | "high";
    explanation: string;
  }>;
  recipe?: {
    ingredients?: Array<{ name: string; quantity?: string; unit?: string }>;
    steps?: string[];
    time_min?: number;
    meal_type?: string;
  };
  nutrition?: Record<string, number | null | undefined>;
  product_url?: string | null;
  brand_name?: string | null;
  product_image_url?: string | null;
  alternates?: Array<{ title: string; tagline?: string; brand_name?: string | null; product_url?: string | null }>;
}

interface TraceRow {
  request_id: string;
  user_id: string | null;
  swap_id: string | null;
  input_type: "text" | "image" | "barcode" | "voice";
  input_query: string | null;
  input_image_present: boolean;
  input_meta: Record<string, unknown>;
  category_implicit: string | null;
  classification_reasoning: string;
  classification_confidence: number | null;
  source_chosen: "cache" | "library" | "llm" | "web" | "not_found";
  source_reasoning: string | null;
  db_match_found: boolean;
  library_recipe_id: string | null;
  library_product_ids: string[];
  recommendations: Array<{ id: string | null; title: string; kind: string }>;
  latency_cache_ms: number | null;
  latency_embed_ms: number | null;
  latency_pgvector_ms: number | null;
  latency_judge_ms: number | null;
  latency_llm_ms: number | null;
  latency_web_ms: number | null;
  latency_total_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  web_searches: string[];
  web_urls_fetched: string[];
  library_written: boolean;
  library_written_product_id: string | null;
  merged_preferences: Record<string, unknown> | null;
  avoid_titles: string[] | null;
  feedback: string | null;
  user_context: {
    has_profile?: boolean;
    has_household?: boolean;
    household_member_count?: number;
    summary?: string | null;
    recent_wins?: string[];
    recent_misses?: string[];
    top_rated?: string[];
    low_rated?: string[];
    expert_reviewer_notes?: string[];
    admin_coaching_notes?: string[];
    cuisine_affinity?: string[];
    occasion_patterns?: string[];
    dismissal_reasons?: string[];
    system_rules?: string[];
  } | null;
  user_prompt: string | null;
  model: string | null;
  prompt_version: string | null;
  client_platform: string | null;
  created_at: string;
}

const FRIENDLY_INPUT: Record<TraceRow["input_type"], string> = {
  text: "Typed",
  image: "Photo",
  barcode: "Barcode",
  voice: "Voice",
};

const FRIENDLY_SOURCE: Record<TraceRow["source_chosen"], string> = {
  cache: "Recent cache",
  library: "Our library",
  llm: "AI knowledge",
  web: "Brand websites",
  not_found: "No match",
};

function fmtSeconds(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function preferenceLines(
  prefs: TraceRow["merged_preferences"],
): string[] {
  if (!prefs) return [];
  const p = prefs as {
    goals?: string[];
    allergens?: string[];
    dietary_styles?: string[];
    max_prep_minutes?: number | null;
    prioritize?: string[];
    must_include?: string[];
    avoid_soft?: string[];
  };
  const out: string[] = [];
  const goals = p.goals ?? [];
  if (goals.length === 1) {
    out.push(goals[0] === "recipe" ? "Wants: a recipe" : "Wants: a product to buy");
  } else if (goals.length >= 2) {
    out.push("Wants: recipe or product");
  }
  if (p.dietary_styles?.length) out.push(`Diet: ${p.dietary_styles.join(", ")}`);
  if (p.allergens?.length) out.push(`Avoiding allergens: ${p.allergens.join(", ")}`);
  if (p.avoid_soft?.length) out.push(`Soft avoid (from coach): ${p.avoid_soft.join(", ")}`);
  if (p.max_prep_minutes) out.push(`Max prep: ${p.max_prep_minutes} min`);
  if (p.must_include?.length) out.push(`Must include: ${p.must_include.join(", ")}`);
  if (p.prioritize?.length) out.push(`Prioritizing: ${p.prioritize.join(", ")}`);
  return out;
}

function summarizeAgent(row: TraceRow): string {
  switch (row.classification_reasoning) {
    case "cache_hit":
      return "Reused a recently-cached swap for this product — no new model call this time.";
    case "library_hit": {
      const parts: string[] = [];
      if (row.library_recipe_id) parts.push("a curated recipe");
      const n = row.library_product_ids.length;
      if (n > 0) parts.push(`${n} curated product${n === 1 ? "" : "s"}`);
      const what = parts.length > 0 ? parts.join(" + ") : "a curated match";
      return `Matched against the curated library — ${what} fit the search.`;
    }
    case "library_miss_llm_fallback":
      return "No curated match — Claude wrote this from its training knowledge (no live web search).";
    case "library_miss_web_fallback":
      return `No curated match — Claude searched authorized brand sites (${row.web_searches.length} ${row.web_searches.length === 1 ? "query" : "queries"}, ${row.web_urls_fetched.length} ${row.web_urls_fetched.length === 1 ? "page" : "pages"})${
        row.library_written
          ? " and added the discovered product to the library so future searches hit it directly."
          : "."
      }`;
    case "image_route":
      return "User uploaded a photo — Claude identified the food and generated a swap.";
    case "product_only_no_match":
      return "User asked for a product-only swap, but the curated catalog has nothing relevant.";
    default:
      return `Routed via ${row.classification_reasoning}.`;
  }
}

export default async function ObservabilityDetailPage({
  params,
}: {
  params: { request_id: string };
}) {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: traceData, error: traceError } = await admin
    .from("agent_traces")
    .select("*")
    .eq("request_id", params.request_id)
    .maybeSingle();

  if (traceError || !traceData) {
    notFound();
  }
  const row = traceData as unknown as TraceRow;

  // Pull swap output for narrative + tuned-for-you + recipe content. swap_id
  // may be null on cache/no-match traces.
  let swapOutput: SwapOutput | null = null;
  if (row.swap_id) {
    const { data: swap } = await admin
      .from("swaps")
      .select("output")
      .eq("id", row.swap_id)
      .maybeSingle();
    swapOutput = (swap as { output?: SwapOutput } | null)?.output ?? null;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/observability"
        className="text-sm text-paper/60 hover:text-paper"
      >
        ← Back to all searches
      </Link>

      <header className="space-y-1">
        <h2 className="text-xl md:text-2xl font-bold text-paper">
          Search detail
        </h2>
        <p className="text-xs font-mono text-paper/50 break-all">
          request_id: {row.request_id}
        </p>
        <p className="text-xs text-paper/60">
          {new Date(row.created_at).toLocaleString()} ·{" "}
          {FRIENDLY_INPUT[row.input_type]} input · {FRIENDLY_SOURCE[row.source_chosen]}{" "}
          · {fmtSeconds(row.latency_total_ms)}
        </p>
      </header>

      {/* Plain-English top summary — same shape as the home-v3 panel. */}
      <section className="rounded-soft bg-sage-soft/40 ring-1 ring-forest-700/15 px-4 py-3 space-y-2 text-ink">
        <SummaryRow
          label="In the swap window"
          value={`${FRIENDLY_INPUT[row.input_type]} — ${row.input_query ? `“${row.input_query}”` : "(no query text)"}`}
        />
        <SummaryRow
          label="Preferences"
          value={
            preferenceLines(row.merged_preferences).length === 0
              ? "None set"
              : preferenceLines(row.merged_preferences).join(" · ")
          }
        />
        <SummaryRow label="What we did" value={summarizeAgent(row)} />
        {row.web_searches.length > 0 && (
          <SummaryRow
            label="Searched"
            value={row.web_searches.map((q) => `“${q}”`).join(", ")}
          />
        )}
        {row.library_written && (
          <SummaryRow
            label="Library grew by"
            value="One new authorized-brand product was added so future searches will be instant."
          />
        )}
      </section>

      {/* WHY — narrative + tuned-for-you reasons (from joined swap output). */}
      {swapOutput && (
        <Section title="Why this swap" tone="forest">
          {swapOutput.narrative && (
            <p className="text-sm leading-relaxed text-paper/85">
              {swapOutput.narrative}
            </p>
          )}
          {(swapOutput.tuned_for_you_reasons ?? []).length > 0 && (
            <ul className="text-sm text-paper/85 list-disc pl-5 space-y-1 mt-3">
              {swapOutput.tuned_for_you_reasons!.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {(swapOutput.ingredient_analysis ?? []).length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-paper/70 mb-2">
                Ingredient concerns flagged in the original
              </p>
              <ul className="space-y-1.5">
                {swapOutput.ingredient_analysis!.map((ia, i) => (
                  <li key={i} className="text-sm text-paper/80">
                    <span className="font-semibold uppercase mr-2 text-coral">
                      {ia.concern_level}
                    </span>
                    <strong>{ia.item}:</strong> {ia.explanation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* HOW — pipeline. */}
      <Section title="How — pipeline">
        <ChipRow
          items={[
            `source: ${FRIENDLY_SOURCE[row.source_chosen]}`,
            ...(row.model ? [`model: ${row.model}`] : []),
            ...(row.prompt_version ? [`prompt: ${row.prompt_version}`] : []),
            ...(row.classification_confidence != null
              ? [`confidence: ${row.classification_confidence.toFixed(3)}`]
              : []),
          ]}
        />
        <ChipRow
          items={[
            `total: ${fmtSeconds(row.latency_total_ms)}`,
            ...(row.latency_cache_ms != null ? [`cache: ${row.latency_cache_ms}ms`] : []),
            ...(row.latency_embed_ms != null ? [`embed: ${row.latency_embed_ms}ms`] : []),
            ...(row.latency_pgvector_ms != null
              ? [`pgvector: ${row.latency_pgvector_ms}ms`]
              : []),
            ...(row.latency_judge_ms != null ? [`judge: ${row.latency_judge_ms}ms`] : []),
            ...(row.latency_llm_ms != null ? [`llm: ${row.latency_llm_ms}ms`] : []),
            ...(row.latency_web_ms != null ? [`web: ${row.latency_web_ms}ms`] : []),
          ]}
        />
        {(row.tokens_input != null || row.cost_usd != null) && (
          <ChipRow
            items={[
              ...(row.tokens_input != null ? [`tokens in: ${row.tokens_input}`] : []),
              ...(row.tokens_output != null ? [`tokens out: ${row.tokens_output}`] : []),
              ...(row.cost_usd != null ? [`cost: $${row.cost_usd.toFixed(5)}`] : []),
            ]}
          />
        )}
        {row.source_reasoning && (
          <KeyValue label="Source reasoning (Haiku judge)" value={row.source_reasoning} />
        )}
      </Section>

      {/* HOW — agent inputs. */}
      <Section title="How — agent inputs">
        <KeyValue label="Query" value={row.input_query || "(none)"} />
        {row.feedback && <KeyValue label="Feedback" value={row.feedback} />}
        {row.avoid_titles && row.avoid_titles.length > 0 && (
          <KeyValue label="Avoid titles" value={row.avoid_titles.join(", ")} />
        )}
        {row.merged_preferences && (
          <details className="text-xs text-paper/80">
            <summary className="cursor-pointer text-paper/60 hover:text-paper">
              Merged preferences (raw JSON)
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-black/30 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words text-paper/85">
              {JSON.stringify(row.merged_preferences, null, 2)}
            </pre>
          </details>
        )}
      </Section>

      {/* HOW — user context digest. */}
      {row.user_context && (
        <Section title="How — user context digest">
          <ChipRow
            items={[
              row.user_context.has_profile ? "✓ profile" : "no profile",
              row.user_context.has_household
                ? `✓ household (${row.user_context.household_member_count ?? 0})`
                : "no household",
              `wins: ${row.user_context.recent_wins?.length ?? 0}`,
              `misses: ${row.user_context.recent_misses?.length ?? 0}`,
              `top-rated: ${row.user_context.top_rated?.length ?? 0}`,
              `low-rated: ${row.user_context.low_rated?.length ?? 0}`,
              `admin notes: ${row.user_context.admin_coaching_notes?.length ?? 0}`,
              `expert notes: ${row.user_context.expert_reviewer_notes?.length ?? 0}`,
              `cuisines: ${row.user_context.cuisine_affinity?.length ?? 0}`,
            ]}
          />
          {row.user_context.summary && (
            <KeyValue label="Summary" value={row.user_context.summary} />
          )}
          <details className="text-xs text-paper/80">
            <summary className="cursor-pointer text-paper/60 hover:text-paper">
              Full context digest (raw JSON)
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-black/30 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words text-paper/85">
              {JSON.stringify(row.user_context, null, 2)}
            </pre>
          </details>
        </Section>
      )}

      {/* HOW — recommendations returned. */}
      {row.recommendations.length > 0 && (
        <Section title="What we showed the user">
          <ol className="list-decimal pl-5 text-sm text-paper/85 space-y-1">
            {row.recommendations.map((r, i) => (
              <li key={`${r.title}-${i}`}>
                <span className={r.kind === "primary" ? "font-semibold text-paper" : ""}>
                  {r.title}
                </span>{" "}
                <span className="text-paper/50">— {r.kind}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* HOW — web search detail. */}
      {(row.web_searches.length > 0 || row.web_urls_fetched.length > 0) && (
        <Section title="Web search detail">
          {row.web_searches.length > 0 && (
            <KeyValue
              label="Search queries the model ran"
              value={row.web_searches.map((q) => `"${q}"`).join("; ")}
            />
          )}
          {row.web_urls_fetched.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-paper/70 mb-1">
                URLs read (from authorized brand sites only)
              </p>
              <ul className="text-xs space-y-0.5">
                {row.web_urls_fetched.map((u) => (
                  <li key={u}>
                    <Link
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-paper/80 hover:text-paper underline break-all"
                    >
                      {u}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* HOW — full prompt sent to Claude. */}
      {row.user_prompt && (
        <Section title="How — full prompt sent to Claude">
          <details className="text-xs text-paper/85">
            <summary className="cursor-pointer text-paper/60 hover:text-paper">
              Show composed user prompt
            </summary>
            <pre className="mt-2 max-h-[40rem] overflow-auto rounded bg-black/30 px-2 py-2 text-[11px] leading-snug whitespace-pre-wrap break-words">
              {row.user_prompt}
            </pre>
          </details>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "forest";
}) {
  return (
    <section
      className={`rounded-soft ring-1 px-4 py-4 space-y-3 ${
        tone === "forest"
          ? "bg-forest-700/30 ring-forest-700/40"
          : "bg-white/5 ring-white/10"
      }`}
    >
      <h3 className="text-[11px] uppercase tracking-[0.16em] font-bold text-paper/80">
        {title}
      </h3>
      {children}
    </section>
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

function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {items.map((label, i) => (
        <span
          key={`${label}-${i}`}
          className="inline-flex items-center rounded-full bg-white/10 ring-1 ring-white/10 px-2 py-0.5 text-paper"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="font-semibold text-paper/70">{label}:</span>{" "}
      <span className="text-paper/85 break-words">{value}</span>
    </div>
  );
}
