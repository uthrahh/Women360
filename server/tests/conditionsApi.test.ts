import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";

const app = createApp();
const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
const today = () => daysAgo(0);

let ip = 160;
async function signUp(label: string, extra: object = {}) {
  const res = await request(app).post("/api/v1/auth/register").set("X-Forwarded-For", `192.0.2.${ip++}`).send({
    name: "Signal Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "a-long-enough-password",
    ...extra,
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const signals = (t: string) => request(app).get(`/api/v1/conditions/signals?today=${today()}`).set(auth(t));
/** Period starts this many days ago, oldest first, each logged with its first day only. */
async function logStarts(token: string, starts: number[]) {
  for (const d of starts) {
    const res = await request(app).put(`/api/v1/cycle/entries/${daysAgo(d)}`).set(auth(token)).send({ isPeriod: true, flow: "MEDIUM" });
    expect(res.status).toBe(200);
  }
}
describe("conditions she tells us about", () => {
  it("needs sign-in", async () => {
    expect((await request(app).get("/api/v1/conditions")).status).toBe(401);
    expect((await request(app).get(`/api/v1/conditions/signals?today=${today()}`)).status).toBe(401);
  });

  it("lists every condition with its sources, none chosen at first, and says it is draft", async () => {
    const { token } = await signUp("cond-list");
    const res = await request(app).get("/api/v1/conditions").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.review.reviewed).toBe(false);
    const codes = res.body.data.conditions.map((c: { code: string }) => c.code);
    expect(codes).toEqual(["PCOS", "ENDOMETRIOSIS", "THYROID", "PMDD", "PERIMENOPAUSE", "ANAEMIA"]);
    expect(res.body.data.conditions.every((c: { declared: boolean }) => c.declared === false)).toBe(true);
    expect(res.body.data.conditions.find((c: { code: string }) => c.code === "PCOS").sources.length).toBeGreaterThan(0);
  });

  it("saves the set she chooses, replaces it on the next save, and validates", async () => {
    const { token, id } = await signUp("cond-set");
    const put = (conditions: unknown) => request(app).put("/api/v1/conditions").set(auth(token)).send({ conditions });
    const first = await put(["PCOS", "THYROID", "PCOS"]);
    expect(first.status).toBe(200);
    expect(first.body.data.conditions.filter((c: { declared: boolean }) => c.declared).map((c: { code: string }) => c.code)).toEqual(["PCOS", "THYROID"]);
    const second = await put(["PMDD"]);
    expect(second.body.data.conditions.filter((c: { declared: boolean }) => c.declared).map((c: { code: string }) => c.code)).toEqual(["PMDD"]);
    expect(await prisma.userCondition.count({ where: { userId: id } })).toBe(1);
    expect((await put(["NOT_REAL"])).status).toBe(422);
    expect((await put([])).status).toBe(200);
    expect(await prisma.userCondition.count({ where: { userId: id } })).toBe(0);
  });

  it("keeps one woman's conditions from another's", async () => {
    const a = await signUp("cond-a");
    const b = await signUp("cond-b");
    await request(app).put("/api/v1/conditions").set(auth(a.token)).send({ conditions: ["PCOS"] });
    const res = await request(app).get("/api/v1/conditions").set(auth(b.token));
    expect(res.body.data.conditions.every((c: { declared: boolean }) => !c.declared)).toBe(true);
  });
});

describe("patterns worth discussing with a doctor", () => {
  it("shows nothing for someone with no logged cycles", async () => {
    const { token } = await signUp("sig-empty");
    const res = await signals(token);
    expect(res.status).toBe(200);
    expect(res.body.data.signals).toEqual([]);
    expect(res.body.data.review.reviewed).toBe(false);
  });

  it("names the pattern with her own numbers and a source, and tells her once in the app", async () => {
    const { token, id } = await signUp("sig-irregular");
    await logStarts(token, [216, 175, 123, 85, 40]);
    const first = await signals(token);
    expect(first.status).toBe(200);
    const signal = first.body.data.signals.find((s: { key: string }) => s.key === "IRREGULAR_CYCLES");
    expect(signal).toBeDefined();
    expect(signal.evidence[0]).toBe("Your last 4 cycles were 41, 52, 38, 45 days long.");
    expect(signal.sources.length).toBeGreaterThan(0);
    expect(signal.nextStep).toMatch(/doctor/);

    // Asking again shows the same card but does not send another notification.
    await signals(token);
    await signals(token);
    const notes = await prisma.notification.findMany({ where: { userId: id, title: "A pattern worth discussing with a doctor" } });
    expect(notes).toHaveLength(1);
    expect(notes[0].detail).toMatch(/Cycle page/);
    expect(notes[0].detail).not.toMatch(/PCOS|diagnos/i);
  });

  it("lets her set it aside, and it stays away", async () => {
    const { token, id } = await signUp("sig-dismiss");
    await logStarts(token, [216, 175, 123, 85, 40]);
    expect((await signals(token)).body.data.signals.map((s: { key: string }) => s.key)).toContain("IRREGULAR_CYCLES");
    expect((await request(app).post("/api/v1/conditions/signals/IRREGULAR_CYCLES/dismiss").set(auth(token))).status).toBe(204);
    expect((await signals(token)).body.data.signals.map((s: { key: string }) => s.key)).not.toContain("IRREGULAR_CYCLES");
    // And it does not notify her again for what she has already set aside.
    expect(await prisma.notification.count({ where: { userId: id, title: "A pattern worth discussing with a doctor" } })).toBe(1);
    expect((await request(app).post("/api/v1/conditions/signals/NOT_A_SIGNAL/dismiss").set(auth(token))).status).toBe(422);
  });

  it("stays quiet about PCOS-type cycles once she has told us she has PCOS", async () => {
    const { token } = await signUp("sig-declared");
    await logStarts(token, [216, 175, 123, 85, 40]);
    await request(app).put("/api/v1/conditions").set(auth(token)).send({ conditions: ["PCOS"] });
    expect((await signals(token)).body.data.signals.map((s: { key: string }) => s.key)).not.toContain("IRREGULAR_CYCLES");
  });

  it("stays quiet during pregnancy", async () => {
    const { token } = await signUp("sig-pregnant");
    await logStarts(token, [216, 175, 123, 85, 40]);
    await request(app).put("/api/v1/users/me/reproductive-health").set(auth(token)).send({ pregnancyStatus: "PREGNANT" });
    expect((await signals(token)).body.data.signals).toEqual([]);
  });

  it("counts pain logged on symptom-only days inside a period she only marked on its first day", async () => {
    const { token } = await signUp("sig-pain");
    // Four periods, each marked only on its first day; strong pain logged two days in, as a symptom day.
    const starts = [112, 84, 56, 28];
    await logStarts(token, starts);
    for (const s of starts) {
      expect((await request(app).put(`/api/v1/cycle/entries/${daysAgo(s - 2)}`).set(auth(token)).send({ isPeriod: false, pain: 4 })).status).toBe(200);
    }
    const signal = (await signals(token)).body.data.signals.find((s: { key: string }) => s.key === "PAINFUL_PERIODS");
    expect(signal).toBeDefined();
    expect(signal.evidence[0]).toMatch(/4 of your last 4/);
  });

  it("is only for the signed-in woman's own data, and is in her export", async () => {
    const a = await signUp("sig-own-a");
    const b = await signUp("sig-own-b");
    await logStarts(a.token, [216, 175, 123, 85, 40]);
    await signals(a.token);
    expect((await signals(b.token)).body.data.signals).toEqual([]);
    await request(app).put("/api/v1/conditions").set(auth(a.token)).send({ conditions: ["PMDD"] });
    const exported = await request(app).get("/api/v1/users/me/export").set(auth(a.token));
    expect(exported.body.data.conditions).toHaveLength(1);
    expect(exported.body.data.healthSignals.length).toBeGreaterThan(0);
    // Deleting her removes both.
    await prisma.user.delete({ where: { id: a.id } });
    expect(await prisma.userCondition.count({ where: { userId: a.id } })).toBe(0);
    expect(await prisma.healthSignalState.count({ where: { userId: a.id } })).toBe(0);
  });
});
