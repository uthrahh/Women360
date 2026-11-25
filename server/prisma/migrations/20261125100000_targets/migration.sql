-- Nutrient targets (carbs, fat, vitamins, minerals), activity minutes targets, and optional micronutrients on a meal.
CREATE TYPE "TargetMode" AS ENUM ('AT_LEAST', 'AT_MOST');
CREATE TYPE "ActivityCategory" AS ENUM ('WALKING', 'CARDIO', 'STRENGTH', 'FLEXIBILITY', 'PHYSIO');
CREATE TYPE "TargetPeriod" AS ENUM ('DAY', 'WEEK');

ALTER TABLE "MealEntry" ADD COLUMN "micros" JSONB;

CREATE TABLE "NutrientTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nutrient" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" "TargetMode" NOT NULL DEFAULT 'AT_LEAST',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NutrientTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NutrientTarget_userId_nutrient_key" ON "NutrientTarget"("userId", "nutrient");
ALTER TABLE "NutrientTarget" ADD CONSTRAINT "NutrientTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutrientTarget" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "ActivityTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "period" "TargetPeriod" NOT NULL DEFAULT 'WEEK',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivityTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityTarget_userId_category_key" ON "ActivityTarget"("userId", "category");
ALTER TABLE "ActivityTarget" ADD CONSTRAINT "ActivityTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityTarget" ENABLE ROW LEVEL SECURITY;
