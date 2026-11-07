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

**The primary goal is preventive care**: Women360 exists to help a woman track
and work on her health so that she prevents possible ailments — acting early,
not just logging. When weighing features, prefer ones that turn her own data
into early, actionable, non-diagnostic prevention (check-up and screening
reminders, risk-factor awareness, habit goals). Screening schedules and risk
statements are medical claims: they need a named guideline source, a target
region and clinical review, so ask before writing them.

**Ease of use is a primary requirement, alongside prevention.** Tracking health
must not drain her time: fewest taps and fields, one-tap daily logging, templates
and sensible defaults instead of blank forms, only the essential fields required,
progressive disclosure, never everything at once, no streak guilt. When adding or
reviewing a screen, count the taps and fields and cut. Prefer pre-filling from her
own history over asking again.

**Instructions are not permanent furniture.** A screen should look calm: explanations and
how-to text (`Select an entry to edit it`, what a feature does, how a field works) appear the first
time someone meets them and again only when she asks (the Help button in the top bar, which turns tips
on for the current screen and off when she moves on). Use `<Hint id="...">` (`components/ui/Hint.tsx`) for
a paragraph and the `hint` prop on `Input`/`NumberField`/`DurationField` for a field; both follow the
rule automatically (`useHintVisible`, remembered in `lib/hints.ts`). **Never hide** a medical
disclaimer, a privacy promise, what an irreversible action will do, an error, or an honest limitation she
must know (those stay plain text); never repeat an instruction on every row of a list. When adding a
screen, ask of each line of helper text: is it an instruction (hint) or something she must always see (plain)?

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
- Type: display = Fraunces (serif, editorial), body/UI = Inter. Self-hosted
  variable fonts from `@fontsource-variable/*`, imported in `main.tsx` (no Google request; do not add a Google Fonts
  link back: the CSP and privacy page say fonts come from this site).
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

**Cross-domain correlation engine + per-category safety passes (latest
pass):** the competitive gap against Flo/Clue/MyFitnessPal/Sleep Cycle/
Headspace/NTC/Medisafe isn't feature parity — it's that each of those
apps treats its metric in isolation and has a documented failure mode.
Added `server/src/modules/insights/factors.ts`, a reusable "explain
this" engine: `explainCycleDelay` and `explainLowMood` look across a
user's own logged sleep/nutrition/activity/hydration/stress/medication/
weight data for a genuine deviation from *that user's own* baseline
(never a population norm, never fired without enough history to trust
it) and report it as a ranked, disclaimed observation — a late period
isn't defaulted to "maybe pregnant" (pregnancy is always listed, but
unranked and last, and skipped entirely for MENOPAUSE/POSTMENOPAUSE
users) and a bad mood isn't defaulted to "PMS" (cycle phase is one
possible factor among several). Wired into `CyclePage.tsx` (when a
period is late) and `WellbeingPage.tsx` (when a logged mood is notably
low), both collapsed by default.

`cycle.service.ts#getSummary` was rewritten from a fixed "assume 28
days, ovulate on day 14" formula (inaccurate for most people per the
research, and actively unsafe as a contraception signal) to median/MAD
statistics over the user's own recent cycle lengths, returned as a
range with a `confidence` level (forced low for thin history, high
cycle-length variance, or `PERIMENOPAUSE`) instead of a false-precision
single date. A persistent "not a birth control method" disclaimer now
renders wherever the fertile-window estimate shows, and the cycle-day
log modal collapses pain/symptoms/notes behind an optional disclosure
(period/flow only is mandatory) to reduce daily-tracking burden.

