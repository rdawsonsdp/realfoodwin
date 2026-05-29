-- 0018_agent_traces_full_debug.sql
--
-- Persist the remaining debug fields that the /home-v3 swap-card panel shows
-- so the Observability admin tab can rebuild the same surface from the DB.
-- These were previously computed at request time and discarded after the
-- response was sent.
--
-- merged_preferences  — the full prefs object the agent saw (user input +
--                       coach memory). Lets us answer "what did the user have
--                       set when this happened?"
-- avoid_titles        — previous-swap titles the user asked us to skip.
-- feedback            — free-text feedback the user passed in for this turn.
-- user_context        — the digest from loadUserContext (recent wins/misses,
--                       top/low rated, household, admin coaching notes...).
--                       Only populated when the LLM path ran.
-- user_prompt         — the FULL composed prompt sent to Claude. Only on LLM.
-- model               — model id used for the call (sonnet/haiku).
-- prompt_version      — prompt version tag for regression debugging.

alter table public.agent_traces
  add column if not exists merged_preferences jsonb,
  add column if not exists avoid_titles       text[],
  add column if not exists feedback           text,
  add column if not exists user_context       jsonb,
  add column if not exists user_prompt        text,
  add column if not exists model              text,
  add column if not exists prompt_version     text;
