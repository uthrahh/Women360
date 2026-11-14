import { describe, expect, it } from "vitest";
import { pickScene, sceneViewBox } from "./sceneScroll";

const TOPS = [0, 1000, 2000, 3000];

describe("pickScene", () => {
  it("starts on the first scene", () => {
    expect(pickScene(TOPS, 0, 4000)).toEqual({ index: 0, progress: 0 });
  });

  it("is the last section that has reached the reading line", () => {
    expect(pickScene(TOPS, 999, 4000).index).toBe(0);
    expect(pickScene(TOPS, 1000, 4000).index).toBe(1);
    expect(pickScene(TOPS, 2500, 4000)).toEqual({ index: 2, progress: 0.5 });
  });

  it("runs the last scene to the end of the page", () => {
    expect(pickScene(TOPS, 3500, 4000)).toEqual({ index: 3, progress: 0.5 });
    expect(pickScene(TOPS, 9000, 4000)).toEqual({ index: 3, progress: 1 });
  });

  it("steps progress in whole frames", () => {
    const { progress } = pickScene([0, 1000], 337, 1000, 10);
    expect(progress).toBe(0.3);
  });

  it("copes with no sections and with sections that share a position", () => {
    expect(pickScene([], 500, 1000)).toEqual({ index: 0, progress: 0 });
    expect(pickScene([0, 500, 500], 600, 1000).index).toBe(2);
  });

  it("works backwards as well as forwards (scrolling up)", () => {
    const down = pickScene(TOPS, 2600, 4000);
    const up = pickScene(TOPS, 1400, 4000, 10);
    expect(down.index).toBe(2);
    expect(up).toEqual({ index: 1, progress: 0.4 });
  });
});

describe("sceneViewBox", () => {
  it("shows the whole stage on wide screens and the figure's column on tall ones", () => {
    expect(sceneViewBox(1440, 900)).toBe("0 0 1600 900");
    expect(sceneViewBox(375, 812)).toBe("1000 0 500 900");
  });
});
