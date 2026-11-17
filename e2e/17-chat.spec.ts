import AxeBuilder from "@axe-core/playwright";
import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";

// The AI chat, proven in a browser against the real API in its scripted mode (fixed answers: free, offline, and never the real model).
// Covers what the owner asked of the screen (suggested prompts, visible steps, citations, a plan she can tick off, next questions) and
// what keeps it safe (only pages the server announced become links, a refusal is shown plainly, nothing is kept, it can be switched off).
test.describe.configure({ mode: "serial" });

const textbox = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Ask a question" });

async function openChat(page: import("@playwright/test").Page) {
  await page.goto("/app/chat");
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1, name: "Ask Women360" })).toBeVisible();
}

test.describe("the chat screen", () => {
  test("is in the menu, offers prompts to tap and states its limits plainly", async ({ page }) => {
    // The Support group of the menu is open on its own screens.
    await page.goto("/app/messages");
    await waitForApp(page);
    await expect(page.getByRole("button", { name: "Ask Women360" })).toBeVisible();
    await openChat(page);
    await expect(page.getByRole("button", { name: "Help me sleep more regularly" })).toBeVisible();
    // Never hidden: what it is not, and what is (not) kept.
    await expect(page.getByText(/Not medical advice/)).toBeVisible();
    await expect(page.getByText(/isn't saved/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("answers a tapped prompt with steps, a cited paragraph, a plan she can tick, and next questions", async ({ page }) => {
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();

    // The answer streams in; the plan arrives as tick boxes.
    const plan = page.getByRole("region", { name: "Your plan" });
    await expect(plan).toBeVisible({ timeout: 15_000 });
    await expect(plan.getByRole("checkbox")).toHaveCount(3);
    // Sharing is off by default, and the answer says it can't see her logs.
    await expect(page.getByText(/can't see your logs/)).toBeVisible();

    // A page the server announced is a link; it opens elsewhere without telling that site where she came from.
    const cited = page.getByRole("link", { name: /Example sleep guide/ }).first();
    await expect(cited).toHaveAttribute("href", "https://example.org/sleep-guide");
    await expect(cited).toHaveAttribute("rel", /noopener/);
    await expect(cited).toHaveAttribute("target", "_blank");

    // What it did is one tap away.
    await expect(page.getByText(/How I got this \(1 step\)/)).toBeVisible();

    // Ticking a task fills it and the count follows.
    const first = plan.getByRole("checkbox").first();
    await expect(first).toHaveAttribute("aria-checked", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");
    // The count rolls; its plain number is what a screen reader gets.
    await expect(plan.locator(".w360-roll .sr-only")).toHaveText("1");
    await expect(plan.getByText(/of 3 done/)).toBeVisible();

    // Next questions are on the last line of the answer; tapping one asks it.
    await expect(page.getByText("Ask next")).toBeVisible();
    await page.getByRole("button", { name: "Why does sleep affect mood?" }).click();
    await expect(page.getByText("Why does sleep affect mood?").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Your plan" })).toHaveCount(2, { timeout: 15_000 });
    // Only the newest answer offers next questions.
    await expect(page.getByText("Ask next")).toHaveCount(1);
    await expectNoHorizontalScroll(page);
  });

  test("typing a question works, Shift+Enter makes a new line, and New chat clears the screen", async ({ page }) => {
    await openChat(page);
    const box = textbox(page);
    await box.fill("First line");
    await box.press("Shift+Enter");
    await box.type("second line");
    await expect(box).toHaveValue("First line\nsecond line");
    await box.press("Enter");
    await expect(page.getByRole("region", { name: "Your plan" })).toBeVisible({ timeout: 15_000 });
    await expect(box).toHaveValue("");
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("region", { name: "Your plan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Help me sleep more regularly" })).toBeVisible();
  });

  test("the conversation survives a trip to another screen and back, and is not written to the browser's storage", async ({ page }) => {
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    const plan = page.getByRole("region", { name: "Your plan" });
    await expect(plan).toBeVisible({ timeout: 15_000 });
    await plan.getByRole("checkbox").nth(1).click();

    // Nothing of the conversation is in local or session storage.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain("Help me sleep more regularly");
    expect(stored).not.toContain("Wake at the same time");

    // The plan links to other screens; coming back finds the conversation (and the tick) where it was.
    await page.getByRole("link", { name: "Sleep", exact: true }).first().click();
    await expect(page).toHaveURL(/\/app\/sleep/);
    await page.goBack();
    await expect(page.getByRole("region", { name: "Your plan" }).getByRole("checkbox").nth(1)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "New chat" }).click();
  });

  test("sharing her logs is her choice: off by default, saved when she turns it on, and the answer changes", async ({ page }) => {
    await openChat(page);
    const share = page.getByRole("switch", { name: /read a summary of my last 30 days/ });
    await expect(share).toHaveAttribute("aria-checked", "false");
    await share.click();
    await expect(share).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/averages and counts/)).toBeVisible();
    // It is the server that remembers, not the page.
    await page.reload();
    await expect(page.getByRole("switch", { name: /read a summary/ })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "What do my last 30 days say?" }).click();
    await expect(page.getByText(/You haven't logged sleep in the last 30 days|you slept about/)).toBeVisible({ timeout: 15_000 });
    await page.getByText(/How I got this \(2 steps\)/).click();
    await expect(page.getByText("Read your last 30 days")).toBeVisible();

    // Put it back for whatever runs next.
    await page.getByRole("switch", { name: /read a summary/ }).click();
    await expect(page.getByRole("switch", { name: /read a summary/ })).toHaveAttribute("aria-checked", "false");
  });

  test("only pages the server announced become links; made-up and unsafe addresses stay plain words", async ({ page }) => {
    const body =
      'data: {"type":"sources","sources":[{"url":"https://example.org/real","title":"Real"}]}\n\n' +
      `data: ${JSON.stringify({
        type: "delta",
        text: "Real [source](https://example.org/real), invented [fake](https://invented.example/x), unsafe [script](javascript:alert(1)) and <img src=x onerror=alert(1)> in text.\n\n",
      })}\n\n` +
      'data: {"type":"done"}\n\n';
    await page.route("**/chat/message", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body }));
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    await expect(page.getByText(/invented/)).toBeVisible({ timeout: 15_000 });
    const answer = page.getByTestId("chat");
    await expect(answer.getByRole("link", { name: /^source/ })).toHaveAttribute("href", "https://example.org/real");
    await expect(answer.locator('a[href*="invented"]')).toHaveCount(0);
    await expect(answer.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(answer.locator("img")).toHaveCount(0);
    // The markup is shown as the words it is, not run.
    await expect(page.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  });

  test("a limit or a refusal is explained in plain words, with a way to try again", async ({ page }) => {
    await page.route("**/chat/message", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "CHAT_LIMIT", message: "You've reached today's chat limit. Please try again tomorrow." } }) }));
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    await expect(page.getByRole("alert").getByText("You've reached today's chat limit. Please try again tomorrow.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("a stream that drops half way says so instead of looking finished", async ({ page }) => {
    const body = `data: ${JSON.stringify({ type: "delta", text: "A start that never finishes" })}\n\n`;
    await page.route("**/chat/message", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body }));
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    await expect(page.getByRole("alert").getByText(/connection dropped/)).toBeVisible({ timeout: 15_000 });
  });

  test("with reduced motion the answer simply appears", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    await expect(page.getByRole("region", { name: "Your plan" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".w360-chat-live")).toHaveCount(0);
  });

  test("has no accessibility violations with an answer, a plan and sources on screen, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await openChat(page);
      await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
      await expect(page.getByRole("button", { name: "Why does sleep affect mood?" })).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1500);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(violations.map((v) => `${v.impact} ${v.id}: ${v.help} e.g. ${v.nodes[0]?.target.join(" ")}`), scheme).toEqual([]);
      await page.getByRole("button", { name: "New chat" }).click();
    }
  });

  test("fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openChat(page);
    await page.getByRole("button", { name: "Help me sleep more regularly" }).click();
    await expect(page.getByRole("region", { name: "Your plan" })).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
    // The box she types in is reachable and not hidden behind the bottom bar.
    const box = await textbox(page).boundingBox();
    const bar = await page.getByRole("navigation").last().boundingBox();
    expect(box).not.toBeNull();
    if (box && bar) expect(box.y + box.height).toBeLessThanOrEqual(bar.y + 1);
  });
});

test.describe("the chat is switched off", () => {
  test("it is not in the menu and its address goes home", async ({ page }) => {
    await page.route("**/api/v1/config", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { clinicalContent: false, pushPublicKey: null, supportEmail: null, chatbot: false, emailVerification: false } }) })
    );
    await page.goto("/app/messages");
    await waitForApp(page);
    await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask Women360" })).toHaveCount(0);
    await page.goto("/app/chat");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("the server refuses without a sign-in", async ({ request }) => {
    const res = await request.post("http://localhost:4000/api/v1/chat/message", { data: { today: "2026-01-01", messages: [{ role: "user", content: "hi" }] } });
    expect(res.status()).toBe(401);
  });
});
