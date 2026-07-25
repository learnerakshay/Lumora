DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Workspace" WHERE "userId" IS NULL) THEN
    RAISE EXCEPTION
      'Workspace.userId contains NULL values. Assign each legacy workspace to a Clerk user or delete it before applying this migration.';
  END IF;
END
$$;

ALTER TABLE "Workspace"
ALTER COLUMN "userId" SET NOT NULL;
