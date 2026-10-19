-- Additive. Existing goals keep working: they become kind TOTAL, which is how
-- they already behaved (current / target).

ALTER TYPE "GoalCategory" ADD VALUE 'BODY';
ALTER TYPE "GoalCategory" ADD VALUE 'LEARNING';
ALTER TYPE "GoalCategory" ADD VALUE 'PREVENTIVE';
ALTER TYPE "GoalCategory" ADD VALUE 'OTHER';

CREATE TYPE "GoalKind" AS ENUM ('TOTAL', 'REACH', 'ONE_OFF');

ALTER TABLE "Goal"
  ADD COLUMN "kind" "GoalKind" NOT NULL DEFAULT 'TOTAL',
  ADD COLUMN "startValue" DOUBLE PRECISION,
  ADD COLUMN "dueDate" DATE;

CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "unit" TEXT,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 7,
    "reminder" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitLog" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");

ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_fkey"
  FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
