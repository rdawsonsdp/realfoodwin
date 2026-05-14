# Real Food Win — Build Specification

> **For Claude Code:** This is a comprehensive specification for the next version of realfoodwin.org. Read this entire document, then **plan** the build — do not write code yet. Produce a phased implementation plan with milestones, file/module organization, dependency order, and a list of clarifying questions before any code is written. Treat every decision below as **locked unless explicitly marked as open**. Treat every requirement as a hard constraint.

---

## 0. Context

Real Food Win (realfoodwin.org) is a live product today: a stateless lookup tool that lets anyone type a junk-food product and get a real-food alternative with a recipe, nutrition comparison, and ingredient analysis. It is hosted on Replit, has a polished UI, includes a recipe library, brands directory, live cooking classes, events, and a community gallery.

We are **rebuilding it from scratch** as a personalized, logged-in, AI-powered food coach. Same brand, same mission, same look-and-feel for the swap result. Fundamentally different product underneath.

### The mission
> "Replace ultra-processed food with real food, family by family."

### The strategic wedge (versus Yuka, the closest analog)
Yuka is a database with a scoring algorithm. Real Food Win is an AI coach that learns each user and meets them in the kitchen, not the aisle. Everything downstream of the swap (recipes, iteration, recipe box, personalization) is uncontested ground.

---

## 1. Stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) on Vercel |
| Language | TypeScript end-to-end |
| AI | Anthropic — Claude Sonnet for user-facing, Claude Haiku for background |
| Embeddings | Voyage AI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Vectors | pgvector inside Supabase Postgres (NOT a separate vector DB) |
| Background jobs | Inngest |
| Email | Resend |
| LLM observability | Helicone |
| App observability | Sentry + Vercel Analytics |
| Billing | Stripe |
| Mobile (Phase 2) | Expo / React Native |

**Non-negotiable principle:** user data lives in Supabase. It does not get copied to other vector DBs, analytics warehouses, or third-party services. The privacy posture (Section 7) depends on this.

---

## 2. Migration approach (locked)

**Greenfield rebuild, full replacement.** The current Replit app will be sunset at cutover. The new app launches at `realfoodwin.org` (root domain). No data migration from the current app is needed — content (brands, recipes, classes, events) will be re-seeded in the new system.

Plan a clean cutover with:
- DNS swap from Replit to Vercel
- 301 redirects from any indexed swap URLs (`/swap/[product]`) to the new equivalents
- A pre-launch waitlist capture flow (email-only, stored in Supabase) for the mobile app — this exists on the current site and should not break

---

## 3. The Seven Product Decisions (locked)

These are the foundation. Everything else must support them.

### 3.1 Onboarding — Fast-start 5-question quiz at the save moment
Anonymous users get 5 free swaps + 1/day. The signup gate appears when they try to save, upload, iterate, or hit the swap limit. Sign-in → 5-question quiz → personalized regeneration of their original swap.

**The 5 questions, in order:**
1. **Dietary pattern** (multi-select, "none" valid): None, Gluten-free, Dairy-free, Vegetarian, Vegan, Paleo, Keto, Low-sugar
2. **Allergies & hard avoids** (multi-select, REQUIRED, cannot skip): Peanut, Tree nuts, Dairy, Eggs, Soy, Shellfish, Gluten, Other (free text)
3. **Who you're cooking for**: Just me / Me + partner / Family with kids. If kids: how many + rough age range (toddler/kid/teen)
4. **Top goal** (single-select): More energy / Lose weight / Feed kids better / Reduce inflammation / Get off ultra-processed food / Just curious
5. **Cooking reality**: Time on weeknight (15 / 30 / 45+ min) + Skill level (beginner / comfortable / confident)

**UX rules:**
- One question per screen
- Conversational tone in copy (not "Select dietary preferences" — "What's your eating style?")
- All questions skippable EXCEPT allergies (safety)
- Resumable mid-flow (save partial answers, pick up where left off)
- Accessible from settings to re-do anytime

