# Real Food Win

> Replace ultra-processed food with real food, family by family.

Greenfield rebuild of [realfoodwin.org](https://realfoodwin.org) as a mobile-first, AI-powered food coach.
**Phase 1 (this build):** web prototype targeting Saturday 2026-05-16.
**Phase 2:** iOS + Android apps over the following 2–3 weeks.

See `V2_ProjectSpec_MobileFirst.md` for the full product + architecture spec.

## Stack

- **Web:** Next.js 14 App Router on Vercel
- **Mobile (Phase 2):** Expo / React Native
- **Database:** Supabase Postgres + pgvector
- **AI:** Anthropic Claude (Sonnet user-facing, Haiku background) + Voyage embeddings
- **Email:** Resend (magic-link auth)
- **Monorepo:** Turborepo + pnpm workspaces

## Layout

```
realfoodwin/
├── apps/web/                  Next.js web app (UI + API routes)
├── packages/
│   ├── types/                 Shared TypeScript + Zod schemas
│   ├── gateway/               LLM Gateway internals
│   ├── agents/                Swap Generator, Recipe Iterator, Quiz Summary, Embedder
│   └── db/                    Supabase migrations + RLS policies
└── seed/                      Demo content + fixtures
```

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in keys
pnpm dev
```

Required environment variables: see `.env.example`.

## Status

Active build — Saturday 2026-05-16 prototype. See `.claude/backlog.md` for deferred items.
