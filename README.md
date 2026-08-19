# Women360 — Frontend

Production-quality frontend for **Women360**, a women's health & wellness SaaS
(Cloud Computing course project). This phase covers the complete Woman/End
User experience: authentication, onboarding, the full app shell, all core
modules, theming, and the **Senior Mode** USP — built against a replaceable
mock service layer so the real backend can be swapped in later without a UI
rewrite.

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