Nutrition, sleep, medications, wellbeing and activity each got a
smaller, targeted pass rather than a rebuild: Nutrition gained a
`GET /nutrition/recent-meals`-backed "log again" chip row (the
research's #1 named cause of tracking-fatigue churn is retyping every
field every time) and an honesty caption on totals — deliberately
*not* a calorie goal or color-coded/streak mechanic, since the codebase
already had none of that and the research is explicit that shame-based
feedback drives disordered-eating risk. Sleep got copy fixes so its
bedtime-`consistencyScore` and 1-5 quality rating can't read as a
device "verdict" (orthosomnia). Medications gained the one genuine
missing capability in this set — structured `times` + a new
`MedicationLog` model for real TAKEN/SKIPPED/OVERDUE tracking and a
rolling adherence %, in-app only (no push infra, stated as such in the
UI). Wellbeing gained a no-audio guided box-breathing pacer
(`src/components/BreathingExercise.tsx`) offered alongside the low-mood
explainer. Activity gained a small static library of guided-routine
templates (`activityTemplates.ts`) and a dismissible, skippable
lower-intensity suggestion during the menstrual phase.

Verified via 15 new backend integration tests (regular vs. irregular
cycles, perimenopause, insufficient-data handling, pregnancy
suppression, baseline-deviation detection, medication adherence math
including a retroactive-same-day-log edge case) plus live browser
verification of every new surface against a seeded dev database.

**Security hardening (latest pass):** audited against an external checklist;
only the real gaps were built. Passwords need 12+ characters and must not be
common, contain a run/sequence, or contain the person's name/email
(`server/src/lib/passwordPolicy.ts`, mirrored client-side for live feedback;
the common-password list stays server-only). Sign-in lockout (5 per account /
40 per IP, 15 minutes) lives in the database (`AuthThrottle`), not memory —
the free-tier API sleeps and an in-memory counter silently resets — and counts
unknown emails too so it can't enumerate accounts. Access tokens carry a
millisecond issued-at so a password change / "sign out everywhere"
(`User.sessionsValidAfter`) ends them instantly. TOTP two-factor
(`lib/security/totp.ts`, AES-256-GCM-encrypted secrets, single-use codes,
backup codes) is opt-in by deployment: it needs `TWO_FACTOR_ENCRYPTION_KEY`
and reports itself unavailable without it. Admin accounts can never be
created or changed through the API (`npm run create-admin`), admins need
two-factor in production, and `ADMIN_IP_ALLOWLIST` is optional. Sign-in
outcomes are logged as `security.*` audit events (masked IP, never an email
or secret) and swept after 90 days. `vercel.json` now sends a CSP and the
other headers for the web app. **Two traps for future work:** the phone's
throwaway device account must keep an independent random password (the policy
rejects one derived from its email), and Settings > Security is deliberately
hidden for that account, since a password change or sign-in code would lock
the person out of their own data. Not built: field-level coach data sharing
(a product decision), cookie-consent UI (no cookies/trackers are set),
upload scanning (there are no uploads), and the `react-router` v7 upgrade the
audit flags (a deliberate separate project).

**React Bits components (latest pass):** the landing page (`AnimatedContent` scroll
reveals; its floating pill nav, grain and soft blobs are plain CSS; `SpecularButton` is
vendored but no longer used by it), the signed-in menu (`BranchedMenu`)
and mobile bottom bar (`GooeyNav`), multi-step flows (`Stepper` via `FlowStepper`,
used by onboarding), daily-goal check-in
(`PulseHeart` with the fire glyph), reminders (`BellToggle`), Settings feedback
(`PeekRating`), number entry (`ScrubField`), the dashboard's "To do today"
(`SpringCheck`) and every list (`AnimatedList`) are vendored, unmodified apart
from commented "Women360 change" edits, in `src/components/reactbits/` as
`.jsx` + hand-written `.d.ts` (the repo doesn't `allowJs`). App code uses
them through typed wrappers in `src/components/ui/` (`NumberField`, `ItemList`,
`FlowStepper`) rather than directly where there's a wrapper. Traps: (1) canvas
components that call `loseContext()` in an effect cleanup break under React
StrictMode, which re-runs effects on the same canvas — `SpecularButton` had this
and no longer does it; (2) a `position: fixed` panel rendered inside an element
with `backdrop-filter` (the top bar) is clipped to that element — portal it to
`<body>` (`MobileMenu` does); (3) `NumberField` never pre-fills an empty field —
an unentered value must stay unentered, so an optional macro isn't logged as 0;
(4) streaks are derived from log rows on the person's own calendar day (the
client sends the date) and have no "lost streak" state by design.

