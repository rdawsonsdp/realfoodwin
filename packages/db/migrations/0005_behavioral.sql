-- =========================================================================
-- 0005_behavioral.sql
-- Behavioral layer: recipe_box_entries, events (APPEND-ONLY),
-- community_submissions.
--
-- `events` is the heart of the feedback loop (spec 4.3). It is append-only:
-- the only allowed operation is INSERT. UPDATE and DELETE are revoked.
-- This guarantees we never rewrite history that downstream agents
-- (Classifier, Recommender, nightly summary) depend on.
-- =========================================================================

-- -------------------------------------------------------------------------
-- recipe_box_entries
-- -------------------------------------------------------------------------
-- "My Kitchen" — the user's saved recipes (spec 4.4). Each entry points to
-- a canonical recipe, a swap, OR a variant — exactly one of those three.
-- Notes are free text and are fed to RAG (spec 5.6 row 3).
create table if not exists public.recipe_box_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  swap_id     uuid references public.swaps(id) on delete set null,
  variant_id  uuid references public.recipe_variants(id) on delete set null,
  saved_at    timestamptz not null default now(),
  notes       text,
  tags        text[] not null default '{}',
  -- Exactly one referent must be set so the entry has something to render.
  constraint recipe_box_entries_one_referent check (
    (recipe_id is not null)::int +
    (swap_id   is not null)::int +
    (variant_id is not null)::int = 1
  )
);

-- Lookup pattern from spec quality bar: recipe_box_entries(user_id, saved_at desc).
create index if not exists recipe_box_entries_user_saved_idx
  on public.recipe_box_entries(user_id, saved_at desc);
create index if not exists recipe_box_entries_recipe_id_idx on public.recipe_box_entries(recipe_id);
create index if not exists recipe_box_entries_swap_id_idx on public.recipe_box_entries(swap_id);
create index if not exists recipe_box_entries_variant_id_idx on public.recipe_box_entries(variant_id);
create index if not exists recipe_box_entries_tags_gin_idx
  on public.recipe_box_entries using gin (tags);

-- -------------------------------------------------------------------------
-- events (APPEND-ONLY)
-- -------------------------------------------------------------------------
-- Every meaningful user action (spec 4.3, 6.1, 6.2): viewed_swap, saved,
-- iterated, made_it, not_for_me, regenerated, share, etc.
-- `target_type` + `target_id` is a polymorphic pointer to whatever object
-- the event references (a swap, a recipe, a variant, a product, ...).
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  event_type      text not null,                          -- e.g. 'saved_swap', 'made_it'
  target_type     text,                                   -- 'swap' | 'recipe' | 'variant' | 'product'
  target_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,
  client_platform text check (client_platform is null or client_platform in ('ios', 'android', 'web')),
  created_at      timestamptz not null default now()
);

-- Lookup pattern from spec quality bar.
create index if not exists events_user_created_idx
  on public.events(user_id, created_at desc);
create index if not exists events_user_type_created_idx
  on public.events(user_id, event_type, created_at desc);
create index if not exists events_target_idx on public.events(target_type, target_id);

-- Append-only enforcement: revoke UPDATE and DELETE from anon, authenticated,
-- and service_role. INSERT remains. The only path to remove events is via
-- a privileged migration / data_deletion_processor running as the postgres
-- superuser (Supabase admin / SQL editor).
revoke update, delete on public.events from anon, authenticated, service_role;
-- Allow inserts and selects from the standard roles (RLS will further restrict).
grant insert, select on public.events to authenticated, service_role;

-- -------------------------------------------------------------------------
-- community_submissions
-- -------------------------------------------------------------------------
-- User-uploaded photos of made-it recipes (spec 4.3 / 9 Phase 2 for upload,
-- but the table exists from day one so Phase 1 events can reference it).
-- `status` lets moderators gate publication.
create table if not exists public.community_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  photo_url   text not null,                              -- Supabase Storage URL
  caption     text,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists community_submissions_user_id_idx on public.community_submissions(user_id);
create index if not exists community_submissions_status_idx on public.community_submissions(status);
create index if not exists community_submissions_recipe_id_idx on public.community_submissions(recipe_id);

drop trigger if exists community_submissions_set_updated_at on public.community_submissions;
create trigger community_submissions_set_updated_at
  before update on public.community_submissions
  for each row execute function public.set_updated_at();
