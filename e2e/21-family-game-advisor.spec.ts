import fs from "node:fs";
import crypto from "node:crypto";
import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

// The owner's three requests: family (a profile she keeps, and access between two accounts: view only or view and update),
// game mode (off by default, points and quests from her logs) and the health advisor (ideas from her own logs, added in one tap).
test.describe.configure({ mode: "serial" });

const API = "http://localhost:4000/api/v1";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The run's own account (made in auth.setup), signed in through the API for set-up steps. */
async function myToken(request: APIRequestContext) {
  const { email, password } = JSON.parse(fs.readFileSync("e2e/.auth/credentials.json", "utf8"));
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  return { token: (await res.json()).data.accessToken as string, email: email as string };
}

test.describe("family", () => {
  test("a profile she keeps: open it, log for it, and the banner always says whose records these are", async ({ page, request }) => {
    const me = await myToken(request);
    const teenBirth = `${new Date().getFullYear() - 15}-03-01`;
    const made = await request.post(`${API}/family/profiles`, {
      headers: { Authorization: `Bearer ${me.token}` },
      data: { name: "Anu Tester", dateOfBirth: teenBirth, relation: "Daughter", cycleTracking: false, guardianConfirmed: true },
    });
    expect(made.status()).toBe(201);
    const anuId = (await made.json()).data.id as string;

    await page.goto("/app/family");
    await waitForApp(page);
    const row = page.getByRole("listitem").filter({ hasText: "Anu Tester" });
    await expect(row.getByText(/Daughter · 15 years · Profile you keep/)).toBeVisible();
    await row.getByRole("button", { name: /^Open records/ }).click();
    await expect(page.getByText("Anu Tester's records", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Anu's day");
    // She doesn't track periods, so Cycle isn't offered while her records are open.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Cycle" })).toHaveCount(0);

    await page.goto("/app/nutrition");
    // A full page load always comes back to her own records (nothing is remembered).
    await expect(page.getByText("Anu Tester's records", { exact: true })).toHaveCount(0);
    await page.goto("/app/family");
    await page.getByRole("listitem").filter({ hasText: "Anu Tester" }).getByRole("button", { name: /^Open records/ }).click();
    await expect(page.getByText("Anu Tester's records", { exact: true })).toBeVisible();
    // Move within the app (no reload) to Nutrition and log water for her.
    await page.evaluate(() => window.history.pushState({}, "", "/app/nutrition"));
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await waitForApp(page);
    await page.getByRole("button", { name: /250ml/ }).click();
    await expect(page.getByText("250ml logged")).toBeVisible();
    const exp = await request.get(`${API}/family/profiles/${anuId}/export`, { headers: { Authorization: `Bearer ${me.token}` } });
    expect((await exp.json()).data.hydrationLogs.length).toBe(1);

    // A screen that is her own account's says so.
    await page.evaluate(() => window.history.pushState({}, "", "/app/settings"));
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await expect(page.getByRole("heading", { name: "This screen is for your own account" })).toBeVisible();
    await page.getByRole("button", { name: "Back to my records" }).first().click();
    await expect(page.getByText("Anu Tester's records", { exact: true })).toHaveCount(0);
  });

  test("a relative who shares view only: she can look but not change anything", async ({ page, request }) => {
    const me = await myToken(request);
    const momEmail = `e2e.mom.${Date.now()}@example.com`;
    const reg = await request.post(`${API}/auth/register`, { data: { name: "Lata Tester", email: momEmail, password: `${crypto.randomBytes(9).toString("base64url")}-Aa9!`, dateOfBirth: "1965-02-02" } });
    const mom = (await reg.json()).data.accessToken as string;
    await request.post(`${API}/nutrition/hydration`, { headers: { Authorization: `Bearer ${mom}` }, data: { amountMl: 500, date: today() } });
    const share = await request.post(`${API}/family/share`, { headers: { Authorization: `Bearer ${mom}` }, data: { email: me.email, level: "MONITOR" } });
    expect(share.status()).toBe(201);

    await page.goto("/app/family");
    await waitForApp(page);
    const row = page.getByRole("listitem").filter({ hasText: "Lata Tester" });
    await expect(row.getByText("Shares with you · Can view")).toBeVisible();
    await row.getByRole("button", { name: /^Open records/ }).click();
    await expect(page.getByText("View only")).toBeVisible();
    await page.evaluate(() => window.history.pushState({}, "", "/app/nutrition"));
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await waitForApp(page);
    await expect(page.getByText("500ml", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /250ml/ }).click();
    await expect(page.getByText(/gave you view-only access/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("she shares her own records and can change the access or stop it", async ({ page, request }) => {
    const sisterEmail = `e2e.sister.${Date.now()}@example.com`;
    await request.post(`${API}/auth/register`, { data: { name: "Mira Tester", email: sisterEmail, password: `${crypto.randomBytes(9).toString("base64url")}-Aa9!`, dateOfBirth: "1992-07-07" } });
    await page.goto("/app/family");
    await waitForApp(page);
    await page.getByRole("button", { name: "Share my records" }).click();
    await page.getByLabel("Their Women360 address").fill(sisterEmail);
    await page.getByRole("dialog").getByText("View and update", { exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText("Shared. They've been told.")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "Mira Tester" });
    await expect(row.getByRole("radio", { name: "View and update" })).toBeChecked();
    await row.getByRole("button", { name: "Stop sharing" }).click();
    await expect(page.getByText("Mira Tester can no longer see your records")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("game mode", () => {
  test("is off until she turns it on, then shows her level, run and today's quests", async ({ page }) => {
    await page.goto("/app/game");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: "Game mode is off" })).toBeVisible();

    await page.goto("/app/settings?tab=features");
    await waitForApp(page);
    await page.getByRole("switch", { name: "Game mode" }).click();
    await expect(page.getByText(/Game mode on/)).toBeVisible();

    await page.goto("/app/dashboard");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: /^Level \d+/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Today's quests" }).getByRole("listitem")).toHaveCount(3);

    await page.goto("/app/game");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: "How points work" })).toBeVisible();
    await expect(page.getByText(/never for a number on a scale/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("turning the cycle tracker off takes Cycle out of the menus", async ({ page }) => {
    await page.goto("/app/settings?tab=features");
    await waitForApp(page);
    await page.getByRole("switch", { name: "Cycle tracker" }).click();
    await expect(page.getByText("Cycle tracker off")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cycle", exact: true })).toHaveCount(0);
    await page.getByRole("switch", { name: "Cycle tracker" }).click();
    await expect(page.getByText("Cycle tracker on")).toBeVisible();
  });
});

test.describe("health advisor", () => {
  test("suggests from her own records and adds an idea in one tap", async ({ page }) => {
    await page.goto("/app/advisor");
    await waitForApp(page);
    await expect(page.getByText(/not medical advice/)).toBeVisible();
    // Her account has no appointment on record, so a routine check-up is suggested, with the reason.
    const idea = page.getByRole("listitem").filter({ hasText: "Book a routine check-up" });
    await expect(idea.getByText("There's no appointment in your records.")).toBeVisible();
    await idea.getByRole("button", { name: /^Add as a goal/ }).click();
    await expect(page.getByText("Added to your goals: Book a routine check-up")).toBeVisible();
    await page.goto("/app/goals");
    await waitForApp(page);
    await expect(page.getByText("Book a routine check-up").first()).toBeVisible();
  });

  test("the AI advisor's ideas are checked before she sees them", async ({ page }) => {
    await page.goto("/app/advisor");
    await waitForApp(page);
    await page.getByRole("button", { name: /Share my summary and ask|Ask for more ideas/ }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Stretch for 5 minutes after waking" })).toHaveCount(1);
    // The scripted answer includes a supplement idea; the safety filter drops it.
    await expect(page.getByRole("listitem").filter({ hasText: /supplement/i })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
