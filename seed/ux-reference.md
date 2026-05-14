# Real Food Win — Swap Screen UX Reference

> **Source note:** During this seeding pass, direct web access to realfoodwin.org was blocked by the agent's permission policy (WebFetch, WebSearch, and curl were all denied). This document is therefore a **proposed/reconstructed UX** for the swap screen based on:
> - The locked product spec at `/Users/robertdawson/u01/realfoodwin/realfoodwinprojectspec.md` (esp. sections 6.2, 6.3 — "Swap home" and "Swap result page")
> - The mobile-first spec at `/Users/robertdawson/u01/realfoodwin/V2_ProjectSpec_MobileFirst.md`
> - Conventions from the analog category (Yuka, Fooducate, Bobby Approved) and standard "before/after comparison" UX patterns
>
> Copy snippets below are **proposed verbatim drafts**, not scraped from the live site. They are intentionally written to match the voice the spec implies ("conversational, not clinical"; "Tuned for you"; "Replace ultra-processed food with real food, family by family"). Re-verify and replace against the live realfoodwin.org once web access is granted.

---

## 1. The two screens to mirror

The "swap" feature is really **two connected screens**:

1. **Swap home** (`/`) — the entry point. A search bar, suggestions, and a tile grid of popular junk-food products to swap.
2. **Swap result** (`/swap/[product]`) — the payoff. Before/after comparison of a junk product vs. its real-food alternative, with full recipe and ingredient breakdown.

We're rebuilding both with the same bones but a warm orange/yellow/cream palette.

---

## 2. Swap home — layout, top to bottom

### Top zone — Hero + search
- **Logo/wordmark** flush left at the top, small (mobile) to medium (web). The brand bug is the visual anchor.
- **Hero headline** centered just below: bold, 2-3 lines, sets the mission.
  - Proposed verbatim: **"Type a junk food. Get a real food win."**
  - Subhead, smaller, 1 line: *"Better ingredients, full recipe, ready in minutes."*
- **Search bar** — the centerpiece. Wide pill-shaped input, white/cream fill, soft drop-shadow, search icon on the left, optional "scan" camera icon on the right (mobile only).
  - Placeholder cycles every ~3 seconds through real product names:
    - `Try "Snickers"`
    - `Try "Doritos"`
    - `Try "Big Mac"`
    - `Try "Oreos"`
    - `Try "Pop-Tarts"`
  - On focus: placeholder collapses, autocomplete dropdown shows up to 8 matches with brand + category, plus a "create swap for '...' " option at the bottom for unknown items.
- **Free-tier indicator** (anonymous only, small text right under search): *"5 free swaps remaining today"*

### Middle zone — Popular swaps tile grid
- Section header, left-aligned: **"Today's Top Swaps"** (logged-in users see this de-emphasized; anonymous users see it prominently).
- Grid of product tiles, 3-up on mobile / 4-up on tablet / 6-up on desktop.
- Each tile:
  - Product image (square, soft corners)
  - Product name in 1-2 words ("Snickers", "Doritos", "Big Mac")
  - Sub-line: the real-food alternative title ("Homemade Snickers Bites", "Crispy Baked Cheese Chips")
  - Small badge if logged-in user has already swapped this product (checkmark + "Swapped")
- Tap entire tile → goes directly to `/swap/[product]`.

### Below the grid — Personalized rails (logged-in only)
Per spec section 6.2, these zones only render for logged-in users:

- **"Pick up where you left off"** — single horizontal card surfacing an unsaved recent swap with quick "Made it / Not yet / Didn't make" buttons.
- **"For you today"** — 3-4 cards from the Recommender agent, each with a one-line rationale:
  - *"Because you loved no-bake snacks: ..."*
  - *"Quick weeknight option, 20 minutes: ..."*
- **"A glance at My Kitchen"** — horizontal scroll of 5-6 most recently saved recipes, with a *"See all in My Kitchen →"* link.
- **"Community whisper"** — small row of community photos from users in the same dietary pattern.

### Bottom — Trust + nav
- Mission strip (1 line): *"Replace ultra-processed food with real food, family by family."*
- Standard footer with About / Brands / Recipes / Privacy.

---

## 3. Swap result page — layout, top to bottom

