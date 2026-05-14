-- =========================================================================
-- 0007_ai_memory.sql
-- AI Memory: embeddings (pgvector) + user_summaries.
--
-- Spec 5.6: RAG is scoped per user/household at retrieval time, never
-- cross-user. The schema enforces user_id/household_id on every row so
-- RLS can guard reads (see 0010).
--
-- vector(1024) matches Voyage AI `voyage-3` output dimensions.
-- HNSW index for similarity search — preferred over IVFFlat for our scale
-- (better recall, no training step, available in pgvector 0.5+ which
-- Supabase ships).
-- =========================================================================

-- -------------------------------------------------------------------------
-- embeddings
-- -------------------------------------------------------------------------
-- Polymorphic embedding store. One row per embedded object.
-- `source_type` is one of the source categories in spec 5.6 (profile,
-- recipe_box_entry, made_it_event, etc.). `source_id` is the FK to the
-- original row. We don't enforce a FK at the DB level (polymorphic), but
-- the Embedder job sets it consistently.
create table if not exists public.embeddings (
  id            uuid primary key default gen_random_uuid(),
  source_type   text not null,                            -- 'user_profile' | 'recipe_box_entry' | 'made_it' | 'not_for_me' | 'community_caption' | 'canonical_swap' | 'recipe'
  source_id     uuid not null,
  user_id       uuid references public.users(id) on delete cascade,
  household_id  uuid references public.households(id) on delete cascade,
  embedding     vector(1024) not null,
  last_updated  timestamptz not null default now()
);

-- Lookup pattern from spec quality bar: embeddings(user_id, source_type).
create index if not exists embeddings_user_source_type_idx
  on public.embeddings(user_id, source_type);
create index if not exists embeddings_household_source_type_idx
  on public.embeddings(household_id, source_type);
-- Allow quick reverse lookup when re-embedding a specific source row.
create unique index if not exists embeddings_source_unique_idx
  on public.embeddings(source_type, source_id);

-- HNSW index for cosine similarity. m=16, ef_construction=64 are the
-- pgvector defaults — good baseline, tune later based on recall metrics.
-- vector_cosine_ops because we'll normalize Voyage embeddings and cosine
-- distance is the standard RAG similarity metric.
create index if not exists embeddings_vector_hnsw_idx
  on public.embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- -------------------------------------------------------------------------
-- user_summaries
-- -------------------------------------------------------------------------
-- The "secret weapon" (spec 5.6): one 150-word narrative per active user,
-- regenerated nightly by Haiku at 3am ET. Replaces previous summary
-- (one row per user). Embedded immediately and injected into every Sonnet call.
create table if not exists public.user_summaries (
  user_id       uuid primary key references public.users(id) on delete cascade,
  summary_text  text not null,
  embedding     vector(1024),
  generated_at  timestamptz not null default now()
);

-- HNSW for similarity search across user summaries (Phase 2: e.g.
-- "users like you also enjoyed..." discovery — gated by user opt-in;
-- never used cross-user for kids per spec 4.7).
create index if not exists user_summaries_vector_hnsw_idx
  on public.user_summaries
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
