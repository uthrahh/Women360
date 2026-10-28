-- Activities now come from a fixed catalog so the app knows exactly what each one is.
-- Additive: new columns, older rows are mapped from their free-text name, and the
-- quick log gets a uniqueness rule (duplicates already there are removed first).

ALTER TABLE "ActivityEntry" ADD COLUMN "activityCode" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "ActivityEntry" ADD COLUMN "distanceKm" DOUBLE PRECISION;
ALTER TABLE "ActivityEntry" ADD COLUMN "sets" INTEGER;

ALTER TABLE "ActivityQuickLog" ADD COLUMN "activityCode" TEXT NOT NULL DEFAULT 'other';

ALTER TABLE "Habit" ADD COLUMN "activityCode" TEXT;

-- Map the old free-text names onto catalog codes. Anything not recognised stays 'other'
-- and simply shows no calorie estimate.
UPDATE "ActivityEntry" SET "activityCode" = CASE
  WHEN lower("type") LIKE '%bodyweight%' THEN 'bodyweight-training'
  WHEN lower("type") ~ '(strength|weight|lifting|gym)' THEN 'strength-training'
  WHEN lower("type") ~ '(stretch|mobility)' THEN 'stretching'
  WHEN lower("type") LIKE '%pilates%' THEN 'pilates'
  WHEN lower("type") LIKE '%yoga%' THEN 'yoga'
  WHEN lower("type") ~ '(jog|run)' THEN 'running'
  WHEN lower("type") ~ '(cycl|bike|biking)' THEN 'cycling'
  WHEN lower("type") LIKE '%swim%' THEN 'swimming'
  WHEN lower("type") LIKE '%walk%' THEN 'walking'
  WHEN lower("type") LIKE '%hik%' THEN 'hiking'
  WHEN lower("type") ~ '(danc|zumba|aerobic)' THEN 'dance-aerobics'
  ELSE 'other' END;

UPDATE "ActivityQuickLog" SET "activityCode" = CASE
  WHEN lower("type") LIKE '%bodyweight%' THEN 'bodyweight-training'
  WHEN lower("type") ~ '(strength|weight|lifting|gym)' THEN 'strength-training'
  WHEN lower("type") ~ '(stretch|mobility)' THEN 'stretching'
  WHEN lower("type") LIKE '%pilates%' THEN 'pilates'
  WHEN lower("type") LIKE '%yoga%' THEN 'yoga'
  WHEN lower("type") ~ '(jog|run)' THEN 'running'
  WHEN lower("type") ~ '(cycl|bike|biking)' THEN 'cycling'
  WHEN lower("type") LIKE '%swim%' THEN 'swimming'
  WHEN lower("type") LIKE '%walk%' THEN 'walking'
  WHEN lower("type") LIKE '%hik%' THEN 'hiking'
  WHEN lower("type") ~ '(danc|zumba|aerobic)' THEN 'dance-aerobics'
  ELSE 'other' END;

-- A habit counts as an activity when its name says so.
UPDATE "Habit" SET "activityCode" = CASE
  WHEN lower("title") ~ '(strength|weights|lifting)' THEN 'strength-training'
  WHEN lower("title") ~ '(stretch|mobility)' THEN 'stretching'
  WHEN lower("title") LIKE '%pilates%' THEN 'pilates'
  WHEN lower("title") LIKE '%yoga%' THEN 'yoga'
  WHEN lower("title") ~ '(jog|run)' THEN 'running'
  WHEN lower("title") ~ '(cycl|bike)' THEN 'cycling'
  WHEN lower("title") LIKE '%swim%' THEN 'swimming'
  WHEN lower("title") ~ '(walk|steps)' THEN 'walking'
  WHEN lower("title") ~ '(workout|exercise|move for|gym|training)' THEN 'any'
  ELSE NULL END;

-- Keep the oldest of any identical shortcuts, then forbid new ones.
DELETE FROM "ActivityQuickLog" a USING "ActivityQuickLog" b
WHERE a."userId" = b."userId" AND a."activityCode" = b."activityCode"
  AND a."durationMinutes" = b."durationMinutes" AND a."intensity" = b."intensity"
  AND (a."createdAt", a."id") > (b."createdAt", b."id");

CREATE UNIQUE INDEX "ActivityQuickLog_userId_activityCode_durationMinutes_intens_key"
  ON "ActivityQuickLog"("userId", "activityCode", "durationMinutes", "intensity");
