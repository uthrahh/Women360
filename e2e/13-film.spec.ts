import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "./fixtures";

// The scroll film. These tests use small synthetic clips (e2e/fixtures/film: a test pattern with a frame counter, made only for testing),
// served in place of the real footage, so what is verified is the behaviour of the section: pinning, scrubbing in both directions, the
// words, the release, loading, phones and tablets, reduced motion, data saving and what happens when the files are missing.

test.use({ storageState: { cookies: [], origins: [] } });

// FILM_DIR=public/film runs the same checks against the real footage once it exists.
const DIR = path.resolve(process.env.FILM_DIR ?? "e2e/fixtures/film");
const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg" };
// The test clips run 14.4 s and the real film 14.5 s; each check compares against the length of the video being served.
const FILM_SECONDS = process.env.FILM_DIR ? 14.5 : 14.4;

/** Serves the test clips (with Range support, as a real host does, because seeking needs it) and records what was asked for. */
async function serveFilm(page: Page, options: { missing?: boolean } = {}) {
  const asked: string[] = [];
  await page.route("**/film/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    asked.push(name);
    const file = path.join(DIR, name);
    if (options.missing || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    const body = fs.readFileSync(file);
    const type = TYPES[path.extname(name)] ?? "application/octet-stream";
    const range = route.request().headers()["range"];
    const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), body.length - 1) : body.length - 1;
      return route.fulfill({
        status: 206,
        headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${body.length}`, "Content-Length": String(end - start + 1) },
        body: body.subarray(start, end + 1),
      });
    }
    return route.fulfill({ status: 200, headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(body.length) }, body });
  });
  return asked;
}

const film = (page: Page) => page.locator("section.film-section");
const video = (page: Page) => page.locator("section.film-section video");

/** Scrolls so the film is `p` (0 to 1) of the way through, then waits for the easing and the seek to settle. */
async function scrollFilmTo(page: Page, p: number) {
  await page.evaluate((progress) => {
    const section = document.querySelector("section.film-section") as HTMLElement;
    const pin = section.firstElementChild as HTMLElement;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (section.offsetHeight - pin.offsetHeight) * progress);
  }, p);
  await page.waitForTimeout(900);
}
const clock = (page: Page) => video(page).evaluate((v) => (v as HTMLVideoElement).currentTime);
const geometry = (page: Page) =>
  page.evaluate(() => {
    const section = document.querySelector("section.film-section") as HTMLElement;
    const pin = section.firstElementChild as HTMLElement;
    return { section: section.offsetHeight, pin: pin.offsetHeight, pinTop: Math.round(pin.getBoundingClientRect().top), view: window.innerHeight };
  });
const visibleWords = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("section.film-section span[style*='opacity']")]
      .filter((el) => el.textContent && Number((el as HTMLElement).style.opacity) > 0.5)
      .map((el) => el.textContent)
  );
const headlineOpacity = (page: Page) =>
  page.evaluate(() => {
    const p = [...document.querySelectorAll("section.film-section p")].find((el) => el.textContent?.startsWith("Every stage"));
    return Number((p?.parentElement as HTMLElement).style.opacity);
  });

async function open(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the film never competes with the page's own loading: it starts only after the page has loaded", async ({ page }) => {
    const asked = await serveFilm(page);
    await open(page);
    await expect.poll(() => asked.some((n) => n.endsWith(".mp4")), { timeout: 8000 }).toBe(true); // just below the hero: near
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const film = performance.getEntriesByType("resource").find((r) => r.name.includes("/film/") && r.name.endsWith(".mp4"));
      return { loadEnd: nav.loadEventEnd, filmStart: film?.startTime ?? -1 };
    });
    expect(timing.filmStart).toBeGreaterThanOrEqual(timing.loadEnd);
    expect(asked.some((n) => n === "life-portrait.mp4"), "the wide screen must not fetch the phone version").toBe(false);
  });

  test("when the film is well below the fold, nothing is downloaded until the visitor scrolls towards it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    const asked = await serveFilm(page);
    await open(page);
    const gap = await page.evaluate(() => document.querySelector("section.film-section")!.getBoundingClientRect().top / window.innerHeight);
    expect(gap, "the film should start more than 1.5 screens down for this check").toBeGreaterThan(1.5);
    await page.waitForTimeout(1500);
    expect(asked, "nothing of the film while it is far below the fold").toEqual([]);
    await page.evaluate(() => window.scrollTo(0, document.querySelector("section.film-section")!.getBoundingClientRect().top + window.scrollY - window.innerHeight));
    await expect.poll(() => asked.some((n) => n.endsWith(".mp4"))).toBe(true);
    await expect(video(page)).toHaveCount(1);
  });

  test("pins for 1.3 screens of scrolling, follows the scroll forward, and lets go at the end", async ({ page }) => {
    await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 0);
    const g = await geometry(page);
    expect(g.section / g.view).toBeCloseTo(2.3, 1);
    expect(g.pinTop).toBe(0);

    let last = -1;
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollFilmTo(page, p);
      expect((await geometry(page)).pinTop, `pinned at ${p}`).toBe(0);
      const t = await clock(page);
      expect(t, `film time at ${p}`).toBeGreaterThanOrEqual(last);
      expect(t).toBeCloseTo(p * FILM_SECONDS, 0);
      last = t;
    }
    expect(await clock(page)).toBeGreaterThan(FILM_SECONDS - 0.5); // the last frame is reached

    // Released: scrolling on carries the pinned screen away and the next section is reachable.
    await page.getByRole("heading", { name: "Everything about your health, in one calm place." }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Everything about your health, in one calm place." })).toBeInViewport();
    expect((await geometry(page)).pinTop).toBeLessThan(0);
  });

  test("runs backwards when scrolling up", async ({ page }) => {
    await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 1);
    const end = await clock(page);
    await scrollFilmTo(page, 0.5);
    const middle = await clock(page);
    await scrollFilmTo(page, 0);
    const start = await clock(page);
    expect(end).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(start);
    expect(start).toBeLessThan(0.6);
    expect(middle).toBeCloseTo(FILM_SECONDS / 2, 0);
  });

  test("names one stage at a time, in order, then holds the closing words", async ({ page }) => {
    await serveFilm(page);
    await open(page);
    const seen: string[] = [];
    for (const p of [0.07, 0.24, 0.4, 0.57, 0.74, 0.855]) {
      await scrollFilmTo(page, p);
      const words = await visibleWords(page);
      expect(words.length, `words at ${p}`).toBe(1);
      seen.push(words[0]!);
      expect(await headlineOpacity(page)).toBe(0);
    }
    expect(seen).toEqual(["Childhood", "Growing", "Becoming", "Flourishing", "Evolving", "A lifetime"]);

    await scrollFilmTo(page, 1);
    expect(await headlineOpacity(page)).toBe(1);
    expect(await visibleWords(page)).toEqual([]); // the stage words give way to the headline
    await expect(film(page).getByText("Every stage of her life matters.")).toBeVisible();
    await expect(film(page).getByText("Women's health and wellbeing, considered across a lifetime.")).toBeVisible();

    await scrollFilmTo(page, 0.3);
    expect(await headlineOpacity(page)).toBe(0);
  });

  test("costs nothing while the visitor is still, and does not shift the page", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 0.5);
    await video(page).evaluate((v) => {
      (window as unknown as { __seeks: number }).__seeks = 0;
      v.addEventListener("seeking", () => ((window as unknown as { __seeks: number }).__seeks += 1));
    });
    await page.waitForTimeout(2000); // standing still
    expect(await page.evaluate(() => (window as unknown as { __seeks: number }).__seeks), "no work while still").toBe(0);

    for (const p of [0.8, 1, 0.4, 0]) await scrollFilmTo(page, p);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
  });

  test("hides from assistive technology as footage, and offers the story in words and a way to skip", async ({ page }) => {
    await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 0.4);
    await expect(video(page)).toHaveAttribute("aria-hidden", "true");
    expect(await video(page).evaluate((v) => (v as HTMLVideoElement).muted)).toBe(true);
    await expect(page.getByRole("heading", { level: 2, name: "A lifetime in bloom" })).toHaveCount(1);
    await expect(film(page).locator("ol.sr-only li")).toHaveText(["Childhood", "Growing", "Becoming", "Flourishing", "Evolving", "A lifetime"]);
    // The skip link is a real Tab stop that leaves the film.
    await film(page).getByRole("link", { name: "Skip the film" }).focus();
    await expect(film(page).getByRole("link", { name: "Skip the film" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Everything about your health, in one calm place." })).toBeInViewport();
  });

  test("passes the accessibility audit while it is playing", async ({ page }) => {
    await serveFilm(page);
    await open(page);
    for (const p of [0.3, 1]) {
      await scrollFilmTo(page, p);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes[0]?.target.join(" ")})`), `at ${p}`).toEqual([]);
    }
  });
});

