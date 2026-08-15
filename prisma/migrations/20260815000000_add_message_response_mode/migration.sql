CREATE TYPE "ResponseMode" AS ENUM ('GENERAL', 'GROUNDED');

ALTER TABLE "Message"
ADD COLUMN "responseMode" "ResponseMode";
