/**
 * Shared demonstration accounts for evaluators: one woman, one coach, one
 * administrator, with synthetic data. Safe to run again: it refreshes the demo
 * woman's data each time and never touches any other account.
 *
 *   npm run seed:demo
 *
 * Runs on a local database by default. On a hosted database it only runs when
 * SEED_DEMO_ACCOUNTS=true (render.yaml sets it), so a deployment never creates
 * published logins by accident.
 *
 * These credentials are published on purpose (in the project report), so the
 * accounts are marked `isDemo`: the demo administrator is read-only and only
 * ever sees other demo accounts; none of them can delete themselves, change a
 * password or turn on two-factor.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { isLocalDatabaseUrl } from "../src/lib/security/localDatabase";

export const DEMO_ACCOUNTS = {
  woman: { email: "demo.woman@women360.demo", password: "Demo-Woman-2026!", name: "Priya Raman" },
  coach: { email: "demo.coach@women360.demo", password: "Demo-Coach-2026!", name: "Meera Iyer" },
  admin: { email: "demo.admin@women360.demo", password: "Demo-Admin-2026!", name: "Demo Administrator" },
} as const;

const prisma = new PrismaClient();

const DAY = 86_400_000;
const day = (n: number) => Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) - n * DAY;
const date = (n: number) => new Date(day(n));
const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

async function upsertStaff(kind: "coach" | "admin") {
  const a = DEMO_ACCOUNTS[kind];
  const passwordHash = await hashPassword(a.password);
  const data = {
    name: a.name,
    passwordHash,
    role: kind === "coach" ? ("COACH" as const) : ("ADMIN" as const),
    onboarded: true,
    isDemo: true,
    deletedAt: null,
    avatarInitials: initials(a.name),
    twoFactorEnabled: false,
  };
  return prisma.user.upsert({ where: { email: a.email }, create: { email: a.email, ...data }, update: data });
}

async function main() {
  if (process.env.SEED_DEMO_ACCOUNTS !== "true" && !isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    console.log("Demo accounts not seeded (set SEED_DEMO_ACCOUNTS=true to create them on a hosted database).");
    return;
  }

  const coach = await upsertStaff("coach");
  await upsertStaff("admin");

  // A fresh woman each time, so repeated evaluator edits never pile up.
  await prisma.user.deleteMany({ where: { email: DEMO_ACCOUNTS.woman.email } });
  const w = DEMO_ACCOUNTS.woman;
  const woman = await prisma.user.create({
    data: {
      email: w.email,
      passwordHash: await hashPassword(w.password),
      name: w.name,
      role: "WOMAN",
      dateOfBirth: new Date("1988-04-12"),
      lifeStage: "REPRODUCTIVE",
      onboarded: true,
      isDemo: true,
      avatarInitials: initials(w.name),
    },
  });
  const userId = woman.id;

  await prisma.healthProfile.create({ data: { userId, allergies: ["Penicillin"], currentMedications: ["Vitamin D3", "Iron + folate"], conditions: [], familyHistory: "Type 2 diabetes (mother)" } });
  await prisma.emergencyContact.create({ data: { userId, name: "Arjun Raman", phone: "+91 90000 00000", relationship: "Spouse" } });
  await prisma.reproductiveHealth.create({ data: { userId, contraception: "IUD_COPPER", pregnancyStatus: "NOT_PREGNANT" } });
  await prisma.cycleProfile.create({ data: { userId, averageCycleLength: 29, averagePeriodLength: 5 } });
  await prisma.nutritionGoal.create({ data: { userId, hydrationGoalMl: 2500, proteinGoalG: 60, fibreGoalG: 25, fruitVegGoal: 5 } });
  await prisma.activityGoal.create({ data: { userId, stepsGoal: 8000, activeMinutesGoal: 45 } });

  // Cycle: periods that started 86, 57 and 28 days ago, five days each.
  const cycle: Prisma.CycleEntryCreateManyInput[] = [];
  for (const start of [86, 57, 28]) {
    for (let i = 0; i < 5; i++) {
      cycle.push({
        userId,
        date: date(start - i),
        isPeriod: true,
        flow: i === 0 || i === 4 ? "LIGHT" : i === 3 ? "MEDIUM" : "HEAVY",
        pain: i < 2 ? 2 : 1,
        energy: 2,
        mood: i < 2 ? "tired" : "calm",
        symptoms: i < 2 ? ["cramps", "bloating"] : [],
      });
    }
  }
  await prisma.cycleEntry.createMany({ data: cycle });

  const meals: [string, string, number, number, number, string][] = [
    ["08:00", "Oats with banana and almonds", 380, 12, 8, "1 bowl"],
    ["13:00", "Dal, rice and vegetables", 620, 22, 11, "1 plate"],
    ["16:30", "Roasted chana and a fruit", 210, 9, 6, "1 small bowl"],
    ["20:00", "Chapati with paneer curry", 540, 24, 7, "2 chapati"],
  ];
  const sleep: Prisma.SleepEntryCreateManyInput[] = [];
  const wellbeing: Prisma.WellbeingEntryCreateManyInput[] = [];
  const hydration: Prisma.HydrationLogCreateManyInput[] = [];
  const mealRows: Prisma.MealEntryCreateManyInput[] = [];
  const activity: Prisma.ActivityEntryCreateManyInput[] = [];
  const steps: Prisma.StepsLogCreateManyInput[] = [];
  for (let i = 13; i >= 0; i--) {
    sleep.push({ userId, date: date(i), durationHours: 6 + ((i * 7) % 5) / 2 + 0.5, quality: 2 + (i % 4), bedtime: i % 3 ? "10:45 PM" : "11:30 PM", wakeTime: "6:30 AM" });
    wellbeing.push({ userId, date: date(i), mood: 1 + (i % 4), stress: (i * 3) % 4, energy: 1 + ((i + 1) % 4) });
    hydration.push({ userId, date: date(i), amountMl: 1200 + ((i * 250) % 1000) });
    steps.push({ userId, date: date(i), steps: 4000 + ((i * 1370) % 6000) });
    if (i % 2 === 0) activity.push({ userId, date: date(i), type: i % 4 ? "Brisk walk" : "Yoga", durationMinutes: 20 + (i % 3) * 10, intensity: i % 4 ? "MODERATE" : "LOW" });
    if (i < 7) for (const [time, name, calories, proteinG, fibreG, servings] of meals) mealRows.push({ userId, date: date(i), time, name, calories, proteinG, fibreG, servings });
  }
  await prisma.sleepEntry.createMany({ data: sleep });
  await prisma.wellbeingEntry.createMany({ data: wellbeing });
  await prisma.hydrationLog.createMany({ data: hydration });
  await prisma.stepsLog.createMany({ data: steps });
  await prisma.activityEntry.createMany({ data: activity });
  await prisma.mealEntry.createMany({ data: mealRows });
  await prisma.fruitVegLog.create({ data: { userId, date: date(0), servings: 3 } });

  await prisma.vitalMeasurement.createMany({
    data: [
      { userId, type: "WEIGHT", value: "63.4 kg", date: date(2) },
      { userId, type: "BLOOD_PRESSURE", value: "118/76", date: date(2) },
      { userId, type: "RESTING_HR", value: "68 bpm", date: date(2) },
    ],
  });
  await prisma.medication.createMany({
    data: [
      { userId, name: "Vitamin D3", dose: "1000 IU", schedule: "Once daily, morning", times: ["08:00"], remaining: 24 },
      { userId, name: "Iron + folate", dose: "1 tablet", schedule: "Once daily, evening", times: ["20:00"], remaining: 30 },
    ],
  });
  await prisma.appointment.createMany({
    data: [
      { userId, title: "Annual health check-up", provider: "Dr. Anitha Rao", date: date(-9), time: "10:30 AM", location: "City Care Clinic", kind: "CHECKUP" },
      { userId, title: "Wellness coaching call", provider: "Meera Iyer", date: date(-3), time: "5:00 PM", location: "Video call", kind: "COACH" },
    ],
  });

  await prisma.goal.createMany({
    data: [
      { userId, title: "Lose weight", kind: "REACH", category: "BODY", unit: "kg", currentValue: 63.4, startValue: 65, targetValue: 60 },
      { userId, title: "Read 12 books", kind: "TOTAL", category: "LEARNING", unit: "books", currentValue: 4, targetValue: 12 },
      { userId, title: "Book my annual health check-up", kind: "ONE_OFF", category: "PREVENTIVE", completed: true },
    ],
  });
  const walk = await prisma.habit.create({ data: { userId, title: "Walk 10,000 steps", target: 10000, unit: "steps" } });
  const vitamin = await prisma.habit.create({ data: { userId, title: "Take my vitamin" } });
  await prisma.habit.create({ data: { userId, title: "Strength session", daysPerWeek: 3 } });
  for (let i = 1; i <= 5; i++) {
    await prisma.habitLog.create({ data: { habitId: walk.id, date: date(i), amount: 10000 } });
    await prisma.habitLog.create({ data: { habitId: vitamin.id, date: date(i) } });
  }

  await prisma.screeningRecord.createMany({
    data: [
      { userId, screeningId: "blood-pressure", doneOn: date(120) },
      { userId, screeningId: "blood-sugar", doneOn: date(400) },
      { userId, screeningId: "breast-exam", doneOn: date(300) },
    ],
  });

  // The woman has shared her information with the demo coach, who has left a note.
  await prisma.coachAssignment.create({ data: { womanId: userId, coachId: coach.id, active: true } });
  await prisma.coachNote.createMany({
    data: [
      { coachId: coach.id, womanId: userId, note: "Sleep has been a little short on weeknights. Try a fixed wind-down time this week and see how the mornings feel.", visibleToWoman: true },
      { coachId: coach.id, womanId: userId, note: "Private: follow up on the iron supplement at the next call.", visibleToWoman: false },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { userId, title: "A health check-up is coming up", detail: "Annual health check-up in 9 days." },
      { userId, title: "Your coach left a note", detail: "Meera Iyer shared a note with you." },
    ],
  });
  await prisma.feedback.create({ data: { userId, rating: 5, message: "The one-tap logging saves me a lot of time." } });

  // A few plain explainers about the app itself, only when the library is empty.
  if ((await prisma.learnArticle.count()) === 0) {
    const now = new Date();
    await prisma.learnArticle.createMany({
      data: [
        { title: "Getting started with Women360", category: "About the app", readMins: 2, dek: "What to log first, and how little time it takes.", body: "Start with whatever matters most to you today: your cycle, a meal, how you slept. Most things take one tap, and anything you have logged before can be repeated without retyping it.", publishedAt: now },
        { title: "Why your next period is shown as a range", category: "About the app", readMins: 3, dek: "Predictions come from your own cycles, not a fixed 28-day rule.", body: "Women360 looks at the spread of your recent cycle lengths and shows a range with a confidence level. With few logged cycles, or very uneven ones, it says so instead of pretending to be exact. It is not a birth control method.", publishedAt: now },
        { title: "What the preventive-care schedule is based on", category: "About the app", readMins: 3, dek: "Where the check-up suggestions come from, and their limits.", body: "The schedule follows India's national screening programme and WHO guidance, and each item names its source. It is a general guide that has not yet been reviewed by a clinician, so please confirm it with your doctor.", publishedAt: now },
      ],
    });
  }

  console.log("Demo accounts ready:", Object.values(DEMO_ACCOUNTS).map((a) => a.email).join(", "));
}

main()
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
