-- CreateTable
CREATE TABLE "UsageCount" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCount_pkey" PRIMARY KEY ("day","name")
);

-- CreateTable
CREATE TABLE "UsageSeen" (
    "day" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "UsageSeen_pkey" PRIMARY KEY ("day","hash")
);

-- CreateTable
CREATE TABLE "UsageSalt" (
    "day" TEXT NOT NULL,
    "salt" TEXT NOT NULL,

    CONSTRAINT "UsageSalt_pkey" PRIMARY KEY ("day")
);

