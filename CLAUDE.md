# Women360 — Engineering & Product Standard

This file is the persistent quality bar for this repository. It applies to
every future change — feature, refactor, bug fix, redesign, backend work,
test, deployment, or content edit — regardless of how small the request
sounds. **"Change this button" does not mean "ignore everything else."**
Before any non-trivial change: understand the existing system, check design
system / accessibility / responsive / security / API / performance
implications, implement, test, and check for regressions.

Do not lower this bar without the repo owner explicitly changing the
standard itself.

## 0. What Women360 is

Women360 is a women's health & wellness SaaS spanning ages 18–100+, being
built for real users and eventual investors — not a coursework demo, even
though it originated as a university Cloud Computing project (see
`Documentation/SRS.pdf`, which still governs functional scope, data model,
and the "must demonstrate real cloud deployment" constraint). It must read
as a serious digital-health product: trustworthy, mature, clear, private.
It must never read as a student project, an AI-generated template, or a
generic SaaS landing page.

**Senior Mode is a core, load-bearing USP**, not an accessibility toggle. It
restructures navigation and information architecture (large plain-language
tiles the user chooses in Settings → Customize essentials), it is not a
CSS zoom. Never regress it while touching shared components.

## 1. Hard "no" list (vibe-coded patterns)

No purple/neon/rainbow gradients, glassmorphism, bento grids, emoji-as-UI,
sparkle icons, decorative dot grids, three-identical-feature-card rows,
checkmark bullet walls, three pricing tiers, fake testimonials/reviews/
metrics/user-counts/logos, generic "It's not X, it's Y" AI marketing copy,
gratuitous scroll/hover animations (respect `prefers-reduced-motion`,
already wired in `src/index.css`), or making everything a floating rounded
card. A section can be typography + spacing + a divider.

## 2. Design system (already established — extend, don't replace)

- Colors: deep maroon/burgundy (`tailwind.config.ts` → `maroon` 50–950) on
  warm neutrals (`paper`, `warmgrey`, `ink`). Semantic tokens live as CSS
  vars in `src/index.css` (`--w360-bg`, `--w360-bg-raised`, `--w360-text`,
  `--w360-text-muted`, `--w360-border`, `--w360-accent`, `--w360-focus`,
  etc.) with a real dark-mode block (`.dark`), not an inverted afterthought.
  Add new semantic tokens (success/warning/info) the same way rather than
  hard-coding raw Tailwind colors in components.
- Type: display = Fraunces (serif, editorial), body/UI = Inter. Loaded via
  Google Fonts `<link>` in `index.html`.
- Radius/shadow scale is restrained (`sm`/`DEFAULT`/`md`/`lg`/`xl`,
  `shadow-subtle`/`shadow-card`) — keep it that way, don't add drop-shadow
  soup.
- Senior Mode is a real Tailwind variant (`senior:` from the custom plugin
  in `tailwind.config.ts`, activated by a `.senior` class on `<html>` via
  `useSeniorMode`), plus structural CSS in `index.css` (`.senior` sets
  `font-size: 19px`, larger radius). Use the `senior:` variant for
  component-level adjustments; use `SeniorTileGrid`/`SeniorTopBar` for the
  navigation-level swap.
- UI primitives live in `src/components/ui/*` (Button, Card, Input, Modal,
  Tabs, Toast, Badge, ProgressBar/Ring, `states.tsx` for
  Loading/Empty/Error). Reuse and extend these; don't hand-roll one-off
  variants of the same component in a feature folder.

## 3. Current architecture (as of the last audit)

Monorepo: a React 18 + TypeScript + Vite + Tailwind + React Router SPA at
the repository root, and a Node/Express + TypeScript + Prisma/PostgreSQL
API in `server/`. **The two are fully connected** — every service in
`src/services/*.ts` (auth, cycle, nutrition, activity, sleep, wellbeing,
goals, health, insights, reports, learn, messages, notifications) is live
against the real `/api/v1` API via `apiClient.ts`'s real `request()`
(Bearer auth, shared refresh-and-retry on 401) and a shared
`src/services/mappers.ts` that translates the backend's `UPPER_SNAKE_CASE`
enums, a few renamed fields, and relative-time display formatting at the
service boundary. `src/mock/seed.ts` has been deleted; `apiClient.ts` no
longer exports a mock `delay()` shim. See `README.md`'s Backend section
for the two deliberate, named page-level exceptions this required.

`server/` has its own ESLint/TypeScript/Vitest tooling and has been
installed, linted, typechecked, built, and run end-to-end against a real
local Postgres instance (see `server/README.md`'s Verification status
section) — 21/21 tests pass, and the first Prisma migration is committed
at `server/prisma/migrations/`. Root-level CI lives at
`.github/workflows/ci.yml` and runs both packages' lint/typecheck/test/
build (the server job against a Postgres service container).

