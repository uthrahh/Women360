import { expect, test, waitForApp } from "./fixtures";

// The API in these runs has CLINICAL_CONTENT off, like production. Nothing that needs a clinician's
// review may be reachable: not in the menu, not on a page, and not by calling the API directly.
test.describe("features waiting for clinical review are not reachable", () => {
  test("the public config says they are off", async ({ request }) => {
    const res = await request.get("http://localhost:4000/api/v1/config");
    expect((await res.json()).data.clinicalContent).toBe(false);
  });

  test("the server refuses their routes", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    const statuses = await page.evaluate(async () => {
      const tokens = JSON.parse(localStorage.getItem("w360_session_tokens") || "{}");
      const get = async (p: string) => (await fetch(`http://localhost:4000/api/v1${p}`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } })).status;
      const day = new Date().toISOString().slice(0, 10);
      return [await get("/screening"), await get("/conditions"), await get("/learn"), await get("/insights/cycle-delay"), await get(`/activity/plan/options?today=${day}`)];
    });
    expect(statuses).toEqual([404, 404, 404, 404, 404]);
  });

  test("Learn is not in the menu and its address goes home", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await expect(page.getByRole("link", { name: "Learn" })).toHaveCount(0);
    await page.goto("/app/learn");
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test("Health has no preventive care, Cycle has no conditions tab, Activity has no plan builder", async ({ page }) => {
    await page.goto("/app/health");
    await waitForApp(page);
    await expect(page.getByRole("tab", { name: "Preventive care" })).toHaveCount(0);
    await page.goto("/app/cycle");
    await waitForApp(page);
    await expect(page.getByRole("tab", { name: "My conditions" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Worth discussing with a doctor" })).toHaveCount(0);
    await page.goto("/app/activity");
    await waitForApp(page);
    await expect(page.getByRole("button", { name: "Build my plan" })).toHaveCount(0);
  });
});
