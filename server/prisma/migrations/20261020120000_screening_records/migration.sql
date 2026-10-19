-- Additive: one new table.
CREATE TABLE "ScreeningRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screeningId" TEXT NOT NULL,
    "doneOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScreeningRecord_userId_screeningId_idx" ON "ScreeningRecord"("userId", "screeningId");

ALTER TABLE "ScreeningRecord" ADD CONSTRAINT "ScreeningRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