test.describe("on phones and tablets", () => {
  test("a phone held upright gets the tall composition and a shorter scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const asked = await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 0.5);
    await expect(video(page)).toHaveCount(1);
    expect(asked).toContain("life-portrait.mp4");
    expect(asked).not.toContain("life-landscape.mp4");
    const g = await geometry(page);
    expect(g.section / g.view).toBeCloseTo(2.1, 1);
    expect(g.pinTop).toBe(0);
    expect(await clock(page)).toBeCloseTo(FILM_SECONDS / 2, 0);
    // Nothing is wider than the screen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // The words fit the screen.
    await scrollFilmTo(page, 1);
    const box = await film(page).getByText("Every stage of her life matters.").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });

  test("turning the phone sideways switches to the wide composition", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const asked = await serveFilm(page);
    await open(page);
    await scrollFilmTo(page, 0.2);
    await expect(video(page)).toHaveCount(1);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => asked.includes("life-landscape.mp4"), { timeout: 8000 }).toBe(true);
  });

  test("a tablet upright gets the tall composition and sideways the wide one", async ({ page }) => {
    const asked = await serveFilm(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page);
    await scrollFilmTo(page, 0.3);
    expect(asked).toContain("life-portrait.mp4");
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(() => asked.includes("life-landscape.mp4"), { timeout: 8000 }).toBe(true);
    expect(await geometry(page).then((g) => g.pinTop)).toBe(0);
  });
});

