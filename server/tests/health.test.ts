import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { outbox } from "@/lib/mailer";
import { resetAlerts } from "@/lib/alerts";

const app = createApp();
afterEach(() => vi.restoreAllMocks());

describe("health check", () => {
  it("says healthy when the API and its database answer, readable from another origin", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { status: "healthy" } });
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("is a 503 when the database does not answer, and tells the person who runs the service, once", async () => {
    resetAlerts();
    outbox.length = 0;
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(new Error("connection refused"));
    const first = await request(app).get("/health");
    expect(first.status).toBe(503);
    expect(first.body).toEqual({ ok: false, data: { status: "unhealthy" } });
    await request(app).get("/health");
    await new Promise((r) => setTimeout(r, 50));
    const alerts = outbox.filter((m) => /database is not answering/.test(m.subject));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toMatch(/connection refused/);
  });

  it("reveals nothing about the system beyond up or down", async () => {
    const res = await request(app).get("/health");
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|supabase|version|uptime|memory/i);
  });
});
