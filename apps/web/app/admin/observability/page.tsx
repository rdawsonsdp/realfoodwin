// Observability — the per-swap trace browser.
//
// Designed for a business reader, not an engineer: no agent jargon in the
// labels, no raw UUIDs in the visible columns, no SQL output dumped on the
// page. Each row tells a one-sentence story about a single user search.

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface TraceRow {
  request_id: string;
  user_id: string | null;
  input_type: "text" | "image" | "barcode" | "voice";
  input_query: string | null;
  category_implicit: string | null;
  classification_reasoning: string;
  source_chosen: "cache" | "library" | "llm" | "web" | "not_found";
  db_match_found: boolean;
  library_product_ids: string[];
  library_recipe_id: string | null;
  recommendations: Array<{ id: string | null; title: string; kind: string }>;
  latency_total_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  web_searches: string[];
  web_urls_fetched: string[];
  library_written: boolean;
  created_at: string;
}

interface SearchParams {
  q?: string;
  input_type?: string;
  source?: string;
  days?: string;
}

const FRIENDLY_INPUT: Record<TraceRow["input_type"], string> = {
  text: "Typed",
  image: "Photo",
  barcode: "Barcode",
  voice: "Voice",
};

const FRIENDLY_SOURCE: Record<TraceRow["source_chosen"], { label: string; tone: string }> = {
  cache: { label: "Recent cache", tone: "bg-honey/30 text-ink" },
  library: { label: "Our library", tone: "bg-sage-soft text-forest-700" },
  llm: { label: "AI knowledge", tone: "bg-coral-soft text-ink" },
  web: { label: "Brand websites", tone: "bg-paper text-ink ring-1 ring-forest-700/40" },
  not_found: { label: "No match", tone: "bg-ink/10 text-ink/60" },
};

