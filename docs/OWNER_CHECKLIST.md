# Owner checklist

Everything that needs **you** (your accounts, your secrets, your decisions or a professional), with the exact steps, and the status of
every piece of work. Written 2026-11-18. The code is finished and pushed (`main` = `origin/main`, last commit `ff6fe5b`); what is left
is mostly switching things on in dashboards only you can open.

**Status words**
- **Completed**: built, tested, pushed.
- **Pending**: ready or partly done, but not confirmed working in the live service (needs a check or one more step).
- **Waiting**: not started, because it needs you, an account, a professional or a decision.

I cannot see your Vercel, Render, Supabase, Brevo or GitHub dashboards, so every dashboard item below is **Waiting** until you confirm it.
Each one ends with a **Check** that proves it. Keys and passphrases are in `C:\Users\uthra\Desktop\CC\Women360-launch-secrets.txt`
(outside the repository; never paste its contents into a chat or a file in the repo).

---

## Part 1. What you have to do, in order

### 1. Confirm the latest version deployed (10 minutes) · Waiting
Two new database migrations went out (email confirmation, and row-level security on every table). Render applies them on deploy.
1. Open **github.com/uthrahh/Women360 > Actions**. The latest run on `main` should be green (jobs: Secret scan, Server, Frontend, Browser). If a job is red, open it and send me the red text.
2. Open **Render > women360-api > Events**. The newest deploy should say **Live**. Open **Logs** and look for `All migrations have been successfully applied`.
3. Open **Vercel > women-360 > Deployments**. The newest should be **Ready**.
4. **Supabase > Database > Advisors (Security)**: there should be no "RLS disabled" warnings. In **Table Editor**, tables show "RLS enabled".
5. **Check:** open https://women-360.vercel.app, create a test account with an adult date of birth, log in, tick a habit.
If step 2 shows a migration error, do not change anything: send me the log.

### 2. Make email work: password reset, email confirmation, alerts (20 minutes) · Waiting
Without this, nobody who forgets a password can get back in, and the "confirm your email" message is never sent (the banner stays hidden by design).
1. Create a free account at **brevo.com**. Go to **Senders, domains**, add `admin.women360@gmail.com` as a sender, click the verification link Brevo emails to that inbox.
2. In Brevo, **SMTP & API > API keys**, create a key, copy it.
3. In **Render > women360-api > Environment**, add `BREVO_API_KEY` = that key. Save (Render redeploys).
4. **Check:** on your computer with the same value in `server/.env`, run `npm --prefix server run mail:check -- you@example.com`. Then use "Forgot password" on the live site. **Administration > Overview > Service status** should stop saying "Email: Needs attention".
Note: mail from a Gmail address can land in spam. That is a Gmail limit; the lasting fix is a domain you own (decision 10).

### 3. Keep the API awake and get alerted (10 minutes) · Waiting
The free API sleeps after about 15 minutes and takes 20+ seconds to wake. A monitor fixes that, alerts you when the site breaks, keeps the free database from idling, and is what makes closed-app reminders arrive on time.
1. Create a free account at **uptimerobot.com**.
2. Add monitor: type **HTTP(s)**, URL `https://women360-api.onrender.com/health`, interval **5 minutes**, alert contact `admin.women360@gmail.com`.
3. Optional second monitor for `https://women-360.vercel.app`.
4. **Check:** the monitor turns green, and `/health` shows `{"status":"healthy"}`. (A newer `/livez` also exists for "is the process up"; `/health` is the one to monitor.)

### 4. Backups and proof they restore (20 minutes) · Waiting
1. **Supabase > Project settings > Database > Connection string**: choose **Session pooler**, copy it. Make sure it ends with `sslmode=require` (add `?sslmode=require` if not).
2. **GitHub > Settings > Secrets and variables > Actions > New repository secret**: `DATABASE_URL` = that string; `BACKUP_PASSPHRASE` = a long random phrase (16+ characters). **Store the passphrase somewhere safe outside GitHub: without it a backup cannot be opened.**
3. Recommended: a third secret `BACKUP_REPORT_TOKEN` (any long random string), and the same value as an environment variable on Render. Then Service status shows "Last verified restore".
4. **GitHub > Actions > Database backup and restore test > Run workflow.**
5. In Supabase **Database > Backups**, note whether the free plan keeps automatic backups (historically it has not) and whether the project pauses when idle (step 3 prevents that).
6. **Check:** the run is green, and Service status shows the last restore time. To restore for real, see section 3 of `docs/OPERATIONS.md`.

