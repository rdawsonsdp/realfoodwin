-- 0016_agent_traces.sql
--
-- One row per /api/swap call. The unified trace that the spec calls for: per-
-- step latencies, the implicit routing signals (input_type, source_chosen),
-- the Haiku judge's `reason` string when the library was consulted, and the
-- recommendations returned. agent_calls and events are joined back via a new
-- request_id column on each so a single trace_id walks across all three.
--
-- No explicit category-classifier step was added — see the build discussion.
-- classification_reasoning is the routing tag (cache_hit, library_hit,
-- library_miss_llm_fallback, image_route, product_only_no_match) and
-- classification_confidence is the pgvector cosine of the winning candidate
-- when available. Adequate to answer the queries in the spec; can be
-- upgraded later if a real classifier is justified.

create table if not exists public.agent_traces (
  request_id              uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.users(id) on delete set null,
  input_type              text not null check (input_type in ('text','image','barcode','voice')),
  input_query             text,
  input_image_present     boolean not null default false,
  input_meta              jsonb not null default '{}'::jsonb,
  category_implicit       text,
  classification_reasoning text not null,
  classification_confidence numeric,
  source_chosen           text not null check (source_chosen in ('cache','library','llm','not_found')),
  source_reasoning        text,
  db_match_found          boolean not null default false,
  library_recipe_id       uuid,
  library_product_ids     uuid[] not null default '{}'::uuid[],
  swap_id                 uuid references public.swaps(id) on delete set null,
  recommendations         jsonb not null default '[]'::jsonb,
  latency_cache_ms        integer,
  latency_embed_ms        integer,
  latency_pgvector_ms     integer,
  latency_judge_ms        integer,
  latency_llm_ms          integer,
  latency_total_ms        integer,
  tokens_input            integer,
  tokens_output           integer,
  cost_usd                numeric(10,6),
  client_platform         text check (client_platform is null or client_platform in ('ios','android','web')),
  created_at              timestamptz not null default now()
);

create index if not exists agent_traces_created_idx
  on public.agent_traces(created_at desc);
create index if not exists agent_traces_input_type_created_idx
  on public.agent_traces(input_type, created_at desc);
create index if not exists agent_traces_source_chosen_idx
  on public.agent_traces(source_chosen);
create index if not exists agent_traces_swap_id_idx
  on public.agent_traces(swap_id)
  where swap_id is not null;
create index if not exists agent_traces_user_created_idx
  on public.agent_traces(user_id, created_at desc);

alter table public.agent_traces enable row level security;
drop policy if exists agent_traces_select_own on public.agent_traces;
create policy agent_traces_select_own on public.agent_traces
  for select to authenticated using (user_id = auth.uid());

-- Tie LLM calls + engagement events back to a trace.
alter table public.agent_calls add column if not exists request_id uuid;
create index if not exists agent_calls_request_id_idx
  on public.agent_calls(request_id)
  where request_id is not null;

alter table public.events add column if not exists request_id uuid;
create index if not exists events_request_id_idx
  on public.events(request_id)
  where request_id is not null;
