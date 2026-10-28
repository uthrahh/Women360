import { describe, expect, it } from "vitest";
import { evaluateSignals, type PeriodSummary, type SignalInput } from "@/modules/conditions/signals";
import { addDays } from "@/modules/activity/plan/planner";

const TODAY = "2026-10-29";
const period = (start: string, over: Partial<PeriodSummary> = {}): PeriodSummary => ({
  start, end: addDays(start, 4), lengthKnown: false, excludeCycle: false, heavyDays: 0, maxPain: null, lowEnergyDays: 0, ...over,
});
/** Periods whose starts are the given number of days apart, oldest first, the last one ending at `lastStart`. */
function periodsWith(gaps: number[], lastStart: string, over: (i: number) => Partial<PeriodSummary> = () => ({})): PeriodSummary[] {
  const starts = [lastStart];
  for (const g of [...gaps].reverse()) starts.unshift(addDays(starts[0], -g));
  return starts.map((s, i) => period(s, over(i)));
}
const base = (over: Partial<SignalInput> = {}): SignalInput => ({
  today: TODAY, age: 30, lifeStage: "REPRODUCTIVE", pregnancy: null, declared: [], periods: [], mood: [], ...over,
});
const keys = (input: SignalInput) => evaluateSignals(input).map((s) => s.key);

describe("irregular cycles", () => {
  it("speaks when several recent cycles fall outside 21 to 35 days, with her own numbers", () => {
    const result = evaluateSignals(base({ periods: periodsWith([41, 52, 38, 28], "2026-10-10") }));
    const signal = result.find((s) => s.key === "IRREGULAR_CYCLES")!;
    expect(signal).toBeDefined();
    expect(signal.evidence[0]).toBe("Your last 4 cycles were 41, 52, 38, 28 days long.");
    expect(signal.evidence[1]).toMatch(/3 of them fell outside 21 to 35/);
    expect(signal.sources.length).toBeGreaterThan(0);
    expect(signal.guideline).toMatch(/21|35/);
  });

  it("stays quiet for regular cycles, for one odd cycle, and with too little history", () => {
    expect(keys(base({ periods: periodsWith([28, 29, 27, 30], "2026-10-10") }))).not.toContain("IRREGULAR_CYCLES");
    expect(keys(base({ periods: periodsWith([28, 29, 27, 52], "2026-10-10") }))).not.toContain("IRREGULAR_CYCLES");
    expect(keys(base({ periods: periodsWith([41, 52], "2026-10-10") }))).not.toContain("IRREGULAR_CYCLES");
  });

  it("leaves out a cycle she flagged as unusual", () => {
    const periods = periodsWith([41, 52, 38], "2026-10-10", (i) => (i === 2 ? { excludeCycle: true } : {}));
    // The 52-day cycle ended at a flagged period, so only 41 and 38 are counted, which is too few.
    expect(keys(base({ periods }))).not.toContain("IRREGULAR_CYCLES");
  });

  it("stays quiet when she has told us she has PCOS, during pregnancy and from 45", () => {
    const periods = periodsWith([41, 52, 38, 28], "2026-10-10");
    expect(keys(base({ periods, declared: ["PCOS"] }))).not.toContain("IRREGULAR_CYCLES");
    expect(keys(base({ periods, pregnancy: "PREGNANT" }))).toEqual([]);
    expect(keys(base({ periods, pregnancy: "POSTPARTUM" }))).toEqual([]);
    expect(keys(base({ periods, age: 47 }))).not.toContain("IRREGULAR_CYCLES");
    expect(keys(base({ periods, lifeStage: "PERIMENOPAUSE" }))).not.toContain("IRREGULAR_CYCLES");
  });
});

describe("a long gap", () => {
  it("speaks after 90 days without a period, once periods had been logged", () => {
    const result = evaluateSignals(base({ periods: periodsWith([28, 29], "2026-07-01") }));
    const gap = result.find((s) => s.key === "LONG_GAP")!;
    expect(gap.evidence[0]).toMatch(/120 days ago/);
  });
  it("does not speak at 89 days, with a single logged period, or when she is pregnant", () => {
    expect(keys(base({ periods: periodsWith([28, 29], "2026-08-01") }))).not.toContain("LONG_GAP"); // 89 days
    expect(keys(base({ periods: [period("2026-06-01")] }))).not.toContain("LONG_GAP");
    expect(keys(base({ periods: periodsWith([28, 29], "2026-07-01"), pregnancy: "PREGNANT" }))).toEqual([]);
  });
});

