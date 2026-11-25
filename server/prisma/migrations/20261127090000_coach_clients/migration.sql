-- Coaches' clients: specialities, client records started by a coach, the assessment, measurements, consultations and claim links.
-- CreateEnum
CREATE TYPE "CoachSpeciality" AS ENUM ('GENERAL', 'NUTRITION', 'FITNESS', 'WELLBEING', 'WOMENS_HEALTH');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addedByCoach" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "coachSpecialities" "CoachSpeciality"[];

-- CreateTable
CREATE TABLE "ClientCoach" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCoach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "userId" TEXT NOT NULL,
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "maritalStatus" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentById" TEXT,
    "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClientIntake" (
    "userId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "lifestyle" JSONB,
    "medical" JSONB,
    "menstrual" JSONB,
    "dietary" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ClientIntake_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClientMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "coachId" TEXT,
    "area" "CoachSpeciality" NOT NULL,
    "date" DATE NOT NULL,
    "targetWeightKg" DOUBLE PRECISION,
    "targetDate" DATE,
    "planGiven" TEXT,
    "nextFollowUp" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientCoach_coachId_idx" ON "ClientCoach"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCoach_clientId_coachId_key" ON "ClientCoach"("clientId", "coachId");

-- CreateIndex
CREATE INDEX "ClientMeasurement_userId_date_idx" ON "ClientMeasurement"("userId", "date");

-- CreateIndex
CREATE INDEX "Consultation_clientId_idx" ON "Consultation"("clientId");

-- CreateIndex
CREATE INDEX "Consultation_coachId_nextFollowUp_idx" ON "Consultation"("coachId", "nextFollowUp");

-- CreateIndex
CREATE UNIQUE INDEX "AccountInvite_tokenHash_key" ON "AccountInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountInvite_userId_idx" ON "AccountInvite"("userId");

-- AddForeignKey
ALTER TABLE "ClientCoach" ADD CONSTRAINT "ClientCoach_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCoach" ADD CONSTRAINT "ClientCoach_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntake" ADD CONSTRAINT "ClientIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMeasurement" ADD CONSTRAINT "ClientMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInvite" ADD CONSTRAINT "AccountInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ClientCoach" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientIntake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientMeasurement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consultation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountInvite" ENABLE ROW LEVEL SECURITY;
