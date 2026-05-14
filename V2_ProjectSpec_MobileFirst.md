# Real Food Win — Build Specification (Mobile-First)

> **For Claude Code:** This is the build specification for the next version of realfoodwin.org. Read this entire document, then **plan** the build — do not write code yet. Produce a phased implementation plan with milestones, file/module organization, dependency order, and a list of clarifying questions before any code is written. Treat every decision below as **locked unless explicitly marked as open**. Treat every requirement as a hard constraint.
>
> **IMPORTANT — this is a mobile-first product.** iOS, Android, and Web ship together at launch. Mobile is the primary surface and the flagship experience. Web is intentionally lighter — see Section 2 for the platform split.

---

## 0. Context

Real Food Win (realfoodwin.org) is a live web product today: a stateless lookup tool that lets anyone type a junk-food product and get a real-food alternative with a recipe, nutrition comparison, and ingredient analysis. It is hosted on Replit and has a polished UI, recipe library, brands directory, live cooking classes, events, and a community gallery.

We are **rebuilding it from scratch** as a personalized, logged-in, AI-powered food coach — and we are launching on **iOS, Android, and Web simultaneously**, with mobile as the primary surface. Same brand, same mission, fundamentally different product.

### The mission
> "Replace ultra-processed food with real food, family by family."

### The strategic wedge (versus Yuka, the closest analog)
Yuka is a mobile-first database with a scoring algorithm. Real Food Win is a mobile-first AI coach that learns each user and meets them in the kitchen, not the aisle. Everything downstream of the scan — recipes, iteration, recipe box, personalization — is uncontested ground.

### Why mobile-first
The food-decoding category (Yuka, Fooducate, Bobby Approved, Open Food Facts) is mobile-first because the user need is mobile-first: people scan products in stores, not at desks. The native barcode scanner is table-stakes. The personalization layer — what makes Real Food Win different — is most valuable in the moment of decision, which happens with a phone in hand.

---

## 1. Stack (locked)

| Layer | Choice |
|---|---|
| Mobile apps (iOS + Android) | Expo / React Native, TypeScript |
| Mobile auth (native Sign in with Apple, Google) | Expo AuthSession + Apple Authentication / Google Sign-In |
| Mobile in-app purchases | RevenueCat (wraps StoreKit + Google Play Billing) |
| Mobile barcode scanner | expo-camera + expo-barcode-scanner |
| Mobile push notifications | Expo Notifications |
| Web app | Next.js (App Router) on Vercel |
| Language | TypeScript end-to-end (shared types between mobile and web) |
| AI — user-facing | Anthropic Claude Sonnet |
| AI — background | Anthropic Claude Haiku |
| Embeddings | Voyage AI |
| Database | Supabase (PostgreSQL) |
| Web auth | Supabase Auth (magic link, Google, Apple) |
| Storage | Supabase Storage |
| Vectors | pgvector inside Supabase Postgres (NOT a separate vector DB) |
| Background jobs | Inngest |
| Email | Resend |
| Web billing | Stripe (for web-initiated subscriptions only) |
| LLM observability | Helicone |
| App observability | Sentry (web + mobile) + Vercel Analytics |
| Barcode product database | Open Food Facts (primary) + Sonnet fallback + own-DB cache |

**Non-negotiable principles:**
- User data lives in Supabase. No copies to other vector DBs, analytics warehouses, or third-party services.
- The mobile apps and web app speak to the same backend (the LLM Gateway and the data layer). Shared types live in a shared package.
- Subscription state is unified across Apple IAP / Google Play / Stripe in our `subscriptions` table; RevenueCat is the source of truth for mobile.

---

## 2. The Platform Split (locked)

**Mobile is the primary surface. Web is a focused subset.** Both ship at launch.

### Mobile (iOS + Android) — full daily flow

Mobile is where users do the actual work:
- Barcode scanning (the hero feature)
- Text-based swap search
- The 5-question quiz at the save moment
- Profile and household management
- Swap result page with iteration
- My Kitchen (recipe box, full functionality)
- Made-it capture
- Push notifications (made-it follow-ups, weekly recommendations)
- Champion subscription via Apple IAP / Google Play Billing (RevenueCat)

### Web — anonymous demo + companion experience

Web is intentionally lighter. Its jobs:
- **Anonymous swap demo** — the existing text-search experience, rate-limited (5 + 1/day), drives mobile installs at the value moment
- **Marketing surfaces** — homepage, About, Premium, mission/brand pages
- **SEO content** — recipe library pages, brand directory, swap result pages (the `/swap/[product]` URLs that are already indexed)
- **Account / billing / privacy controls** — desktop-friendly surfaces for managing the account, viewing subscription, exporting data, deleting account
- **Read-only recipe box** — logged-in users can browse what's in their Kitchen on a laptop, but the iteration and made-it flows are mobile-only
- **Stripe-powered Champion signup** — yes, this is intentional: web signup avoids Apple's 30% IAP fee

