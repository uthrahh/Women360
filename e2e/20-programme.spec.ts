import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";
import { makeStaff, signInPage, type Staff } from "./staff";

// The guided programme, end to end in three real browser windows: an administrator publishes a programme and approves a task
// template, the woman joins and answers her starting questions, the administrator assigns a coach, the coach builds and publishes
// the plan, she ticks a task and asks for help on another, and the coach's reply reaches her. Also: her screen fits a phone.
test.describe.configure({ mode: "serial" });

const API = "http://localhost:4000/api/v1";
const PROGRAMME = `E2E programme ${Date.now()}`;
let admin: Staff;
let coach: Staff;
let programmeId = "";

test.beforeAll(async ({ request }) => {
  // Names unique to this run, so an account left by an earlier run is never picked by mistake.
  const run = Date.now().toString(36).slice(-5);
  admin = await makeStaff(request, "ADMIN", `Asha Admin ${run}`);
  coach = await makeStaff(request, "COACH", `Kavya Coach ${run}`);
});

test.afterAll(async ({ request }) => {
  // Leave nothing on offer to other local accounts once the run is over.
  if (programmeId) {
    await request.patch(`${API}/admin/programme/programmes/${programmeId}`, { headers: { Authorization: `Bearer ${admin.token}` }, data: { status: "RETIRED" } });
  }
});

test("an administrator publishes a programme and approves a template, recording who reviewed it", async ({ browser }) => {
  const page = await signInPage(browser, admin);
  await page.goto("/admin?tab=programmes");
  await waitForApp(page);

  await page.getByRole("button", { name: "New programme" }).click();
  await page.getByLabel("Name").fill(PROGRAMME);
  await page.getByLabel("Summary").fill("Small daily steps with a coach.");
  await page.getByRole("button", { name: "Save as a draft" }).click();
  await expect(page.getByText("Saved as a draft")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: PROGRAMME });
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row.getByText("Published")).toBeVisible();

  await page.getByRole("button", { name: "New template" }).click();
  await page.getByLabel("Title").fill(`Glass of water ${PROGRAMME}`);
  await page.getByLabel("Instructions").fill("Drink a glass of water after you wake up.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const tpl = page.getByRole("listitem").filter({ hasText: `Glass of water ${PROGRAMME}` });
  await expect(tpl.getByText("Needs review")).toBeVisible();
  await tpl.getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Reviewed by").fill("Health content lead");
  await page.getByRole("button", { name: "Approve", exact: true }).last().click();
  await expect(tpl.getByText("Reviewed by Health content lead")).toBeVisible();

  const res = await page.request.get(`${API}/admin/programme/programmes`, { headers: { Authorization: `Bearer ${admin.token}` } });
  programmeId = (await res.json()).data.find((p: { name: string }) => p.name === PROGRAMME).id;
  await page.context().close();
});

test("she joins after reading what her coach will see, and sends her starting answers", async ({ page }) => {
  await page.goto("/app/programme");
  await waitForApp(page);
  const item = page.getByRole("listitem").filter({ hasText: PROGRAMME });
  await item.getByRole("button", { name: /^Join/ }).click();
  // The consent is plain text, always shown before joining.
  await expect(page.getByText(/Your other records .* stay private/)).toBeVisible();
  await page.getByRole("button", { name: "I agree. Join and start" }).click();

  await expect(page.getByRole("heading", { name: "A few questions to start" })).toBeVisible();
  // Sending with gaps is stopped here, with the reason.
  await page.getByRole("button", { name: "Send to my coach" }).click();
  await expect(page.getByText(/questions need an answer/)).toBeVisible();

  await page.getByRole("button", { name: "Moving more", exact: true }).click();
  await page.getByRole("button", { name: /^(Enter|Add) days/i }).click();
  await page.getByRole("spinbutton", { name: /^Days/ }).fill("1");
  await page.getByRole("group", { name: /how long do you sleep/ }).getByRole("button", { name: "6 to 7 hours", exact: true }).click();
  await page.getByRole("group", { name: /cooked at home/ }).getByRole("button", { name: "Most", exact: true }).click();
  await page.getByRole("button", { name: /^(Enter|Add) glasses/i }).click();
  await page.getByRole("spinbutton", { name: /^Glasses/ }).fill("5");
  await page.getByRole("group", { name: /energy/ }).getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("group", { name: /stressed/ }).getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("group", { name: /How much time/ }).getByRole("button", { name: "20 minutes", exact: true }).click();
  await page.getByRole("group", { name: /How ready/ }).getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Send to my coach" }).click();
  await expect(page.getByRole("heading", { name: "Your answers are in" })).toBeVisible();
});

