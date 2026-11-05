import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests: the real web app against the real API and a real database, in a real browser.
 * They start both servers themselves (or reuse ones already running) and use fresh accounts, so
 * they never touch anyone's data.
 *
 *   npm run e2e            everything
 *   npm run e2e -- e2e/05-accessibility.spec.ts
 *
 * The API runs with the clinical-review features switched OFF, like production. Locally the tests
 * drive the installed Chrome; set E2E_CHANNEL= (empty) to use Playwright's own Chromium instead
 * (CI does, after `npx playwright install chromium`).
 */
const channel = process.env.E2E_CHANNEL === undefined ? "chrome" : process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  // One account and one database are shared, so tests run one at a time, in file order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chrome", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"], use: { storageState: "e2e/.auth/user.json" } },
  ],
  webServer: [
    {
      command: "npm --prefix server run dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { CLINICAL_CONTENT: "false", API_RATE_LIMIT_PER_MINUTE: "100000", AUTH_RATE_LIMIT_PER_15_MIN: "1000" },
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
