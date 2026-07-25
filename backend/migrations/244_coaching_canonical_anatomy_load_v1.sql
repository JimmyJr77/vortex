-- Multidimensional anatomy, loading, and fatigue data for canonical cards.
-- JSON contracts are validated by the authoring service before publication.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_definition_v1
  ADD COLUMN IF NOT EXISTS anatomy_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE coaching.exercise_variant_v1
  ADD COLUMN IF NOT EXISTS load_profile_json JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fatigue_profile_json JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS exercise_definition_v1_anatomy_gin_idx
  ON coaching.exercise_definition_v1 USING GIN (anatomy_json);

CREATE INDEX IF NOT EXISTS exercise_variant_v1_load_profile_gin_idx
  ON coaching.exercise_variant_v1 USING GIN (load_profile_json);
