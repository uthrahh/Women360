import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { purgeOldIdempotencyKeys } from "@/middleware/idempotency";

const app = createApp();
let ip = 10;
const freshIp = () => `198.18.0.${ip++}`;

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", freshIp()).send({
    name: "Idem Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "a-long-enough-password",
  });
  expect(res.status).toBe(201);
  return { id: res.body.data.user.id as string, token: res.body.data.accessToken as string };
}
const post = (token: string, body: object, key?: string) => {
  const r = request(app).post("/api/v1/habits").set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", freshIp());
  return (key ? r.set("Idempotency-Key", key) : r).send(body);
};
const habitCount = (userId: string) => prisma.habit.count({ where: { userId } });
const newKey = () => `key_${Math.random().toString(36).slice(2)}${Date.now()}`;

describe("idempotency keys", () => {
  it("answers a repeat with the first answer and creates nothing the second time", async () => {
    const { id, token } = await signUp("idem-repeat");
    const key = newKey();
    const first = await post(token, { title: "Walk" }, key);
    const second = await post(token, { title: "Walk" }, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    expect(await habitCount(id)).toBe(1);
  });

  it("treats a different key as a different request", async () => {
    const { id, token } = await signUp("idem-two");
    await post(token, { title: "Walk" }, newKey());
    await post(token, { title: "Walk" }, newKey());
    expect(await habitCount(id)).toBe(2);
  });

  it("changes nothing for a request with no key", async () => {
    const { id, token } = await signUp("idem-none");
    await post(token, { title: "Walk" });
    await post(token, { title: "Walk" });
    expect(await habitCount(id)).toBe(2);
  });

  it("refuses a key reused for a different request", async () => {
    const { id, token } = await signUp("idem-reuse");
    const key = newKey();
    expect((await post(token, { title: "Walk" }, key)).status).toBe(201);
    const other = await post(token, { title: "Stretch" }, key);
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await habitCount(id)).toBe(1);
  });

  it("runs two simultaneous requests with one key only once", async () => {
    const { id, token } = await signUp("idem-race");
    const key = newKey();
    const [a, b] = await Promise.all([post(token, { title: "Walk" }, key), post(token, { title: "Walk" }, key)]);
    expect([a.status, b.status].sort()).toSatisfy((s: number[]) => (s[0] === 201 && (s[1] === 201 || s[1] === 409)));
    expect(await habitCount(id)).toBe(1);
  });

  it("does not remember a failure, so correcting the request and retrying works", async () => {
    const { id, token } = await signUp("idem-fail");
    const key = newKey();
    expect((await post(token, { title: "" }, key)).status).toBe(422);
    const retry = await post(token, { title: "" }, key); // the same bad request is simply refused again, not replayed from storage
    expect(retry.status).toBe(422);
    expect(retry.headers["idempotent-replayed"]).toBeUndefined();
    expect(await habitCount(id)).toBe(0);
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(0);
  });

  it("keeps each person's keys separate", async () => {
    const a = await signUp("idem-a");
    const b = await signUp("idem-b");
    const key = newKey();
    const first = await post(a.token, { title: "Walk" }, key);
    const second = await post(b.token, { title: "Walk" }, key);
    expect(second.body.data.id).not.toBe(first.body.data.id);
    expect(await habitCount(a.id)).toBe(1);
    expect(await habitCount(b.id)).toBe(1);
  });

  it("does not let a key stand in for signing in", async () => {
    const { token } = await signUp("idem-auth");
    const key = newKey();
    await post(token, { title: "Walk" }, key);
    const res = await request(app).post("/api/v1/habits").set("Idempotency-Key", key).send({ title: "Walk" });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed key", async () => {
    const { token } = await signUp("idem-bad");
    expect((await post(token, { title: "Walk" }, "short")).status).toBe(422);
    expect((await post(token, { title: "Walk" }, "has spaces and !!! in it")).status).toBe(422);
  });

  it("is deleted with the account", async () => {
    const { id, token } = await signUp("idem-delete");
    await post(token, { title: "Walk" }, newKey());
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(1);
    await prisma.user.delete({ where: { id } });
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(0);
  });

  it("forgets keys after a day", async () => {
    const { id, token } = await signUp("idem-old");
    await post(token, { title: "Walk" }, newKey());
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(1);
    await prisma.idempotencyKey.updateMany({ where: { userId: id }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    expect(await purgeOldIdempotencyKeys()).toBeGreaterThanOrEqual(1);
    expect(await prisma.idempotencyKey.count({ where: { userId: id } })).toBe(0);
  });
});
