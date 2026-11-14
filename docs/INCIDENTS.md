# Incidents, breaches and recovery

What to do when something goes wrong in production, and the targets that decide when it has gone wrong. Written for a
small team (today: one owner). Steps that need hosting dashboards are the owner's; nothing here needs code changes.

## 1. Service targets (SLOs)

These are our own targets for a free-tier service, not promises to anyone. Review them when the hosting plan changes.

| Indicator (SLI) | How it is measured | Target (SLO, 30 days) | Error budget |
| --- | --- | --- | --- |
| Availability | Uptime monitor on `GET /health` (API and database answering) | 99.0% of checks healthy | about 7 hours a month |
| Liveness | `GET /livez` (process up, no database call) | 99.5% | about 3.5 hours a month |
| Latency | Request durations in the API logs (`requestLogger`) | 95% of requests under 1 s once awake (p95) | n/a |
| Cold start | First request after the free tier sleeps ("Waking the service up" notice) | under 60 s | n/a |
| Backups | Nightly restore check (`backup.yml`), shown in Administration > Overview | a verified restore in the last 48 h | one missed night |

When the availability budget for the month is spent: stop shipping features, fix the cause, and only then resume.

## 2. Who is on call

Alerts go to the support address (`SUPPORT_EMAIL`): server errors (5xx), crashes, the database not answering, and crash
reports from browsers, at most one email per problem per 30 minutes and 20 a day. The uptime monitor (docs/OPERATIONS.md §2)
emails when `/health` fails. Today the owner is the only person on call; write the name of a second person here before
inviting real users.

## 3. When something breaks

1. **Confirm it.** Open `/health` and `/livez` on the API, and Administration > Overview (database, email, reminders,
   last backup restore).
2. **Limit the damage.** If a deploy caused it, roll back: Render > the API service > Events > "Rollback" to the last good
   deploy; Vercel > Deployments > the last good one > "Promote to Production". Both are instant and keep the database as it is.
   A database migration is not undone by a rollback: never deploy a migration that deletes or renames a column in the same
   release as the code that stops using it.
3. **Database lost or corrupted.** Restore the latest encrypted backup (docs/OPERATIONS.md §3, `server/scripts/backup/`) into a
   new database, check row counts, then point `DATABASE_URL` at it. Data written after that backup is lost (at most a day).
4. **Write down what happened** as it happens (times, what you saw, what you did). The request id in an error
   (`X-Request-Id`) finds the matching log lines.
5. **After it is fixed**, write a postmortem (template below) within a week.

## 4. A personal-data breach

A breach is any unauthorised access to, loss of, or change to someone's personal data: a leaked database credential, a
backup file left somewhere public, a bug that showed one person another person's records, a lost laptop with data on it.

1. **Contain it at once.** Rotate what leaked: the database password (Supabase > Project settings > Database), `JWT_ACCESS_SECRET`
   and `JWT_REFRESH_SECRET` on Render (this signs everyone out), `TWO_FACTOR_ENCRYPTION_KEY` only with a plan (it makes existing
   two-factor secrets unreadable), `BACKUP_PASSPHRASE`, `BACKUP_REPORT_TOKEN`, VAPID keys, `BREVO_API_KEY`. Fix or switch off the
   faulty feature.
2. **Work out what and who.** Which tables, which accounts, which time window. Audit log (Administration > Audit log) and the API
   logs by request id.
3. **Decide on notification, with legal advice.** The rules depend on where the people are, which is not settled yet
   (privacy page, "Still to be confirmed"). As a guide to timing only: the EU GDPR expects the regulator to be told within 72
   hours of becoming aware, and India's Digital Personal Data Protection Act 2023 requires telling the Data Protection Board and
   each affected person. Health data is sensitive everywhere: when in doubt, tell the people affected promptly, in plain
   language: what happened, what data, what we have done, what they can do (for example, change a reused password).
4. **Record it** in the breach log below, even when nobody needs to be notified.

Breach log: none recorded.

## 5. Postmortem template

```
Title:            (what failed, in plain words)
Date and length:  (start, end, total time people were affected)
Impact:           (who noticed, what they could not do, any data affected)
Timeline:         (times, what was seen, what was done)
Cause:            (the real cause, not just the trigger)
What went well:
What went badly:
Actions:          (each with an owner and a date; prefer a test or a check that stops it happening again)
```

Postmortems are blameless: they are about the system and the process, not the person.
