# Women360 — Review 2 Report

**BCSE408L — Cloud Computing**
**Project:** Women360 — a cloud-native women's health & wellness SaaS platform

| | |
|---|---|
| Team member 1 | Pavithra Uthrah R K |
| Team member 2 | *[fill in name]* |
| Registration number(s) | *[fill in]* |
| Course slot / section | *[fill in]* |
| Faculty in-charge | *[fill in]* |
| Review | Review 2 |
| Date | *[fill in submission date]* |
| GitHub repository | https://github.com/uthrahh/Women360 |
| Live frontend | https://women-360.vercel.app |
| Live API | https://women360-api.onrender.com |

> This report documents Women360's system architecture, cloud architecture, database design, module design, API design, authentication model, and the initial cloud deployment, per the Review 2 deliverable checklist. Supporting diagrams referenced throughout are in this same `Documentation/` folder.

---

## 1. System Architecture

Women360 is built as a **monorepo with two independently deployable applications**, connected only over HTTP:

```
Women360/
├── src/                    Frontend — React 18 + TypeScript + Vite SPA
│   ├── components/ui/      Design-system primitives (Button, Card, Modal, Toast, states...)
│   ├── components/layout/  App shell: sidebar, bottom nav, Senior Mode navigation
│   ├── features/           One folder per product area (dashboard, cycle, nutrition,
│   │                       activity, sleep, wellbeing, goals, health, insights,
│   │                       reports, learn, messages, settings, onboarding, auth)
│   ├── services/           One file per domain; the ONLY layer that talks to the API
│   ├── context/, hooks/    App-wide auth/theme/Senior-Mode state
│   └── types/              Shared frontend domain types
│
├── server/                 Backend — Node.js + TypeScript + Express + Prisma API
│   └── src/
│       ├── modules/        One folder per domain (see §5 Module Design)
│       ├── middleware/     requireAuth, requireRole (RBAC), validate (zod), rate limiting
│       ├── lib/             Prisma client, JWT signing, password hashing, response envelope
│       └── config/          Validated environment configuration
│
└── prisma/schema.prisma    Single source of truth for the relational data model
```

**Request flow (a typical write, e.g. logging a meal):**

```
Browser (React component)
   → src/services/nutritionService.ts        (domain method call)
   → src/services/apiClient.ts request()      (adds Bearer token, JSON envelope)
   → HTTPS
   → Express route (server/src/modules/nutrition/nutrition.routes.ts)
   → requireAuth middleware                    (verifies JWT, attaches req.user)
   → validate middleware                       (zod schema on the request body)
   → nutrition.service.ts                      (business logic, ownership checks)
   → Prisma Client → PostgreSQL
   ← JSON envelope { ok, data | error } back through the same chain
```

Every layer has a single, narrow responsibility: **routes** wire HTTP to handlers and declare validation; **validation** (zod) rejects malformed input before it reaches business logic; **services** hold the actual logic and are the only layer that talks to Prisma; **Prisma** is the only layer that talks to SQL. The frontend mirrors this discipline — no component calls `fetch` directly; everything goes through a `services/*.ts` file, which is what allowed the entire backend to be built and swapped in later without changing a single page.

A shared `mappers.ts` module on the frontend is the one place that translates between the backend's `UPPER_SNAKE_CASE` enums and the frontend's lowercase domain vocabulary, so the translation logic exists exactly once.

*(See `System Architecture Diagram.png` in this folder for the visual component diagram.)*

---

## 2. Cloud Architecture

Women360 is deployed across three managed cloud services, chosen deliberately within the SRS's approved list (§4: Postgres/Mongo Atlas/Firebase/Supabase for the database; Render/Railway/AWS/Azure/GCP/Firebase for hosting):

