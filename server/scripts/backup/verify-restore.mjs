// Proves a backup can actually be restored, which is the only kind of backup worth having.
//
//   BACKUP_PASSPHRASE=...  RESTORE_DATABASE_URL=<an EMPTY scratch database>  [SOURCE_DATABASE_URL=<the live one>]
//   node scripts/backup/verify-restore.mjs <backup file>
//
// It decrypts the file, restores it into the scratch database, and checks the number of rows in every table.
// The backup records each table's row count just before the dump (a small "<file>.counts.json" beside it). A
// table passes when its restored count lies between that count and the live database's count now (rows are
// added between the two), with a little slack for rows deleted in between. A missing table, a table with
// noticeably fewer rows than the backup recorded, or any restore error fails the run.
// It refuses to run against a scratch database that already has tables, so it can't overwrite real data.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decryptFile } from "./crypto.mjs";
import { pgEnv } from "./connection.mjs";
import { rowCounts } from "./counts.mjs";
import { runPg } from "./run.mjs";

const file = process.argv[2];
const passphrase = process.env.BACKUP_PASSPHRASE;
const restoreUrl = process.env.RESTORE_DATABASE_URL;
const sourceUrl = process.env.SOURCE_DATABASE_URL;
if (!file) throw new Error("Usage: node scripts/backup/verify-restore.mjs <backup file>");
if (!passphrase) throw new Error("BACKUP_PASSPHRASE is not set.");
if (!restoreUrl) throw new Error("RESTORE_DATABASE_URL is not set (an empty scratch database).");
if (sourceUrl && sourceUrl === restoreUrl) throw new Error("The restore target must not be the source database.");

if (rowCounts(restoreUrl, "scratch (before restoring)").size > 0) throw new Error("The scratch database is not empty. Use a fresh, empty one.");

const plain = join(tmpdir(), `women360-restore-${process.pid}.dump`);
try {
  decryptFile(file, plain, passphrase);
  // --clean --if-exists replaces the empty `public` schema a new database starts with. It is safe here because
  // the target was just checked to have no tables.
  runPg("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${pgEnv(restoreUrl).PGDATABASE}`, plain], restoreUrl);
} finally {
  rmSync(plain, { force: true });
}

const restored = rowCounts(restoreUrl, "restored");
if (restored.size === 0) throw new Error("Nothing was restored.");

const manifestPath = `${file}.counts.json`;
const before = existsSync(manifestPath) ? new Map(Object.entries(JSON.parse(readFileSync(manifestPath, "utf8")))) : null;
const after = sourceUrl ? rowCounts(sourceUrl, "source") : null;
if (!before && !after) console.log("No row counts to compare with (no manifest and no source): only checking that the restore ran.");

const slack = (n) => Math.max(5, Math.ceil(n * 0.01));
let problems = 0;
const tables = new Set([...(before?.keys() ?? []), ...(after?.keys() ?? [])]);
for (const table of tables) {
  const got = restored.get(table);
  const low = Math.min(before?.get(table) ?? Infinity, after?.get(table) ?? Infinity);
  const high = Math.max(before?.get(table) ?? 0, after?.get(table) ?? 0);
  if (got === undefined) { console.error(`MISSING  ${table} (expected about ${high})`); problems += 1; }
  else if (got < low - slack(low)) { console.error(`TOO FEW  ${table}: restored ${got}, the backup recorded ${before?.get(table) ?? "?"}${after ? `, live now ${after.get(table)}` : ""}`); problems += 1; }
  else if (got > high + slack(high)) { console.error(`TOO MANY ${table}: restored ${got}, expected at most about ${high}`); problems += 1; }
}
for (const table of restored.keys()) if ((before || after) && !tables.has(table)) { console.error(`UNEXPECTED ${table} is in the backup but was not counted at backup time`); problems += 1; }

const total = [...restored.values()].reduce((a, b) => a + b, 0);
console.log(`Restored ${restored.size} tables, ${total} rows.`);
if (problems > 0) {
  console.error(`${problems} problem(s). The backup is NOT trustworthy.`);
  process.exit(1);
}
console.log("Restore verified.");

// Tell the API a restore was just verified, so the administrator's status panel can show when. Optional: only
// when BACKUP_REPORT_URL and BACKUP_REPORT_TOKEN are both set. The free API may be asleep, so be patient and retry.
// A failure to report is a warning, never a failed backup.
const reportUrl = process.env.BACKUP_REPORT_URL;
const reportToken = process.env.BACKUP_REPORT_TOKEN;
if (reportUrl && reportToken) {
  let reported = false;
  for (let attempt = 1; attempt <= 3 && !reported; attempt += 1) {
    try {
      const res = await fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${reportToken}` },
        body: JSON.stringify({ tables: restored.size, rows: total }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) reported = true;
      else console.warn(`Reporting the restore to the API failed (HTTP ${res.status}), attempt ${attempt}.`);
    } catch (err) {
      console.warn(`Reporting the restore to the API failed (${err instanceof Error ? err.message : "error"}), attempt ${attempt}.`);
    }
  }
  console.log(reported ? "Reported to the API." : "::warning::The restore was verified but could not be reported to the API.");
}
