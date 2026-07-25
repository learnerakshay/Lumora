CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "SourceIndexStatus" AS ENUM ('BUILDING', 'READY', 'SUPERSEDED');

CREATE TABLE "SourceIndex" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  "chunkVersion" TEXT NOT NULL,
  "status" "SourceIndexStatus" NOT NULL DEFAULT 'BUILDING',
  "expectedChunkCount" INTEGER NOT NULL,
  "embeddingProvider" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingVersion" TEXT NOT NULL,
  "vectorDimensions" INTEGER NOT NULL,
  "indexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceIndex_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SourceIndex_expectedChunkCount_check" CHECK ("expectedChunkCount" > 0),
  CONSTRAINT "SourceIndex_vectorDimensions_check" CHECK ("vectorDimensions" = 1536)
);

ALTER TABLE "Source"
ADD COLUMN "activeIndexId" TEXT;

ALTER TABLE "Chunk"
ADD COLUMN "indexId" TEXT,
ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "Source_activeIndexId_key"
ON "Source"("activeIndexId");
CREATE INDEX "SourceIndex_sourceId_idx"
ON "SourceIndex"("sourceId");
CREATE INDEX "SourceIndex_sourceId_sourceVersion_idx"
ON "SourceIndex"("sourceId", "sourceVersion");
CREATE INDEX "SourceIndex_status_idx"
ON "SourceIndex"("status");
CREATE INDEX "Chunk_indexId_idx"
ON "Chunk"("indexId");
CREATE UNIQUE INDEX "Chunk_indexId_chunkIndex_key"
ON "Chunk"("indexId", "chunkIndex");

ALTER TABLE "SourceIndex"
ADD CONSTRAINT "SourceIndex_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Source"
ADD CONSTRAINT "Source_activeIndexId_fkey"
FOREIGN KEY ("activeIndexId") REFERENCES "SourceIndex"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Chunk"
ADD CONSTRAINT "Chunk_indexId_fkey"
FOREIGN KEY ("indexId") REFERENCES "SourceIndex"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Chunk_embedding_hnsw_cosine_idx"
ON "Chunk" USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL AND "indexId" IS NOT NULL;

-- Existing vectors may have been fabricated, padded, or only partially written.
-- Keep their rows for audit/citation integrity, but make them inactive and force
-- explicit reprocessing before the source can truthfully be considered complete.
UPDATE "Source"
SET
  status = 'FAILED',
  stage = 'FAILED',
  metadata = COALESCE(metadata, '{}'::jsonb) ||
    '{"vectorMigration":"Re-index required: legacy vectors were not integrity-verifiable."}'::jsonb
WHERE status = 'COMPLETED';
