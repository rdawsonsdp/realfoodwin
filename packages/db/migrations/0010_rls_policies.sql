-- =========================================================================
-- 0010_rls_policies.sql
-- Row-Level Security on every user-data table.
--
-- Rule (spec 4.5, 4.7, 6.2): a user can only access rows scoped to their
-- own user_id OR to a household_id where they're a member. Service role
-- bypasses RLS by default in Supabase, so backend code can do cross-user
-- work (e.g. the Recommender batch job) without policy gymnastics.
--
-- Patterns used:
--   user_id_eq_auth      → user_id = auth.uid()
--   household_member     → household_id in (select household_id from users where id = auth.uid())
--   own_or_household     → either of the above
--
-- All policies are written explicitly per action (SELECT / INSERT / UPDATE
-- / DELETE) for clarity and because Postgres won't infer them from a single
-- ALL policy when we want different rules per action.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: is_household_member(target_household uuid)
-- -------------------------------------------------------------------------
-- Wrapped as a SECURITY DEFINER function so we don't trigger recursive RLS
-- when checking the users table from inside another table's policy.
create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and household_id = target_household
  );
$$;

-- =========================================================================
-- IDENTITY
-- =========================================================================

-- households -----------------------------------------------------------
alter table public.households enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- No INSERT/DELETE for users: household lifecycle is owned by the
-- handle_new_auth_user trigger and the data_deletion_processor (service role).

-- users -----------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  -- A user can see themself + (later) other members of the same household.
  using (id = auth.uid() or public.is_household_member(household_id));

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT is via the auth trigger only. DELETE is via auth.users cascade.

-- auth_identities -------------------------------------------------------
alter table public.auth_identities enable row level security;

drop policy if exists auth_identities_select on public.auth_identities;
create policy auth_identities_select on public.auth_identities
  for select to authenticated using (user_id = auth.uid());

drop policy if exists auth_identities_insert on public.auth_identities;
create policy auth_identities_insert on public.auth_identities
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists auth_identities_delete on public.auth_identities;
create policy auth_identities_delete on public.auth_identities
  for delete to authenticated using (user_id = auth.uid());

-- mobile_app_waitlist ---------------------------------------------------
-- Not user-scoped (it's an email list). Locked to service role only;
-- anonymous signup goes through a server endpoint that uses service role.
alter table public.mobile_app_waitlist enable row level security;
-- No policies → no access from anon/authenticated. Service role bypasses RLS.

-- =========================================================================
-- PROFILE
-- =========================================================================

-- user_profiles ---------------------------------------------------------
alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_profiles_delete on public.user_profiles;
create policy user_profiles_delete on public.user_profiles
  for delete to authenticated using (user_id = auth.uid());

-- household_member_profiles --------------------------------------------
alter table public.household_member_profiles enable row level security;

drop policy if exists hmp_select on public.household_member_profiles;
create policy hmp_select on public.household_member_profiles
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists hmp_insert on public.household_member_profiles;
create policy hmp_insert on public.household_member_profiles
  for insert to authenticated with check (public.is_household_member(household_id));

drop policy if exists hmp_update on public.household_member_profiles;
create policy hmp_update on public.household_member_profiles
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists hmp_delete on public.household_member_profiles;
create policy hmp_delete on public.household_member_profiles
  for delete to authenticated using (public.is_household_member(household_id));

-- user_preferences ------------------------------------------------------
alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select on public.user_preferences;
create policy user_preferences_select on public.user_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_preferences_insert on public.user_preferences;
create policy user_preferences_insert on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update on public.user_preferences
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_preferences_delete on public.user_preferences;
create policy user_preferences_delete on public.user_preferences
  for delete to authenticated using (user_id = auth.uid());

-- =========================================================================
-- CONTENT
-- =========================================================================

-- products / brands / recipes ------------------------------------------
-- These are global content. Public read for authenticated users; writes
-- are service-role only (admin-curated + barcode resolution).
alter table public.products enable row level security;
alter table public.brands enable row level security;
alter table public.recipes enable row level security;

drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products
  for select to authenticated using (true);

drop policy if exists brands_select_all on public.brands;
create policy brands_select_all on public.brands
  for select to authenticated using (true);

drop policy if exists recipes_select_all on public.recipes;
create policy recipes_select_all on public.recipes
  for select to authenticated using (true);

-- Anonymous web visitors can also read products/brands/recipes for the
-- public swap demo and SEO pages.
drop policy if exists products_select_anon on public.products;
create policy products_select_anon on public.products
  for select to anon using (true);

drop policy if exists brands_select_anon on public.brands;
create policy brands_select_anon on public.brands
  for select to anon using (true);

drop policy if exists recipes_select_anon on public.recipes;
create policy recipes_select_anon on public.recipes
  for select to anon using (true);

-- recipe_variants -------------------------------------------------------
-- Owned by the iterating user.
alter table public.recipe_variants enable row level security;

drop policy if exists recipe_variants_select on public.recipe_variants;
create policy recipe_variants_select on public.recipe_variants
  for select to authenticated using (user_id = auth.uid());

drop policy if exists recipe_variants_insert on public.recipe_variants;
create policy recipe_variants_insert on public.recipe_variants
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recipe_variants_update on public.recipe_variants;
create policy recipe_variants_update on public.recipe_variants
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recipe_variants_delete on public.recipe_variants;
create policy recipe_variants_delete on public.recipe_variants
  for delete to authenticated using (user_id = auth.uid());

-- swaps -----------------------------------------------------------------
-- Canonical swaps (user_id null) are visible to everyone; personalized
-- swaps are visible only to their owner.
alter table public.swaps enable row level security;

drop policy if exists swaps_select on public.swaps;
create policy swaps_select on public.swaps
  for select to authenticated using (user_id is null or user_id = auth.uid());

drop policy if exists swaps_select_anon on public.swaps;
create policy swaps_select_anon on public.swaps
  for select to anon using (user_id is null);

drop policy if exists swaps_insert on public.swaps;
create policy swaps_insert on public.swaps
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);

