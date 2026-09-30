import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();

async function registerUser(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: label,
    email: `${label.toLowerCase().replace(/\s+/g, "-")}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
    password: "a-long-enough-password",
  });
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}

// There's no API to create a coach or admin account (registration always
// creates a Woman) — tests promote a normally-registered user directly via
// Prisma, the same bypass the demo seed script uses.
async function promote(userId: string, role: "COACH" | "ADMIN") {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

let woman: { token: string; id: string };
let coach: { token: string; id: string };
let admin: { token: string; id: string };

beforeAll(async () => {
  woman = await registerUser("Coach Test Woman");
  coach = await registerUser("Coach Test Coach");
  admin = await registerUser("Coach Test Admin");
  await promote(coach.id, "COACH");
  await promote(admin.id, "ADMIN");
});

describe("coach access control", () => {
  it("403s a coach summary request with no active grant", async () => {
    const res = await request(app)
      .get(`/api/v1/coach/women/${woman.id}/summary`)
      .set("Authorization", `Bearer ${coach.token}`);
    expect(res.status).toBe(403);
  });

  it("403s a Woman calling a coach-only route", async () => {
    const res = await request(app)
      .get("/api/v1/coach/assigned-women")
      .set("Authorization", `Bearer ${woman.token}`);
    expect(res.status).toBe(403);
  });

  it("403s a Coach calling a woman-only sharing route", async () => {
    const res = await request(app)
      .get("/api/v1/coach/sharing")
      .set("Authorization", `Bearer ${coach.token}`);
    expect(res.status).toBe(403);
  });

  it("grants access, lets the coach view a least-privilege summary, then revoke removes it again", async () => {
    const grant = await request(app)
      .post("/api/v1/coach/sharing")
      .set("Authorization", `Bearer ${woman.token}`)
      .send({ coachEmail: (await prisma.user.findUniqueOrThrow({ where: { id: coach.id } })).email });
    expect(grant.status).toBe(201);

    const summary = await request(app)
      .get(`/api/v1/coach/women/${woman.id}/summary`)
      .set("Authorization", `Bearer ${coach.token}`);
    expect(summary.status).toBe(200);
    // Least privilege: health profile and medications are never queried
    // into this response at all, not just hidden by the frontend.
    expect(summary.body.data).not.toHaveProperty("healthProfile");
    expect(summary.body.data).not.toHaveProperty("medications");
    expect(summary.body.data).toHaveProperty("goals");
    expect(summary.body.data).toHaveProperty("wellbeing");
    expect(summary.body.data).toHaveProperty("sleep");
    expect(summary.body.data).toHaveProperty("activity");

    const revoke = await request(app)
      .delete("/api/v1/coach/sharing")
      .set("Authorization", `Bearer ${woman.token}`)
      .send({ coachId: coach.id });
    expect(revoke.status).toBe(200);

    const afterRevoke = await request(app)
      .get(`/api/v1/coach/women/${woman.id}/summary`)
      .set("Authorization", `Bearer ${coach.token}`);
    expect(afterRevoke.status).toBe(403);
  });

  it("keeps a private note hidden from the woman, and shows a visible one", async () => {
    await request(app)
      .post("/api/v1/coach/sharing")
      .set("Authorization", `Bearer ${woman.token}`)
      .send({ coachEmail: (await prisma.user.findUniqueOrThrow({ where: { id: coach.id } })).email });

    await request(app)
      .post(`/api/v1/coach/women/${woman.id}/notes`)
      .set("Authorization", `Bearer ${coach.token}`)
      .send({ note: "Private note the woman should never see", visibleToWoman: false });

    await request(app)
      .post(`/api/v1/coach/women/${woman.id}/notes`)
      .set("Authorization", `Bearer ${coach.token}`)
      .send({ note: "Visible note she should see", visibleToWoman: true });

    const visibleToWoman = await request(app)
      .get("/api/v1/coach/sharing/notes")
      .set("Authorization", `Bearer ${woman.token}`);
    const texts = (visibleToWoman.body.data as { note: string }[]).map((n) => n.note);
    expect(texts).toContain("Visible note she should see");
    expect(texts).not.toContain("Private note the woman should never see");
  });

  it("deactivates a coach's assignments when an admin demotes them, so re-promotion doesn't silently restore access", async () => {
    const other = await registerUser("Coach Test Demotion Woman");
    const otherCoach = await registerUser("Coach Test Demotion Coach");
    await promote(otherCoach.id, "COACH");

    await request(app)
      .post("/api/v1/coach/sharing")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ coachEmail: (await prisma.user.findUniqueOrThrow({ where: { id: otherCoach.id } })).email });

    const summaryBefore = await request(app)
      .get(`/api/v1/coach/women/${other.id}/summary`)
      .set("Authorization", `Bearer ${otherCoach.token}`);
    expect(summaryBefore.status).toBe(200);

    const demote = await request(app)
      .patch(`/api/v1/admin/users/${otherCoach.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "WOMAN" });
    expect(demote.status).toBe(200);

    await promote(otherCoach.id, "COACH");

    const summaryAfterRepromotion = await request(app)
      .get(`/api/v1/coach/women/${other.id}/summary`)
      .set("Authorization", `Bearer ${otherCoach.token}`);
    expect(summaryAfterRepromotion.status).toBe(403);
  });
});