### 3.2 First magic moment — Profile-aware from the first personalized swap
The very first swap the user sees after completing the quiz **must** reflect their profile. This means the swap they originally searched anonymously gets regenerated with their profile in context. A "Tuned for you" badge appears. This is the highest-stakes UX moment in the product.

### 3.3 Feedback loop — Mixed: passive + two light active touchpoints
- **Passive signals** (default, silent): save, view, copy, regenerate, return visit, share
- **Active touchpoint #1**: "Save to My Kitchen" — the act of saving IS the positive signal. No explicit rating.
- **Active touchpoint #2**: A few days after saving, surface a one-tap prompt: "Did you make [recipe]? Made it & loved it / Made it, not for me / Haven't made it yet"
- **Community photo upload** is the highest-value positive signal — already a feature, tie it to the user profile

NOT building: per-recipe star ratings, written reviews, detailed surveys.

### 3.4 Recipe box — Evolving cookbook (Level B), modeled for meal planning later
"My Kitchen" is NOT a bookmark folder. It is:
- Saved swaps and recipes
- Auto-organized (by meal type, recency, status — smart collections)
- Iterable ("make this dairy-free", "scale to 6", "make it 20 min faster") — iteration produces a variant tied to the parent
- Notes-capable (free-text user notes per recipe, which feed RAG)
- Designed so weekly meal planning (Phase 2) drops in without a rewrite

