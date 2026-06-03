-- 0019_agent_traces_whole_food.sql
--
-- Unlocks 'whole_food' as a valid source_chosen value.
--
-- The whole-food fast-path (e.g. "apples", "broccoli") returns an instant
-- "already real food" response and writes a trace with source_chosen =
-- 'whole_food'. The existing CHECK constraint only allowed
-- ('cache','library','llm','web','not_found'), so every whole-food trace
-- insert was silently rejected and swallowed by writeTrace's catch — those
-- swaps produced no observability row at all. Add the value.
--
-- Note: the fast classify→swap (Haiku) path deliberately reports as 'llm'
-- (it IS an LLM generation) with classification_reasoning =
-- 'library_miss_fast_swap', so it needs no new source_chosen value here.

alter table public.agent_traces
  drop constraint if exists agent_traces_source_chosen_check;
alter table public.agent_traces
  add constraint agent_traces_source_chosen_check
    check (source_chosen in ('cache','library','llm','web','not_found','whole_food'));