**Privacy, public pages and the log popover (latest pass):** a signed-in
person can download everything held about them (`GET /users/me/export`, built
from an explicit list of their own tables so credentials can't leak into it) and
permanently erase their account (`POST /auth/delete-account`: password required,
same lockout as sign-in, admins refused, one cascading delete, audit event with
no id/email). Both live in Settings → Your data; the phone's device-only account
can export but not delete (no password to confirm; it would be re-created).
`/privacy` is a plain-language summary where every statement is backed by code
or hosting — keep it that way: if behaviour changes, change the page, and the
"Still to be confirmed" list is real open work (operator identity/contact,
provider backup retention, terms). `public/` holds the favicon and
`robots.txt`; `vercel.json` sends `X-Robots-Tag: noindex` for the app and
account routes. No sitemap yet: it needs the production domain. New-entry forms
(goal, sleep, meal, activity, measurement, medicine, appointment) open in
`LogPopover` (a MorphingPopover that grows from its button); editing an existing
entry stays in `Modal`, and both render the same form element. Traps: (1) the
popover's panel is portalled to `<body>` for the same containing-block reason as
`MobileMenu`; (2) its focus effect must not depend on an unstable `close`
function or focus snaps back to the first field on every keystroke; (3) only one
`LogPopover` per page may be open-bound to a given state, so empty-state buttons
stay plain `Button`s that set that state; (4) motion animations stall in a
hidden browser pane, so verify open/close with the pane shown.

**Habits and goals are different things (latest pass).** A *habit* is a routine she
repeats (walk 10,000 steps, take a vitamin): `Habit` + `HabitLog`, tracked with a
one-tap daily tick, a streak (days for every-day habits, weeks for "N days a
week"), last-7-days dots, and an amount when it has a target (an amount habit is
done when the logged amount reaches the target; one tap logs exactly the target).
A *goal* has a finish line and a `kind` that decides its fields: `REACH` (a number
moves from where it started to a target, progress measured from `startValue` in
either direction), `TOTAL` (build up to a number), `ONE_OFF` (a single thing, e.g.
book a check-up). Progress is always computed from the numbers
(`server/src/modules/goals/progress.ts`, mirrored in `mappers.ts#goalProgress`).
Existing goals became `TOTAL`, which is how they already behaved. The old goal
check-in streak was replaced by habits: the `GoalCheckIn` table is no longer read
or written but was **not dropped** (that would destroy data); drop it in a
migration once the owner confirms. The bottom bar now shows Habits instead of
Goals, since habits are the daily-use screen. Dependabot is monthly and grouped
so it opens one pull request per ecosystem instead of a branch per package.

**Preventive screening (latest pass):** Health > Preventive care now lists
the check-ups India's national programme (NPCDCS / NP-NCD: blood pressure and
blood sugar yearly from 30; oral, breast and cervical screening every 5 years,
30-65) and WHO suggest, works out "next due" from the person's own date of
birth and the date she last had each, and records it in one tap
(`ScreeningRecord`; `server/src/modules/screening/`). The rules, intervals and
their named sources live in one file, `guidelines.ts`, and are served to the
client, so the UI states no medical claim of its own. **They are marked "Draft:
not yet reviewed by a clinician" and must stay so until one has.** Rules worth
keeping: with no record the state is "not recorded yet", never "overdue" (that
would alarm everyone on day one); past the stated age range with no record it
says "ask your doctor", not "stop"; "due" is the only state that surfaces on the
Today list. Mammography is described only as what WHO says (usually 50-69),
because India has no national programme for it; the HPV-vaccination rollout was
reported only by non-official outlets and is deliberately not stated.

