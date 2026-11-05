import { expect, expectNoHorizontalScroll, test } from "./fixtures";

// Signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("landing page", () => {
  test("says what it is, offers sign-up, and only advertises what is live", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A calmer way to look after your health.");
    await expect(page.getByRole("link", { name: "Create your account" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Get started" })).toBeVisible();
    // While the review-needed features are off, the page must not promise them.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/screening|check-ups are due|worth taking to a doctor|activity plan/i);
    await expect(page.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "mailto:admin.women360@gmail.com");
  });

  test("answers questions in an accordion that opens and closes", async ({ page }) => {
    await page.goto("/");
    const q = page.getByRole("button", { name: "Is Women360 medical advice?" });
    await q.scrollIntoViewIfNeeded();
    await expect(q).toHaveAttribute("aria-expanded", "false");
    await q.click();
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("it doesn't diagnose anything")).toBeVisible();
    await q.click();
    await expect(q).toHaveAttribute("aria-expanded", "false");
  });

  for (const width of [1280, 768, 375]) {
    test(`has no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe("legal and error pages", () => {
  for (const [path, heading] of [["/privacy", /handles your information/i], ["/terms", /terms/i]] as const) {
    test(`${path} loads and gives a way to write to us`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(page.getByRole("link", { name: "admin.women360@gmail.com" })).toHaveAttribute("href", "mailto:admin.women360@gmail.com");
    });
  }

  test("an unknown address shows a page with a way back, not a blank screen", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("link").first()).toBeVisible();
  });
});

test.describe("sign-in screens", () => {
  test("a wrong password gives a plain error and no clue which part was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Not-The-Right-Passw0rd!");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page.getByText(/incorrect|invalid|couldn't sign you in|wrong/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot-password answers the same way for any address", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody.here@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if an account exists/i)).toBeVisible();
  });

  test("a protected page sends a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
