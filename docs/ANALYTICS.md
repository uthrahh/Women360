# Analytics (Google Analytics 4)

The reviewable reference is the page **/analytics-reference** on the site itself: it is generated from the same definitions the code uses
(`src/lib/analytics/events.ts`), shows the status of the current build, lists every event with its parameters and an example call, and has a
sandbox whose interactions appear in an on-page log (never sent to Google). Read that page rather than this file for what is tracked.

## Decisions worth knowing

- **Off by default.** No `VITE_GA_MEASUREMENT_ID`, no banner, no script, no request. Setting it is the only switch.
- **Consent first.** Google's script is not downloaded until the visitor accepts. Do Not Track and Global Privacy Control count as a no.
- **Public pages only** (`/`, `/privacy`, `/terms`, `/release-notes`). Women360 holds health records, and which screens someone opens inside her account
  (cycle, health, sleep) is itself health information, so none of it goes to a third party. Each event is checked against that list as it happens, and Google's
  collection is switched off (its documented `ga-disable-<ID>` flag) as soon as a visit moves into the app. The existing first-party, anonymous counts
  (Administration > Usage) are what measure use inside the app.
- **No content.** Searches and copied text are reported by length only; query strings and email addresses are stripped from every value.
- **Security policy.** Google's script is allowed by the Content-Security-Policy only on the public pages (`vercel.json`), so the signed-in app keeps the strict policy.
  A visit that begins on a sign-in or app page cannot load it, so analytics is not offered on that visit.
- **Not built, because the site has none of them:** code samples and component listings. The copy, filter and search events are generic listeners that start
  working for any element marked with `data-code-sample` / `data-copy-code`, `data-track-filter`, or `data-track-search`; none exists in Women360 today.

## Turning it on

Set `VITE_GA_MEASUREMENT_ID` in Vercel, redeploy, switch off Enhanced measurement in the GA4 stream (so Google's own events don't duplicate these),
and check Admin > DebugView after choosing Accept. Register event parameters you want to report on as event-scoped custom dimensions.
