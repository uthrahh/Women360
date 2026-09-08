-- Sleep quality moves from a 0-100 percentage to a 1-5 rating scale
-- (1 Very poor .. 5 Excellent). Existing rows are converted proportionally
-- rather than reset, so historical nights keep a meaningful (if coarser)
-- quality value instead of being silently corrupted. There is no
-- production data at the time of this migration (dev/test rows only),
-- but the conversion is defined deliberately anyway:
--   new = clamp(1, 5, round(old / 100 * 4) + 1)
-- 0 -> 1 (Very poor), 25 -> 2 (Poor), 50 -> 3 (Fair), 75 -> 4 (Good), 100 -> 5 (Excellent)
UPDATE "SleepEntry"
SET "quality" = GREATEST(1, LEAST(5, ROUND("quality"::numeric / 100 * 4) + 1))::integer;

-- Nutrition values (calories) now support one decimal place like the rest
-- of the macro fields, instead of being rounded to a whole number.
-- AlterTable
ALTER TABLE "MealEntry" ALTER COLUMN "calories" SET DATA TYPE DOUBLE PRECISION;

-- Fruit & veg servings used to be a hardcoded 0 on every response (no
-- table backed it at all) — this replaces that fake metric with a real,
-- user-logged quick-count, mirroring HydrationLog's shape.
-- CreateTable
CREATE TABLE "FruitVegLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FruitVegLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FruitVegLog_userId_date_idx" ON "FruitVegLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "FruitVegLog" ADD CONSTRAINT "FruitVegLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
