-- =========================================================================
-- 0003_profile.sql
-- Profile layer: user_profiles, household_member_profiles, user_preferences.
--
-- These tables hold quiz answers (spec 4.1) and the informational household
-- member profiles (spec 4.5). All cascade from users / households since
-- profile data is meaningless without its owner.
-- =========================================================================

-- -------------------------------------------------------------------------
-- user_profiles
-- -------------------------------------------------------------------------
-- One row per user. Captures the 5-question quiz output plus an `extra`
-- jsonb pocket for fields we add later without a migration (spec 6.2:
-- "JSON columns for fast-changing fields").
create table if not exists public.user_profiles (
  user_id               uuid primary key references public.users(id) on delete cascade,

  -- Q1: dietary pattern, multi-select (none valid)
  dietary_pattern       text[] not null default '{}',
  -- Q2: allergies & hard avoids, multi-select, REQUIRED (enforced in app, not here)
  allergies             text[] not null default '{}',
  -- Q3: who you're cooking for. Free-form descriptor like 'family_with_kids'.
  household_composition text,
  -- Q4: single-select goal
  top_goal              text,
  -- Q5: weeknight cooking time in minutes (15 / 30 / 45)
  weeknight_time        integer check (weeknight_time is null or weeknight_time between 5 and 240),
  -- Q5: skill level
  skill_level           text check (skill_level is null or skill_level in ('beginner', 'comfortable', 'confident')),

  -- Resumable mid-flow (spec 4.1): track progress so we can pick up.
  quiz_completed_at     timestamptz,
  quiz_last_step        integer,

  -- Open-ended pocket for fields we add without a migration.
  extra                 jsonb not null default '{}'::jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- household_member_profiles
-- -------------------------------------------------------------------------
-- Informational-only profiles for other household members (kids, partners).
-- No auth attached in v1 (spec 4.5). The Swap Generator agent reads these
-- to factor in "my 8-year-old has a tree nut allergy".
--
-- ON DELETE CASCADE from households: when a household is dissolved, all
-- member profiles go with it. Also cascades when the primary user is
-- deleted (because households.primary_user_id SET NULL doesn't destroy
-- the household, but the data_deletion_processor will clean up).
create table if not exists public.household_member_profiles (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  age_range     text check (age_range is null or age_range in ('toddler', 'kid', 'teen', 'adult')),
  allergies     text[] not null default '{}',
  avoids        text[] not null default '{}',
  -- For Phase 2 invite-to-login flow: when this profile gets upgraded
  -- to a real user we set linked_user_id rather than deleting/recreating.
  linked_user_id uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists household_member_profiles_household_id_idx
  on public.household_member_profiles(household_id);

drop trigger if exists household_member_profiles_set_updated_at on public.household_member_profiles;
create trigger household_member_profiles_set_updated_at
  before update on public.household_member_profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- user_preferences
-- -------------------------------------------------------------------------
-- Behavioral signals that aren't quiz answers: things the user has marked
-- as liked/disliked, swaps they dismissed from "For you today". These feed
-- the Recommender (Haiku) — see spec 5.3.
create table if not exists public.user_preferences (
  user_id          uuid primary key references public.users(id) on delete cascade,
  likes            text[] not null default '{}',
  dislikes         text[] not null default '{}',
  dismissed_swaps  uuid[] not null default '{}',
  -- Notification preferences live here for now (spec 4.7 controls);
  -- can break out into its own table if we add many channels.
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();
