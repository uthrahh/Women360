-- Additive: a demo-account flag, and optional reproductive-health records.
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ContraceptionMethod" AS ENUM ('NONE', 'PILL', 'IUD_COPPER', 'IUD_HORMONAL', 'IMPLANT', 'INJECTION', 'CONDOM', 'NATURAL_METHODS', 'STERILISATION', 'OTHER');
CREATE TYPE "PregnancyStatus" AS ENUM ('NOT_PREGNANT', 'TRYING_TO_CONCEIVE', 'PREGNANT', 'POSTPARTUM');

CREATE TABLE "ReproductiveHealth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contraception" "ContraceptionMethod",
    "pregnancyStatus" "PregnancyStatus",
    "expectedDueDate" DATE,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproductiveHealth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReproductiveHealth_userId_key" ON "ReproductiveHealth"("userId");

ALTER TABLE "ReproductiveHealth" ADD CONSTRAINT "ReproductiveHealth_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
