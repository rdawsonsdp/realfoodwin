-- =========================================================================
-- 0011_coach_memory.sql
-- Conversational coach memory: the layer that lets the agent learn each
-- user and get better every day.
--
-- Architecture (see commit message for the full rationale):
--   * user_coach_memories — append-only granular fact log. One row per
--     remembered fact ("dislikes peanut butter", "kid won't eat fish on
--     weeknights"). Used as the audit/truth layer. Facts are never edited
--     in place; they're either marked superseded (with a pointer to the
--     newer row) or marked inactive.
--   * user_profiles.coach_memory_summary — a synthesized jsonb summary of
--     the user's likes/dislikes/constraints/themes/recent_wins. Rebuilt
--     by a Haiku call after every new memory write. This is what gets
--     injected into prompts (coach chat AND /api/swap), so prompts stay
--     small and consistent.
-- =========================================================================

-- -------------------------------------------------------------------------
-- user_coach_memories — append-only fact log
-- -------------------------------------------------------------------------
create table if not exists public.user_coach_memories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- What kind of memory this is. Open string for forward-compat; current
  -- vocabulary: like, dislike, allergy, constraint, theme, goal, win.
  memory_type   text not null
                  check (memory_type in (
                    'like', 'dislike', 'allergy', 'constraint',
                    'theme', 'goal', 'win'
                  )),

  -- The thing the memory is about — denormalized for fast filtering &
  -- prompt-friendly display. e.g. "peanut butter", "weeknight cooking",
  -- "more energy in the afternoon".
  subject       text not null,

  -- Optional structured payload — intensity, context, etc. Free-form jsonb
  -- so the agent can capture nuance without us pre-committing to a schema.
  detail        jsonb not null default '{}'::jsonb,

  -- Where this came from. 'coach_chat' for tool-use writes, 'rating' for
  -- inferred-from-stars, 'event' for inferred-from-made-it, 'quiz' for
  -- onboarding answers, etc.
  source        text not null default 'coach_chat',

  -- Agent's confidence in the memory. Low-confidence rows are still useful
  -- (they prompt the coach to ask), but never the basis of a hard filter.
  confidence    text not null default 'medium'
                  check (confidence in ('low', 'medium', 'high')),

  -- Lifecycle. A memory is *active* until either:
  --   (a) it's superseded by a newer fact (user changed their mind), or
  --   (b) the user explicitly retracts it via the coach.
  active        boolean not null default true,
  superseded_by uuid references public.user_coach_memories(id) on delete set null,

  -- Provenance — link back to the chat turn that produced this memory so
  -- the user can ask "why do you think that?" and we can show the source.
  source_turn_id text,

  created_at    timestamptz not null default now()
);

-- Lookups
create index if not exists user_coach_memories_user_active_idx
  on public.user_coach_memories(user_id, active, created_at desc);
create index if not exists user_coach_memories_user_type_idx
  on public.user_coach_memories(user_id, memory_type)
  where active = true;

-- Append-only enforcement (mirrors the `events` table pattern from 0005).
-- UPDATEs are allowed only via service_role so the supersede-write path can
-- flip `active` / `superseded_by`. UPDATE from anon/authenticated is revoked.
revoke update, delete on public.user_coach_memories from anon, authenticated;
grant insert, select on public.user_coach_memories to authenticated, service_role;
grant update on public.user_coach_memories to service_role;

-- RLS — user can read their own memories, insert their own, but never
-- update/delete from the client.
alter table public.user_coach_memories enable row level security;

drop policy if exists user_coach_memories_select_own on public.user_coach_memories;
create policy user_coach_memories_select_own on public.user_coach_memories
  for select using (user_id = auth.uid());

drop policy if exists user_coach_memories_insert_own on public.user_coach_memories;
create policy user_coach_memories_insert_own on public.user_coach_memories
  for insert with check (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- user_profiles.coach_memory_summary — synthesized prompt-ready summary
-- -------------------------------------------------------------------------
-- Shape (enforced in app code, not at the column level so we can iterate):
--   {
--     "likes":       [{"subject": "eggs",        "note": "weekday breakfast staple"}, ...],
--     "dislikes":    [{"subject": "peanut butter", "note": "in snacks specifically"}, ...],
--     "constraints": [{"subject": "no fish for the kids", "note": null}, ...],
--     "themes":      [{"subject": "afternoon energy slump", "note": "consistent at 3pm"}],
--     "recent_wins": [{"subject": "made apple+almond butter 3 times last week"}],
--     "updated_at":  "2026-05-18T19:23:00Z"
--   }
--
-- Null = no summary yet (cold start).
alter table public.user_profiles
  add column if not exists coach_memory_summary jsonb;

-- =========================================================================
-- END 0011_coach_memory.sql
-- =========================================================================
