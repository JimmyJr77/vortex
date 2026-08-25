-- Facility-scoped, fail-closed rollout controls for the canonical generator.
-- This migration creates no enabled facility and changes no existing release.

CREATE TABLE IF NOT EXISTS coaching.canonical_generator_facility_rollout_v1 (
  facility_id BIGINT PRIMARY KEY REFERENCES public.facility(id) ON DELETE CASCADE,
  rollout_stage TEXT NOT NULL DEFAULT 'disabled'
    CHECK (rollout_stage IN ('disabled', 'shadow', 'coach', 'member')),
  canonical_contract_read BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_score_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_generator_shadow BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_generator_coach_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_ai_intent BOOLEAN NOT NULL DEFAULT FALSE,
  canonical_generator_default BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT canonical_ai_intent OR canonical_generator_coach_opt_in),
  CHECK (NOT canonical_generator_coach_opt_in OR canonical_generator_shadow),
  CHECK (NOT canonical_generator_default OR canonical_generator_coach_opt_in)
);

CREATE INDEX IF NOT EXISTS canonical_generator_facility_rollout_stage_idx
  ON coaching.canonical_generator_facility_rollout_v1 (rollout_stage)
  WHERE rollout_stage <> 'disabled';
