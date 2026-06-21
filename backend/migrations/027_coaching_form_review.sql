-- ============================================================
-- Coaching Module: Video form review (Phase G remainder)
-- Migration: 027_coaching_form_review.sql
-- IDEMPOTENT
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.form_review_submission (
  id                BIGSERIAL PRIMARY KEY,
  facility_id       BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  member_id         BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  exercise_id       BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  assignment_id     BIGINT REFERENCES coaching.plan_assignment(id) ON DELETE SET NULL,
  subject           TEXT,
  video_url         TEXT NOT NULL,
  video_public_id   TEXT,
  duration_seconds  INTEGER,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'archived')),
  visibility_scope  TEXT NOT NULL DEFAULT 'assigned_coach' CHECK (visibility_scope IN ('assigned_coach', 'coaching_circle')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_form_review_facility_status
  ON coaching.form_review_submission(facility_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coaching_form_review_member
  ON coaching.form_review_submission(member_id, created_at DESC);

-- One pending submission per exercise per member
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_form_review_one_pending_exercise
  ON coaching.form_review_submission(member_id, exercise_id)
  WHERE status = 'pending' AND exercise_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.form_review_response (
  id              BIGSERIAL PRIMARY KEY,
  submission_id   BIGINT NOT NULL REFERENCES coaching.form_review_submission(id) ON DELETE CASCADE,
  coach_user_id   BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE CASCADE,
  rubric_id       BIGINT REFERENCES coaching.rubric(id) ON DELETE SET NULL,
  criterion_scores JSONB NOT NULL DEFAULT '{}',
  note            TEXT,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_form_review_response_submission
  ON coaching.form_review_response(submission_id);
