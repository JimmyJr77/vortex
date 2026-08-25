-- Exact-variant movement, athlete-fit, equipment-role, stress, scaling, and
-- composition profiles. Existing JSON remains untouched; deterministic copies
-- are review evidence only and never create approval. The legacy read path can
-- ignore these additive columns for rollback. IDEMPOTENT.

ALTER TABLE coaching.exercise_variant_v1
  ADD COLUMN IF NOT EXISTS movement_geometry_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS anatomy_profile_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS equipment_roles_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS task_demands_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS stress_profile_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS scaling_handles_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS composition_profile_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS structured_profile_review_status TEXT NOT NULL DEFAULT 'suggested',
  ADD COLUMN IF NOT EXISTS structured_profile_provenance_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS structured_profile_created_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structured_profile_reviewed_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structured_profile_reviewed_at TIMESTAMPTZ;

ALTER TABLE coaching.exercise_variant_v1
  DROP CONSTRAINT IF EXISTS exercise_variant_v1_structured_review_status_check;
ALTER TABLE coaching.exercise_variant_v1
  ADD CONSTRAINT exercise_variant_v1_structured_review_status_check
  CHECK (structured_profile_review_status IN ('suggested','review','approved','rejected'));

ALTER TABLE coaching.exercise_variant_v1
  DROP CONSTRAINT IF EXISTS exercise_variant_v1_structured_review_evidence_check;
ALTER TABLE coaching.exercise_variant_v1
  ADD CONSTRAINT exercise_variant_v1_structured_review_evidence_check
  CHECK (
    structured_profile_review_status <> 'approved'
    OR (structured_profile_reviewed_by IS NOT NULL AND structured_profile_reviewed_at IS NOT NULL)
  );

ALTER TABLE coaching.exercise_variant_v1
  DROP CONSTRAINT IF EXISTS exercise_variant_v1_structured_independent_review_check;
ALTER TABLE coaching.exercise_variant_v1
  ADD CONSTRAINT exercise_variant_v1_structured_independent_review_check
  CHECK (
    structured_profile_created_by IS NULL
    OR structured_profile_reviewed_by IS NULL
    OR structured_profile_created_by <> structured_profile_reviewed_by
  );

