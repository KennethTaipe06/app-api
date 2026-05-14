-- Add quantitative IAP (Indice de Adecuacion al Puesto) fields to AI recommendations
ALTER TABLE "ai_recommendations"
  ADD COLUMN "iap_score" INTEGER,
  ADD COLUMN "iap_breakdown" JSONB,
  ADD COLUMN "dictamen" TEXT,
  ADD COLUMN "invalidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "invalidation_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ai_recommendations_scheduled_exam_id_idx" ON "ai_recommendations"("scheduled_exam_id");
CREATE INDEX "ai_recommendations_iap_score_idx" ON "ai_recommendations"("iap_score");
