import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();

async function signUp(label: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Profile Tester",
    email: `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "a-long-enough-password",
  });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("health profile: allergies and current medicines", () => {
  it("has no profile until the person answers", async () => {
    const token = await signUp("hp-none");
    const res = await request(app).get("/api/v1/users/me/health-profile").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("saves and returns both lists", async () => {
    const token = await signUp("hp-save");
    const put = await request(app)
      .put("/api/v1/users/me/health-profile")
      .set(auth(token))
      .send({ allergies: ["Penicillin", "Latex"], currentMedications: ["Thyroid medication"] });
    expect(put.status).toBe(200);
    const get = await request(app).get("/api/v1/users/me/health-profile").set(auth(token));
    expect(get.body.data.allergies).toEqual(["Penicillin", "Latex"]);
    expect(get.body.data.currentMedications).toEqual(["Thyroid medication"]);
  });

  it("an empty list means 'answered: none', distinct from never answered", async () => {
    const token = await signUp("hp-empty");
    await request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send({ allergies: [], currentMedications: [] });
    const get = await request(app).get("/api/v1/users/me/health-profile").set(auth(token));
    expect(get.body.data).not.toBeNull();
    expect(get.body.data.allergies).toEqual([]);
  });

  it("updating one list leaves the other alone", async () => {
    const token = await signUp("hp-partial");
    await request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send({ allergies: ["Eggs"], currentMedications: ["Iron supplement"] });
    await request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send({ allergies: ["Eggs", "Soy"] });
    const get = await request(app).get("/api/v1/users/me/health-profile").set(auth(token));
    expect(get.body.data.allergies).toEqual(["Eggs", "Soy"]);
    expect(get.body.data.currentMedications).toEqual(["Iron supplement"]);
  });

  it("rejects oversized entries and non-arrays", async () => {
    const token = await signUp("hp-bad");
    const put = (body: object) => request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send(body);
    expect((await put({ allergies: ["x".repeat(81)] })).status).toBe(422);
    expect((await put({ currentMedications: "Thyroid" })).status).toBe(422);
    expect((await put({ allergies: [""] })).status).toBe(422);
  });

  it("is private: each person only ever sees their own, and it needs sign-in", async () => {
    const a = await signUp("hp-a");
    const b = await signUp("hp-b");
    await request(app).put("/api/v1/users/me/health-profile").set(auth(a)).send({ allergies: ["Shellfish"] });
    const seenByB = await request(app).get("/api/v1/users/me/health-profile").set(auth(b));
    expect(JSON.stringify(seenByB.body)).not.toContain("Shellfish");
    expect((await request(app).get("/api/v1/users/me/health-profile")).status).toBe(401);
    expect((await request(app).put("/api/v1/users/me/health-profile").send({ allergies: ["x"] })).status).toBe(401);
  });

  it("appears in the person's data export", async () => {
    const token = await signUp("hp-export");
    await request(app).put("/api/v1/users/me/health-profile").set(auth(token)).send({ allergies: ["Pollen"], currentMedications: ["Antihistamine"] });
    const res = await request(app).get("/api/v1/users/me/export").set(auth(token));
    expect(res.body.data.healthProfile.allergies).toEqual(["Pollen"]);
    expect(res.body.data.healthProfile.currentMedications).toEqual(["Antihistamine"]);
  });
});