describe("heavy or long periods", () => {
  it("speaks when two of the last three periods lasted over 8 days", () => {
    const periods = periodsWith([28, 28, 28], "2026-10-05", (i) => (i >= 2 ? { lengthKnown: true, end: addDays(i === 2 ? "2026-09-07" : "2026-10-05", 9) } : {}));
    const signal = evaluateSignals(base({ periods })).find((s) => s.key === "HEAVY_OR_LONG_PERIODS")!;
    expect(signal.evidence[0]).toMatch(/lasted more than 8 days/);
  });

  it("speaks for repeated heavy flow, and adds the iron hint when energy was low", () => {
    const periods = periodsWith([28, 28, 28], "2026-10-05", (i) => (i >= 2 ? { heavyDays: 4, lowEnergyDays: 2 } : {}));
    const signal = evaluateSignals(base({ periods })).find((s) => s.key === "HEAVY_OR_LONG_PERIODS")!;
    expect(signal.evidence.join(" ")).toMatch(/heavy flow on 3 or more days in 2 of your last 3/);
    expect(signal.evidence.join(" ")).toMatch(/low energy on 4 of those days.*iron/);
    expect(signal.mayCheck.join(" ")).toMatch(/full blood count/);
  });

  it("stays quiet for one heavy period, and when she has said she has anaemia", () => {
    const one = periodsWith([28, 28, 28], "2026-10-05", (i) => (i === 3 ? { heavyDays: 5 } : {}));
    expect(keys(base({ periods: one }))).not.toContain("HEAVY_OR_LONG_PERIODS");
    const many = periodsWith([28, 28, 28], "2026-10-05", (i) => (i >= 2 ? { heavyDays: 4 } : {}));
    expect(keys(base({ periods: many, declared: ["ANAEMIA"] }))).not.toContain("HEAVY_OR_LONG_PERIODS");
  });

  it("does not call a period long when she only logged its first day", () => {
    const periods = periodsWith([28, 28, 28], "2026-10-05", () => ({ lengthKnown: false, end: "2026-10-05" }));
    expect(keys(base({ periods }))).not.toContain("HEAVY_OR_LONG_PERIODS");
  });
});

describe("painful periods", () => {
  it("speaks when strong pain was logged in three of her last periods", () => {
    const periods = periodsWith([28, 28, 28], "2026-10-05", (i) => ({ maxPain: i === 0 ? 1 : 4 }));
    const signal = evaluateSignals(base({ periods })).find((s) => s.key === "PAINFUL_PERIODS")!;
    expect(signal.evidence[0]).toMatch(/3 of your last 4/);
    expect(signal.relatedTo).toContain("ENDOMETRIOSIS");
  });
  it("stays quiet with two painful periods, with pain not logged, or once she has said she has endometriosis", () => {
    expect(keys(base({ periods: periodsWith([28, 28, 28], "2026-10-05", (i) => ({ maxPain: i >= 2 ? 4 : 1 })) }))).not.toContain("PAINFUL_PERIODS");
    expect(keys(base({ periods: periodsWith([28, 28, 28], "2026-10-05") }))).not.toContain("PAINFUL_PERIODS");
    expect(keys(base({ periods: periodsWith([28, 28, 28], "2026-10-05", () => ({ maxPain: 4 })), declared: ["ENDOMETRIOSIS"] }))).not.toContain("PAINFUL_PERIODS");
  });
});