### What's NOT on web at launch
- No barcode scanner on web (mobile-native experience; building it on web would be a worse version)
- No recipe iteration on web (mobile is the daily flow)
- No "made it" capture on web (mobile push notification follow-up)
- No community photo upload on web (mobile camera flow)

### Architecture implication
The backend (LLM Gateway, agents, data layer, API routes) is shared. The UI code is not. Mobile uses Expo Router and React Native primitives; web uses Next.js App Router and standard React DOM. Shared between them: types, Zod schemas, the API client SDK, and any pure-TypeScript business logic.

---

## 3. Migration approach (locked)

**Greenfield rebuild, full replacement of the existing Replit web app.** The current Replit app will be sunset at cutover. The new web app launches at `realfoodwin.org` (root domain). The mobile apps launch on the App Store and Google Play.

No data migration from the current Replit app is needed — content (brands, recipes, classes, events) will be re-seeded in the new system. The existing **mobile app waitlist** is the one piece of user data that must be carried forward.

Cutover requirements:
- DNS swap from Replit to Vercel
- 301 redirects from indexed swap URLs (`/swap/[product]`) to new equivalents
- Waitlist email migration: export emails from current storage → import into a `mobile_app_waitlist` table in Supabase → automated launch announcement email via Resend
- Mobile apps available on both stores before public web cutover
- Public launch when all three platforms are live and stable

---

## 4. The Seven Product Decisions (locked)

These are the foundation. Everything else must support them.

### 4.1 Onboarding — Fast-start 5-question quiz at the save moment

Anonymous users get 5 free swaps + 1/day (on either platform — counted by user identifier, IP, or device on anonymous). The signup gate appears when they try to save, upload, iterate, or hit the swap limit. Sign-in → 5-question quiz → personalized regeneration of their original swap.

**The 5 questions, in order:**
1. **Dietary pattern** (multi-select, "none" valid): None, Gluten-free, Dairy-free, Vegetarian, Vegan, Paleo, Keto, Low-sugar
2. **Allergies & hard avoids** (multi-select, REQUIRED, cannot skip): Peanut, Tree nuts, Dairy, Eggs, Soy, Shellfish, Gluten, Other (free text)
3. **Who you're cooking for**: Just me / Me + partner / Family with kids. If kids: how many + rough age range (toddler/kid/teen)
4. **Top goal** (single-select): More energy / Lose weight / Feed kids better / Reduce inflammation / Get off ultra-processed food / Just curious
5. **Cooking reality**: Time on weeknight (15 / 30 / 45+ min) + Skill level (beginner / comfortable / confident)

**UX rules:**
- One question per screen
- Conversational tone in copy ("What's your eating style?" not "Select dietary preferences")
- All questions skippable EXCEPT allergies (safety)
- Resumable mid-flow (save partial answers, pick up where left off)
- Accessible from settings to re-do anytime
- Quiz works on both mobile and web; profile is shared across platforms

### 4.2 First magic moment — Profile-aware from the first personalized swap

The very first swap the user sees after completing the quiz **must** reflect their profile. On mobile: scan Snickers anonymously → hit "Save" → sign up → quiz → swap regenerates as personalized Snickers swap with a "Tuned for you" badge. Same flow on web (typing instead of scanning).

This is the highest-stakes UX moment in the product.

### 4.3 Feedback loop — Mixed: passive + two light active touchpoints

- **Passive signals** (default, silent): save, view, copy, regenerate, return visit, share
- **Active touchpoint #1**: "Save to My Kitchen" — the act of saving IS the positive signal. No explicit rating.
- **Active touchpoint #2**: A push notification 3 days after saving asking "Did you make [recipe]? Made it & loved it / Made it, not for me / Haven't made it yet". On web, surfaced as a soft in-app prompt instead of a push.
- **Community photo upload** is the highest-value positive signal (Phase 2 — mobile camera makes it frictionless)

NOT building: per-recipe star ratings, written reviews, detailed surveys.

### 4.4 Recipe box — Evolving cookbook, modeled for meal planning later

"My Kitchen" is NOT a bookmark folder. It is:
- Saved swaps and recipes
- Auto-organized (by meal type, recency, status — smart collections)
- Iterable on mobile ("make this dairy-free", "scale to 6", "make it 20 min faster") — iteration produces a variant tied to the parent
- Notes-capable (free-text user notes per recipe, which feed RAG)
- Designed so weekly meal planning (Phase 2) drops in without a rewrite

On web at launch: read-only browsing of the Kitchen. Iteration and notes are mobile-only.

### 4.5 Household model — Household entity + per-user recipe boxes

