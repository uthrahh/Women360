import { runPg } from "./run.mjs";

const psql = (url, sql) => runPg("psql", ["-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql], url, { capture: true });

/** table name -> row count, for every table in the public schema. */
export function rowCounts(url, label) {
  try {
    const tables = psql(url, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1").split(/\r?\n/).filter(Boolean);
    if (tables.length === 0) return new Map();
    const union = tables.map((t) => `SELECT '${t.replace(/'/g, "''")}', count(*) FROM public."${t.replace(/"/g, '""')}"`).join(" UNION ALL ");
    return new Map(psql(url, union).split(/\r?\n/).map((line) => { const [t, n] = line.split("|"); return [t, Number(n)]; }));
  } catch (err) {
    throw new Error(`Could not count rows in the ${label} database: ${err.message}`);
  }
}