### 5. Reminders when the app is closed (10 minutes) · Waiting
1. On your computer: `npm --prefix server run push:keys`. It prints `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. (The keys already generated are in your launch-secrets file; use those if present.)
2. Add both to **Render > Environment**. Keep the private key secret. **Never regenerate them later** (devices subscribed under the old key stop getting reminders).
3. **Check:** Service status says reminders are **On**. On the live site, **Settings > Reminders**, turn it on (first time can take up to a minute), add a habit with a reminder a few minutes ahead, close the tab, wait. On iPhone it only works after "Add to Home Screen". The installed Android app cannot receive it.

### 6. The Android app (30 minutes, then Google Play later) · Waiting
Files: `C:\Users\uthra\Desktop\CC\Women360-android-release\Women360-1.0.apk` and `.aab`.
1. **Back up the signing key now:** `C:\Users\uthra\android-dev\women360-upload-key.jks` and `android\keystore.properties`. Copy both to a place outside this computer (a USB stick or a private cloud drive). If the key is lost you cannot update the same listing.
2. Copy the `.apk` to an Android phone, open it, allow "install unknown apps", sign in, tick a habit. **It has never been run on a device**, so do this before telling anyone.
3. Google Play (later): create a Play Console developer account (one-time fee, identity checks), upload the `.aab`, fill in the listing, content rating and **Data safety** form, privacy policy `https://women-360.vercel.app/privacy`. New personal accounts must run a closed test first; check Google's current numbers.
4. Reviewers may question an app that only wraps a website. Give them a normal account (not only the demo logins, which cannot delete themselves) and describe it as a health tracker, not medical advice.
5. iPhone/App Store: not possible yet. Apple rejects a website in a box; it needs native features first (see `docs/LAUNCH_STANDARD.md` section 1).

### 7. Legal and business items (a lawyer or an hour of your time) · Waiting
These need facts only you have, or a qualified person. The privacy page lists most under "Still to be confirmed".
1. **Name the operator**: the legal name of the person or company running Women360. Needed on the privacy page, the terms, the DMCA registration and any store listing.
2. **Decide the countries** you will launch in. They decide whether GDPR (EU/UK) or India's DPDP Act apply and who the regulator is.
3. **Have the Terms and Privacy pages reviewed** by a lawyer (both are marked drafts).
4. **Data processing agreements**: accept the DPA each provider offers (Vercel, Render, Supabase, Brevo; Google only if you switch Analytics on). Each is in the provider's dashboard or legal pages.
5. **Backup retention**: ask Supabase how long they keep backups after a deletion, then write it on the privacy page.
6. **Legal requests and breach reporting**: with the lawyer, settle how you would answer a court or police request, and who you would tell and how fast after a breach (`docs/INCIDENTS.md` section 4).
7. **DMCA agent**: follow `docs/DMCA.md` ($6, three years). Only important once users can share content or you launch in the US.
8. **Spend caps**: before upgrading any free tier (Render, Vercel, Supabase, Brevo), set a spending limit or billing alert.
9. **A second person on call**: write their name in `docs/INCIDENTS.md`.
10. **Domain** (optional): a custom domain lets emails come from your own address instead of Gmail. See section 8 of `docs/OPERATIONS.md` before changing the address, because it appears in several files and the Android app.
11. **Marketing email**: if you ever want a newsletter, set `MAIL_POSTAL_ADDRESS` to a real postal address first (the code refuses to send marketing email without it and an unsubscribe link).

### 8. Licence text (5 minutes) · Waiting (I can do this for you)
Paste the text of https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md into `src/components/reactbits/NOTICE.md` where it says so, then commit. Or ask me.

### 9. Clinician review (weeks; before turning clinical features on) · Waiting
The check-up schedule, "worth discussing with a doctor" patterns, condition guidance, activity plans, explain-this cards and Learn are **off**. Turn them on (`CLINICAL_CONTENT=true` on Render) only after a clinician has reviewed every guideline and citation in:
`server/src/modules/screening/guidelines.ts`, `conditions/guidelines.ts`, `insights/factors.ts`, `activity/plan/guidelines.ts`, and the Learn content. Ask them to check every link and the wording ("never a diagnosis").

### 10. Decisions only you can make · Waiting
| Decision | What I need from you |
| --- | --- |
| Chat / AI assistant | Yes or no. If yes: which provider, consent wording, who reviews its health statements (it would send what she logs to an outside model), and whether the black, white and pink theme applies instead of purple. See `docs/CRAFT.md` section 7. |
| Illustrations inside app screens | Should the hand-drawn scenes also appear as headers on Nutrition, Activity, Wellbeing and in Senior Mode? (So far only the home page has them.) |
| Optional extras | Optional two-factor sign-in (`TWO_FACTOR_ENCRYPTION_KEY`), admin IP allowlist (`ADMIN_IP_ALLOWLIST`), Google Analytics (`VITE_GA_MEASUREMENT_ID`). |
| Existing accounts and the age gate | Accounts created and onboarded before the age gate were not re-checked. If real people already have accounts, say so and I will add a check on their next sign-in. |

