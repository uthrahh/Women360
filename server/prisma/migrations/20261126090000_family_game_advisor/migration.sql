-- Family profiles and access, game mode, advisor dismissals.
-- CreateEnum
CREATE TYPE "FamilyAccessLevel" AS ENUM ('MONITOR', 'MODIFY');

-- CreateEnum
CREATE TYPE "FamilyAccessStatus" AS ENUM ('REQUESTED', 'ACTIVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cycleTracking" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gameLevelSeen" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "gameMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guardianConsentAt" TIMESTAMP(3),
ADD COLUMN     "managedById" TEXT,
ADD COLUMN     "relation" TEXT;

-- CreateTable
CREATE TABLE "FamilyAccess" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "status" "FamilyAccessStatus" NOT NULL,
    "level" "FamilyAccessLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyAccess_viewerId_idx" ON "FamilyAccess"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyAccess_ownerId_viewerId_key" ON "FamilyAccess"("ownerId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorDismissal_userId_key_key" ON "AdvisorDismissal"("userId", "key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAccess" ADD CONSTRAINT "FamilyAccess_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAccess" ADD CONSTRAINT "FamilyAccess_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorDismissal" ADD CONSTRAINT "AdvisorDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "FamilyAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdvisorDismissal" ENABLE ROW LEVEL SECURITY;
