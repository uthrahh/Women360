-- The day she went to bed, so a night that crosses midnight is stored, not guessed. Additive and nullable:
-- older entries keep working and their bed day is derived from their two times.
ALTER TABLE "SleepEntry" ADD COLUMN "bedDate" DATE;
