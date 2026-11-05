# Running Women360

What only the person running the service can do, in the order that matters. Everything the code can do
for itself is already done and tested; these steps need your accounts or your secrets. Each one says how to
check that it worked.

| Where | What | Address |
| --- | --- | --- |
| Vercel | the website | https://women-360.vercel.app |
| Render (free web service) | the API | https://women360-api.onrender.com |
| Supabase (free) | the database | its dashboard |
| GitHub | code, tests, nightly backup, Android build | github.com/uthrahh/Women360 |

Support address used everywhere (privacy page, terms, emails, alerts): `admin.women360@gmail.com`.

## 1. Make password reset email work (do this first)

Without it, a woman who forgets her password cannot get back in. Render's free tier blocks the normal email
protocol (SMTP), so Women360 sends through Brevo's web API instead.

1. Create a free account at brevo.com. Under **Senders, domains**, add `admin.women360@gmail.com` as a sender and click the
   verification link Brevo sends to that inbox.
2. In Brevo, **SMTP & API > API keys**, create a key.
3. In Render, open the `women360-api` service > **Environment** and add `BREVO_API_KEY` with that key. Save; Render redeploys.
4. Check it: on your computer, with the same variables in `server/.env`, run
   `npm --prefix server run mail:check -- you@example.com`. It sends one real email and says plainly whether it was accepted.
   Then use "Forgot password" on the live site with your own account.

Gmail-address senders can land in spam (Gmail's rules for mail "from" a gmail.com address sent by someone else's servers).
If reset emails go to spam, the lasting fix is a sender on a domain you own, which needs a domain; until then tell people
to check spam. This is a limit of using a Gmail address, not a bug.

## 2. Keep the API awake and get alerted when it is down

The free API sleeps after about 15 minutes with no visitors and takes 20+ seconds to wake: the first person to arrive waits.
A monitor that calls `/health` every 5 minutes fixes that, tells you when the site breaks, and keeps the free database from
going idle. It is also what makes closed-app reminders arrive on time (section 4).

1. Create a free account at uptimerobot.com (or any monitor that can check every 5 minutes).
2. Add a monitor: type **HTTP(s)**, URL `https://women360-api.onrender.com/health`, interval **5 minutes**,
   alert contact `admin.women360@gmail.com`.
3. Optionally add a second monitor for `https://women-360.vercel.app`.

`/health` answers 200 only when the API **and** its database both answer, and 503 otherwise, so a paused or unreachable
database shows up as an alert, not as a quiet failure. The API also emails the support address (at most one email per
problem per 30 minutes, 20 a day, with no personal data) when it crashes or returns a server error, and when the browser
reports a screen crashing. Those emails need step 1.

Render's free tier gives a limited number of instance hours a month, enough for one service awake all month. If you add
more services on the same account, a 24/7 monitor can use them up. Paid tiers do not sleep.

## 3. Backups, and proof they restore

I cannot see inside your Supabase project, so check these yourself in its dashboard: whether the free plan keeps automatic
backups (it has not, historically; look under **Database > Backups**), and whether the project pauses when idle (free
projects have paused after about a week of no activity; the monitor in section 2 prevents that).

Women360 makes its own: every night GitHub Actions takes an encrypted copy of the database, restores it into a scratch
database, and compares every table's row count with what was recorded before the copy. The run fails (and GitHub emails
you) if the backup cannot be taken or does not restore.

1. In Supabase, **Project settings > Database > Connection string**, choose **Session pooler** (works over IPv4) and copy it.
2. In GitHub, **Settings > Secrets and variables > Actions > New repository secret**:
   `DATABASE_URL` = that string; `BACKUP_PASSPHRASE` = a long random phrase (16+ characters). **Keep the passphrase somewhere
   safe outside GitHub: without it a backup cannot be opened.**
3. **Actions > Database backup and restore test > Run workflow.** A green run is the proof. Backups are kept 30 days as
   the run's artifact, encrypted.
4. To restore for real: download the artifact, then with `BACKUP_PASSPHRASE` set and an **empty** target database,
   `RESTORE_DATABASE_URL=... node server/scripts/backup/verify-restore.mjs <file>.dump.enc`
   (it refuses a database that already has tables).

Until the two secrets exist, the nightly run does nothing except warn.

## 4. Reminders when the app is closed

Built (web push). Switched on by two keys on the server:

1. `npm --prefix server run push:keys` prints a `VAPID_PUBLIC_KEY` and a `VAPID_PRIVATE_KEY`.
2. Add both to Render's environment. Keep the private key secret. Do not regenerate them later: devices subscribed under the
   old key stop getting reminders until they turn them on again.
3. Check it: on the live site, **Settings > Reminders**, turn it on (the first time can take up to a minute), add a habit with a
   reminder a few minutes ahead, close the tab, and wait.

