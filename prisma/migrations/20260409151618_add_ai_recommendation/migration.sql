-- CreateEnum
CREATE TYPE "AiCalificacion" AS ENUM ('NO_APTA', 'APTITUD_BAJA', 'APTITUD_MEDIA', 'APTITUD_ALTA', 'APTA');

-- DropForeignKey
ALTER TABLE "scheduled_exams" DROP CONSTRAINT "scheduled_exams_test_id_fkey";

-- AlterTable
ALTER TABLE "scheduled_exams" ALTER COLUMN "duration_min" SET DEFAULT 120;

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "scheduled_exam_id" TEXT,
    "calificacion" "AiCalificacion" NOT NULL,
    "resumen" TEXT NOT NULL,
    "fortalezas" TEXT[],
    "riesgos" TEXT[],
    "observaciones" TEXT[],
    "raw_prompt" TEXT,
    "raw_response" TEXT,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_recommendations_candidate_id_idx" ON "ai_recommendations"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_recommendations_candidate_id_scheduled_exam_id_key" ON "ai_recommendations"("candidate_id", "scheduled_exam_id");

-- CreateIndex
CREATE INDEX "answers_session_id_idx" ON "answers"("session_id");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE INDEX "biometric_checks_session_id_idx" ON "biometric_checks"("session_id");

-- CreateIndex
CREATE INDEX "exam_sessions_candidate_id_idx" ON "exam_sessions"("candidate_id");

-- CreateIndex
CREATE INDEX "exam_sessions_examiner_id_idx" ON "exam_sessions"("examiner_id");

-- CreateIndex
CREATE INDEX "exam_sessions_status_idx" ON "exam_sessions"("status");

-- CreateIndex
CREATE INDEX "exam_sessions_candidate_id_status_idx" ON "exam_sessions"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "exam_sessions_created_at_idx" ON "exam_sessions"("created_at");

-- CreateIndex
CREATE INDEX "proctoring_alerts_session_id_idx" ON "proctoring_alerts"("session_id");

-- CreateIndex
CREATE INDEX "proctoring_alerts_type_idx" ON "proctoring_alerts"("type");

-- CreateIndex
CREATE INDEX "recordings_session_id_idx" ON "recordings"("session_id");

-- CreateIndex
CREATE INDEX "scale_results_result_id_idx" ON "scale_results"("result_id");

-- CreateIndex
CREATE INDEX "scale_results_scale_id_idx" ON "scale_results"("scale_id");

-- CreateIndex
CREATE INDEX "scheduled_exam_candidates_candidate_id_idx" ON "scheduled_exam_candidates"("candidate_id");

-- CreateIndex
CREATE INDEX "scheduled_exam_candidates_candidate_id_status_idx" ON "scheduled_exam_candidates"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "scheduled_exams_status_idx" ON "scheduled_exams"("status");

-- CreateIndex
CREATE INDEX "scheduled_exams_created_by_id_idx" ON "scheduled_exams"("created_by_id");

-- CreateIndex
CREATE INDEX "scheduled_exams_scheduled_at_idx" ON "scheduled_exams"("scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_exams_status_scheduled_at_idx" ON "scheduled_exams"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- AddForeignKey
ALTER TABLE "scheduled_exams" ADD CONSTRAINT "scheduled_exams_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_scheduled_exam_id_fkey" FOREIGN KEY ("scheduled_exam_id") REFERENCES "scheduled_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
