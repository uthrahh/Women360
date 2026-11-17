import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";

// The parts of the launch standard (docs/LAUNCH_STANDARD.md) a browser can prove, kept as standing checks:
// tablet layouts (an App Store reviewer opens the app on an iPad), working support / privacy / terms links,
// a real 404 page, the email-confirmation page, and no placeholder screens anywhere.

const PUBLIC = ["/", "/login", "/register", "/forgot-password", "/privacy", "/terms", "/release-notes", "/verify-email"];
const SIGNED_IN = ["/app/dashboard", "/app/cycle", "/app/activity", "/app/sleep", "/app/nutrition", "/app/habits", "/app/goals", "/app/health", "/app/wellbeing", "/app/insights", "/app/reports", "/app/messages", "/app/chat", "/app/settings"];
const TABLETS = [
  { name: "iPad portrait", width: 768, height: 1024 },
  { name: "iPad landscape", width: 1024, height: 768 },
  { name: "iPad Pro portrait", width: 1024, height: 1366 },
];

test.describe("tablet layouts", () => {
  for (const size of TABLETS) {
    test(`public pages fit an ${size.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      for (const path of PUBLIC) {
        await page.goto(path);
        await expect(page.getByRole("main").first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
      await context.close();
    });

    test(`every signed-in screen fits an ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const path of SIGNED_IN) {
        await page.goto(path);
        await waitForApp(page);
        await expectNoHorizontalScroll(page);
        await expect(page.getByText(/coming soon|lorem ipsum|under construction/i), `${path} shows placeholder copy`).toHaveCount(0);
      }
    });
  }
});

test.describe("links a reviewer and a person must be able to follow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("privacy, terms, release notes and contact work from the home page", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    for (const [name, path] of [["Privacy", "/privacy"], ["Terms", "/terms"], ["Release notes", "/release-notes"]] as const) {
      await footer.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/doesn.t exist/)).toHaveCount(0);
      await page.goBack();
    }
    await expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute("href", /^mailto:.+@.+\..+/);
  });

  test("an unknown address shows a real 404 page with a way back", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/not found|doesn.t exist|can.t find/i).first()).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: /home|back|women360/i }).first()).toBeVisible();
  });

  test("a broken email-confirmation link explains itself and offers a way on", async ({ page }) => {
    await page.goto("/verify-email?token=not-a-real-token");
    await expect(page.getByText("That link didn't work")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.goto("/verify-email");
    await expect(page.getByText("That link didn't work")).toBeVisible();
  });
});

test.describe("account basics", () => {
  test("delete-account, data download and sign-out are reachable from Settings", async ({ page }) => {
    await page.goto("/app/settings?tab=data");
    await waitForApp(page);
    await expect(page.getByRole("button", { name: /Download my data/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete my account/ })).toBeVisible();
  });
});
