import { describe, expect, it } from "vitest";
import { computeCorrelations, pearson, type MetricKey } from "@/modules/insights/correlations";

function dayMap(values: number[], startIso = "2026-01-01"): Map<string, number> {
  const start = new Date(startIso).getTime();
  const map = new Map<string, number>();
  values.forEach((v, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    map.set(date, v);
  });
  return map;
}

describe("pearson", () => {
  it("is 1 for a perfectly positively correlated pair", () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 5);
  });

  it("is -1 for a perfectly negatively correlated pair", () => {
    expect(pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });

  it("is 0 when either series has zero variance (a constant can't correlate)", () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });

  it("is 0 for fewer than 2 points", () => {
    expect(pearson([1], [1])).toBe(0);
  });
});

describe("computeCorrelations", () => {
  it("reports a strong pair that clears the minimum overlap and threshold", () => {
    const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
      sleepHours: dayMap([5, 6, 7, 8, 5, 6, 7, 8]),
      mood: dayMap([1, 2, 3, 4, 1, 2, 3, 4]),
    };
    const results = computeCorrelations(metrics);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ metricA: "sleepHours", metricB: "mood", direction: "positive", strength: "strong" });
    expect(results[0].n).toBe(8);
  });

  it("drops a pair below the overlap minimum even if perfectly correlated", () => {
    const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
      sleepHours: dayMap([5, 6, 7]),
      mood: dayMap([1, 2, 3]),
    };
    expect(computeCorrelations(metrics)).toEqual([]);
  });

  it("drops a pair that's weakly/noisily related", () => {
    const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
      sleepHours: dayMap([5, 7, 5, 7, 5, 7, 5, 7]),
      stress: dayMap([3, 2, 4, 1, 2, 3, 1, 4]),
    };
    expect(computeCorrelations(metrics)).toEqual([]);
  });

  it("only compares days both metrics were actually logged on", () => {
    const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
      // hydration logged every day, energy only logged on the first 7 —
      // the correlation must be computed over just those 7 shared days.
      hydrationMl: dayMap([500, 1000, 1500, 2000, 500, 1000, 1500, 2000, 500, 1000]),
      energy: dayMap([1, 2, 3, 4, 1, 2, 3]),
    };
    const results = computeCorrelations(metrics);
    expect(results).toHaveLength(1);
    expect(results[0].n).toBe(7);
  });

  it("ranks multiple qualifying pairs strongest-first and caps the result count", () => {
    const metrics: Partial<Record<MetricKey, Map<string, number>>> = {
      sleepHours: dayMap([5, 6, 7, 8, 5, 6, 7, 8]),
      mood: dayMap([1, 2, 3, 4, 1, 2, 3, 4]), // r = 1 with sleepHours
      energy: dayMap([4, 3, 1, 2, 4, 3, 1.5, 2]), // weaker, mixed relation with sleepHours
    };
    const results = computeCorrelations(metrics);
    expect(results[0].metricA === "sleepHours" || results[0].metricB === "sleepHours").toBe(true);
    for (let i = 1; i < results.length; i++) {
      expect(Math.abs(results[i - 1].r)).toBeGreaterThanOrEqual(Math.abs(results[i].r));
    }
  });
});
