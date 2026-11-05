import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { outbox } from "@/lib/mailer";
import { resetAlerts } from "@/lib/alerts";

const app = createApp();
const post = (body: unknown, ip = "203.0.113.50") => request(app).post("/api/v1/client-errors").set("X-Forwarded-For", ip).send(body as object);

beforeEach(() => {
  resetAlerts();
  outbox.length = 0;
});

describe("crash reports from the browser", () => {
  it("accepts a short technical report without signing in, and tells the person who runs the service, once", async () => {
    const body = { kind: "render", message: "Cannot read properties of undefined (reading 'map')", route: "/app/goals/:id" };
    expect((await post(body)).status).toBe(204);
    expect((await post(body)).status).toBe(204);
    await new Promise((r) => setTimeout(r, 50));
    const alerts = outbox.filter((m) => /crashed in someone's browser/.test(m.subject));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toMatch(/\/app\/goals\/:id/);
    expect(alerts[0].text).toMatch(/Cannot read properties/);
  });

  it("rejects anything that isn't a short message and a screen path", async () => {
    expect((await post({ kind: "render", message: "x".repeat(201), route: "/app" })).status).toBe(422);
    expect((await post({ kind: "other", message: "x", route: "/app" })).status).toBe(422);
    expect((await post({ kind: "render", message: "x", route: "https://evil.example/?email=a@b.c" })).status).toBe(422);
    expect((await post({ kind: "render", message: "x", route: "/app?email=a@b.co" })).status).toBe(422);
    expect((await post({ kind: "render", message: "", route: "/app" })).status).toBe(422);
  });

  it("is limited per address and answers quietly when the limit is passed", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) statuses.push((await post({ kind: "unhandled", message: `m${i}`, route: "/app" }, "203.0.113.77")).status);
    expect(statuses.every((s) => s === 204)).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(outbox.length).toBeLessThanOrEqual(10); // at most the first ten got through to the inbox logic, and the daily cap still applies
  });
});
