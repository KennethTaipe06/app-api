-- AlterTable
ALTER TABLE "scheduled_exams" ADD COLUMN "test_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
