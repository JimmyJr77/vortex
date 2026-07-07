-- Repair Needs Engine template tables when 218/224 failed on coaching.facility FK typo.
-- IDEMPOTENT. Canonical facility FK is public.facility(id) (see coaching.exercise).

CREATE TABLE IF NOT EXISTS coaching.coach_phase_template (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  coach_user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  phase_plan_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_coach_phase_template_facility_coach
  ON coaching.coach_phase_template (facility_id, coach_user_id)
  WHERE archived = FALSE;

CREATE TABLE IF NOT EXISTS coaching.coach_needs_engine_requirements (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  coach_user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  requirements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_coach_needs_engine_requirements_facility_coach
  ON coaching.coach_needs_engine_requirements (facility_id, coach_user_id)
  WHERE archived = FALSE;

ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS audience_splits_json JSONB;

ALTER TABLE coaching.workout_item
  ADD COLUMN IF NOT EXISTS split_alternates_json JSONB;
