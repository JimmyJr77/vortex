-- Normalize only explicit legacy plane words into the controlled exact-variant
-- plane vocabulary. This touches deterministic backfill evidence only, retains
-- the original anatomy JSON, resets no human approval, and leaves every result
-- suggested for independent review. IDEMPOTENT.

WITH normalized AS (
  SELECT variant.id,
         COALESCE(
           jsonb_agg(candidate.plane ORDER BY candidate.sort_order) FILTER (WHERE candidate.matches),
           '[]'::JSONB
         ) AS planes
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN LATERAL (
    VALUES
      (1, 'sagittal', EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(variant.movement_geometry_json->'planes') = 'array'
            THEN variant.movement_geometry_json->'planes' ELSE '[]'::JSONB END
        ) legacy(value)
        WHERE lower(legacy.value) ~ '(^|[^[:alpha:]])sagittal([^[:alpha:]]|$)'
      )),
      (2, 'frontal', EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(variant.movement_geometry_json->'planes') = 'array'
            THEN variant.movement_geometry_json->'planes' ELSE '[]'::JSONB END
        ) legacy(value)
        WHERE lower(legacy.value) ~ '(^|[^[:alpha:]])frontal([^[:alpha:]]|$)'
      )),
      (3, 'transverse', EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(variant.movement_geometry_json->'planes') = 'array'
            THEN variant.movement_geometry_json->'planes' ELSE '[]'::JSONB END
        ) legacy(value)
        WHERE lower(legacy.value) ~ '(^|[^[:alpha:]])transverse([^[:alpha:]]|$)'
      )),
      (4, 'multiplanar', EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(variant.movement_geometry_json->'planes') = 'array'
            THEN variant.movement_geometry_json->'planes' ELSE '[]'::JSONB END
        ) legacy(value)
        WHERE lower(legacy.value) ~ '(^|[^[:alpha:]])multi[-_ ]?planar([^[:alpha:]]|$)'
      ))
  ) candidate(sort_order, plane, matches)
  WHERE variant.structured_profile_review_status IN ('suggested', 'review')
    AND variant.structured_profile_provenance_json @> '{"sourceType":"deterministic_legacy_backfill"}'::JSONB
  GROUP BY variant.id
)
UPDATE coaching.exercise_variant_v1 variant
SET movement_geometry_json = jsonb_set(variant.movement_geometry_json, '{planes}', normalized.planes, true),
    structured_profile_review_status = 'suggested',
    structured_profile_reviewed_by = NULL,
    structured_profile_reviewed_at = NULL,
    structured_profile_provenance_json = jsonb_set(
      variant.structured_profile_provenance_json,
      '{normalization}',
      COALESCE(variant.structured_profile_provenance_json->'normalization', '{}'::JSONB)
        || jsonb_build_object(
          'planeVocabulary', 'controlled_token_extraction_v1',
          'sourceMigration', '754_coaching_structured_profile_plane_normalization.sql',
          'approvalCreated', false,
          'humanReviewRequired', true
        ),
      true
    ),
    updated_at = now()
FROM normalized
WHERE variant.id = normalized.id
  AND normalized.planes <> '[]'::JSONB
  AND variant.movement_geometry_json->'planes' IS DISTINCT FROM normalized.planes;
