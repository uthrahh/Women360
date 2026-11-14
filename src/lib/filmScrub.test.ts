import { describe, expect, it } from "vitest";
import { FILM_SECONDS, HEADLINE_FROM, SCENES, timeline } from "@/content/lifeFilm";
import { approach, clamp01, labelOpacity, needsSeek, sceneAt, sectionProgress, targetTime } from "./filmScrub";

const scenes = timeline();

describe("the film's timeline", () => {
  it("covers the whole film once, in order, with no gaps", () => {
    expect(scenes[0].from).toBe(0);
    expect(scenes[scenes.length - 1].to).toBeCloseTo(1, 10);
    for (let i = 1; i < scenes.length; i++) expect(scenes[i].from).toBeCloseTo(scenes[i - 1].to, 10);
  });

  it("has the six stages the story needs, one word each, with the film long enough to scrub and short enough to feel brisk", () => {
    expect(SCENES.map((s) => s.label)).toEqual(["Childhood", "Growing", "Becoming", "Flourishing", "Evolving", "A lifetime"]);
    expect(FILM_SECONDS).toBeGreaterThan(10);
    expect(FILM_SECONDS).toBeLessThan(20);
  });

  it("gives every scene a whole number of frames at 24 fps, so the edit can match it exactly", () => {
    for (const s of SCENES) expect(Number.isInteger(s.seconds * 24), `${s.id}: ${s.seconds * 24} frames`).toBe(true);
    expect(FILM_SECONDS * 24).toBe(348);
  });

  it("holds the closing words over the final scene, not before the story is done", () => {
    const last = scenes[scenes.length - 1];
    expect(HEADLINE_FROM).toBeGreaterThan(scenes[scenes.length - 2].to);
    expect(HEADLINE_FROM).toBeLessThan(last.to);
  });
});

describe("where the visitor is in the section", () => {
  it("is 0 before the section reaches the top, 1 once it has been scrolled through, and linear between", () => {
    expect(sectionProgress(200, 1000)).toBe(0);
    expect(sectionProgress(0, 1000)).toBe(0);
    expect(sectionProgress(-500, 1000)).toBe(0.5);
    expect(sectionProgress(-1000, 1000)).toBe(1);
    expect(sectionProgress(-4000, 1000)).toBe(1);
  });

  it("is safe when there is nothing to scroll through", () => {
    expect(sectionProgress(-100, 0)).toBe(0);
    expect(sectionProgress(-100, -50)).toBe(0);
  });
});

describe("which stage is showing", () => {
  it("finds the scene for a point in the film, including the very start and the very end", () => {
    expect(sceneAt(scenes, 0)?.id).toBe("childhood");
    expect(sceneAt(scenes, 0.5)?.id).toBe("flourishing");
    expect(sceneAt(scenes, 0.999)?.id).toBe("lifetime");
    expect(sceneAt(scenes, 1)?.id).toBe("lifetime");
    expect(sceneAt(scenes, -3)?.id).toBe("childhood");
  });

  it("fades a word in at the start of its scene and out at the end, and shows only one at a time", () => {
    const s = scenes[2];
    const middle = (s.from + s.to) / 2;
    expect(labelOpacity(s.from, s)).toBe(0);
    expect(labelOpacity(middle, s)).toBe(1);
    expect(labelOpacity(s.to, s)).toBe(0);
    expect(labelOpacity(s.from - 0.1, s)).toBe(0);
    for (const p of [0.05, 0.2, 0.4, 0.6, 0.8]) {
      const visible = scenes.filter((x) => labelOpacity(p, x) > 0);
      expect(visible.length, `at ${p}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("the video's clock", () => {
  it("maps progress to a time inside the video and keeps the final frame reachable", () => {
    expect(targetTime(0, 14)).toBe(0);
    expect(targetTime(0.5, 14)).toBeCloseTo(6.975, 3);
    expect(targetTime(1, 14)).toBeLessThan(14);
    expect(targetTime(1, 14)).toBeGreaterThan(13.9);
    expect(targetTime(0.5, NaN)).toBe(0);
    expect(targetTime(0.5, 0)).toBe(0);
    expect(targetTime(7, 14)).toBe(targetTime(1, 14));
  });

  it("eases towards the target, lands exactly so the loop can stop, and works in both directions", () => {
    let v = 0;
    const steps: number[] = [];
    for (let i = 0; i < 80 && v !== 1; i++) {
      v = approach(v, 1);
      steps.push(v);
    }
    expect(v).toBe(1);
    expect(steps.length).toBeLessThan(80);
    expect(steps[0]).toBeGreaterThan(0);
    expect(steps[0]).toBeLessThan(0.5); // it does not jump
    let down = 1;
    for (let i = 0; i < 80 && down !== 0; i++) down = approach(down, 0);
    expect(down).toBe(0);
  });

  it("does not seek for less than half a frame", () => {
    expect(needsSeek(1, 1.01, 24)).toBe(false);
    expect(needsSeek(1, 1.05, 24)).toBe(true);
    expect(needsSeek(1.05, 1, 24)).toBe(true);
  });

  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});
