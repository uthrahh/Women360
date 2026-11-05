import { expect, test } from "./fixtures";

// The free server sleeps when idle and takes a while to wake. A slow sign-in must say so.
test.describe("a slow server", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in explains the wait, then the notice goes away", async ({ page }) => {
    await page.route("**/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 6500)); // a server still waking up
      await route.continue();
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Zq7-correct-horse-Battery-9");
    await page.getByRole("button", { name: "Log in" }).click();

    const notice = page.getByRole("status").filter({ hasText: "Waking the service up" });
    await expect(notice).toBeVisible({ timeout: 8000 });
    await expect(notice).toContainText("up to 30 seconds");
    await expect(notice).toHaveCount(0, { timeout: 15_000 }); // the (rejected) sign-in finished
  });

  test("a quick server shows no notice", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(500);
    await expect(page.getByText("Waking the service up")).toHaveCount(0);
  });
});
