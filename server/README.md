# Women360 — API server

Node.js + TypeScript + Express + Prisma (PostgreSQL) backend for Women360,
built against the domain model in `Documentation/SRS.pdf` and the
frontend's existing `src/types/index.ts`. See `/CLAUDE.md` at the repo
root for the product-wide standard this must keep meeting.

## Stack

Express 4 · TypeScript · Prisma 5 (PostgreSQL) · Zod validation · JWT
access tokens + rotating opaque refresh tokens · Argon2id password hashing
· Helmet + CORS + per-route rate limiting · Pino structured logging ·
Vitest + Supertest.

## Layout

```
prisma/schema.prisma   Data model (see the file's own header comment for scope notes)
prisma/seed.ts         Local/demo seed data — never run against production
src/config/env.ts      Validated environment configuration (fails fast on bad config)
src/lib/               Cross-cutting: prisma client, jwt, password hashing, errors,
                        response envelope, logging, audit log helper
src/middleware/        requireAuth, requireRole (RBAC), validate (zod), error handling,
                        rate limiting, request logging
src/modules/<domain>/  One folder per bounded context: <domain>.routes.ts (wiring),
                        <domain>.service.ts (business logic + data access),
                        <domain>.validation.ts (zod schemas)
tests/                 Vitest unit/integration tests
```

Every module follows the same shape, so a new domain is: a Prisma model,
a `<domain>.validation.ts`, a `<domain>.service.ts`, a `<domain>.routes.ts`,
and one line in `src/modules/router.ts`.

## Setup

```bash
cp .env.example .env        # fill in real secrets — never commit .env
docker compose up -d        # local Postgres only; not a deployment topology
npm install
npm run prisma:migrate      # creates the schema in your local database
npm run prisma:seed         # optional demo data (admin/coach/woman accounts)
npm run dev                 # starts the API on http://localhost:4000
```

Demo accounts after seeding (password for all: `Demo-Password-123`):
`admin@women360.local` (ADMIN), `coach.meera@women360.local` (COACH),
`sarah.menon@women360.local` (WOMAN).

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm run lint` ·
`npm run typecheck` · `npm test` · `npm run prisma:studio` (visual DB
browser).

## Verification status

This backend was originally authored in a sandbox with no network or shell
access, so it shipped unverified. It has since been installed, linted,
typechecked, built, and run for the first time; `npm test` passes (21/21).
That pass also found and fixed three real defects that had never surfaced
before: the whole codebase was configured as a strict ESM project
(`"type": "module"` + `moduleResolution: "NodeNext"`) while every import
omitted the file extensions that mode requires, which made `tsc` fail
outright even though `npm run dev` (via `tsx`, which doesn't enforce that
rule) looked fine — fixed by moving to CommonJS module resolution plus
`tsc-alias` so the `@/*` path alias still resolves in the compiled output;
`recordAudit`'s `metadata` field didn't satisfy Prisma's `Json` input type;
`signAccessToken` passed a plain `string` where `jsonwebtoken`'s stricter
`expiresIn` type is expected; and `health.service.ts`'s `assertOwner` was
declared `async` with an `asserts` return type, which TypeScript
disallows — and because every call site invoked it without `await`, a
failed ownership check would have thrown inside an unhandled promise
rejection instead of surfacing as the intended 403/404.

What has **not** been run yet: the full suite against a real Postgres
instance (`docker-compose.yml` needs to be started manually first) and any
manual/exploratory testing of the running API beyond `/health`. Prisma has
also never had a migration generated (`prisma/migrations/` is empty) — run
`npm run prisma:migrate` against a real database before relying on schema
changes being tracked.

## Security notes

- Access tokens are short-lived JWTs (15 min default); refresh tokens are
  opaque random strings, only their SHA-256 hash is ever stored, and they
  rotate on every use — a stolen database dump alone cannot be replayed as
  a session, and a stolen-but-already-used refresh token is a dead end.
- Passwords are hashed with Argon2id (OWASP's current recommendation).
- `requireRole` enforces role-based access on the server for every
  protected route — the frontend hiding navigation by role is UX only, not
  the security boundary.
- A Wellness Coach only ever sees a Woman's data after she explicitly
  grants it (`POST /coach/sharing`), and even then only a defined summary
  — never her medications or health profile (`src/modules/coach/coach.service.ts`).
- Nothing in `src/lib/logger.ts`'s redaction list, or the audit log, ever
  captures a password, token, or health-record value — the audit log
  records that an action happened, never its payload.
- Auth endpoints are rate-limited separately and more tightly than the
  rest of the API (`src/middleware/rateLimit.ts`).

## What's deliberately not here yet

Object storage for file uploads/report exports, email delivery (password
reset currently logs that a reset was requested rather than sending an
email), and the frontend cutover (`apiClient.ts` still points at mock
data) are the next pieces — see the root [`README.md`](../README.md#backend)
for what the cutover still needs.