test("an administrator assigns a coach, who builds the plan from the library and publishes it", async ({ browser }) => {
  const a = await signInPage(browser, admin);
  await a.goto("/admin?tab=programmes");
  await waitForApp(a);
  const who = a.getByRole("listitem").filter({ hasText: "Ruth Tester" }).filter({ hasText: PROGRAMME });
  await who.getByLabel(/^Coach for/).selectOption({ label: `${coach.name} (0)` });
  await who.getByRole("button", { name: "Assign" }).click();
  await expect(a.getByText("Coach assigned")).toBeVisible();
  await a.context().close();

  const c = await signInPage(browser, coach);
  await c.goto("/coach?tab=programme");
  await waitForApp(c);
  await expect(c.getByRole("heading", { name: "Ruth Tester" })).toBeVisible();
  await expect(c.getByText("Her starting answers")).toBeVisible();

  await c.getByRole("button", { name: "Add a task" }).click();
  await c.getByLabel("Start from").selectOption({ label: `Movement: Glass of water ${PROGRAMME}` });
  await c.getByRole("button", { name: "Add to the plan" }).click();
  await c.getByRole("button", { name: "Add a task" }).click();
  await c.getByLabel("Title").fill("A short walk");
  await c.getByRole("radio", { name: "An amount" }).check({ force: true });
  await c.getByLabel("Counted in").fill("minutes");
  await c.getByLabel("How to do it").fill("Walk at an easy pace.");
  await c.getByRole("button", { name: "Add to the plan" }).click();
  await expect(c.getByText("Draft")).toHaveCount(2);

  await c.getByRole("button", { name: "Publish the plan" }).click();
  await c.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(c.getByText("Published. She's been told.")).toBeVisible();
  await expect(c.getByText("Draft")).toHaveCount(0);
  await c.context().close();
});

test("she sees today's tasks, ticks one, asks for help on the other, and her coach's reply reaches her", async ({ page, browser }) => {
  await page.goto("/app/programme");
  await waitForApp(page);
  await expect(page.getByText(/Day 1 of 30/)).toBeVisible();
  await page.getByRole("button", { name: `Glass of water ${PROGRAMME}` }).click();
  await expect(page.getByText(`Done: Glass of water ${PROGRAMME}`)).toBeVisible();

  const walk = page.getByRole("listitem").filter({ hasText: "A short walk" });
  await walk.getByRole("button", { name: "Ask for help" }).click();
  await page.getByLabel("What's getting in the way?").fill("No time after work");
  await page.getByRole("button", { name: "Send to my coach" }).click();
  await expect(walk.getByText("You asked your coach for help")).toBeVisible();

  const c = await signInPage(browser, coach);
  await c.goto("/coach?tab=programme");
  await waitForApp(c);
  await expect(c.getByText("1 to answer")).toBeVisible();
  await c.getByLabel("Reply about A short walk").fill("Try ten minutes before dinner.");
  await c.getByRole("button", { name: "Send reply" }).click();
  await expect(c.getByText("Reply sent")).toBeVisible();
  await c.context().close();

  await page.reload();
  await waitForApp(page);
  await expect(page.getByText("Try ten minutes before dinner.")).toBeVisible();
});

test("her programme screen fits a phone with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app/programme");
  await waitForApp(page);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