CREATE TABLE IF NOT EXISTS coaching.exercise_structured_profile_review_v2 (
  id BIGSERIAL PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES coaching.exercise_variant_v1(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  notes TEXT NOT NULL CHECK (length(btrim(notes)) > 0),
  reviewer_user_id BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE RESTRICT,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_structured_profile_review_v2_variant_idx
  ON coaching.exercise_structured_profile_review_v2 (variant_id, created_at DESC);

UPDATE coaching.exercise_variant_v1 variant
SET movement_geometry_json = jsonb_build_object(
      'planes', COALESCE(definition.anatomy_json->'planes', '[]'::JSONB),
      'projections', '[]'::JSONB,
      'directions', '[]'::JSONB,
      'supports', CASE definition.anatomy_json->>'laterality'
        WHEN 'bilateral' THEN '["bilateral"]'::JSONB
        WHEN 'unilateral' THEN '["unilateral"]'::JSONB
        WHEN 'alternating' THEN '["alternating"]'::JSONB
        ELSE '[]'::JSONB END,
      'stances', '[]'::JSONB,
      'limbRelationships', CASE definition.anatomy_json->>'laterality'
        WHEN 'symmetrical' THEN '["symmetrical"]'::JSONB
        WHEN 'asymmetrical' THEN '["asymmetrical"]'::JSONB
        WHEN 'ipsilateral' THEN '["ipsilateral"]'::JSONB
        WHEN 'contralateral' THEN '["contralateral"]'::JSONB
        ELSE '[]'::JSONB END
    )
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = variant.definition_id
  AND variant.movement_geometry_json = '{}'::JSONB;

UPDATE coaching.exercise_variant_v1 variant
SET anatomy_profile_json = jsonb_build_object(
      'assignments', COALESCE((
        SELECT jsonb_agg(item ORDER BY ordinal_group, ordinal)
        FROM (
          SELECT 1 AS ordinal_group, source.ordinality AS ordinal,
                 jsonb_build_object('key', source.value, 'kind', 'muscle', 'role', 'primary_target') AS item
          FROM jsonb_array_elements_text(COALESCE(definition.anatomy_json->'primaryMuscles', '[]'::JSONB)) WITH ORDINALITY source(value, ordinality)
          UNION ALL
          SELECT 2, source.ordinality,
                 jsonb_build_object('key', source.value, 'kind', 'muscle', 'role', 'secondary_target')
          FROM jsonb_array_elements_text(COALESCE(definition.anatomy_json->'secondaryMuscles', '[]'::JSONB)) WITH ORDINALITY source(value, ordinality)
          UNION ALL
          SELECT 3, source.ordinality,
                 jsonb_build_object('key', source.value, 'kind', 'muscle', 'role', 'stabilizer')
          FROM jsonb_array_elements_text(COALESCE(definition.anatomy_json->'stabilizers', '[]'::JSONB)) WITH ORDINALITY source(value, ordinality)
          UNION ALL
          SELECT 4, source.ordinality,
                 jsonb_build_object('key', source.value, 'kind', 'joint', 'role', 'secondary_target')
          FROM jsonb_array_elements_text(COALESCE(definition.anatomy_json->'joints', '[]'::JSONB)) WITH ORDINALITY source(value, ordinality)
          UNION ALL
          SELECT 5, source.ordinality,
                 jsonb_build_object('key', source.value, 'kind', 'joint_action', 'role', 'secondary_target')
          FROM jsonb_array_elements_text(COALESCE(definition.anatomy_json->'jointActions', '[]'::JSONB)) WITH ORDINALITY source(value, ordinality)
        ) candidate
      ), '[]'::JSONB)
    )
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = variant.definition_id
  AND variant.anatomy_profile_json = '{}'::JSONB;

UPDATE coaching.exercise_variant_v1 variant
SET equipment_roles_json = COALESCE((
      SELECT jsonb_agg(assignment ORDER BY role_order, equipment_key)
      FROM (
        SELECT 1 AS role_order, equipment_key,
               jsonb_build_object(
                 'key', equipment_key,
                 'role', 'required',
                 'quantityPerStation', variant.requirements_json->'equipmentQuantityPerStation'->equipment_key,
                 'conditions', '{}'::JSONB
               ) AS assignment
        FROM unnest(definition.required_equipment) equipment_key
        UNION ALL
        SELECT 2, equipment_key,
               jsonb_build_object(
                 'key', equipment_key,
                 'role', 'optional',
                 'quantityPerStation', NULL,
                 'conditions', '{}'::JSONB
               )
        FROM unnest(definition.optional_equipment) equipment_key
      ) equipment
    ), jsonb_build_array(jsonb_build_object(
      'key', 'none', 'role', 'required', 'quantityPerStation', 0,
      'conditions', jsonb_build_object('bodyweightOnly', true)
    )))
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = variant.definition_id
  AND variant.equipment_roles_json = '[]'::JSONB;

UPDATE coaching.exercise_variant_v1
SET task_demands_json = jsonb_build_object(
      'strengthDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.strengthDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.relativeStrengthDemand ? (@.type() == "number")'), 'null'::JSONB),
      'powerDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.powerDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.speedDemand ? (@.type() == "number")'), 'null'::JSONB),
      'mobilityDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.mobilityDemand ? (@.type() == "number")'), 'null'::JSONB),
      'balanceDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.balanceDemand ? (@.type() == "number")'), 'null'::JSONB),
      'coordinationDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.coordinationDemand ? (@.type() == "number")'), 'null'::JSONB),
      'conditioningDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.conditioningDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.workCapacityDemand ? (@.type() == "number")'), 'null'::JSONB),
      'impactToleranceDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.impactToleranceDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.impact ? (@.type() == "number")'), 'null'::JSONB),
      'eccentricControlDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.eccentricControlDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.eccentricTissueStress ? (@.type() == "number")'), 'null'::JSONB),
      'bodyControlDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.bodyControlDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.stabilityDemand ? (@.type() == "number")'), 'null'::JSONB),
      'perceptualDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.perceptualDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.decisionDemand ? (@.type() == "number")'), 'null'::JSONB),
      'attentionDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.attentionDemand ? (@.type() == "number")'), 'null'::JSONB),
      'supervisionDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.supervisionDemand ? (@.type() == "number")'), 'null'::JSONB),
      'failureConsequence', COALESCE(jsonb_path_query_first(difficulty_json, '$.failureConsequence ? (@.type() == "number")'), 'null'::JSONB)
    )
WHERE task_demands_json = '{}'::JSONB;

