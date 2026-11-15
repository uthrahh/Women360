import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { ageOn, assertAdultBirthDate } from "@/lib/age";

const app = createApp();
const PASSWORD = "a-long-enough-password";
const email = (label: string) => `age.${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
const yearsAgo = (years: number, days = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("age gate", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("2008-11-15", "2026-11-15")).toBe(18);
    expect(ageOn("2008-11-16", "2026-11-15")).toBe(17);
    expect(() => assertAdultBirthDate("2008-11-15", "2026-11-15")).not.toThrow();
    expect(() => assertAdultBirthDate("2008-11-16", "2026-11-15")).toThrow();
  });

  it("refuses a sign-up under 18, neutrally, and creates no account", async () => {
    const address = email("minor");
    const res = await request(app).post("/api/v1/auth/register").send({ name: "Young Person", email: address, password: PASSWORD, dateOfBirth: yearsAgo(18, 1) });
    expect(res.status).toBe(403);
    expect(res.body.error.message).not.toMatch(/18|age|old/i);
    expect(await prisma.user.count({ where: { email: address } })).toBe(0);
  });

  it("accepts an adult, from the 18th birthday", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ name: "Adult Person", email: email("adult"), password: PASSWORD, dateOfBirth: yearsAgo(18) });
    expect(res.status).toBe(201);
  });

  it("refuses impossible dates", async () => {
    for (const dateOfBirth of ["2099-01-01", "1850-01-01"]) {
      const res = await request(app).post("/api/v1/auth/register").send({ name: "Odd Date", email: email("odd"), password: PASSWORD, dateOfBirth });
      expect(res.status).toBe(400);
    }
  });

  it("onboarding can't be finished without an adult date of birth, and a minor's date is refused", async () => {
    const reg = await request(app).post("/api/v1/auth/register").send({ name: "No Date", email: email("nodate"), password: PASSWORD });
    const auth = { Authorization: `Bearer ${reg.body.data.accessToken}` };
    expect((await request(app).post("/api/v1/auth/onboarding/complete").set(auth)).status).toBe(400);
    expect((await request(app).patch("/api/v1/users/me").set(auth).send({ dateOfBirth: yearsAgo(12) })).status).toBe(403);
    expect((await request(app).post("/api/v1/auth/onboarding/complete").set(auth)).status).toBe(400);
    expect((await request(app).patch("/api/v1/users/me").set(auth).send({ dateOfBirth: yearsAgo(40) })).status).toBe(200);
    const done = await request(app).post("/api/v1/auth/onboarding/complete").set(auth);
    expect(done.status).toBe(200);
    expect(done.body.data.onboarded).toBe(true);
  });
});