**Roles, demo accounts and reproductive records (latest pass):** each role has
its own web area, chosen at sign-in by `lib/roleHome.ts` and guarded by
`ProtectedRoute role=...`: women use `/app`, coaches `/coach` (the people who shared
with them: summary charts and notes), administrators `/admin` (overview, users and
roles, audit log, feedback, Learn content) inside `StaffShell`. Women grant and revoke
coach access under Settings > Privacy & sharing (`CoachAccessTab`). `User.isDemo`
marks the three shared evaluator logins created by `server/prisma/seedDemo.ts`
(`npm run seed:demo`; on a hosted database only when `SEED_DEMO_ACCOUNTS=true`,
which `render.yaml` sets). Their passwords are published in the project report, so
they are deliberately low-power: the demo administrator is read-only, sees only demo
accounts and is exempt from the production two-factor rule for that reason; none can
change a password, delete the account, use two-factor or sign out everywhere
(`middleware/demoGuard.ts`). Do not give a demo account more power without
revisiting that. `ReproductiveHealth` (contraception, pregnancy status) is her own
record and is never used to predict or advise. Steps are entered by hand; syncing from
a watch needs a native Health Connect (Android) or HealthKit (iOS) integration and is
not built. The landing and sign-in pages ping the API's health endpoint so the
free-tier server wakes before sign-in.

**Hardening pass (latest):** the server's validation moved to zod 4 (the 3.x line has an
advisory for oversized constrained arrays); the front end no longer lists zod at all (it was
unused). `npm audit --omit=dev` is clean on the server; the front end reports two moderate
react-router findings that only a v7 upgrade fixes (a separate project). Every response carries a
server-generated `X-Request-Id`, which is also in the logs. `/health` is deliberately
cross-origin so the landing and sign-in pages can wake the free-tier server. `/admin` and
`/coach` are noindex like the rest of the app, `/terms` (a draft awaiting legal review) and a
sitemap exist, and HSTS is sent. An axe-core audit of the public pages, every woman screen and the
admin tabs is clean; it is automated, not a full accessibility review. Onboarding now saves every
question it asks (name, date of birth, life stage, cycle and period length, Senior Mode, allergies,
medicines); questions with nowhere to be stored were removed. Messages is read-only (messages plus
coach notes shared with her) and says so. Axe in the dev server needs a temporary script in `public/`:
never commit it.

**Activity catalog, calories and reminders (latest pass):** an activity is chosen from a
fixed catalog (`server/src/modules/activity/catalog.ts`, served at `GET /activity/catalog`):
each has its own effort levels, a MET value per level taken from the 2011 Compendium of Physical
Activities (the code is recorded beside each), and only the extra fields it really has (distance,
sets). Calories are *computed at read time* as MET x latest logged weight x hours and are an estimate
(shown as such; no weight logged means no figure, never a guess); legacy free-text entries were
mapped by the migration and `other` has no estimate. The quick log refuses a repeat of the same
activity, length and effort (unique index, 409, race-safe; the form also stops it). Habits can be
linked to an activity (`Habit.activityCode`, a catalog code or "any"), and those habits appear as
today's to-do on the Activity page. Reminders (`lib/reminders.ts`, `hooks/useReminders.ts`, `public/sw.js`)
fire at the habit's time while Women360 is open; when it is closed the server sends the reminder by web
push (see "Launch readiness" below). The Capacitor WebView has no push, so the installed Android app reminds only while open. Durations use `DurationField`
(hh:mm). Every number entry has clickable up/down arrows (`StepButtons`, hold to repeat, out of the
tab order because the field is already a spinbutton that takes the arrow keys) as well as scrub, typing
and arrow keys: add `NumberField` or `DurationField`, never a bare number input.