### 11. Before you invite people (the gate) · Waiting
- [ ] Items 1 to 4 above done and green
- [ ] A real reset email and a real confirmation email received
- [ ] The `.apk` opened and used on a real phone
- [ ] You have read `/privacy` and `/terms` and the operator name is filled in
- [ ] Browser tests and `npm test` pass in both folders (they do now; CI will confirm)

### 12. Ongoing · Waiting
- Dependabot opens one pull request a month per ecosystem: review and merge them (the tests must be green).
- Check Service status after every deploy.
- The front end reports two moderate `react-router` advisories that only a v7 upgrade fixes. That is a separate project; decide when.
- `GoalCheckIn` table is no longer used. Tell me when you are happy for it to be dropped in a migration.

---

## Part 2. Every step, with its status

### Product and code
| # | Step | Status |
| --- | --- | --- |
| 1 | Launch fixes: password-reset flow, support address, clinician switch, API wake-up ping, alerts, service status panel | Completed (code); switching on is items 2 to 5 above |
| 2 | Backups: encrypted nightly backup and restore test (code and workflow) | Completed (code); **Waiting** for your two GitHub secrets |
| 3 | Closed-app reminders (web push) | Completed (code); **Waiting** for the keys on Render |
| 4 | Browser test suite (Playwright), accessibility audit, failure tests | Completed |
| 5 | Performance audit and the top five fixes | Completed |
| 6 | Release notes page, optional Google Analytics (consent-gated, public pages only), UX review fixes | Completed |
| 7 | Skeleton loaders, optimistic taps with Undo, command menu, stale-while-revalidate, sheets, idempotency keys and the rest of the UX craft list | Completed |
| 8 | Landing scroll film from footage | Replaced (the footage never existed) by the hand-drawn background |
| 9 | Landing page hand-drawn animated background that follows the scroll | Completed |
| 10 | Women's-needs pass from the Reddit research: honest stress/energy, caffeine/alcohol/digestion log, optional cycle details, midlife symptoms, "See it together" chart, delete cycle history | Completed |
| 11 | Coach summary no longer includes her private wellbeing note | Completed |
| 12 | Email confirmation, row-level security on every table, retention sweep, incident and breach procedure, compliance guard in CI | Completed |
| 13 | Six legal risks: age gate, fonts (already self-hosted), no session replay, marketing-email rules, renewal-terms guard, copyright section in the Terms | Completed |
| 14 | DMCA agent registration guide | Completed (guide); registration itself is **Waiting** (item 7.7) |
| 15 | Black, white and hot-pink theme (light and dark), new icon, emails and PDF recoloured | Completed |
| 16 | Date wheel and number wheels, new-password field, code tiles, sound switch | Completed |
| 17 | Craft pass: motion tokens, habit tick, rolling counts, sign-in sky card, combo box, tab pill, touch hit areas, landing unslop | Completed |
| 18 | Chat / AI assistant | Not built, waiting for your decision (item 10) |
| 19 | Illustrations inside the app screens | Waiting for your decision (item 10) |

### Verification
| # | Step | Status |
| --- | --- | --- |
| 20 | Server tests: 502 passing; web unit tests: 107 passing; lint, types, build clean | Completed |
| 21 | Full browser suite: 168 of 170 passed, the 2 were my own test mistakes, fixed and re-run (26 passing) | Completed |
| 22 | One more complete browser run after the last test-only edits; GitHub CI result on the latest commit | **Pending** (CI runs on push; check item 1) |
| 23 | Tested on a real phone, and the Android app on a device | **Waiting** (item 6) |
| 24 | Real emails received (reset and confirmation) | **Waiting** (item 2) |

### Accounts, legal and operations (all yours)
| # | Step | Status |
| --- | --- | --- |
| 25 | Brevo key on Render | Waiting |
| 26 | Uptime monitor | Waiting |
| 27 | Backup secrets and first green backup run | Waiting |
| 28 | VAPID keys on Render | Waiting |
| 29 | Supabase checks (RLS visible, backups, pausing, `sslmode=require`) | Waiting |
| 30 | Back up the Android signing key | Waiting (do this first; it cannot be recreated) |
| 31 | Operator name, launch countries, lawyer review of Terms and Privacy | Waiting |
| 32 | DPAs, spend caps, second on-call, DMCA agent | Waiting |
| 33 | Paste the React Bits licence text | Waiting (I can do it) |
| 34 | Clinician review of every guideline, then switch clinical features on | Waiting |
| 35 | Google Play account and closed test | Waiting |
| 36 | Custom domain (optional) | Waiting (decision) |
