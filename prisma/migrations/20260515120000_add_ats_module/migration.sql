-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('PENDING', 'EVALUATED', 'FILTERED_OUT', 'EMAIL_SENT', 'CONVERTED');

-- CreateEnum
CREATE TYPE "AcademicLevel" AS ENUM ('BACHILLERATO', 'TECNICO', 'TECNOLOGICO', 'PREGRADO', 'POSTGRADO', 'MAESTRIA', 'DOCTORADO', 'OTRO');

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "job_profile_url" TEXT NOT NULL,
    "job_profile_text" TEXT,
    "top_candidates_count" INTEGER NOT NULL,
    "responsible_email" TEXT NOT NULL,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_posting_questions" (
    "id" TEXT NOT NULL,
    "job_posting_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" TEXT[],
    "correct_option" TEXT NOT NULL,

    CONSTRAINT "job_posting_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "job_posting_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "residence_city" TEXT NOT NULL,
    "residence_province" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cv_url" TEXT NOT NULL,
    "cv_text" TEXT,
    "ai_score" INTEGER,
    "ai_justification" TEXT,
    "ai_evaluated_at" TIMESTAMP(3),
    "ai_error" TEXT,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "filtered_out_reason" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "converted_user_id" TEXT,
    "ip_address" TEXT,
    "fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_academics" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT,
    "year" INTEGER,
    "level" "AcademicLevel" NOT NULL DEFAULT 'OTRO',

    CONSTRAINT "job_application_academics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_experiences" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "job_application_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_application_answers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_option" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,

    CONSTRAINT "job_application_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_slug_key" ON "job_postings"("slug");

-- CreateIndex
CREATE INDEX "job_postings_slug_idx" ON "job_postings"("slug");

-- CreateIndex
CREATE INDEX "job_postings_status_idx" ON "job_postings"("status");

-- CreateIndex
CREATE INDEX "job_postings_created_by_id_idx" ON "job_postings"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_posting_questions_job_posting_id_order_key" ON "job_posting_questions"("job_posting_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_job_posting_id_cedula_key" ON "job_applications"("job_posting_id", "cedula");

-- CreateIndex
CREATE INDEX "job_applications_job_posting_id_status_idx" ON "job_applications"("job_posting_id", "status");

-- CreateIndex
CREATE INDEX "job_applications_job_posting_id_ai_score_idx" ON "job_applications"("job_posting_id", "ai_score");

-- CreateIndex
CREATE INDEX "job_applications_created_at_idx" ON "job_applications"("created_at");

-- CreateIndex
CREATE INDEX "job_application_academics_application_id_idx" ON "job_application_academics"("application_id");

-- CreateIndex
CREATE INDEX "job_application_experiences_application_id_idx" ON "job_application_experiences"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_application_answers_application_id_question_id_key" ON "job_application_answers"("application_id", "question_id");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_posting_questions" ADD CONSTRAINT "job_posting_questions_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_academics" ADD CONSTRAINT "job_application_academics_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_experiences" ADD CONSTRAINT "job_application_experiences_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_answers" ADD CONSTRAINT "job_application_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_application_answers" ADD CONSTRAINT "job_application_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "job_posting_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
