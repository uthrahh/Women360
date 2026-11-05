import { spawnSync } from "node:child_process";
import { pgEnv } from "./connection.mjs";

/**
 * Runs a PostgreSQL tool against a database. The connection goes in the environment, never in the
 * arguments, and a failure reports the tool's own message without echoing the command or its settings.
 * Returns the tool's standard output.
 */
export function runPg(tool, args, connectionString, { capture = false } = {}) {
  const result = spawnSync(tool, ["--no-password", ...args], {
    env: { ...process.env, ...pgEnv(connectionString) },
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Could not run ${tool}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${tool} failed (exit ${result.status}):\n${(result.stderr ?? "").trim()}`);
  return (result.stdout ?? "").trim();
}
