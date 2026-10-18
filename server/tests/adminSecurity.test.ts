import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { ipKey } from "@/lib/security/throttle";
import { codeForStep, stepFor } from "@/lib/security/totp";

const app = createApp();
const PASSWORD = "a-long-enough-password";
let ipCounter = 150;
const freshIp = () => `192.0.2.${ipCounter++}`;

async function register(label: string, role?: "ADMIN" | "COACH") {
  const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", freshIp()).send({ name: "Admin Tester", email, password: PASSWORD });
  expect(res.status).toBe(201);
  const id = res.body.data.user.id as string;
  if (role) await prisma.user.update({ where: { id }, data: { role } });
  return { id, token: res.body.data.accessToken as string };
}
const as = (token: string, ip = freshIp()) => ({ Authorization: `Bearer ${token}`, "X-Forwarded-For": ip });

describe("admins can't be changed through the API", () => {
  it("can't be demoted, deactivated, or created by another admin", async () => {
    const actor = await register("adm-actor", "ADMIN");
    const otherAdmin = await register("adm-other", "ADMIN");
    const woman = await register("adm-woman");

    const demote = await request(app).patch(`/api/v1/admin/users/${otherAdmin.id}/role`).set(as(actor.token)).send({ role: "WOMAN" });
    expect(demote.status).toBe(403);

    const deactivate = await request(app).delete(`/api/v1/admin/users/${otherAdmin.id}`).set(as(actor.token));
    expect(deactivate.status).toBe(403);

    const promote = await request(app).patch(`/api/v1/admin/users/${woman.id}/role`).set(as(actor.token)).send({ role: "ADMIN" });
    expect(promote.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: woman.id } })).role).toBe("WOMAN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: otherAdmin.id } })).deletedAt).toBeNull();
  });

  it("still lets an admin manage non-admin accounts", async () => {
    const actor = await register("adm-actor2", "ADMIN");
    const woman = await register("adm-woman2");
    const res = await request(app).patch(`/api/v1/admin/users/${woman.id}/role`).set(as(actor.token)).send({ role: "COACH" });
    expect(res.status).toBe(200);
  });
});

describe("optional admin IP allow-list", () => {
  const original = [...env.adminIpAllowlist];
  afterEach(() => {
    (env as { adminIpAllowlist: string[] }).adminIpAllowlist = original;
  });

  it("answers 404 to anyone else — it doesn't even confirm the admin area exists — and logs it", async () => {
    const admin = await register("adm-ip", "ADMIN");
    (env as { adminIpAllowlist: string[] }).adminIpAllowlist = ["198.18.0.1"];

    const blocked = await request(app).get("/api/v1/admin/users").set(as(admin.token, "198.18.0.99"));
    expect(blocked.status).toBe(404);

    const allowed = await request(app).get("/api/v1/admin/users").set(as(admin.token, "198.18.0.1"));
    expect(allowed.status).toBe(200);

    const event = await prisma.auditLog.findFirst({ where: { action: "security.admin_access_denied" }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(event?.metadata)).toContain("198.18.0.x");
  });

  it("blocks even an unauthenticated request before it reaches authentication", async () => {
    (env as { adminIpAllowlist: string[] }).adminIpAllowlist = ["198.18.0.1"];
    const res = await request(app).get("/api/v1/admin/users").set("X-Forwarded-For", "198.18.0.99");
    expect(res.status).toBe(404); // not 401
  });
});

describe("two-factor is required for admins in production", () => {
  const originalProd = env.isProduction;
  afterEach(() => {
    (env as { isProduction: boolean }).isProduction = originalProd;
  });

  it("locks admin tools until the admin has turned on two-factor, then lets them in", async () => {
    const admin = await register("adm-2fa", "ADMIN");
    const ip = freshIp();
    await prisma.authThrottle.deleteMany({ where: { key: ipKey(ip) } });
    (env as { isProduction: boolean }).isProduction = true;

    const before = await request(app).get("/api/v1/admin/users").set(as(admin.token, ip));
    expect(before.status).toBe(403);
    expect(before.body.error.code).toBe("TWO_FACTOR_REQUIRED");

    // Enrolment goes through the ordinary /auth/2fa endpoints, which aren't admin-only.
    const setup = await request(app).post("/api/v1/auth/2fa/setup").set(as(admin.token, ip));
    expect(setup.status).toBe(200);
    const confirm = await request(app)
      .post("/api/v1/auth/2fa/confirm")
      .set(as(admin.token, ip))
      .send({ code: codeForStep(setup.body.data.secret, stepFor(Date.now())) });
    expect(confirm.status).toBe(200);

    const after = await request(app).get("/api/v1/admin/users").set(as(admin.token, ip));
    expect(after.status).toBe(200);
  });

  it("doesn't apply outside production", async () => {
    const admin = await register("adm-dev", "ADMIN");
    (env as { isProduction: boolean }).isProduction = false;
    expect((await request(app).get("/api/v1/admin/users").set(as(admin.token))).status).toBe(200);
  });
});
