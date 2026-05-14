-- =========================================================================
-- 0009_privacy.sql
-- Privacy: data_export_requests, data_deletion_requests, audit_log.
--
-- Spec 4.7: every privacy-sensitive action writes to `audit_log`, which is
-- immutable. Privacy controls (download, delete) materialize a request row
-- that the Inngest jobs (`data_deletion_processor` hourly,
-- `sensitive_action.audit_log`) drive to completion.
-- =========================================================================

-- -------------------------------------------------------------------------
-- data_export_requests
-- -------------------------------------------------------------------------
-- One row per "Download my data" click. The export job fills export_url
-- (signed Supabase Storage URL) when ready and sets expires_at to 7 days
-- out (spec 4.7).
create table if not exists public.data_export_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'ready', 'expired', 'failed')),
  export_url    text,                                      -- signed Supabase Storage URL
  requested_at  timestamptz not null default now(),
  ready_at      timestamptz,
  expires_at    timestamptz                                -- 7 days after ready_at
);

create index if not exists data_export_requests_user_id_idx on public.data_export_requests(user_id);
create index if not exists data_export_requests_status_idx on public.data_export_requests(status);

-- -------------------------------------------------------------------------
-- data_deletion_requests
-- -------------------------------------------------------------------------
-- One row per "Delete my account". Spec 4.7: 24-hour soft-delete window
-- before the deletion_processor fans out cascades. `soft_delete_until` is
-- the gate; anything earlier than now() is eligible for the processor.
create table if not exists public.data_deletion_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'soft_deleted', 'completed', 'cancelled', 'failed')),
  requested_at        timestamptz not null default now(),
  soft_delete_until   timestamptz not null default (now() + interval '24 hours'),
  completed_at        timestamptz,
  cancellation_reason text                                 -- set when status='cancelled' (user-recovered)
);

create index if not exists data_deletion_requests_user_id_idx on public.data_deletion_requests(user_id);
create index if not exists data_deletion_requests_due_idx
  on public.data_deletion_requests(soft_delete_until) where status = 'pending';

-- -------------------------------------------------------------------------
-- audit_log (IMMUTABLE)
-- -------------------------------------------------------------------------
-- Append-only log of privacy-sensitive actions: data export issued, account
-- deletion requested/completed, RLS policy bypassed by service role, etc.
-- Spec 4.7: this table is the legal record. UPDATE and DELETE are revoked
-- from every role except a maintenance migration acting as superuser.
-- user_id is SET NULL on user deletion so the record survives the deletion
-- it was created to document.
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  action      text not null,                               -- 'data_export_requested', 'account_deletion_completed', ...
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_user_created_idx
  on public.audit_log(user_id, created_at desc);
create index if not exists audit_log_action_created_idx
  on public.audit_log(action, created_at desc);

-- Immutability enforcement.
revoke update, delete on public.audit_log from anon, authenticated, service_role;
-- Service role can INSERT (the Gateway / privacy jobs write here).
-- Users can SELECT their own rows (transparency) — RLS in 0010 enforces scope.
grant insert on public.audit_log to service_role;
grant select on public.audit_log to authenticated;