drop policy if exists swaps_update on public.swaps;
create policy swaps_update on public.swaps
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists swaps_delete on public.swaps;
create policy swaps_delete on public.swaps
  for delete to authenticated using (user_id = auth.uid());

-- =========================================================================
-- BEHAVIORAL
-- =========================================================================

-- recipe_box_entries ----------------------------------------------------
alter table public.recipe_box_entries enable row level security;

drop policy if exists recipe_box_entries_select on public.recipe_box_entries;
create policy recipe_box_entries_select on public.recipe_box_entries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists recipe_box_entries_insert on public.recipe_box_entries;
create policy recipe_box_entries_insert on public.recipe_box_entries
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists recipe_box_entries_update on public.recipe_box_entries;
create policy recipe_box_entries_update on public.recipe_box_entries
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recipe_box_entries_delete on public.recipe_box_entries;
create policy recipe_box_entries_delete on public.recipe_box_entries
  for delete to authenticated using (user_id = auth.uid());

-- events (APPEND-ONLY) --------------------------------------------------
-- UPDATE/DELETE already revoked at grant level in 0005. RLS limits
-- INSERT/SELECT to the row owner.
alter table public.events enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated with check (user_id = auth.uid());

-- community_submissions -------------------------------------------------
-- Owner can do anything to their own row. Approved submissions are
-- readable by everyone (community feed).
alter table public.community_submissions enable row level security;

drop policy if exists community_submissions_select_own on public.community_submissions;
create policy community_submissions_select_own on public.community_submissions
  for select to authenticated using (user_id = auth.uid() or status = 'approved');

drop policy if exists community_submissions_select_anon on public.community_submissions;
create policy community_submissions_select_anon on public.community_submissions
  for select to anon using (status = 'approved');

drop policy if exists community_submissions_insert on public.community_submissions;
create policy community_submissions_insert on public.community_submissions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists community_submissions_update on public.community_submissions;
create policy community_submissions_update on public.community_submissions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists community_submissions_delete on public.community_submissions;
create policy community_submissions_delete on public.community_submissions
  for delete to authenticated using (user_id = auth.uid());

-- =========================================================================
-- GAMIFICATION
-- =========================================================================

alter table public.chef_points enable row level security;
alter table public.class_reservations enable row level security;
alter table public.event_rsvps enable row level security;

drop policy if exists chef_points_select on public.chef_points;
create policy chef_points_select on public.chef_points
  for select to authenticated using (user_id = auth.uid());
-- Writes are service role only (recompute job).

