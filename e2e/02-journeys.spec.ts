import { expect, test, waitForApp } from "./fixtures";

test.describe("home screen", () => {
  test("is calm: a greeting, to-do, quick log and today so far, and no cycle card without a period", async ({ page }) => {
    await page.goto("/app/dashboard");
    await waitForApp(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening), Ruth\./);
    await expect(page.getByRole("heading", { name: "To do today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Log something" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today so far" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your cycle" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "This week" })).toHaveCount(0);
  });

  test("the Help button brings tips back and they go away when she moves on", async ({ page }) => {
    await page.goto("/app/cycle");
    await waitForApp(page);
    const help = page.getByRole("button", { name: "Show tips for this page" });
    await expect(help).toHaveAttribute("aria-pressed", "false");
    await help.click();
    await expect(help).toHaveAttribute("aria-pressed", "true");
    await page.goto("/app/sleep");
    await waitForApp(page);
    await expect(page.getByRole("button", { name: "Show tips for this page" })).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("sleep", () => {
  test("asks for both days and times, defaults the wake day to the next day, and shows impossible spans as an error", async ({ page }) => {
    await page.goto("/app/sleep");
    await waitForApp(page);
    await page.getByRole("button", { name: "Log sleep" }).click();
    const bedDay = page.getByLabel("Went to bed, day");
    const wakeDay = page.getByLabel("Woke up, day");
    await expect(bedDay).toBeVisible();
    await expect(page.getByLabel("Went to bed, time")).toHaveValue("23:00");
    await expect(page.getByLabel("Woke up, time")).toHaveValue("07:00");
    const bed = await bedDay.inputValue();
    const wake = await wakeDay.inputValue();
    expect((Date.parse(wake) - Date.parse(bed)) / 86_400_000).toBe(1);
    await expect(page.getByText("Duration: 8h")).toBeVisible();

    // Choosing a different bed day herself, then waking on that same day (earlier in the day than she went to bed), is impossible.
    await bedDay.fill(wake);
    await wakeDay.fill(wake);
    await expect(page.getByText(/Waking up has to be after bedtime/)).toBeVisible();
    await bedDay.fill(bed);
    await wakeDay.fill(wake);
    await expect(page.getByText("Duration: 8h")).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Sleep logged")).toBeVisible();
  });
});

test.describe("cycle", () => {
  test("one tap logs a period start, the home screen shows it, and a second tap undoes it", async ({ page }) => {
    await page.goto("/app/cycle");
    await waitForApp(page);
    await page.getByRole("button", { name: "Log period started today" }).click();
    await expect(page.getByRole("button", { name: /Period started today/ })).toContainText("tap to undo");

    await page.goto("/app/dashboard");
    await waitForApp(page);
    await expect(page.getByRole("region", { name: "Your cycle" })).toContainText("Day 1 of your period");

    await page.goto("/app/cycle");
    await waitForApp(page);
    await page.getByRole("button", { name: /Period started today/ }).click();
    await expect(page.getByRole("button", { name: "Log period started today" })).toBeVisible();

    await page.goto("/app/dashboard");
    await waitForApp(page);
    await expect(page.getByRole("region", { name: "Your cycle" })).toHaveCount(0);
  });
});

test.describe("habits", () => {
  test("adds a habit from an idea", async ({ page }) => {
    await page.goto("/app/habits");
    await waitForApp(page);
    const idea = page.getByRole("button", { name: /Take a vitamin|Stretch|Drink|Walk 10,000 steps/ }).first();
    await expect(idea).toBeVisible();
    await idea.click();
    await expect(page.getByText(/added|saved/i).first()).toBeVisible();
  });
});

test.describe("activity", () => {
  test("logs an activity from the catalog", async ({ page }) => {
    await page.goto("/app/activity");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add activity" }).click();
    await page.getByLabel("Activity", { exact: true }).selectOption({ label: "Walking" });
    await expect(page.getByRole("radio").first()).toBeVisible();
    await page.getByRole("spinbutton", { name: "Duration, minutes" }).fill("45");
    await page.getByRole("button", { name: /Save activity/ }).click();
    await expect(page.getByText(/saved|logged/i).first()).toBeVisible();
  });

  test("number fields have clickable arrows", async ({ page }) => {
    await page.goto("/app/activity");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add activity" }).click();
    await page.getByLabel("Activity", { exact: true }).selectOption({ label: "Walking" });
    const minutes = page.getByRole("spinbutton", { name: "Duration, minutes" });
    await page.getByRole("button", { name: "Increase duration, minutes" }).click();
    await page.getByRole("button", { name: "Increase duration, minutes" }).click();
    await expect(minutes).not.toHaveValue("");
  });
});

test.describe("your data", () => {
  test("downloads everything held about the account", async ({ page }) => {
    await page.goto("/app/settings");
    await waitForApp(page);
    await page.getByRole("tab", { name: /your data/i }).or(page.getByRole("button", { name: /your data/i })).first().click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /download/i }).first().click()]);
    expect(download.suggestedFilename()).toMatch(/women360|data|export/i);
  });
});