UPDATE coaching.exercise_variant_v1
SET stress_profile_json = jsonb_build_object(
      'jointStress', COALESCE(jsonb_path_query_first(difficulty_json, '$.jointStress ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.failureConsequence ? (@.type() == "number")'), 'null'::JSONB),
      'tissueStress', COALESCE(jsonb_path_query_first(load_profile_json, '$.eccentricStress ? (@.type() == "number")'), 'null'::JSONB),
      'neuralDemand', COALESCE(jsonb_path_query_first(difficulty_json, '$.powerDemand ? (@.type() == "number")'), jsonb_path_query_first(difficulty_json, '$.speedDemand ? (@.type() == "number")'), 'null'::JSONB),
      'impactStress', COALESCE(jsonb_path_query_first(difficulty_json, '$.impact ? (@.type() == "number")'), 'null'::JSONB),
      'localMuscularFatigue', COALESCE(jsonb_path_query_first(fatigue_profile_json, '$.localMuscleFatigue ? (@.type() == "number")'), 'null'::JSONB),
      'systemicFatigue', COALESCE(jsonb_path_query_first(difficulty_json, '$.workCapacityDemand ? (@.type() == "number")'), 'null'::JSONB),
      'gripFatigue', COALESCE(jsonb_path_query_first(fatigue_profile_json, '$.gripFatigue ? (@.type() == "number")'), 'null'::JSONB),
      'conditioningFatigue', COALESCE(jsonb_path_query_first(difficulty_json, '$.workCapacityDemand ? (@.type() == "number")'), 'null'::JSONB),
      'recoveryCost', CASE
        WHEN jsonb_typeof(fatigue_profile_json->'recoveryHours') = 'number'
          THEN to_jsonb(GREATEST(1, LEAST(100, round((fatigue_profile_json->>'recoveryHours')::numeric / 1.68))))
        ELSE 'null'::JSONB END,
      'bodyRegionStress', '[]'::JSONB,
      'jointStressTargets', '[]'::JSONB,
      'tissueStressTargets', '[]'::JSONB
    )
WHERE stress_profile_json = '{}'::JSONB;

UPDATE coaching.exercise_variant_v1
SET composition_profile_json = jsonb_build_object(
      'preparesFor', COALESCE(programming_profile_json->'sequenceRules'->'preferredBefore', '[]'::JSONB),
      'preferredAfter', COALESCE(programming_profile_json->'sequenceRules'->'preferredAfter', '[]'::JSONB),
      'avoidAfter', COALESCE(programming_profile_json->'sequenceRules'->'avoidAfter', '[]'::JSONB),
      'avoidSameSession', COALESCE(programming_profile_json->'pairingCompatibility'->'incompatible', '[]'::JSONB),
      'pairsWith', COALESCE(programming_profile_json->'pairingCompatibility'->'recommended', '[]'::JSONB),
      'acceptablePairs', COALESCE(programming_profile_json->'pairingCompatibility'->'acceptable', '[]'::JSONB),
      'interferenceRules', COALESCE(programming_profile_json->'interferenceRules', '[]'::JSONB)
    )
WHERE composition_profile_json = '{}'::JSONB;

UPDATE coaching.exercise_variant_v1
SET structured_profile_review_status = 'suggested',
    structured_profile_provenance_json = jsonb_build_object(
      'schemaVersion', '2.0.0',
      'sourceType', 'deterministic_legacy_backfill',
      'sourceFields', jsonb_build_array(
        'definition.anatomy_json', 'definition.required_equipment',
        'definition.optional_equipment', 'variant.difficulty_json',
        'variant.requirements_json', 'variant.load_profile_json',
        'variant.fatigue_profile_json', 'variant.programming_profile_json'
      ),
      'approvalCreated', false,
      'humanReviewRequired', true
    ),
    structured_profile_reviewed_by = NULL,
    structured_profile_reviewed_at = NULL
WHERE structured_profile_provenance_json = '{}'::JSONB;

CREATE INDEX IF NOT EXISTS exercise_variant_v1_movement_geometry_gin_idx
  ON coaching.exercise_variant_v1 USING GIN (movement_geometry_json);
CREATE INDEX IF NOT EXISTS exercise_variant_v1_task_demands_gin_idx
  ON coaching.exercise_variant_v1 USING GIN (task_demands_json);
CREATE INDEX IF NOT EXISTS exercise_variant_v1_stress_profile_gin_idx
  ON coaching.exercise_variant_v1 USING GIN (stress_profile_json);
CREATE INDEX IF NOT EXISTS exercise_variant_v1_structured_review_idx
  ON coaching.exercise_variant_v1 (structured_profile_review_status, status);
