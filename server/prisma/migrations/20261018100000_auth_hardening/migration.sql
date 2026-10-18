-- Additive: a nullable column and a new table. Existing rows and the
-- previously deployed API are unaffected.
ALTER TABLE "User" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);

CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);
