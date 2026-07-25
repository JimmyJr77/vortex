-- Reviewed calibration anchors for canonical exercise scoring.
-- Proposals are versioned and require an independent reviewer before becoming active.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_score_calibration_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN (
    'baseOverallDifficulty', 'technicalComplexity', 'supervisionDemand',
    'failureConsequence', 'impact', 'workCapacityDemand',
    'gripDemand', 'spinalLoading', 'eccentricStress',
    'localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity',
    'impactAccumulation'
  )),
  proposed_score SMALLINT NOT NULL CHECK (proposed_score BETWEEN 1 AND 100),
  anchor_tier SMALLINT NOT NULL CHECK (anchor_tier IN (20, 40, 60, 80)),
  rationale TEXT NOT NULL CHECK (length(trim(rationale)) >= 20),
  status TEXT NOT NULL DEFAULT 'review'
    CHECK (status IN ('review', 'approved', 'rejected', 'superseded')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, variant_id, dimension, version)
);

CREATE INDEX IF NOT EXISTS exercise_score_calibration_queue_idx
  ON coaching.exercise_score_calibration_v1 (facility_id, status, dimension, anchor_tier);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_score_calibration_active_idx
  ON coaching.exercise_score_calibration_v1 (facility_id, variant_id, dimension)
  WHERE status = 'approved';
