import { describe, expect, it } from "vitest";
import { dueReminders, isDueToday, reminderMinutes } from "./reminders";
import type { Habit } from "@/types";

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  title: "Walk",
  daysPerWeek: 7,
  reminder: "7:00 AM",
  doneToday: false,
  streak: 0,
  streakUnit: "day",
  thisWeek: 0,
  last7: [false, false, false, false, false, false, false],
  ...over,
});
const at = (h: number, m: number) => new Date(2026, 9, 28, h, m, 0);

describe("reminderMinutes", () => {
  it("reads 12-hour times", () => {
    expect(reminderMinutes("7:00 AM")).toBe(420);
    expect(reminderMinutes("12:00 AM")).toBe(0);
    expect(reminderMinutes("12:30 PM")).toBe(750);
    expect(reminderMinutes("9:45 PM")).toBe(21 * 60 + 45);
  });

  it("ignores anything that isn't a clean time", () => {
    expect(reminderMinutes(undefined)).toBeNull();
    expect(reminderMinutes("every morning")).toBeNull();
    expect(reminderMinutes("")).toBeNull();
  });
});

describe("dueReminders", () => {
  it("fires at the reminder time, not before", () => {
    expect(dueReminders([habit()], at(6, 59), {})).toHaveLength(0);
    expect(dueReminders([habit()], at(7, 0), {})).toHaveLength(1);
    expect(dueReminders([habit()], at(7, 10), {})).toHaveLength(1);
  });

  it("does not fire for a tab opened long after the time", () => {
    expect(dueReminders([habit()], at(7, 15), {})).toHaveLength(1);
    expect(dueReminders([habit()], at(7, 16), {})).toHaveLength(0);
    expect(dueReminders([habit()], at(15, 0), {})).toHaveLength(0);
  });

  it("fires once a day", () => {
    expect(dueReminders([habit()], at(7, 1), { h1: "2026-10-28" })).toHaveLength(0);
    // an announcement from yesterday doesn't count
    expect(dueReminders([habit()], at(7, 1), { h1: "2026-10-27" })).toHaveLength(1);
  });

  it("stays quiet for a habit she has already done today", () => {
    expect(dueReminders([habit({ doneToday: true })], at(7, 1), {})).toHaveLength(0);
  });

  it("stays quiet for habits with no reminder", () => {
    expect(dueReminders([habit({ reminder: undefined })], at(7, 1), {})).toHaveLength(0);
  });

  it("handles several habits at different times", () => {
    const list = [habit({ id: "a", reminder: "7:00 AM" }), habit({ id: "b", reminder: "9:30 PM" })];
    expect(dueReminders(list, at(7, 2), {}).map((h) => h.id)).toEqual(["a"]);
    expect(dueReminders(list, at(21, 31), {}).map((h) => h.id)).toEqual(["b"]);
  });
});

describe("isDueToday", () => {
  it("an N-days-a-week habit is not due once the week's quota is met", () => {
    expect(isDueToday(habit({ daysPerWeek: 3, thisWeek: 3 }))).toBe(false);
    expect(isDueToday(habit({ daysPerWeek: 3, thisWeek: 2 }))).toBe(true);
    expect(isDueToday(habit({ daysPerWeek: 7, thisWeek: 7 }))).toBe(true);
  });
});