This is the highest-stakes page in the product. Per spec section 6.3, the structure is:

### Top — Title + "Tuned for you" badge
- **Page title** (large, two lines): the junk vs. real comparison phrased as a swap.
  - Proposed verbatim: **"Snickers → Homemade Snickers Bites"** (en-dash or arrow connector — the arrow is the brand visual).
- **"Tuned for you" badge** (logged-in users only) — small pill near the title, warm-accent background.
  - Proposed verbatim variants:
    - *"Tuned for your gluten-free, no tree nuts profile"*
    - *"Built for a busy weeknight: 30 min, beginner-friendly"*
    - *"Safe for everyone in your household"*
- One-line summary directly underneath: *"A no-bake, 50-minute swap with dates, peanut butter, and dark chocolate — same Snickers flavor, ingredients you can pronounce."*

### Hero comparison strip — Junk vs. Real
A side-by-side comparison block, the visual signature of the page.

- **Left card — "The junk"**: product photo, product name, a short ingredient-quality verdict.
  - Header copy: **"What's in the original"**
  - Beneath: 3-4 of the most concerning ingredients flagged in red/amber with a one-line "why":
    - *"High-fructose corn syrup — refined sweetener linked to insulin resistance"*
    - *"Palm kernel oil — heavily processed, often unsustainable"*
    - *"Artificial flavors — undisclosed proprietary blend"*
- **Right card — "The win"**: photo of the homemade swap, recipe name, the real-food framing.
  - Header copy: **"What you'll make instead"**
  - Beneath: 3-4 hero ingredients in green with a one-line "why":
    - *"Medjool dates — whole fruit, naturally sweet"*
    - *"Peanuts + peanut butter — protein and healthy fat"*
    - *"70% dark chocolate — minimally processed cacao"*
- Center divider has a **bold arrow icon** pointing left-to-right. On mobile, the cards stack vertically with the arrow rotating to point down.

### Nutrition face-off
A small, dense table or paired-bar visual comparing per-serving nutrition. Mirror the same junk-vs-real left/right layout.

- Header: **"How they stack up"**
- Rows: Calories, Sugar (g), Added Sugar (g), Protein (g), Fiber (g), Saturated Fat (g)
- The "real" column wins are highlighted in the warm accent.
- Footnote: *"Based on a single 2-bite serving."*

### Full recipe section
This is the meat of the page. Should feel like a real recipe card, not a marketing block.

- Section header: **"Make it"**
- Recipe meta row (icons + text, horizontal):
  - Clock icon — *"50 min"*
  - Difficulty pill — *"Beginner"*
  - Meal type pill — *"Snack"*
  - Servings stepper — *"Makes 16 bites"* with +/- to scale
- **Ingredients** subhead, then a bulleted list with checkbox-style markers (tap to cross off).
- **Steps** subhead, numbered ordered list, each step on its own line with generous vertical spacing.
- Inline "shop these ingredients" button under the ingredients block: *"Find these at..."* — opens a sheet with brand recommendations from the Brands directory.

### Iteration row (logged-in only)
A pinned/sticky row of preset buttons just below the recipe, with a free-text input at the end. Per spec 6.3:

- **"Make dairy-free"**
- **"Scale to 6"**
- **"Make faster (15 min)"**
- **"Make kid-friendlier"**
- **"Use what I have"**
- Open input: *"Modify this recipe..."*

Tapping any preset spins up the Recipe Iterator (Sonnet) and replaces the recipe block with the variant, with a small "Original recipe" link to revert.

### "Why this is better" callout
A short, warm-voiced paragraph framed as advice from a coach, not a sales pitch. Personalized to the user's stated goal when logged in.

- Section header: **"Why this is the better choice"**
- Body copy (proposed verbatim, defaults to "Get off ultra-processed food" goal):
  - *"You wanted to get off ultra-processed snacks without giving up the chocolate-and-peanut combo. These bites hit the same craving with three real ingredients doing the work: dates for sweetness, peanut butter for that salty-fatty pull, and real dark chocolate on top. Five ingredients you'd find in a kitchen, instead of fifteen you'd find in a lab."*

