-- Additive: a table of per-person activity shortcuts and a flag for "defaults already copied in".
ALTER TABLE "User" ADD COLUMN "activityQuickLogSeeded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ActivityQuickLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" "Intensity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityQuickLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityQuickLog_userId_idx" ON "ActivityQuickLog"("userId");

ALTER TABLE "ActivityQuickLog" ADD CONSTRAINT "ActivityQuickLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
