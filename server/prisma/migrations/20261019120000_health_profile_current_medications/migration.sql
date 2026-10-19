-- Additive: one array column with an empty default; existing rows are unchanged.
ALTER TABLE "HealthProfile" ADD COLUMN "currentMedications" TEXT[] DEFAULT ARRAY[]::TEXT[];
