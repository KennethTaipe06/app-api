-- AlterTable: make test_id nullable on scheduled_exams (null = full battery of 4 tests)
ALTER TABLE "scheduled_exams" ALTER COLUMN "test_id" DROP NOT NULL;

-- AlterTable: add scheduled_exam_id to exam_sessions for battery linking
ALTER TABLE "exam_sessions" ADD COLUMN "scheduled_exam_id" TEXT;

-- CreateIndex
CREATE INDEX "exam_sessions_scheduled_exam_id_idx" ON "exam_sessions"("scheduled_exam_id");

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_scheduled_exam_id_fkey" FOREIGN KEY ("scheduled_exam_id") REFERENCES "scheduled_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