test.describe("when the film should not play", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("reduced motion: no video is downloaded, the page is not pinned, and the words and story are all there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const asked = await serveFilm(page);
    await open(page);
    const still = page.locator("section[aria-labelledby='life-film-heading']");
    await still.scrollIntoViewIfNeeded();
    await expect(still.getByRole("heading", { level: 2, name: "Every stage of her life matters." })).toBeVisible();
    await expect(still.getByText("Women's health and wellbeing, considered across a lifetime.")).toBeVisible();
    await expect(still.locator("li").first()).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.locator("section.film-section")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(asked.filter((n) => n.endsWith(".mp4") || n.endsWith(".webm"))).toEqual([]);
    expect(await still.evaluate((el) => (el as HTMLElement).offsetHeight)).toBeLessThan(1000);
    // The rest of the page is unaffected.
    await expect(page.getByRole("heading", { name: "Everything about your health, in one calm place." })).toBeVisible();
  });

  test("data saver: the same still version, and no video is downloaded", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true }));
    const asked = await serveFilm(page);
    await open(page);
    await expect(page.locator("section[aria-labelledby='life-film-heading']").getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    expect(asked.filter((n) => n.endsWith(".mp4") || n.endsWith(".webm"))).toEqual([]);
  });

  test("with no film files, the section removes itself and the page is otherwise the same", async ({ page }) => {
    await serveFilm(page, { missing: true });
    await open(page);
    await page.evaluate(() => window.scrollTo(0, document.querySelector("section.film-section")?.getBoundingClientRect().top ?? 1500));
    await expect(page.locator("section.film-section")).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByRole("heading", { name: "Everything about your health, in one calm place." })).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
