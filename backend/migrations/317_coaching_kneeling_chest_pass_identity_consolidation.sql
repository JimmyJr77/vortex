-- Consolidate four source cards that describe one kneeling two-hand
-- medicine-ball chest-pass identity.
--
-- Survivor:
--   Kneeling Medicine Ball Chest Pass
--
-- Consolidated source identities:
--   Tall-Kneeling Medicine Ball Chest Pass
--   Tall-Kneeling Chest Pass to Wall
--   Half-Kneeling Chest Pass to Wall
--
-- Stance and rebound/catch behavior are exact variants of the same horizontal
-- two-hand projection. The generic legacy sources do not declare stance, so
-- their variants remain archived provenance rather than being guessed into a
-- selectable tall- or half-kneeling variant. Candidate records move when they
-- do not collide; colliding candidates remain preserved on the archived source
-- definition. No reviewed content, approval, publication, calibration, media
-- decision, or skill level is created or overwritten. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  survivor_slug CONSTANT TEXT := 'kneeling-medicine-ball-chest-pass';
  source RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  target_ids UUID[];
  protected_records INTEGER;
BEGIN
  FOR source IN
    SELECT *
    FROM (VALUES
      (
        'tall-kneeling-medicine-ball-chest-pass',
        'Tall-Kneeling Medicine Ball Chest Pass',
        'tall_kneeling',
        'unspecified',
        'The source preserves the same two-hand horizontal medicine-ball chest pass and only declares the kneeling base more precisely. Tall kneeling is an exact stance variant, not a separate exercise identity.'
      ),
      (
        'tall-kneeling-chest-pass-to-wall',
        'Tall-Kneeling Chest Pass to Wall',
        'tall_kneeling',
        'rebound_and_catch',
        'The source preserves the same two-hand horizontal medicine-ball chest pass. Tall kneeling and a wall return with catch are exact delivery dimensions rather than a separate exercise identity.'
      ),
      (
        'half-kneeling-chest-pass-to-wall',
        'Half-Kneeling Chest Pass to Wall',
        'half_kneeling',
        'rebound_and_catch',
        'The source preserves the same two-hand horizontal medicine-ball chest pass. Half kneeling and a wall return with catch are exact delivery dimensions rather than a separate exercise identity.'
      )
    ) AS sources(
      duplicate_slug,
      retained_alias,
      declared_stance,
      declared_return_contract,
      rationale
    )
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;

    SELECT id, card_version
    INTO survivor_id, survivor_version
    FROM coaching.exercise_definition_v1
    WHERE slug = survivor_slug
      AND status <> 'archived';

    SELECT id, legacy_exercise_id
    INTO duplicate_id, duplicate_legacy_id
    FROM coaching.exercise_definition_v1
    WHERE slug = source.duplicate_slug
      AND status <> 'archived';

    IF survivor_id IS NULL AND duplicate_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Kneeling chest-pass consolidation found active duplicate % without survivor %',
        source.duplicate_slug,
        survivor_slug;
    END IF;

    IF survivor_id IS NULL OR duplicate_id IS NULL THEN
      CONTINUE;
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
          SELECT definition_source.legacy_exercise_id
          FROM coaching.exercise_definition_source_v1 definition_source
          WHERE definition_source.definition_id = ANY(target_ids)
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
        'Kneeling chest-pass consolidation for % refused to override % protected records',
        source.duplicate_slug,
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
      source.rationale,
      jsonb_build_object(
        'match', 'horizontal_two_hand_kneeling_chest_pass_identity_equivalence',
        'survivorSlug', survivor.slug,
        'resolvedSlug', duplicate.slug,
        'declaredStance', source.declared_stance,
        'declaredReturnContract', source.declared_return_contract,
        'samePrimaryProjection', TRUE,
        'sameImplementFamily', TRUE,
        'stanceIsExactVariant', TRUE,
        'returnContractIsExactVariant', TRUE,
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
          'resolution', 'horizontal_two_hand_kneeling_chest_pass_identity_equivalence',
          'declaredStance', source.declared_stance,
          'declaredReturnContract', source.declared_return_contract
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
          'legacy-'
          || replace(source.declared_stance, '_', '-')
          || '-source-'
          || COALESCE(duplicate_legacy_id::TEXT, left(duplicate_id::TEXT, 8))
          || '-'
          || variant_key,
          120
        ),
        status = 'archived',
        requirements_json = requirements_json || jsonb_build_object(
          'sourceIdentityDuplicate', TRUE,
          'sourceDefinitionId', duplicate_id,
          'declaredStance', source.declared_stance,
          'declaredReturnContract', source.declared_return_contract,
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
              source.retained_alias
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
          'identityResolution', 'horizontal_two_hand_kneeling_chest_pass_identity_equivalence',
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
            'code', 'kneeling_chest_pass_identity_reaudit_required',
            'message', 'Re-run the canonical card audit after kneeling chest-pass identity consolidation.'
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
          'declaredStance', source.declared_stance,
          'declaredReturnContract', source.declared_return_contract,
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;
END;
$$;
