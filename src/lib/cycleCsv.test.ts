import { describe, expect, it } from "vitest";
import { buildCycleCsv } from "./cycleCsv";
import type { CycleDay } from "@/types";

const day = (over: Partial<CycleDay> & { date: string }): CycleDay => ({ isPeriod: false, ...over });

describe("buildCycleCsv", () => {
  it("writes a header and one row per day, oldest first", () => {
    const csv = buildCycleCsv([
      day({ date: "2026-03-02", isPeriod: true, flow: "medium", pain: 2 }),
      day({ date: "2026-03-01", isPeriod: true, flow: "light" }),
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(
      "Date,Period day,Flow,Pain (0-4),Energy (0-4),Mood,Symptoms,What was going on,Cycle left out of predictions,Notes"
    );
    expect(lines[1].startsWith("2026-03-01,yes,light")).toBe(true);
    expect(lines[2].startsWith("2026-03-02,yes,medium,2")).toBe(true);
  });

  it("keeps a pain of 0 (a real answer) distinct from not recorded", () => {
    const [, zero, blank] = buildCycleCsv([
      day({ date: "2026-03-01", pain: 0 }),
      day({ date: "2026-03-02" }),
    ]).trim().split("\r\n");
    expect(zero.split(",")[3]).toBe("0");
    expect(blank.split(",")[3]).toBe("");
  });

  it("turns context tags into readable labels and shows the exclusion flag", () => {
    const [, row] = buildCycleCsv([
      day({ date: "2026-03-01", isPeriod: true, contextTags: ["stress", "contraception_change"], excludeCycle: true }),
    ]).trim().split("\r\n");
    expect(row).toContain("Stress; Birth control change");
    expect(row.split(",")[8]).toBe("yes");
  });

  it("quotes commas, quotes and newlines in free text", () => {
    const [, row] = buildCycleCsv([day({ date: "2026-03-01", notes: 'said "ouch", then\nrested' })]).trim().split("\r\n");
    expect(row).toContain('"said ""ouch"", then');
  });

  it("neutralises spreadsheet-formula injection in typed text", () => {
    const [, row] = buildCycleCsv([
      day({ date: "2026-03-01", notes: "=HYPERLINK(\"http://evil\")", mood: "+1", symptoms: ["@SUM(A1)"] }),
    ]).trim().split("\r\n");
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain("'+1");
    expect(row).toContain("'@SUM(A1)");
    expect(row).not.toMatch(/(^|,)=HYPERLINK/);
  });
});
