-- AlterTable
ALTER TABLE "CycleEntry" ADD COLUMN     "bbtC" DOUBLE PRECISION,
ADD COLUMN     "cervicalMucus" TEXT,
ADD COLUMN     "intercourse" TEXT,
ADD COLUMN     "productsUsed" INTEGER;

-- AlterTable
ALTER TABLE "WellbeingEntry" ALTER COLUMN "stress" DROP NOT NULL,
ALTER COLUMN "energy" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BodyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyLog_userId_date_idx" ON "BodyLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "BodyLog" ADD CONSTRAINT "BodyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