### 3.5 Household model — Household entity + per-user recipe boxes
- `households` is a top-level entity in the data model from day one
- Each user belongs to exactly one household
- In v1, ONLY the primary user has a login. Other household members exist as **informational profiles** ("my daughter, 8, tree nut allergy") with no auth.
- The agent uses informational profiles when generating swaps (e.g., kid's allergies → recipe avoids those ingredients)
- In Phase 2, informational profiles can be **upgraded** to full logins via an invite flow — no data migration required
- Recipe boxes stay per-user; sharing across the household is a Phase 2 opt-in

### 3.6 Auth — Magic link + Google + Apple. No passwords.
Three sign-in options on the signup screen, in this order: Continue with Google / Continue with Apple / Continue with Email (magic link).
- No password flows. No reset flows.
- Account linking by verified email — if a user signs up with magic link using `sarah@gmail.com` then later clicks "Sign in with Google" on that email, resolve to the SAME account, not a duplicate.
- Apple Sign-In ships in Phase 1 even though mobile is Phase 2 (it's required for App Store launch and we don't want to retrofit).

### 3.7 Privacy posture — Strong, user-aligned, designed for stronger later
**Brand commitment (surfaced in product, not just in policy):**
> "Real Food Win never sells, shares, or monetizes your data. We use what you tell us — and what you do here — only to make this app work better for you. Nothing about you leaves this platform."

**User-facing controls (in Settings):**
- **Download my data** — One button generates JSON + PDF bundle of profile, recipe box, swap history, events, community submissions. Email delivery via Resend. Available for 7 days.
- **Granular deletes** — Delete swap history / Delete a recipe / Delete a community submission / Clear behavioral signals
- **Delete my account** — Full deletion with 24-hour soft-delete window. Cascades through every table, storage bucket, embedding. Confirmation email on completion.

**Kids' data (under 13):**
- Minimum-necessary data collection
- Never used to inform any other user's experience
- Never used in any training data (even aggregate)
- Auto-deleted when the parent profile is removed
- Settings UI shows a reminder when a child profile exists

**Hard rules:**
- No advertising-related tracking
- No third-party analytics that sees user data
- No selling, sharing, or monetizing personal data — including to brands in our directory
- Aggregate, fully anonymized trends are OK for internal product decisions

---

## 4. Architecture (locked)

### 4.1 Four layers + sidecars

```
┌─────────────────────────────────────────────────┐
│ LAYER 1: USER SURFACES (Next.js on Vercel)      │
│  Web app (Phase 1) | Mobile (Phase 2)           │
└─────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────┐
│ LAYER 2: LLM GATEWAY (internal service)         │  ← MOST IMPORTANT
│  Profile injection | RAG retrieval              │
│  Logging & cost    | Caching                    │
└─────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────┐
│ LAYER 3: SIX SPECIALIZED AI AGENTS              │
│  Sonnet:    Swap Generator | Recipe Iterator | Recipe Builder │
│  Haiku:     Recommender   | Classifier                       │
│  Voyage:    Embedder                                          │
└─────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────┐
│ LAYER 4: DATA FOUNDATION (Supabase)             │
│  Auth | Postgres | pgvector | Storage           │
└─────────────────────────────────────────────────┘

Sidecars: Inngest, Resend, Helicone, Sentry, Stripe
```

### 4.2 The LLM Gateway — non-negotiable

**No application code calls Anthropic directly.** Every Sonnet/Haiku call routes through a single internal service (the Gateway). This is the single most important architectural pattern in the codebase.

The Gateway is responsible for:
- Loading the user's structured profile and injecting it into every Sonnet call
- Loading the user's nightly summary and injecting it into every Sonnet call
- Performing RAG retrieval (pgvector queries) and injecting relevant context
- Composing the final prompt from the agent's template + context bundle
- Calling Anthropic with tool-use enabled for structured outputs
- Logging every call to the `agent_calls` table (prompt hash, response, model, latency, tokens, cost, user_id, agent_name, prompt_version)
- Pushing the same data to Helicone for product analytics
- Cost tracking per user, per agent, per day (catches abuse and prompt injection)
- Caching personalized swap variants in the `swaps` table
- Retries and graceful degradation on Anthropic errors

The Gateway API surface (internal):
```typescript
gateway.run({
  agent: 'swap_generator' | 'recipe_iterator' | 'recipe_builder' | 'recommender' | 'classifier',
  userId: string,
  input: AgentInput,  // typed per agent
}): Promise<AgentOutput>  // typed per agent
```

### 4.3 The Six Agents

| Agent | Model | Tier | Trigger | Output |
|---|---|---|---|---|
| Swap Generator | Sonnet | User-facing | User types/scans a product | Personalized recipe + nutrition + ingredient analysis + "why this is better" |
| Recipe Iterator | Sonnet | User-facing | User clicks "make this dairy-free" etc. | Modified recipe variant, traceable to parent |
| Recipe Builder | Sonnet (+vision) | User-facing | User submits recipe text/photo | Structured recipe |
| Recommender | Haiku | Background (weekly/user) | Cron | Ranked "try this next" list with rationale lines |
| Classifier | Haiku | Background (event-driven) | Every feedback event | Tags, categories |
| Embedder | Voyage | Background (event-driven) | Profile/recipe save | Vector embeddings |

**Each agent has:**
- A prompt template owned in code (version-controlled)
- A model assignment (constant, tied to the agent)
- A strict output schema (enforced via tool use for Sonnet agents)
- Its own evaluation suite

**Prompt template structure** (all Sonnet agents follow this shape):
```
<role>...</role>
<user_profile>structured fields</user_profile>
<what_we_know_about_user>nightly summary, narrative</what_we_know_about_user>
<recent_wins>RAG-retrieved positive signals</recent_wins>
<recent_misses>RAG-retrieved negative signals</recent_misses>
<household_context>other people they cook for, if any</household_context>
<the_request>the actual user input</the_request>
<output_requirements>structured tool schema</output_requirements>
```

### 4.4 Personalization flow (Swap Generator example, step-by-step)

1. User submits swap query → `POST /api/swap` with `{ query: "Snickers" }`
2. Auth middleware extracts `userId` from Supabase session
3. Rate limiter checks free tier limits (5 + 1/day) or Champion status
4. Gateway loads in parallel:
   - User profile (structured, from `user_profiles`)
   - Nightly user summary (narrative paragraph, from `user_summaries`)
   - Recent swap history (last 10, structured)
   - Household profiles (for other people the user cooks for)
   - RAG: top 3 similar saved recipes (semantic), top 2 made-it events, top 1 not-for-me event
5. Gateway checks the `swaps` cache for an existing personalized variant for this `(user_id, product_id)` pair
   - If hit AND user's summary hasn't materially changed since: return cached
   - Otherwise: continue
6. Gateway composes the structured prompt
7. Gateway calls Sonnet with `generate_swap` tool definition
8. Sonnet returns structured swap via tool use
9. Gateway writes the swap to `swaps` table with user_id tag
10. Gateway logs the call to `agent_calls`
11. Gateway returns swap to API route
12. API route writes a `viewed_swap` event to `events`
13. Frontend renders with "Tuned for you" badge

**Target latency:** 2-4 seconds for first-time generation; sub-200ms for cached repeats.

### 4.5 RAG layer

**What gets embedded** (via Embedder agent, Voyage AI, stored in pgvector):

| Source | Content embedded | When |
|---|---|---|
| User profile | Natural-language summary of the user | On profile change |
| User nightly summary | The narrative paragraph itself | Nightly |
| Recipe box entries | Title + ingredients + technique summary | On save |
| Made-it events | Short summary | On event |
| Not-for-me events | Short summary | On event |
| Community photo captions | User's description | On upload |
| Canonical swaps | Title + recipe + narrative | On creation |
| Recipe library content | Title + ingredients + technique | On creation |

**What does NOT get embedded:** raw click events, brand directory entries, class/event listings, auth/billing data.

**Retrieval at request time:** scoped to the requesting user's `user_id` and `household_id`. Never cross-user retrieval. Filter results before passing to the LLM.

**Nightly user summary** (the secret weapon):
- Per active user (active = used the app in last 30 days)
- Generated by Haiku at 3am ET in batches
- Reads the last 30 days of events + saved recipes + made-it signals
- Outputs a short narrative paragraph (~150 words) describing who this user is becoming
- Replaces yesterday's summary in `user_summaries` table
- Embedded immediately after generation
- Injected into every Sonnet call thereafter

This is the single feature that does the most work to make the app feel like it knows you. Do not skip it. Do not defer it.

### 4.6 Background jobs (Inngest)

**Event-driven:**
- `recipe_save.embed` — embed a saved recipe for RAG
- `event.embed` — embed made-it / not-for-me events
- `chef_points.recompute` — recompute points and level
- `recipe_save.schedule_followup` — schedule "did you make it?" email for 3 days later
- `sensitive_action.audit_log` — write to audit table for export/deletion requests

**Scheduled (cron):**
- `nightly_user_summary` — 3am ET daily, batch all active users
- `weekly_recommender_refresh` — Sunday night, per active user
- `daily_cost_report` — 6am ET, surface LLM spend by agent
- `weekly_eval_run` — Saturday, run regression eval suite against frozen test cases

**Integrity/maintenance:**
- `profile_change.reembed` — when user updates profile, regenerate profile embedding
- `orphan_cleanup` — weekly, clean up variants with deleted parents
- `data_deletion_processor` — hourly, process pending deletion requests (24h soft delete)
- `backup_verification` — daily, verify Supabase backups restorable

**All jobs must be idempotent.** Re-running produces the same result.

---

## 5. Data Model (locked)

All in one Postgres database (Supabase). No data silos.

### 5.1 Tables (logical grouping)

**Identity:**
- `households` (id, name, primary_user_id, created_at)
- `users` (id, household_id, email, display_name, role, created_at)
- `auth_identities` (id, user_id, provider, provider_id, verified_email)

**Profile:**
- `user_profiles` (user_id, dietary_pattern[], allergies[], household_composition, top_goal, weeknight_time, skill_level, ... + JSON for flexible fields)
- `household_member_profiles` (id, household_id, name, age_range, allergies[], avoids[]) — the informational profiles
- `user_preferences` (user_id, likes[], dislikes[], dismissed_swaps[]) — learned signals

**Content:**
- `products` (id, name, brand, category, canonical_ingredients[], nutrition_facts JSON) — the "junk" side
- `swaps` (id, product_id, user_id NULLABLE, base_swap_id NULLABLE, recipe JSON, nutrition JSON, narrative, created_at) — canonical (user_id NULL) AND per-user personalized variants
- `recipes` (id, title, ingredients JSON, steps JSON, time_min, difficulty, meal_type, tags[]) — first-class recipes, not tied to a swap
- `recipe_variants` (id, parent_recipe_id, user_id, modification, recipe JSON, created_at)
- `brands` (id, name, category, description, certifications[])

**Behavioral:**
- `recipe_box_entries` (id, user_id, recipe_id NULLABLE, swap_id NULLABLE, variant_id NULLABLE, saved_at, notes TEXT, tags[])
- `events` (id, user_id, event_type, target_type, target_id, metadata JSON, created_at) — APPEND-ONLY
- `community_submissions` (id, user_id, recipe_id NULLABLE, photo_url, caption, created_at, status)

**Gamification:**
- `chef_points` (user_id, total_points, level, victory_tokens, last_updated)
- `class_reservations` (id, user_id, class_id, status, reserved_at)
- `event_rsvps` (id, user_id, event_id, status, rsvped_at)

**AI Memory:**
- `embeddings` (id, source_type, source_id, user_id, household_id, embedding VECTOR(1024), last_updated)
- `user_summaries` (user_id, summary_text, embedding VECTOR(1024), generated_at)

**Operations:**
- `agent_calls` (id, user_id, agent_name, model, prompt_version, prompt_hash, input_tokens, output_tokens, cost_usd, latency_ms, status, created_at) — every LLM call
- `subscriptions` (id, user_id, plan, stripe_customer_id, stripe_subscription_id, status, current_period_end)
- `notifications_queue` (id, user_id, type, payload, scheduled_for, status)

**Privacy:**
- `data_export_requests` (id, user_id, status, export_url, requested_at, expires_at)
- `data_deletion_requests` (id, user_id, status, requested_at, soft_delete_until, completed_at)
- `audit_log` (id, user_id, action, metadata JSON, created_at) — IMMUTABLE

### 5.2 Design principles
- **Household is top of the hierarchy.** Users belong to households even when only one user exists.
- **Events are append-only.** Never updated. Source of truth for behavior.
- **Soft references between content** (swaps → recipes, variants → parents). Use foreign keys but design for flexibility.
- **JSON columns for fast-changing fields** (profile attributes, recipe ingredients, nutrition). Structured columns for stable fields.
- **All user data scoped by user_id AND household_id** where possible (defense in depth for privacy).
- **RLS (Row Level Security) enabled on every user-data table.** No service-role queries from API routes unless absolutely necessary; rely on Supabase auth context.

---

## 6. Information Architecture & UX (locked)

### 6.1 Top-level surfaces
The Swap home is the universal entry point. Every user — anonymous, free, Champion — lands at `/`. Other surfaces orbit it:

| Surface | Route | Description |
|---|---|---|
| Swap home | `/` | Search bar, suggestions, recent swaps, today's tiles (default landing) |
| My Kitchen | `/kitchen` | Recipe box (logged-in only) |
| Discover | `/discover` | Recipe library + brands + community gallery |
| Community | `/community` | Photo upload, gallery, chef levels, Victory Tokens |
| Live | `/live` | Cooking classes + events |
| Settings | `/settings` | Profile, household, Champion, notifications, privacy |

Profile/avatar in top corner → settings dropdown. Anonymous users see a slimmed nav (no Kitchen, Community participation gated, no Live reservations).

### 6.2 Swap home for logged-in users (six zones, top to bottom)

1. **Search bar** — always at top, placeholder cycles through their recent swaps + suggestions
2. **Pick up where you left off** — surfaces only when relevant (e.g., recent swap they viewed but didn't save). One-tap status: made it / not yet / didn't make
3. **For you today** — 3-4 cards from Recommender agent, each with a one-line rationale ("Because you loved no-bake snacks: ...")
4. **Today's Top Swaps** — the existing tile grid (Snickers / Doritos / Big Mac / etc.), de-emphasized for logged-in users, items they've swapped get a checkmark badge
5. **A glance at My Kitchen** — horizontal scroll of recent saves, "See all in My Kitchen →"
6. **Community whisper** — small row of community photos from users in the same dietary pattern

Anonymous users see: search bar, suggestions, today's top swaps, and a "5 free swaps remaining" indicator. Zones 2, 3, 5, 6 simply don't render.

### 6.3 Swap result page

Current page structure stays (junk vs real comparison, full recipe, nutrition face-off, ingredient analysis, shop these ingredients). Evolutions for personalized users:

- **"Tuned for you" badge** near top: e.g., "Tuned for your gluten-free, no tree nuts profile" or "Built for a busy weeknight: 30 min, beginner-friendly"
- **"Why this is better" copy is personal** — aligned with the user's stated goal
- **Save to My Kitchen is the primary CTA** (instead of "Try Another Swap" for logged-in users)
- **Iteration row** — fixed buttons: Make dairy-free / Scale to 6 / Make faster (15 min) / Make kid-friendlier / Use what I have. Plus an open "Modify this recipe..." input.
- **"Made it" capture** — appears as a soft prompt after 3+ days for saved-but-unmarked recipes
- **Household awareness** — if a household member has an allergy, show "Safe for everyone in your household"

### 6.4 My Kitchen sections
1. **Header** — "Sarah's Kitchen · 24 recipes · 8 made it"
2. **Lately** — 5-6 most recently engaged recipes (horizontal scroll)
3. **Auto-organized collections** — smart sections that surface based on what's in the box: "Quick weeknights", "Make-ahead snacks", "Kid-friendly wins", "Haven't made yet", "Loved twice", "Iterated versions"
4. **Browse all** — flat grid, filterable by meal type, diet tag, time, plus search

**Recipe detail view:**
- Full recipe content (ingredients, steps, nutrition)
- Iteration buttons remain
- "Cook again" → logs another made-it event
- "Customize and save as new variant" → creates a new variant
- Free-text notes field (becomes part of RAG embedding)
- Soft "Did you make this?" prompt on aged saves (7+ days, no made-it signal)

### 6.5 Settings sections
1. **Your profile** — display name, email, the 5 quiz answers (editable), cooking skill/time, "Redo the full quiz" link
2. **Your household** — household name, primary member (you), "people you cook for" (informational profiles, add/edit/remove), each with name, age range, allergies, avoids
3. **Champion membership** — current plan, next renewal, payment (Stripe Customer Portal), Sponsor-a-Family status, upgrade/downgrade/cancel, receipts
4. **Notifications** — toggles for: follow-up emails, weekly recommendations digest, new class/event announcements, community activity, product updates
5. **Privacy & your data** — the plain-English statement + Download my data / Granular deletes / Delete my account / Kids data note
6. **Sign out & connected accounts** — linked auth methods, active sessions, sign-out

---

## 7. Phasing (locked)

### Phase 1 — Launch (this build)

**Everything below ships at launch. Do NOT pull Phase 2 items forward.**

- Auth: magic link + Google + Apple, account linking by verified email
- 5-question quiz at the save moment
- User profile editing
- Household entity + informational household member profiles
- All six agents implemented and routed through the LLM Gateway
- LLM Gateway with profile injection, RAG retrieval, observability logging, cost tracking, caching
- Nightly user summary job
- Per-user cached swap variants
- Swap home with all six zones (logged in) + slim anonymous version
- Swap result page with personalization, iteration row + open input, "made it" capture
- My Kitchen: Lately + auto-organized collections + browse all + notes + soft prompts
- Recipe iteration (Sonnet)
- Recipe builder (text + photo, Sonnet vision)
- Recipe library (ported from current site)
- Brands directory (ported)
- Community photo upload + gallery + chef levels + Victory Tokens (ported, tied to user profile)
- Cooking classes (reservation flow) + events (RSVP flow)
- Champion membership (Stripe): Monthly $9.99 / Annual $79 / Sponsor-a-Family +$9
- Champion vs Free gating per the existing matrix on /premium
- Privacy controls: export, granular deletes, full deletion with 24h soft-delete
- All observability infrastructure (Sentry, Helicone, agent_calls table, Inngest dashboard)
- One-click data export and deletion working end to end
- Email waitlist for the mobile app (carry forward from current site)

### Phase 2 — First follow-up (3-6 months post-launch)
- Mobile app (Expo / React Native) — see Section 9 for open questions
- Household member invites with own logins; opt-in shared recipe boxes
- Meal planning (Level C upgrade to the recipe box)
- Cross-recipe shopping list generation
- Public recipe URLs (share-to-non-user)
- Observability practice: 5 product health metrics dashboard, alerting tiers
- Real cost modeling against actual usage

### Phase 3 — Ecosystem (6-12 months)
- Brand certification program (Real Food Win Approved)
- Restaurant partnerships for Victory Token redemption
- Custom product audits for Champions
- "Use what's in my fridge" as a first-class surface

### Phase 4 — Scale (12+ months)
- Localization
- Additional ecosystem integrations
- International expansion

### Phase 5 — Ambient (longer horizon)
- Meta Glasses / wearable scan integration
- Voice-first UX

---

## 8. Cost Model (reference)

Per-call estimates (directional; revisit with real data post-launch):

| Agent | Cost per call | Notes |
|---|---|---|
| Swap Generator (first-time) | $0.02-0.05 | Cached repeats are $0 |
| Recipe Iterator | $0.02-0.05 | Per iteration |
| Recipe Builder | $0.05-0.10 | Vision adds cost |
| Recommender | $0.001 | Weekly per user |
| Classifier | $0.0005 | Per event |
| Nightly summary | $0.0005-0.001 | Per active user per night |
| Embeddings (Voyage) | fractions of cents | Per embedding |

**Rough monthly LLM cost per active user:** $0.50 – $2.00 depending on usage intensity.

**Champion unit economics** ($9.99/mo): roughly 74% contribution margin after Stripe + LLM costs at the heavy-user end.

**Areas to monitor:**
- Heavy free users who never convert (rate limits are the defense)
- Prompt injection / abuse attempts (cost-per-user monitoring catches these)
- Recipe iteration loops (>30 iterations without saving — worth instrumenting)

---

## 9. Open Questions for Mobile (deferred until Phase 2 build start)

These are NOT part of Phase 1 but captured for continuity:

- **Mobile v1 scope** — recommended: scanner + swap + recipe box + community uploads + auth/profile. Recipe iteration, recipe builder, classes, events deferred to mobile v2.
- **Barcode resolution strategy** — recommended hybrid: Open Food Facts primary + LLM fallback + cache resolutions in our own `products` table.

---

## 10. What I want from you (Claude Code)

**Do not write code in your first response.** Instead:

### 10.1 Read this entire spec.

### 10.2 Produce a comprehensive build plan with these sections:

1. **Project structure** — Monorepo? Single Next.js app? Separate packages for shared types? Justify the choice given that Phase 2 mobile will share types, business logic, and the LLM Gateway with web.

2. **Module breakdown** — How would you organize the code? At minimum, propose top-level boundaries for:
   - The LLM Gateway service (this is the most important module)
   - The six agent implementations
   - The API routes (Next.js App Router)
   - The frontend (route groups, shared components)
   - The Supabase schema and migrations
   - The Inngest job definitions
   - Shared types
   - The eval suite

3. **Build order / dependency milestones** — A clear ordered plan. The product cannot be partially shipped. But the BUILD has dependencies. What ships first, second, third? My intuition is roughly:
   - Milestone 1: Stack setup, Supabase schema, auth, base shell
   - Milestone 2: LLM Gateway skeleton + Swap Generator (the smallest end-to-end personalized swap)
   - Milestone 3: Profile + onboarding + the "first magic moment" loop
   - Milestone 4: Recipe box + iteration
   - Milestone 5: Recommender + nightly summary + RAG layer
   - Milestone 6: Champion membership + Stripe
   - Milestone 7: Community, classes, events, brands (porting from current site)
   - Milestone 8: Privacy controls + data export/deletion
   - Milestone 9: Observability, evals, polish
   - Milestone 10: Cutover preparation
   But review this and propose what makes more sense given the dependencies.

4. **Clarifying questions** — Before code is written, what do you need from me? Examples:
   - Branding assets (logos, fonts) — do we have a design system or are we building one?
   - Existing content (recipes, brands, classes, events) — is there a way to scrape/export from the current site?
   - Anthropic API access — is the account set up, what tier?
   - Supabase project — does one exist or do we create fresh?
   - Stripe account — exists? In what state?
   - Domain/DNS — what's the cutover process?
   - Anything else you flag

5. **Open assumptions to validate** — Things you're assuming based on the spec that I should confirm before you proceed.

6. **Risks and watch-items** — What parts of this spec concern you, where the spec is underspecified, or where you'd want to revisit a decision once you start building.

7. **What you'd defer to a follow-up plan** — If the spec is too ambitious for a single planning pass, what would you split out into its own design doc?

### 10.3 Code style and quality expectations (when we get there)

When we move to implementation:
- Strict TypeScript, no `any` without a comment explaining why
- Zod (or similar) for runtime validation of every LLM output, every API boundary, every external input
- Tests for the LLM Gateway behavior (mocked Anthropic responses) and for critical business logic
- Each agent's prompt template is its own file; prompts are version-controlled with a `prompt_version` constant
- Every PR includes any necessary migrations; never edit applied migrations
- No `console.log` in production code paths; use the logging layer
- Privacy-sensitive operations (export, delete, audit log) get their own integration tests

---

## 11. Constraints worth restating

- **Do not start the build by calling Anthropic from feature code.** The LLM Gateway must exist before any agent does.
- **Do not skip the nightly user summary.** It is the single feature that makes personalization feel real.
- **Do not let user data leave the stack.** No external analytics, no shipping behavioral data to third-party services, no separate vector DB.
- **Do not pull Phase 2 features into Phase 1.** The Phase 1 list is already substantial.
- **Do not use passwords.** Magic link + Google + Apple only.
- **Do not skip the "Tuned for you" badge.** It is how the user FEELS the personalization.
- **Do not build a separate vector database.** pgvector in Supabase is the answer.

---

## 12. What success looks like

By the end of Milestone 1, a developer can log in, complete the quiz, see a generic swap, save it, see it in their Kitchen.

By the end of Milestone 5, the same developer's third swap visibly reflects what they've cooked. The Recommender surfaces a suggestion with a rationale that quotes the user's own behavior. The nightly summary contains accurate, specific observations about who the user is becoming.

By the end of Milestone 10, the new app is running at realfoodwin.org, the Replit app is sunset, and a new visitor cannot tell they're using a different system — they just notice everything feels tuned to them.

---

**End of specification. Please produce the build plan now.**
