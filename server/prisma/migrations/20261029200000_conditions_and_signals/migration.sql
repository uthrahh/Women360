-- Conditions she tells us about, and the state of each cycle-pattern signal. Additive.

CREATE TYPE "HealthCondition" AS ENUM ('PCOS', 'ENDOMETRIOSIS', 'THYROID', 'PMDD', 'PERIMENOPAUSE', 'ANAEMIA');

CREATE TABLE "UserCondition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "condition" "HealthCondition" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCondition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCondition_userId_condition_key" ON "UserCondition"("userId", "condition");

ALTER TABLE "UserCondition" ADD CONSTRAINT "UserCondition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HealthSignalState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "HealthSignalState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthSignalState_userId_key_key" ON "HealthSignalState"("userId", "key");

ALTER TABLE "HealthSignalState" ADD CONSTRAINT "HealthSignalState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
