/**
 * Local/demo seed data only — never run against a production database.
 * Mirrors the shape of the frontend's src/mock/seed.ts so the two stay
 * easy to compare while the frontend is cut over to the real API.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const demoPassword = await hashPassword("Demo-Password-123");

  const admin = await prisma.user.upsert({
    where: { email: "admin@women360.local" },
    create: {
      email: "admin@women360.local",
      passwordHash: demoPassword,
      name: "Women360 Admin",
      role: "ADMIN",
      onboarded: true,
      avatarInitials: "WA",
    },
    update: {},
  });

  const coach = await prisma.user.upsert({
    where: { email: "coach.meera@women360.local" },
    create: {
      email: "coach.meera@women360.local",
      passwordHash: demoPassword,
      name: "Coach Meera",
      role: "COACH",
      onboarded: true,
      avatarInitials: "CM",
    },
    update: {},
  });

  const woman = await prisma.user.upsert({
    where: { email: "sarah.menon@women360.local" },
    create: {
      email: "sarah.menon@women360.local",
      passwordHash: demoPassword,
      name: "Sarah Menon",
      role: "WOMAN",
      lifeStage: "PERIMENOPAUSE",
      onboarded: true,
      avatarInitials: "SM",
      dateOfBirth: new Date("1969-04-12"),
    },
    update: {},
  });

  await prisma.coachAssignment.upsert({
    where: { womanId_coachId: { womanId: woman.id, coachId: coach.id } },
    create: { womanId: woman.id, coachId: coach.id, active: true },
    update: { active: true },
  });

  await prisma.nutritionGoal.upsert({
    where: { userId: woman.id },
    create: { userId: woman.id },
    update: {},
  });
  await prisma.activityGoal.upsert({
    where: { userId: woman.id },
    create: { userId: woman.id },
    update: {},
  });
  await prisma.cycleProfile.upsert({
    where: { userId: woman.id },
    create: { userId: woman.id },
    update: {},
  });

  await prisma.learnArticle.createMany({
    data: [
      {
        title: "Understanding perimenopause: what's actually changing",
        category: "Menopause",
        readMins: 6,
        dek: "The hormonal shifts behind the symptoms, explained plainly.",
        publishedAt: new Date(),
      },
      {
        title: "Strength training after 40: why it matters more, not less",
        category: "Fitness",
        readMins: 5,
        dek: "Bone density, metabolism, and the case for lifting.",
        publishedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete:", { admin: admin.email, coach: coach.email, woman: woman.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