- `households` is a top-level entity in the data model from day one
- Each user belongs to exactly one household
- In v1, ONLY the primary user has a login. Other household members exist as **informational profiles** ("my daughter, 8, tree nut allergy") with no auth.
- The agent uses informational profiles when generating swaps
- In Phase 2, informational profiles can be **upgraded** to full logins via an invite flow — no data migration required
- Recipe boxes stay per-user; sharing across the household is a Phase 2 opt-in

### 4.6 Auth — Magic link + Google + Apple. No passwords.

- **Mobile:** Continue with Apple (first; required for App Store on iOS) / Continue with Google / Continue with Email (magic link)
- **Web:** Continue with Google / Continue with Apple / Continue with Email (magic link)
- No password flows. No reset flows.
- Account linking by verified email — same email across providers resolves to the SAME account.
- Apple Sign-In is required by Apple's App Store guidelines because we also offer Google Sign-In on iOS.
- A user can sign in on web AND mobile with the same account; sessions are independent per device.

### 4.7 Privacy posture — Strong, user-aligned, designed for stronger later

**Brand commitment (surfaced in product, not just in policy):**
> "Real Food Win never sells, shares, or monetizes your data. We use what you tell us — and what you do here — only to make this app work better for you. Nothing about you leaves this platform."

**User-facing controls (in Settings on both platforms; full controls on web):**
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
- No advertising-related tracking on either platform
- No third-party analytics that sees user data
- No selling, sharing, or monetizing personal data — including to brands in our directory
- App Tracking Transparency (ATT) prompt on iOS: we say "Real Food Win does not track you across apps and websites" because it's true

---

## 5. Architecture (locked)

### 5.1 Five layers + sidecars

```
┌────────────────────────────────────────────────────────────────┐
│ LAYER 1: USER SURFACES                                          │
│  iOS App (Expo) | Android App (Expo) | Web (Next.js on Vercel) │
└────────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────────┐
│ LAYER 2: SHARED CLIENT SDK (typed API client + types)          │
│  Generated from API routes, shared via packages/api-client     │
└────────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────────┐
│ LAYER 3: API + LLM GATEWAY (Vercel serverless functions)        │
│  Next.js App Router /api routes for both clients               │
│  Internal LLM Gateway service inside the API                   │
│  Profile injection | RAG retrieval | Logging & cost | Caching  │
└────────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────────┐
│ LAYER 4: SIX SPECIALIZED AI AGENTS                              │
│  Sonnet:    Swap Generator | Recipe Iterator | Recipe Builder  │
│  Haiku:     Recommender   | Classifier                         │
│  Voyage:    Embedder                                            │
└────────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────────┐
│ LAYER 5: DATA FOUNDATION (Supabase)                             │
│  Auth | Postgres | pgvector | Storage                          │
└────────────────────────────────────────────────────────────────┘

Sidecars: Inngest, Resend, Helicone, Sentry, Stripe, RevenueCat,
          Open Food Facts (external API)
```

### 5.2 The LLM Gateway — non-negotiable

**No application code calls Anthropic directly.** Every Sonnet/Haiku call routes through a single internal service (the Gateway), which lives inside the Next.js API layer. Both mobile clients and the web client call the same `/api/*` endpoints; the Gateway is what those endpoints invoke.

The Gateway is responsible for:
- Loading the user's structured profile and injecting it into every Sonnet call
- Loading the user's nightly summary and injecting it into every Sonnet call
- Performing RAG retrieval (pgvector queries) and injecting relevant context
- Composing the final prompt from the agent's template + context bundle
- Calling Anthropic with tool-use enabled for structured outputs
- Logging every call to the `agent_calls` table
- Pushing the same data to Helicone for product analytics
- Cost tracking per user, per agent, per day
- Caching personalized swap variants in the `swaps` table
- Retries and graceful degradation on Anthropic errors

The Gateway API surface (internal):
```typescript
gateway.run({
  agent: 'swap_generator' | 'recipe_iterator' | 'recipe_builder' | 'recommender' | 'classifier',
  userId: string,
  input: AgentInput,
  clientPlatform: 'ios' | 'android' | 'web',
}): Promise<AgentOutput>
```

### 5.3 The Six Agents

