import { expect, test, type Page } from "./fixtures";

// The landing page's hand-drawn background ("A lifetime in bloom"): a fixed stage whose scene follows the section being
// read and moves with the scroll. These checks lock in what matters about it: it follows the reader both ways, it never
// gets in the way of a tap or a screen reader, it adds no sideways scroll, and it holds still for reduced motion.

test.use({ storageState: { cookies: [], origins: [] } });

const stage = (page: Page) => page.getByTestId("life-scenes");

async function scrollToSection(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3));
}

test("the scene follows the section being read, forwards and back", async ({ page }) => {
  await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-scene-active", "opening");
  for (const [selector, scene] of [
    ["#what", "window"],
    ["[data-scene=kitchen]", "kitchen"],
    ["#every-age", "park"],
    ["#privacy", "walk"],
    ["#questions", "closing"],
    ["#what", "window"],
  ] as const) {
    await scrollToSection(page, selector);
    await expect(stage(page)).toHaveAttribute("data-scene-active", scene);
  }
  // Exactly one scene is showing at a time once the cross-fade settles.
  await expect(page.locator(".sc-scene[data-active]")).toHaveCount(1);
});

test("it is decoration only: hidden from assistive technology and never in the way of a tap", async ({ page }) => {
  await page.goto("/");
  await expect(stage(page)).toHaveAttribute("aria-hidden", "true");
  expect(await stage(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  // The main call to action sits over the drawing and still takes the click.
  await page.getByRole("link", { name: "Create your account" }).first().click();
  await expect(page).toHaveURL(/\/register$/);
});

test("no sideways scroll on a phone, and the drawing keeps the figure in view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await scrollToSection(page, "#privacy");
  await expect(stage(page)).toHaveAttribute("data-scene-active", "walk");
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await expect(page.locator(".sc-scene[data-active] svg").first()).toHaveAttribute("viewBox", "1000 0 500 900");
});

test("reduced motion: every scene is a still, finished drawing", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await scrollToSection(page, "[data-scene=kitchen]");
  await expect(page.getByTestId("life-scenes")).toHaveAttribute("data-scene-active", "kitchen");
  const running = await page.evaluate(
    () => document.querySelector(".sc-root")!.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length
  );
  expect(running).toBe(0);
  // Scroll-linked parts rest at their finished state rather than following the scroll.
  await expect(page.locator(".sc-scene[data-active]")).toHaveAttribute("style", /--p: ?1/);
  await context.close();
});