drop policy if exists class_reservations_select on public.class_reservations;
create policy class_reservations_select on public.class_reservations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists class_reservations_insert on public.class_reservations;
create policy class_reservations_insert on public.class_reservations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists class_reservations_update on public.class_reservations;
create policy class_reservations_update on public.class_reservations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists class_reservations_delete on public.class_reservations;
create policy class_reservations_delete on public.class_reservations
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists event_rsvps_select on public.event_rsvps;
create policy event_rsvps_select on public.event_rsvps
  for select to authenticated using (user_id = auth.uid());

drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists event_rsvps_update on public.event_rsvps;
create policy event_rsvps_update on public.event_rsvps
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps
  for delete to authenticated using (user_id = auth.uid());

-- =========================================================================
-- AI MEMORY
-- =========================================================================

-- embeddings ------------------------------------------------------------
-- Spec 5.6: never cross-user retrieval. RLS scopes by user OR household.
alter table public.embeddings enable row level security;

drop policy if exists embeddings_select on public.embeddings;
create policy embeddings_select on public.embeddings
  for select to authenticated
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
    -- Canonical (no user, no household) embeddings — e.g. recipe library —
    -- are readable by all authenticated users for RAG over public content.
    or (user_id is null and household_id is null)
  );
-- Writes are service-role only (Embedder agent).

-- user_summaries --------------------------------------------------------
alter table public.user_summaries enable row level security;

drop policy if exists user_summaries_select on public.user_summaries;
create policy user_summaries_select on public.user_summaries
  for select to authenticated using (user_id = auth.uid());
-- Writes are service-role only (nightly summary job).

-- =========================================================================
-- OPERATIONS
-- =========================================================================

-- agent_calls -----------------------------------------------------------
-- INSERT/UPDATE/DELETE already revoked from authenticated in 0008.
-- Users can SELECT their own rows (transparency / "show me my AI usage").
alter table public.agent_calls enable row level security;

drop policy if exists agent_calls_select_own on public.agent_calls;
create policy agent_calls_select_own on public.agent_calls
  for select to authenticated using (user_id = auth.uid());

-- subscriptions ---------------------------------------------------------
-- Users can read their own subscription. Writes happen via webhook
-- handlers running as service role.
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- notifications_queue ---------------------------------------------------
-- Users can read pending/sent notifications for transparency (Settings UI
-- can show "next reminder at..."). Writes are service role only.
alter table public.notifications_queue enable row level security;

drop policy if exists notifications_queue_select on public.notifications_queue;
create policy notifications_queue_select on public.notifications_queue
  for select to authenticated using (user_id = auth.uid());

-- device_tokens ---------------------------------------------------------
alter table public.device_tokens enable row level security;

drop policy if exists device_tokens_select on public.device_tokens;
create policy device_tokens_select on public.device_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists device_tokens_insert on public.device_tokens;
create policy device_tokens_insert on public.device_tokens
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists device_tokens_update on public.device_tokens;
create policy device_tokens_update on public.device_tokens
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists device_tokens_delete on public.device_tokens;
create policy device_tokens_delete on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());

-- =========================================================================
-- PRIVACY
-- =========================================================================

-- data_export_requests --------------------------------------------------
alter table public.data_export_requests enable row level security;

drop policy if exists data_export_requests_select on public.data_export_requests;
create policy data_export_requests_select on public.data_export_requests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists data_export_requests_insert on public.data_export_requests;
create policy data_export_requests_insert on public.data_export_requests
  for insert to authenticated with check (user_id = auth.uid());
-- UPDATE is service-role only (the export job fills in export_url, status).
-- DELETE is service-role only (cleanup after expires_at).

-- data_deletion_requests ------------------------------------------------
alter table public.data_deletion_requests enable row level security;

drop policy if exists data_deletion_requests_select on public.data_deletion_requests;
create policy data_deletion_requests_select on public.data_deletion_requests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists data_deletion_requests_insert on public.data_deletion_requests;
create policy data_deletion_requests_insert on public.data_deletion_requests
  for insert to authenticated with check (user_id = auth.uid());

-- User can cancel a pending deletion request within the 24h soft-delete
-- window — this is the only legitimate UPDATE from the user side.
drop policy if exists data_deletion_requests_cancel on public.data_deletion_requests;
create policy data_deletion_requests_cancel on public.data_deletion_requests
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending', 'cancelled'));

-- audit_log -------------------------------------------------------------
-- INSERT/UPDATE/DELETE revoked at grant level in 0009. Users can SELECT
-- their own rows for transparency.
alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_own on public.audit_log;
create policy audit_log_select_own on public.audit_log
  for select to authenticated using (user_id = auth.uid());
