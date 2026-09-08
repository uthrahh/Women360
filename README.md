# Women360

Women360 is a women's health & wellness platform spanning ages 18–100+,
built to the standard set in [`CLAUDE.md`](./CLAUDE.md) — read that first
before making a change of any size. This repository is a monorepo: the
frontend lives at the repository root (below), and the API server lives in
[`server/`](./server/README.md).

## Frontend

Production-quality frontend for Women360. This phase covers the complete
Woman/End User experience: authentication, onboarding, the full app shell,
all core modules, theming, and the **Senior Mode** USP — built against a
replaceable mock service layer so the real backend can be swapped in
without a UI rewrite.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · React Router · Recharts ·
Lucide icons · React Hook Form + Zod (wired for future form validation)

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. Register a new account (any email/password) or
just fill in the login form — the mock `authService` accepts anything and
persists a session to `localStorage`.

## Project structure

```
src/
  components/
    ui/        Design-system primitives (Button, Card, Input, Tabs, Modal, Toast, states...)
    layout/    App shell, sidebar, bottom nav, top bar, Senior Mode shell
  features/    One folder per product area (dashboard, cycle, nutrition, ...)
  context/     App-wide React context (auth, theme, Senior Mode)
  hooks/       useAuth, useTheme, useSeniorMode
  services/    Mock service layer — the ONLY thing that will change when the
               real backend arrives (see src/services/apiClient.ts)
  mock/        Seed data consumed by the services
  types/       Shared domain types
  config/      Navigation configuration (drives both standard and Senior nav)
  routes/      Route guards
```

## Design system

Deep maroon/burgundy on warm off-white (light) and near-black (dark) —
defined as CSS variables in `src/index.css` and Tailwind tokens in
`tailwind.config.ts`. Display type is Fraunces; body/UI type is Inter.

## Senior Mode

Toggle it from the top bar or Settings → Accessibility. It doesn't just scale
up the existing UI — it swaps the entire navigation model for a short list of
large, plain-language tiles ("My health", "My medicines", "My appointments"…)
that the person chooses themselves in **Settings → Customize essentials**.
That selection is persisted to `localStorage` today; the shape
(`SeniorEssential[]`) is ready to persist server-side once the backend exists.

## Connecting the real backend later

Every feature calls a function in `src/services/*.ts`, never mock data or
`fetch` directly. To go live:

1. Implement `request()` in `src/services/apiClient.ts` against the real REST API.
2. Replace each service function's body with a `request()` call to the matching endpoint.
3. Delete `src/mock/seed.ts` once nothing references it.

No component or page needs to change.

## What's included in this phase

- Landing page, full auth flow (login/register/forgot/reset), multi-step onboarding
- App shell: sidebar (desktop) / bottom nav (mobile) / Senior Mode tile grid, light & dark themes
- Dashboard, Health hub, Cycle, Nutrition, Activity, Sleep, Wellbeing, Goals,
  Insights, Reports, Learn, Messages, Settings (incl. Senior Mode essentials
  customization and an emergency-contact tab)
- Loading, empty and (where applicable) error states throughout
- Responsive layouts for mobile, tablet, desktop; visible focus states; reduced-motion support

## Known gaps for the next phase

- Coach and Admin role UIs are stubbed conceptually in the SRS but not built —
  this phase is scoped to the Woman/End User experience as instructed.
- Forms use light custom validation; wiring `react-hook-form` + `zod` schemas
  per-form is the natural next step (both are already dependencies).
- No test suite yet.
- `npm run lint` currently has no ESLint config/dependency to run against —
  tracked as a known gap, not yet fixed.

## Backend

A real API lives in [`server/`](./server/README.md): Node/Express + TypeScript
+ Prisma on PostgreSQL, with JWT auth, server-side role-based access control,
and one module per domain modeled on the SRS's data requirements. See
`server/README.md` for setup.

**Cutover status: complete.** Every service in `src/services/*.ts` — auth,
cycle, nutrition, activity, sleep, wellbeing, goals, health, insights,
reports, learn, messages, notifications — is live against the real API via
`apiClient.ts`'s real `request()` (Bearer auth, shared refresh-and-retry on
401) and a shared `src/services/mappers.ts` that translates the backend's
`UPPER_SNAKE_CASE` enums, a few renamed fields (e.g. `proteinG`/`fibreG` vs
`protein`/`fibre`), and relative-time/day/weekday display formatting (the
mock era used phrases like "Today"/"Yesterday"/"2h ago" instead of raw
timestamps, and no page formats these itself). `src/mock/seed.ts` has been
deleted. No page or component had to change except two deliberate,
named exceptions: `CyclePage` gets a real empty state for a brand-new
user's null cycle data (fabricating a fake cycle day/phase would be
misleading in a menstrual-health product), and `DashboardPage`'s Goals
tile now derives its count from real data instead of a hardcoded "3/4".

Known remaining gap in this area (see `CLAUDE.md` §3): `DashboardPage`'s
two "Trends worth noticing" cards are still hardcoded copy — a real
week-over-week comparison doesn't exist in the backend yet, so this is
feature work, not a mechanical service swap. The greeting and Mood tile
were fixed the same way as Goals: reading `auth.user.name` and a new
`wellbeingService.getTodayMood()` respectively.
