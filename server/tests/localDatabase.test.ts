import { describe, expect, it } from "vitest";
import { isLocalDatabaseUrl } from "@/lib/security/localDatabase";

describe("isLocalDatabaseUrl", () => {
  it("accepts the local machine", () => {
    for (const url of [
      "postgresql://u:p@localhost:5432/db?schema=public",
      "postgresql://u:p@127.0.0.1:5432/db",
      "postgresql://u:p@[::1]:5432/db",
      "postgresql://u:p@LOCALHOST/db",
    ]) expect(isLocalDatabaseUrl(url), url).toBe(true);
  });

  it("refuses anything remote — including hosts that merely contain 'localhost'", () => {
    for (const url of [
      "postgresql://u:p@db.abcdefg.supabase.co:5432/postgres",
      "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      "postgresql://u:p@localhost.evil.com:5432/db",
      "postgresql://u:p@10.0.0.5:5432/db",
      "postgresql://u:localhost@db.example.com:5432/db",
    ]) expect(isLocalDatabaseUrl(url), url).toBe(false);
  });

  it("refuses a missing or unparseable URL rather than guessing", () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});
