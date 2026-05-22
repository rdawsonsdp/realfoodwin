-- =========================================================================
-- 0013_user_prefs_ui.sql
-- Adds ui_prefs jsonb to user_preferences so per-user UI settings (home
-- background theme, future surface choices) survive across devices.
-- =========================================================================

alter table public.user_preferences
  add column if not exists ui_prefs jsonb not null default '{}'::jsonb;
