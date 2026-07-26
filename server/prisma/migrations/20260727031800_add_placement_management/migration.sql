-- Phase 10: Placement Management & Career Readiness (additive only)

-- CreateEnum
CREATE TYPE "DriveStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'SHORTLISTED', 'APTITUDE', 'TECHNICAL', 'HR', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('UNPLACED', 'PLACED');

-- AlterTable Student: additive CGPA / backlog fields
ALTER TABLE "Student" ADD COLUMN "cgpa" DECIMAL(3,2),
ADD COLUMN "currentBacklogs" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "hrContactName" TEXT,
    "hrContactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementDrive" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "jobType" TEXT,
    "packageMin" DOUBLE PRECISION,
    "packageMax" DOUBLE PRECISION,
    "packageCtc" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "driveDate" TIMESTAMP(3),
    "minCgpa" DECIMAL(3,2),
    "maxBacklogs" INTEGER,
    "allowPlacedApplications" BOOLEAN NOT NULL DEFAULT false,
    "status" "DriveStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PlacementDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveEligibleDepartment" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "DriveEligibleDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveEligibleBatch" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "batchYear" TEXT NOT NULL,

    CONSTRAINT "DriveEligibleBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPlacementProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skills" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "resumePath" TEXT,
    "originalResumeName" TEXT,
    "bio" TEXT,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "placementStatus" "PlacementStatus" NOT NULL DEFAULT 'UNPLACED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPlacementProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementApplication" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "eligibilitySnapshot" JSONB NOT NULL,

    CONSTRAINT "PlacementApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStageHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStage" "ApplicationStage",
    "toStage" "ApplicationStage" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementOffer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ctc" DOUBLE PRECISION NOT NULL,
    "ctcBreakdown" JSONB,
    "location" TEXT,
    "roleTitle" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondBy" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "offerLetterPath" TEXT,
    "originalOfferLetterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "PlacementDrive_status_idx" ON "PlacementDrive"("status");

-- CreateIndex
CREATE INDEX "PlacementDrive_applicationDeadline_idx" ON "PlacementDrive"("applicationDeadline");

-- CreateIndex
CREATE INDEX "PlacementDrive_companyId_idx" ON "PlacementDrive"("companyId");

-- CreateIndex
CREATE INDEX "DriveEligibleDepartment_departmentId_idx" ON "DriveEligibleDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveEligibleDepartment_driveId_departmentId_key" ON "DriveEligibleDepartment"("driveId", "departmentId");

-- CreateIndex
CREATE INDEX "DriveEligibleBatch_batchYear_idx" ON "DriveEligibleBatch"("batchYear");

-- CreateIndex
CREATE UNIQUE INDEX "DriveEligibleBatch_driveId_batchYear_key" ON "DriveEligibleBatch"("driveId", "batchYear");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPlacementProfile_studentId_key" ON "StudentPlacementProfile"("studentId");

-- CreateIndex
CREATE INDEX "PlacementApplication_stage_idx" ON "PlacementApplication"("stage");

-- CreateIndex
CREATE INDEX "PlacementApplication_studentId_idx" ON "PlacementApplication"("studentId");

-- CreateIndex
CREATE INDEX "PlacementApplication_driveId_idx" ON "PlacementApplication"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementApplication_driveId_studentId_key" ON "PlacementApplication"("driveId", "studentId");

-- CreateIndex
CREATE INDEX "ApplicationStageHistory_applicationId_idx" ON "ApplicationStageHistory"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationStageHistory_actorUserId_idx" ON "ApplicationStageHistory"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementOffer_applicationId_key" ON "PlacementOffer"("applicationId");

-- CreateIndex
CREATE INDEX "PlacementOffer_studentId_idx" ON "PlacementOffer"("studentId");

-- CreateIndex
CREATE INDEX "PlacementOffer_status_idx" ON "PlacementOffer"("status");

-- CreateIndex
CREATE INDEX "PlacementOffer_companyId_idx" ON "PlacementOffer"("companyId");

-- CreateIndex
CREATE INDEX "PlacementOffer_driveId_idx" ON "PlacementOffer"("driveId");

-- AddForeignKey
ALTER TABLE "PlacementDrive" ADD CONSTRAINT "PlacementDrive_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementDrive" ADD CONSTRAINT "PlacementDrive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveEligibleDepartment" ADD CONSTRAINT "DriveEligibleDepartment_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveEligibleDepartment" ADD CONSTRAINT "DriveEligibleDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveEligibleBatch" ADD CONSTRAINT "DriveEligibleBatch_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlacementProfile" ADD CONSTRAINT "StudentPlacementProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementApplication" ADD CONSTRAINT "PlacementApplication_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementApplication" ADD CONSTRAINT "PlacementApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageHistory" ADD CONSTRAINT "ApplicationStageHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PlacementApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageHistory" ADD CONSTRAINT "ApplicationStageHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOffer" ADD CONSTRAINT "PlacementOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PlacementApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOffer" ADD CONSTRAINT "PlacementOffer_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "PlacementDrive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOffer" ADD CONSTRAINT "PlacementOffer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOffer" ADD CONSTRAINT "PlacementOffer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
