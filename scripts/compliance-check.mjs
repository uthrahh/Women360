#!/usr/bin/env node
/**
 * The launch standard's automated guard (docs/LAUNCH_STANDARD.md). Runs in CI on every push and locally with
 * `npm run check:compliance`. Each check is a rule that must hold at all times; a failure names the rule and the file.
 *
 *   1. No secrets in the repository (credentials, private keys, keystores, real env files).
 *   2. Front-end environment variables are public by nature: none may be named like a secret.
 *   3. No "coming soon" / placeholder screens or copy.
 *   4. Production dependencies use licences we may ship (no GPL/AGPL/SSPL/BUSL/Commons Clause/unlicensed).
 *   5. The surfaces every launch needs exist: privacy, terms, 404, password reset, email confirmation, data export,
 *      account deletion, support contact.
 *   6. Every table added by a migration switches row-level security on.
 *   7. No SQL built from strings (SQL injection) and no raw HTML written into the page (XSS).
 *   8. No session replay, fonts only from this site, renewal terms beside any subscribe button, the age gate in place.
 *
 * Pure Node, no dependencies, reads only files tracked by git.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
process.chdir(root);
const problems = [];
const fail = (rule, detail) => problems.push(`[${rule}] ${detail}`);
const read = (f) => fs.readFileSync(f, "utf8");
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|ya?ml|toml|md|html|css|sql|prisma|env|properties|txt|xml|gradle|kts)$|(^|\/)\.env[^/]*$/i;

// 1. Secrets ------------------------------------------------------------------------------------------------
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/sk_live_[0-9a-zA-Z]{20,}/, "Stripe live key"],
  [/xkeysib-[0-9a-f]{20,}/, "Brevo API key"],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "private key"],
  [/gh[pousr]_[0-9A-Za-z]{36}/, "GitHub token"],
  [/eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "signed JWT"],
  [/postgres(ql)?:\/\/[^:/\s"']+:[^@\s"']{6,}@(?!localhost|127\.0\.0\.1|postgres\b|db\b)[^\s"']+/, "database URL with a password"],
];
for (const f of tracked) {
  const base = path.basename(f);
  if (/\.(jks|keystore|p12|pfx|pem|key)$/i.test(f) || base === "keystore.properties") fail("secrets", `${f}: signing keys and certificates never go in git`);
  if (/^\.env/.test(base) && !/\.example$/.test(base)) {
    // A committed front-end env file may only hold public VITE_ values.
    for (const line of read(f).split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
      if (m && !m[1].startsWith("VITE_")) fail("secrets", `${f}: ${m[1]} is not a public VITE_ value; real env files stay out of git`);
    }
  }
  if (!TEXT.test(f) || !fs.existsSync(f) || fs.statSync(f).size > 2_000_000) continue;
  const text = read(f);
  for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) fail("secrets", `${f}: looks like a ${what}`);
}

// 2. Front-end env names --------------------------------------------------------------------------------------
for (const f of tracked.filter((f) => /^src\/.*\.(ts|tsx)$/.test(f) || f === "src/vite-env.d.ts")) {
  for (const m of read(f).matchAll(/VITE_[A-Z0-9_]+/g)) {
    if (/SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|API_KEY|SERVICE_ROLE/.test(m[0])) fail("public-env", `${f}: ${m[0]} would be published in the web bundle; secrets belong on the server`);
  }
}

// 3. Placeholder screens ------------------------------------------------------------------------------------
const PLACEHOLDER = /coming soon|lorem ipsum|under construction|placeholder text|not yet implemented/i;
for (const f of tracked.filter((f) => /^src\/.*\.(tsx|ts)$/.test(f) && !/\.test\.tsx?$/.test(f))) {
  read(f).split(/\r?\n/).forEach((line, i) => {
    if (PLACEHOLDER.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) fail("no-placeholders", `${f}:${i + 1}: "${line.trim().slice(0, 80)}"`);
  });
}

// 4. Licences of what ships --------------------------------------------------------------------------------
const BLOCKED_LICENCE = /\b(A?GPL|LGPL|SSPL|BUSL|Commons Clause|UNLICENSED|CC-BY-NC)/i;
for (const lock of ["package-lock.json", "server/package-lock.json"]) {
  const { packages } = JSON.parse(read(lock));
  for (const [p, v] of Object.entries(packages)) {
    if (!p || v.dev || v.devOptional) continue;
    const licence = typeof v.license === "string" ? v.license : "";
    if (!licence) fail("licences", `${lock}: ${p} declares no licence; check it before shipping`);
    else if (BLOCKED_LICENCE.test(licence) && !/\bOR\b/.test(licence)) fail("licences", `${lock}: ${p} is ${licence}; needs a legal decision before it ships`);
  }
}
// Vendored code carries its own notice.
if (!fs.existsSync("src/components/reactbits/NOTICE.md")) fail("licences", "src/components/reactbits/NOTICE.md (React Bits copyright and licence notice) is missing");

// 5. Required surfaces ---------------------------------------------------------------------------------------
const app = read("src/App.tsx");
for (const route of ["/privacy", "/terms", "/forgot-password", "/reset-password", "/verify-email", "/release-notes"]) {
  if (!app.includes(`path="${route}"`)) fail("required-surfaces", `src/App.tsx has no ${route} route`);
}
if (!/path="\*"/.test(app)) fail("required-surfaces", "src/App.tsx has no catch-all (custom 404) route");
const authRoutes = read("server/src/modules/auth/auth.routes.ts");
for (const r of ['"/delete-account"', '"/password-reset/request"', '"/password-reset/confirm"', '"/verify-email"', '"/logout"']) {
  if (!authRoutes.includes(r)) fail("required-surfaces", `server auth routes lack ${r}`);
}
if (!read("server/src/modules/users/users.routes.ts").includes('"/me/export"')) fail("required-surfaces", "server has no data export (/users/me/export)");
if (!read("src/config/site.ts").includes("SUPPORT_EMAIL")) fail("required-surfaces", "src/config/site.ts has no support contact");

// 6. Row-level security on new tables -----------------------------------------------------------------------
const migrations = fs.readdirSync("server/prisma/migrations").filter((d) => /^\d{14}_/.test(d)).sort();
const rlsAt = migrations.findIndex((d) => d.endsWith("_row_level_security"));
if (rlsAt < 0) fail("rls", "the row-level security migration is missing");
for (const dir of migrations.slice(rlsAt + 1)) {
  const sql = read(`server/prisma/migrations/${dir}/migration.sql`);
  for (const m of sql.matchAll(/CREATE TABLE "([^"]+)"/g)) {
    if (!new RegExp(`ALTER TABLE "?${m[1]}"? ENABLE ROW LEVEL SECURITY`, "i").test(sql)) {
      fail("rls", `${dir}: table "${m[1]}" is created without ALTER TABLE "${m[1]}" ENABLE ROW LEVEL SECURITY`);
    }
  }
}

// 7. Injection-safe code --------------------------------------------------------------------------------------
for (const f of tracked.filter((f) => /^server\/src\/.*\.ts$/.test(f))) {
  if (/\$(queryRawUnsafe|executeRawUnsafe)\b|Prisma\.raw\(/.test(read(f))) {
    fail("sql-injection", `${f}: builds SQL from a string; use Prisma queries or the tagged $queryRaw\`...\` template, which sends values as parameters`);
  }
}
for (const f of tracked.filter((f) => /^src\/.*\.(tsx|ts|jsx)$/.test(f))) {
  if (/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\(/.test(read(f))) {
    fail("xss", `${f}: writes raw HTML; render text through React so it is escaped`);
  }
}

// 8. Legal risks that stay fixed ---------------------------------------------------------------------------
const webFiles = tracked.filter((f) => /^(src\/.*\.(tsx|ts|jsx|css)|index\.html|public\/.*\.(html|js))$/.test(f));
// Session replay records what people type and see; on a health app that is health data. None, ever, without a decision.
const REPLAY = /hotjar|fullstory|logrocket|clarity\.ms|mouseflow|smartlook|openreplay|rrweb|session_recording|replayIntegration|@sentry\/replay|heapanalytics|inspectlet|luckyorange/i;
for (const f of webFiles) if (REPLAY.test(read(f))) fail("no-session-replay", `${f}: session replay / screen recording is not allowed (it would capture health data)`);
for (const lock of ["package.json", "server/package.json"]) {
  const deps = Object.keys({ ...JSON.parse(read(lock)).dependencies });
  for (const d of deps) if (REPLAY.test(d)) fail("no-session-replay", `${lock}: ${d}`);
}
// Fonts come from this site (the privacy page and the security policy say so).
const FONT_CDN = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|use\.fontawesome\.com/;
for (const f of webFiles) if (FONT_CDN.test(read(f))) fail("self-hosted-fonts", `${f}: loads fonts from a third party; self-host them (@fontsource)`);
// A subscribe / trial / upgrade button must have its renewal terms beside it.
for (const f of tracked.filter((f) => /^src\/.*\.tsx$/.test(f))) {
  const text = read(f);
  if (/>\s*(Subscribe|Start (your )?(free )?trial|Upgrade( to \w+)?|Go premium)\s*</i.test(text) && !/renew/i.test(text)) {
    fail("renewal-terms", `${f}: a subscribe/trial/upgrade button needs the price, renewal period and how to cancel shown next to it`);
  }
}
// The age gate stays on both sides.
if (!/oldEnough\(/.test(read("src/features/auth/RegisterPage.tsx"))) fail("age-gate", "the sign-up page no longer checks the age gate");
if (!/assertAdultBirthDate\(/.test(read("server/src/modules/auth/auth.service.ts"))) fail("age-gate", "the server no longer checks the age gate at sign-up");

if (problems.length) {
  console.error(`Launch standard: ${problems.length} problem(s)\n  ${problems.join("\n  ")}\n\nSee docs/LAUNCH_STANDARD.md.`);
  process.exit(1);
}
console.log(`Launch standard: all checks passed (${tracked.length} tracked files).`);
