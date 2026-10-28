-- Personalised activity plans. Additive: two enums and one table.

CREATE TYPE "PlanGoal" AS ENUM ('HEALTH', 'STRENGTH', 'STAMINA', 'BALANCE', 'STRESS');
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "ActivityPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" "PlanGoal" NOT NULL,
    "weeks" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "days" INTEGER[],
    "sessionMinutes" INTEGER NOT NULL,
    "activityCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ActivityPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityPlan_userId_status_idx" ON "ActivityPlan"("userId", "status");

ALTER TABLE "ActivityPlan" ADD CONSTRAINT "ActivityPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
