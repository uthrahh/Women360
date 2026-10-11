-- Additive and safe for existing rows: both columns have defaults, so no
-- backfill is needed and the previously-deployed API keeps working against
-- the new schema until the new build starts.
ALTER TABLE "CycleEntry"
  ADD COLUMN "contextTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "excludeCycle" BOOLEAN NOT NULL DEFAULT false;
