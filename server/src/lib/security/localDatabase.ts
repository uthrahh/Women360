/**
 * The demo seed creates an ADMIN account with a published password. It must
 * be impossible to point it at a real database by accident (a DATABASE_URL
 * left over in a shell, a copy-pasted command), so it refuses anything that
 * isn't clearly the local machine.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export function isLocalDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname.toLowerCase());
  } catch {
    return false; // unparseable — don't guess
  }
}
