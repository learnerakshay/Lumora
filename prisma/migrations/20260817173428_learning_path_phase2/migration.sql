-- CreateEnum
CREATE TYPE "LearningPlanStatus" AS ENUM ('BUILDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "LearningPlanStatus" NOT NULL DEFAULT 'BUILDING',
    "roleId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "narrativeModel" TEXT,
    "selectedGapIds" JSONB NOT NULL,
    "path" JSONB,
    "readiness" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningWorkspaceLink" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningWorkspaceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningPlan_userId_idx" ON "LearningPlan"("userId");

-- CreateIndex
CREATE INDEX "LearningPlan_analysisId_idx" ON "LearningPlan"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_userId_version_key" ON "LearningPlan"("userId", "version");

-- CreateIndex
CREATE INDEX "LearningWorkspaceLink_planId_idx" ON "LearningWorkspaceLink"("planId");

-- CreateIndex
CREATE INDEX "LearningWorkspaceLink_workspaceId_idx" ON "LearningWorkspaceLink"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningWorkspaceLink_planId_workspaceId_key" ON "LearningWorkspaceLink"("planId", "workspaceId");

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "RoleAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningWorkspaceLink" ADD CONSTRAINT "LearningWorkspaceLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningWorkspaceLink" ADD CONSTRAINT "LearningWorkspaceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
