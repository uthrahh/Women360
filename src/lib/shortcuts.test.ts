import { describe, expect, it } from "vitest";
import { GO_KEYS, destinationFor, matchesQuery } from "./shortcuts";
import { menuTree } from "@/config/navigation";

describe("keyboard shortcuts", () => {
  it("gives every screen in the menu its own letter, with none used twice", () => {
    const screens = menuTree.flatMap((n) => ("leaf" in n ? [n.leaf.to] : n.items.map((i) => i.to)));
    for (const to of screens) expect(GO_KEYS[to], `${to} has no shortcut`).toBeTruthy();
    const letters = Object.values(GO_KEYS);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("maps a letter after G to its screen, in either case, and ignores anything else", () => {
    expect(destinationFor("h")).toBe("/app/habits");
    expect(destinationFor("H")).toBe("/app/habits");
    expect(destinationFor(",")).toBe("/app/settings");
    expect(destinationFor("z")).toBeUndefined();
  });

  it("finds commands by any words typed, in any order", () => {
    expect(matchesQuery("", "Habits")).toBe(true);
    expect(matchesQuery("hab", "Habits")).toBe(true);
    expect(matchesQuery("dark mode", "Switch to dark mode", "theme")).toBe(true);
    expect(matchesQuery("mode dark", "Switch to dark mode")).toBe(true);
    expect(matchesQuery("theme", "Switch to dark mode", "theme appearance")).toBe(true);
    expect(matchesQuery("sleep zzz", "Sleep")).toBe(false);
  });
});
