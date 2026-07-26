-- Consolidate the generic and wall-named medicine-ball rotational throw
-- definitions into one stable broad identity.
--
-- Survivor:
--   Medicine Ball Rotational Throw
--
-- Consolidated source identity:
--   Medicine Ball Rotational Wall Throw
--
-- Both legacy descriptions name the same standing two-hand rotational
-- projection into a wall. Wall target and rebound/catch behavior are delivery
-- dimensions, not separate exercise identities. Neither source declares
-- whether a returning catch is required, so both source variants remain
-- archived, nonselectable provenance until exact variants are created by the
-- completion migration. No reviewed content, approval, publication,
-- calibration, media decision, or exercise proficiency level is created or
-- overwritten. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  survivor_slug CONSTANT TEXT := 'medicine-ball-rotational-throw';
  duplicate_slug CONSTANT TEXT := 'medicine-ball-rotational-wall-throw';
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
      'Rotational wall-throw consolidation found active duplicate % without survivor %',
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
      'Rotational wall-throw consolidation refused to override % protected records',
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
    'Both source cards describe a standing two-hand medicine-ball rotational projection into a wall. The wall name makes the target explicit but does not define a different exercise; return behavior remains an exact delivery dimension.',
    jsonb_build_object(
      'match', 'standing_two_hand_rotational_wall_projection_identity_equivalence',
      'survivorSlug', survivor.slug,
      'resolvedSlug', duplicate.slug,
      'declaredStance', 'standing_athletic',
      'declaredTarget', 'wall',
      'declaredReturnContract', 'unspecified',
      'samePrimaryProjection', TRUE,
      'sameImplementFamily', TRUE,
      'targetIsDeliveryDimension', TRUE,
      'returnContractRequiresExactVariant', TRUE,
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
        'resolution', 'standing_two_hand_rotational_wall_projection_identity_equivalence',
        'declaredStance', 'standing_athletic',
        'declaredTarget', 'wall',
        'declaredReturnContract', 'unspecified'
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
        'legacy-unspecified-return-source-'
        || COALESCE(duplicate_legacy_id::TEXT, left(duplicate_id::TEXT, 8))
        || '-'
        || variant_key,
        120
      ),
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceIdentityDuplicate', TRUE,
        'sourceDefinitionId', duplicate_id,
        'declaredStance', 'standing_athletic',
        'declaredTarget', 'wall',
        'declaredReturnContract', 'unspecified',
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
            'Medicine Ball Rotational Wall Throw',
            'Standing Rotational Wall Toss',
            'Lateral Wall Ball'
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
        'identityResolution', 'standing_two_hand_rotational_wall_projection_identity_equivalence',
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
          'code', 'rotational_wall_throw_identity_reaudit_required',
          'message', 'Re-run the canonical card audit after rotational wall-throw identity consolidation.'
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
        'declaredStance', 'standing_athletic',
        'declaredTarget', 'wall',
        'declaredReturnContract', 'unspecified',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = duplicate_id;
END;
$$;