| Agent | Model | Tier | Trigger | Output |
|---|---|---|---|---|
| Swap Generator | Sonnet | User-facing | User scans/types a product | Personalized recipe + nutrition + ingredient analysis + "why this is better" |
| Recipe Iterator | Sonnet | User-facing (mobile only at launch) | User clicks "make this dairy-free" etc. | Modified recipe variant, traceable to parent |
| Recipe Builder | Sonnet (+vision) | User-facing (Phase 2 mobile) | User submits recipe text/photo | Structured recipe |
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
<the_request>scanned barcode, typed query, or recipe to iterate</the_request>
<output_requirements>structured tool schema</output_requirements>
```

### 5.4 Personalization flow (Swap Generator, mobile scanner version)

1. User opens mobile app, taps scanner icon → camera opens
2. User points camera at Snickers barcode → expo-barcode-scanner returns barcode string
3. Mobile app calls `POST /api/scan` with `{ barcode: "012345678905" }`
4. Auth middleware extracts `userId` from JWT
5. **Barcode Resolution service** runs:
   - Check `products` table for cached product matching this barcode → if found, return product_id
   - Else query Open Food Facts API → if found, cache in `products`, return product_id
   - Else call Sonnet with the barcode and any partial info → if confident, cache as low-confidence product, return product_id
   - Else return "couldn't identify" error → mobile app shows manual entry fallback
6. Rate limiter checks free tier limits or Champion status
7. Gateway loads in parallel:
   - User profile, nightly summary, recent history, household profiles
   - RAG: top 3 similar saved recipes, top 2 made-it events, top 1 not-for-me event
8. Gateway checks `swaps` cache for an existing personalized variant for `(user_id, product_id)`
   - If hit AND summary unchanged: return cached
   - Otherwise: continue
9. Gateway composes structured prompt
10. Gateway calls Sonnet with `generate_swap` tool definition
11. Sonnet returns structured swap via tool use
12. Gateway writes swap to `swaps` table tagged to user
13. Gateway logs call to `agent_calls`
14. API route writes `viewed_swap` event
15. Mobile app renders with "Tuned for you" badge

**Target latency:** 3-5 seconds for first-time scan-to-result; sub-200ms for cached repeats.

### 5.5 Barcode Resolution Service (Phase 1 — new architectural surface)

Sits between the mobile scanner and the Swap Generator. Resolves a barcode number to a product (name, brand, category, ingredients, nutrition).

**Implementation:**
- New service in API layer: `services/barcode-resolution/`
- Three resolvers in order: `cache` (our DB) → `open-food-facts` → `sonnet-fallback`
- Each resolver returns either a product or null; first non-null wins
- On Open Food Facts success: write to `products` with source = `open_food_facts`
- On Sonnet fallback: write to `products` with source = `sonnet`, confidence flag for review
- On all failures: API returns error; mobile shows "Couldn't recognize that — type it in?"

**Caching:**
- Every resolution cached in `products` table
- Open Food Facts data refreshed weekly via Inngest job
- Sonnet-resolved products flagged for human review (Phase 2 admin dashboard)

**Rate limits:**
- Open Food Facts: free, no hard limit but be polite
- Sonnet fallback: limited to one call per unique unknown barcode per day per user

### 5.6 RAG layer

**What gets embedded** (via Embedder agent, Voyage AI, stored in pgvector):

| Source | Content embedded | When |
|---|---|---|
| User profile | Natural-language summary of the user | On profile change |
| User nightly summary | The narrative paragraph itself | Nightly |
| Recipe box entries | Title + ingredients + technique summary | On save |
| Made-it events | Short summary | On event |
| Not-for-me events | Short summary | On event |
| Community photo captions (Phase 2) | User's description | On upload |
| Canonical swaps | Title + recipe + narrative | On creation |
| Recipe library content | Title + ingredients + technique | On creation |

**Retrieval at request time:** scoped to the requesting user's `user_id` and `household_id`. Never cross-user retrieval.

**Nightly user summary** (the secret weapon):
- Per active user (active = used app in last 30 days, on either platform)
- Generated by Haiku at 3am ET in batches
- Reads last 30 days of events + saved recipes + made-it signals
- Outputs ~150-word narrative paragraph
- Replaces yesterday's summary in `user_summaries`
- Embedded immediately, injected into every Sonnet call

This is the single feature that does the most work to make the app feel like it knows you. Do not skip it.

### 5.7 Background jobs (Inngest)

**Event-driven:**
- `recipe_save.embed` — embed a saved recipe for RAG
- `event.embed` — embed made-it / not-for-me events
- `chef_points.recompute` — recompute points and level
- `recipe_save.schedule_followup` — schedule 3-day made-it push notification
- `sensitive_action.audit_log` — write to audit table for export/deletion requests
- `subscription_state.sync` — sync from RevenueCat or Stripe webhooks
- `barcode.cache_refresh` — refresh cached Open Food Facts data

**Scheduled (cron):**
- `nightly_user_summary` — 3am ET daily, batch all active users
- `weekly_recommender_refresh` — Sunday night, per active user
- `daily_cost_report` — 6am ET, surface LLM spend by agent
- `weekly_eval_run` — Saturday, run regression eval suite
- `weekly_open_food_facts_refresh` — Saturday, refresh cached subset

**Integrity/maintenance:**
- `profile_change.reembed` — regenerate embedding when profile changes
- `orphan_cleanup` — weekly, clean orphaned variants
- `data_deletion_processor` — hourly, process deletion requests (24h soft delete)
- `backup_verification` — daily, verify Supabase backups

**Push notification delivery:**
- Scheduled via Inngest, sent via Expo Notifications
- Respect user notification preferences

**All jobs must be idempotent.**

### 5.8 Subscription state and billing

**Three billing paths, one source of truth:**

1. **iOS users:** Apple In-App Purchase via RevenueCat SDK
2. **Android users:** Google Play Billing via RevenueCat SDK
3. **Web users:** Stripe Checkout, Stripe webhook to our backend

**Source of truth:** our `subscriptions` table, written by webhooks. All clients query our backend for "is this user a Champion?"

**Pricing:**
- Web (Stripe): Monthly $9.99 / Annual $79 / Sponsor-a-Family +$9
- Mobile IAP: Same sticker price, but Apple/Google take 30% (15% after year one)
- Plan for mobile IAP from day one — some users will not switch to web for billing

**Margin nudge:** Post-install email and renewal-time prompt suggest "Manage your subscription on the web" — saves users nothing, saves us 30%. Many apps do this. Plan for it.

---

## 6. Data Model (locked)

All in one Postgres database (Supabase). No data silos.

### 6.1 Tables (logical grouping)

**Identity:**
- `households` (id, name, primary_user_id, created_at)
- `users` (id, household_id, email, display_name, role, created_at)
- `auth_identities` (id, user_id, provider, provider_id, verified_email)
- `mobile_app_waitlist` (id, email, source, created_at, notified_at)

**Profile:**
- `user_profiles` (user_id, dietary_pattern[], allergies[], household_composition, top_goal, weeknight_time, skill_level, ... + JSON for flexible fields)
- `household_member_profiles` (id, household_id, name, age_range, allergies[], avoids[])
- `user_preferences` (user_id, likes[], dislikes[], dismissed_swaps[])

**Content:**
- `products` (id, barcode UNIQUE NULLABLE, name, brand, category, canonical_ingredients[], nutrition_facts JSON, source, confidence, last_refreshed)
- `swaps` (id, product_id, user_id NULLABLE, base_swap_id NULLABLE, recipe JSON, nutrition JSON, narrative, created_at)
- `recipes` (id, title, ingredients JSON, steps JSON, time_min, difficulty, meal_type, tags[])
- `recipe_variants` (id, parent_recipe_id, user_id, modification, recipe JSON, created_at)
- `brands` (id, name, category, description, certifications[])

**Behavioral:**
- `recipe_box_entries` (id, user_id, recipe_id NULLABLE, swap_id NULLABLE, variant_id NULLABLE, saved_at, notes TEXT, tags[])
- `events` (id, user_id, event_type, target_type, target_id, metadata JSON, client_platform, created_at) — APPEND-ONLY
- `community_submissions` (id, user_id, recipe_id NULLABLE, photo_url, caption, created_at, status)

**Gamification:**
- `chef_points` (user_id, total_points, level, victory_tokens, last_updated)
- `class_reservations` (id, user_id, class_id, status, reserved_at)
- `event_rsvps` (id, user_id, event_id, status, rsvped_at)

**AI Memory:**
- `embeddings` (id, source_type, source_id, user_id, household_id, embedding VECTOR(1024), last_updated)
- `user_summaries` (user_id, summary_text, embedding VECTOR(1024), generated_at)

**Operations:**
- `agent_calls` (id, user_id, agent_name, model, prompt_version, prompt_hash, input_tokens, output_tokens, cost_usd, latency_ms, status, client_platform, created_at)
- `subscriptions` (id, user_id, plan, source, stripe_customer_id NULLABLE, stripe_subscription_id NULLABLE, revenuecat_app_user_id NULLABLE, status, current_period_end)
- `notifications_queue` (id, user_id, type, channel, payload, scheduled_for, status) — channel is 'email' | 'push' | 'in_app'
- `device_tokens` (id, user_id, platform, expo_push_token, last_seen)

**Privacy:**
- `data_export_requests` (id, user_id, status, export_url, requested_at, expires_at)
- `data_deletion_requests` (id, user_id, status, requested_at, soft_delete_until, completed_at)
- `audit_log` (id, user_id, action, metadata JSON, created_at) — IMMUTABLE

### 6.2 Design principles
- **Household is top of the hierarchy.** Users belong to households even when only one user exists.
- **Events are append-only.** Now includes `client_platform`.
- **Soft references between content** (swaps → recipes, variants → parents).
- **JSON columns for fast-changing fields**; structured columns for stable fields.
- **All user data scoped by user_id AND household_id** where possible.
- **RLS (Row Level Security) enabled on every user-data table.**
- **Subscription source is explicit.** A user with both iOS and web Stripe subscriptions is theoretically possible.
- **Mobile waitlist is migrated, not lost.**

---

## 7. Information Architecture & UX (locked)

### 7.1 Mobile (iOS + Android) — primary surface

Bottom-tab navigation with the Swap home as default. Five tabs:

| Tab | Description |
|---|---|
| **Swap** | Scanner button + search bar + recent swaps + "For you today" (when populated) |
| **Kitchen** | Recipe box, full functionality |
| **Discover** | Recipe library, brands |
| **Community** | Photo gallery, chef levels, Victory Tokens (Phase 2: mobile upload) |
| **Profile** | Account, household, Champion, notifications, privacy, sign-out |

**Swap is the default tab.** Scanner button is the largest affordance.

### 7.2 Mobile Swap home

For logged-in users:
1. **Big scanner button:** "Tap to scan a product"
2. **Text search:** "Or type a product"
3. **Pick up where you left off** — recent swaps without engagement
4. **For you today** — 3-4 personalized cards from Recommender
5. **Recent swaps** — horizontal scroll
6. **A glance at My Kitchen** — link to full Kitchen

For anonymous users: scanner button, text search, suggestions, 5-free-swaps indicator.

### 7.3 Mobile scanner UX

- Tap scanner → camera opens with viewfinder overlay
- Live barcode detection
- On successful read: haptic feedback + brief "Reading..." state
- On resolution success: navigate to swap result
- On resolution failure: bottom sheet "Couldn't recognize that — type it in?" with text input
- "Cancel" returns to Swap home

### 7.4 Mobile swap result page

- **"Tuned for you" badge** near top
- **Save to My Kitchen** as primary CTA — full-width button at bottom
- **Iteration row** — horizontal scrolling chips: Make dairy-free / Scale to 6 / Make faster / Make kid-friendlier / Use what I have / Modify...
- **"Modify..." opens an input sheet** for free-text iteration requests
- **Pull-to-refresh regenerates** (uses one free swap)
- **Share button** — native share sheet, deep link

### 7.5 Mobile Kitchen

- Header with user/household name + counts
- "Lately" horizontal scroll
- Auto-organized collection sections
- "Browse all" with sticky filter bar
- Recipe detail: ingredients, steps, nutrition, iteration buttons, notes field, "Cook again," "Customize and save as new variant"
- Made-it capture as soft prompt on aged saves

### 7.6 Mobile Profile / Settings

Same six sections as web (your profile, household, Champion, notifications, privacy, sign-out), mobile-native styling. Champion management opens RevenueCat paywall UI or routes to web (30% savings nudge).

### 7.7 Web — companion surface

Top nav:

| Surface | Route | Description |
|---|---|---|
| Swap | `/` | Anonymous swap demo (text search only) |
| Recipes | `/recipes` | Recipe library (SEO-critical) |
| Brands | `/brands` | Brand directory |
| About | `/about` | Mission, story |
| Premium | `/premium` | Champion signup (Stripe) |
| Account | `/account` | Logged-in account management |

For logged-in users:
- **Swap home** still works (text search, no scanner)
- **Read-only Kitchen** at `/kitchen` — browse only; iteration/notes/made-it are mobile-only
- **Settings** at `/settings` — full controls, especially privacy export/delete
- **Champion signup/management** — Stripe-powered

### 7.8 Cross-platform sign-in

A user can:
- Sign up on web → use web demo → install mobile app → sign in with same identity → profile and Kitchen carry over
- Sign up on mobile → manage subscription on web (30% savings) → never touch web otherwise
- Sign up on either, get the same account, same data

---

## 8. Build Order / Milestones (locked direction; Claude Code refines)

Web ships before mobile in calendar time because the backend serves both and web is the simpler client. Mobile is the flagship; both ship at launch.

| Milestone | What ships | Why this order |
|---|---|---|
| **1. Foundations** | Monorepo, Supabase schema with RLS, auth backend, shared TypeScript packages, CI/CD | All clients depend on this |
| **2. LLM Gateway + Swap Generator** | Smallest end-to-end personalized swap, callable via API | Single most important infrastructure |
| **3. Barcode Resolution backend** | Open Food Facts integration, Sonnet fallback, product cache, API endpoint | Required before mobile scanner |
| **4. Profile + onboarding API** | Quiz endpoint, profile editing, household management | Needed by both clients |
| **5. Web shell** | Web app: anonymous swap, marketing, auth, profile, Stripe billing | First user-visible artifact; locks in API |
| **6. Mobile shell** | iOS + Android (Expo): auth flows, profile, quiz, base navigation | Two platforms, one codebase |
| **7. Mobile core flow** | Scanner + swap result + iteration + Kitchen | Mobile product end-to-end |
| **8. Recommender + nightly summary + RAG** | Personalization layer | Heaviest backend; ships once before either client really benefits |
| **9. Mobile billing (RevenueCat)** | In-app purchase for Champion | Required before App Store submission |
| **10. Privacy controls + observability + evals** | Export, delete, audit, Sentry, Helicone, agent_calls populated | Polish before launch |
| **11. App Store + Play Store submission** | Marketing copy, screenshots, review cycle. **2 WEEKS BUFFER for rejections.** | Apple/Google review unpredictable |
| **12. Cutover** | DNS swap, sunset Replit, public launch, mobile waitlist notification | The final move |

**Claude Code may refine this sequence.** Specifically: where to insert content porting, how to parallelize mobile + web work after the backend, when to begin App Store Connect setup (suggest: in parallel with milestone 6).

---

## 9. Phasing

### Phase 1 — Launch (this build)

**Mobile (iOS + Android):**
- Auth (Apple, Google, magic link) with account linking by verified email
- 5-question quiz at the save moment
- Household entity + informational household member profiles
- Barcode scanner with Open Food Facts + Sonnet fallback
- Text-search swap
- Swap result page with personalization, iteration row + open input
- Recipe iteration (Sonnet)
- My Kitchen: Lately + auto-organized collections + browse all + notes + made-it prompts
- Made-it capture via push notification (3-day delayed)
- Push notifications via Expo (with user preferences)
- Champion membership via Apple IAP / Google Play Billing (RevenueCat)
- Privacy controls (export, granular deletes, full deletion with 24h soft-delete)
- Sentry mobile + structured event logging

**Web:**
- Auth (magic link, Google, Apple)
- Anonymous swap demo (text search, 5+1/day rate limit)
- Marketing surfaces (homepage, About, Premium)
- Recipe library (ported from current site, SEO-optimized)
- Brand directory (ported)
- Read-only Kitchen for logged-in users
- Full settings UI including privacy controls
- Champion membership via Stripe (Monthly $9.99 / Annual $79 / Sponsor-a-Family +$9)
- Mobile app waitlist (carry forward from current site)

**Backend (shared):**
- LLM Gateway with five Phase-1 agents (Swap, Iterator, Recommender, Classifier, Embedder; Builder is mobile Phase 2)
- Nightly user summary job
- Per-user cached swap variants
- Barcode Resolution service
- All observability infrastructure (Sentry, Helicone, agent_calls)
- Inngest job orchestration
- Email via Resend
- Subscription state unification across RevenueCat and Stripe

### Phase 2 — First follow-up (3-6 months post-launch)

**Mobile:**
- Recipe Builder (camera + text) — Sonnet vision
- Community photo upload from mobile camera
- Recommender's "For you today" surface (data needs to exist first)
- Live cooking classes (reservation flow)
- Events RSVPs

**Cross-platform:**
- Household member invites with own logins; opt-in shared recipe boxes
- Meal planning (Level C upgrade to recipe box)
- Cross-recipe shopping list generation
- Public recipe URLs (share-to-non-user, deep link to mobile)
- Observability practice: dashboards, alerting tiers
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

## 10. Cost Model (reference)

**Per-call LLM estimates (directional):**

| Agent | Cost per call | Notes |
|---|---|---|
| Swap Generator (first-time) | $0.02-0.05 | Cached repeats are $0 |
| Recipe Iterator | $0.02-0.05 | Per iteration |
| Recipe Builder (Phase 2) | $0.05-0.10 | Vision adds cost |
| Recommender | $0.001 | Weekly per user |
| Classifier | $0.0005 | Per event |
| Nightly summary | $0.0005-0.001 | Per active user per night |
| Sonnet barcode fallback | $0.005-0.01 | Only when Open Food Facts misses |
| Embeddings (Voyage) | fractions of cents | Per embedding |

**Rough monthly LLM cost per active user:** $0.50 – $2.00 depending on usage.

**Champion unit economics ($9.99/mo):**
- **Web (Stripe):** ~74% contribution margin after Stripe + LLM costs (heavy-user end)
- **iOS year 1 (Apple IAP 30%):** ~44% margin
- **iOS year 2+ (Apple IAP 15%):** ~59% margin
- **Android (Google Play):** similar to iOS

**Implications:**
- Web-to-mobile cross-signups are valuable
- Don't compromise UX trying to route around App Store fees
- Sonnet barcode fallback is rare but adds up; track per-user cost

**Other costs:**
- Open Food Facts: free
- RevenueCat: free at low volumes
- Expo: free; paid for EAS Build if needed
- Apple Developer Program: $99/year
- Google Play Console: $25 one-time

**Areas to monitor:**
- Heavy free users who never convert (rate limits)
- Prompt injection / abuse attempts (cost-per-user monitoring)
- Recipe iteration loops (>30 iterations without saving)
- Barcode fallback cost growth (if Open Food Facts coverage degrades)

---

## 11. What I want from you (Claude Code)

**Do not write code in your first response.** Instead:

### 11.1 Read this entire spec.

### 11.2 Produce a comprehensive build plan with these sections:

1. **Monorepo structure** — Propose the package layout. Recommended starting point:
   - `apps/web` — Next.js web app
   - `apps/mobile` — Expo (iOS + Android) app
   - `apps/api` — Next.js API routes if separated, or inside `apps/web`
   - `packages/types` — Shared TypeScript types and Zod schemas
   - `packages/api-client` — Typed HTTP client for both apps
   - `packages/gateway` — LLM Gateway (used by API routes)
   - `packages/agents` — Six agent implementations
   - `packages/db` — Supabase schema, migrations, RLS policies
   - `packages/jobs` — Inngest job definitions
   - `packages/evals` — Eval suite

   Justify the choice. Recommend a build tool: Turborepo? pnpm workspaces? Nx?

2. **Module breakdown** — How would you organize the code within each package? At minimum, propose:
   - The LLM Gateway internals (most important module)
   - The six agent implementations
   - The API route structure (Next.js App Router)
   - The mobile app structure (Expo Router)
   - The web app structure (Next.js App Router)
   - The Supabase schema and migrations
   - The Inngest job definitions
   - Shared types and Zod schemas
   - The eval suite

3. **Build order / dependency milestones** — Refine Section 8 milestones. Specifically:
   - Where to insert content porting (recipes, brands, classes from current site)
   - How to parallelize mobile + web work after the backend is ready
   - When to begin App Store Connect setup (suggest: parallel with milestone 6)
   - Realistic time estimates per milestone (developer-weeks)

4. **Clarifying questions** — Before code is written, what do you need?
   - Is the Anthropic API account set up? Tier? Rate limits?
   - Supabase project — exists? Create fresh?
   - Stripe account — state?
   - Apple Developer Program account — registered? Team set up?
   - Google Play Console — registered?
   - RevenueCat — account created? Apps configured?
   - DNS control over realfoodwin.org — confirmed?
   - Existing content from current site — exportable? Format?
   - The mobile waitlist — where is it stored? How do we export?
   - Brand assets — logo, fonts, design system? Or build one?
   - Anything else you flag

5. **Open assumptions to validate** — What are you assuming based on the spec that we should confirm?

6. **Risks and watch-items** — What concerns you, where is the spec underspecified? Address:
   - App Store review risks for AI-generated content
   - Apple Sign-In implementation quirks
   - Mobile-IAP-vs-web-Stripe pricing UX challenge
   - Barcode scanner edge cases (damaged barcodes, foreign products, private-label products with no UPC)
   - Push notification deliverability and opt-in rates

7. **What you'd defer to a follow-up plan** — If the spec is too ambitious for a single planning pass, what splits out?

### 11.3 Code style and quality expectations (when implementing)

- Strict TypeScript, no `any` without an explanatory comment
- Zod for runtime validation of every LLM output, every API boundary, every external input
- Tests for the LLM Gateway (mocked Anthropic responses) and critical business logic
- Each agent's prompt template is its own file; `prompt_version` constant
- Every PR includes any necessary migrations; never edit applied migrations
- No `console.log` in production code paths; use the logging layer
- Privacy-sensitive operations (export, delete, audit log) get their own integration tests
- Mobile: React Native + Expo best practices; Reanimated for performance-critical animations
- Mobile: platform-appropriate navigation patterns
- Web: server components by default; client components only when needed

---

## 12. Constraints worth restating

- **Mobile is the flagship. Web is the companion.** Don't optimize web at the expense of mobile.
- **Do not start the build by calling Anthropic from feature code.** The LLM Gateway must exist before any agent does.
- **Do not skip the nightly user summary.** Single feature that makes personalization feel real.
- **Do not let user data leave the stack.** No external analytics, no separate vector DB.
- **Do not pull Phase 2 features into Phase 1.** Three platforms is enough.
- **Do not use passwords.** Magic link + Google + Apple only.
- **Do not skip the "Tuned for you" badge.** It is how the user FEELS personalization.
- **Do not build a separate vector database.** pgvector in Supabase.
- **Do not skip Apple Sign-In on iOS.** Required if any other social login is offered.
- **Do not route mobile subscriptions through Stripe.** Apple/Google rules require IAP for in-app digital subscriptions. Use RevenueCat.
- **Do not underestimate App Store review time.** Plan two weeks buffer.
- **Do not skip the barcode resolution cache.** Building the `products` table as we go is what gives us owned data over time.

---

## 13. What success looks like

By the end of Milestone 2, a developer can curl the API and get a personalized swap back, with full LLM Gateway logging.

By the end of Milestone 5, the web app is live in staging. Anonymous users can swap and sign up. Logged-in users see a "this is your account" experience.

By the end of Milestone 7, a developer can open the mobile app, scan a barcode, and see a personalized swap. Full daily flow works end-to-end.

By the end of Milestone 8, a developer who's used the app for a week sees personalized recommendations that quote their own behavior. The nightly summary contains specific observations.

By the end of Milestone 12, all three platforms are live, the Replit app is sunset, the mobile waitlist has been notified. New visitors don't notice the system change; they just notice everything feels tuned to them.

---

**End of specification. Please produce the build plan now.**
