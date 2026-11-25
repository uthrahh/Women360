-- Guided programmes: programmes, task templates, enrolments, assessments, coach-assigned tasks, an append-only task history, plan versions and reviews.
-- CreateEnum
CREATE TYPE "ProgrammeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('NUTRITION', 'HYDRATION', 'ACTIVITY', 'SLEEP', 'WELLBEING', 'WOMENS_HEALTH', 'FAMILY', 'LEARNING', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('CHECK', 'AMOUNT', 'REFLECTION');

-- CreateEnum
CREATE TYPE "TaskFrequency" AS ENUM ('DAILY', 'WEEKDAYS', 'ONCE');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ASSESSING', 'WAITING_FOR_COACH', 'PLANNING', 'ACTIVE', 'FINAL_ASSESSMENT', 'FINAL_REVIEW', 'COMPLETED', 'LEFT');

-- CreateEnum
CREATE TYPE "ProgrammeTaskStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'REPLACED');

-- CreateEnum
CREATE TYPE "TaskEventType" AS ENUM ('DONE', 'SKIPPED', 'NEED_HELP', 'UNDONE', 'COACH_REPLY');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('BASELINE', 'FINAL');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('WEEKLY', 'FINAL');

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" "ProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
    "demoOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "unit" TEXT,
    "instructions" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "demoOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrolment" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coachId" TEXT,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ASSESSING',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "startDate" DATE,
    "planVersion" INTEGER NOT NULL DEFAULT 0,
    "nextReviewOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeTask" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "instructions" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "frequency" "TaskFrequency" NOT NULL,
    "weekdays" INTEGER[],
    "startDay" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,
    "status" "ProgrammeTaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "endedOnDay" INTEGER,
    "replacesId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "TaskEventType" NOT NULL,
    "value" DOUBLE PRECISION,
    "note" TEXT,
    "actorId" TEXT,
    "actorRole" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeReview" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "coachId" TEXT,
    "kind" "ReviewKind" NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammeReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enrolment_userId_idx" ON "Enrolment"("userId");

-- CreateIndex
CREATE INDEX "Enrolment_coachId_idx" ON "Enrolment"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_enrolmentId_kind_key" ON "Assessment"("enrolmentId", "kind");

-- CreateIndex
CREATE INDEX "ProgrammeTask_enrolmentId_idx" ON "ProgrammeTask"("enrolmentId");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_date_idx" ON "TaskEvent"("taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_enrolmentId_version_key" ON "PlanVersion"("enrolmentId", "version");

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeTask" ADD CONSTRAINT "ProgrammeTask_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProgrammeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeReview" ADD CONSTRAINT "ProgrammeReview_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The API owns these tables; the hosted database's automatic API is shut out.
ALTER TABLE "Programme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrolment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgrammeTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgrammeReview" ENABLE ROW LEVEL SECURITY;
