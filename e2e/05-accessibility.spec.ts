import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test, waitForApp } from "./fixtures";

/**
 * axe-core on every public page and every signed-in screen, in light and dark, plus the main forms.
 * No violations of any impact are allowed. This is an automated check, not a full accessibility review.
 */
async function audit(page: Page) {
  // Entrance animations pass through low-contrast frames; let them finish, then look.
  await page.waitForTimeout(1500);
  await page.evaluate(() =>
    document.querySelectorAll("main *").forEach((e) => {
      const s = (e as HTMLElement).style;
      if (s.opacity !== "") {
        s.opacity = "1";
        s.transform = "none";
        s.visibility = "visible";
      }
    })
  );
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  const summary = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, "accessibility violations").toEqual([]);
}

const PUBLIC = ["/", "/login", "/register", "/forgot-password", "/privacy", "/terms"];
const SIGNED_IN = ["/app/dashboard", "/app/cycle", "/app/activity", "/app/sleep", "/app/nutrition", "/app/habits", "/app/goals", "/app/health", "/app/wellbeing", "/app/insights", "/app/reports", "/app/messages", "/app/settings", "/app/settings?tab=reminders"];

test.describe("public pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const scheme of ["light", "dark"] as const) {
    for (const path of PUBLIC) {
      test(`${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await expect(page.getByRole("heading").first()).toBeVisible();
        await audit(page);
      });
    }
  }
});

test.describe("signed-in screens", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const path of SIGNED_IN) {
      test(`${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await waitForApp(page);
        await audit(page);
      });
    }
  }
});

test.describe("dialogs and forms", () => {
  test("the sleep form", async ({ page }) => {
    await page.goto("/app/sleep");
    await waitForApp(page);
    await page.getByRole("button", { name: "Log sleep" }).click();
    await expect(page.getByLabel("Went to bed, day")).toBeVisible();
    await audit(page);
  });
  test("the activity form", async ({ page }) => {
    await page.goto("/app/activity");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add activity" }).click();
    await page.getByLabel("Activity", { exact: true }).selectOption({ label: "Walking" });
    await audit(page);
  });
  test("the cycle log", async ({ page }) => {
    await page.goto("/app/cycle");
    await waitForApp(page);
    await page.getByRole("button", { name: /Log today's flow/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page);
  });
});
