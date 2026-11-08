import { expect, test as setup } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Makes a fresh account for the run (through the real sign-up screen), signs in, and saves the
 * session for every other test. The credentials exist only for this run's database and are never printed.
 */
const API = "http://localhost:4000/api/v1";

setup("create a fresh account and sign in", async ({ page, request }) => {
  // The first visit to a screen in a freshly started development server waits while Vite compiles it, which can take a minute.
  setup.setTimeout(150_000);
  const email = `e2e.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `${crypto.randomBytes(9).toString("base64url")}-Aa9!`;
  const res = await request.post(`${API}/auth/register`, { data: { name: "Ruth Tester", email, password } });
  expect(res.status(), "sign-up").toBe(201);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await page.waitForURL(/\/onboarding|\/app\//);
  if (page.url().includes("/onboarding")) await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL(/\/app\/dashboard/);

  fs.mkdirSync("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
  fs.writeFileSync("e2e/.auth/credentials.json", JSON.stringify({ email, password }));
});
