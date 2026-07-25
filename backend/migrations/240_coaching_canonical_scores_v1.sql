-- Canonical workout model, stage 1: parallel 1-100 scores with traceable legacy values.
-- Existing 1-10 columns remain intact until coach calibration and application cutover.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_score_v1 (
  exercise_id BIGINT PRIMARY KEY REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  technical_complexity SMALLINT CHECK (technical_complexity BETWEEN 1 AND 100),
  absolute_load_demand SMALLINT CHECK (absolute_load_demand BETWEEN 1 AND 100),
  coordination_demand SMALLINT CHECK (coordination_demand BETWEEN 1 AND 100),
  impact SMALLINT CHECK (impact BETWEEN 1 AND 100),
  supervision_demand SMALLINT CHECK (supervision_demand BETWEEN 1 AND 100),
  base_overall_difficulty SMALLINT CHECK (base_overall_difficulty BETWEEN 1 AND 100),
  legacy_scores JSONB NOT NULL DEFAULT '{}',
  migration_confidence SMALLINT CHECK (migration_confidence BETWEEN 1 AND 100),
  human_review_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (human_review_status IN ('queued', 'in_review', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.exercise_score_v1 (
  exercise_id,
  technical_complexity,
  absolute_load_demand,
  coordination_demand,
  base_overall_difficulty,
  legacy_scores,
  migration_confidence
)
SELECT
  exercise_id,
  technical * 10,
  load * 10,
  technical * 10,
  overall * 10,
  jsonb_build_object(
    'source_table', 'coaching.exercise_difficulty_profile',
    'source_scale', 10,
    'technical', technical,
    'load', load,
    'coordination_proxy', technical,
    'overall', overall
  ),
  40
FROM coaching.exercise_difficulty_profile
ON CONFLICT (exercise_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_exercise_score_v1_overall
  ON coaching.exercise_score_v1(base_overall_difficulty);
CREATE INDEX IF NOT EXISTS idx_exercise_score_v1_review_queue
  ON coaching.exercise_score_v1(human_review_status)
  WHERE human_review_status != 'approved';
