-- =========================================================================
-- 0006_gamification.sql
-- Gamification: chef_points, class_reservations, event_rsvps.
--
-- Phase 1 includes the tables but the surfaces (cooking classes, events)
-- are explicit Phase 2 product (spec 9). We persist points from day one
-- because made-it events feed the level system immediately.
-- =========================================================================

-- -------------------------------------------------------------------------
-- chef_points
-- -------------------------------------------------------------------------
-- One row per user. Recomputed by the chef_points.recompute Inngest job
-- (spec 5.7) whenever a points-worthy event fires.
create table if not exists public.chef_points (
  user_id         uuid primary key references public.users(id) on delete cascade,
  total_points    integer not null default 0 check (total_points >= 0),
  level           integer not null default 1 check (level >= 1),
  victory_tokens  integer not null default 0 check (victory_tokens >= 0),
  last_updated    timestamptz not null default now()
);

create index if not exists chef_points_level_idx on public.chef_points(level desc);

-- -------------------------------------------------------------------------
-- class_reservations
-- -------------------------------------------------------------------------
-- Live cooking-class reservations (Phase 2 mobile surface, but table is
-- here so we can seed classes during Phase 1).
create table if not exists public.class_reservations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  class_id     uuid not null,                              -- FK once `classes` table exists (Phase 2)
  status       text not null default 'reserved'
                  check (status in ('reserved', 'attended', 'cancelled', 'no_show')),
  reserved_at  timestamptz not null default now()
);

create unique index if not exists class_reservations_user_class_unique_idx
  on public.class_reservations(user_id, class_id);
create index if not exists class_reservations_user_id_idx on public.class_reservations(user_id);
create index if not exists class_reservations_class_id_idx on public.class_reservations(class_id);

-- -------------------------------------------------------------------------
-- event_rsvps
-- -------------------------------------------------------------------------
-- RSVPs to community events. Same Phase 2 caveat as class_reservations.
-- NB: `event_id` here refers to a future `events_calendar` table, NOT to
-- the behavioral `events` table from 0005. Naming overlap is unfortunate
-- but follows the spec verbatim.
create table if not exists public.event_rsvps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  event_id    uuid not null,                               -- FK once events_calendar exists
  status      text not null default 'going'
                check (status in ('going', 'maybe', 'declined', 'attended', 'no_show')),
  rsvped_at   timestamptz not null default now()
);

create unique index if not exists event_rsvps_user_event_unique_idx
  on public.event_rsvps(user_id, event_id);
create index if not exists event_rsvps_user_id_idx on public.event_rsvps(user_id);
create index if not exists event_rsvps_event_id_idx on public.event_rsvps(event_id);
