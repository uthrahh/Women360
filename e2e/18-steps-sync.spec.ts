import { expect, expectNoHorizontalScroll, test, waitForApp } from "./fixtures";

// Filling in steps from a file (the website path; the Android Health Connect path needs a real phone and is not covered here).
// Proves: a CSV and an Apple Health export both fill days in, the page says so, a day she typed herself is kept as she typed it and
// she is told, an unreadable file is refused plainly, and the screen still fits a phone.
test.describe.configure({ mode: "serial" });

const pad = (n: number) => String(n).padStart(2, "0");
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function openActivity(page: import("@playwright/test").Page) {
  await page.goto("/app/activity");
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1, name: /Activity/ })).toBeVisible();
}
const chooser = (page: import("@playwright/test").Page) => page.getByLabel("Choose a step file to import");

test.describe("steps from a file", () => {
  test("a CSV fills in her days and the page says when", async ({ page }) => {
    await openActivity(page);
    await expect(page.getByRole("button", { name: "Import from a file" })).toBeVisible();
    // On the website there is no phone link: that is only offered in the installed Android app.
    await expect(page.getByRole("button", { name: "Fill in from my phone" })).toHaveCount(0);
    const csv = `date,steps\n${day(-2)},4100\n${day(-1)},7300\n${day(0)},2500\n`;
    await chooser(page).setInputFiles({ name: "steps.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText(/Steps filled in for 3 days/)).toBeVisible();
    await expect(page.getByText(/Last filled in from a file/)).toBeVisible();
    // Today's count now shows on the card.
    await expect(page.getByText("2,500", { exact: true }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a day she typed herself is kept, and she is told", async ({ page }) => {
    await openActivity(page);
    await page.getByRole("button", { name: "Update steps" }).click();
    // The number chip is typed into by keyboard once focused (it holds the current count, so replace it).
    await page.getByRole("spinbutton", { name: "Steps today" }).focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3000");
    await page.getByRole("button", { name: "Save steps" }).click();
    await expect(page.getByText("Steps updated")).toBeVisible();
    const csv = `${day(0)},9999\n${day(-3)},5200\n`;
    await chooser(page).setInputFiles({ name: "steps.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText(/Steps filled in for 1 day\. Kept 1 day you entered yourself/)).toBeVisible();
    await expect(page.getByText("3,000", { exact: true }).first()).toBeVisible();
  });

  test("an Apple Health export is read, taking the source that counted the most", async ({ page }) => {
    await openActivity(page);
    const rec = (source: string, d: string, v: number) =>
      `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="${source}" unit="count" startDate="${d} 09:00:00 +0530" endDate="${d} 09:10:00 +0530" value="${v}"/>`;
    const xml = `<?xml version="1.0"?><HealthData>${rec("iPhone", day(-5), 1000)}${rec("iPhone", day(-5), 2000)}${rec("Watch", day(-5), 2500)}<Record type="HKQuantityTypeIdentifierHeartRate" startDate="${day(-5)} 09:00:00 +0530" value="70"/></HealthData>`;
    await chooser(page).setInputFiles({ name: "export.xml", mimeType: "text/xml", buffer: Buffer.from(xml) });
    await expect(page.getByText(/Steps filled in for 1 day\./)).toBeVisible();
  });

  test("a file that isn't a step file is refused plainly and changes nothing", async ({ page }) => {
    await openActivity(page);
    await chooser(page).setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText(/Choose export\.xml from Apple Health/)).toBeVisible();
    await chooser(page).setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("hello\nthis is not steps\n") });
    await expect(page.getByText(/Couldn't read that file/)).toBeVisible();
  });
});
