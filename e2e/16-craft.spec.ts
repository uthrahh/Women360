import fs from "node:fs";
import { expect, test, type Page } from "./fixtures";

// docs/CRAFT.md, proven in a browser: the habit tick, rolling counts, the sign-in card, the combo box, the switch, the sliding
// tab pill, touch targets and layout shift.

const API = "http://localhost:4000/api/v1";

async function token(page: Page) {
  return JSON.parse(await page.evaluate(() => localStorage.getItem("w360_session_tokens") || "{}")).accessToken as string;
}
async function addHabit(page: Page, title: string) {
  const res = await page.request.post(`${API}/habits`, { data: { title }, headers: { Authorization: `Bearer ${await token(page)}`, "Idempotency-Key": `craft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } });
  expect(res.status()).toBe(201);
}

test.describe("habit tick", () => {
  test("is an empty ring until it is done, then the only filled thing; ticks at once and un-ticks", async ({ page }) => {
    await page.goto("/app/habits");
    await expect(page.getByRole("main")).toBeVisible();
    await addHabit(page, "Craft tick");
    await page.reload();
    const tick = page.getByRole("button", { name: /^Craft tick, / });
    await expect(tick).toHaveAttribute("aria-pressed", "false");
    // Not done: the fill is scaled to nothing, so only the outline shows.
    const fill = tick.locator(".w360-tick__fill");
    await expect.poll(() => fill.evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(0, 0, 0, 0, 0, 0)");

    // Optimistic: even with the server slow, the screen answers on the tap.
    await page.route("**/habits/*/log", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await tick.click();
    await expect(tick).toHaveAttribute("aria-pressed", "true", { timeout: 300 });
    // No spinner: nothing inside the tick, and no "saving" message, while the slow save is still out.
    await expect(tick.locator("[role=progressbar], [aria-busy=true]")).toHaveCount(0);
    await expect(page.getByText(/Saving/)).toHaveCount(0);
    // Done: the fill grows to full size (it overshoots on the way, then settles).
    await expect.poll(() => fill.evaluate((el) => getComputedStyle(el).transform), { timeout: 3000 }).toBe("matrix(1, 0, 0, 1, 0, 0)");
    await expect(page.getByText("Done for today")).toBeVisible();

    await page.unroute("**/habits/*/log");
    await tick.click();
    await expect(tick).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => fill.evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(0, 0, 0, 0, 0, 0)");
  });

  test("the count of what is done rolls instead of swapping", async ({ page }) => {
    await page.goto("/app/habits");
    await addHabit(page, "Craft roll");
    await page.reload();
    const header = page.locator(".w360-roll").first();
    const strip = header.locator(".w360-roll__strip").last();
    const before = await strip.evaluate((el) => (el as HTMLElement).style.transform);
    const spoken = await header.locator(".sr-only").innerText();
    await page.getByRole("button", { name: /^Craft roll, / }).click();
    await expect.poll(() => strip.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
    expect(Number(await header.locator(".sr-only").innerText())).toBe(Number(spoken) + 1);
    // Screen readers get the plain number; the rolling digits are hidden from them.
    await expect(header.locator('[aria-hidden="true"]').first()).toBeVisible();
  });
});

test.describe("sign-in card", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const [width, label] of [[1280, "desktop"], [390, "phone"]] as const) {
    test(`one title, one main action, concentric corners and layered shadows on ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/login");
      const card = page.locator(".auth-card");
      await expect(card.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(card.locator('button[type="submit"]')).toHaveCount(1);
      const m = await card.evaluate((el) => {
        const cs = getComputedStyle(el);
        const input = el.querySelector("input")!;
        const button = el.querySelector('button[type="submit"]')!;
        return {
          outer: parseFloat(cs.borderTopLeftRadius),
          pad: parseFloat(cs.paddingLeft),
          input: parseFloat(getComputedStyle(input).borderTopLeftRadius),
          button: parseFloat(getComputedStyle(button).borderTopLeftRadius),
          shadows: cs.boxShadow.split(/,\s*(?=rgba?\()/).length,
        };
      });
      // Inner radius = outer radius minus the padding between them.
      expect(m.input).toBeCloseTo(m.outer - m.pad, 0);
      expect(m.button).toBeCloseTo(m.outer - m.pad, 0);
      expect(m.shadows).toBeGreaterThanOrEqual(5);
    });
  }

  test("the card flies in, and lifts away when she is in", async ({ page }) => {
    const { email, password } = JSON.parse(fs.readFileSync("e2e/.auth/credentials.json", "utf8"));
    await page.goto("/login");
    await expect(page.locator(".auth-card")).toHaveClass(/w360-fly-in/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page.locator(".auth-card")).toHaveClass(/w360-fly-out/);
    await page.waitForURL(/\/(app|onboarding)/);
  });

  test("sky decoration is hidden from assistive technology and never takes a tap", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".auth-sky")).toHaveAttribute("aria-hidden", "true");
    expect(await page.locator(".auth-sky").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  });

  test("with reduced motion the clouds hold still and the card simply appears", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("http://localhost:5173/login");
    await page.locator(".auth-sky").waitFor();
    const drifting = await page.evaluate(() => document.querySelector(".auth-sky")!.getAnimations({ subtree: true }).filter((a) => a.playState === "running" && (a as CSSAnimation).animationName === "sky-drift").length);
    expect(drifting).toBe(0);
    await ctx.close();
  });
});

