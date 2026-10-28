import { describe, expect, it } from "vitest";
import { estimateCalories, formatDuration, shortcutKey } from "./activity";

describe("activity helpers", () => {
  it("writes readable durations", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(95)).toBe("1 h 35 min");
  });

  it("estimates calories like the server does", () => {
    expect(estimateCalories(4.3, 60, 60)).toBe(258);
    expect(estimateCalories(9.8, 70, 30)).toBe(343);
  });

  it("gives no estimate without a weight, a MET value or a duration", () => {
    expect(estimateCalories(4.3, null, 30)).toBeNull();
    expect(estimateCalories(undefined, 60, 30)).toBeNull();
    expect(estimateCalories(4.3, 60, 0)).toBeNull();
  });

  it("treats the same activity, length and effort as one shortcut", () => {
    expect(shortcutKey("walking", 30, "moderate")).toBe(shortcutKey("walking", 30, "moderate"));
    expect(shortcutKey("walking", 30, "moderate")).not.toBe(shortcutKey("walking", 31, "moderate"));
    expect(shortcutKey("walking", 30, "moderate")).not.toBe(shortcutKey("walking", 30, "high"));
  });
});
