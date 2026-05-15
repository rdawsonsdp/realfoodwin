# Real Food Win — Backlog

Deferred items from the planning Q&A on 2026-05-14. Revisit when the relevant phase begins.

## Mobile-phase (next 2–3 weeks after Saturday prototype)

- Apple Developer Program enrollment — confirm individual vs. organization account (org needed for the brand)
- Google Play Console enrollment — confirm $25 paid
- Mobile waitlist current storage location + export format (Mailchimp? DB? Sheet?)
- Internal testers available for TestFlight / Play Internal Testing
- ATT prompt decision on iOS — spec says show; App Review guideline 5.1.2 says don't show if not tracking; recommend skip
- Apple "Hide My Email" relay handling in account linking (track all verified emails per `auth_identities`, match on any)
- Push notification opt-in flow — pre-prompt with rationale BEFORE first system prompt; trigger after first save, not on cold launch
- Add Google + Apple Sign-In on web (currently magic-link only)

## Billing-phase

- RevenueCat account setup + iOS/Android app product configuration
- Stripe account setup + product/price IDs for Monthly $9.99 / Annual $79 / Sponsor-a-Family +$9
- "Sponsor-a-Family" mechanic definition — what does the +$9 actually unlock for the sponsor and the recipient?
- IAP-vs-web pricing UX — post-install Resend nudge to web (NOT in-app, per Apple guideline 3.1.1)
- Iteration loop cost cap — per-user-per-day budget (e.g., 20 free / 100 Champion)

## Cutover-phase (M12)

- DNS control over realfoodwin.org — confirm registrar access, who manages
- 301 redirect list — full enumeration of indexed `/swap/[product]` URLs
- Mobile waitlist email migration script — export → `mobile_app_waitlist` table → Resend launch announcement
- Replit sunset plan

## AI tuning features — deferred

- **AI self-tuning questions** (added 2026-05-14) — Have Haiku analyze each user's recent swap+rating+dismiss history and generate 1–3 clarifying questions for the admin to answer ("Linda dismisses pasta swaps citing 'too time-consuming' but saves 30-min Italian dinners — should I assume she only wants pasta when it's truly quick?"). Admin answers go into `<admin_coaching_notes>` for that user. Needs: a `tuning_questions` table, a Haiku prompt template, a queue/review surface in /admin.

## Product decisions still open

- Anonymous rate-limit counting mechanism (IP / cookie / fingerprint mix) when re-enabled post-prototype
- "Modify..." iteration routing — direct-to-Sonnet for prototype; revisit Classifier-routing as a cost optimization
- RLS regression test suite design — one test per user-data table in `packages/evals/rls/`
- Per-agent eval suite design — golden datasets (10–20 cases per agent) for Swap, Iterator, Recommender, Classifier
- CMS for content management vs. Supabase Studio
- App Store review risk plan for AI-generated content — Classifier post-filter, "Report this swap" button
- Real anonymous swap limits re-enabled (currently tabled for demo per 2026-05-14 decision)
