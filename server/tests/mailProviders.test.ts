import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// The mail settings are read when the config loads, so each test sets them first and loads the code fresh.
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const mailer = await import("@/lib/mailer");
  const alerts = await import("@/lib/alerts");
  return { ...mailer, ...alerts };
}

const MESSAGE = { to: "someone@example.com", subject: "Reset your Women360 password", text: "link", html: "<p>link</p>" };
const clear = { BREVO_API_KEY: undefined, SMTP_URL: undefined, MAIL_FROM: undefined };

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  for (const k of Object.keys(clear)) delete process.env[k];
  vi.unstubAllGlobals();
});

describe("how mail leaves", () => {
  it("parses a sender with and without a name", async () => {
    const { parseSender } = await load(clear);
    expect(parseSender('Women360 <admin.women360@gmail.com>')).toEqual({ name: "Women360", email: "admin.women360@gmail.com" });
    expect(parseSender('"Team W" <a@b.co>')).toEqual({ name: "Team W", email: "a@b.co" });
    expect(parseSender("a@b.co")).toEqual({ name: "Women360", email: "a@b.co" });
  });

  it("picks the HTTPS provider over SMTP, and reports none when nothing is set", async () => {
    expect((await load({ ...clear, BREVO_API_KEY: "k", SMTP_URL: "smtp://x" })).mailTransport()).toBe("brevo");
    expect((await load({ ...clear, SMTP_URL: "smtp://x" })).mailTransport()).toBe("smtp");
    expect((await load(clear)).mailTransport()).toBe("none");
  });

  it("sends through the HTTPS provider from the support address by default, with the key in a header and nothing personal in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await load({ ...clear, BREVO_API_KEY: "test-key" });
    expect(await sendEmail(MESSAGE)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: "Women360", email: "admin.women360@gmail.com" });
    expect(body.to).toEqual([{ email: "someone@example.com" }]);
    expect(String(url)).not.toContain("someone");
  });

  it("uses MAIL_FROM when it is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await load({ ...clear, BREVO_API_KEY: "k", MAIL_FROM: "Women360 Help <help@example.com>" });
    await sendEmail(MESSAGE);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sender).toEqual({ name: "Women360 Help", email: "help@example.com" });
  });

  it("returns false and never throws when the provider refuses, network fails, or it times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 })));
    const refused = await load({ ...clear, BREVO_API_KEY: "bad" });
    expect(await refused.sendEmail(MESSAGE)).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const down = await load({ ...clear, BREVO_API_KEY: "k" });
    expect(await down.sendEmail(MESSAGE)).toBe(false);
  });
});

describe("alerts to the person who runs the service", () => {
  it("emails the support address with what failed but nothing personal, and limits repeats", async () => {
    const { alertAdmin, outbox, resetAlerts } = await load(clear);
    resetAlerts();
    outbox.length = 0;
    expect(await alertAdmin("a", "Server error 500 on GET /api/v1/x", { what: "boom", requestId: "req-1" })).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("admin.women360@gmail.com");
    expect(outbox[0].subject).toBe("[Women360] Server error 500 on GET /api/v1/x");
    expect(outbox[0].text).toMatch(/what: boom/);
    expect(outbox[0].text).toMatch(/requestId: req-1/);
    // The same problem again straight away is not sent twice; a different one is.
    expect(await alertAdmin("a", "again", {})).toBe(false);
    expect(await alertAdmin("b", "different", {})).toBe(true);
  });

  it("caps the number of alerts in a day so a broken thing can't flood the inbox", async () => {
    const { alertAdmin, outbox, resetAlerts } = await load(clear);
    resetAlerts();
    outbox.length = 0;
    let sent = 0;
    for (let i = 0; i < 40; i++) if (await alertAdmin(`sig-${i}`, "x", {})) sent += 1;
    expect(sent).toBe(20);
  });

  it("is sent when a request fails with a server error, and not for ordinary client errors", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "test";
    const { createApp } = await import("@/app");
    const { outbox } = await import("@/lib/mailer");
    const { resetAlerts } = await import("@/lib/alerts");
    resetAlerts();
    outbox.length = 0;
    const app = createApp();
    expect((await request(app).get("/api/v1/does-not-exist")).status).toBe(404);
    expect((await request(app).post("/api/v1/auth/login").send({ email: "nope" })).status).toBe(422);
    await new Promise((r) => setTimeout(r, 50));
    expect(outbox.filter((m) => m.subject.startsWith("[Women360]"))).toHaveLength(0);
  });
});