**Activity plans and the cycle period fix (latest pass):** on request, a woman can ask for a
personalised activity plan (Activity page > "Build my plan"). It is plain arithmetic on her own data,
not a model: `server/src/modules/activity/plan/` (`planner.ts` is pure and fully unit-tested,
`baseline.ts` reads her last four weeks, `plan.service.ts` persists). Every health claim lives in
`plan/guidelines.ts`, with the WHO 2020 physical-activity guidelines named as the source for the
150-minute aerobic target, the 2 strength days, the 3 balance-and-strength days from age 65, the
pregnancy/postpartum limit and "a vigorous minute counts double"; the build-up rate (the larger of 15
minutes or 20% a week, start at 30) and the session sizes are *our own* cautious design values and are
labelled so. **The plan is marked "Draft: not yet reviewed by a clinician or an exercise professional" and
must stay so until one has.** Rules worth keeping: it is only ever built when she asks and never pushed as an
alert; it is built from her logs, age, time and a few answers; it never promises the target (a
feasibility verdict says whether her history, her weeks or her time limits it, and what would close the
gap); hard effort is allowed only for an adult under 65 with no pregnancy/postpartum status and no listed
conditions; under-18s get no plan; weight loss is deliberately not a goal; the server rebuilds the plan from
her answers and never trusts one sent by the client; progress is computed from her logged activity when she
looks (a session is done when she logged that kind of activity that day). `ActivityPlan` rows are kept
when a plan ends and are in her data export. Cycle: `detectPeriods` now only learns a period's length
when she logged every day of it (`lengthKnown`); logging just the first day, or the first day plus
symptom days, counts the period from its start for her usual length (Settings), so phases follow her cycle
without daily logging. Period days within 8 days of a period's first day belong to it. "Log period started
today" is now a toggle that says "Period started today" and undoes on a second tap (restoring the day as it was
before the tap, and asking first if she has added anything since).

**Conditions and "worth discussing with a doctor" signals (latest pass):** a woman can tell the app she
has PCOS, endometriosis, a thyroid condition, PMDD, perimenopause or anaemia (Cycle > My conditions;
`UserCondition`, never inferred). That adds the symptoms the guidelines list for it to her symptom list, shows
the guideline's own note and sources, and builds a plain-text "summary for my doctor". Separately, the server
looks at her own logs and, when a pattern crosses a published line, shows a collapsed card on the Cycle
page with her own numbers, the line it crosses, what a doctor may check and the source, plus **one** in-app
notification the first time (`server/src/modules/conditions/`: `guidelines.ts` holds every threshold and
citation and separates guideline values from our own "how much data is enough" values; `signals.ts` is pure and
unit-tested; `HealthSignalState` records notified/dismissed, dismissed stays away 90 days). Six patterns:
irregular cycle lengths (PCOS 2023 range, 21-35 days), 90+ days without a period, heavy or long periods (FIGO/NICE
NG88, with low energy as a hint to ask about iron), strong period pain across cycles (ESHRE/NICE, endometriosis),
a mood dip before the period (DSM-5-TR, PMDD, needs daily mood across 2+ cycles) and cycle changes at 40+ (STRAW+10,
NICE NG23). Rules worth keeping: never a diagnosis and never wording like "you have X"; silent without enough
logged data, during pregnancy/postpartum, for a condition she has already declared, or when age explains it
(irregular cycles give way to perimenopause from 45); a period's pain/energy/heavy days are read from symptom-only
days inside her usual period length because she logs only the first day; a flagged "unusual" cycle is left out.
**There is deliberately no thyroid signal**: NICE says to test thyroid only when other symptoms point to it, so
thyroid appears as a possible cause under irregular cycles and as a declarable condition, not as its own alert. All
of it is marked "Draft: not yet reviewed by a clinician" and **every citation and link must be checked by a
clinician before launch**. It is in-app only (no push notification exists yet).

**The landing page is the marketing page and is deliberately short (latest pass):** hero with one
illustration, "What it does" (a typographic grid, no cards), Senior Mode and every age, privacy, four FAQs, a
closing call to action. It leads with prevention because that is what a plain tracker doesn't do. Rules: every
line must describe something the app does today (the check-up and pattern features are marked as not yet
reviewed by a clinician, and the FAQ says so); no testimonials, user counts, ratings, "free" or any pricing
claim (no business model is decided); the phone is an illustration and says "No real data is shown"; no drifting
blobs, tilted cards or extra illustrated sections, and add a section only by removing one. The old life-stage tabs,
"small moments" scroller, example notes and their animation CSS were removed.

