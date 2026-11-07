import { describe, expect, it } from "vitest";
import { RELEASE_NOTES, groupByMonth, shortDate } from "./releaseNotes";

// The house rules from docs/RELEASE_NOTES.md, enforced so a sloppy entry fails the tests instead of shipping.
const JARGON = /\b(api|prisma|csp|endpoint|migration|refactor|sql|jwt|backend|frontend|commit|dependency|dependencies|bundle|webpack|vite|react|typescript)\b/i;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

describe("release notes: format", () => {
  it("has entries, newest first, with real dates that are not in the future", () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(5);
    // A day of slack: the date is the writer's local day, which can be a day ahead of UTC.
    const today = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    RELEASE_NOTES.forEach((n, i) => {
      expect(n.date, n.headline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(n.date)), `${n.date} is not a real date`).toBe(false);
      expect(n.date <= today, `${n.headline} is dated in the future`).toBe(true);
      if (i > 0) expect(RELEASE_NOTES[i - 1].date >= n.date, `"${n.headline}" is out of order: newest entries go first`).toBe(true);
    });
  });

  it("gives every entry a short headline with no full stop", () => {
    for (const n of RELEASE_NOTES) {
      expect(n.headline.length, n.headline).toBeGreaterThanOrEqual(8);
      expect(n.headline.length, `"${n.headline}" is longer than 60 characters`).toBeLessThanOrEqual(60);
      expect(n.headline.endsWith("."), `"${n.headline}" ends with a full stop`).toBe(false);
    }
  });

  it("gives every entry two or three sentences of detail", () => {
    for (const n of RELEASE_NOTES.filter((x) => x.headline !== "Women360 begins")) {
      const count = sentences(n.details).length;
      expect(count, `"${n.headline}" has ${count} sentences; use two or three`).toBeGreaterThanOrEqual(2);
      expect(count, `"${n.headline}" has ${count} sentences; use two or three`).toBeLessThanOrEqual(3);
    }
    for (const n of RELEASE_NOTES) expect(n.details.length, n.headline).toBeLessThanOrEqual(460);
  });

  it("is written for the people who use Women360, not for engineers", () => {
    for (const n of RELEASE_NOTES) {
      expect(JARGON.test(n.headline + " " + n.details), `"${n.headline}" uses technical wording`).toBe(false);
    }
  });

  it("has no duplicate entries", () => {
    const keys = RELEASE_NOTES.map((n) => `${n.date}|${n.headline}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("release notes: grouping and dates", () => {
  it("groups by month, newest month first, keeping every entry", () => {
    const months = groupByMonth();
    expect(months.map((m) => m.key)).toEqual([...months.map((m) => m.key)].sort().reverse());
    expect(months.flatMap((m) => m.entries)).toHaveLength(RELEASE_NOTES.length);
    for (const m of months) for (const e of m.entries) expect(e.date.startsWith(m.key)).toBe(true);
  });

  it("labels months and days in plain words", () => {
    const months = groupByMonth([
      { date: "2026-11-08", headline: "A", details: "x." },
      { date: "2026-10-31", headline: "B", details: "x." },
    ]);
    expect(months.map((m) => m.label)).toEqual(["November 2026", "October 2026"]);
    expect(shortDate("2026-11-08")).toBe("8 Nov");
    expect(shortDate("2026-01-31")).toBe("31 Jan");
  });
});
