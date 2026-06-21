-- ============================================================
-- Coaching Module: Video submission assignments (Phase G extension)
-- Migration: 029_coaching_video_submission_assign.sql
-- IDEMPOTENT
-- ============================================================

-- Expand plan_assignment assignable + target types; allow null assignable_id for custom video requests
ALTER TABLE coaching.plan_assignment
  DROP CONSTRAINT IF EXISTS plan_assignment_assignable_type_check;

ALTER TABLE coaching.plan_assignment
  ADD CONSTRAINT plan_assignment_assignable_type_check
  CHECK (assignable_type IN ('workout', 'training_program', 'challenge', 'video_submission'));

ALTER TABLE coaching.plan_assignment
  DROP CONSTRAINT IF EXISTS plan_assignment_target_type_check;

ALTER TABLE coaching.plan_assignment
  ADD CONSTRAINT plan_assignment_target_type_check
  CHECK (target_type IN (
    'member', 'class', 'family',
    'program', 'offering', 'scheduling_class', 'primary_sport'
  ));

ALTER TABLE coaching.plan_assignment
  ALTER COLUMN assignable_id DROP NOT NULL;

-- Athlete commentary on form review submissions
ALTER TABLE coaching.form_review_submission
  ADD COLUMN IF NOT EXISTS athlete_comment TEXT,
  ADD COLUMN IF NOT EXISTS self_critique TEXT,
  ADD COLUMN IF NOT EXISTS athlete_questions TEXT;

-- One pending submission per assignment per member
DROP INDEX IF EXISTS coaching.idx_coaching_form_review_one_pending_assignment;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaching_form_review_one_pending_assignment
  ON coaching.form_review_submission(member_id, assignment_id)
  WHERE status = 'pending' AND assignment_id IS NOT NULL;

-- Coach saved request note templates
CREATE TABLE IF NOT EXISTS coaching.coach_note_template (
  id              BIGSERIAL PRIMARY KEY,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  coach_user_id   BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  body            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'video_submission_request',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_note_template_coach
  ON coaching.coach_note_template(coach_user_id, kind);
