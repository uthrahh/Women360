import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/lib/prisma";
import { canSee, canSeeConsultation, visibleSections } from "@/modules/clients/access";
import { bmi, checkSection, waistHip } from "@/modules/clients/intake";

const app = createApp();

async function registerUser(label: string) {
  const email = `${label.toLowerCase().replace(/\s+/g, "-")}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post("/api/v1/auth/register").send({ name: label, email, password: "a-long-enough-password" });
  return { id: res.body.data.user.id as string, email };
}
/** A coach with these specialities, signed in fresh so the token carries the role. */
async function coach(label: string, specialities: ("NUTRITION" | "FITNESS" | "WELLBEING" | "WOMENS_HEALTH" | "GENERAL")[]) {
  const u = await registerUser(label);
  await prisma.user.update({ where: { id: u.id }, data: { role: "COACH", coachSpecialities: specialities } });
  const login = await request(app).post("/api/v1/auth/login").send({ email: u.email, password: "a-long-enough-password" });
  return { id: u.id, token: login.body.data.accessToken as string };
}
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const adultBirth = `${new Date().getUTCFullYear() - 32}-05-10`;

describe("who sees which section (pure)", () => {
  it("cuts the record by speciality; general sees everything", () => {
    expect(visibleSections(["NUTRITION"])).toEqual(["measurements", "lifestyle", "medical", "menstrual", "dietary"]);
    expect(visibleSections(["WELLBEING"])).toEqual(["lifestyle"]);
    expect(visibleSections(["WOMENS_HEALTH"])).toEqual(["medical", "menstrual"]);
    expect(visibleSections(["FITNESS"])).toEqual(["measurements", "lifestyle", "medical"]);
    expect(visibleSections([])).toEqual(visibleSections(["GENERAL"]));
    expect(canSee("dietary", ["FITNESS"])).toBe(false);
    expect(canSeeConsultation("NUTRITION", ["FITNESS"])).toBe(false);
    expect(canSeeConsultation("NUTRITION", ["GENERAL"])).toBe(true);
  });

  it("checks assessment answers and works out BMI and waist-hip ratio as numbers only", () => {
    expect(checkSection("dietary", { foodPreference: "Vegetarian", recall24h: [{ time: "8 am", food: "Idli, sambar" }, { time: "", food: "" }] })).toEqual({
      ok: true,
      answers: { foodPreference: "Vegetarian", recall24h: [{ time: "8 am", food: "Idli, sambar" }] },
    });
    expect(checkSection("dietary", { foodPreference: "Keto" }).ok).toBe(false);
    expect(checkSection("lifestyle", { sleepHours: 30 }).ok).toBe(false);
    expect(checkSection("lifestyle", { bloodGroup: "O+" }).ok).toBe(false);
    expect(bmi(60, 160)).toBe(23.4);
    expect(waistHip(80, 100)).toBe(0.8);
    expect(bmi(null, 160)).toBeNull();
  });
});

describe("coaches' clients", () => {
  let nutrition: Awaited<ReturnType<typeof coach>>;
  let fitness: Awaited<ReturnType<typeof coach>>;
  let outsider: Awaited<ReturnType<typeof coach>>;
  let clientId = "";

  beforeAll(async () => {
    [nutrition, fitness, outsider] = await Promise.all([coach("Nina Nutrition", ["NUTRITION"]), coach("Farah Fitness", ["FITNESS"]), coach("Olga Other", ["GENERAL"])]);
  });

  it("a coach adds a client only with her consent, and from 13 (under 18 with a guardian's agreement)", async () => {
    const noConsent = await request(app).post("/api/v1/coach/clients").set(as(nutrition.token)).send({ name: "Kavitha R", dateOfBirth: adultBirth, tracksCycle: true });
    expect(noConsent.status).toBe(422);
    const teen = `${new Date().getUTCFullYear() - 15}-01-01`;
    expect((await request(app).post("/api/v1/coach/clients").set(as(nutrition.token)).send({ name: "Teen", dateOfBirth: teen, tracksCycle: true, consent: true })).status).toBe(400);
    const res = await request(app).post("/api/v1/coach/clients").set(as(nutrition.token)).send({
      name: "Kavitha R", dateOfBirth: adultBirth, gender: "Woman", phone: "+91 90000 00000", occupation: "Teacher", tracksCycle: true, consent: true,
    });
    expect(res.status).toBe(201);
    clientId = res.body.data.id;
    const list = await request(app).get("/api/v1/coach/clients").set(as(nutrition.token));
    expect(list.body.data[0]).toMatchObject({ id: clientId, name: "Kavitha R", gender: "Woman", usesApp: false });
  });

  it("the assessment is saved section by section; menstrual lengths reach her cycle tracker", async () => {
    const diet = await request(app).put(`/api/v1/coach/clients/${clientId}/intake/dietary`).set(as(nutrition.token)).send({ answers: { foodPreference: "Vegetarian", mealsPerDay: 3 } });
    expect(diet.status).toBe(200);
    await request(app).put(`/api/v1/coach/clients/${clientId}/intake/menstrual`).set(as(nutrition.token)).send({ answers: { cycleLength: 32, periodLength: 6, pcos: "Not sure" } });
    expect(await prisma.cycleProfile.findUnique({ where: { userId: clientId } })).toMatchObject({ averageCycleLength: 32, averagePeriodLength: 6 });
    const m = await request(app).post(`/api/v1/coach/clients/${clientId}/measurements`).set(as(nutrition.token)).send({ date: "2026-11-20", heightCm: 160, weightKg: 64, waistCm: 84, hipCm: 100 });
    expect(m.body.data).toMatchObject({ bmi: 25, waistHipRatio: 0.84 });
    await request(app).post(`/api/v1/coach/clients/${clientId}/consultations`).set(as(nutrition.token)).send({
      area: "NUTRITION", date: "2026-11-20", targetWeightKg: 60, planGiven: "More protein at breakfast", nextFollowUp: "2026-12-04", notes: "Motivated",
    });
    // A consultation can only be written in the coach's own speciality.
    expect((await request(app).post(`/api/v1/coach/clients/${clientId}/consultations`).set(as(nutrition.token)).send({ area: "FITNESS", date: "2026-11-20" })).status).toBe(403);
  });

  it("another coach sees nothing until added, and the refusal is recorded", async () => {
    expect((await request(app).get(`/api/v1/coach/clients/${clientId}`).set(as(outsider.token))).status).toBe(403);
    expect(await prisma.auditLog.count({ where: { actorId: outsider.id, action: "security.client_access_denied" } })).toBe(1);
  });

  it("a fitness coach, once added, sees only the sections and consultations of her speciality", async () => {
    const add = await request(app).post(`/api/v1/coach/clients/${clientId}/coaches`).set(as(nutrition.token)).send({ coachId: fitness.id });
    expect(add.status).toBe(200);
    const rec = await request(app).get(`/api/v1/coach/clients/${clientId}`).set(as(fitness.token));
    expect(rec.status).toBe(200);
    expect(rec.body.data.sections).toEqual(["measurements", "lifestyle", "medical"]);
    expect(rec.body.data.intake.dietary).toBeUndefined();
    expect(rec.body.data.intake.menstrual).toBeUndefined();
    expect(rec.body.data.measurements).toHaveLength(1);
    expect(rec.body.data.consultations).toEqual([]);
    expect(rec.body.data.basic).toMatchObject({ name: "Kavitha R", phone: "+91 90000 00000" });
    expect((await request(app).put(`/api/v1/coach/clients/${clientId}/intake/dietary`).set(as(fitness.token)).send({ answers: { mealsPerDay: 2 } })).status).toBe(403);
    // The nutrition coach sees her own consultation with its notes.
    const own = await request(app).get(`/api/v1/coach/clients/${clientId}`).set(as(nutrition.token));
    expect(own.body.data.consultations[0]).toMatchObject({ planGiven: "More protein at breakfast", notes: "Motivated", mine: true });
    expect(own.body.data.intake.dietary).toMatchObject({ foodPreference: "Vegetarian" });
  });

  it("she claims her record with the one-time link, then sees her coaches and plans but not their notes", async () => {
    const inv = await request(app).post(`/api/v1/coach/clients/${clientId}/invite`).set(as(nutrition.token));
    expect(inv.status).toBe(200);
    const token = new URL(inv.body.data.link).searchParams.get("token")!;
    const peek = await request(app).get(`/api/v1/invites/${token}`);
    expect(peek.body.data).toMatchObject({ name: "Kavitha R", email: null });
    const email = `kavitha.${Date.now()}@example.com`;
    const claim = await request(app).post(`/api/v1/invites/${token}`).send({ password: "a-long-enough-password", email, agreed: true });
    expect(claim.status).toBe(200);
    const auth = { Authorization: `Bearer ${claim.body.data.accessToken}` };
    // The link works once.
    expect((await request(app).post(`/api/v1/invites/${token}`).send({ password: "another-long-password", email: "x@example.com", agreed: true })).status).toBe(404);

    const mine = await request(app).get("/api/v1/coaching").set(auth);
    expect(mine.body.data.coaches.map((c: { name: string }) => c.name).sort()).toEqual(["Farah Fitness", "Nina Nutrition"]);
    expect(mine.body.data.plans[0]).toMatchObject({ planGiven: "More protein at breakfast", nextFollowUp: "2026-12-04" });
    expect(mine.body.data.plans[0].notes).toBeUndefined();
    // She can remove a coach; that coach loses access at once.
    await request(app).delete(`/api/v1/coaching/coaches/${fitness.id}`).set(auth);
    expect((await request(app).get(`/api/v1/coach/clients/${clientId}`).set(as(fitness.token))).status).toBe(403);
    // A claimed record is hers: a coach can't delete it.
    expect((await request(app).delete(`/api/v1/coach/clients/${clientId}`).set(as(nutrition.token))).status).toBe(409);
    // What she logs herself reaches her coaches, only the kinds their speciality covers, and never her notes.
    await request(app).post("/api/v1/nutrition/hydration").set(auth).send({ amountMl: 750, date: "2026-11-21" });
    await request(app).post("/api/v1/wellbeing").set(auth).send({ date: "2026-11-21", mood: 3, note: "private words" });
    const logs = await request(app).get(`/api/v1/coach/clients/${clientId}/logs?today=2026-11-21`).set(as(nutrition.token));
    expect(logs.body.data.kinds).toEqual(["food", "cycle"]);
    expect(logs.body.data.days[0]).toMatchObject({ date: "2026-11-21", waterMl: 750 });
    expect(logs.body.data.days[0].mood).toBeUndefined();
    expect(JSON.stringify(logs.body.data)).not.toContain("private words");
    // Her own export includes what her coaches recorded.
    const exp = await request(app).get("/api/v1/users/me/export").set(auth);
    expect(exp.body.data.coaching.consultations[0].notes).toBe("Motivated");
  });

  it("an existing account can't be taken over by a coach typing its address", async () => {
    const someone = await registerUser("Has Own Account");
    const res = await request(app).post("/api/v1/coach/clients").set(as(nutrition.token)).send({ name: "X", dateOfBirth: adultBirth, email: someone.email, tracksCycle: false, consent: true });
    expect(res.status).toBe(409);
  });

  it("a woman can't reach coach routes", async () => {
    const w = await registerUser("Plain Woman");
    const login = await request(app).post("/api/v1/auth/login").send({ email: w.email, password: "a-long-enough-password" });
    expect((await request(app).get("/api/v1/coach/clients").set(as(login.body.data.accessToken))).status).toBe(403);
  });
});
