-- CreateEnum
CREATE TYPE "ScheduledExamStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateAssignmentStatus" AS ENUM ('ASSIGNED', 'STARTED', 'COMPLETED', 'ABSENT');

-- CreateTable
CREATE TABLE "scheduled_exams" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "status" "ScheduledExamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_exam_candidates" (
    "id" TEXT NOT NULL,
    "scheduled_exam_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "status" "CandidateAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "session_id" TEXT,

    CONSTRAINT "scheduled_exam_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_exam_candidates_scheduled_exam_id_candidate_id_key" ON "scheduled_exam_candidates"("scheduled_exam_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "scheduled_exams" ADD CONSTRAINT "scheduled_exams_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_exams" ADD CONSTRAINT "scheduled_exams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_exam_candidates" ADD CONSTRAINT "scheduled_exam_candidates_scheduled_exam_id_fkey" FOREIGN KEY ("scheduled_exam_id") REFERENCES "scheduled_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_exam_candidates" ADD CONSTRAINT "scheduled_exam_candidates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
