-- CreateEnum
CREATE TYPE "LeaveODType" AS ENUM ('LEAVE', 'OD');

-- CreateEnum
CREATE TYPE "LeaveODStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeaveODRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestType" "LeaveODType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "LeaveODStatus" NOT NULL DEFAULT 'PENDING',
    "attachmentPath" TEXT,
    "originalDocumentName" TEXT,
    "reviewerFacultyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "LeaveODRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveODRequest_studentId_idx" ON "LeaveODRequest"("studentId");

-- CreateIndex
CREATE INDEX "LeaveODRequest_reviewerFacultyId_idx" ON "LeaveODRequest"("reviewerFacultyId");

-- CreateIndex
CREATE INDEX "LeaveODRequest_status_idx" ON "LeaveODRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalHistory_requestId_idx" ON "ApprovalHistory"("requestId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_actorUserId_idx" ON "ApprovalHistory"("actorUserId");

-- AddForeignKey
ALTER TABLE "LeaveODRequest" ADD CONSTRAINT "LeaveODRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveODRequest" ADD CONSTRAINT "LeaveODRequest_reviewerFacultyId_fkey" FOREIGN KEY ("reviewerFacultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveODRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
