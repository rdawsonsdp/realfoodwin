# Real Food Win — Changelog

## v0.7.0 — 2026-05-17 — Try-again with feedback + multi-substitute swaps

- Survey on **🔄 Try again?** now feeds back into the next prompt as a hard constraint ("User said about the previous swap: …").
- Survey is voice-enabled (Web Speech API), with 8 quick-pick reason chips (Just looking, Just trying variations, Too complex, Weird ingredients, Too time-consuming, Doesn't fit my diet, Don't have those ingredients, Not what I wanted).
- Each swap response now includes 2–3 **alternate ideas** in a single call. Tapping an alternate promotes it to the primary instantly — zero API call, zero token spend. The AI only re-fires when the user has new direction.
- Result screen no longer resets to the swap form on Try Again — the regen happens in-place with the "Cooking another version…" overlay.

## v0.6.0 — 2026-05-17 — Mobile-first UX overhaul

- Hamburger nav drawer + bottom tab bar on phones (`<md`). Desktop inline nav preserved.
- All primary CTAs raised to a 44 px minimum tap target.
- Inputs default to 16 px font + `inputMode` hints so iOS no longer auto-zooms on focus.
- Modals (Test Login, Try Again survey, Recently deleted) became bottom-sheets on mobile, popovers/centered modals on desktop.
- Safe-area-inset utilities for iOS notch/home-indicator.
- New file: `apps/web/MOBILE_UX.md` documents every touched surface.

## v0.5.0 — 2026-05-17 — Brand directory + admin Brands tab

- New `brand_products` table with curated "Products we like" per brand.
- Public `/brands` page: tile per brand (logo + name + Visit →), with a horizontal scroll of curated products underneath.
- New admin tab at `/admin/brands` for full CRUD over brands and their products (name, website_url, logo_url, description, certifications, sort_order, etc.).
- Logos populated for Kettle & Fire and Primal Kitchen via automated crawl; remaining brands editable from the admin UI.

## v0.4.0 — 2026-05-17 — Build a recipe from photos

- New **🛠 Build a recipe** tile in the kitchen toolbar.
- Modes: from a finished-dish photo, from a recipe-card photo, or from fridge/pantry photos (model identifies items and suggests pantry staples).
- Multi-photo upload (up to 6), client-side compression to 1024 px JPEG.
- New `runRecipeBuilder` + `/api/recipes/build` endpoint backed by a dedicated `RecipeBuilder` agent.

## v0.3.0 — 2026-05-17 — Swap-page upgrades

- **📷 Photo input** on the swap form — Claude reads the photo and identifies the food before generating the swap.
- **Preferences panel** below the search (goals, dietary style, allergens, max prep time, prioritize, must-include) — persisted to `localStorage` so picks survive across sessions.
- **Try another version** (in the result card) — same context, fresh result, `avoid_titles` nudge so the model doesn't repeat itself.
- "Find a real food product" goal mode — when only the product goal is selected, results render as a brand product hero (logo + Visit on brand → button) instead of a recipe.
- Product-style results: image (or filler 🥗 tile) links to the brand site directly.
- **Confetti** of food emojis when a swap result first lands.

## v0.2.0 — 2026-05-17 — Recipe library, kitchen affordances, color refresh

- `/recipes` page: meal-type sidebar filter (with counts), grouped sections per type, search across title/tags/ingredients.
- Kitchen toolbar with square tool tiles (extensible — Build is the first; more to come).
- **Remove from kitchen** + 8 s **↺ Undo** on every kitchen tile and recipe page.
- **🗑 Recently deleted (N)** dropdown on the kitchen header lists items removed in the last 24 h with one-tap Restore.
- Print + share buttons on the swap result card; print icon on each recipe library card.
- Forest-green canvas + coral primary palette, with cream cards.
- Site-wide legibility audit so paper-tone text reads on the dark canvas everywhere.

## v0.1.0 — 2026-05-17 — Test login, admin model selector, deployment recovery

- **🧪 Test Login** in the nav (admin / `realfood`): pick Sign in as Admin or impersonate any persona.
- httpOnly cookie unlocks `/admin/*` regardless of `ADMIN_IMPERSONATE_EMAILS`.
- Admin → Models page: pick Anthropic model IDs at runtime; live probe shows what the deployed key can actually call; per-row "Test call" surfaces which IDs work.
- Surface model 404 errors with a coral banner that links to `/admin/models`.
- Initial scaffold: Next.js 14 App Router, Supabase, Anthropic gateway, Turborepo monorepo.
