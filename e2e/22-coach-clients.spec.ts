import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";
import { makeStaff, signInPage, type Staff } from "./staff";

// The coach's own assessment form, end to end: a nutrition coach adds a client during a consultation, fills in her diet with a
// 24-hour recall, takes measurements and records a consultation; a fitness colleague added to her sees only the fitness parts; the
// client claims her record with the one-time link and sees her coaches and plans; an administrator sets specialities.
test.describe.configure({ mode: "serial" });

/** The same axe-core rules as e2e/05, on the coach, administrator and invite screens it can't reach with a woman's account. */
async function audit(page: Page) {
  await page.waitForTimeout(1500);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  expect(violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`), "accessibility violations").toEqual([]);
}

const API = "http://localhost:4000/api/v1";
const run = Date.now().toString(36).slice(-5);
const CLIENT = `Revathi ${run}`;
let nutrition: Staff;
let fitness: Staff;
let admin: Staff;
let inviteLink = "";

test.beforeAll(async ({ request }) => {
  [nutrition, fitness, admin] = await Promise.all([makeStaff(request, "COACH", `Nila Nutrition ${run}`), makeStaff(request, "COACH", `Fathima Fitness ${run}`), makeStaff(request, "ADMIN", `Ada Admin ${run}`)]);
});

test("an administrator sets each coach's specialities", async ({ browser }) => {
  const page = await signInPage(browser, admin);
  await page.goto("/admin?tab=coaches");
  await waitForApp(page);
  const nila = page.getByRole("group", { name: `Nila Nutrition ${run}'s specialities` });
  await nila.getByRole("button", { name: "Nutrition", exact: true }).click();
  const fathima = page.getByRole("group", { name: `Fathima Fitness ${run}'s specialities` });
  await fathima.getByRole("button", { name: "Fitness and physiotherapy" }).click();
  await expect(fathima.getByRole("button", { name: "Fitness and physiotherapy" })).toHaveAttribute("aria-pressed", "true");
  await audit(page);
  await page.waitForTimeout(500);
  await page.context().close();
});

test("a coach adds a client with her consent and records the assessment, measurements and a consultation", async ({ browser }) => {
  const page = await signInPage(browser, nutrition);
  await page.goto("/coach?tab=clients");
  await waitForApp(page);
  await page.getByRole("button", { name: "Add a client" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(CLIENT);
  // The date of birth wheel: pick a year about 30 years back with the keyboard.
  const year = dialog.getByRole("spinbutton", { name: /year/i });
  await year.focus();
  await page.keyboard.press("ArrowDown");
  await dialog.getByRole("button", { name: "Woman", exact: true }).click();
  await dialog.getByRole("button", { name: "Add client" }).click();
  await expect(dialog.getByText("Confirm that she agreed")).toBeVisible();
  await dialog.getByText(/She agreed to her details being recorded/).click();
  await dialog.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT, level: 2 })).toBeVisible();

  const diet = page.getByRole("region", { name: "Dietary assessment" });
  await diet.getByRole("button", { name: /^Fill in/ }).click();
  await diet.getByRole("button", { name: "Vegetarian", exact: true }).click();
  await diet.getByRole("button", { name: "Add a meal or drink" }).click();
  await diet.getByLabel("Time").fill("8 am");
  await diet.getByLabel("What she ate or drank").fill("Ragi dosa, chutney");
  await diet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(diet.getByText("Ragi dosa, chutney")).toBeVisible();

  await page.getByRole("button", { name: "Add measurements" }).click();
  await page.getByRole("button", { name: /^Add height/i }).click();
  await page.getByRole("button", { name: /^Add weight/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("table").getByText("23.4")).toBeVisible(); // 60 kg, 160 cm

  await page.getByRole("button", { name: "Record a consultation" }).click();
  await page.getByLabel("Plan given").fill("Add a protein to breakfast");
  await page.getByLabel("Notes").fill("Busy mornings");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Add a protein to breakfast")).toBeVisible();

  await page.getByRole("button", { name: "Add a coach" }).click();
  await page.getByLabel("Coach", { exact: true }).selectOption({ label: `Fathima Fitness ${run}: Fitness and physiotherapy` });
  await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(`Fathima Fitness ${run}`)).toBeVisible();

  await page.getByRole("button", { name: "Make an invite link" }).click();
  inviteLink = (await page.locator("code").first().textContent()) ?? "";
  await audit(page);
  expect(inviteLink).toContain("/invite?token=");
  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoHorizontalScroll(page);
  await page.context().close();
});

test("the fitness coach sees only the fitness parts of her record", async ({ browser }) => {
  const page = await signInPage(browser, fitness);
  await page.goto("/coach?tab=clients");
  await waitForApp(page);
  await page.getByRole("button", { name: new RegExp(CLIENT) }).click();
  await expect(page.getByRole("heading", { name: CLIENT, level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lifestyle" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Dietary assessment" })).toHaveCount(0);
  await expect(page.getByText("Add a protein to breakfast")).toHaveCount(0);
  await expect(page.getByText("23.4")).toBeVisible();
  await page.context().close();
});

test("she claims her record with the link and sees her coaches and plan, not their notes", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(new URL(inviteLink).pathname + new URL(inviteLink).search);
  await expect(page.getByRole("heading", { name: /^Welcome, Revathi/ })).toBeVisible();
  await audit(page);
  await page.getByLabel("Email").fill(`e2e.client.${run}.${Date.now()}@example.com`);
  await page.getByRole("button", { name: /suggest/i }).click();
  await page.getByText(/I've read the/).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/app\//);
  await page.goto("/app/settings?tab=coaching");
  await waitForApp(page);
  await expect(page.getByRole("region", { name: "Your coaches" }).getByText(`Nila Nutrition ${run}`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Add a protein to breakfast")).toBeVisible();
  await expect(page.getByText("Busy mornings")).toHaveCount(0);
  await audit(page);
  // The link worked once.
  const again = await page.request.get(`${API}/invites/${new URL(inviteLink).searchParams.get("token")}`);
  expect(again.status()).toBe(404);
  await context.close();
});
