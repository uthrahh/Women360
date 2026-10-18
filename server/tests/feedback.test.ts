import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();
const PASSWORD = "a-long-enough-password";

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Feedback Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("feedback", () => {
  it("requires sign-in", async () => {
    const res = await request(app).post("/api/v1/feedback").send({ rating: 4 });
    expect(res.status).toBe(401);
  });

  it("stores a rating with an optional message", async () => {
    const { token, id } = await signUp("fb-ok");
    const res = await request(app).post("/api/v1/feedback").set(auth(token)).send({ rating: 4, message: "  Lovely and calm.  " });
    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(4);
    const row = await prisma.feedback.findFirstOrThrow({ where: { userId: id } });
    expect(row.message).toBe("Lovely and calm.");
  });

  it("accepts a rating on its own and stores no message", async () => {
    const { token, id } = await signUp("fb-rating-only");
    const res = await request(app).post("/api/v1/feedback").set(auth(token)).send({ rating: 5, message: "" });
    expect(res.status).toBe(201);
    expect((await prisma.feedback.findFirstOrThrow({ where: { userId: id } })).message).toBeNull();
  });

  it("rejects out-of-range ratings and oversized messages", async () => {
    const { token } = await signUp("fb-bad");
    const post = (body: object) => request(app).post("/api/v1/feedback").set(auth(token)).send(body);
    expect((await post({ rating: 0 })).status).toBe(422);
    expect((await post({ rating: 6 })).status).toBe(422);
    expect((await post({ rating: 3.5 })).status).toBe(422);
    expect((await post({ rating: 3, message: "x".repeat(2001) })).status).toBe(422);
  });

  it("limits how much one account can send in an hour", async () => {
    const { token } = await signUp("fb-limit");
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post("/api/v1/feedback").set(auth(token)).send({ rating: 3 })).status).toBe(201);
    }
    expect((await request(app).post("/api/v1/feedback").set(auth(token)).send({ rating: 3 })).status).toBe(429);
  });

  it("is deleted along with the account", async () => {
    const { token, id } = await signUp("fb-cascade");
    await request(app).post("/api/v1/feedback").set(auth(token)).send({ rating: 2 });
    await prisma.user.delete({ where: { id } });
    expect(await prisma.feedback.count({ where: { userId: id } })).toBe(0);
  });

  it("is not readable by ordinary accounts through the admin route", async () => {
    const { token } = await signUp("fb-not-admin");
    const res = await request(app).get("/api/v1/admin/feedback").set(auth(token));
    expect([403, 404]).toContain(res.status);
  });
});
