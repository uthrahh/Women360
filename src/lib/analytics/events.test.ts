import { describe, expect, it } from "vitest";
import { EVENTS, GA4_NAME_RULE, PREVIEW_PATH, TRACKED_PATHS, cleanPath, cleanText, depthsPassed, isLongPage, isTrackedPath, isValidEventName, isValidParamName } from "./events";

describe("event definitions follow GA4's rules", () => {
  it("every event and parameter name is valid, short and not one GA4 reserves", () => {
    for (const e of EVENTS) {
      expect(isValidEventName(e.name), e.name).toBe(true);
      expect(e.name.length).toBeLessThanOrEqual(40);
      expect(e.params.length).toBeLessThanOrEqual(25);
      for (const p of e.params) {
        expect(isValidParamName(p.name), `${e.name}.${p.name}`).toBe(true);
        expect(String(p.example).length, `${e.name}.${p.name} example`).toBeLessThanOrEqual(100);
        expect(typeof p.example).toBe(p.type);
      }
    }
  });

  it("has unique names and documents each one", () => {
    expect(new Set(EVENTS.map((e) => e.name)).size).toBe(EVENTS.length);
    for (const e of EVENTS) {
      expect(e.trigger.length).toBeGreaterThan(10);
      expect(e.how.length).toBeGreaterThan(10);
      expect(e.params.length).toBeGreaterThan(0);
    }
  });

  it("covers what was asked for: navigation, copy, filter, search and scroll depth", () => {
    expect(EVENTS.map((e) => e.name)).toEqual(expect.arrayContaining(["nav_click", "code_copy", "filter_change", "site_search", "scroll_depth", "page_view"]));
  });

  it("rejects names GA4 would ignore or double count", () => {
    for (const bad of ["Click", "1st", "click", "scroll", "search", "file_download", "ga_thing", "google_thing", "firebase_thing", "has space", "a".repeat(41), ""]) {
      expect(isValidEventName(bad), bad).toBe(false);
    }
    expect(GA4_NAME_RULE.test("nav_click")).toBe(true);
  });
});

describe("what may be sent", () => {
  it("reports only the public pages, never the app, sign-in, admin or coach screens", () => {
    for (const ok of ["/", "/privacy", "/terms", "/release-notes", "/privacy/"]) expect(isTrackedPath(ok), ok).toBe(true);
    for (const no of ["/app/dashboard", "/app/cycle", "/login", "/register", "/admin", "/coach", "/onboarding", "/reset-password", "/analytics-reference", "/app"]) {
      expect(isTrackedPath(no), no).toBe(false);
    }
    expect(TRACKED_PATHS).not.toContain(PREVIEW_PATH);
  });

  it("keeps parameter text short, plain and free of email addresses", () => {
    expect(cleanText("  Lots   of\n space  ")).toBe("Lots of space");
    expect(cleanText("x".repeat(300), 100)).toHaveLength(100);
    expect(cleanText("write to someone@example.com now")).toBe("");
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(42)).toBe("42");
  });

  it("drops the query string and the hash from a path", () => {
    expect(cleanPath("/reset-password?token=abc123#x")).toBe("/reset-password");
    expect(cleanPath("/privacy#data")).toBe("/privacy");
    expect(cleanPath("")).toBe("/");
  });
});

describe("scroll depth", () => {
  it("reports each depth once the bottom of the window passes it", () => {
    // A 1000px-tall page seen through a 400px window.
    // 40% of the page is already in view before any scrolling, which is why tracking only starts at the first scroll.
    expect(depthsPassed(0, 400, 1000)).toEqual([25]);
    expect(depthsPassed(100, 400, 1000)).toEqual([25, 50]);
    expect(depthsPassed(350, 400, 1000)).toEqual([25, 50, 75]);
    expect(depthsPassed(600, 400, 1000)).toEqual([25, 50, 75, 100]);
  });

  it("counts 100% at the very bottom, allowing for rounding", () => {
    expect(depthsPassed(599.7, 400, 1000)).toContain(100);
    expect(depthsPassed(590, 400, 1000)).not.toContain(100);
    expect(depthsPassed(0, 400, 0)).toEqual([]);
  });

  it("only applies to pages that really scroll", () => {
    expect(isLongPage(800, 900)).toBe(false);
    expect(isLongPage(800, 1040)).toBe(true);
    expect(isLongPage(800, 5000)).toBe(true);
  });
});
