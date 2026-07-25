-- Baseline schema that existed before the Phase 7 repair migrations.
-- Later migrations intentionally evolve these tables to the current schema.

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "SourceType" AS ENUM (
  'PDF',
  'WEBSITE',
  'YOUTUBE',
  'VTT',
  'TEXT'
);

CREATE TYPE "SourceStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "MessageRole" AS ENUM (
  'USER',
  'ASSISTANT',
  'SYSTEM'
);

CREATE TYPE "MessageStatus" AS ENUM (
  'SENDING',
  'SUCCESS',
  'ERROR'
);

CREATE TYPE "AnswerMode" AS ENUM (
  'CONCISE',
  'DETAILED',
  'CRITICAL',
  'CREATIVE'
);

CREATE TYPE "CitationKind" AS ENUM (
  'DOCUMENT',
  'WEB',
  'CALCULATION'
);

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT DEFAULT 'folder',
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Source" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "SourceType" NOT NULL,
  "status" "SourceStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceContent" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "rawContent" TEXT NOT NULL,
  "cleanText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chunk" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "chunkIndex" INTEGER NOT NULL DEFAULT 0,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "mode" "AnswerMode" NOT NULL DEFAULT 'DETAILED',
  "status" "MessageStatus" NOT NULL DEFAULT 'SUCCESS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Citation" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "chunkId" TEXT,
  "title" TEXT NOT NULL,
  "snippet" TEXT NOT NULL,
  "kind" "CitationKind" NOT NULL DEFAULT 'DOCUMENT',
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

CREATE INDEX "Source_workspaceId_idx" ON "Source"("workspaceId");
CREATE INDEX "Source_type_idx" ON "Source"("type");
CREATE INDEX "Source_status_idx" ON "Source"("status");

CREATE INDEX "SourceContent_sourceId_idx" ON "SourceContent"("sourceId");

CREATE INDEX "Chunk_sourceId_idx" ON "Chunk"("sourceId");
CREATE INDEX "Chunk_workspaceId_idx" ON "Chunk"("workspaceId");

CREATE INDEX "Message_workspaceId_idx" ON "Message"("workspaceId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

CREATE INDEX "Citation_messageId_idx" ON "Citation"("messageId");
CREATE INDEX "Citation_chunkId_idx" ON "Citation"("chunkId");

ALTER TABLE "Source"
ADD CONSTRAINT "Source_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceContent"
ADD CONSTRAINT "SourceContent_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chunk"
ADD CONSTRAINT "Chunk_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chunk"
ADD CONSTRAINT "Chunk_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_chunkId_fkey"
FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