test.describe("combo box", () => {
  test("narrows as she types, moves with the arrows, chooses with Enter and closes with Escape", async ({ page }) => {
    await page.goto("/app/activity");
    await expect(page.getByRole("main")).toBeVisible();
    await page.getByRole("button", { name: "Add activity" }).click();
    const box = page.getByRole("combobox", { name: "Activity" });
    const list = page.getByRole("listbox", { name: "Activity", exact: true });
    await box.focus();
    await expect(list).toBeVisible();
    const all = await list.getByRole("option").count();
    await box.fill("run");
    const narrowed = await list.getByRole("option").count();
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(all);
    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", /opt-1$/);
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(box).not.toHaveValue("run");
    await box.focus();
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    // Nothing matching says so, in words.
    await box.fill("zzzz");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });
});

test.describe("switch and tabs", () => {
  test("the knob stretches as it travels, and one pill glides between tabs", async ({ page }) => {
    await page.goto("/app/settings");
    await expect(page.getByRole("main")).toBeVisible();
    await page.getByRole("tab", { name: "Accessibility" }).click();
    const sw = page.getByRole("switch", { name: "Interface sounds" });
    const knob = sw.locator("span");
    const was = await sw.getAttribute("aria-checked");
    await sw.click();
    await expect(knob).toHaveClass(/scale-x-\[1\.12\]/);
    await expect(sw).not.toHaveAttribute("aria-checked", was!);
    await expect(knob).not.toHaveClass(/scale-x-\[1\.12\]/, { timeout: 1500 });
    await sw.click(); // put it back

    const pills = page.locator('[role="tablist"] [style*="view-transition-name"]');
    await expect(pills).toHaveCount(1);
    await page.getByRole("tab", { name: "Profile" }).click();
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    await expect(pills).toHaveCount(1);
    await expect(page.getByRole("tab", { name: "Profile" }).locator('[style*="view-transition-name"]')).toHaveCount(1);
  });
});

test.describe("touch", () => {
  test("a small control can still be hit within 44px", async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 }, storageState: "e2e/.auth/user.json" });
    const page = await ctx.newPage();
    await page.goto("http://localhost:5173/app/settings");
    await page.getByRole("tab", { name: "Accessibility" }).click();
    const sw = page.getByRole("switch", { name: "Interface sounds" });
    await expect(sw).toBeVisible();
    const hit = await sw.evaluate((el) => {
      const after = getComputedStyle(el, "::after");
      return { w: parseFloat(after.width), h: parseFloat(after.height), visibleH: el.getBoundingClientRect().height };
    });
    expect(hit.visibleH).toBeLessThan(44);
    expect(hit.h).toBeGreaterThanOrEqual(44);
    expect(hit.w).toBeGreaterThanOrEqual(44);
    await ctx.close();
  });
});

test.describe("layout shift", () => {
  // Content that arrives must not push what she is reading around: Core Web Vitals call under 0.1 good; these screens stay well under.
  async function shift(page: Page, path: string) {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path);
    await expect(page.getByRole("main").first()).toBeVisible();
    await page.waitForTimeout(1800);
    return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  }
  for (const path of ["/app/dashboard", "/app/habits", "/app/nutrition", "/app/sleep"]) {
    test(`${path} does not jump as it loads`, async ({ page }) => {
      expect(await shift(page, path)).toBeLessThan(0.1);
    });
  }
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const path of ["/", "/login", "/register"]) {
      test(`${path} does not jump as it loads`, async ({ page }) => {
        expect(await shift(page, path)).toBeLessThan(0.1);
      });
    }
  });
});