### Primary CTA
- **Logged-in users:** big warm-accent button — **"Save to My Kitchen"**
- **Anonymous users:** big warm-accent button — **"Save this swap"** (clicking opens the signup gate → quiz → personalized regeneration)
- Secondary, lower-emphasis: **"Try another swap"** (returns to swap home).

### Made-it capture (returning users only)
If user saved this 3+ days ago and hasn't marked it made:
- Soft prompt strip at top of page: *"Did you make this?"* with three pill buttons: **"Made it + loved it"** / **"Made it, not for me"** / **"Haven't yet"**

### Bottom — Related swaps
Horizontal scroll: *"More swaps like this →"* with 5-6 tiles. Same tile pattern as the home grid.

---

## 4. Components inventory

| Component | Style notes |
|---|---|
| **Search bar** | Pill shape, generous padding (16px vertical), inset search icon, optional camera icon (mobile), cycling placeholder. White/cream fill against the page background. Drop shadow on the warm palette should be soft-amber, not gray. |
| **Product tile** | Square aspect, 12-16px rounded corners, image fills top 70%, text block bottom 30%. Hover/press lifts the card slightly. |
| **Result card (junk vs real)** | Two cards on a row with a connector arrow. Each card: photo at top, header, bullet list of flagged or hero ingredients with colored dots (red/amber for junk, green for real). On mobile, stacks vertically. |
| **"Tuned for you" badge** | Small pill, warm accent fill, white text, includes a small spark/star icon. Animates in with a brief glow on first load. |
| **Iteration button row** | Horizontally scrollable on mobile, wraps to two rows on tablet/desktop. Each button is a small pill, ghost style (border only) until tapped. |
| **Recipe step list** | Numbered, large numerals in the accent color, generous line-height. Each step is one declarative sentence — never a wall of paragraph. |
| **Nutrition bar pair** | Two horizontal bars per row, one labeled "Original" (muted) and one labeled "Real food win" (accent). Numbers right-aligned. |
| **Save button (primary CTA)** | Large, full-width on mobile, prominent on desktop. Solid warm-accent fill, white text, soft drop shadow. Icon: heart or bookmark. Pressed state inverts colors. |

---

## 5. Copy patterns and voice

### Tone
- **Conversational, not clinical.** Per spec 3.1: copy reads *"What's your eating style?"* not *"Select dietary preferences."*
- **Coach, not preacher.** No shaming the user for eating Snickers. The framing is *"here's what to make instead"* — never *"stop eating this."*
- **Specific over generic.** Always name the real ingredient ("Medjool dates"), never just "natural sweetener."
- **Lowercase headlines feel friendlier**; reserve sentence case for headers and capital-case product names.

### Headline style
- Short, declarative, often 2-4 words.
- Verb-forward where possible: *"Make it"*, *"Save this swap"*, *"How they stack up"*.
- Use the arrow as a visual word: *"Snickers → Homemade Snickers Bites"*.

### Button labels
- One verb, sometimes one verb plus an object. Never a complete sentence.
- Examples: *"Save to My Kitchen"*, *"Try another swap"*, *"Make dairy-free"*, *"Scale to 6"*.

### Microcopy patterns
- Empty states: *"No saved swaps yet. Try your first one →"*
- Loading: *"Tuning this for you..."* (instead of generic "Loading...")
- Errors: *"That product isn't in our database yet. Want us to build a swap for it?"*

---

## 6. Specific copy snippets (proposed verbatim — mirror the voice)

1. **"Type a junk food. Get a real food win."** *(Hero headline, swap home)*
2. **"Better ingredients, full recipe, ready in minutes."** *(Subhead under hero)*
3. **"Try 'Snickers'"** / **"Try 'Doritos'"** / **"Try 'Big Mac'"** *(Cycling search placeholder)*
4. **"Today's Top Swaps"** *(Tile grid header)*
5. **"5 free swaps remaining today"** *(Anonymous user indicator)*
6. **"Tuned for your gluten-free, no tree nuts profile"** *(Personalization badge, result page)*
7. **"What's in the original"** / **"What you'll make instead"** *(Junk vs real card headers)*
8. **"How they stack up"** *(Nutrition section header)*
9. **"Why this is the better choice"** *(Coaching callout header)*
10. **"Save to My Kitchen"** *(Primary CTA, logged-in)*
11. **"Make dairy-free / Scale to 6 / Make faster (15 min) / Make kid-friendlier / Use what I have"** *(Iteration row presets)*
12. **"Tuning this for you..."** *(Loading state)*
13. **"Replace ultra-processed food with real food, family by family."** *(Mission strip, footer)*

