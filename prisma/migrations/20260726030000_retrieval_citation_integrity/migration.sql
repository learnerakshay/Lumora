-- Legacy citations did not persist their source/index provenance, page, URL, or
-- timestamps and therefore cannot be verified against an active index.
DELETE FROM "Citation";

ALTER TABLE "Citation"
DROP CONSTRAINT "Citation_chunkId_fkey";

ALTER TABLE "Citation"
ALTER COLUMN "chunkId" SET NOT NULL,
ADD COLUMN "sourceId" TEXT NOT NULL,
ADD COLUMN "indexId" TEXT NOT NULL,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "pageNumber" INTEGER,
ADD COLUMN "timestampStartMs" INTEGER,
ADD COLUMN "timestampEndMs" INTEGER,
ADD COLUMN "textOrigin" TEXT NOT NULL;

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_chunkId_fkey"
FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_indexId_fkey"
FOREIGN KEY ("indexId") REFERENCES "SourceIndex"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");
CREATE INDEX "Citation_indexId_idx" ON "Citation"("indexId");

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_score_check"
CHECK (score IS NULL OR (score >= -1 AND score <= 1));

ALTER TABLE "Citation"
ADD CONSTRAINT "Citation_timestamp_range_check"
CHECK (
  ("timestampStartMs" IS NULL AND "timestampEndMs" IS NULL)
  OR (
    "timestampStartMs" IS NOT NULL
    AND "timestampEndMs" IS NOT NULL
    AND "timestampStartMs" >= 0
    AND "timestampEndMs" >= "timestampStartMs"
  )
);
