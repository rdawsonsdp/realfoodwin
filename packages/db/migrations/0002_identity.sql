-- =========================================================================
-- 0002_identity.sql
-- Identity layer: households, users, auth_identities, mobile_app_waitlist.
--
-- Design notes:
-- * Supabase Auth owns the canonical user row in `auth.users`. Our
--   `public.users` row mirrors that id 1:1 and adds product fields
--   (display name, household, role). A trigger on `auth.users` insert
--   creates the public row automatically.
-- * Every user belongs to exactly one household. The household is created
--   lazily by the same trigger so the user always has a scope to write to.
-- * Spec 4.5: in v1 only the primary user has a login; other household
--   members are informational profiles (see 0003_profile.sql). This table
--   only tracks logged-in users.
-- =========================================================================

-- -------------------------------------------------------------------------
-- households
-- -------------------------------------------------------------------------
-- Top-level scope for all user data per spec 6.2. `primary_user_id` is the
-- only member with auth in v1; in Phase 2 additional members can be promoted.
-- It is nullable so we can create the household *before* the user row
-- (chicken-and-egg with the FK on `users.household_id`).
create table if not exists public.households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'My Household',
  primary_user_id uuid, -- FK added after `users` exists, see ALTER below
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- users (extends auth.users)
-- -------------------------------------------------------------------------
-- 1:1 with auth.users. `id` is a foreign key to auth.users so a user
-- cannot exist in our schema without an authenticated identity.
-- ON DELETE CASCADE: deleting the auth user (e.g. via Supabase Auth admin
-- or the data_deletion_processor job) tears down all product data.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete restrict,
  email         text not null,
  display_name  text,
  role          text not null default 'primary' check (role in ('primary', 'member')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists users_household_id_idx on public.users(household_id);
create unique index if not exists users_email_unique_idx on public.users(lower(email));

-- Now wire households.primary_user_id back to users. ON DELETE SET NULL so
-- a household can briefly be primary-less during a member transfer rather
-- than cascading and destroying household-scoped data.
alter table public.households
  drop constraint if exists households_primary_user_id_fkey;
alter table public.households
  add constraint households_primary_user_id_fkey
  foreign key (primary_user_id) references public.users(id) on delete set null;

create index if not exists households_primary_user_id_idx on public.households(primary_user_id);

-- -------------------------------------------------------------------------
-- auth_identities
-- -------------------------------------------------------------------------
-- Tracks which providers (apple, google, email magic link) a user has linked.
-- Spec 4.6: account linking is by verified email — same email across
-- providers resolves to the SAME account. This table records that mapping
-- so we can show "you signed up with Apple, also linked to Google" in UI.
--
-- Note: Supabase Auth has its own `auth.identities` table; this is an
-- application-level mirror keyed to our public.users so we can RLS over it.
create table if not exists public.auth_identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  provider        text not null check (provider in ('apple', 'google', 'email')),
  provider_id     text not null,         -- provider's stable user id (e.g. Apple sub)
  verified_email  text,                  -- email asserted verified by the provider
  created_at      timestamptz not null default now()
);

create unique index if not exists auth_identities_provider_unique_idx
  on public.auth_identities(provider, provider_id);
create index if not exists auth_identities_user_id_idx on public.auth_identities(user_id);

-- -------------------------------------------------------------------------
-- mobile_app_waitlist
-- -------------------------------------------------------------------------
-- Spec 3: emails carried forward from the current Replit site. Public-ish:
-- not tied to a user_id, this is just an email list. RLS will lock it down
-- to service-role only (see 0010_rls_policies.sql).
create table if not exists public.mobile_app_waitlist (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  source       text,                         -- 'replit_export', 'organic_signup', etc.
  created_at   timestamptz not null default now(),
  notified_at  timestamptz                   -- set when the launch email goes out
);

create unique index if not exists mobile_app_waitlist_email_unique_idx
  on public.mobile_app_waitlist(lower(email));

-- -------------------------------------------------------------------------
-- updated_at trigger function (used by every mutable table)
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Auth bootstrap trigger: auth.users INSERT -> public.users + household
-- -------------------------------------------------------------------------
-- When Supabase Auth creates a new user (any provider), we materialize a
-- household and a public.users row so the rest of the schema works out
-- of the box. The household name can be renamed by the user later.
--
-- security definer so the trigger runs with table-owner permissions even
-- though the inserting role is auth admin.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name) values ('My Household')
    returning id into new_household_id;

  insert into public.users (id, household_id, email, display_name, role)
  values (
    new.id,
    new_household_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    'primary'
  );

  update public.households
    set primary_user_id = new.id
    where id = new_household_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