describe("mood before the period", () => {
  /** Mood each day: `low` in the 7 days before each next period, `high` in cycle days 6 to 10, nothing else. */
  function moods(periods: PeriodSummary[], low: number, high: number) {
    const out: { date: string; mood: number }[] = [];
    for (let i = 0; i + 1 < periods.length; i++) {
      for (let d = 1; d <= 7; d++) out.push({ date: addDays(periods[i + 1].start, -d), mood: low });
      for (let d = 5; d < 10; d++) out.push({ date: addDays(periods[i].start, d), mood: high });
    }
    return out;
  }
  const periods = periodsWith([28, 28, 28], "2026-10-05");

  it("speaks when mood dips before the period and lifts after it starts, in two or more cycles", () => {
    const result = evaluateSignals(base({ periods, mood: moods(periods, 1, 3) }));
    const signal = result.find((s) => s.key === "LUTEAL_MOOD_PATTERN")!;
    expect(signal.evidence).toHaveLength(3);
    expect(signal.evidence[0]).toMatch(/averaged 1\.0 .* 3\.0/);
  });
  it("stays quiet when mood is steady, when the dip is small, or with too few days logged", () => {
    expect(keys(base({ periods, mood: moods(periods, 3, 3) }))).not.toContain("LUTEAL_MOOD_PATTERN");
    expect(keys(base({ periods, mood: moods(periods, 2, 2.5) }))).not.toContain("LUTEAL_MOOD_PATTERN");
    expect(keys(base({ periods, mood: moods(periods, 1, 3).filter((_, i) => i % 6 === 0) }))).not.toContain("LUTEAL_MOOD_PATTERN");
  });
  it("stays quiet once she has said she has PMDD", () => {
    expect(keys(base({ periods, mood: moods(periods, 1, 3), declared: ["PMDD"] }))).not.toContain("LUTEAL_MOOD_PATTERN");
  });
});

describe("the years before menopause", () => {
  it("speaks from 40 when consecutive cycles keep differing by a week or more", () => {
    const result = evaluateSignals(base({ age: 46, periods: periodsWith([28, 38, 26, 37], "2026-10-05") }));
    const signal = result.find((s) => s.key === "CYCLE_CHANGES_PERIMENOPAUSE")!;
    expect(signal.evidence[0]).toMatch(/differed by 7 or more days 3 times/);
  });
  it("speaks after 60 days without a period, but not once it is 90 and the long-gap signal covers it", () => {
    expect(keys(base({ age: 48, periods: periodsWith([28, 29], "2026-08-20") }))).toContain("CYCLE_CHANGES_PERIMENOPAUSE"); // 70 days
    const ninety = keys(base({ age: 48, periods: periodsWith([28, 29], "2026-07-01") }));
    expect(ninety).toContain("LONG_GAP");
    expect(ninety).not.toContain("CYCLE_CHANGES_PERIMENOPAUSE");
  });
  it("stays quiet under 40, without a known age, or when she is already in or past that stage", () => {
    const varied = periodsWith([28, 38, 26, 37], "2026-10-05");
    expect(keys(base({ age: 32, periods: varied }))).not.toContain("CYCLE_CHANGES_PERIMENOPAUSE");
    expect(keys(base({ age: null, periods: varied }))).not.toContain("CYCLE_CHANGES_PERIMENOPAUSE");
    expect(keys(base({ age: 48, periods: varied, lifeStage: "PERIMENOPAUSE" }))).toEqual([]);
    expect(keys(base({ age: 48, periods: varied, declared: ["PERIMENOPAUSE"] }))).not.toContain("CYCLE_CHANGES_PERIMENOPAUSE");
  });
});

describe("what every signal carries", () => {
  it("names a source, a guideline line, what a doctor may check, and a next step, and is never worded as a diagnosis", () => {
    const all = evaluateSignals(base({ periods: periodsWith([41, 52, 38, 28], "2026-04-01", () => ({ maxPain: 4, heavyDays: 4 })) }));
    expect(all.length).toBeGreaterThan(1);
    for (const s of all) {
      expect(s.sources.length).toBeGreaterThan(0);
      expect(s.guideline.length).toBeGreaterThan(20);
      expect(s.mayCheck.length).toBeGreaterThan(0);
      expect(s.nextStep).toMatch(/doctor/);
      expect(`${s.title} ${s.evidence.join(" ")}`.toLowerCase()).not.toMatch(/you have (pcos|endometriosis|pmdd)|diagnos/);
    }
  });
});
