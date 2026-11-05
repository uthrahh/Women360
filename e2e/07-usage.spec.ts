import { expect, test, waitForApp } from "./fixtures";

// Anonymous usage counts: the app tells the server which screen was opened (only the screen's name), and
// not at all when the browser asks not to be tracked.
test.describe("usage counts", () => {
  test("opening a screen sends only the screen's name", async ({ page }) => {
    const sent: string[] = [];
    page.on("request", (req) => {
      if (req.url().endsWith("/usage/view")) sent.push(`${req.method()} ${req.postData()} ${Object.keys(req.headers()).includes("cookie") ? "cookie" : ""}`.trim());
    });
    await page.goto("/app/sleep");
    await waitForApp(page);
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toBe('POST {"screen":"sleep"}');
    // Moving to another screen counts that one; staying on the same one doesn't count again.
    await page.goto("/app/habits");
    await waitForApp(page);
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toBe('POST {"screen":"habits"}');
  });

  test("a browser that asks not to be tracked sends nothing", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true }));
    const sent: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/usage/")) sent.push(req.url());
    });
    await page.goto("/app/goals");
    await waitForApp(page);
    await page.goto("/app/sleep");
    await waitForApp(page);
    await page.waitForTimeout(500);
    expect(sent).toEqual([]);
  });

  test("an unknown screen name is refused by the server", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    const status = await page.evaluate(async () => {
      const tokens = JSON.parse(localStorage.getItem("w360_session_tokens") || "{}");
      const res = await fetch("http://localhost:4000/api/v1/usage/view", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ screen: "/app/anything?id=1" }),
      });
      return res.status;
    });
    expect(status).toBe(422);
  });
});
