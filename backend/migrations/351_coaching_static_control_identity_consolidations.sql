-- Consolidate three direct canonical identity collisions:
--   * Quadruped Thread-the-Needle Rotation -> Quadruped Thread-the-Needle
--   * Single-Leg Tripod Balance -> Single-Leg Balance Hold -- Tripod Foot
--   * Split Squat Iso Hold -> Split Squat Isometric Hold
--
-- Each pair has the same defining action and outcome. Range, support, sensory
-- input, external load, joint angle, and hold duration remain exact variant or
-- delivery dimensions. No exercise skill or proficiency level is introduced;
-- exercise difficulty is complexity plus physical difficulty.
--
-- No approval is created. Candidate-only research may move; human-reviewed,
-- published, approved, graph, calibration, or revision state fails closed.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '351_coaching_static_control_identity_consolidations';
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (
      VALUES
        (
          'quadruped-thread-the-needle',
          'quadruped-thread-the-needle-rotation',
          'Quadruped Thread-the-Needle',
          'same_quadruped_reach_under_then_open_rotation_action',
          'Quadruped Thread-the-Needle and Quadruped Thread-the-Needle Rotation both begin in quadruped, reach one arm under the torso, then rotate the arm open while the support arm and pelvis remain controlled. The added word rotation names the existing action rather than a new exercise. Hand position, available range, heel-sit bias, pause, side, repetitions, and warm-up context remain variant or delivery dimensions.',
          ARRAY[
            'Thread-the-Needle',
            'Quadruped Thread-the-Needle Reach',
            'Quadruped Thread-the-Needle Rotation'
          ]::TEXT[]
        ),
        (
          'single-leg-balance-hold-tripod-foot',
          'single-leg-tripod-balance',
          'Single-Leg Tripod Balance Hold',
          'same_static_single_leg_tripod_balance_action',
          'Single-Leg Balance Hold -- Tripod Foot and Single-Leg Tripod Balance both prescribe a static single-leg stance that maintains contact through the heel, first-metatarsal head, and fifth-metatarsal head while the knee, pelvis, and trunk remain controlled. Naming order does not add an action. Hand support, footwear, stance-knee angle, visual input, hold duration, and contextual purpose remain variant or delivery dimensions.',
          ARRAY[
            'Single-Leg Tripod Balance',
            'Single-Leg Balance Hold -- Tripod Foot',
            'Foot Tripod Single-Leg Balance Hold'
          ]::TEXT[]
        ),
        (
          'split-squat-isometric-hold',
          'split-squat-iso-hold',
          'Split Squat Isometric Hold',
          'same_static_split_squat_hold_action',
          'Split Squat Iso Hold and Split Squat Isometric Hold both prescribe a static split-stance squat position with the front foot grounded, back heel raised, knees and hips held at declared angles, and trunk controlled. Iso is only an abbreviation. Hand support, stride, depth, torso inclination, external load, hold duration, and training context remain variant or delivery dimensions.',
          ARRAY[
            'Split Squat Iso Hold',
            'Split-Stance Isometric Hold',
            'Isometric Split Squat'
          ]::TEXT[]
        )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      canonical_name,
      identity_match,
      rationale,
      extra_aliases
    )
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;
    duplicate_status := NULL;
    facility := NULL;

    SELECT id, card_version, facility_id
    INTO survivor_id, survivor_version, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.survivor_slug
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id, legacy_exercise_id, status
    INTO duplicate_id, duplicate_legacy_id, duplicate_status
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND facility_id = facility;

    IF survivor_id IS NULL THEN
      RAISE EXCEPTION
        '% requires the active % survivor',
        migration_key,
        pair.survivor_slug;
    END IF;

    IF duplicate_id IS NULL THEN
      RAISE EXCEPTION
        '% requires the % source definition',
        migration_key,
        pair.duplicate_slug;
    END IF;

    IF duplicate_status = 'archived' AND EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
        AND resolution.decision = 'duplicate_consolidated'
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate_id
        )
        OR (
          resolution.survivor_definition_id = duplicate_id
          AND resolution.resolved_definition_id = survivor_id
        )
      )
        AND (
          resolution.decision = 'distinct_exercises'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% conflicts with a protected identity decision for % and %',
        migration_key,
        pair.survivor_slug,
        pair.duplicate_slug;
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
            OR approved_video_url IS NOT NULL
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
        WHERE calibration.variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (survivor_id, duplicate_id)
        )
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        '% refused to override % protected record(s) for % and %',
        migration_key,
        protected_records,
        pair.survivor_slug,
        pair.duplicate_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source,
      reviewed_by,
      resolved_at
    )
    VALUES (
      facility,
      survivor_id,
      duplicate_id,
      'duplicate_consolidated',
      pair.rationale,
      jsonb_build_object(
        'match', pair.identity_match,
        'survivorSlug', pair.survivor_slug,
        'resolvedSlug', pair.duplicate_slug,
        'variantDimensions', CASE pair.survivor_slug
          WHEN 'quadruped-thread-the-needle' THEN jsonb_build_array(
            'hand_position',
            'range',
            'hip_position',
            'pause',
            'side',
            'repetitions'
          )
          WHEN 'single-leg-balance-hold-tripod-foot' THEN jsonb_build_array(
            'hand_support',
            'footwear',
            'stance_knee_angle',
            'visual_input',
            'hold_duration'
          )
          ELSE jsonb_build_array(
            'hand_support',
            'stride',
            'depth',
            'torso_inclination',
            'external_load',
            'hold_duration'
          )
        END,
        'researchBatch', 'static-control-identity-collisions-v1',
        'exerciseDifficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    )
    ON CONFLICT (
      survivor_definition_id,
      resolved_definition_id
    )
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now();

    UPDATE coaching.exercise_definition_source_v1 source
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = source.provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', duplicate_id,
          'resolution', pair.identity_match,
          'researchBatch', 'static-control-identity-collisions-v1',
          'migration', migration_key
        )
    WHERE source.definition_id = duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET variant_key = left(variant_key, 42)
          || '-source-' || duplicate_legacy_id::TEXT,
        display_name = 'Legacy ' || display_name || ' Source',
        definition_id = survivor_id,
        status = 'archived',
        requirements_json = coalesce(requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'identityQuarantine', TRUE,
            'quarantineReason',
              'Legacy source does not declare the exact selectable variant contract, dose, quality gate, and stop rules required by the consolidated card.'
          ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.id = profile.variant_id
      AND variant.definition_id = survivor_id
      AND variant.status = 'archived';

    DELETE FROM coaching.exercise_section_evidence_v1 duplicate_evidence
    USING coaching.exercise_section_evidence_v1 survivor_evidence
    WHERE duplicate_evidence.definition_id = duplicate_id
      AND survivor_evidence.definition_id = survivor_id
      AND survivor_evidence.reviewed_card_version =
        duplicate_evidence.reviewed_card_version
      AND survivor_evidence.section_key = duplicate_evidence.section_key
      AND survivor_evidence.source_url = duplicate_evidence.source_url;

    UPDATE coaching.exercise_section_evidence_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate_id;

    DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
    USING coaching.exercise_media_candidate_v1 survivor_media
    WHERE duplicate_media.definition_id = duplicate_id
      AND survivor_media.definition_id = survivor_id
      AND survivor_media.reviewed_card_version =
        duplicate_media.reviewed_card_version
      AND (
        survivor_media.video_id = duplicate_media.video_id
        OR survivor_media.url = duplicate_media.url
      );

    UPDATE coaching.exercise_media_candidate_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        notes = concat_ws(
          ' ',
          notes,
          'Preserved from a consolidated source; candidate metadata does not establish human viewing, exact matching, or approval.'
        ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
    USING coaching.exercise_alternate_assessment_v1 survivor_alternate
    WHERE duplicate_alternate.definition_id = duplicate_id
      AND survivor_alternate.definition_id = survivor_id
      AND survivor_alternate.reviewed_card_version =
        duplicate_alternate.reviewed_card_version
      AND lower(survivor_alternate.alternate_name) =
        lower(duplicate_alternate.alternate_name);

    UPDATE coaching.exercise_alternate_assessment_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_definition_v1 survivor
    SET canonical_name = pair.canonical_name,
        display_name = pair.canonical_name,
        aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            coalesce(survivor.aliases, '{}')
            || coalesce(duplicate.aliases, '{}')
            || ARRAY[
              duplicate.canonical_name,
              duplicate.display_name
            ]::TEXT[]
            || pair.extra_aliases
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(btrim(alias)) NOT IN (
              lower(pair.canonical_name)
            )
          GROUP BY lower(btrim(alias))
          ORDER BY lower(btrim(alias))
        ),
        status = 'review',
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = survivor.provenance_json || jsonb_build_object(
          'identityMigration', migration_key,
          'identityResolution', pair.identity_match,
          'consolidatedDefinitionIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedDefinitionIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_id),
          'consolidatedLegacyExerciseIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedLegacyExerciseIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_legacy_id),
          'researchBatch', 'static-control-identity-collisions-v1',
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE,
          'mediaApprovalCreated', FALSE,
          'graphApprovalCreated', FALSE,
          'calibrationApprovalCreated', FALSE
        ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_card_test_packet_v1
    SET status = 'quarantined',
        blocking_issues_json = blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'identity_consolidation_reaudit_required',
            'message',
              'Re-run the canonical card audit after direct identity consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        legacy_exercise_id = NULL,
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'archivedByIdentityMigration', migration_key,
          'survivorDefinitionId', survivor_id,
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;
END;
$$;
