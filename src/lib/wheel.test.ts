import { describe, expect, it } from "vitest";
import { daysInMonth, drumHeight, drumPosition, easeOut, glideDuration, indexAt, restingIndex, rubberBand } from "./wheel";

const H = 40;

describe("wheel physics", () => {
  it("snaps to the nearest whole item and stays inside the list", () => {
    expect(indexAt(0, H, 10)).toBe(0);
    expect(indexAt(59, H, 10)).toBe(1);
    expect(indexAt(61, H, 10)).toBe(2);
    expect(indexAt(-500, H, 10)).toBe(0);
    expect(indexAt(5000, H, 10)).toBe(9);
  });

  it("a flick carries further the faster it is, in its own direction", () => {
    const slow = restingIndex(400, 0.2, H, 100);
    const fast = restingIndex(400, 2, H, 100);
    const back = restingIndex(400, -1, H, 100);
    expect(slow).toBeGreaterThan(10);
    expect(fast).toBeGreaterThan(slow);
    expect(back).toBeLessThan(10);
    expect(restingIndex(400, 0, H, 100)).toBe(10);
    expect(restingIndex(400, 50, H, 100)).toBe(99);
  });

  it("gives way less and less past either end", () => {
    expect(rubberBand(100, 0, 400, 200)).toBe(100);
    const a = rubberBand(-50, 0, 400, 200);
    const b = rubberBand(-500, 0, 400, 200);
    expect(a).toBeLessThan(0);
    expect(a).toBeGreaterThan(-50);
    expect(b).toBeGreaterThan(-200);
    expect(rubberBand(450, 0, 400, 200)).toBeGreaterThan(400);
    expect(rubberBand(450, 0, 400, 200)).toBeLessThan(450);
  });

  it("glides longer for longer journeys, within bounds, and eases out", () => {
    expect(glideDuration(10)).toBeLessThan(glideDuration(1000));
    expect(glideDuration(0)).toBeGreaterThanOrEqual(180);
    expect(glideDuration(1e9)).toBe(1100);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it("lays items around a drum: centred, foreshortened, hidden past a quarter turn", () => {
    expect(drumPosition(0, H)).toMatchObject({ angle: 0, y: 0, visible: true, facing: 1 });
    const one = drumPosition(1, H);
    expect(one.y).toBeGreaterThan(30);
    expect(one.y).toBeLessThan(H);
    expect(one.facing).toBeLessThan(1);
    expect(drumPosition(-2, H).y).toBeLessThan(0);
    expect(drumPosition(4, H).visible).toBe(false);
    expect(drumHeight(H)).toBeGreaterThan(4 * H);
  });

  it("knows the length of every month, leap years included", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});
