import { expect, test, waitForApp } from "./fixtures";

// Interaction details found in the UX review: keyboard and screen-reader paths, messages that vanish, tabs that
// hide on a phone, and in-page links that land under the sticky header.

test.describe("public pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the first Tab stop is a skip link that moves focus to the main region", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("an in-page link on the landing page lands with its heading below the sticky header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Questions" }).first().click();
    await page.waitForTimeout(700);
    const { headingTop, headerBottom } = await page.evaluate(() => ({
      headingTop: document.querySelector("#questions h2")?.getBoundingClientRect().top ?? -1,
      headerBottom: document.querySelector("header")?.getBoundingClientRect().bottom ?? 999,
    }));
    expect(headingTop, "heading hidden under the header").toBeGreaterThan(headerBottom);
  });

  test("sign-in and register fields give password managers and autofill what they need", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
    await page.goto("/register");
    await expect(page.getByLabel("Full name")).toHaveAttribute("autocomplete", "name");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  });
});

test.describe("signed in", () => {
  test("moving to another screen scrolls to the top and puts focus on the page, not a vanished link", async ({ page }) => {
    await page.goto("/app/settings");
    await waitForApp(page);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.getByRole("link", { name: /Habits/ }).first().click();
    await expect(page).toHaveURL(/\/app\/habits/);
    await waitForApp(page);
    await expect(page.locator("main")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("tabs work from the keyboard and the chosen tab survives a reload", async ({ page }) => {
    await page.goto("/app/settings");
    await waitForApp(page);
    const tablist = page.getByRole("tablist");
    const tabs = tablist.getByRole("tab");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    // Only the selected tab is in the Tab order, as the pattern requires.
    await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    // The panel is linked to its tab.
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", (await tabs.last().getAttribute("id")) ?? "");

    await page.getByRole("tab", { name: "Reminders" }).click();
    await expect(page).toHaveURL(/tab=reminders/);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole("tab", { name: "Reminders" })).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await page.goForward();
    await expect(page.getByRole("tab", { name: "Reminders" })).toHaveAttribute("aria-selected", "true");
  });

  test("on a phone, tabs that don't fit fade at the edge so it is clear there are more", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/app/settings");
    await waitForApp(page);
    const tablist = page.getByRole("tablist");
    const hidden = await tablist.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hidden, "this screen should have more tabs than fit").toBe(true);
    await expect.poll(() => tablist.evaluate((el) => getComputedStyle(el).maskImage)).toContain("linear-gradient");
    // Choosing one that is off-screen scrolls it into view.
    await page.goto("/app/settings?tab=feedback");
    await waitForApp(page);
    const inView = await page.getByRole("tab", { name: "Feedback" }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth;
    });
    expect(inView).toBe(true);
  });

  test("a dialog takes focus, keeps Tab inside, closes with Escape and hands focus back", async ({ page }) => {
    await page.goto("/app/settings?tab=data");
    await waitForApp(page);
    const opener = page.getByRole("button", { name: /Delete my account/ });
    await opener.focus();
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1} left the dialog`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    // The page behind does not scroll while it is open.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });

  test("an error message stays long enough to read and is announced; a repeat doesn't stack", async ({ page }) => {
    await page.goto("/app/settings");
    await waitForApp(page);
    // Make saving the profile fail, then try it twice.
    await page.route("**/users/me", (route) => (route.request().method() === "PATCH" ? route.fulfill({ status: 500, json: { ok: false, error: { code: "INTERNAL", message: "The server hit a problem saving that." } } }) : route.continue()));
    const name = page.getByLabel("Full name");
    await name.fill("Ruth Tester Two");
    await page.getByRole("button", { name: "Save changes" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "The server hit a problem" });
    await expect(alert).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(alert).toHaveCount(1);
    // Still there well past the old 3.2 seconds.
    await page.waitForTimeout(4500);
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Dismiss" }).click();
    await expect(alert).toHaveCount(0);
  });
});
