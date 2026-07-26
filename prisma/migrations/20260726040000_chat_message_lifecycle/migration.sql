ALTER TABLE "Message"
ADD COLUMN "parentMessageId" TEXT,
ADD COLUMN "action" JSONB,
ADD COLUMN "regenerationStartedAt" TIMESTAMP(3);

UPDATE "Message" AS assistant
SET "parentMessageId" = (
  SELECT candidate.id
  FROM "Message" AS candidate
  WHERE candidate."workspaceId" = assistant."workspaceId"
    AND candidate.role = 'USER'::"MessageRole"
    AND (
      candidate."createdAt" < assistant."createdAt"
      OR (
        candidate."createdAt" = assistant."createdAt"
        AND candidate.id < assistant.id
      )
    )
  ORDER BY candidate."createdAt" DESC, candidate.id DESC
  LIMIT 1
)
WHERE assistant.role = 'ASSISTANT'::"MessageRole";

CREATE UNIQUE INDEX "Message_parentMessageId_key"
ON "Message"("parentMessageId");

CREATE INDEX "Message_parentMessageId_idx"
ON "Message"("parentMessageId");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_parentMessageId_fkey"
FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
