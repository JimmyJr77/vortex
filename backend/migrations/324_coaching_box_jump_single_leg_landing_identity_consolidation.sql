-- Consolidate two source cards for the same box-jump-to-single-leg-landing
-- exercise into one stable definition.
--
-- Survivor:
--   Standing Box Jump to Single-Leg Landing
--
-- Consolidated source:
--   Single-Leg Box Jump to Single-Leg Landing
--
-- The sources differ in takeoff laterality, not exercise identity. Takeoff
-- laterality materially changes exercise complexity and physical difficulty,
-- so migration 325 will represent it with explicit variants. Neither legacy
-- source fully declares the takeoff-to-landing leg relationship; both legacy
-- baseline variants remain archived, nonselectable provenance. This migration
-- creates no review, approval, publication, media verification, calibration
-- approval, or exercise proficiency level. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  survivor_slug CONSTANT TEXT := 'standing-box-jump-to-single-leg-landing';
  duplicate_slug CONSTANT TEXT := 'single-leg-box-jump-to-single-leg-landing';
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  target_ids UUID[];
  protected_records INTEGER;
BEGIN
  SELECT id, card_version
  INTO survivor_id, survivor_version
  FROM coaching.exercise_definition_v1
  WHERE slug = survivor_slug
    AND status <> 'archived';

  SELECT id, legacy_exercise_id
  INTO duplicate_id, duplicate_legacy_id
  FROM coaching.exercise_definition_v1
  WHERE slug = duplicate_slug
    AND status <> 'archived';

  IF survivor_id IS NULL AND duplicate_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Box-jump single-leg-landing consolidation found active duplicate % without survivor %',
      duplicate_slug,
      survivor_slug;
  END IF;

  IF survivor_id IS NULL OR duplicate_id IS NULL THEN
    RETURN;
  END IF;

  target_ids := ARRAY[survivor_id, duplicate_id];

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = ANY(target_ids)
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = ANY(target_ids)
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
      )
        AND (
          relationship.review_status <> 'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = calibration.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN (
        SELECT source.legacy_exercise_id
        FROM coaching.exercise_definition_source_v1 source
        WHERE source.definition_id = ANY(target_ids)
      )
        AND (
          score.human_review_status <> 'queued'
          OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Box-jump single-leg-landing consolidation refused to override % protected records',
      protected_records;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source
  )
  SELECT
    survivor.facility_id,
    survivor.id,
    duplicate.id,
    'duplicate_consolidated',
    'Both cards prescribe a standing vertical projection to a box, landing on one declared foot, stabilizing on top, standing, and stepping down. Bilateral versus unilateral takeoff is an exact difficulty-bearing variant, not a separate exercise identity or skill level.',
    jsonb_build_object(
      'match', 'standing_vertical_box_jump_to_declared_single_leg_landing',
      'survivorSlug', survivor.slug,
      'resolvedSlug', duplicate.slug,
      'declaredProjection', 'standing_vertical_jump_to_raised_box',
      'declaredLanding', 'single_leg_on_box',
      'survivorTakeoff', 'bilateral',
      'resolvedTakeoff', 'unilateral',
      'takeoffLateralityRequiresExactVariant', TRUE,
      'takeoffLateralityChangesDifficulty', TRUE,
      'exerciseSkillLevelAllowed', FALSE,
      'samePrimarySequence', TRUE,
      'seedScoreDifferenceIsIdentityEvidence', FALSE,
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE
    ),
    'deterministic_identity_equivalence'
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = duplicate_id
  WHERE survivor.id = survivor_id
  ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id = survivor_id,
      source_kind = 'duplicate_consolidation',
      provenance_json = provenance_json || jsonb_build_object(
        'resolvedFromDefinitionId', duplicate_id,
        'resolution', 'standing_vertical_box_jump_to_declared_single_leg_landing',
        'sourceTakeoffLaterality', 'unilateral',
        'sourceLandingLaterality', 'unilateral_unspecified_leg_relationship'
      )
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  WHERE profile.variant_id IN (
    SELECT id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = duplicate_id
  );

  UPDATE coaching.exercise_variant_v1
  SET definition_id = survivor_id,
      variant_key = left(
        'legacy-unilateral-takeoff-unspecified-landing-source-'
        || COALESCE(duplicate_legacy_id::TEXT, left(duplicate_id::TEXT, 8))
        || '-'
        || variant_key,
        120
      ),
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceIdentityDuplicate', TRUE,
        'sourceDefinitionId', duplicate_id,
        'sourceTakeoffLaterality', 'unilateral',
        'sourceLandingLaterality', 'unilateral_unspecified_leg_relationship',
        'selectable', FALSE,
        'identityQuarantine', TRUE
      ),
      updated_at = now()
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_section_evidence_v1 candidate
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE candidate.definition_id = duplicate_id
    AND candidate.review_status IN ('candidate', 'superseded')
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_section_evidence_v1 existing
      WHERE existing.definition_id = survivor_id
        AND existing.reviewed_card_version = survivor_version
        AND existing.section_key = candidate.section_key
        AND existing.source_url = candidate.source_url
    );

  UPDATE coaching.exercise_alternate_assessment_v1 candidate
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE candidate.definition_id = duplicate_id
    AND candidate.review_status IN ('candidate', 'superseded')
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_alternate_assessment_v1 existing
      WHERE existing.definition_id = survivor_id
        AND existing.reviewed_card_version = survivor_version
        AND lower(existing.alternate_name) = lower(candidate.alternate_name)
    );

  UPDATE coaching.exercise_media_candidate_v1 candidate
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE candidate.definition_id = duplicate_id
    AND candidate.review_status IN ('candidate', 'superseded')
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_media_candidate_v1 existing
      WHERE existing.definition_id = survivor_id
        AND existing.reviewed_card_version = survivor_version
        AND (
          existing.video_id = candidate.video_id
          OR existing.url = candidate.url
        )
    );

  UPDATE coaching.exercise_definition_v1 survivor
  SET aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          COALESCE(survivor.aliases, '{}')
          || COALESCE(duplicate.aliases, '{}')
          || ARRAY[
            duplicate.canonical_name,
            duplicate.display_name,
            'Box Jump to Single-Leg Landing',
            'Box Jump 2-to-1',
            'Box Jump 2-1',
            'Single-Leg Box Jump with Single-Leg Landing'
          ]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) NOT IN (
            lower(survivor.canonical_name),
            lower(survivor.display_name)
          )
        GROUP BY lower(alias)
        ORDER BY lower(alias)
      ),
      provenance_json = survivor.provenance_json || jsonb_build_object(
        'identityResolution', 'standing_vertical_box_jump_to_declared_single_leg_landing',
        'consolidatedDefinitionIds',
          COALESCE(
            survivor.provenance_json->'consolidatedDefinitionIds',
            '[]'::JSONB
          ) || to_jsonb(duplicate_id::TEXT),
        'consolidatedLegacyExerciseIds',
          COALESCE(
            survivor.provenance_json->'consolidatedLegacyExerciseIds',
            '[]'::JSONB
          ) || to_jsonb(duplicate_legacy_id),
        'exerciseSkillLevelAllowed', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 duplicate
  WHERE survivor.id = survivor_id
    AND duplicate.id = duplicate_id;

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      blocking_issues_json = blocking_issues_json || jsonb_build_array(
        jsonb_build_object(
          'code', 'box_jump_single_leg_landing_identity_reaudit_required',
          'message', 'Re-run the canonical card audit after box-jump single-leg-landing identity consolidation.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = survivor_id;

  UPDATE coaching.exercise_definition_v1
  SET status = 'archived',
      provenance_json = provenance_json || jsonb_build_object(
        'identityResolution', 'duplicate_consolidated',
        'canonicalSurvivorDefinitionId', survivor_id,
        'sourceTakeoffLaterality', 'unilateral',
        'sourceLandingLaterality', 'unilateral_unspecified_leg_relationship',
        'exerciseSkillLevelAllowed', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = duplicate_id;
END;
$$;