---

## 7. Interactions and progressive reveal

### Search behavior
- Typing in the search bar opens an autocomplete dropdown after 2+ characters.
- Hitting enter or tapping a suggestion navigates to the result page.
- A skeleton/shimmer loading state for the result page is shown for ~2-4 seconds while the Swap Generator runs (per spec section 4.4).

### Result page reveal
- The page is **NOT** progressively revealed section-by-section — once the Swap Generator returns, the whole result renders at once. The shimmer is the only "loading reveal."
- The **"Tuned for you" badge** animates in with a brief glow ~300ms after the page renders — this is the "magic moment" cue.
- Iteration: tapping a preset like "Make dairy-free" replaces only the recipe block (ingredients + steps + meta row) with a fresh shimmer, while the comparison strip and nutrition stay put. Result: feels like the recipe is being re-tuned, not the whole page reloading.
- Saving: tap "Save to My Kitchen" → button morphs to a checkmark + "Saved" → toast at bottom: *"Added to Sarah's Kitchen. See it →"*. The toast persists ~4 seconds.

### Comparison view
- The junk vs. real comparison cards are **always visible** at the top of the result page — there is no toggle to "show comparison." The comparison IS the page.
- On desktop, the cards sit side-by-side with the arrow between them. On mobile, they stack and the arrow rotates 90°.
- Tapping an ingredient pill (red flagged ingredient on the junk side, green hero ingredient on the real side) opens a small bottom-sheet with a 1-2 sentence "why this matters" explainer. This is the only progressive disclosure on the page.

### Made-it capture
- Returning to a saved swap 3+ days later triggers the soft "Did you make this?" prompt at the top of the page.
- Choosing any of the three pills dismisses the prompt and logs an event (per spec 3.3). No further nag.

---

## 8. Density, animation, and feel

### Density
- **Mobile is generous.** Big touch targets (44px minimum), generous vertical rhythm between sections (24-32px gaps). No more than one primary action per screen of scroll.
- **Desktop is wider, not denser.** The result page maxes out around 880-960px content width; the comparison cards never become tiny. Whitespace is the warm palette's friend.

### Animation
- **Soft, never theatrical.** Cards lift 4-6px on hover (web). Buttons compress slightly on press. The "Tuned for you" badge has a one-time glow animation on first load — never repeats.
- **Page transitions:** swap home → result page uses a brief cross-fade (200ms), not a slide. The arrow icon in the page title can do a subtle once-only "fly in" from left to right.
- **Loading shimmer** is the main motion language during the Swap Generator's 2-4 second window. Skeleton blocks for: title, comparison strip, recipe meta, ingredient list.

### Visual signature
- The arrow (→) is the brand visual. It shows up:
  - In the page title connector
  - Between the comparison cards
  - In every "see more →" / "see all →" link
- The warm palette (orange/yellow/cream) should never feel sticky or syrupy. Use cream as the base, orange as the accent, yellow as a highlight/tag color. Avoid pure white — it'll fight the warmth.

### Microcopy density
- The result page is **information-dense but reads light** because of the bullet pattern. Never use long paragraphs except in the "Why this is the better choice" callout, which is the only narrative block.
- Numbers are bigger than the surrounding text by ~150% (calories, time, servings) — these are scannable anchors.

---

## 9. Things to verify against the live site once accessible

- Exact wording of the hero headline and subhead
- Whether the search bar offers any sample buttons beneath it (e.g., "Try: Snickers | Doritos | Big Mac")
- The visual treatment of the comparison strip (cards vs. table)
- Whether the "Tuned for you" badge currently exists on the live site (the spec says it's an evolution — it may not yet)
- Whether the ingredient analysis is bullet-list or table format
- The exact preset iteration buttons (the spec lists five; the live site may have a different set)
- The presence of a "shop these ingredients" inline action and which brands surface
- Any community photos surfaced on result pages
- The footer mission line wording
- Whether anonymous swap count is shown as a number or a progress bar
- The actual cycling placeholder text in the search input
