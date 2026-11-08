import { expect, test, waitForApp, type Page } from "./fixtures";

// The interaction-quality pass: skeleton loading, optimistic updates with Undo, stale-while-revalidate, the command menu and its
// shortcuts, swipe-to-dismiss sheets and Back closing them, view transitions, idempotency keys, one-time-code entry, and the
// typography, corner and safe-area details.

const API = "http://localhost:4000/api/v1";

async function bearer(page: Page): Promise<string> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("w360_session_tokens") || "{}").accessToken as string);
}
async function api<T = unknown>(page: Page, method: string, path: string, body?: object): Promise<T> {
  const token = await bearer(page);
  return page.evaluate(
    async ([m, url, t, b]) => {
      const res = await fetch(url as string, { method: m as string, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: b ? (b as string) : undefined });
      return (await res.json()).data;
    },
    [method, `${API}${path}`, token, body ? JSON.stringify(body) : ""]
  ) as Promise<T>;
}
const tickOf = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`${title}, day streak`) });
const cardOf = (page: Page, title: string) => tickOf(page, title).locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
/** Moves to another screen without reloading, so the app's in-memory state is kept: "G then a letter". */
async function goTo(page: Page, letter: string) {
  await page.locator("main").focus();
  await page.keyboard.press("g");
  await page.keyboard.press(letter);
}
const uniqueTitle = (label: string) => `${label} ${Math.random().toString(36).slice(2, 7)}`;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe("loading and refreshing", () => {
  test("a slow screen shows a skeleton of itself, with the words for a screen reader", async ({ page }) => {
    await page.route("**/habits?*", async (route) => {
      await delay(2500);
      await route.continue();
    });
    await page.goto("/app/habits");
    await expect(page.locator(".w360-skeleton").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading habits" })).toHaveCount(1);
    await expect(page.locator(".w360-skeleton")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("returning to a screen shows what it showed last time at once, and refreshes behind it", async ({ page }) => {
    const title = uniqueTitle("Stale");
    await page.goto("/app/settings");
    await waitForApp(page);
    await api(page, "POST", "/habits", { title });
    await page.goto("/app/habits");
    await waitForApp(page);
    await expect(tickOf(page, title)).toBeVisible();

    // Away, and back without reloading, while the server answers slowly.
    await goTo(page, ",");
    await expect(page).toHaveURL(/settings/);
    await page.route("**/habits?*", async (route) => {
      await delay(4000);
      await route.continue();
    });
    await goTo(page, "h");
    await expect(page).toHaveURL(/habits/);
    await expect(tickOf(page, title)).toBeVisible({ timeout: 1500 }); // not after four seconds
    await expect(page.locator(".w360-skeleton")).toHaveCount(0);
  });

  test("a failed refresh leaves the last data in place instead of an error", async ({ page }) => {
    const title = uniqueTitle("Keep");
    await page.goto("/app/settings");
    await waitForApp(page);
    await api(page, "POST", "/habits", { title });
    await page.goto("/app/habits");
    await waitForApp(page);
    await goTo(page, ",");
    await expect(page).toHaveURL(/settings/);
    await page.route("**/habits?*", (route) => route.fulfill({ status: 500, json: { ok: false, error: { code: "INTERNAL", message: "boom" } } }));
    await goTo(page, "h");
    await expect(tickOf(page, title)).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByText("Couldn't load your habits")).toHaveCount(0);
  });
});

test.describe("optimistic updates and undo", () => {
  test("ticking a habit changes the screen before the server answers, and Undo reverses it", async ({ page }) => {
    const title = uniqueTitle("Optimistic");
    await page.goto("/app/settings");
    await waitForApp(page);
    await api(page, "POST", "/habits", { title });
    await page.goto("/app/habits");
    await waitForApp(page);
    await page.route("**/habits/*/logs/*", async (route) => {
      await delay(1800);
      await route.continue();
    });
    await tickOf(page, title).click();
    // Well inside the 1.8 s the server is taking: the card already says done.
    await expect(cardOf(page, title).getByText("Done for today")).toBeVisible({ timeout: 700 });
    const toast = page.getByRole("status").filter({ hasText: `Done: ${title}` });
    await expect(toast).toBeVisible({ timeout: 6000 });
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(cardOf(page, title).getByText("Done for today")).toHaveCount(0, { timeout: 6000 });
    await expect(tickOf(page, title)).toHaveAttribute("aria-pressed", "false");
  });

  test("when the server can't save it, the screen goes back and says so", async ({ page }) => {
    const title = uniqueTitle("Rollback");
    await page.goto("/app/settings");
    await waitForApp(page);
    await api(page, "POST", "/habits", { title });
    await page.goto("/app/habits");
    await waitForApp(page);
    await page.route("**/habits/*/logs/*", async (route) => {
      await delay(600);
      await route.fulfill({ status: 500, json: { ok: false, error: { code: "INTERNAL", message: "Couldn't save that." } } });
    });
    await tickOf(page, title).click();
    await expect(cardOf(page, title).getByText("Done for today")).toBeVisible({ timeout: 500 });
    await expect(page.getByRole("alert").filter({ hasText: /Couldn't save/ })).toBeVisible({ timeout: 5000 });
    await expect(cardOf(page, title).getByText("Done for today")).toHaveCount(0);
  });

  test("a toast can carry an action, and it waits longer than a plain one", async ({ page }) => {
    const title = uniqueTitle("Toastwait");
    await page.goto("/app/settings");
    await waitForApp(page);
    await api(page, "POST", "/habits", { title });
    await page.goto("/app/habits");
    await waitForApp(page);
    await tickOf(page, title).click();
    const toast = page.getByRole("status").filter({ hasText: `Done: ${title}` });
    await expect(toast).toBeVisible();
    await page.waitForTimeout(5000); // past a plain message's four seconds
    await expect(toast).toBeVisible();
  });
});

test.describe("repeating a request safely", () => {
  test("every create carries an Idempotency-Key, and a dropped connection is retried with the same key and creates one record", async ({ page }) => {
    await page.goto("/app/habits");
    await waitForApp(page);
    const keys: string[] = [];
    let attempts = 0;
    await page.route(new RegExp("/api/v1/habits(\\?.*)?$"), async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts += 1;
      keys.push(route.request().headers()["idempotency-key"] ?? "");
      if (attempts === 1) return route.abort("connectionreset"); // the first try never gets an answer
      return route.continue();
    });
    const before = (await api<{ title: string }[]>(page, "GET", "/habits")).length;
    const title = uniqueTitle("Retry");
    // The app's own habit service, exactly as the screens call it (same client, same keys, same retry).
    const created = await page.evaluate(async (t) => {
      const { habitService } = await import("/src/services/habitService.ts");
      return habitService.create({ title: t } as never);
    }, title);
    expect((created as { title: string }).title).toBe(title);
    expect(attempts).toBe(2);
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(keys[1]).toBe(keys[0]);
    expect((await api<{ title: string }[]>(page, "GET", "/habits")).length).toBe(before + 1);
  });
});

test.describe("the command menu and shortcuts", () => {
  test("Ctrl+K opens it, typing narrows it, Enter goes there, and each row shows its shortcut", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Quick jump" });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("habi");
    const option = dialog.getByRole("option", { name: /Habits/ });
    await expect(option).toBeVisible();
    await expect(dialog.getByRole("option", { name: /Sleep/ })).toHaveCount(0);
    await expect(option).toContainText("G");
    await expect(option).toContainText("H");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/habits/);
    await expect(dialog).toHaveCount(0);
  });

  test("the arrow keys move through the list", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Quick jump" });
    await expect(dialog.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("G then a letter jumps to a screen, but never while she is typing", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/app\/sleep/);

    await page.goto("/app/settings?tab=profile");
    await waitForApp(page);
    const name = page.getByLabel("Full name");
    await name.focus();
    await page.keyboard.type("gs?");
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.getByRole("dialog", { name: "Quick jump" })).toHaveCount(0);
    await expect(name).toHaveValue(/gs\?$/);
  });

  test("? opens it, and the top bar button shows the shortcut", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    const button = page.getByRole("button", { name: /Quick jump/ });
    await expect(button).toBeVisible();
    await expect(button).toContainText("K");
    await page.locator("main").focus();
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Quick jump" })).toBeVisible();
    await page.keyboard.press("Escape");
    await button.click();
    await expect(page.getByRole("dialog", { name: "Quick jump" })).toBeVisible();
  });
});

test.describe("sheets", () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true });

  async function openSheet(page: Page) {
    await page.goto("/app/settings?tab=data");
    await waitForApp(page);
    await page.getByRole("button", { name: /Delete my account/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(350); // the slide-up
    return dialog;
  }
  async function pull(page: Page, dialog: ReturnType<Page["getByRole"]>, distance: number) {
    const box = (await dialog.boundingBox())!;
    const x = box.x + 40;
    const y = box.y + 22; // the handle, clear of the close button
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + (distance * i) / 10);
    await page.mouse.up();
  }

  test("pulling the sheet down far enough dismisses it", async ({ page }) => {
    const dialog = await openSheet(page);
    await pull(page, dialog, 260);
    await expect(dialog).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByRole("button", { name: /Delete my account/ })).toBeFocused();
  });

  test("a short pull springs back", async ({ page }) => {
    const dialog = await openSheet(page);
    await pull(page, dialog, 40);
    await page.waitForTimeout(500);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
  });

  test("the Back button closes it and stays on the same screen", async ({ page }) => {
    const dialog = await openSheet(page);
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/app\/settings\?tab=data/);
    // Opening and closing it again by the close button leaves no stray history entry behind.
    await page.getByRole("button", { name: /Delete my account/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(200);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/app\/settings\?tab=data/);
  });
});

