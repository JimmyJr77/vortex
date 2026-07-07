-- Saved Needs Engine requirements: full session inputs + prescription snapshot.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.coach_needs_engine_requirements (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES coaching.facility(id) ON DELETE CASCADE,
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
