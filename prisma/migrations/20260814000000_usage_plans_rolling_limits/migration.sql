-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'CORE', 'MAX');

-- CreateEnum
CREATE TYPE "UsageActionType" AS ENUM ('INGESTION', 'CHAT', 'AI_ACTION', 'SKILL_INTELLIGENCE', 'LEARNING_PATH');

-- CreateEnum
CREATE TYPE "UsageEventStatus" AS ENUM ('PENDING', 'COMMITTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Backfill Clerk identities already represented by Workspace ownership.
INSERT INTO "User" ("id")
SELECT DISTINCT "userId"
FROM "Workspace"
WHERE "userId" IS NOT NULL AND "userId" <> ''
ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "UsageActionType" NOT NULL,
    "status" "UsageEventStatus" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_userId_actionType_createdAt_idx" ON "UsageEvent"("userId", "actionType", "createdAt");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
