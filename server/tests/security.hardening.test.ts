import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

// Standing rules from the launch standard that the API itself must keep: security headers, no framework banner,
// CORS only for the web app's own origins, no stack traces or internals in errors, and separate liveness/readiness probes.
const app = createApp();

describe("security headers", () => {
  it("are sent, and the framework is not announced", async () => {
    const res = await request(app).get("/livez");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
  });

  it("sets no cookies (sign-in uses bearer tokens, so there is nothing for a cross-site request to ride on)", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ name: "Cookie Check", email: `cookie.${Date.now()}@example.com`, password: "a-long-enough-password" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("does not grant an unknown website access", async () => {
    const res = await request(app).get("/api/v1/config").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("errors", () => {
  it("unknown routes answer a plain 404 with no internals", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|\\src\\|\/src\//);
  });

  it("malformed JSON is a 400 without a stack trace", async () => {
    const res = await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|SyntaxError: Unexpected/);
  });

  it("a request body over the limit is refused", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@b.c", password: "x".repeat(1_100_000) });
    expect(res.status).toBe(413);
  });
});

describe("probes", () => {
  it("liveness answers without touching the database; readiness checks it", async () => {
    expect((await request(app).get("/livez")).body.data).toEqual({ status: "alive" });
    const ready = await request(app).get("/health");
    expect(ready.status).toBe(200);
    expect(ready.body.data).toEqual({ status: "healthy" });
  });
});

describe("a broken request never alerts the administrator", () => {
  it("malformed JSON sends no alert email", async () => {
    const { outbox } = await import("@/lib/mailer");
    outbox.length = 0;
    await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{oops");
    await new Promise((r) => setTimeout(r, 50));
    expect(outbox.filter((m) => /error|crash/i.test(m.subject))).toHaveLength(0);
  });
});
