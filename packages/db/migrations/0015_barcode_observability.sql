-- 0015_barcode_observability.sql
--
-- Speed up the barcode resolver and start collecting performance data so we
-- can decide later optimizations from real numbers instead of guesses.
--
-- Two new tables:
--   barcode_lookup_logs — one row per /api/barcode/lookup call. Records
--     timings for each leg (DB cache lookup, negative-cache lookup, OFF
--     fetch, write-through upsert) so we can compute p50/p95 per source and
--     watch the cache hit rate trend over time.
--   barcode_misses — negative cache. When Open Food Facts returns "not
--     found" for a barcode we mark it here so repeat scans of the same
--     unknown UPC skip the 200-2500ms OFF round-trip. Auto-stale after 30d
--     so OFF additions eventually get picked up.

-- -------------------------------------------------------------------------
-- barcode_lookup_logs
-- -------------------------------------------------------------------------
create table if not exists public.barcode_lookup_logs (
  id               uuid primary key default gen_random_uuid(),
  barcode          text not null,
  user_id          uuid references public.users(id) on delete set null,
  source           text not null
                     check (source in (
                       'cache',
                       'negative_cache',
                       'open_food_facts',
                       'not_found',
                       'error'
                     )),
  db_lookup_ms     integer,
  negative_cache_ms integer,
  off_fetch_ms     integer,
  db_upsert_ms     integer,
  total_ms         integer,
  client_platform  text check (client_platform is null or client_platform in ('ios', 'android', 'web')),
  created_at       timestamptz not null default now()
);

create index if not exists barcode_lookup_logs_created_idx
  on public.barcode_lookup_logs(created_at desc);
create index if not exists barcode_lookup_logs_source_created_idx
  on public.barcode_lookup_logs(source, created_at desc);

-- Append-only operational log — service role writes, no end-user writes.
alter table public.barcode_lookup_logs enable row level security;
revoke insert, update, delete on public.barcode_lookup_logs from authenticated;

-- Users can read their own rows for transparency, same shape as agent_calls.
drop policy if exists barcode_lookup_logs_select_own on public.barcode_lookup_logs;
create policy barcode_lookup_logs_select_own on public.barcode_lookup_logs
  for select to authenticated using (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- barcode_misses
-- -------------------------------------------------------------------------
create table if not exists public.barcode_misses (
  barcode     text primary key,
  checked_at  timestamptz not null default now()
);

-- Service role writes; nobody else needs access.
alter table public.barcode_misses enable row level security;
