-- Where a day of steps came from, so a phone or a file never overwrites a day she typed. The table already has row-level security.
ALTER TABLE "StepsLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "StepsLog" ADD COLUMN "syncedAt" TIMESTAMP(3);
