-- Whether she wants the ovulation phase shown on the home screen. Additive, off by default.
ALTER TABLE "CycleProfile" ADD COLUMN "showOvulationOnHome" BOOLEAN NOT NULL DEFAULT false;
