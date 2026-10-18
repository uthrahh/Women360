-- Additive: defaults/nullable columns on User and one new table. Nobody has
-- two-factor enabled until they turn it on, and the feature stays off unless
-- TWO_FACTOR_ENCRYPTION_KEY is configured.
ALTER TABLE "User"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecretEnc" TEXT,
  ADD COLUMN "twoFactorLastStep" INTEGER;

CREATE TABLE "TwoFactorBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorBackupCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactorBackupCode_codeHash_key" ON "TwoFactorBackupCode"("codeHash");
CREATE INDEX "TwoFactorBackupCode_userId_idx" ON "TwoFactorBackupCode"("userId");

ALTER TABLE "TwoFactorBackupCode" ADD CONSTRAINT "TwoFactorBackupCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
