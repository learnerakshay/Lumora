-- AlterTable
ALTER TABLE "User" ADD COLUMN "isFaculty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasSeenFacultyWelcome" BOOLEAN NOT NULL DEFAULT false;
