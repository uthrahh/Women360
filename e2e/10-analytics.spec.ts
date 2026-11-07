import { expect, test, type Page } from "./fixtures";

// Google Analytics 4: off until the visitor accepts, public pages only, never any content. The Measurement ID here is made up
// (playwright.config.ts) and Google's script is answered by the test itself, so nothing is sent anywhere.

const ID = "G-E2ETEST01";
test.use({ storageState: { cookies: [], origins: [] } });

async function stubGoogle(page: Page) {
  const requested: string[] = [];
  await page.route(/googletagmanager\.com|google-analytics\.com/, async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "window.__gtagScriptLoaded = true;" });
  });
  return requested;
}

/** What the page has asked Google to record: gtag("event", ...) calls, as plain objects. */
async function sentEvents(page: Page): Promise<{ name: string; params: Record<string, unknown> }[]> {
  return page.evaluate(() =>
    ((window.dataLayer ?? []) as ArrayLike<unknown>[])
      .map((entry) => Array.from(entry))
      .filter((args) => args[0] === "event")
      .map((args) => ({ name: String(args[1]), params: args[2] as Record<string, unknown> }))
  );
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("before the visitor chooses", () => {
  test("a banner asks, and nothing is loaded from Google and no Google cookie is set", async ({ page }) => {
    const requested = await stubGoogle(page);
    await open(page, "/");
    const banner = page.getByRole("region", { name: "Analytics choice" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "Decline" })).toBeVisible();
    await page.getByRole("link", { name: "Questions" }).first().click(); // interact: still nothing
    await page.waitForTimeout(500);
    expect(requested).toEqual([]);
    expect(await sentEvents(page)).toEqual([]);
    expect((await page.context().cookies()).filter((c) => c.name.startsWith("_ga"))).toEqual([]);
  });

  test("declining is remembered, nothing is loaded, and the footer can bring the question back", async ({ page }) => {
    const requested = await stubGoogle(page);
    await open(page, "/");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Decline" }).click();
    await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
    await page.getByRole("link", { name: "Questions" }).first().click();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
    expect(requested).toEqual([]);
    expect(await sentEvents(page)).toEqual([]);
    await page.getByRole("button", { name: "Analytics choices" }).click();
    await expect(page.getByRole("region", { name: "Analytics choice" })).toContainText("Currently: declined");
  });

  test("a browser that sends Do Not Track is not asked, and nothing is sent", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true }));
    const requested = await stubGoogle(page);
    await open(page, "/");
    await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analytics choices" })).toHaveCount(0);
    await page.getByRole("link", { name: "Questions" }).first().click();
    expect(requested).toEqual([]);
    expect(await sentEvents(page)).toEqual([]);
  });
});