**Nutrition, Sleep, Cycle, and Goals have full CRUD**, not just a
read-only view or a fake "Add" form: create/edit/delete, inline
validation, empty states, and dashboard tiles that all read from the same
service data (no separate hardcoded dashboard numbers). Notably:
`SleepPage.tsx` previously had zero logging UI at all — it's now a real
add/edit/delete flow with a 12-hour-format conversion required by the
backend's `consistencyScore` parser (`to12Hour`/`to24Hour` in
`mappers.ts`) and a `calcSleepDuration` helper that handles midnight
crossing. `NutritionPage.tsx`'s "Add meal" form used to be entirely
fake — its submit handler never called the service at all. `CyclePage.
tsx`'s calendar day buttons had no `onClick`; tapping a day now opens the
same log/edit modal pre-filled for that date, with delete. `Goal` was
restructured from a stored `progress` percentage + free-text `target` to
real `currentValue`/`targetValue`/`unit`, with progress always computed
(`goalProgress()` in `mappers.ts`), never trusted from a stale field.
`src/components/ui/ConfirmDialog.tsx` (new) backs every delete action —
there was no confirmation-dialog precedent anywhere before this.
`Input.tsx` now generates a fallback id via `useId()` when a controlled
usage omits `name`/`id`, fixing a real accessibility gap (broken
label/input association) present since before this pass, across the
whole app.

Also fixed in the same pass, all using endpoints that already existed
server-side but were never called: Activity entries can be deleted;
notifications can be marked read by clicking them (`TopBar.tsx`);
Reports' "Download" does a genuine client-side export of the report
data instead of a fake toast (its "Share" button was removed — no
backend capability exists for it, so per this repo's own standard it
was removed rather than left as a dishonest no-op); Settings' Profile
and Emergency Contact tabs are wired to a new `userService.ts` against
`/users/me` and `/users/me/emergency-contact`; Health's Medications and
Appointments tabs got the same Add/Edit/Delete treatment their Vitals
tab already had. Also fixed: `users.service.ts`'s `updateProfile`
returned the raw Prisma `User` row (including `passwordHash`) to the
client — extracted the existing `publicUser()` helper from
`auth.service.ts` into `server/src/lib/publicUser.ts` so both use it.

**Sleep quality, nutrition precision, fibre, and PDF reports (latest
pass):** Sleep quality moved from a 0-100 percentage to a real 1-5 rating
(1 Very poor .. 5 Excellent) end to end — Prisma column semantics, zod
validation (`quality: z.number().int().min(1).max(5)`), a segmented
1-5 button control replacing the old percentage slider
(`SleepPage.tsx`), and every display site (dashboard, history list,
reports). Existing dev-only rows were converted proportionally in the
migration rather than reset. Nutrition values (calories, protein, carbs,
fat, fibre) now accept one decimal place via a shared
`hasAtMostOneDecimal()` check duplicated deliberately in
`nutrition.validation.ts` (backend) and `mappers.ts` (frontend, so the
UI catches an invalid value before a round trip) — `MealEntry.calories`
moved from `Int` to `Float` to allow it. The daily nutrition summary
(`nutrition.service.ts#getDailySummary`) now sums calories/protein/carbs/
fat/fibre directly from that day's actual `MealEntry` rows (it already
did for protein/fibre; calories/carbs/fat were previously never
aggregated at all) — a fibre-accumulation regression test locks this in
(`server/tests/nutrition.test.ts`). "Fruit & veg" was a hardcoded `0`
with no backing table (`// requires a food-database lookup; not modeled
yet`) rendered as a real-looking, permanently-stuck-at-0% progress bar —
replaced with a genuine `FruitVegLog` quick-add, mirroring
`HydrationLog`'s shape.

Health Reports generate a real PDF (`src/lib/generateHealthReportPdf.ts`,
`jspdf` + `jspdf-autotable`) instead of a JSON blob download — branded
header, section dividers, key/value tables, a hand-drawn goal progress
bar, footer with page numbers and a "not medical advice" disclaimer.
`reports.service.ts#generate` was rewritten to snapshot nutrition (it
previously omitted nutrition entirely), sleep (now the 1-5 scale), cycle,
activity, wellbeing, and goals directly from the same tables the live
pages read — a period with no data reports "No X logged in this period"
rather than a fabricated zero. `ReportsPage.tsx` gained a reporting-period
selector (7/30/90 days) the old version never had. Fixed along the way: a
real bug where `window.open()` was called *after* an `await`, which most
browsers silently block as an unrequested popup — the tab is now opened
synchronously in the click handler and navigated once the PDF is ready,
with a toast explaining what happened if the browser blocks it anyway.

