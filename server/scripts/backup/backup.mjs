// Takes an encrypted backup of the database.
//
//   DATABASE_URL=...  BACKUP_PASSPHRASE=...  node scripts/backup/backup.mjs [outputDirectory]
//
// It dumps only the `public` schema (the app's own tables) with pg_dump, encrypts the dump (see
// crypto.mjs) and removes the unencrypted copy straight away. Prints the path of the encrypted file.
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rowCounts } from "./counts.mjs";
import { encryptFile } from "./crypto.mjs";
import { runPg } from "./run.mjs";

const url = process.env.DATABASE_URL;
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!url) throw new Error("DATABASE_URL is not set.");
if (!passphrase) throw new Error("BACKUP_PASSPHRASE is not set.");

const outDir = process.argv[2] ?? "backups";
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const plain = join(tmpdir(), `women360-${stamp}-${process.pid}.dump`);
const encrypted = join(outDir, `women360-${stamp}.dump.enc`);

try {
  // Row counts just before the dump, saved beside the backup so a later restore can be checked against them.
  const before = rowCounts(url, "live");
  writeFileSync(`${encrypted}.counts.json`, JSON.stringify(Object.fromEntries(before)));
  // The connection goes to pg_dump in its environment, never on the command line or in a log line.
  runPg("pg_dump", ["--format=custom", "--schema=public", "--no-owner", "--no-privileges", `--file=${plain}`], url);
  if (statSync(plain).size < 1024) throw new Error("The dump is suspiciously small; refusing to keep it.");
  encryptFile(plain, encrypted, passphrase);
} finally {
  rmSync(plain, { force: true });
}
console.log(encrypted);
