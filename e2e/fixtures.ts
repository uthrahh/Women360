import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails if the page throws an unhandled error or logs a console error that isn't an
 * expected network failure. A page that quietly breaks is the failure these tests exist to catch.
 */
const IGNORED = [
  /Failed to load resource.*(401|404|409|422|429|500|503)/, // an API answering with a deliberate error
  /the server responded with a status of (401|404|409|422|429|500|503)/,
  /net::ERR_(ABORTED|FAILED|INTERNET_DISCONNECTED|CONNECTION_RESET)/, // tests that cut the network on purpose
  /favicon/,
];

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) problems.push(`console: ${msg.text()}`);
      });
      await use(problems);
      expect(problems, "unexpected errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** The page has no horizontal scroll at its current width. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(innerWidth);
}

/** Signed-in screens fade in; wait until the page has real content, not just its loading state. */
export async function waitForApp(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText(/^(Loading|Preparing|Setting up)/)).toHaveCount(0, { timeout: 20_000 });
}