test.describe("after accepting", () => {
  test("loads Google's tag and sends a page view; consent for advertising stays denied", async ({ page }) => {
    const requested = await stubGoogle(page);
    await open(page, "/privacy");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    await expect.poll(() => requested.length).toBe(1);
    expect(requested[0]).toContain(`id=${ID}`);
    const events = await sentEvents(page);
    expect(events.filter((e) => e.name === "page_view")).toHaveLength(1);
    expect(events[0].params).toMatchObject({ page_path: "/privacy" });
    const layer = await page.evaluate(() => (window.dataLayer as ArrayLike<unknown>[]).map((e) => JSON.stringify(Array.from(e))));
    const text = layer.join("\n");
    expect(text).toContain('"consent","default",{"ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied","analytics_storage":"denied"}');
    expect(text).toContain('"send_page_view":false');
    expect(text).toContain('"allow_google_signals":false');
    expect(text).toContain('"consent","update",{"analytics_storage":"granted"}');
  });

  test("navigation clicks are reported with where they are and where they go", async ({ page }) => {
    await stubGoogle(page);
    await open(page, "/");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Questions" }).click();
    await page.locator("footer").getByRole("link", { name: "Release notes" }).click();
    await expect(page).toHaveURL(/release-notes/);
    const nav = (await sentEvents(page)).filter((e) => e.name === "nav_click");
    expect(nav[0].params).toEqual({ link_area: "nav", link_text: "Questions", link_destination: "#questions", link_type: "anchor" });
    expect(nav[1].params).toEqual({ link_area: "footer", link_text: "Release notes", link_destination: "/release-notes", link_type: "internal" });
    const views = (await sentEvents(page)).filter((e) => e.name === "page_view").map((e) => e.params.page_path);
    expect(views).toEqual(["/", "/release-notes"]);
  });

  test("an email link reports that it was an email link, never the address", async ({ page }) => {
    await stubGoogle(page);
    await open(page, "/");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    await page.locator("footer").getByRole("link", { name: "Contact" }).click();
    const event = (await sentEvents(page)).find((e) => e.name === "nav_click" && e.params.link_type === "email");
    expect(event?.params).toMatchObject({ link_destination: "mailto", link_area: "footer" });
    expect(JSON.stringify(await sentEvents(page))).not.toMatch(/@/);
  });

  test("scroll depth is reported once each at 25, 50, 75 and 100 percent of a long page", async ({ page }) => {
    await stubGoogle(page);
    await open(page, "/release-notes");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    expect((await sentEvents(page)).filter((e) => e.name === "scroll_depth")).toEqual([]); // opening alone is not scrolling
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const depths = (await sentEvents(page)).filter((e) => e.name === "scroll_depth").map((e) => e.params.percent_scrolled);
    expect(depths).toEqual([25, 50, 75, 100]);
    expect((await sentEvents(page)).find((e) => e.name === "scroll_depth")?.params.page_path).toBe("/release-notes");
  });

  test("moving on to sign-in reports nothing, and Google's collection is switched off", async ({ page }) => {
    await stubGoogle(page);
    await open(page, "/");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    const before = (await sentEvents(page)).length;
    await page.getByRole("link", { name: "Log in" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Email").blur();
    await page.waitForTimeout(400);
    // The click on "Log in" itself happened on a public page, so it is the one allowed new event; nothing from /login.
    const after = await sentEvents(page);
    expect(after.slice(before).every((e) => e.name === "nav_click")).toBe(true);
    // Nothing was reported *from* the sign-in page: no page view of it, and nothing typed there.
    expect(after.some((e) => e.params.page_path === "/login")).toBe(false);
    expect(JSON.stringify(after)).not.toContain("someone@example.com");
    expect(await page.evaluate((id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`], ID)).toBe(true);
  });

  test("changing your mind to Decline stops everything and clears Google cookies", async ({ page, context }) => {
    await stubGoogle(page);
    await open(page, "/");
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Accept" }).click();
    await context.addCookies([{ name: "_ga", value: "GA1.1.1.1", url: "http://localhost:5173" }]);
    await page.getByRole("button", { name: "Analytics choices" }).click();
    await page.getByRole("region", { name: "Analytics choice" }).getByRole("button", { name: "Decline" }).click();
    const count = (await sentEvents(page)).length;
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Questions" }).click();
    await page.waitForTimeout(300);
    expect((await sentEvents(page)).length).toBe(count);
    expect((await context.cookies()).filter((c) => c.name.startsWith("_ga"))).toEqual([]);
  });
});

test.describe("the reference page", () => {
  test("lists every event, built from the definitions the tracking uses", async ({ page }) => {
    await open(page, "/analytics-reference");
    for (const name of ["page_view", "nav_click", "code_copy", "filter_change", "site_search", "scroll_depth"]) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }
    await expect(page.getByText("Valid GA4 name").first()).toBeVisible();
    await expect(page.getByText("never sent").first()).toBeVisible();
  });

  test("its sandbox shows what each interaction would report, and sends nothing", async ({ page }) => {
    const requested = await stubGoogle(page);
    await open(page, "/analytics-reference");
    const log = page.getByRole("region", { name: "Event log, scrollable" });

    await page.getByRole("navigation", { name: "Sample navigation" }).getByRole("link", { name: /Back to top/ }).click();
    await expect(log).toContainText("nav_click");
    await expect(log).toContainText('"link_type":"anchor"');

    await page.getByRole("combobox", { name: "Category" }).selectOption("Forms");
    await expect(log).toContainText("filter_change");
    await expect(log).toContainText('"filter_value":"Forms"');

    await page.getByRole("searchbox", { name: "Search" }).fill("a private health question");
    await expect(log).toContainText("site_search", { timeout: 4000 });
    await expect(log).toContainText('"search_term_length":25');
    await expect(log).not.toContainText("private health");

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy" }).click();
    await expect(log).toContainText("code_copy");
    await expect(log).toContainText('"copy_method":"button"');
    await expect(log).toContainText('"code_language":"tsx"');

    // Copying by selection (keyboard or menu) is picked up too.
    await page.locator("pre code.language-tsx").evaluate((el) => window.getSelection()?.selectAllChildren(el));
    await page.keyboard.press("Control+C");
    await expect(log).toContainText('"copy_method":"selection"');

    // Every row says it was not sent, and Google was never contacted.
    await expect(log.getByText("Yes", { exact: true })).toHaveCount(0);
    expect(requested).toEqual([]);
    expect(await sentEvents(page)).toEqual([]);
  });

  test("scrolling it shows the depth events in the log", async ({ page }) => {
    await open(page, "/analytics-reference");
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("region", { name: "Event log, scrollable" })).toContainText('"percent_scrolled":100', { timeout: 4000 });
  });
});