How it behaves, so you can describe it honestly: the API checks every minute while it is awake (section 2 keeps it awake);
reminders arrive within a few minutes of the chosen time; the notification never names the habit or medicine (it can appear on
a locked screen); nothing is sent for a habit already done or a dose already recorded. It works in Chrome, Edge, Firefox and
Safari on computers and Android phones. **On iPhone and iPad it works only after Women360 is added to the Home Screen** (Apple's
rule). **The installed Android app cannot receive it** (its web view has no push); there, reminders show only while the app is open,
and the Reminders screen says so. Medicine reminders are a convenience, not a safety system.

## 5. The Android app

Signed files are in `C:\Users\uthra\Desktop\CC\Women360-android-release\`: `Women360-1.0.apk` (install directly on a phone) and
`Women360-1.0.aab` (what Google Play wants). Package `com.women360.app`, version 1.0 (1), Android 6.0 and up, built for Android 16.

- **Back up the signing key now.** It is `C:\Users\uthra\android-dev\women360-upload-key.jks`, and its passwords are in
  `android\keystore.properties` (not in git). Copy both somewhere safe outside this computer. If the key is lost you cannot
  publish updates under the same listing (Google Play can reset an *upload* key if you use Play App Signing, which is the default).
- **Try it first.** On an Android phone, copy the `.apk` over, open it, and allow "install unknown apps" when asked. It was built
  and signature-checked here but **not run on a phone or emulator** (none was available), so open it and sign in before telling anyone.
- **The app is a window onto the live website.** Website changes reach it without a new build. It needs internet, and a first open after
  idle can show the same 20-second wake-up if section 2 is not set up.
- **Google Play** is your account to create: a Play Console developer account (one-time fee, identity checks), then a new app, upload the
  `.aab`, fill in the store listing, content rating and **Data safety** form, and give the privacy policy address
  `https://women-360.vercel.app/privacy`. New personal accounts must run a closed test with a minimum number of testers for a minimum
  period before production access: check Google's current numbers in the Console. Reviewers may question an app that only wraps a website
  ("minimum functionality"); the in-app features and the signed-in experience are the answer. Describe it as a health *tracker* and not as
  medical advice, matching the app.
- **Future builds**: either on this computer (`npm run build`, `npx cap sync android`, then `gradlew assembleRelease bundleRelease` in
  `android/`, with JDK 21) or in GitHub (**Actions > Android release build**, after adding the four `ANDROID_*` secrets described in that workflow).
  Raise `versionCode` in `android/app/build.gradle` for every upload.

## 6. Features waiting for a clinician

`CLINICAL_CONTENT` on Render is `false` (set in `render.yaml`): the check-up schedule, "worth discussing with a doctor" patterns,
condition guidance, activity plans, explain-this cards and Learn are off everywhere: not in menus, not on pages, and the API refuses
them. Turn them on only after a clinician has reviewed every guideline and citation in `server/src/modules/screening/guidelines.ts`,
`conditions/guidelines.ts`, `insights/factors.ts`, `activity/plan/guidelines.ts` and the Learn content. The landing page and FAQ describe
only what is on.

## 7. What people use (analytics)

Administrator sign-in > **Usage**: daily different-women-active, new accounts, screens opened, actions done, for 7/30/90 days. Anonymous by
construction (see the privacy page for the plain-language version); not available on the shared demonstration administrator. There is no
third-party analytics and no cookie banner is needed because nothing is stored in cookies.

## 8. The address

The site is `women-360.vercel.app`; page titles, the canonical link, the sitemap and `robots.txt` already point at it. A paid domain is not
needed to launch. Free improvements: in Vercel, **Settings > Domains** lets you rename the project's `*.vercel.app` address to a nicer free one
(for example `women360.vercel.app`, if it is free), but then the address appears in `index.html`, `public/sitemap.xml`, `public/robots.txt`,
the Render `CORS_ORIGINS` and `APP_URL`, and `capacitor.config.ts` (the Android app loads it), and the Android app must be rebuilt. Do that
change once, early, or not at all. A custom domain also lets emails come from your own address instead of Gmail.

## Settings reference (Render environment)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` | the API to start | already set |
| `BREVO_API_KEY` | password-reset email, alerts | section 1 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | closed-app reminders | section 4 |
| `CLINICAL_CONTENT` | the clinician-gated features | leave `false` |
| `SUPPORT_EMAIL`, `APP_URL` | contact address, email links | set in `render.yaml` |
| `SEED_DEMO_ACCOUNTS` | the shared demo logins | `true`; their passwords are public by design |
| `TWO_FACTOR_ENCRYPTION_KEY` | optional two-factor sign-in | `openssl rand -base64 32` |
| `ADMIN_IP_ALLOWLIST` | optional: limit `/admin` to your addresses | |
| `API_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_15_MIN` | request limits | defaults are right for production |

## Before you invite people

Section 1 done and a real reset email received; section 2 monitor green; section 3 backup run green; the `.apk` opened on a real phone;
`/privacy` and `/terms` read by you (they are drafts awaiting review by someone qualified, and name no legal entity yet);
and the browser tests (`npm run e2e`) and `npm test` in both folders passing.
