import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { marketingProblem, outbox, sendEmail, type Email } from "@/lib/mailer";

// Women360 sends no marketing email today. This locks in that one can never be sent without an unsubscribe link and the
// sender's postal address in the message itself, while transactional email (confirmations, resets, alerts) is unaffected.
const base: Email = { to: "someone@example.com", subject: "News", text: "Hello", html: "<p>Hello</p>" };
const original = env.MAIL_POSTAL_ADDRESS;
afterEach(() => {
  (env as { MAIL_POSTAL_ADDRESS?: string }).MAIL_POSTAL_ADDRESS = original;
  outbox.length = 0;
});

describe("marketing email", () => {
  it("transactional email needs neither", async () => {
    expect(marketingProblem(base)).toBeNull();
    expect(await sendEmail(base)).toBe(true);
  });

  it("is refused without an unsubscribe link or a postal address", async () => {
    (env as { MAIL_POSTAL_ADDRESS?: string }).MAIL_POSTAL_ADDRESS = undefined;
    expect(marketingProblem({ ...base, category: "marketing" })).toMatch(/unsubscribe/);
    expect(marketingProblem({ ...base, category: "marketing", unsubscribeUrl: "https://example.com/u/1" })).toMatch(/postal address/);
    expect(await sendEmail({ ...base, category: "marketing", unsubscribeUrl: "https://example.com/u/1" })).toBe(false);
    expect(outbox).toHaveLength(0);
  });

  it("is refused when the link and address aren't in the message itself, and sent when they are", async () => {
    (env as { MAIL_POSTAL_ADDRESS?: string }).MAIL_POSTAL_ADDRESS = "1 Example Street, Chennai 600001";
    const url = "https://example.com/u/abc";
    expect(marketingProblem({ ...base, category: "marketing", unsubscribeUrl: url })).toMatch(/must appear/);
    const ok = { ...base, category: "marketing" as const, unsubscribeUrl: url, text: `Hello\nUnsubscribe: ${url}\n1 Example Street, Chennai 600001` };
    expect(marketingProblem(ok)).toBeNull();
    expect(await sendEmail(ok)).toBe(true);
  });
});
