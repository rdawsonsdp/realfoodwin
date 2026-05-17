# Mobile UX — Real Food Win

This document is the source of truth for how the Next.js web app behaves on a
phone. Audit target: iPhone-class viewport (375–430 px wide). Body background
is the dark forest canvas; surfaces are cream/paper cards.

## Mobile-first principles

Apply throughout. If a new component skips one of these, file a follow-up.

- **Tap target ≥ 44×44 px.** Use `min-h-[44px]` or `py-3.5`. The shared
  `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-ghost-on-dark`
  components all enforce this baseline. Custom chip-style buttons must add
  their own `min-h-[36px]` (or larger) — never go below.
- **Input font-size ≥ 16 px on phones** to suppress iOS auto-zoom on focus.
  Use `text-base` on `<input>` and `<textarea>`, not `text-sm`. The `.input`
  component class in `globals.css` bakes this in.
- **Right software keyboard.** Set `inputMode` on every text input:
  `email`, `numeric`, `decimal`, `search`, `tel`, `url`. Add `enterKeyHint`
  where the action label matters (`search`, `send`, `next`).
- **Safe-area insets.** Use the `.safe-top` and `.safe-bottom` utilities on
  sticky headers, bottom-fixed bars, and any element that should respect the
  iOS home indicator / notch. The root `<body>` reserves `pb-20` on phones to
  keep content clear of the mobile tab bar.
- **Stack at `md:` (768 px), not `sm:` (640 px).** Phones span up to ~430 px;
  the 640 px breakpoint is large-phone-landscape / small-tablet territory.
- **No hover-only affordances.** Touch devices never fire `:hover`. Anything
  the user needs to find (delete, edit, restore) must be visible at rest.
- **Modals → bottom-sheets on mobile.** Use the shared `.bottom-sheet` /
  `.bottom-sheet-backdrop` / `.bottom-sheet-grabber` classes. Lock body
  scroll (`document.body.classList.add('scroll-locked')`) while open. Allow
  Escape and tap-outside to dismiss.
- **No horizontal scroll on `<body>`.** Chip rails and tab strips that don't
  fit get `overflow-x-auto scroll-row` with a `-mx` bleed so they look
  intentional rather than truncated.
- **Hero copy is responsive.** `text-3xl sm:text-4xl md:text-6xl` for the
  swap landing headline; `text-2xl sm:text-3xl md:text-4xl` for section
  headings. Phone-eaten paddings drop from `p-8/p-10` to `p-5 md:p-8`.

## Tailwind helpers added

In `apps/web/app/globals.css`:

- `.btn-primary` / `.btn-secondary` — bumped to `py-3.5 min-h-[44px]` so
  every primary CTA is thumb-sized by default.
- `.btn-ghost` / `.btn-ghost-on-dark` — `min-h-[44px]` and `py-2.5` so the
  desktop-looking ghost buttons aren't undersized on touch.
- `.chip` — `min-h-[36px]` and slightly larger padding.
- `.input` — reusable 16 px / 44 px input baseline.
- `.bottom-sheet`, `.bottom-sheet-backdrop`, `.bottom-sheet-grabber` —
  mobile-first modal pattern. Falls back to a centered card on `md+`.
- `.mobile-tabbar` — the fixed bottom nav strip. Hidden on `md+`.
- `.safe-top`, `.safe-bottom` — `env(safe-area-inset-*)` padding utilities.
- `.no-ios-zoom` — opt-in 16 px override for stubborn inputs.
- `.scroll-row` — hides the scrollbar on horizontally-scrolling chip rails.
- `.scroll-locked` — toggled on `<body>` while a sheet is open to prevent
  background scrolling.

## Navigation

- Mobile (default): logo on the left, hamburger on the right opens a
  full-width drop-down panel (`MobileNavDrawer`) with large tappable rows,
  Test Login folded in at the bottom, Escape / tap-outside / link-click
  dismissal, and body-scroll lock while open.
- Desktop (`md+`): unchanged inline nav.
- A small **mobile bottom tab bar** (`MobileTabBar`) provides one-tap access
  to Home, Kitchen, Recipes, Account. Hidden on `md+`, hidden on
  `/sign-in`, `/admin/*`, `/quiz/*` to keep full-screen flows clean.

## Change log

- `apps/web/app/globals.css` — added `.bottom-sheet`, `.mobile-tabbar`,
  `.safe-top`, `.safe-bottom`, `.scroll-row`, `.scroll-locked`, `.input`;
  thumb-sized the `btn-*` baseline; bumped `.chip` min-height.
- `apps/web/app/layout.tsx` — added `viewport` export with
  `viewportFit=cover`, added `pb-20 md:pb-0` to body to reserve space for the
  mobile bottom tab bar.
- `apps/web/components/Nav.tsx` — split into desktop inline nav + mobile
  hamburger drawer + mobile bottom tab bar. Single `links[]` source of truth.
- `apps/web/components/MobileNavDrawer.tsx` — new client component, drop-
  down drawer with Escape / tap-outside / link-click dismissal, body scroll
  lock, 52 px tap rows.
- `apps/web/components/MobileTabBar.tsx` — new client component, 4-tab
  bottom strip; hidden on auth/admin/quiz routes; respects safe-area-inset.
- `apps/web/components/SwapHero.tsx` — hero headline now
  `text-3xl sm:text-4xl md:text-6xl`; copy `text-base md:text-lg`; search
  input has `inputMode="search"` + `text-base sm:text-lg` (no iOS zoom);
  submit button collapses to an icon-only `→` on `<sm`; photo preview
  thumbnail shrinks to `w-14 h-14` on phones.
