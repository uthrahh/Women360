import { afterEach, describe, expect, it, vi } from "vitest";
import { clearStaleCache, peekStale, rememberStale } from "./stale";

// The hook around this (useStaleState) is exercised in the browser tests; the cache rules are plain and tested here.
afterEach(() => {
  vi.useRealTimers();
  clearStaleCache();
});

describe("the stale-while-revalidate cache", () => {
  it("has nothing for a key that was never stored, or for no key", () => {
    expect(peekStale("habits:nobody")).toBeUndefined();
    expect(peekStale(null)).toBeUndefined();
  });

  it("hands back what was stored, per key, so one account's data is never offered under another's key", () => {
    rememberStale("habits:user-a", [{ id: "1" }]);
    expect(peekStale("habits:user-a")).toEqual([{ id: "1" }]);
    expect(peekStale("habits:user-b")).toBeUndefined();
  });

  it("is ignored once it is more than ten minutes old, so an old view is never shown as if it were current", () => {
    vi.useFakeTimers();
    rememberStale("dash:user-a:cycle", { day: 3 });
    vi.advanceTimersByTime(9 * 60_000);
    expect(peekStale("dash:user-a:cycle")).toEqual({ day: 3 });
    vi.advanceTimersByTime(2 * 60_000);
    expect(peekStale("dash:user-a:cycle")).toBeUndefined();
  });

  it("is emptied on demand, which is what signing out does", () => {
    rememberStale("goals:user-a", [1, 2]);
    clearStaleCache();
    expect(peekStale("goals:user-a")).toBeUndefined();
  });
});
