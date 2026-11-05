-- CreateTable
CREATE TABLE "BackupReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tables" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,

    CONSTRAINT "BackupReport_pkey" PRIMARY KEY ("id")
);