function fmtAgo(iso: string): string {
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60_000;
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${Math.floor(diffMin)} min ago`;
  const diffHr = diffMin / 60;
  if (diffHr < 24) return `${Math.floor(diffHr)}h ago`;
  const diffDays = diffHr / 24;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return d.toLocaleDateString();
}

function fmtSeconds(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function storySentence(r: TraceRow): string {
  const what =
    r.input_type === "text"
      ? `searched for “${r.input_query ?? "(empty)"}”`
      : r.input_type === "barcode"
        ? `scanned “${r.input_query ?? "(unresolved barcode)"}”`
        : r.input_type === "image"
          ? `uploaded a photo`
          : `spoke a query`;

  const where = (() => {
    switch (r.source_chosen) {
      case "cache":
        return "we reused a recent answer";
      case "library":
        return `we matched ${r.library_product_ids.length} curated product${r.library_product_ids.length === 1 ? "" : "s"}${r.library_recipe_id ? " plus a curated recipe" : ""}`;
      case "web":
        return r.library_written
          ? `we searched authorized brand sites and added a new product to our library`
          : `we searched authorized brand sites`;
      case "llm":
        return "Claude wrote a fresh swap from training knowledge";
      case "not_found":
        return "we had nothing relevant to show";
    }
  })();

  return `Someone ${what} — ${where}. Took ${fmtSeconds(r.latency_total_ms)}.`;
}

export default async function ObservabilityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const days = Math.min(90, Math.max(1, Number(searchParams.days ?? "7") || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = admin
    .from("agent_traces")
    .select(
      "request_id, user_id, input_type, input_query, category_implicit, classification_reasoning, source_chosen, db_match_found, library_product_ids, library_recipe_id, recommendations, latency_total_ms, tokens_input, tokens_output, cost_usd, web_searches, web_urls_fetched, library_written, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.q?.trim()) {
    query = query.ilike("input_query", `%${searchParams.q.trim()}%`);
  }
  if (searchParams.input_type && searchParams.input_type !== "all") {
    query = query.eq("input_type", searchParams.input_type);
  }
  if (searchParams.source && searchParams.source !== "all") {
    query = query.eq("source_chosen", searchParams.source);
  }

  const { data: rows = [], error } = await query;
  const traces = (rows ?? []) as unknown as TraceRow[];

  // Top-of-page summary numbers — same time window.
  const summary = summarize(traces);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl md:text-2xl font-bold text-paper">
          What just happened
        </h2>
        <p className="text-sm text-paper/70 max-w-[60ch]">
          Every search someone runs in Real Food Win shows up here. Each row is
          one person, one search, with a plain-English summary of what they
          looked for and what we showed them. Use it to spot patterns over time.
        </p>
      </header>

      {/* Summary cards — written so a non-engineer can read at a glance. */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label={`Searches · last ${days} days`}
          value={summary.total.toLocaleString()}
          hint="Every time someone typed, scanned, or photographed something."
        />
        <SummaryCard
          label="Matched in our library"
          value={`${summary.libraryPct}%`}
          hint="Found a curated recipe or authorized brand product right away."
        />
        <SummaryCard
          label="Typical speed"
          value={fmtSeconds(summary.medianMs)}
          hint="Half of all searches finished in under this time."
        />
        <SummaryCard
          label="New brand products added"
          value={summary.libraryWritten.toLocaleString()}
          hint="When we couldn't match, we sometimes find a new authorized product on the web and save it for next time."
        />
      </section>

      {/* Filters — phrased plainly. */}
      <form className="flex flex-wrap items-end gap-3 p-4 rounded-soft bg-white/5 ring-1 ring-white/10">
        <FilterText
          name="q"
          label="Search the searches"
          defaultValue={searchParams.q ?? ""}
          placeholder="e.g. snickers, doritos"
        />
        <FilterSelect
          name="input_type"
          label="How they searched"
          defaultValue={searchParams.input_type ?? "all"}
          options={[
            { value: "all", label: "Any" },
            { value: "text", label: "Typed" },
            { value: "barcode", label: "Barcode" },
            { value: "image", label: "Photo" },
            { value: "voice", label: "Voice" },
          ]}
        />
        <FilterSelect
          name="source"
          label="Where the answer came from"
          defaultValue={searchParams.source ?? "all"}
          options={[
            { value: "all", label: "Any" },
            { value: "library", label: "Our library" },
            { value: "web", label: "Brand websites" },
            { value: "llm", label: "AI knowledge" },
            { value: "cache", label: "Recent cache" },
            { value: "not_found", label: "No match" },
          ]}
        />
        <FilterSelect
          name="days"
          label="Time window"
          defaultValue={String(days)}
          options={[
            { value: "1", label: "Last 24 hours" },
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
        />
        <button
          type="submit"
          className="rounded-pill bg-forest-700 hover:brightness-110 text-white text-sm font-bold px-5 py-2"
        >
          Apply
        </button>
      </form>

      {error && (
        <p className="text-sm text-coral">Couldn&apos;t load traces: {error.message}</p>
      )}

      <section className="rounded-soft bg-white/5 ring-1 ring-white/10 divide-y divide-white/10">
        {traces.length === 0 ? (
          <p className="p-6 text-sm text-paper/60">
            No searches match these filters yet.
          </p>
        ) : (
          traces.map((r) => <TraceRowCard key={r.request_id} row={r} />)
        )}
      </section>

      <p className="text-xs text-paper/40">
        Showing the most recent 200 searches in this window. Use filters to
        narrow further.
      </p>
    </div>
  );
}

function summarize(rows: TraceRow[]): {
  total: number;
  libraryPct: number;
  medianMs: number | null;
  libraryWritten: number;
} {
  const total = rows.length;
  const libraryHits = rows.filter(
    (r) => r.source_chosen === "library" || r.source_chosen === "cache",
  ).length;
  const libraryPct = total === 0 ? 0 : Math.round((libraryHits / total) * 100);
  const latencies = rows
    .map((r) => r.latency_total_ms)
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);
  const medianMs =
    latencies.length === 0
      ? null
      : latencies[Math.floor(latencies.length / 2)] ?? null;
  const libraryWritten = rows.filter((r) => r.library_written).length;
  return { total, libraryPct, medianMs, libraryWritten };
}

function TraceRowCard({ row }: { row: TraceRow }) {
  const source = FRIENDLY_SOURCE[row.source_chosen];
  return (
    <article className="p-4 md:p-5 space-y-2">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${source.tone}`}
        >
          {source.label}
        </span>
        <span className="text-paper/60">
          {FRIENDLY_INPUT[row.input_type]} · {fmtAgo(row.created_at)}
        </span>
        {row.library_written && (
          <span className="inline-flex items-center rounded-pill bg-forest-700 text-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            + Library grew
          </span>
        )}
        <span className="ml-auto text-paper/50">{fmtSeconds(row.latency_total_ms)}</span>
      </header>
      <p className="text-sm md:text-[15px] text-paper leading-relaxed">
        {storySentence(row)}
      </p>
      {row.recommendations.length > 0 && (
        <p className="text-xs text-paper/60">
          <span className="font-semibold text-paper/80">We showed:</span>{" "}
          {row.recommendations
            .slice(0, 3)
            .map((r) => r.title)
            .join(", ")}
          {row.recommendations.length > 3 && ` (+${row.recommendations.length - 3} more)`}
        </p>
      )}
      {row.web_searches.length > 0 && (
        <p className="text-xs text-paper/60">
          <span className="font-semibold text-paper/80">Searched on the web:</span>{" "}
          {row.web_searches.map((q) => `"${q}"`).join(", ")}
        </p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-paper/50 hover:text-paper/80">
          Technical details
        </summary>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-paper/70">
          <dt>Routing tag</dt>
          <dd className="font-mono">{row.classification_reasoning}</dd>
          {row.category_implicit && (
            <>
              <dt>Category</dt>
              <dd>{row.category_implicit}</dd>
            </>
          )}
          {row.tokens_input != null && (
            <>
              <dt>Tokens in / out</dt>
              <dd>
                {row.tokens_input} / {row.tokens_output ?? 0}
              </dd>
            </>
          )}
          {row.cost_usd != null && (
            <>
              <dt>Cost</dt>
              <dd>${row.cost_usd.toFixed(5)}</dd>
            </>
          )}
          {row.web_urls_fetched.length > 0 && (
            <>
              <dt>URLs read</dt>
              <dd className="break-all">
                {row.web_urls_fetched.map((u, i) => (
                  <span key={u} className="block">
                    <Link
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-paper"
                    >
                      {u}
                    </Link>
                    {i < row.web_urls_fetched.length - 1 ? "" : ""}
                  </span>
                ))}
              </dd>
            </>
          )}
          <dt>Request id</dt>
          <dd className="font-mono break-all">{row.request_id}</dd>
        </dl>
      </details>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-soft bg-white/5 ring-1 ring-white/10 p-4">
      <p className="text-xs uppercase tracking-[0.16em] font-bold text-paper/60">
        {label}
      </p>
      <p className="mt-1 text-2xl md:text-3xl font-bold text-paper">{value}</p>
      <p className="mt-1 text-xs text-paper/55 leading-snug">{hint}</p>
    </div>
  );
}

function FilterText({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[14rem] flex-1">
      <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-paper/60">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded-pill bg-paper text-ink px-3 py-2 text-sm placeholder:text-ink/50 outline-none focus:ring-2 focus:ring-forest-700"
      />
    </label>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-[10rem]">
      <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-paper/60">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-pill bg-paper text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-700"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
