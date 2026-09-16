# Deploying Women360 to the cloud

This gets the app off localhost and onto a public URL, using three free-tier
services — all explicitly permitted by the course's SRS (§4: Postgres/Mongo
Atlas/Firebase/**Supabase**; §hosting: Render/Railway/AWS/Azure/GCP/Firebase):

- **Database:** [Supabase](https://supabase.com) (managed Postgres) — its free
  tier doesn't have a hard expiry like Render's free Postgres does (30 days),
  which matters for a project that needs to still be alive at the final demo.
- **API:** [Render](https://render.com) (Node web service), driven by the
  `render.yaml` blueprint already committed at the repo root.
- **Frontend:** [Vercel](https://vercel.com) (static SPA hosting), using the
  `vercel.json` rewrite rule already committed at the repo root.

None of these steps need me to have your passwords or secrets — you create
the accounts and paste values directly into each provider's own dashboard,
never into chat.

## 1. Create the database (Supabase)

1. Sign up at supabase.com (free), then **New project**. Pick any name/region
   and set a database password — write it down, you'll need it once.
2. Once it's provisioned: **Project Settings → Database → Connection string**.
   Choose the **URI** tab, **Session mode** (not the "Transaction pooler" —
   Render runs a persistent long-lived process, not serverless functions, so
   the direct/session connection is the right one and avoids pgbouncer
   quirks with Prisma).
3. Copy that string. It looks like:
   `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres`
   — replace `[YOUR-PASSWORD]` with the password you set. Keep this for step 3.

## 2. Generate two JWT secrets

Run this twice locally (once each for access and refresh) — don't reuse one
value for both:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Save the two outputs somewhere for step 3. These are secrets — don't paste
them into chat with me; they only need to go into Render's dashboard.

## 3. Deploy the API (Render)

1. Push this repo to GitHub if you haven't already (it already has a
   `render.yaml` at the root describing the service).
2. In the Render dashboard: **New +** → **Blueprint** → connect your GitHub
   account → select the `Women360` repo. Render reads `render.yaml`
   automatically and shows the `women360-api` service it's about to create.
3. You'll be prompted for the env vars marked `sync: false` in the blueprint
   — fill in:
   - `DATABASE_URL` → the Supabase connection string from step 1
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → the two values from step 2
   - `CORS_ORIGINS` → leave as `http://localhost:5173` for now; you'll come
     back and change this in step 5 once the frontend has a real URL
4. Click **Apply**/**Deploy**. Render will `npm install`, build, run
   `prisma migrate deploy` against Supabase (creating all the tables), and
   start the server. Watch the deploy log for errors.
5. Once live, Render shows a URL like `https://women360-api.onrender.com`.
   Confirm it's up: visit `https://women360-api.onrender.com/health` — you
   should see `{"ok":true,"data":{"status":"healthy"}}`.

**Free-tier note:** Render's free web services spin down after 15 minutes of
no traffic and take ~30-50s to wake up on the next request. That's expected
behavior for a demo, not a bug — the first request after idle will just be
slow.

## 4. Deploy the frontend (Vercel)

1. In the Vercel dashboard: **Add New… → Project** → import the same GitHub
   repo. Vercel auto-detects it's a Vite app.
2. **Root Directory**: leave as the repo root (the frontend lives there, not
   in `server/`).
3. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL` = `https://women360-api.onrender.com/api/v1`
     (your actual Render URL from step 3, with `/api/v1` appended)
4. Click **Deploy**. Vercel builds with `npm run build` and serves `dist/`;
   the committed `vercel.json` makes client-side routes like `/app/dashboard`
   work on direct load/refresh instead of 404ing.
5. Once live, note the URL — something like `https://women360.vercel.app`.

## 5. Connect the two (CORS)

Go back to Render → the `women360-api` service → **Environment** → update
`CORS_ORIGINS` to your real Vercel URL from step 4 (e.g.
`https://women360.vercel.app` — no trailing slash). Save; Render redeploys
automatically. Without this step the API will reject requests from the
deployed frontend with a CORS error even though everything else is correct.

## 6. Verify it end to end

Visit your Vercel URL and actually use it — register an account, log in,
log a meal or a night's sleep, refresh the page, log out, confirm a
protected route redirects to login. If something fails, check in this
order: Render's deploy log (did the build/migration succeed?) → Render's
runtime log (is a request reaching it, what's the error?) → the browser's
Network tab (is the frontend even calling the right URL, and what does the
API respond with?).

## Redeploying later

Both Render and Vercel auto-redeploy on every push to `main` once connected
— you don't need to repeat these steps for future changes, just commit and
push. A new Prisma migration gets applied automatically too, since
`prisma migrate deploy` is part of Render's build command.
