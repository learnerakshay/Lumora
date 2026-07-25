CREATE TYPE "ProcessingStage" AS ENUM (
  'CREATED',
  'QUEUED',
  'PROCESSING',
  'FETCHING',
  'PARSING',
  'CHUNKING',
  'READY_FOR_INDEXING',
  'EMBEDDING',
  'INDEXING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "Source"
ADD COLUMN "stage" "ProcessingStage" NOT NULL DEFAULT 'CREATED',
ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SourceContent"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "originalContent" TEXT,
ADD COLUMN "artifactData" BYTEA,
ADD COLUMN "artifactFileName" TEXT,
ADD COLUMN "artifactMimeType" TEXT,
ADD COLUMN "artifactSize" INTEGER,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "parserMetadata" JSONB,
ADD COLUMN "parserVersion" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "checksum" TEXT NOT NULL DEFAULT '',
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "sourceId" ORDER BY "createdAt", id)::INTEGER AS version
  FROM "SourceContent"
)
UPDATE "SourceContent" AS content
SET
  version = ranked.version,
  "originalContent" = content."rawContent",
  checksum = MD5(content."rawContent"),
  "processingStartedAt" = content."createdAt",
  "processedAt" = content."createdAt"
FROM ranked
WHERE content.id = ranked.id;

UPDATE "SourceContent" AS content
SET
  "sourceUrl" = source.metadata->>'url',
  "artifactFileName" = source.metadata->>'originalFileName',
  "artifactMimeType" = CASE source.type
    WHEN 'PDF' THEN 'application/pdf'
    WHEN 'VTT' THEN 'text/vtt'
    WHEN 'TEXT' THEN 'text/plain'
    WHEN 'WEBSITE' THEN 'text/html'
    WHEN 'YOUTUBE' THEN 'application/vnd.lumora.youtube-transcript+json'
  END
FROM "Source" AS source
WHERE content."sourceId" = source.id;

UPDATE "Source" AS source
SET
  "currentVersion" = COALESCE(contents.max_version, 1),
  stage = CASE source.status
    WHEN 'COMPLETED' THEN 'COMPLETED'::"ProcessingStage"
    WHEN 'FAILED' THEN 'FAILED'::"ProcessingStage"
    WHEN 'PROCESSING' THEN 'PROCESSING'::"ProcessingStage"
    ELSE 'CREATED'::"ProcessingStage"
  END
FROM (
  SELECT "sourceId", MAX(version) AS max_version
  FROM "SourceContent"
  GROUP BY "sourceId"
) AS contents
WHERE source.id = contents."sourceId";

ALTER TABLE "SourceContent"
ALTER COLUMN "parserVersion" DROP DEFAULT,
ALTER COLUMN "checksum" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX "SourceContent_sourceId_version_key"
ON "SourceContent"("sourceId", "version");

CREATE TABLE "SourceProcessingAttempt" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "stage" "ProcessingStage" NOT NULL DEFAULT 'CREATED',
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceProcessingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceProcessingEvent" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "stage" "ProcessingStage" NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceProcessingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceProcessingAttempt_sourceId_version_key"
ON "SourceProcessingAttempt"("sourceId", "version");
CREATE INDEX "SourceProcessingAttempt_sourceId_idx"
ON "SourceProcessingAttempt"("sourceId");
CREATE INDEX "SourceProcessingAttempt_stage_idx"
ON "SourceProcessingAttempt"("stage");
CREATE INDEX "SourceProcessingEvent_attemptId_idx"
ON "SourceProcessingEvent"("attemptId");
CREATE INDEX "SourceProcessingEvent_createdAt_idx"
ON "SourceProcessingEvent"("createdAt");

ALTER TABLE "SourceProcessingAttempt"
ADD CONSTRAINT "SourceProcessingAttempt_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceProcessingEvent"
ADD CONSTRAINT "SourceProcessingEvent_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "SourceProcessingAttempt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
