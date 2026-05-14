-- =========================================================================
-- 0008_operations.sql
-- Operations: agent_calls, subscriptions, notifications_queue, device_tokens.
--
-- agent_calls is the LLM Gateway log (spec 5.2). user_id is SET NULL on
-- user deletion so the cost/latency record survives for ops analysis
-- (spec quality bar: "audit/agent_calls stay (set null) so deleting a user
-- doesn't lose the operational record").
-- =========================================================================

-- -------------------------------------------------------------------------
-- agent_calls
-- -------------------------------------------------------------------------
-- Every call to Sonnet/Haiku/Voyage goes through the Gateway, which writes
-- one row here per call. Drives per-user cost tracking, per-agent latency
-- analytics, and prompt-version regression debugging.
create table if not exists public.agent_calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete set null,
  agent_name      text not null,                           -- 'swap_generator' | 'recipe_iterator' | ...
  model           text not null,                           -- 'claude-sonnet-4' | 'claude-haiku-4' | 'voyage-3'
  prompt_version  text not null,                           -- semver-ish; tied to a prompt file
  prompt_hash     text,                                    -- sha256 of the rendered prompt, for cache lookup
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10, 6),
  latency_ms      integer,
  status          text not null default 'success'
                    check (status in ('success', 'error', 'cached', 'timeout')),
  client_platform text check (client_platform is null or client_platform in ('ios', 'android', 'web')),
  created_at      timestamptz not null default now()
);

-- Lookup patterns: per-user cost analysis, per-agent regression checks.
create index if not exists agent_calls_user_created_idx
  on public.agent_calls(user_id, created_at desc);
create index if not exists agent_calls_agent_created_idx
  on public.agent_calls(agent_name, created_at desc);
create index if not exists agent_calls_prompt_version_idx on public.agent_calls(prompt_version);

-- agent_calls is operational/append-only from the user's perspective:
-- users can SELECT their own rows (transparency), but never INSERT/UPDATE/DELETE.
-- Only the service role (Gateway) writes here.
revoke insert, update, delete on public.agent_calls from anon, authenticated;
grant select on public.agent_calls to authenticated;
grant insert, select on public.agent_calls to service_role;

-- -------------------------------------------------------------------------
-- subscriptions
-- -------------------------------------------------------------------------
-- Unified subscription state across Apple IAP / Google Play / Stripe
-- (spec 5.8). A user can theoretically have multiple sources (e.g. they
-- subscribed on iOS and again on web) — the app picks the highest-tier
-- active one.
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  plan                     text not null
                             check (plan in ('champion_monthly', 'champion_annual',
                                             'champion_sponsor_family', 'free')),
  source                   text not null
                             check (source in ('stripe', 'apple_iap', 'google_play')),
  stripe_customer_id       text,
  stripe_subscription_id   text,
  revenuecat_app_user_id   text,                           -- RC's stable id (usually our user_id)
  status                   text not null default 'active'
                             check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired', 'paused')),
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- A user can have at most one row per source — webhooks upsert by (user_id, source).
create unique index if not exists subscriptions_user_source_unique_idx
  on public.subscriptions(user_id, source);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;
create index if not exists subscriptions_status_idx on public.subscriptions(status);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- notifications_queue
-- -------------------------------------------------------------------------
-- Inngest-driven notification queue (spec 5.7). Each row is a scheduled
-- send. `channel` distinguishes Expo push vs Resend email vs in-app banner.
create table if not exists public.notifications_queue (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  type           text not null,                            -- 'made_it_followup', 'weekly_recs', ...
  channel        text not null check (channel in ('email', 'push', 'in_app')),
  payload        jsonb not null default '{}'::jsonb,       -- title, body, deep_link, etc.
  scheduled_for  timestamptz not null default now(),
  status         text not null default 'pending'
                   check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at        timestamptz,
  attempts       integer not null default 0,
  last_error     text,
  created_at     timestamptz not null default now()
);

-- Lookup pattern: "next due notification for the sender job".
create index if not exists notifications_queue_due_idx
  on public.notifications_queue(scheduled_for) where status = 'pending';
create index if not exists notifications_queue_user_status_idx
  on public.notifications_queue(user_id, status);

-- -------------------------------------------------------------------------
-- device_tokens
-- -------------------------------------------------------------------------
-- Expo push tokens per device. A user may have multiple devices (one
-- phone + one tablet). `last_seen` is used to prune stale tokens during
-- a cleanup job.
create table if not exists public.device_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  platform         text not null check (platform in ('ios', 'android', 'web')),
  expo_push_token  text not null,
  last_seen        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create unique index if not exists device_tokens_token_unique_idx
  on public.device_tokens(expo_push_token);
create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);
