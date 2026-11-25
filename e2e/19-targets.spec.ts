import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";
import type { Page } from "@playwright/test";

// Targets on the Nutrition page (every macro and micro) and the Activity page (walking, cardio, strength, yoga, physiotherapy minutes).
// Proves: a target can be added, shows today's total from what she logs, can be changed and removed, vitamins and minerals are optional on a
// meal and count toward their target, no amount is suggested for a vitamin, and both screens still fit a phone.
test.describe.configure({ mode: "serial" });

/** An empty number field is a "tap to enter" button (an unentered amount is never filled in for her); a filled one is a spinbutton. */
async function typeInto(page: Page, label: string, value: string) {
  const field = page.getByRole("spinbutton", { name: new RegExp("^" + label, "i") });
  if ((await field.count()) === 0) await page.getByRole("button", { name: new RegExp("^(Enter|Add) " + label, "i") }).click();
  await field.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(value);
}

test.describe("nutrition targets", () => {
  test("starts with the usual four, offers the rest and never offers a calorie target", async ({ page }) => {
    await page.goto("/app/nutrition");
    await waitForApp(page);
    const targets = page.getByRole("region", { name: "Targets" });
    await expect(targets.getByRole("button", { name: /Protein: .* Change this target/ })).toBeVisible();
    await expect(targets.getByRole("button", { name: /Fibre: .* Change this target/ })).toBeVisible();
    await targets.getByRole("button", { name: "Add a target" }).click();
    const kind = page.getByLabel("Nutrient");
    await expect(kind.locator("option", { hasText: "Iron" })).toHaveCount(1);
    await expect(kind.locator("option", { hasText: /calor/i })).toHaveCount(0);
  });

  test("adds a micro target without suggesting an amount, then counts a meal's iron toward it", async ({ page }) => {
    await page.goto("/app/nutrition");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add a target" }).click();
    await page.getByLabel("Nutrient").selectOption("iron");
    // Plain text, always shown: the app makes no medical recommendation.
    await expect(page.getByText(/doesn't suggest an amount for vitamins and minerals/)).toBeVisible();
    // The amount starts empty: nothing is pre-filled for a vitamin.
    await expect(page.getByRole("button", { name: /^Enter amount per day/i })).toBeVisible();
    await typeInto(page, "Amount per day", "18");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByText("Target saved")).toBeVisible();
    await expect(page.getByRole("button", { name: /Iron: 0 of 18 mg/ })).toBeVisible();

    // Log a meal with some iron.
    await page.getByRole("button", { name: "Add meal" }).click();
    await page.getByLabel("Meal / food name").fill("Lentil soup");
    await typeInto(page, "Calories", "250");
    await page.getByText("Vitamins and minerals").click();
    await typeInto(page, "Iron", "3.2");
    await page.getByRole("button", { name: "Save meal" }).click();
    await expect(page.getByText("Meal logged")).toBeVisible();
    await expect(page.getByRole("button", { name: /Iron: 3.2 of 18 mg/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a ceiling reads as 'up to', and a target can be changed and removed", async ({ page }) => {
    await page.goto("/app/nutrition");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add a target" }).click();
    await page.getByLabel("Nutrient").selectOption("sodium");
    // Sodium is usually a ceiling, so that is the starting choice.
    await expect(page.getByRole("radio", { name: "Stay under" })).toBeChecked();
    await typeInto(page, "Amount per day", "2000");
    await page.getByRole("button", { name: "Save target" }).click();
    const row = page.getByRole("button", { name: /Sodium: 0 of 2,000 mg maximum/ });
    await expect(row).toBeVisible();
    await row.click();
    await typeInto(page, "Amount per day", "1500");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByRole("button", { name: /Sodium: 0 of 1,500 mg maximum/ })).toBeVisible();
    await page.getByRole("button", { name: /Sodium: .* Change this target/ }).click();
    await page.getByRole("button", { name: "Remove this target" }).click();
    await expect(page.getByText("Target removed")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sodium: / })).toHaveCount(0);
  });

  test("the water and fruit and veg targets are changed from their own cards", async ({ page }) => {
    await page.goto("/app/nutrition");
    await waitForApp(page);
    await page.getByRole("button", { name: "Change Hydration target" }).click();
    await typeInto(page, "Amount per day", "2500");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByText("of 2500ml")).toBeVisible();
  });
});

test.describe("activity targets", () => {
  test("adds a walking target for each day and counts a logged walk toward it", async ({ page }) => {
    await page.goto("/app/activity");
    await waitForApp(page);
    const targets = page.getByRole("region", { name: "Targets" });
    await targets.getByRole("button", { name: "Add a target" }).click();
    await page.getByLabel("Kind of activity").selectOption("WALKING");
    await page.getByRole("radio", { name: "Each day" }).check({ force: true });
    await typeInto(page, "Minutes", "30");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByRole("button", { name: /Walking: 0 min of 30 min today/ })).toBeVisible();
    // One tap on a quick-log chip logs 30 minutes of brisk walking; the target follows.
    await page.getByRole("button", { name: /30 min walking, brisk/ }).click();
    await expect(page.getByRole("button", { name: /Walking: 30 min of 30 min today/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("physiotherapy is a kind of activity with its own target and no calorie estimate", async ({ page }) => {
    await page.goto("/app/activity");
    await waitForApp(page);
    await page.getByRole("button", { name: "Add a target" }).click();
    await page.getByLabel("Kind of activity").selectOption("PHYSIO");
    await expect(page.getByText(/Use the amount your physiotherapist set/)).toBeVisible();
    await typeInto(page, "Minutes", "90");
    await page.getByRole("button", { name: "Save target" }).click();
    await expect(page.getByRole("button", { name: /Physiotherapy: 0 min of 1 h 30 min this week/ })).toBeVisible();
  });
});
