-- Operational card data consumed by generation, coach delivery, member
-- guidance, accessibility, and support workflows.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_definition_v1
  ADD COLUMN IF NOT EXISTS athlete_support_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coach_support_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS support_operations_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE coaching.exercise_variant_v1
  ADD COLUMN IF NOT EXISTS programming_profile_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE coaching.exercise_delivery_profile_v1
  ADD COLUMN IF NOT EXISTS time_model_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dose_scaling_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS measurement_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS support_prompts_json JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS exercise_variant_programming_profile_gin_idx
  ON coaching.exercise_variant_v1 USING GIN (programming_profile_json);

UPDATE coaching.exercise_definition_v1
SET provenance_json = provenance_json || jsonb_build_object(
      'operational_support_review_required', TRUE,
      'publication_quarantined', TRUE
    ),
    updated_at = now()
WHERE status IN ('draft', 'review')
  AND provenance_json->>'operational_support_review_required' IS DISTINCT FROM 'true';
