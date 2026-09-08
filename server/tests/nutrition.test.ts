import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

const app = createApp();
let token: string;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  const res = await request(app).post("/api/v1/auth/register").send({
    name: "Nutrition Tester",
    email: `nutrition.${Date.now()}@example.com`,
    password: "a-long-enough-password",
  });
  token = res.body.data.accessToken;
});


describe("nutrition aggregation", () => {
  it("accumulates fibre (and every other nutrient) across multiple logged meals", async () => {
    const meals = [
      { name: "Breakfast", calories: 300, proteinG: 10, fibreG: 4.5, carbsG: 30, fatG: 8 },
      { name: "Lunch", calories: 500.5, proteinG: 20.5, fibreG: 3.2, carbsG: 50, fatG: 15 },
      { name: "Dinner", calories: 400, proteinG: 15, fibreG: 6, carbsG: 40, fatG: 12 },
    ];
    for (const meal of meals) {
      const res = await request(app).post("/api/v1/nutrition/meals").set("Authorization", `Bearer ${token}`).send({
        date: today,
        time: "12:00 PM",
        servings: "1 serving",
        ...meal,
      });
      expect(res.status).toBe(201);
      // Each individual meal record must itself carry the fibre it was given.
      expect(res.body.data.fibreG).toBe(meal.fibreG);
    }

    const summary = await request(app).get(`/api/v1/nutrition/today?date=${today}`).set("Authorization", `Bearer ${token}`);
    expect(summary.status).toBe(200);
    // The daily total must be the real sum of the actual meal records —
    // 4.5 + 3.2 + 6.0 = 13.7 — not a separately-maintained (and here,
    // previously broken) counter.
    expect(summary.body.data.fibreG).toBe(13.7);
    expect(summary.body.data.proteinG).toBe(45.5);
    expect(summary.body.data.calories).toBe(1200.5);
    expect(summary.body.data.carbsG).toBe(120);
    expect(summary.body.data.fatG).toBe(35);
    expect(summary.body.data.meals).toHaveLength(3);
  });

  it("recomputes totals after a meal is deleted, not just the list", async () => {
    const before = await request(app).get(`/api/v1/nutrition/today?date=${today}`).set("Authorization", `Bearer ${token}`);
    const [firstMeal] = before.body.data.meals;

    const del = await request(app).delete(`/api/v1/nutrition/meals/${firstMeal.id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const after = await request(app).get(`/api/v1/nutrition/today?date=${today}`).set("Authorization", `Bearer ${token}`);
    expect(after.body.data.fibreG).toBeCloseTo(13.7 - firstMeal.fibreG, 5);
    expect(after.body.data.meals).toHaveLength(2);
  });

  it("rejects a meal with more than one decimal place", async () => {
    const res = await request(app).post("/api/v1/nutrition/meals").set("Authorization", `Bearer ${token}`).send({
      date: today,
      time: "12:00 PM",
      name: "Snack",
      servings: "1",
      calories: 100.567,
      proteinG: 5,
      fibreG: 1,
    });
    expect(res.status).toBe(422);
  });

  it("logs real fruit & veg servings instead of a hardcoded value", async () => {
    await request(app).post("/api/v1/nutrition/fruit-veg").set("Authorization", `Bearer ${token}`).send({ date: today, servings: 2 });
    await request(app).post("/api/v1/nutrition/fruit-veg").set("Authorization", `Bearer ${token}`).send({ date: today, servings: 1 });
    const summary = await request(app).get(`/api/v1/nutrition/today?date=${today}`).set("Authorization", `Bearer ${token}`);
    expect(summary.body.data.fruitVeg).toBe(3);
  });
});
