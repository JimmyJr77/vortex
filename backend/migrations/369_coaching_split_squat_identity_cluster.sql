-- Resolve the stationary Split Squat identity cluster.
--
-- Stable stationary survivor:
--   split-squat
--
-- Consolidated into the stationary survivor:
--   barbell-split-squat
--   bodyweight-split-squat
--   front-rack-kettlebell-split-squat
--   sandbag-split-squat-strength
--   slow-eccentric-split-squat
--   split-squat-eccentric-to-pause
--
-- Landmine Handle-Grip Split Squat consolidates into Landmine Split Squat
-- because attachment and wrist position are exact implement dimensions. The
-- broader Landmine source remains separate and quarantined because its source
-- permits either a stationary split stance or a stepping reverse lunge.
--
-- Rear-foot elevation, front-foot elevation, isometric holds, perturbations,
-- jumps, added box landings, and stepping lunges change support or ordered
-- actions and remain distinct definitions.
--
-- Exercise cards receive complexity and physical-difficulty assessment only.
-- This migration creates no review, media, relationship, calibration, card,
-- or publication approval. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '369_coaching_split_squat_identity_cluster';
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
        'split-squat',
        'barbell-split-squat',
        'Barbell Split Squat',
        'barbell_back_rack',
        'The source retains a stationary split stance, controlled descent, and return to the same stance. Barbell loading and rack position are exact variants, not a separate exercise.'
      ),
      (
        'split-squat',
        'bodyweight-split-squat',
        'Bodyweight Split Squat',
        'bodyweight',
        'The bodyweight source retains the same stationary split-stance squat action. Absence of external load is an exact variant.'
      ),
      (
        'split-squat',
        'front-rack-kettlebell-split-squat',
        'Front-Rack Kettlebell Split Squat',
        'kettlebell_front_rack',
        'The source retains the stationary split-stance squat action. Kettlebell quantity, side, rack position, and load are exact variants.'
      ),
      (
        'split-squat',
        'sandbag-split-squat-strength',
        'Sandbag Split Squat',
        'sandbag_front_hold',
        'The source retains the stationary split-stance squat action. A deformable front-held sandbag changes load handling and bracing within the same exercise identity.'
      ),
      (
        'split-squat',
        'slow-eccentric-split-squat',
        'Slow Eccentric Split Squat',
        'slow_eccentric_tempo',
        'The source retains the stationary split-stance descent and ascent. Slower lowering is an exact tempo variant.'
      ),
      (
        'split-squat',
        'split-squat-eccentric-to-pause',
        'Split Squat Eccentric to Pause',
        'slow_eccentric_bottom_pause',
        'The source retains the stationary split-stance descent and ascent. Declared eccentric duration and a bottom pause are exact tempo and delivery dimensions.'
      ),
      (
        'landmine-split-squat',
        'landmine-handle-grip-split-squat',
        'Landmine Handle-Grip Split Squat',
        'landmine_neutral_handle_attachment',
        'Both landmine sources use the same angled bar path and unilateral squat or lunge contract. A neutral handle changes attachment, grip, and wrist position within the same landmine identity.'
      )
    ) AS sources(
      survivor_slug,
      duplicate_slug,
      retained_alias,
      variant_dimensions,
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
    WHERE facility_id = 1
      AND slug = source.survivor_slug
      AND status <> 'archived';

    SELECT id, legacy_exercise_id
    INTO duplicate_id, duplicate_legacy_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug = source.duplicate_slug
      AND status <> 'archived';

    IF survivor_id IS NULL AND duplicate_id IS NOT NULL THEN
      RAISE EXCEPTION
        '% found active duplicate % without survivor %',
        migration_key,
        source.duplicate_slug,
        source.survivor_slug;
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
            OR approved_video_url IS NOT NULL
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
        '% refused to override % protected record(s) for %',
        migration_key,
        protected_records,
        source.duplicate_slug;
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
        AND resolution.decision <> 'duplicate_consolidated'
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for %',
        migration_key,
        source.duplicate_slug;
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
        'match', 'stationary_split_squat_variant_equivalence',
        'survivorSlug', survivor.slug,
        'resolvedSlug', duplicate.slug,
        'variantDimensions', source.variant_dimensions,
        'sameStationaryOrLandmineBaseAction', TRUE,
        'sameDescentAndAscentContract', TRUE,
        'dimensionIsExactVariant', TRUE,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
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
          'resolution',
            'stationary_split_squat_variant_equivalence',
          'variantDimensions', source.variant_dimensions
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
          'legacy-source-'
          || COALESCE(duplicate_legacy_id::TEXT, left(duplicate_id::TEXT, 8))
          || '-'
          || variant_key,
          120
        ),
        status = 'archived',
        requirements_json = requirements_json || jsonb_build_object(
          'sourceIdentityDuplicate', TRUE,
          'sourceDefinitionId', duplicate_id,
          'variantDimensions', source.variant_dimensions,
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
          'identityResolution',
            'stationary_split_squat_variant_equivalence',
          'identityMigration', migration_key,
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
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
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
            'code', 'split_squat_identity_reaudit_required',
            'message',
              'Re-run the canonical card audit after Split Squat identity consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        approved_video_url = NULL,
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'duplicate_consolidated',
          'canonicalSurvivorDefinitionId', survivor_id,
          'variantDimensions', source.variant_dimensions,
          'identityMigration', migration_key,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;
END;
$$;

DO $$
DECLARE
  migration_key CONSTANT TEXT := '369_coaching_split_squat_identity_cluster';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'split-squat',
        'bulgarian-split-squat',
        'rear_foot_floor_support_vs_rear_foot_elevation',
        'A stationary Split Squat keeps the rear forefoot on the floor; a Bulgarian or rear-foot-elevated split squat places the rear foot on a declared support. Support geometry, balance, rear-limb contribution, setup, failure modes, and substitutions differ.'
      ),
      (
        'single-kettlebell-front-rack-squat',
        'split-squat',
        'bilateral_parallel_stance_vs_asymmetrical_split_stance',
        'Goblet Squat uses a bilateral approximately parallel stance; Split Squat uses a stationary side-specific split stance with a lead-leg bias.'
      ),
      (
        'split-squat',
        'split-squat-jump',
        'grounded_strength_repetitions_vs_flight_and_landing',
        'Split Squat retains continuous foot contact; Split-Squat Jump adds takeoff, flight, impact, landing, and elastic or terminal-contact requirements.'
      ),
      (
        'bulgarian-split-squat',
        'rear-foot-elevated-split-squat-jump-to-box',
        'grounded_repetitions_vs_jump_to_elevated_terminal_landing',
        'Bulgarian Split Squat is a grounded strength action; the jump-to-box card adds takeoff, flight, an elevated landing target, impact, and a terminal landing contract.'
      ),
      (
        'bulgarian-split-squat',
        'rear-foot-elevated-split-squat-iso-cut-position',
        'dynamic_repetitions_vs_isometric_cut_position',
        'Bulgarian Split Squat uses repeated descent and ascent; the cut-position card holds a declared isometric position for a different action and dose contract.'
      ),
      (
        'bodyweight-box-squat',
        'split-squat',
        'bilateral_box_contact_vs_stationary_split_stance',
        'Box Squat uses bilateral stance and declared box contact; Split Squat uses an asymmetrical split stance without box contact.'
      ),
      (
        'dumbbell-sumo-squat',
        'split-squat',
        'wide_bilateral_stance_vs_side_specific_split_stance',
        'Dumbbell Sumo Squat uses a wide bilateral stance; Split Squat uses a side-specific asymmetrical split stance and lead-leg bias.'
      ),
      (
        'slow-eccentric-goblet-squat',
        'split-squat',
        'bilateral_goblet_squat_vs_split_stance_tempo_variant',
        'Slow-Eccentric Goblet Squat remains a bilateral squat; slow eccentric Split Squat remains an asymmetrical split-stance variant.'
      ),
      (
        'split-squat-jump',
        'split-squat-jump-to-stick',
        'repeated_jump_contract_vs_explicit_terminal_stick',
        'The generic jump card does not require a terminal held landing, while Jump to Stick adds an explicit deceleration and owned-finish action.'
      )
    ) AS boundaries(left_slug, right_slug, match, rationale)
  LOOP
    left_id := NULL;
    right_id := NULL;

    SELECT id INTO left_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug = boundary.left_slug
      AND status <> 'archived';

    SELECT id INTO right_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug = boundary.right_slug
      AND status <> 'archived';

    IF left_id IS NULL OR right_id IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_id
          AND resolution.resolved_definition_id = right_id
        )
        OR (
          resolution.survivor_definition_id = right_id
          AND resolution.resolved_definition_id = left_id
        )
      )
        AND resolution.decision <> 'distinct_exercises'
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
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
    VALUES (
      1,
      left_id,
      right_id,
      'distinct_exercises',
      boundary.rationale,
      jsonb_build_object(
        'match', boundary.match,
        'leftSlug', boundary.left_slug,
        'rightSlug', boundary.right_slug,
        'orderedActionOrSupportBoundary', TRUE,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;
  END LOOP;

  SELECT id INTO left_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'landmine-split-squat'
    AND status <> 'archived';

  SELECT id INTO right_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'split-squat'
    AND status <> 'archived';

  IF left_id IS NOT NULL AND right_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        resolution.survivor_definition_id IN (left_id, right_id)
        AND resolution.resolved_definition_id IN (left_id, right_id)
      )
    )
  THEN
    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source
    )
    VALUES (
      1,
      left_id,
      right_id,
      'needs_human_review',
      'The Landmine Split Squat source alternates between a stationary split stance and a stepping reverse-lunge setup. The primary action cannot be assigned without inspecting or re-authoring the source.',
      jsonb_build_object(
        'match', 'landmine_source_stationary_or_stepping_ambiguity',
        'missingDimensions',
          jsonb_build_array(
            'stationary_vs_stepping',
            'start_and_finish_stance',
            'required_foot_motion'
          ),
        'reviewerAssigned', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    );
  END IF;
END;
$$;
