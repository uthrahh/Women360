import { expect, expectNoHorizontalScroll, test } from "./fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("release notes", () => {
  test("months and entries run newest first, each entry has a date, a headline and detail", async ({ page }) => {
    await page.goto("/release-notes");
    await expect(page.getByRole("heading", { level: 1, name: "Release notes" })).toBeVisible();

    const months = await page.locator("main section > h2").allTextContents();
    expect(months.length).toBeGreaterThanOrEqual(4);
    expect(months[0]).toMatch(/^November 2026$/);
    const order = months.map((m) => new Date(`1 ${m}`).getTime());
    expect(order).toEqual([...order].sort((a, b) => b - a));

    const entries = page.locator("main article");
    const count = await entries.count();
    expect(count).toBeGreaterThan(15);
    const stamps = await entries.evaluateAll((els) =>
      els.map((el) => ({
        date: el.querySelector("time")?.getAttribute("datetime") ?? "",
        headline: el.querySelector("h3")?.textContent?.trim() ?? "",
        detail: el.querySelector("p:last-child")?.textContent?.trim() ?? "",
      }))
    );
    for (const s of stamps) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.headline.length).toBeGreaterThan(5);
      expect(s.detail.length).toBeGreaterThan(40);
    }
    const dates = stamps.map((s) => s.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("the month menu jumps to a month, with its heading clear of the top", async ({ page }) => {
    await page.goto("/release-notes");
    await page.getByRole("navigation", { name: "Jump to a month" }).getByRole("link", { name: "September 2026" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "September 2026" })).toBeInViewport();
  });

  test("is reachable from the landing page footer and doesn't scroll sideways on a phone", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: "Release notes" }).click();
    await expect(page).toHaveURL(/\/release-notes/);
    await page.setViewportSize({ width: 375, height: 800 });
    await expectNoHorizontalScroll(page);
  });
});
