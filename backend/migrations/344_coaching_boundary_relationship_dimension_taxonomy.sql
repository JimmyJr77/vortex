-- Repair the candidate-only progression and regression edges authored by
-- migration 342 so every dimension uses the canonical controlled vocabulary.
--
-- This migration remains fail-closed around reviewed relationship decisions,
-- creates no approval, and never adds exercise skill/proficiency levels.
-- Exercise difficulty remains exercise complexity plus physical difficulty,
-- with overall derived as their maximum. IDEMPOTENT.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '344_coaching_boundary_relationship_dimension_taxonomy';
  protected_records INTEGER;
  protected_metadata_records INTEGER;
  repaired_records INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO protected_records
  FROM coaching.exercise_relationship_v1 relationship
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.id = relationship.from_variant_id
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = source_variant.definition_id
  WHERE definition.slug IN (
      'dead-bug-wall-press',
      'medicine-ball-dead-bug-press',
      'lateral-hop-to-stick',
      'medicine-ball-chest-pass',
      'med-ball-countermovement-rotational-throw'
    )
    AND relationship.relationship IN ('progression', 'regression')
    AND relationship.dimensions
      && ARRAY[
        'range_or_amplitude',
        'coordination',
        'physical_difficulty'
      ]::TEXT[]
    AND (
      relationship.review_status <> 'review'
      OR relationship.reviewed_by IS NOT NULL
      OR relationship.reviewed_at IS NOT NULL
    );

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % reviewed relationship records',
      migration_key,
      protected_records;
  END IF;

  UPDATE coaching.exercise_relationship_v1 relationship
  SET dimensions = ARRAY['range', 'complexity', 'load']::TEXT[],
      review_status = 'review',
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now()
  FROM coaching.exercise_variant_v1 source_variant,
       coaching.exercise_definition_v1 definition
  WHERE source_variant.id = relationship.from_variant_id
    AND definition.id = source_variant.definition_id
    AND definition.slug IN (
      'dead-bug-wall-press',
      'medicine-ball-dead-bug-press',
      'lateral-hop-to-stick',
      'medicine-ball-chest-pass',
      'med-ball-countermovement-rotational-throw'
    )
    AND relationship.relationship IN ('progression', 'regression')
    AND relationship.dimensions
      && ARRAY[
        'range_or_amplitude',
        'coordination',
        'physical_difficulty'
      ]::TEXT[];

  GET DIAGNOSTICS repaired_records = ROW_COUNT;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_relationship_v1 relationship
    JOIN coaching.exercise_variant_v1 source_variant
      ON source_variant.id = relationship.from_variant_id
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id = source_variant.definition_id
    WHERE definition.slug IN (
        'dead-bug-wall-press',
        'medicine-ball-dead-bug-press',
        'lateral-hop-to-stick',
        'medicine-ball-chest-pass',
        'med-ball-countermovement-rotational-throw'
      )
      AND relationship.relationship IN ('progression', 'regression')
      AND EXISTS (
        SELECT 1
        FROM unnest(relationship.dimensions) AS dimension(value)
        WHERE dimension.value <> ALL (
          ARRAY[
            'load',
            'leverage',
            'range',
            'speed',
            'stability',
            'complexity',
            'impact',
            'decision_demand',
            'fatigue'
          ]::TEXT[]
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% left a non-canonical progression dimension',
      migration_key;
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1 definition
      WHERE definition.provenance_json
          ? 'exerciseSkillLevelAllowed'
        AND (
          definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE (
          variant.requirements_json ? 'exerciseSkillLevel'
          OR variant.requirements_json
            ? 'exerciseSkillLevelAllowed'
        )
        AND (
          variant.status = 'published'
          OR definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      LEFT JOIN coaching.exercise_definition_v1 definition
        ON definition.legacy_exercise_id = score.exercise_id
      WHERE (
          score.legacy_scores ? 'exerciseSkillLevel'
          OR score.legacy_scores ? 'exerciseSkillLevelAllowed'
        )
        AND (
          score.human_review_status = 'approved'
          OR score.reviewed_by IS NOT NULL
          OR definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise legacy
      JOIN coaching.exercise_definition_v1 definition
        ON definition.legacy_exercise_id = legacy.id
      WHERE (
          legacy.programming_logic ? 'exerciseSkillLevel'
          OR legacy.programming_logic
            ? 'exerciseSkillLevelAllowed'
        )
        AND (
          definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
        )
    )
  INTO protected_metadata_records;

  IF protected_metadata_records > 0 THEN
    RAISE EXCEPTION
      '% refused to remove obsolete metadata from % reviewed records',
      migration_key,
      protected_metadata_records;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET provenance_json =
        definition.provenance_json - 'exerciseSkillLevelAllowed',
      updated_at = CASE
        WHEN definition.provenance_json ? 'exerciseSkillLevelAllowed'
          THEN now()
        ELSE definition.updated_at
      END
  WHERE definition.provenance_json ? 'exerciseSkillLevelAllowed';

  UPDATE coaching.exercise_variant_v1 variant
  SET requirements_json =
        variant.requirements_json
          - ARRAY[
            'exerciseSkillLevel',
            'exerciseSkillLevelAllowed'
          ]::TEXT[],
      updated_at = CASE
        WHEN variant.requirements_json ? 'exerciseSkillLevel'
          OR variant.requirements_json ? 'exerciseSkillLevelAllowed'
          THEN now()
        ELSE variant.updated_at
      END
  WHERE variant.requirements_json ? 'exerciseSkillLevel'
    OR variant.requirements_json ? 'exerciseSkillLevelAllowed';

  UPDATE coaching.exercise_score_v1 score
  SET legacy_scores =
        score.legacy_scores
          - ARRAY[
            'exerciseSkillLevel',
            'exerciseSkillLevelAllowed'
          ]::TEXT[],
      updated_at = CASE
        WHEN score.legacy_scores ? 'exerciseSkillLevel'
          OR score.legacy_scores ? 'exerciseSkillLevelAllowed'
          THEN now()
        ELSE score.updated_at
      END
  WHERE score.legacy_scores ? 'exerciseSkillLevel'
    OR score.legacy_scores ? 'exerciseSkillLevelAllowed';

  UPDATE coaching.exercise legacy
  SET skill_level = NULL,
      programming_logic =
        legacy.programming_logic
          - ARRAY[
            'exerciseSkillLevel',
            'exerciseSkillLevelAllowed'
          ]::TEXT[],
      updated_at = CASE
        WHEN legacy.skill_level IS NOT NULL
          OR legacy.programming_logic ? 'exerciseSkillLevel'
          OR legacy.programming_logic ? 'exerciseSkillLevelAllowed'
          THEN now()
        ELSE legacy.updated_at
      END
  WHERE legacy.skill_level IS NOT NULL
    OR legacy.programming_logic ? 'exerciseSkillLevel'
    OR legacy.programming_logic ? 'exerciseSkillLevelAllowed';

  UPDATE coaching.exercise_scaling_profile profile
  SET skill_level = NULL
  WHERE profile.skill_level IS NOT NULL;

  UPDATE coaching.exercise_safety_profile profile
  SET minimum_skill_level = NULL
  WHERE profile.minimum_skill_level IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT 1
      FROM coaching.exercise
      WHERE skill_level IS NOT NULL
        OR programming_logic ? 'exerciseSkillLevel'
        OR programming_logic ? 'exerciseSkillLevelAllowed'
      UNION ALL
      SELECT 1
      FROM coaching.exercise_scaling_profile
      WHERE skill_level IS NOT NULL
      UNION ALL
      SELECT 1
      FROM coaching.exercise_safety_profile
      WHERE minimum_skill_level IS NOT NULL
      UNION ALL
      SELECT 1
      FROM coaching.exercise_definition_v1
      WHERE provenance_json ? 'exerciseSkillLevelAllowed'
      UNION ALL
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE requirements_json ? 'exerciseSkillLevel'
        OR requirements_json ? 'exerciseSkillLevelAllowed'
      UNION ALL
      SELECT 1
      FROM coaching.exercise_score_v1
      WHERE legacy_scores ? 'exerciseSkillLevel'
        OR legacy_scores ? 'exerciseSkillLevelAllowed'
    ) violation
  ) THEN
    RAISE EXCEPTION
      '% found an exercise skill/proficiency level',
      migration_key;
  END IF;

  RAISE NOTICE
    '% repaired % candidate relationship records',
    migration_key,
    repaired_records;
END
$$;
