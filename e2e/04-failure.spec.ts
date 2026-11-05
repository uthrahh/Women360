import { expect, test, waitForApp } from "./fixtures";

// When the API fails, the app must say so, not hang on "Loading" or show a white page.
const SCREENS = ["/app/dashboard", "/app/cycle", "/app/activity", "/app/sleep", "/app/nutrition", "/app/habits", "/app/goals", "/app/health", "/app/wellbeing", "/app/insights", "/app/reports", "/app/settings"];

const SERVER_ERROR = JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong on our end. Please try again." } });

test.describe("when the server fails", () => {
  for (const path of SCREENS) {
    test(`${path} says it could not load, offers a retry, and throws no unhandled error when every request fails`, async ({ page, problems }) => {
      await page.route("**/api/v1/**", (route) => {
        if (route.request().url().includes("/auth/refresh")) return route.continue();
        return route.fulfill({ status: 500, contentType: "application/json", body: SERVER_ERROR });
      });
      await page.goto(path);
      // Settings is drawn from the saved profile, so it stays usable; every other screen says it could not load.
      if (path === "/app/settings") await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible({ timeout: 20_000 });
      else await expect(page.getByText(/couldn.t load|didn.t load|try again/i).first()).toBeVisible({ timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(path));
      await expect(page.getByText(/^(Loading|Preparing)/)).toHaveCount(0);
      expect(problems.filter((p) => p.startsWith("pageerror")), "unhandled errors").toEqual([]);
      problems.length = 0; // the failed requests themselves are logged by the browser; they are expected
    });
  }

  test("an unreachable server does not leave a blank page", async ({ page, problems }) => {
    await page.route("**/api/v1/**", (route) => route.abort("connectionrefused"));
    await page.goto("/app/dashboard");
    await expect(page.getByText(/couldn.t load|didn.t load|try again/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp("/app/dashboard"));
    expect(problems.filter((p) => p.startsWith("pageerror")), "unhandled errors").toEqual([]);
    problems.length = 0;
  });

  test("a render error shows a recovery screen with a way forward, not a white page", async ({ page, problems }) => {
    await page.addInitScript(() => localStorage.setItem("w360_force_render_error", "1"));
    await page.goto("/app/dashboard");
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /try again|reload/i })).toBeVisible();
    problems.length = 0;
  });
});

test.describe("sessions", () => {
  test("an expired access token is renewed quietly and the page still loads", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await page.evaluate(() => {
      const t = JSON.parse(localStorage.getItem("w360_session_tokens") || "{}");
      localStorage.setItem("w360_session_tokens", JSON.stringify({ ...t, accessToken: "not-a-valid-token" }));
    });
    await page.goto("/app/sleep");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: "Sleep", level: 1 })).toBeVisible();
  });
});
