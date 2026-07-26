-- Align canonical exercise variants with the exercise-card difficulty model:
--   technical complexity + physical difficulty -> derived overall difficulty.
--
-- This migration only uses existing coaching.exercise_difficulty_profile
-- values. It does not invent missing assessments, approve a score, increase
-- confidence, or publish a card. Definitions without both source dimensions
-- remain incomplete and quarantined for human review.
-- IDEMPOTENT.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_score_v1 score
    JOIN coaching.exercise_difficulty_profile profile
      ON profile.exercise_id = score.exercise_id
    WHERE score.human_review_status = 'approved'
      AND (
        score.technical_complexity IS NULL
        OR score.absolute_load_demand IS NULL
        OR score.base_overall_difficulty IS DISTINCT FROM GREATEST(
          COALESCE(score.technical_complexity, profile.technical * 10),
          COALESCE(score.absolute_load_demand, profile.load * 10)
        )
      )
  ) THEN
    RAISE EXCEPTION
      'Difficulty-model backfill requires human review: an approved score record would change';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id = variant.definition_id
    WHERE (
        jsonb_typeof(variant.difficulty_json->'technicalComplexity')
          IS DISTINCT FROM 'number'
        OR jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand')
          IS DISTINCT FROM 'number'
        OR jsonb_typeof(variant.difficulty_json->'baseOverallDifficulty')
          IS DISTINCT FROM 'number'
        OR CASE
          WHEN
          jsonb_typeof(variant.difficulty_json->'technicalComplexity') = 'number'
            AND jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand') = 'number'
            AND jsonb_typeof(variant.difficulty_json->'baseOverallDifficulty') = 'number'
          THEN (variant.difficulty_json->>'baseOverallDifficulty')::integer
            IS DISTINCT FROM GREATEST(
              (variant.difficulty_json->>'technicalComplexity')::integer,
              (variant.difficulty_json->>'absoluteLoadDemand')::integer
            )
          ELSE FALSE
        END
      )
      AND (
        definition.status = 'published'
        OR variant.status = 'published'
        OR EXISTS (
          SELECT 1
          FROM coaching.exercise_card_review_v1 review
          WHERE review.definition_id = definition.id
            AND review.reviewed_card_version = definition.card_version
            AND review.decision = 'approve'
        )
      )
  ) THEN
    RAISE EXCEPTION
      'Difficulty-model backfill requires human review: a protected card or variant would change';
  END IF;
END
$$;

INSERT INTO coaching.exercise_score_v1 (
  exercise_id,
  technical_complexity,
  absolute_load_demand,
  coordination_demand,
  base_overall_difficulty,
  legacy_scores,
  migration_confidence,
  human_review_status
)
SELECT
  profile.exercise_id,
  profile.technical * 10,
  profile.load * 10,
  profile.technical * 10,
  GREATEST(profile.technical, profile.load) * 10,
  jsonb_build_object(
    'source_table', 'coaching.exercise_difficulty_profile',
    'source_scale', 10,
    'technical', profile.technical,
    'load', profile.load,
    'legacy_overall', profile.overall,
    'source', profile.source,
    'difficulty_model', 'max_technical_physical',
    'migration', '305_coaching_exercise_difficulty_model_backfill'
  ),
  40,
  'queued'
FROM coaching.exercise_difficulty_profile profile
ON CONFLICT (exercise_id) DO UPDATE
SET technical_complexity = COALESCE(
      coaching.exercise_score_v1.technical_complexity,
      EXCLUDED.technical_complexity
    ),
    absolute_load_demand = COALESCE(
      coaching.exercise_score_v1.absolute_load_demand,
      EXCLUDED.absolute_load_demand
    ),
    base_overall_difficulty = GREATEST(
      COALESCE(
        coaching.exercise_score_v1.technical_complexity,
        EXCLUDED.technical_complexity
      ),
      COALESCE(
        coaching.exercise_score_v1.absolute_load_demand,
        EXCLUDED.absolute_load_demand
      )
    ),
    legacy_scores = coaching.exercise_score_v1.legacy_scores
      || jsonb_build_object(
        'difficulty_model_backfill', jsonb_build_object(
          'source_table', 'coaching.exercise_difficulty_profile',
          'source_scale', 10,
          'legacy_overall', EXCLUDED.legacy_scores->'legacy_overall',
          'difficulty_model', 'max_technical_physical',
          'migration', '305_coaching_exercise_difficulty_model_backfill',
          'human_review_required', true
        )
      ),
    updated_at = now()
