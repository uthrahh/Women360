import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { basePoints, emptyDay, levelFor, pointsForLevel, questsFor, runOf } from "@/modules/game/rules";

const app = createApp();

const dates = (from: string, n: number, skip: number[] = []) =>
  new Set(Array.from({ length: n }, (_, i) => i).filter((i) => !skip.includes(i)).map((i) => new Date(Date.parse(from + "T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10)));

describe("game rules (pure)", () => {
  it("earns points for looking after herself, capped per day, and nothing for amounts", () => {
    expect(basePoints(emptyDay("2026-11-02"))).toBe(0);
    expect(basePoints({ ...emptyDay("2026-11-02"), habitsDone: 9 })).toBe(50); // 5 count
    expect(basePoints({ ...emptyDay("2026-11-02"), meals: 10 })).toBe(15); // 3 count: more food is not more points
    expect(basePoints({ ...emptyDay("2026-11-02"), sleep: true, mood: true, water: true })).toBe(25);
  });

  it("levels need a little more each time", () => {
    expect([1, 2, 3, 4].map(pointsForLevel)).toEqual([0, 100, 300, 600]);
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(599)).toBe(3);
    expect(levelFor(600)).toBe(4);
  });

  it("quests are fixed for the day and only from what applies to her", () => {
    const a = questsFor("2026-11-02", { cycle: false, habits: false, medicines: false });
    expect(a.map((q) => q.id)).toEqual(questsFor("2026-11-02", { cycle: false, habits: false, medicines: false }).map((q) => q.id));
    expect(a).toHaveLength(3);
    for (let i = 1; i <= 28; i++) {
      const ids = questsFor(`2026-11-${String(i).padStart(2, "0")}`, { cycle: false, habits: false, medicines: false }).map((q) => q.id);
      expect(ids).not.toContain("cycle");
      expect(ids).not.toContain("habit");
    }
  });

  it("a missed day is covered by the week's rest day, and today never breaks the run", () => {
    // Mon 2 Nov .. Sun 15 Nov, missing Wed 4 Nov only.
    const r = runOf(dates("2026-11-02", 14, [2]), "2026-11-15");
    expect(r.current).toBe(13);
    // Not yet logged today: the run is intact.
    const t = runOf(dates("2026-11-02", 5), "2026-11-07");
    expect(t.current).toBe(5);
  });

  it("a second miss in a week uses a freeze earned by 7 active days, and only an uncovered miss starts again (best is kept)", () => {
    // 7 active days (earns a freeze), then Mon+Tue missed in the next week: rest day + freeze cover them.
    const covered = runOf(dates("2026-11-02", 12, [7, 8]), "2026-11-13");
    expect(covered.current).toBe(10);
    // Nine active days (one freeze), then three misses in one week: rest day, freeze, then the run starts again. The best is kept.
    const broken = runOf(dates("2026-11-02", 14, [9, 10, 11]), "2026-11-15");
    expect(broken.best).toBe(9);
    expect(broken.current).toBe(2);
  });
});

describe("game mode API", () => {
  it("is off until she turns it on, then counts from her own logs", async () => {
    const email = `game.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    const reg = await request(app).post("/api/v1/auth/register").send({ name: "Game Player", email, password: "a-long-enough-password" });
    const auth = { Authorization: `Bearer ${reg.body.data.accessToken}` };
    const off = await request(app).get("/api/v1/game?today=2026-11-20").set(auth);
    expect(off.body.data).toEqual({ enabled: false });

    await request(app).patch("/api/v1/users/me").set(auth).send({ gameMode: true });
    await request(app).post("/api/v1/nutrition/hydration").set(auth).send({ amountMl: 250, date: "2026-11-20" });
    const on = await request(app).get("/api/v1/game?today=2026-11-20").set(auth);
    expect(on.body.data).toMatchObject({ enabled: true, level: 1, run: { current: 1 } });
    expect(on.body.data.today.points).toBeGreaterThanOrEqual(5);
    expect(on.body.data.badges.find((b: { id: string }) => b.id === "first-day").earned).toBe(true);
  });
});