**The signed-in home screen is calm by default, and sleep records the real span (latest pass):** the dashboard
(`features/dashboard/DashboardPage.tsx`) is a greeting, "To do today", "Log something", a four-row "Today so far"
(sleep, hydration, steps, mood) and "Upcoming" only when there is an appointment. The cycle card sits at the top
**only while she is menstruating**, and during the ovulation phase only if she turned on "Show ovulation on my
home screen" (Cycle > Settings, `CycleProfile.showOvulationOnHome`, off by default); never when the period is late,
never in follicular or luteal, never with no cycle data (`lib/cycleCard.ts`, unit-tested). The old always-on cycle
hero, "This week" rings and Habits/Goals rows (duplicates of To do and their own pages) were removed: add to the
home screen only by removing something. Sleep: a night is filed under the **morning she woke** (`SleepEntry.date`,
the route key) and stores the day she went to bed (`bedDate`, null on older entries, derived from the two times
when read). The form asks for both a day and a time for bed and for waking; the wake day defaults to one day after
the bed day when the night crosses midnight and to the same day when she went to bed after midnight, the two days
follow each other until she picks one, and the wake day is locked when editing (it is the key). The server works
the duration out from the two days and times itself (`modules/sleep/duration.ts`; wake must be after bed and within
24 hours) rather than trusting the client's number; an older client that sends no `bedDate` still works.

**Launch readiness (latest pass; the owner-only steps are in `docs/OPERATIONS.md`):**
- *Clinician switch.* `CLINICAL_CONTENT` (server env, read per call, only the exact word "true" enables) hides every feature
  that needs clinical review: screening, conditions/"worth discussing" patterns, activity plans, explain-this cards, Learn, and the
  "conditions like PCOS" note in the cycle summary. Server routes answer 404 (`middleware/clinicalGate.ts`); the web app reads
  `GET /config` (`FeaturesProvider`, `useFeatures()`) and removes menus, pages, tiles and landing copy. `render.yaml` sets it to
  false. New clinician-dependent features must use the same gate. Support address: `SUPPORT_EMAIL` (default
  admin.women360@gmail.com), also in `src/config/site.ts`, the privacy/terms pages and the landing footer.
- *Failure handling.* `/health` is deep (`SELECT 1`, 4 s limit: 200 healthy / 503 unhealthy) and is the uptime-monitor target
  (also keeps the free API and database awake). `alertAdmin` emails the support address (1 per problem per 30 min, 20/day, no personal
  data) on 5xx, unhandled rejection/uncaught exception, database down and client crash reports (`POST /client-errors`, anonymous,
  route shape + short message). The web app has an `ErrorBoundary`; every data screen has a load-failed state with Try again, and only a
  rejected session (401) signs her out: a server hiccup never does. Every new screen needs its failed state; the browser suite checks it.