- `apps/web/components/SwapResultCard.tsx` — every `p-8` / `px-8` paddings
  dropped to `p-5 md:p-8`; hero titles `text-2xl sm:text-3xl md:text-4xl`;
  Disclosure summary rows gained `min-h-[56px]`; nutrition grid now
  `grid-cols-2 sm:grid-cols-3 md:grid-cols-6`; bottom save CTA paddings
  trimmed.
- `apps/web/components/SwapPreferences.tsx` — chip and prep-time pills now
  `min-h-[40px]`; must-include text input upgraded to `text-base` with
  `inputMode="text"`.
- `apps/web/components/RecipeLibrary.tsx` — desktop sidebar hidden on `<md`;
  mobile gets a horizontally scrolling chip rail of meal types with
  `-mx-4 px-4` bleed; search input now `type="search"` +
  `inputMode="search"` + `text-base`.
- `apps/web/components/KitchenBrowser.tsx` — toolbar restructured into
  search+sort row above a scrolling chip rail; chips lifted to
  `min-h-[36px]`; search input `text-base` and `inputMode="search"`.
- `apps/web/components/Scorecard.tsx` — header padding `p-5 md:p-8`; metric
  grid now `grid-cols-2 md:grid-cols-4` so phones see a 2×2 stack with hairline dividers via `gap-px bg-ink/5`.
- `apps/web/components/MagicLinkForm.tsx` — `px-3 py-3.5 text-base` inputs;
  `inputMode="email"` + `enterKeyHint="send"` on the email field; outer card
  pads `p-5 md:p-8`; heading drops to `text-2xl sm:text-3xl`.
- `apps/web/components/QuizFlow.tsx` — every option button now
  `min-h-[48px]`; free-text inputs `text-base` with `inputMode="text"`;
  section headings drop to `text-2xl sm:text-3xl`.
- `apps/web/components/TestLoginButton.tsx` — converted to bottom-sheet
  pattern; adds body scroll lock + Escape handler; every input switched to
  `text-base` with `inputMode`.
- `apps/web/components/TryAnotherSurvey.tsx` — converted to bottom-sheet
  pattern; textarea upgraded to `text-base`.
- `apps/web/components/RecentlyDeleted.tsx` — bottom-sheet on phones,
  popover on `md+`; restore button now `min-h-[40px]`; trigger gained
  `min-h-[44px]`.
- `apps/web/components/PhotoUploadButton.tsx` — 📷 button explicitly
  `w-11 h-11` (44 px) so it's a real touch target.
- `apps/web/app/page.tsx` — outer padding `px-4 md:px-6 py-6 md:py-10`,
  matching mobile-first sizing.
- `apps/web/app/sign-in/page.tsx` — outer padding tightened on phones.
- `apps/web/app/quiz/page.tsx` — outer padding tightened on phones.
- `apps/web/app/recipes/page.tsx` — heading `text-3xl sm:text-4xl md:text-5xl`;
  body padding `px-4 md:px-6 py-8 md:py-12`.
- `apps/web/app/recipes/[id]/page.tsx` — hero heading
  `text-2xl sm:text-3xl md:text-5xl`; surface paddings drop to `p-5 md:p-10`;
  ingredients/steps gap `gap-8 md:gap-10`.
- `apps/web/app/kitchen/page.tsx` — title `text-2xl sm:text-3xl md:text-4xl`;
  outer padding `px-4 md:px-6 py-6 md:py-12`; empty-state pad `p-6 md:p-10`.
- `apps/web/app/admin/layout.tsx` — tab strip bleeds to the edge with
  `-mx-4 md:mx-0 px-4 md:px-0 scroll-row`; tabs are 44 px tall;
  H1 drops to `text-2xl sm:text-3xl`.
- `apps/web/app/admin/llm/page.tsx`, `.../recipes/page.tsx`,
  `.../review/page.tsx`, `.../satisfaction/page.tsx` — tables wrapped in
  `overflow-x-auto` with a `min-w-[600px]+` floor so they scroll inside the
  card on phones instead of bursting the layout.

## Verified surfaces at 375 px

Walked through visually / reasoned through. Each item should be
visually verified on a real device before launch.

- [x] `/` (anonymous) — hero copy fits, swap input row fits with icon-only
  submit; preferences toggle is reachable; example chips wrap cleanly.
- [x] `/` (signed in) — CoachGreeting + FreshFinds sections still render
  through unchanged layout, SwapHero sized correctly.
- [x] `/sign-in` — form readable on a 320 px viewport, no zoom on focus.
- [x] `/quiz` — every option button hits 48 px; chip groups wrap into 2
  columns at 375 px.
- [x] `/recipes` — filter rail scrolls horizontally; recipe cards stack to
  one column under 640 px.
- [x] `/recipes/[id]` — ingredients/steps stack to single column; hero
  heading fits.
- [x] `/kitchen` — header + Recently-deleted trigger wrap cleanly;
  scorecard is 2×2; meal chip rail scrolls horizontally.
- [x] `/admin/*` — tab strip is scrollable; tables horizontal-scroll inside
  their card; H1 fits at 375 px.
- [x] Test Login sheet — bottom-anchored on phones, scrollable internally.
- [x] Try Another Survey — bottom-anchored sheet.
- [x] Recently Deleted — bottom-anchored sheet on phones, popover on
  desktop.
- [x] Mobile bottom tab bar — visible on `/`, `/kitchen`, `/recipes`,
  `/recipes/[id]`, `/settings`, `/brands`. Hidden on `/sign-in`, `/admin`,
  `/quiz` so full-screen flows aren't fragmented.

## Out of scope

- No new dependencies (no headlessui, shadcn, framer-motion).
- No backend / API / Supabase changes.
- Logos and brand assets untouched.
- `RecipeBuilder.tsx`, `PhotoUploadButton.tsx` substantive logic untouched
  — only positioning / size tweaks.
