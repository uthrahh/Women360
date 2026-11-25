# Launch standard

Every item from the owner's launch checklists (app-store review, legal, security, UX, launch basics and the 111
production-engineering topics), mapped to what Women360 does about it. **This list must stay true at all times**:
CLAUDE.md §7 makes it part of the definition of done, and the items marked *(guarded)* are checked automatically on every
push, so breaking one fails CI.

Status words: **Done** (built and where), **N/A** (doesn't apply to this product today, and why: revisit if that changes),
**Owner** (needs the owner, a dashboard or a lawyer; not code). Where a checklist item is wrong for this product, the reason is
stated instead of building something for show.

Automated guards:
- `npm run check:compliance` (`scripts/compliance-check.mjs`, CI `frontend` job): secrets, public env names, placeholder copy,
  licences, required pages and routes, row-level security on new tables, SQL built from strings, raw HTML.
- Server tests: `security.hardening.test.ts` (headers, CORS, no cookies, error bodies, probes, no alert on bad input),
  `security.rls.test.ts` (RLS on every table), `emailVerification.test.ts`, plus the existing auth, roles and privacy suites.
- Browser tests: `e2e/14-launch-standard.spec.ts` (iPad layouts on every screen, footer links, 404, confirmation page, account
  controls), `e2e/05-accessibility.spec.ts` (axe, WCAG 2.2 AA, light and dark), `e2e/04-failure.spec.ts`, `e2e/09-ux.spec.ts`.
- CI `secrets` job: gitleaks over the full git history.

---

## 1. App-store review (why apps get rejected)

| Item | Status |
| --- | --- |
| Payments inside the app (e.g. Stripe checkout) | N/A: nothing is sold. If anything is ever sold inside the iOS or Android app, it must use the store's in-app purchase. |
| Google sign-in without Sign in with Apple | N/A: only email and password. Adding any third-party sign-in means adding Sign in with Apple to the iOS app too. |
| No way to delete the account | Done: Settings > Your data > Delete my account (password, cascading delete). *(guarded: route must exist; e2e checks the button)* The phone's device-only account is erased by clearing the app's storage; say so in the store listing. |
| "A website in a box" | Owner/risk: the Android app loads the live website in a WebView. Apple rejects that (guideline 4.2); before an iOS release it needs native value (offline logging, native notifications, HealthKit). Google Play accepts it but the same risk applies to reviews. |
| Demo login broken or missing features | Done: `npm run seed:demo` makes three shared reviewer logins. They are deliberately read-limited (no password change, deletion or two-factor); tell the reviewer that in the review notes and give them a normal account too so deletion can be tested. |
| UI broken on iPad | Done: *(guarded)* every public and signed-in screen at 768x1024, 1024x768 and 1024x1366 with no sideways scroll. |
| Screenshots don't match the app | Owner: take store screenshots from the real app; the landing page's phone already says "No real data is shown". |
| "Coming soon" screens | Done: none. *(guarded)* placeholder copy fails CI and the iPad test. Features waiting for a clinician are removed from menus, not shown as "coming soon". |
| Dead support or privacy links | Done: *(guarded)* footer Privacy, Terms, Release notes and Contact (mailto) are followed in the browser suite. |
| Comments without a report button | N/A: there is no content one person posts for others to see. Coach notes are written by an assigned coach the woman chose and can revoke; in a guided programme, coach replies and reviews go only to that one participant, who can leave at any time. Any future comments, forums or community need report and block. |
| Broken "Restore purchases" | N/A: no purchases. |
| Paid features shown without saying they are paid | N/A: nothing is paid; the landing page makes no pricing claim (CLAUDE.md). |

## 2. Legal ("how not to get sued")

| Item | Status |
| --- | --- |
| Privacy policy | Done: `/privacy`, plain language, every line backed by code; updated whenever data handling changes. |
| Terms and conditions | Done as a draft: `/terms`, marked as awaiting legal review. **Owner**: legal review before launch. |
| GDPR applicability | Owner: depends on where it is offered. The design already meets the core GDPR rights (access/export, erasure, minimisation, no tracking without consent). |
| Cookie consent | Done: no cookies are set (tested). Google Analytics, if enabled, asks first and runs on public pages only. |
| Legal basis for processing | Owner: listed under "Still to be confirmed" on the privacy page (consent is the likely basis for health data). |
| Marketing consent | Done: no marketing or promotional messages are sent (stated on the privacy page). Adding any needs explicit opt-in first. |
| Data deletion | Done: whole account, or only cycle and reproductive history; immediate. |
| Data retention | Done: "How long it is kept" on the privacy page, enforced by the daily sweep (security records 90 days, save receipts 24 h, spent tokens 7 days, sent-reminder records 3 days, AI chat question times 2 days, usage counts about 13 months). |
| Data processing agreements | Owner: accept the DPAs of Vercel, Render, Supabase, Brevo (and Google if Analytics is switched on, and Anthropic if the AI chat is switched on). Each offers one in its dashboard or legal pages. |
| Third-party disclosure | Done: "Services that handle it for us" on the privacy page. |
| Data security | Done: see §3, summarised on the privacy page ("How it is protected"). |
| Data breach procedure | Done: `docs/INCIDENTS.md` §4. **Owner**: confirm the regulator and timelines once the countries are decided. |
| Intellectual property | Owner: confirm you own the code, brand and illustrations (all written for this project; the landing illustrations are original drawings, not traced). |
| Open-source licences | Done: *(guarded)* production dependencies are permissive (MIT, ISC, Apache-2.0, BSD, OFL fonts); copyleft or unlicensed fails CI. React Bits is "MIT + Commons Clause": allowed inside the product, never resold as components; notice in `src/components/reactbits/NOTICE.md`. **Owner**: paste React Bits' licence text into that notice. |
| Payments and subscriptions disclosure | N/A: nothing is sold. |

## 3. Security

| Item | Status |
| --- | --- |
| Hide API keys / keys off the front end | Done: secrets live only in Render and GitHub settings. *(guarded)* no `VITE_` variable may be named like a secret; committed env files may hold only public `VITE_` values. |
| Check environment variables | Done: the server validates every variable at start (`config/env.ts`) and refuses to start without the required ones. |
| Check git history for keys | Done: gitleaks over full history in CI; a manual scan of all 199 commits on 2026-11-15 found nothing. |
| Protect admin routes | Done: role checks on the server, admins created only by `npm run create-admin`, two-factor required in production, optional IP allowlist. |
| Authentication | Done: argon2id passwords, short-lived access tokens, rotating refresh tokens, optional two-factor. |
| User permissions | Done: every query is scoped to the signed-in account; role guards on coach and admin routes; a programme coach reaches only enrolments an administrator assigned to them, only while the programme runs, and a refused attempt is audited; tests cover cross-account and cross-coach access (`programmes.test.ts`). |
| Sanitise input | Done: zod validation on every route body, query and parameter. |
| XSS | Done: React escapes output; strict Content-Security-Policy. *(guarded)* no raw HTML. |
| SQL injection | Done: Prisma parameterises everything. *(guarded)* no SQL built from strings. |
| Database rules (row-level security) | Done: RLS on every table, the automatic data API's roles have no rights. *(guarded)* by a server test and by the migration check. |
| Rate limiting | Done: per minute for the API, stricter for auth, plus database-backed sign-in lockout. |
| Spend cap | Owner: everything runs on free tiers today; set a spend limit or alert in Render, Vercel, Supabase and Brevo before upgrading any of them. |
| Secure file uploads | N/A: there are no uploads. |
| CSRF protection | N/A by design: sign-in uses bearer tokens, never cookies (tested), so a cross-site request carries no credentials. |
| CORS settings | Done: only the web app's own origins. *(guarded by test)* |
| HTTPS | Done: Vercel and Render serve HTTPS only; HSTS is sent. |
| Security headers | Done: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (vercel.json and helmet). *(guarded by test)* |
| Secure cookies | N/A: no cookies are set. |
| Disable debug mode | Done: error details are only included outside production; production errors are generic. |
| Production settings | Done: `NODE_ENV=production`, clinical switch off, demo seeding explicit (render.yaml). |

## 4. UX laws (design review rules)

Apply these when designing or reviewing any screen. They are judgement, not tests, except where noted.

| Law | How Women360 applies it |
| --- | --- |
| Aesthetic-usability effect | Calm, consistent design system (CLAUDE.md §2); no vibe-coded decoration. |
| Hick's law | Few choices at once: Senior Mode tiles she chooses, progressive disclosure in log forms, "More details" collapsed. |
| Fitts's law | Large tap targets (WCAG 2.2 target size is in the axe run); primary actions near the thumb on phones (bottom bar, bottom sheets). |
| Jakob's law | Familiar patterns: tabs, bottom sheets, Ctrl/Cmd+K, standard sign-in. |
| Miller's law | Short lists and chunked forms: four rows in "Today so far", at most three lines in "See it together". |
| Doherty threshold (under 400 ms) | Optimistic taps with Undo, skeletons, cached last view while refreshing, "Waking the service up" after 4 s. |
| Law of proximity | Related fields grouped (bed day + time, wake day + time). |
| Law of similarity | One look per kind of control (choice chips, number fields with arrows). |
| Common region | Cards and sections only where they group something; otherwise spacing and a divider. |
| Visual hierarchy | One heading per screen, one primary button per view. |
| Progressive disclosure | Optional details collapsed; tips shown once, then only on Help. |
| Recognition over recall | "Log again" chips, recent values pre-filled, command menu lists every screen. |
| Von Restorff effect | Only the one thing that needs attention stands out (red only for destructive actions). |
| Peak-end rule | Clear success confirmations; no guilt at the end (no lost-streak messages). |
| Goal-gradient effect | Habit and goal progress shown as it grows; amount habits show how close she is. |
| Serial position effect | Most-used items first and last in navigation (Today first, Settings last). |
| Tesler's law | Complexity kept on the server (cycle maths, durations, calories), not handed to her. |
| Postel's law | Lenient input (12- or 24-hour times, decimals, pasted codes), strict server validation. |
| Occam's razor | Add to a screen only by removing something (CLAUDE.md). |
| Feedback loops | Every action answers: toast, Undo, inline errors, live regions for screen readers. |

## 5. Launch basics

| Item | Status |
| --- | --- |
| Real login and logout | Done. |
| Password reset | Done: email link, one use, one hour. **Owner**: set `BREVO_API_KEY` or nothing is sent. |
| Email verification | Done: link at sign-up (48 h, one use), "Send the link again", a quiet reminder in the app; shown only when email can be sent, never for demo or device accounts; nothing is blocked while unconfirmed. |
| Loading, empty and error states; clear errors; form validation | Done: every data screen (browser suite checks failure states). |
| Rate limiting | Done (§3). |
| Database backups | Done: nightly encrypted backup with a restore check. **Owner**: add the two GitHub secrets. |
| Row-level security | Done (§3). |
| API keys off the front end | Done (§3). |
| Mobile layout | Done: phones, tablets and Senior Mode; no sideways scroll *(guarded)*. |
| Custom 404 page | Done *(guarded)*. |
| Analytics | Done: anonymous first-party counts; Google Analytics optional and consent-gated. |
| Error tracking | Done: browser crash reports and server errors email the support address. |
| Privacy and terms pages; delete-account button; onboarding | Done *(guarded)*. |
| Read one-time codes automatically | Done where it applies: the two-factor field uses `autocomplete="one-time-code"` and submits by itself, so password managers and the phone's keyboard can fill it. Reading a code from an SMS needs codes sent by SMS, which Women360 does not do. |

## 6. Production engineering (the 111 topics)

Women360 is one API service, one PostgreSQL database and a static web app on managed hosting. Topics built for large
distributed systems are marked N/A with the reason; they are not to be added for show.

**Traffic and resilience (1-24).** 1 Rate limiting: Done. 2 Caching: Done (immutable hashed assets, `/config` 60 s, in-memory last
view; no health data cached in the browser's storage). 3 Load balancing and 4 Reverse proxies: provided by Render and Vercel. 5 API
gateway: N/A (one API). 6 CI/CD: Done (GitHub Actions; Render and Vercel deploy from main). 7 Docker, 8 Kubernetes, 9 Service discovery:
N/A (managed hosting). 10 Circuit breakers: N/A (no service-to-service calls); outbound email and push fail soft. 11 Timeouts: Done
(server request, header and keep-alive timeouts; 4 s database probe; the client shows "Waking up" after 4 s). 12 Retries: Done (one
retry of a dropped POST, safe because of 14). 13 Exponential backoff: N/A beyond the push retry on the next minute. 14 Idempotency:
Done (Idempotency-Key on every POST). 15-20 Queues, pub/sub, events, distributed transactions, sagas, dead-letter queues: N/A (one
database; multi-step writes use transactions). 21 Cron jobs: Done (in-process daily sweeps; nightly backup in GitHub Actions). 22-24
WebSockets, long polling, server-sent events: N/A (nothing real-time).

**Data (25-50).** 25 Indexing: Done (indexes on account and date for every per-day table). 26 Query optimisation and 27 N+1: reviewed on
hot paths (parallel reads with `Promise.all`, no per-row queries in lists); check new list endpoints for loops of queries. 28 Connection
pooling: Prisma's pool (Supabase's pooler can be used through `DATABASE_URL`). 29-34 Read replicas, sharding, partitioning,
replication, leader election, CAP: N/A at this size (one Postgres, strongly consistent). 35 Eventual consistency: only the in-memory
last view, refreshed behind it. 36 Optimistic locking: N/A (each record has one editor, her); optimistic UI rolls back on failure. 37
Pessimistic and 38 distributed locks: unique constraints and claim-then-send for reminders, so two servers never send twice. 39 Race
conditions: unique indexes (duplicate activity, reminder claims, idempotency keys). 40 Deadlocks: short transactions only. 41-43 Memory
leaks, GC, thread safety: one Node process, timers unref'd, no shared mutable state between requests. 44 Backpressure: rate limits and a
1 MB body limit. 45-47 Autoscaling, horizontal and vertical scaling: N/A on the free tier; the server is safe to run as more than one
instance (reminder claims), except the daily sweeps would run on each (harmless). 48 CDN and 49 Edge caching: Vercel's CDN. 50 Cache
invalidation: content-hashed file names.

**Releases (51-57).** 51 Feature flags: Done (`CLINICAL_CONTENT`, analytics ID, push keys). 52 Blue-green, 53 Canary, 54 Rolling: Render
starts the new version and switches only after `/health` passes; Vercel deployments are atomic. 55 Rollbacks: one click on both
(`docs/INCIDENTS.md` §3); migrations are additive so code can roll back. 56 Health checks: Done (`/health` readiness with the database).
57 Liveness and readiness: Done (`/livez` and `/health`).

**Observing (58-66).** 58 Monitoring: uptime monitor plus Administration > Overview. 59 Logging: Done (structured, redacted, request ids).
60 Distributed tracing: N/A (one service; `X-Request-Id` links a person's error to the log line). 61 Metrics: response times in the logs,
anonymous usage counts. 62 Alerts: Done (email, rate-limited; a malformed request never triggers one). 63 SLOs, 64 SLIs, 65 Error budgets:
Done (`docs/INCIDENTS.md` §1). 66 Observability: the above together.

**Security (67-80).** 67 Secrets management, 68 IAM, 69 OAuth (N/A: no third-party sign-in), 70 JWT rotation (refresh tokens rotate on
every use; signing secrets rotate per `INCIDENTS.md` §4), 71 TLS, 72 Encryption at rest (database encrypted by the provider; backups
AES-256-GCM; two-factor secrets AES-256-GCM), 73 Encryption in transit (HTTPS; **Owner**: keep `sslmode=require` in `DATABASE_URL`), 74 WAF
and 75 DDoS (the hosts' platform protection plus rate limits; a WAF such as Cloudflare once there is a domain), 76 CORS, 77 CSRF, 78 SQL
injection, 79 XSS, 80 SSRF (reminder addresses must pass `isTrustedPushEndpoint`): see §3.

**Change and recovery (81-90).** 81 Database migrations and 82 Schema versioning: Done (Prisma migrations, applied on deploy, never
edited after they ship). 83 Disaster recovery, 84 Backups: Done (`INCIDENTS.md` §3). 85 Failover and 86 Multi-region: N/A on the free tier;
recovery is restore-from-backup (up to a day of data). 87 Chaos engineering: the failure suite cuts the network and fails the server on
purpose (`e2e/04-failure.spec.ts`). 88 Cost optimisation: free tiers, lazy-loaded code. 89 Cold starts: uptime pings and the waking notice.
90 Serverless limits: N/A (a long-running server).

**Network (91-103).** 91-94 Latency, throughput, P99, tail latency: targets in `INCIDENTS.md` §1; not yet load-tested (do before a
large launch). 95 Network partitions: the app keeps her last view and offers Try again; nothing half-saves (transactions, idempotency).
96 Clock skew: her device's calendar day is sent and checked as plausible on the server; tokens use the server's clock. 97 DNS: no custom
domain yet. 98 TCP vs UDP, 99 HTTP/2 and HTTP/3: handled by the hosts. 100 gRPC: N/A. 101 Webhooks: none incoming except the
token-protected backup report. 102 API versioning: Done (`/api/v1`; breaking changes go in `/v2`). 103 Semantic versioning: package
versions follow semver; bump on each release with a release note.

**Delivery (104-111).** 104 Infrastructure as code: `render.yaml`, `vercel.json`, GitHub workflows. 105 Terraform, 106 Helm: N/A.
107 Build caching: npm cache in CI, immutable assets. 108 Dependency hell: lockfiles, grouped monthly Dependabot, `npm audit` in CI.
109 Production incidents, 110 On-call, 111 Postmortems: `docs/INCIDENTS.md`.

## 7. Six common legal risks (audit of 2026-11-15)

| Risk | Status |
| --- | --- |
| No age gate at sign-up | Done: date of birth on a wheel at sign-up; a minor is refused neutrally and the refusal is remembered on the device; the server refuses an under-18 date anywhere and won't finish onboarding without an adult date of birth (covers the phone's device account). *(guarded: both sides must keep calling the check; server tests in `ageGate.test.ts`, browser test in `e2e/15`.)* Accounts already onboarded before this were not re-checked. |
| Fonts loaded from Google | Done (already): Fraunces and Inter are self-hosted from `@fontsource-variable`. *(guarded: any third-party font host fails CI.)* |
| Session replay without consent or masking | N/A: there is no session replay or screen recording at all (Google Analytics, if switched on, is consent-gated, public pages only, and records no input). *(guarded: replay tools fail CI.)* Adding one would capture health data and needs a legal decision first. |
| Marketing email without unsubscribe link and postal address | N/A today: only transactional email is sent (confirm address, reset password, staff alerts). *(guarded: `sendEmail` refuses a marketing email without an https unsubscribe link and `MAIL_POSTAL_ADDRESS` in its text, and adds List-Unsubscribe headers; tested.)* **Owner**: set `MAIL_POSTAL_ADDRESS` (a real address; never invented) before any newsletter, and build the unsubscribe endpoint with it. |
| Renewal terms not next to the subscribe button | N/A: nothing is sold. *(guarded: a Subscribe/Start trial/Upgrade button fails CI unless renewal terms are in the same component.)* |
| No DMCA designated agent | Owner: step-by-step in `docs/DMCA.md` ($6, three years, needs the operating entity's legal name). Until then the Terms page has a "Copyright complaints" section routing notices to the support address. |