Also fixed while doing this pass: `DashboardPage.tsx`'s "Trends worth
noticing" cards were hardcoded copy ("+18% vs last week's average") on
an otherwise all-real page — replaced with an honest "This week" section
built from data already being fetched (days logged this week, sleep
consistency), rather than inventing a week-over-week comparison the
backend doesn't support. `SeniorNav.tsx`'s `SeniorTopBar` overflowed
horizontally at mobile widths (414px content in a 375px viewport, found
while testing the new Sleep control on mobile) — it now wraps onto two
rows instead of clipping. The frontend had zero test runner at all
(`README.md`'s disclosed gap); added a minimal Vitest setup
(`vitest.config.ts` at the repo root) covering the pure functions most
worth locking in (`calcSleepDuration` incl. midnight crossing,
`to12Hour`/`to24Hour`, `hasAtMostOneDecimal`, `goalProgress`) — this is a
start, not full coverage. The backend's own test suite intermittently
crashed with an opaque tinypool "Worker exited unexpectedly" (a Windows
worker-thread flakiness, not a code defect) — fixed by disabling file
parallelism in `server/vitest.config.ts`; the suite is small enough that
running sequentially costs a few seconds.

Known concrete defects to fix as part of any related work:
- No `robots.txt`/`sitemap.xml`, no favicon files, no legal pages
  (privacy/terms/cookies), no SEO metadata per route (single static
  `<title>` in `index.html`).
- The PDF report's typography is Helvetica, not Fraunces/Inter — jsPDF's
  built-in fonts don't include custom web fonts without shipping and
  embedding font files, which was judged not worth the added complexity
  for a print document. The maroon brand color and wordmark are still
  used throughout.
- `generateHealthReportPdf`'s dependency (`jspdf`) bundles `html2canvas`
  internally for an HTML-rendering feature this app never calls; Vite
  correctly splits it into its own ~200KB chunk that's only fetched if
  that code path ever runs, but the Reports page's own lazy chunk is
  still ~430KB (~140KB gzipped) — acceptable since it only loads when a
  user visits Reports, not on initial app load, but worth knowing if
  bundle size becomes a concern later.
- Settings' "Privacy & sharing" toggles (share with coach, email
  reminders) are explicitly disclosed in the UI as not yet persisted —
  no backend endpoint exists for either preference at all, so inventing
  one was out of scope for a "fix what's broken" pass. A real fix needs
  a product decision on what "sharing with coach" actually controls,
  then a new backend endpoint.
- Onboarding's multi-step form (`OnboardingPage.tsx`) is still purely
  cosmetic — none of the collected name/DOB/allergies/lifestyle/goals
  data is captured into state or submitted anywhere; `completeOnboarding
  ()` only flips the `onboarded` flag server-side. The backend has a
  real `PUT /users/me/health-profile` that could receive some of this,
  but wiring up all 7 steps is a standalone forms project, not a small
  fix.
- Messages has no real two-way reply — `MessagesPage.tsx`'s reply box
  only appends to local component state and is lost on refresh. The
  `Message` Prisma model itself has no sender-as-current-user concept
  (just a `senderLabel` display string and a `recipientId`), so this
  needs a data-model decision (a real conversation/thread model) before
  it can be implemented, not just a service method.
- No role-selection UI anywhere in registration/onboarding — `Role` (woman
  /coach/admin) is fully modeled and enforced server-side in `server/`,
  but the frontend can currently only ever create a "woman" account.

## 4. SRS constraints that override generic assumptions

`Documentation/SRS.pdf` is the source of truth for scope and must be
followed rather than invented: roles are Woman / Wellness Coach / Admin;
cloud database may be PostgreSQL, MongoDB Atlas, Firebase, or Supabase;
hosting may be Render, Railway, AWS, Azure, GCP, Firebase, or equivalent;
the system is not considered complete if it only runs on localhost. Do not
invent company/business facts (address, phone, certifications, real
customer counts) beyond what SRS or the repo owner supplies — use
configurable placeholders and say so.

## 5. Definition of done (per section, not just "looks nice")

A change is complete only when it is: functional, responsive (no
horizontal scroll, ever — fix root causes, never `overflow-x:hidden` as a
patch), accessible (keyboard, focus-visible, semantic HTML, screen-reader
labels), has loading/empty/error/success states where relevant, is secure
where it touches auth/data, and is visually consistent with the existing
design system. "The component exists" is not "done."

## 6. Working process for significant changes

Understand → plan (identify affected areas/dependencies) → implement the
smallest coherent change → validate (typecheck/lint/build once tooling
exists) → UX pass → responsive pass → accessibility pass → security pass →
regression pass → polish. When a requirement is ambiguous and materially
affects architecture, product behavior, medical claims, or business facts,
ask rather than assume.