- *Tests.* Playwright (`npm run e2e`, `e2e/`) drives real Chrome against the real API and database with a fresh account per run and
  fails on any unexpected console or page error: public pages, journeys, switched-off features, server-failure behaviour, axe-core
  (WCAG 2.2 AA + best practice, light and dark) on every screen, push (06, local Chrome only: it needs Google's push service) and
  usage (07). CI runs it in the `browser` job. Rate limits are env-configurable (`API_RATE_LIMIT_PER_MINUTE`,
  `AUTH_RATE_LIMIT_PER_15_MIN`) only so the suite can run from one address.
- *Service status.* Administration > Overview shows the running server's own report (`GET /admin/system`, `modules/system/`):
  database answering, email configured, reminders on and last check, last verified backup restore (the nightly job reports it to
  `POST /internal/backup-report` with `BACKUP_REPORT_TOKEN`), clinical switch, server start time. Booleans and times only; never add a
  secret or an address to it. A slow request (over 4 s) shows "Waking the service up" (`WakingNotice`, `apiClient.timedFetch`).
- *Backups.* `server/scripts/backup/`: encrypted (AES-256-GCM, scrypt) `pg_dump`, credentials only via PG* environment variables,
  nightly `.github/workflows/backup.yml` restores into a scratch database and checks every table's row count against counts recorded
  before the dump. Needs secrets `DATABASE_URL` and `BACKUP_PASSPHRASE`; it only warns until they exist.
- *Closed-app reminders (web push).* `server/src/modules/push/`: VAPID keys (`npm --prefix server run push:keys`; off without them),
  `PushSubscription` and `PushSent` tables, an in-process scheduler (every minute, only while the API is awake: the uptime monitor is what
  keeps it awake), per-device time zone, claim-then-send so a reminder is sent once, retry on a failed delivery, forget a device the push
  service reports gone. Habit reminders (not done, week not met) and medicine doses (no dose recorded). **Traps:** the push address comes
  from the browser, so it must pass `isTrustedPushEndpoint` (SSRF); the text is deliberately generic (it can show on a lock screen):
  do not put a habit or medicine name in it; demo accounts cannot subscribe; Chrome refuses the Push API in incognito, and the first
  subscription can take about 30 seconds; iPhone/iPad need the app on the Home Screen (`manifest.webmanifest`); the Android WebView has no
  push. `Medication.times` doses are still read on the server's clock elsewhere (pre-existing), so only the push reads them on her clock.
- *Analytics.* `server/src/modules/usage/`: anonymous counts per UTC day (`UsageCount`): screens opened (`POST /usage/view`, fixed list) and
  actions (matched from successful requests in `usage.middleware.ts`), plus different-women-active from one-way hashes with a salt that
  exists for one day and is deleted with the hashes (`UsageSeen`, `UsageSalt`). Only signed-in women are counted (not staff, not demo
  accounts, not browsers sending Do Not Track / Global Privacy Control). Admin > Usage shows it; the demo administrator is refused. The
  privacy page describes it: if what is counted changes, change the page. Never add a user id, address or device to these tables.
- *Load performance.* Keep the entry chunk small: every route (login, register, onboarding, both shells, every page) is a `lazy()`
  import in `App.tsx`; do not import a page, the shells or `motion` statically from the entry path. The PDF library loads only when a report is
  opened (`import()` in `ReportsPage`). The landing page uses a dependency-free `AnimatedContent` (IntersectionObserver + CSS, the GSAP original
  was dropped: it also hid the hero until the library ran). Fonts are self-hosted variable fonts and preloaded; `vercel.json` caches `/assets/*`
  as immutable (hashed names), so a new dependency that is large belongs behind a dynamic import. Check with `npx vite build --sourcemap` and a
  per-package tally of the entry map before and after adding a dependency.
- *Android.* `android/` builds a signed release (`keystore.properties` or `ANDROID_*` variables; key kept outside git), API 36, backups
  off, manual `android.yml` workflow. It loads the live website. Not yet verified on a device or emulator.

- No `sitemap.xml` (needs the production domain), no terms of use page, no
  Open Graph image or canonical URLs (same reason). Per-route titles exist for
  the signed-in app and `/privacy`; the landing page uses the static title.
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
- Email: a provider-agnostic mailer exists (`server/src/lib/mailer.ts`: Brevo's HTTPS API via `BREVO_API_KEY`,
  or SMTP via `SMTP_URL`; `MAIL_FROM` defaults to `Women360 <SUPPORT_EMAIL>`; links built from `APP_URL`) and
  password-reset emails and server alerts are sent through it. Render's free tier blocks SMTP, which is why the
  HTTPS API is preferred. **Until `BREVO_API_KEY` (or `SMTP_URL`) is set on Render, no email is sent and a forgotten
  password cannot be recovered**; steps are in `docs/OPERATIONS.md`. There is still no email verification at
  sign-up and no email reminder preference (the Settings switch that pretended otherwise was removed).
- Messages cannot be replied to (the reply box that only pretended to send was removed). The
  `Message` Prisma model itself has no sender-as-current-user concept
  (just a `senderLabel` display string and a `recipientId`), so this
  needs a data-model decision (a real conversation/thread model) before
  it can be implemented, not just a service method.
- Registration only ever creates a woman account. Coach accounts are made by an
  administrator changing a role; administrator accounts only by an operator
  (`npm run create-admin`), never through the API or UI.

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
