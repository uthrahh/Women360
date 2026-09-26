import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();

async function registerUser(): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Medication Tester", email: `medication.${Date.now()}.${Math.random()}@example.com`, password: "a-long-enough-password" });
  return res.body.data.accessToken as string;
}

describe("medication adherence", () => {
  it("materializes today's doses as PENDING/OVERDUE until logged", async () => {
    const token = await registerUser();
    const create = await request(app)
      .post("/api/v1/health/medications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Vitamin D", dose: "1000 IU", schedule: "Once daily", times: ["00:01"] });
    expect(create.status).toBe(201);

    const today = await request(app).get("/api/v1/health/medications/today").set("Authorization", `Bearer ${token}`);
    expect(today.status).toBe(200);
    expect(today.body.data).toHaveLength(1);
    expect(today.body.data[0].medicationName).toBe("Vitamin D");
    expect(["PENDING", "OVERDUE"]).toContain(today.body.data[0].status);
  });

  it("does not include a medication with no configured times", async () => {
    const token = await registerUser();
    await request(app)
      .post("/api/v1/health/medications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "As-needed painkiller", dose: "500mg", schedule: "As needed" });

    const today = await request(app).get("/api/v1/health/medications/today").set("Authorization", `Bearer ${token}`);
    expect(today.status).toBe(200);
    expect(today.body.data).toHaveLength(0);
  });

  it("marks a dose taken and reflects it in today's list and adherence", async () => {
    const token = await registerUser();
    await request(app)
      .post("/api/v1/health/medications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Thyroid medication", dose: "50mcg", schedule: "Once daily", times: ["00:01"] });

    const today = await request(app).get("/api/v1/health/medications/today").set("Authorization", `Bearer ${token}`);
    const dose = today.body.data[0];

    const logRes = await request(app)
      .post(`/api/v1/health/medications/${dose.medicationId}/log`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scheduledFor: dose.scheduledFor, status: "TAKEN" });
    expect(logRes.status).toBe(200);

    const todayAfter = await request(app).get("/api/v1/health/medications/today").set("Authorization", `Bearer ${token}`);
    expect(todayAfter.body.data[0].status).toBe("TAKEN");

    const adherence = await request(app)
      .get("/api/v1/health/medications/adherence?days=7")
      .set("Authorization", `Bearer ${token}`);
    expect(adherence.status).toBe(200);
    expect(adherence.body.data.takenCount).toBe(1);
    expect(adherence.body.data.expectedCount).toBeGreaterThanOrEqual(1);
    expect(adherence.body.data.pct).not.toBeNull();
  });

  it("refuses to log a dose against another user's medication", async () => {
    const ownerToken = await registerUser();
    const intruderToken = await registerUser();
    const create = await request(app)
      .post("/api/v1/health/medications")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner's medication", dose: "10mg", schedule: "Once daily", times: ["09:00"] });

    const res = await request(app)
      .post(`/api/v1/health/medications/${create.body.data.id}/log`)
      .set("Authorization", `Bearer ${intruderToken}`)
      .send({ scheduledFor: new Date().toISOString(), status: "TAKEN" });
    expect(res.status).toBe(403);
  });

  it("counts a same-day retroactively-logged dose as expected, never taken > expected", async () => {
    const token = await registerUser();
    // A time almost certainly earlier today than "now" in any timezone this
    // suite runs in, so the medication's own createdAt is after it.
    await request(app)
      .post("/api/v1/health/medications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Morning vitamin", dose: "1 tablet", schedule: "Once daily", times: ["00:01"] });

    const today = await request(app).get("/api/v1/health/medications/today").set("Authorization", `Bearer ${token}`);
    const dose = today.body.data[0];
    await request(app)
      .post(`/api/v1/health/medications/${dose.medicationId}/log`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scheduledFor: dose.scheduledFor, status: "TAKEN" });

    const adherence = await request(app)
      .get("/api/v1/health/medications/adherence?days=7")
      .set("Authorization", `Bearer ${token}`);
    expect(adherence.body.data.takenCount).toBeLessThanOrEqual(adherence.body.data.expectedCount);
    expect(adherence.body.data.pct).toBe(100);
  });

  it("reports null adherence when no medication has configured times", async () => {
    const token = await registerUser();
    const adherence = await request(app)
      .get("/api/v1/health/medications/adherence")
      .set("Authorization", `Bearer ${token}`);
    expect(adherence.status).toBe(200);
    expect(adherence.body.data.pct).toBeNull();
  });
});