test.describe("details", () => {
  test("navigating from the menu runs a view transition where the browser supports it", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __vt: number }).__vt = 0;
      const original = document.startViewTransition?.bind(document);
      if (original) {
        document.startViewTransition = ((cb: never) => {
          (window as unknown as { __vt: number }).__vt += 1;
          return original(cb);
        }) as typeof document.startViewTransition;
      }
    });
    await page.goto("/app/settings");
    await waitForApp(page);
    const supported = await page.evaluate(() => typeof document.startViewTransition === "function");
    test.skip(!supported, "this browser has no View Transitions API");
    // By the side menu, and then by the keyboard shortcut: both go through the same transition.
    await page.locator("aside").getByText("Habits", { exact: true }).first().click();
    await expect(page).toHaveURL(/habits/);
    expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThan(0);
    const afterMenu = await page.evaluate(() => (window as unknown as { __vt: number }).__vt);
    await page.locator("main").focus();
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/sleep/);
    expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThan(afterMenu);
  });

  test("typography and shape details are in place", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content"))).toContain("viewport-fit=cover");
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).textWrap)).toBe("balance");
    expect(await page.locator("main p").first().evaluate((el) => getComputedStyle(el).textWrap)).toBe("pretty");
    await page.goto("/analytics-reference");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("table").first().evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain("tabular-nums");
    // Continuous corners, where the browser draws them.
    const supported = await page.evaluate(() => CSS.supports("corner-shape", "squircle"));
    if (supported) expect(await page.locator("article").first().evaluate((el) => getComputedStyle(el).getPropertyValue("corner-shape"))).toMatch(/squircle|superellipse\(2\)/);
  });

  test("the page asks the browser to pre-render the sign-in pages, and nothing else", async ({ page }) => {
    await page.goto("/");
    const rules = await page.evaluate(() => JSON.parse(document.querySelector('script[type="speculationrules"]')?.textContent ?? "{}"));
    expect(rules.prerender).toHaveLength(1);
    expect(rules.prerender[0].where.href_matches).toEqual(["/login", "/register"]);
    expect(rules.prerender[0].eagerness).toBe("moderate");
  });
});

