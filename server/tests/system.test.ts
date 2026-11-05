import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const TOKEN = "test-backup-report-token-0123456789abcdef";
let ip = 10;
const freshIp = () => `192.0.2.${ip++}`;

async function register(label: string, role?: "ADMIN") {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", freshIp()).send({
    name: "System Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  if (role) await prisma.user.update({ where: { id: res.body.data.user.id }, data: { role } });
  return res.body.data.accessToken as string;
}
const as = (token: string) => ({ Authorization: `Bearer ${token}`, "X-Forwarded-For": freshIp() });
const report = (body: object, auth: string | null = `Bearer ${TOKEN}`) => {
  const r = request(app).post("/api/v1/internal/backup-report").set("X-Forwarded-For", freshIp());
  return (auth ? r.set("Authorization", auth) : r).send(body);
};

describe("administrator system status", () => {
  it("shows what the server knows about itself, and no secrets", async () => {
    const admin = await register("sys-admin", "ADMIN");
    const res = await request(app).get("/api/v1/admin/system").set(as(admin));
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.database.ok).toBe(true);
    expect(typeof s.email.configured).toBe("boolean");
    expect(s.reminders.configured).toBe(true);
    expect(s.clinicalContent).toBe(true);
    expect(new Date(s.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    const text = JSON.stringify(res.body);
    for (const secret of [process.env.VAPID_PRIVATE_KEY, process.env.JWT_ACCESS_SECRET, process.env.JWT_REFRESH_SECRET, process.env.DATABASE_URL, TOKEN]) {
      expect(text).not.toContain(secret as string);
    }
  });

  it("is for administrators only", async () => {
    const woman = await register("sys-woman");
    expect((await request(app).get("/api/v1/admin/system").set(as(woman))).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/system")).status).toBe(401);
  });
});

describe("backup report from the nightly job", () => {
  it("is shown as the last verified restore", async () => {
    const admin = await register("sys-backup", "ADMIN");
    expect((await report({ tables: 42, rows: 24681 })).status).toBe(204);
    const s = (await request(app).get("/api/v1/admin/system").set(as(admin))).body.data;
    expect(s.backup).toMatchObject({ tables: 42, rows: 24681, reporting: true });
    expect(Date.now() - new Date(s.backup.lastVerifiedRestoreAt).getTime()).toBeLessThan(60_000);
  });

  it("refuses a missing or wrong token", async () => {
    expect((await report({ tables: 1, rows: 1 }, null)).status).toBe(401);
    expect((await report({ tables: 1, rows: 1 }, "Bearer wrong")).status).toBe(401);
    expect((await report({ tables: 1, rows: 1 }, `Bearer ${TOKEN}x`)).status).toBe(401);
    expect((await report({ tables: 1, rows: 1 }, TOKEN)).status).toBe(401);
  });

  it("refuses nonsense numbers and keeps only the newest sixty reports", async () => {
    expect((await report({ tables: 0, rows: 1 })).status).toBe(422);
    expect((await report({ tables: "many", rows: 1 })).status).toBe(422);
    for (let i = 0; i < 62; i++) await report({ tables: 3, rows: i });
    expect(await prisma.backupReport.count()).toBeLessThanOrEqual(60);
  });
});
