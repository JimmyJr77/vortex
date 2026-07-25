-- Canonical generator review, edit, athlete feedback, and AI audit telemetry.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.generated_workout_review_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_workout_id UUID NOT NULL REFERENCES coaching.generated_workout_v1(id) ON DELETE CASCADE,
  reviewer_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('keep', 'minor_edit', 'major_edit', 'reject')),
  safety_score SMALLINT CHECK (safety_score BETWEEN 1 AND 100),
  objective_fidelity_score SMALLINT CHECK (objective_fidelity_score BETWEEN 1 AND 100),
  phase_intent_score SMALLINT CHECK (phase_intent_score BETWEEN 1 AND 100),
  dose_score SMALLINT CHECK (dose_score BETWEEN 1 AND 100),
  athlete_fit_score SMALLINT CHECK (athlete_fit_score BETWEEN 1 AND 100),
  logistics_score SMALLINT CHECK (logistics_score BETWEEN 1 AND 100),
  clarity_score SMALLINT CHECK (clarity_score BETWEEN 1 AND 100),
  overall_score SMALLINT CHECK (overall_score BETWEEN 1 AND 100),
  exercise_count INTEGER NOT NULL DEFAULT 0 CHECK (exercise_count >= 0),
  swap_count INTEGER NOT NULL DEFAULT 0 CHECK (swap_count >= 0),
  dose_edit_count INTEGER NOT NULL DEFAULT 0 CHECK (dose_edit_count >= 0),
  edit_reasons_json JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.generated_workout_athlete_feedback_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_workout_id UUID NOT NULL REFERENCES coaching.generated_workout_v1(id) ON DELETE CASCADE,
  cohort_key TEXT,
  challenge_score SMALLINT CHECK (challenge_score BETWEEN 1 AND 100),
  clarity_score SMALLINT CHECK (clarity_score BETWEEN 1 AND 100),
  pain_or_stop_reported BOOLEAN NOT NULL DEFAULT FALSE,
  feedback_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.ai_workout_intent_audit_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  request_hash TEXT NOT NULL,
  model_version TEXT,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'validated', 'clarification_required', 'invalid', 'service_unavailable'
  )),
  interpreted_intent_json JSONB,
  validation_errors_json JSONB NOT NULL DEFAULT '[]',
  latency_ms INTEGER CHECK (latency_ms >= 0),
  input_tokens INTEGER CHECK (input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens >= 0),
  estimated_cost_micros BIGINT CHECK (estimated_cost_micros >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_workout_review_v1_workout
  ON coaching.generated_workout_review_v1(generated_workout_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_workout_intent_audit_v1_facility
  ON coaching.ai_workout_intent_audit_v1(facility_id, created_at DESC);