WHERE (
    coaching.exercise_score_v1.technical_complexity IS NULL
    OR coaching.exercise_score_v1.absolute_load_demand IS NULL
    OR coaching.exercise_score_v1.base_overall_difficulty IS DISTINCT FROM GREATEST(
        COALESCE(
          coaching.exercise_score_v1.technical_complexity,
          EXCLUDED.technical_complexity
        ),
        COALESCE(
          coaching.exercise_score_v1.absolute_load_demand,
          EXCLUDED.absolute_load_demand
        )
      )
  )
  AND coaching.exercise_score_v1.human_review_status != 'approved';

WITH proposed AS (
  SELECT
    definition.id AS definition_id,
    variant.id AS variant_id,
    variant.difficulty_json AS prior_difficulty,
    CASE
      WHEN jsonb_typeof(variant.difficulty_json->'technicalComplexity') = 'number'
        THEN (variant.difficulty_json->>'technicalComplexity')::integer
      ELSE score.technical_complexity
    END AS technical_complexity,
    CASE
      WHEN jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand') = 'number'
        THEN (variant.difficulty_json->>'absoluteLoadDemand')::integer
      ELSE score.absolute_load_demand
    END AS absolute_load_demand
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  LEFT JOIN coaching.exercise_score_v1 score
    ON score.exercise_id = definition.legacy_exercise_id
),
affected AS (
  SELECT *
  FROM proposed
  WHERE technical_complexity IS NOT NULL
    AND absolute_load_demand IS NOT NULL
    AND (
      jsonb_typeof(prior_difficulty->'technicalComplexity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(prior_difficulty->'absoluteLoadDemand') IS DISTINCT FROM 'number'
      OR jsonb_typeof(prior_difficulty->'baseOverallDifficulty') IS DISTINCT FROM 'number'
      OR CASE
        WHEN
          jsonb_typeof(prior_difficulty->'technicalComplexity') = 'number'
          AND jsonb_typeof(prior_difficulty->'absoluteLoadDemand') = 'number'
          AND jsonb_typeof(prior_difficulty->'baseOverallDifficulty') = 'number'
        THEN (prior_difficulty->>'baseOverallDifficulty')::integer
          IS DISTINCT FROM GREATEST(technical_complexity, absolute_load_demand)
        ELSE FALSE
      END
    )
),
definition_evidence AS (
  SELECT
    definition_id,
    jsonb_object_agg(
      variant_id::text,
      jsonb_build_object(
        'priorTechnicalComplexity', prior_difficulty->'technicalComplexity',
        'priorPhysicalDifficulty', prior_difficulty->'absoluteLoadDemand',
        'priorBaseOverallDifficulty', prior_difficulty->'baseOverallDifficulty',
        'technicalComplexity', technical_complexity,
        'physicalDifficulty', absolute_load_demand,
        'derivedOverallDifficulty', GREATEST(
          technical_complexity,
          absolute_load_demand
        )
      )
    ) AS variants
  FROM affected
  GROUP BY definition_id
)
UPDATE coaching.exercise_definition_v1 definition
SET provenance_json = COALESCE(definition.provenance_json, '{}'::jsonb)
    || jsonb_build_object(
      'difficulty_model_backfill', jsonb_build_object(
        'source_table', 'coaching.exercise_difficulty_profile',
        'source_scale', 10,
        'difficulty_model', 'max_technical_physical',
        'migration', '305_coaching_exercise_difficulty_model_backfill',
        'human_review_required', true,
        'variants', evidence.variants
      )
    ),
    updated_at = now()
FROM definition_evidence evidence
WHERE definition.id = evidence.definition_id;

WITH proposed AS (
  SELECT
    variant.id AS variant_id,
    CASE
      WHEN jsonb_typeof(variant.difficulty_json->'technicalComplexity') = 'number'
        THEN (variant.difficulty_json->>'technicalComplexity')::integer
      ELSE score.technical_complexity
    END AS technical_complexity,
    CASE
      WHEN jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand') = 'number'
        THEN (variant.difficulty_json->>'absoluteLoadDemand')::integer
      ELSE score.absolute_load_demand
    END AS absolute_load_demand
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  LEFT JOIN coaching.exercise_score_v1 score
    ON score.exercise_id = definition.legacy_exercise_id
)
UPDATE coaching.exercise_variant_v1 variant
SET difficulty_json = variant.difficulty_json || jsonb_build_object(
      'technicalComplexity', proposed.technical_complexity,
      'absoluteLoadDemand', proposed.absolute_load_demand,
      'baseOverallDifficulty', GREATEST(
        proposed.technical_complexity,
        proposed.absolute_load_demand
      )
    ),
    updated_at = now()
FROM proposed
WHERE variant.id = proposed.variant_id
  AND proposed.technical_complexity IS NOT NULL
  AND proposed.absolute_load_demand IS NOT NULL
  AND (
    jsonb_typeof(variant.difficulty_json->'technicalComplexity') IS DISTINCT FROM 'number'
    OR jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand') IS DISTINCT FROM 'number'
    OR jsonb_typeof(variant.difficulty_json->'baseOverallDifficulty') IS DISTINCT FROM 'number'
    OR CASE
      WHEN
        jsonb_typeof(variant.difficulty_json->'technicalComplexity') = 'number'
        AND jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand') = 'number'
        AND jsonb_typeof(variant.difficulty_json->'baseOverallDifficulty') = 'number'
      THEN (variant.difficulty_json->>'baseOverallDifficulty')::integer
        IS DISTINCT FROM GREATEST(
          proposed.technical_complexity,
          proposed.absolute_load_demand
        )
      ELSE FALSE
    END
  );

WITH unsupported AS (
  SELECT
    definition.id AS definition_id,
    jsonb_agg(
      jsonb_build_object(
        'variantId', variant.id,
        'variantKey', variant.variant_key,
        'missingFields', array_remove(ARRAY[
          CASE
            WHEN jsonb_typeof(variant.difficulty_json->'technicalComplexity')
              IS DISTINCT FROM 'number'
              THEN 'technicalComplexity'
          END,
          CASE
            WHEN jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand')
              IS DISTINCT FROM 'number'
              THEN 'absoluteLoadDemand'
          END
        ]::text[], NULL)
      )
      ORDER BY variant.variant_key
    ) AS variants
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  LEFT JOIN coaching.exercise_score_v1 score
    ON score.exercise_id = definition.legacy_exercise_id
  WHERE (
      jsonb_typeof(variant.difficulty_json->'technicalComplexity')
        IS DISTINCT FROM 'number'
      OR jsonb_typeof(variant.difficulty_json->'absoluteLoadDemand')
        IS DISTINCT FROM 'number'
    )
    AND (
      score.technical_complexity IS NULL
      OR score.absolute_load_demand IS NULL
    )
  GROUP BY definition.id
),
quarantine AS (
  SELECT
    definition_id,
    jsonb_build_object(
      'reason', 'missing_evidence_supported_core_difficulty',
      'difficulty_model', 'max_technical_physical',
      'migration', '305_coaching_exercise_difficulty_model_backfill',
      'human_review_required', true,
      'variants', variants
    ) AS evidence
  FROM unsupported
)
UPDATE coaching.exercise_definition_v1 definition
SET provenance_json = COALESCE(definition.provenance_json, '{}'::jsonb)
      || jsonb_build_object('difficulty_model_quarantine', quarantine.evidence),
    updated_at = now()
FROM quarantine
WHERE definition.id = quarantine.definition_id
  AND definition.provenance_json->'difficulty_model_quarantine'
    IS DISTINCT FROM quarantine.evidence;
