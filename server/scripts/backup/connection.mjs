// pg_dump, pg_restore and psql use libpq, which rejects the extra parameters Prisma adds to a connection
// string (schema, pgbouncer, connection_limit...). This removes only those, and leaves host, credentials,
// database and TLS settings (sslmode, sslrootcert...) alone.
const PRISMA_ONLY = new Set(["schema", "pgbouncer", "connection_limit", "pool_timeout", "statement_cache_size", "socket_timeout", "connect_timeout"]);

export function libpqUrl(connectionString) {
  const url = new URL(connectionString);
  for (const key of [...url.searchParams.keys()]) if (PRISMA_ONLY.has(key)) url.searchParams.delete(key);
  return url.toString();
}

/**
 * The same connection as PG* environment variables, so the host, user and password never appear on a
 * command line (where an error message or a process list would show them).
 */
export function pgEnv(connectionString) {
  const u = new URL(libpqUrl(connectionString));
  const env = {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
  };
  const sslmode = u.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
}