| Layer | Provider | Service type | Why |
|---|---|---|---|
| Frontend | **Vercel** | Static SPA hosting + global CDN | Free tier, git-integrated auto-deploy on every push, purpose-built for Vite/React |
| API | **Render** | Node.js web service | Free tier, git-integrated auto-deploy, runs a persistent long-lived Node process (not serverless functions) |
| Database | **Supabase** | Managed PostgreSQL | Free tier has no hard expiry (Render's own free Postgres expires after 30 days, which would kill the database mid-semester); an SRS-approved option in its own right |

```
                     ┌─────────────────────┐
   End user  ───────►│   Vercel (CDN)       │  https://women-360.vercel.app
   (browser)         │   React SPA (static) │
                     └──────────┬──────────┘
                                │ HTTPS + JWT Bearer, CORS-restricted
                                ▼
                     ┌─────────────────────┐
                     │   Render (compute)   │  https://women360-api.onrender.com
                     │   Express API        │
                     │   (Node.js process)  │
                     └──────────┬──────────┘
                                │ TLS Postgres connection
                                ▼
                     ┌─────────────────────┐
                     │   Supabase           │
                     │   Managed PostgreSQL │
                     └─────────────────────┘
```

**Deployment pipeline:** both Vercel and Render are connected directly to the `main` branch of the GitHub repository. Every push triggers an independent build and deploy on each platform — there is no manual upload step. The API's build step (`server/render.yaml`, a Render Blueprint) runs `npm ci --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy`, meaning **every schema migration is applied automatically to production on deploy**, not as a separate manual step.

**Configuration is environment-driven**, never hardcoded: the API reads `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGINS` from Render's environment variables (validated at boot with zod — the process refuses to start on invalid config); the frontend reads `VITE_API_BASE_URL` from Vercel's environment variables, inlined into the static bundle at build time.

*(See `Cloud Architecture & Deployment Diagram.png` for the visual deployment diagram.)*

---

## 3. Database Design

PostgreSQL via Prisma ORM, **25 models** across eight domains, all scoped to a `User` by a `userId` foreign key with `onDelete: Cascade`:

| Domain | Models |
|---|---|
| Identity & access | `User`, `RefreshToken`, `PasswordResetToken` |
| Profile & preferences | `HealthProfile`, `EmergencyContact`, `SeniorEssentialPreference` |
| Menstrual & reproductive health | `CycleProfile`, `CycleEntry` |
| Nutrition | `NutritionGoal`, `MealEntry`, `HydrationLog`, `FruitVegLog` |
| Activity & sleep | `ActivityGoal`, `ActivityEntry`, `StepsLog`, `SleepEntry` |
| Wellbeing & goals | `WellbeingEntry`, `Goal` |
| Preventive care | `Appointment`, `Medication`, `VitalMeasurement` |
| Reports, messaging, learning | `Report`, `Notification`, `Message`, `LearnArticle` |
| Coach & administration | `CoachAssignment`, `CoachNote`, `AuditLog` |

**Design decisions worth noting:**
- **Role-based identity, not separate tables per role.** `User.role` (`WOMAN` / `COACH` / `ADMIN`) is a single enum column, enforced server-side by a `requireRole` middleware on every protected route — never trusted from the client.
- **Goal progress is never stored as a percentage.** `Goal.currentValue` and `Goal.targetValue` are real numbers with a `unit` string (e.g. "8000 steps"); the percentage shown anywhere in the app is always computed as `currentValue / targetValue`, so it can never drift out of sync with the underlying numbers.
- **Sleep quality is a 1–5 rating** (`SleepEntry.quality`, 1 Very poor .. 5 Excellent), not a 0–100 percentage — a deliberate scale choice to keep the metric intuitive rather than falsely precise.
- **Nutrition totals are never separately cached.** `MealEntry.calories/proteinG/carbsG/fatG/fibreG` are all `Float` (supporting one decimal place); a day's totals are always summed live from the actual meal rows at read time, so they can never disagree with what was logged.
- **Coach access is opt-in and audited.** A `CoachAssignment` only exists once a woman explicitly grants it; every privileged/administrative action is written to `AuditLog` (structural metadata only — action, actor, target — never the health record contents themselves).

*(See `ER- Diagram.png` for the full entity-relationship diagram.)*

---

## 4. Module Design

The backend has **16 domain modules** under `server/src/modules/`, each following an identical three-file shape:

```
<domain>/
├── <domain>.routes.ts       Express router: wires HTTP verbs + paths to handlers,
│                            declares which zod schema validates the request
├── <domain>.service.ts      Business logic: the only layer that calls Prisma;
│                            owns ownership checks (a user can only touch their own rows)
└── <domain>.validation.ts   zod schemas for request bodies/params/queries
```

Modules: `auth`, `users`, `cycle`, `nutrition`, `activity`, `sleep`, `wellbeing`, `goals`, `health`, `insights`, `reports`, `learn`, `messages`, `notifications`, `coach`, `admin`.

This uniform shape means adding a new domain is mechanical (a Prisma model + three files + one line in `router.ts`), and it's what let four modules (Nutrition, Sleep, Cycle, Goals) be taken from read-only mockups to full CRUD without touching any other module's code.

*(See `Backend Module Design & Component Diagram.png` for the component diagram.)*

---

## 5. API Design

All endpoints are namespaced under `/api/v1`, return a consistent JSON envelope (`{"ok": true, "data": ...}` or `{"ok": false, "error": {"code", "message"}}`), and — except `/auth/register`, `/auth/login`, `/auth/refresh`, and the password-reset endpoints — require a valid `Authorization: Bearer <token>` header.

| Module | Method & path | Purpose |
|---|---|---|
| **auth** | `POST /auth/register` | Create account, return session |
| | `POST /auth/login` | Authenticate, return session |
| | `POST /auth/refresh` | Rotate access/refresh token pair |
| | `POST /auth/logout` | Revoke a refresh token server-side |
| | `POST /auth/password-reset/request` | Request a reset token (enumeration-safe) |
| | `POST /auth/password-reset/confirm` | Consume a reset token |
| | `POST /auth/onboarding/complete` | Mark onboarding done |
| | `GET /auth/me` | Current authenticated user |
| **users** | `PATCH /users/me` | Update profile |
| | `GET/PUT /users/me/emergency-contact` | Emergency contact |
| | `GET/PATCH /users/me/senior-essentials` | Senior Mode tile selection |
| | `GET/PUT /users/me/health-profile` | Allergies/conditions |
| **cycle** | `GET /cycle/summary` | Current day/phase/prediction |
| | `GET /cycle/entries` | History |
| | `PUT/DELETE /cycle/entries/:date` | Log/edit/remove a day |
| | `GET/PUT /cycle/profile` | Average cycle/period length |
| **nutrition** | `GET /nutrition/today` | Daily summary (live-aggregated) |
| | `POST/PATCH/DELETE /nutrition/meals[/:id]` | Meal CRUD |
| | `POST /nutrition/hydration` | Log water |
| | `POST /nutrition/fruit-veg` | Log a serving |
| | `GET/PUT /nutrition/goal` | Nutrition goals |
| **activity** | `GET /activity/summary` | Weekly summary |
| | `POST/DELETE /activity/entries[/:id]` | Activity CRUD |
| | `POST /activity/steps`, `PUT /activity/goal` | Steps, goals |
| **sleep** | `GET /sleep/summary` | Weekly summary + history |
| | `PUT/DELETE /sleep/entries/:date` | Log/edit/remove a night |
| **wellbeing** | `GET /wellbeing/entries`, `PUT /wellbeing/entries/:date` | Mood/stress/energy check-ins |
| **goals** | `GET/POST /goals`, `PATCH/DELETE /goals/:id` | Goal CRUD |
| **health** | `GET/POST/PATCH/DELETE /health/appointments[/:id]` | Appointments |
| | `GET/POST/PATCH/DELETE /health/medications[/:id]` | Medications |
| | `GET/POST /health/vitals` | Vitals |
| **insights** | `GET /insights` | Derived, non-diagnostic trends |
| **reports** | `GET /reports`, `GET /reports/:id`, `POST /reports` | Health report generation |
| **learn** | `GET/POST/PATCH/DELETE /learn[/:id]` | Educational content |
| **messages** | `GET /messages`, `PATCH /messages/:id/read` | Messaging |
| **notifications** | `GET /notifications`, `PATCH /notifications/:id/read` | Notifications |
| **coach** | `POST/DELETE/GET /coach/sharing`, `GET /coach/assigned-women`, `GET/POST /coach/women/:womanId/*` | Coach ↔ woman data sharing |
| **admin** | `GET /admin/users`, `PATCH /admin/users/:userId/role`, `DELETE /admin/users/:userId`, `GET /admin/audit-log` | Administration (role-gated) |

---

## 6. Authentication

- **Password storage:** Argon2id (OWASP's current recommendation) — never plaintext, never a reversible cipher.
- **Session model:** short-lived JWT **access tokens** (15 minutes, stateless, carry `{sub, role}`) plus long-lived, opaque, random **refresh tokens** (30 days). Only the SHA-256 hash of a refresh token is ever stored in the database — a stolen database dump alone cannot be replayed as a live session.
- **Rotation:** every use of a refresh token immediately revokes it and issues a new pair, so a stolen-but-already-used refresh token is a dead end for an attacker.
- **Identity is never trusted from the client.** Every protected route derives the acting user from the verified JWT (`requireAuth` middleware sets `req.user`), never from a request body or query parameter — confirmed by a full-codebase audit that found zero routes trusting a client-supplied user ID.
- **Authorization is enforced twice:** `requireRole` gates entire route groups (e.g. `/admin/*`), and every service method that reads/writes a specific record (a goal, a meal, a report) independently checks that record's `userId` matches the authenticated user before allowing access — verified by automated tests that register two users and confirm one cannot read, edit, or delete the other's data (`403 Forbidden`).
- **No account enumeration:** login and password-reset failures return one identical, generic message regardless of whether the email exists or the password was wrong.
- **Logout is real, not cosmetic:** it revokes the refresh token's database row, so the session cannot be resumed even if the token value leaked.

*(See `Authentication & RBAC Sequence Diagram.png` for the sequence diagram.)*

---

## 7. Core Modules (functional depth)

Four modules were taken to full, tested CRUD depth as the functional centerpiece of this phase:

- **Nutrition** — meal logging with calories/protein/carbs/fat/fibre (one decimal place), live daily totals aggregated directly from that day's actual records (not a separately-cached counter), hydration and fruit-&-veg quick-logging, full edit/delete.
- **Sleep** — bedtime/wake-time logging with automatic overnight-crossing duration calculation, a 1–5 quality rating (never a percentage), weekly trend chart, full edit/delete.
- **Cycle** — calendar-based period/flow/symptom logging, a derived (never fabricated) current-phase and next-period estimate based on the user's own logged history, explicitly labeled as an estimate rather than a diagnosis.
- **Goals** — real current/target values with a unit, live-computed progress, active/completed views, manual progress updates and completion toggling.

Every one of these has automated integration tests that exercise it through the real HTTP API against a real database (registering a user, performing the CRUD sequence, and asserting on the actual stored/returned values) — not just unit tests against mocked data.

---

## 8. GitHub Repository

**https://github.com/uthrahh/Women360**

- Single monorepo, `main` branch, regular incremental commits with descriptive messages (not one bulk upload).
- Both frontend (`root`) and backend (`server/`) have their own linting, TypeScript strict-mode typechecking, and automated test suites (44 backend integration/unit tests, 12 frontend unit tests, all currently passing).
- `render.yaml` and `vercel.json` are committed at the repo root, so the entire cloud deployment configuration is version-controlled alongside the code, not configured only by hand in each provider's dashboard.

---

## 9. Initial Cloud Deployment

| | |
|---|---|
| Frontend (live) | https://women-360.vercel.app |
| API (live) | https://women360-api.onrender.com |
| API health check | https://women360-api.onrender.com/health |
| Database | Supabase-managed PostgreSQL (private connection string, not public) |

**Verified working end-to-end** (not just "the build succeeded"): a real account can be registered through the live frontend, receives a real JWT session from the live API, and that session is persisted in a real Supabase-hosted Postgres database — confirmed by directly testing signup, login, and session persistence against the production URLs above, not just localhost.

**A note on the free tier:** Render's free web service spins down after 15 minutes of inactivity and takes roughly 30–50 seconds to wake up on the next request — expected behavior for a free-tier demo, not a defect. This is disclosed here rather than left as a surprise during a live demo.

---

## Appendix: Diagram index

| File | Covers |
|---|---|
| `System Architecture Diagram.png` | §1 System Architecture |
| `Cloud Architecture & Deployment Diagram.png` | §2 Cloud Architecture |
| `ER- Diagram.png` | §3 Database Design |
| `Backend Module Design & Component Diagram.png` | §4 Module Design |
| `Authentication & RBAC Sequence Diagram.png` | §6 Authentication |
| `Use Case Diagram.png` | Carried over from Review 1 — functional scope |
