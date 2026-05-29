-- 0017_agent_traces_web.sql
--
-- Extends agent_traces to capture the web-search leg of the swap pipeline,
-- and unlocks 'web' as a valid source_chosen value.
--
-- When the library matcher misses, the Sonnet fallback now runs with
-- Anthropic's web_search tool enabled. Sonnet picks search queries, reads
-- result pages, and produces a swap whose `product_url` is a real link on a
-- real brand site. We record what Sonnet searched for, which URLs it fetched,
-- the wall-clock cost of that leg, and whether we then wrote the discovered
-- product back into brand_products so the library grows from real usage.
--
-- brand_products.source is text (no enum constraint), so a new value
-- 'auto_web' is added in code, not here.

alter table public.agent_traces
  add column if not exists web_searches              text[] not null default '{}'::text[],
  add column if not exists web_urls_fetched          text[] not null default '{}'::text[],
  add column if not exists latency_web_ms            integer,
  add column if not exists library_written           boolean not null default false,
  add column if not exists library_written_product_id uuid references public.brand_products(id) on delete set null;

-- The original check excluded 'web' — replace it.
alter table public.agent_traces
  drop constraint if exists agent_traces_source_chosen_check;
alter table public.agent_traces
  add constraint agent_traces_source_chosen_check
    check (source_chosen in ('cache','library','llm','web','not_found'));

-- Cheap partial index for "how often is the library growing from web fallbacks?"
create index if not exists agent_traces_library_written_idx
  on public.agent_traces(library_written)
  where library_written = true;
