import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain ES module script with no type declarations
import { decryptBuffer, encryptBuffer } from "../scripts/backup/crypto.mjs";

const PASSPHRASE = "a-long-test-passphrase-for-backups";
const sample = Buffer.from("PGDMP fake dump with some health data in it".repeat(50));

describe("backup encryption", () => {
  it("round-trips, and the encrypted file does not contain the data", () => {
    const enc: Buffer = encryptBuffer(sample, PASSPHRASE);
    expect(enc.includes(Buffer.from("health data"))).toBe(false);
    expect(decryptBuffer(enc, PASSPHRASE).equals(sample)).toBe(true);
  });

  it("encrypts the same data differently every time", () => {
    expect(encryptBuffer(sample, PASSPHRASE).equals(encryptBuffer(sample, PASSPHRASE))).toBe(false);
  });

  it("refuses a wrong passphrase", () => {
    const enc: Buffer = encryptBuffer(sample, PASSPHRASE);
    expect(() => decryptBuffer(enc, "a-different-long-passphrase-here")).toThrow(/passphrase is wrong|changed/);
  });

  it("refuses a file that was changed or cut short", () => {
    const enc: Buffer = encryptBuffer(sample, PASSPHRASE);
    const flipped = Buffer.from(enc);
    flipped[flipped.length - 40] ^= 0xff;
    expect(() => decryptBuffer(flipped, PASSPHRASE)).toThrow(/changed or cut short/);
    expect(() => decryptBuffer(enc.subarray(0, enc.length - 20), PASSPHRASE)).toThrow();
    expect(() => decryptBuffer(Buffer.from("not a backup at all, just some text"), PASSPHRASE)).toThrow(/not a Women360 backup/);
  });

  it("refuses a short passphrase", () => {
    expect(() => encryptBuffer(sample, "short")).toThrow(/at least 16/);
  });
});

// @ts-expect-error: a plain ES module script with no type declarations
import { libpqUrl } from "../scripts/backup/connection.mjs";

describe("connection strings for the Postgres tools", () => {
  it("drops the parameters only Prisma understands and keeps the rest", () => {
    expect(libpqUrl("postgresql://u:p@host:5432/db?schema=public")).toBe("postgresql://u:p@host:5432/db");
    expect(libpqUrl("postgresql://u:p@h:6543/db?pgbouncer=true&connection_limit=1&sslmode=require")).toBe("postgresql://u:p@h:6543/db?sslmode=require");
    expect(libpqUrl("postgresql://u:p@h/db")).toBe("postgresql://u:p@h/db");
  });
});
