import { describe, expect, it } from "vitest";
import { AppleStepsReader, localDay, parseStepsCsv, stepsFromBuckets, syncWindow } from "./stepsImport";

const window = { from: "2026-11-01", to: "2026-11-18" };

describe("syncWindow", () => {
  it("covers today and the days before it, never more than the server accepts", () => {
    expect(syncWindow("2026-11-18", 14)).toEqual({ from: "2026-11-05", to: "2026-11-18" });
    expect(syncWindow("2026-11-18", 1)).toEqual({ from: "2026-11-18", to: "2026-11-18" });
    expect(syncWindow("2026-03-02", 500).from).toBe(localDay(new Date(2026, 2, 2 - 89)));
  });
});

describe("stepsFromBuckets", () => {
  it("makes one rounded entry per local day, in order, and drops what cannot be real", () => {
    const out = stepsFromBuckets([
      { startDate: new Date(2026, 10, 17, 0, 0).toISOString(), value: 8123.6 },
      { startDate: new Date(2026, 10, 16, 0, 0).toISOString(), value: 4000 },
      { startDate: "not a date", value: 5 },
      { startDate: new Date(2026, 10, 15, 0, 0).toISOString(), value: -3 },
      { startDate: new Date(2026, 10, 14, 0, 0).toISOString(), value: Number.NaN },
    ]);
    expect(out).toEqual([
      { date: "2026-11-16", steps: 4000 },
      { date: "2026-11-17", steps: 8124 },
    ]);
  });

  it("caps an absurd count at what the server accepts", () => {
    expect(stepsFromBuckets([{ startDate: new Date(2026, 10, 17).toISOString(), value: 999_999 }])[0].steps).toBe(200_000);
  });
});

describe("parseStepsCsv", () => {
  it("reads date and steps, with or without a header, and counts what it could not read", () => {
    const { days, skipped } = parseStepsCsv('date,steps\n2026-11-02,5000\n"2026-11-03";"6 000"\n\nnonsense\n2026-11-04,-5\n2026-11-05,abc\n2026-10-01,9000\n2026-12-01,9000', window);
    expect(days).toEqual([
      { date: "2026-11-02", steps: 5000 },
      { date: "2026-11-03", steps: 6000 },
    ]);
    // Out-of-window days are simply left out; only unreadable lines are "skipped".
    expect(skipped).toBe(3);
  });
});

describe("AppleStepsReader", () => {
  const rec = (source: string, day: string, value: number, order: "a" | "b" = "a") =>
    order === "a"
      ? `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="${source}" unit="count" creationDate="${day} 21:00:00 +0530" startDate="${day} 10:00:00 +0530" endDate="${day} 10:10:00 +0530" value="${value}"/>`
      : `<Record value="${value}" startDate="${day} 11:00:00 +0530" sourceName="${source}" type="HKQuantityTypeIdentifierStepCount"/>`;

  it("adds a source's readings through the day and takes the source that counted most", () => {
    const r = new AppleStepsReader(window);
    r.push(
      `<?xml version="1.0"?><HealthData>${rec("iPhone", "2026-11-10", 3000)}${rec("iPhone", "2026-11-10", 2000, "b")}${rec("Watch", "2026-11-10", 4000)}` +
        `<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" startDate="2026-11-10 10:00:00 +0530" value="70"/>` +
        `${rec("iPhone", "2026-11-11", 100)}${rec("iPhone", "2026-09-01", 100)}</HealthData>`
    );
    expect(r.result()).toEqual([
      { date: "2026-11-10", steps: 5000 },
      { date: "2026-11-11", steps: 100 },
    ]);
  });

  it("copes with a record cut in half between two pieces of the file", () => {
    const whole = rec("iPhone", "2026-11-12", 777) + rec("iPhone", "2026-11-12", 223);
    const r = new AppleStepsReader(window);
    for (let i = 0; i < whole.length; i += 37) r.push(whole.slice(i, i + 37));
    expect(r.result()).toEqual([{ date: "2026-11-12", steps: 1000 }]);
  });

  it("ignores readings that are not numbers or are negative", () => {
    const r = new AppleStepsReader(window);
    r.push(rec("iPhone", "2026-11-12", Number.NaN) + rec("iPhone", "2026-11-13", -4) + rec("iPhone", "2026-11-14", 50));
    expect(r.result()).toEqual([{ date: "2026-11-14", steps: 50 }]);
  });
});
