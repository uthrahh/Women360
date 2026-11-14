import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// Standing rule (CLAUDE.md, launch standard): every table has row-level security switched on, so the hosted database's
// automatic data API can never reach health data around the API. A migration that adds a table must also run
// ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY; this test fails until it does.
describe("row-level security", () => {
  it("is on for every table", async () => {
    const off = await prisma.$queryRaw<{ table: string }[]>`
      SELECT c.relname AS "table"
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false`;
    expect(off.map((r) => r.table)).toEqual([]);
  });

  it("does not get in the way of the API, which connects as the tables' owner", async () => {
    const owner = await prisma.$queryRaw<{ owns: boolean }[]>`
      SELECT bool_and(pg_get_userbyid(c.relowner) = current_user) AS owns
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    expect(owner[0].owns).toBe(true);
    // And reads still work.
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
