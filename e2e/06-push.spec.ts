import { chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test as base, waitForApp } from "./fixtures";

// Reminders that reach her when Women360 is closed. These use the browser's real push service (Google's,
// for Chrome), so they need internet access and branded Google Chrome: Chrome refuses the Push API in the
// throwaway incognito-style contexts Playwright normally uses, and Playwright's own Chromium has no access to
// Google's push service. So each test gets a normal Chrome profile, and they are skipped in CI.
const useChrome = process.env.E2E_CHANNEL === undefined || process.env.E2E_CHANNEL === "chrome";

const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({ baseURL }, use) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "w360-push-profile-"));
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      baseURL,
      permissions: ["notifications"],
    });
    // A persistent profile ignores storageState, so sign in by seeding the same values (only when empty,
    // so a refreshed session is never overwritten with the saved one).
    const saved = JSON.parse(fs.readFileSync("e2e/.auth/user.json", "utf8")) as { origins: { origin: string; localStorage: { name: string; value: string }[] }[] };
    const items = saved.origins.find((o) => o.origin === (baseURL ?? "http://localhost:5173"))?.localStorage ?? [];
    await context.addInitScript((entries) => {
      try {
        for (const e of entries) if (localStorage.getItem(e.name) === null) localStorage.setItem(e.name, e.value);
      } catch {
        // about:blank and similar pages have no storage.
      }
    }, items);
    await use(context);
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  },
  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});
test.skip(!useChrome || !!process.env.CI, "needs branded Google Chrome and Google's push service; run locally");

const API = "http://localhost:4000/api/v1";

async function token(page: Page): Promise<string> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("w360_session_tokens") || "{}").accessToken as string);
}
async function devices(page: Page): Promise<number> {
  const t = await token(page);
  return page.evaluate(async ([api, bearer]) => {
    const res = await fetch(`${api}/users/me/export`, { headers: { Authorization: `Bearer ${bearer}` } });
    return ((await res.json()).data.reminderDevices as unknown[]).length;
  }, [API, t]);
}

test.describe("closed-app reminders", () => {
  test("she can turn reminders on and off for this device", async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto("/app/settings?tab=reminders");
    await waitForApp(page);
    const toggle = page.getByRole("switch", { name: "Reminders when Women360 is closed" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await devices(page)).toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 75_000 });
    expect(await devices(page)).toBe(1);

    await page.reload();
    await waitForApp(page);
    await expect(page.getByRole("switch", { name: "Reminders when Women360 is closed" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("switch", { name: "Reminders when Women360 is closed" }).click();
    await expect(page.getByRole("switch", { name: "Reminders when Women360 is closed" })).toHaveAttribute("aria-checked", "false", { timeout: 75_000 });
    expect(await devices(page)).toBe(0);
  });

  test("a reminder arrives from the server while the app is closed", async ({ page, context }) => {
    test.setTimeout(180_000);
    const now = new Date();
    test.skip(now.getHours() === 0 && now.getMinutes() < 10, "too close to midnight for a reminder time that is already due");

    await page.goto("/app/settings?tab=reminders");
    await waitForApp(page);
    const toggle = page.getByRole("switch", { name: "Reminders when Women360 is closed" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 75_000 });

    // A habit whose reminder time was two minutes ago, so the server's next minute-tick finds it due.
    const due = new Date(Date.now() - 2 * 60_000);
    const reminder = due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s/g, " ");
    const t = await token(page);
    const created = await page.evaluate(
      async ([api, bearer, at]) => {
        const res = await fetch(`${api}/habits`, { method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Private habit name", reminder: at }) });
        return res.status;
      },
      [API, t, reminder]
    );
    expect(created).toBe(201);

    // Close the app. Only the server can remind her now.
    await page.goto("about:blank");
    const watcher = await context.newPage();
    await watcher.goto("/privacy"); // a public page: the in-app reminder loop is not running here
    // Wait for the notification the server's push made the service worker show.
    let text: string | null = null;
    await expect
      .poll(
        async () => {
          text = await watcher.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const shown = reg ? await reg.getNotifications() : [];
            return shown.length > 0 ? shown[0].body : null;
          });
          return text;
        },
        { timeout: 120_000, intervals: [3_000] }
      )
      .not.toBeNull();
    expect(text).toBe("A habit on your list is due. Tap to open.");
    expect(text).not.toContain("Private habit name");
  });
});
