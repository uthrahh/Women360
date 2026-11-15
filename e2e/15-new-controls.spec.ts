import { expect, test, type Page } from "./fixtures";

// The date wheel and age gate, the new-password field and the sign-up journey through them.
test.use({ storageState: { cookies: [], origins: [] } });

const API = "http://localhost:4000/api/v1";
const wheel = (page: Page, name: string) => page.getByRole("spinbutton", { name, exact: true });
const thisYear = new Date().getFullYear();

async function chooseBirthDate(page: Page, yearsAgo: number) {
  const year = wheel(page, "Year");
  await year.focus();
  // The year wheel starts 30 years back; each Arrow key moves one year.
  const steps = 30 - yearsAgo;
  for (let i = 0; i < Math.abs(steps); i++) await page.keyboard.press(steps > 0 ? "ArrowDown" : "ArrowUp");
  await expect(year).toHaveAttribute("aria-valuetext", String(thisYear - yearsAgo));
}

test.describe("date wheel", () => {
  test("spins by keyboard, mouse wheel and dragging, and the day follows the month", async ({ page }) => {
    await page.goto("/register");
    const day = wheel(page, "Day");
    const month = wheel(page, "Month");
    await expect(day).toHaveAttribute("aria-valuetext", "1");

    await month.focus();
    await page.keyboard.press("ArrowDown");
    await expect(month).toHaveAttribute("aria-valuetext", /Feb/);
    await page.keyboard.press("End");
    await expect(month).toHaveAttribute("aria-valuetext", /Dec/);
    await page.keyboard.press("Home");
    await expect(month).toHaveAttribute("aria-valuetext", /Jan/);

    // Mouse wheel: one notch, one item.
    await day.hover();
    await page.mouse.wheel(0, 120);
    await expect(day).not.toHaveAttribute("aria-valuetext", "1");

    // Drag upwards to move to later days, with momentum carrying it on.
    const box = (await day.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.8);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x, box.y + box.height * 0.8 - i * 18, { steps: 2 });
    await page.mouse.up();
    await expect.poll(async () => Number(await day.getAttribute("aria-valuetext"))).toBeGreaterThan(4);

    // 31 is not a day in February: picking day 31 then February brings the day back to the month's last day.
    await day.focus();
    await page.keyboard.press("End");
    await expect(day).toHaveAttribute("aria-valuetext", "31");
    await month.focus();
    await page.keyboard.press("ArrowDown");
    await expect(day).toHaveAttribute("aria-valuetext", /^(28|29)$/);
  });
});

test.describe("age gate", () => {
  test("asks for a date of birth, and turns a minor away neutrally, remembered on this device", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Young Tester");
    await page.getByLabel("Email").fill(`minor.${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Suggest one" }).click();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Choose your date of birth.")).toBeVisible();

    await chooseBirthDate(page, 16);
    await page.getByRole("button", { name: "Create account" }).click();
    const refusal = page.getByText("Sorry, Women360 isn't available to you");
    await expect(refusal).toBeVisible();
    // Neutral: it never says which age was needed.
    await expect(page.locator("main")).not.toContainText(/18|too young|old enough/i);
    // And it doesn't invite a second try with another date.
    await page.reload();
    await expect(refusal).toBeVisible();
    await page.evaluate(() => localStorage.removeItem("w360.ageDeclined"));
  });
});

test.describe("new password field", () => {
  test("one calm line, no rule list or confirm field; dots turn into letters; a suggestion fills and shows", async ({ page }) => {
    await page.goto("/register");
    const field = page.getByLabel("Password", { exact: true });
    await expect(page.getByLabel(/confirm/i)).toHaveCount(0);
    await field.fill("tulip");
    await expect(page.getByText("7 more characters to go.")).toBeVisible();
    // While hidden, the page holds only dots: the letters themselves are not in the page.
    await expect(page.locator(".npf-letter")).toHaveCount(0);
    await expect(page.locator(".npf-dot")).toHaveCount(5);

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.locator(".npf-letter")).toHaveText(["t", "u", "l", "i", "p"]);
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(page.locator(".npf-letter")).toHaveCount(0);

    await page.getByRole("button", { name: "Suggest one" }).click();
    const value = await field.inputValue();
    expect(value).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    await expect(page.locator('p[id$="-status"]')).toHaveText(/^(Strong|Very strong)\.$/);
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
    await expect(field).toHaveAttribute("autocomplete", "new-password");
    await expect(field).toHaveAttribute("type", "text");
    // The outline meter is drawn most of the way round.
    const drawn = await page.locator(".npf-meter").evaluate((el) => Number(el.getAttribute("stroke-dasharray")!.split(" ")[0]) / Number(el.getAttribute("stroke-dasharray")!.split(" ")[1]));
    expect(drawn).toBeGreaterThan(0.75);
  });

  test("hides itself again when she leaves the tab", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Suggest one" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  });
});

test("sign-up with an adult date of birth reaches onboarding; onboarding without one asks for it", async ({ page, request }) => {
  const email = `wheel.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Wheel Tester");
  await page.getByLabel("Email").fill(email);
  await chooseBirthDate(page, 34);
  await page.getByRole("button", { name: "Suggest one" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);

  // An account with no date of birth (the phone's device account works this way) can't skip past it.
  const password = "Wq4-tulip-Harbour-8x";
  const noDob = `nodob.${Date.now()}@example.com`;
  expect((await request.post(`${API}/auth/register`, { data: { name: "No Date", email: noDob, password } })).status()).toBe(201);
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.getByLabel("Email").fill(noDob);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^log in$/i }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Choose your date of birth to continue.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
});
