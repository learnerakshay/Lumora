-- CreateEnum
CREATE TYPE "SkillProfileStatus" AS ENUM ('EXTRACTING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "SkillProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SkillProfileStatus" NOT NULL DEFAULT 'EXTRACTING',
    "sourceKind" TEXT NOT NULL,
    "extraction" JSONB,
    "normalizedSkills" JSONB,
    "extractionModel" TEXT,
    "contractVersion" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAnalysis" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "selectedRoles" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillProfile_userId_version_key" ON "SkillProfile"("userId", "version");

-- CreateIndex
CREATE INDEX "SkillProfile_userId_idx" ON "SkillProfile"("userId");

-- CreateIndex
CREATE INDEX "RoleAnalysis_profileId_idx" ON "RoleAnalysis"("profileId");

-- AddForeignKey
ALTER TABLE "SkillProfile" ADD CONSTRAINT "SkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAnalysis" ADD CONSTRAINT "RoleAnalysis_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SkillProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
