-- Consolidate adductor rock-back cards that differ only by reach overlay,
-- thoracic-rotation reach, or half-kneeling start position into one canonical
-- definition. The historical generic reach and half-kneeling sources do not
-- define enough execution detail for production selection, so those variants
-- remain explicitly identity-quarantined.
--
-- Legacy source mappings, variants, delivery profiles, candidate evidence,
-- candidate media, aliases, and provenance remain traceable. Any human-reviewed
-- evidence, alternates, card revision/review, media review, relationship,
-- calibration, published variant, or published delivery profile fails closed
-- instead of being reassigned automatically.
-- IDEMPOTENT.

DO $$
DECLARE
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  protected_records INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        'adductor-rockback-with-reach',
        'reach-overlay-unresolved',
        ARRAY['reach_overlay', 'reach_direction_unresolved']::TEXT[],
        '{
          "startPosition": "quadruped_with_one_leg_extended_laterally",
          "reachDirection": "unspecified_source_requires_human_review",
          "identityQuarantine": true
        }'::JSONB,
        'reach_overlay',
        'The source preserves the same quadruped adductor rock-back and adds an upper-body reach. Reach direction is a controlled variant dimension, but this historical source does not define it and therefore remains quarantined.'
      ),
      (
        'adductor-rock-back-with-t-spine-reach',
        'thoracic-rotation-reach',
        ARRAY['reach_overlay', 'thoracic_rotation']::TEXT[],
        '{
          "startPosition": "quadruped_with_one_leg_extended_laterally",
          "reachDirection": "thoracic_rotation_in_assigned_direction",
          "pelvisConstraint": "remain_quiet_without_forced_lumbar_rotation"
        }'::JSONB,
        'thoracic_rotation_reach_overlay',
        'The explicit T-spine reach adds thoracic rotation while the quadruped adductor rock-back remains the primary movement. The reach is a controlled overlay rather than a separate exercise identity.'
      ),
      (
        'half-kneeling-adductor-rockback',
        'half-kneeling-kicking-access',
        ARRAY[
          'half_kneeling_start',
          'kicking_context',
          'support_and_leg_path_unresolved'
        ]::TEXT[],
        '{
          "startPosition": "half_kneeling",
          "supportPosition": "unspecified_source_requires_human_review",
          "workingLegPath": "unspecified_source_requires_human_review",
          "externalLoad": "unspecified_source_requires_human_review",
          "identityQuarantine": true
        }'::JSONB,
        'start_position_and_context',
        'The historical card retains an adductor rock-back intent and primary hip-abduction/hip-flexion actions but changes to a half-kneeling start and kicking context. Start position is a controlled variant dimension; support, exact leg path, and external-load expectations remain quarantined until human clarification.'
      )
    ) AS pairs(
      duplicate_slug,
      target_variant_key,
      modifier_keys,
      requirements_patch,
      variant_dimension,
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
    WHERE slug = 'adductor-rockback'
      AND status <> 'archived';

    SELECT id, legacy_exercise_id
    INTO duplicate_id, duplicate_legacy_id
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND status <> 'archived';

    IF survivor_id IS NULL OR duplicate_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id IN (survivor_id, duplicate_id)
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
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id IN (survivor_id, duplicate_id)
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = profile.variant_id
        WHERE variant.definition_id IN (survivor_id, duplicate_id)
          AND profile.status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate_id)
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate_id)
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
        WHERE variant.definition_id IN (survivor_id, duplicate_id)
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        'Adductor rock-back variant consolidation for % requires human review: % protected records',
        pair.duplicate_slug,
        protected_records;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE definition_id = survivor_id
        AND variant_key = pair.target_variant_key
    ) THEN
      RAISE EXCEPTION
        'Adductor rock-back consolidation for % conflicts with survivor variant key %',
        pair.duplicate_slug,
        pair.target_variant_key;
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
      pair.rationale,
      jsonb_build_object(
        'match', 'controlled_variant_equivalence',
        'survivor_slug', survivor.slug,
        'resolved_slug', duplicate.slug,
        'variant_dimension', pair.variant_dimension,
        'target_variant_key', pair.target_variant_key,
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'publication_quarantined', TRUE
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
          'resolved_from_definition_id', duplicate_id,
          'resolution', 'controlled_variant_equivalence',
          'variant_dimension', pair.variant_dimension,
          'target_variant_key', pair.target_variant_key
        )
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = pair.target_variant_key,
        modifier_keys = ARRAY(
          SELECT min(modifier)
          FROM unnest(
            COALESCE(modifier_keys, '{}') || pair.modifier_keys
          ) modifier
          WHERE nullif(btrim(modifier), '') IS NOT NULL
          GROUP BY lower(modifier)
          ORDER BY lower(modifier)
        ),
        requirements_json = requirements_json || pair.requirements_patch,
        status = 'review',
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET equipment_required = ARRAY['none']::TEXT[],
        status = 'review',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    WHERE profile.variant_id = variant.id
      AND variant.definition_id = survivor_id
      AND variant.variant_key = pair.target_variant_key;

    -- Candidate-only records may move to the survivor. Conflicting candidates
    -- remain attached to the archived definition as immutable provenance.
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
              duplicate.display_name
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
          'identity_resolution', 'controlled_variant_consolidation',
          'exercise_difficulty_model',
            'exercise_complexity_and_physical_difficulty_only',
          'consolidated_definition_ids',
            COALESCE(
              survivor.provenance_json->'consolidated_definition_ids',
              '[]'::jsonb
            ) || to_jsonb(duplicate_id::TEXT),
          'consolidated_legacy_exercise_ids',
            COALESCE(
              survivor.provenance_json->'consolidated_legacy_exercise_ids',
              '[]'::jsonb
            ) || to_jsonb(duplicate_legacy_id)
        ),
        status = 'review',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identity_resolution', 'controlled_variant_consolidation',
          'canonical_survivor_definition_id', survivor_id,
          'variant_dimension', pair.variant_dimension,
          'target_variant_key', pair.target_variant_key,
          'human_review_required', TRUE,
          'publication_quarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET equipment_required = ARRAY['none']::TEXT[],
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE profile.variant_id = variant.id
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived';

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET status = 'quarantined',
      blocking_issues_json = CASE
        WHEN packet.blocking_issues_json @> '[{
          "code": "adductor_rockback_variant_consolidation_reaudit_required"
        }]'::JSONB
          THEN packet.blocking_issues_json
        ELSE packet.blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'adductor_rockback_variant_consolidation_reaudit_required',
            'message', 'Re-run the canonical card audit and resolve quarantined reach and half-kneeling execution details before publication.'
          )
        )
      END,
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE packet.definition_id = definition.id
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived';
END;
$$;