test.describe("one-time codes", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the code field asks for the numeric keypad and offers the code, and submits itself on the sixth digit", async ({ page }) => {
    let submitted: { code?: string } | null = null;
    await page.route("**/auth/login", (route) => route.fulfill({ status: 200, json: { ok: true, data: { twoFactorRequired: true, challengeToken: "challenge-token" } } }));
    await page.route("**/auth/login/2fa", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 401, json: { ok: false, error: { code: "UNAUTHORIZED", message: "That code didn't work." } } });
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Zq7-correct-horse-Battery-9");
    await page.getByRole("button", { name: "Log in" }).click();

    const code = page.getByLabel("Authentication code");
    await expect(code).toBeVisible();
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");
    await expect(code).toHaveAttribute("inputmode", "numeric");
    await expect(code).toHaveAttribute("maxlength", "6");
    await expect(code).toBeFocused();
    await page.keyboard.type("12345");
    expect(submitted).toBeNull(); // five digits is not a code yet
    await page.keyboard.type("6");
    await expect(page.getByText("That code didn't work.")).toBeVisible();
    expect(submitted).toMatchObject({ code: "123456", challengeToken: "challenge-token" });

    // A backup code has letters, so it gets the full keyboard and is not cut at six.
    await page.getByRole("button", { name: /backup code/ }).click();
    const backup = page.getByLabel("Backup code");
    await expect(backup).toHaveAttribute("inputmode", "text");
    await backup.fill("abcd2345xy");
    await expect(backup).toHaveValue("abcd2345xy");
  });
});
