-- AI chat: when she agreed to share a summary, and a metadata-only table (who, when) for rate limits. No chat text is stored.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatShareConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatTurn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatTurn_userId_createdAt_idx" ON "ChatTurn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatTurn_createdAt_idx" ON "ChatTurn"("createdAt");

-- AddForeignKey
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security on the new table (CLAUDE.md section 7: every table).
ALTER TABLE "ChatTurn" ENABLE ROW LEVEL SECURITY;
