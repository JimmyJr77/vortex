-- Consolidate the Pallof press and Pallof step-out source fragments into two
-- stable identities. Stance, implement, dose mode, and return tempo are exact
-- Pallof press variant dimensions. Lateral travel is a separate step-out
-- identity. Marching, rowing, pulldown, diagonal lift, landmine, and lower-limb
-- band-walk actions remain distinct definitions.
--
-- No human approval is created. The migration refuses to modify protected
-- review state, archives legacy variants and delivery profiles, preserves every
-- source mapping and alias, and quarantines survivors for a complete re-audit.
-- Exercise difficulty remains complexity plus physical difficulty; exercise
-- cards receive no skill or proficiency level. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  source RECORD;
  survivor RECORD;
  duplicate RECORD;
  target_ids UUID[];
  target_legacy_ids BIGINT[];
  protected_records INTEGER;
  conflicting_resolutions INTEGER;
  active_source_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO active_source_count
  FROM coaching.exercise_definition_v1
  WHERE status <> 'archived'
    AND slug IN (
      'anti-rotation-cable-press-out',
      'band-anti-rotation-walkout',
      'band-pallof-press',
      'cable-anti-rotation-step-out',
      'half-kneeling-pallof-press',
      'pallof-press-eccentric-return',
      'pallof-press-pallof-hold',
      'pallof-press-reps',
      'pallof-press-step-out',
      'partner-pallof-band-hold',
      'split-stance-cable-pallof-iso-hold',
      'split-stance-pallof-press',
      'tall-kneeling-pallof-press-hold'
    );

  IF active_source_count NOT IN (2, 13) THEN
    RAISE EXCEPTION
      'Pallof identity consolidation expected 13 source definitions before or 2 survivors after migration, found %',
      active_source_count;
  END IF;

  -- Migration 341 conservatively separated the two kneeling stances while the
  -- family still lacked a complete stance taxonomy. The newer stance-specific
  -- research and exact variant plan supersede that provisional boundary.
  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET decision = 'duplicate_consolidated',
      rationale =
        'Half-kneeling and tall-kneeling change the base of support and exercise difficulty, but preserve the same side-anchored bilateral horizontal Pallof press or hold identity. Both stances are retained as exact variants.',
      evidence_json = jsonb_build_object(
        'match', 'same_fixed_stance_pallof_press_identity',
        'supersedesPriorBoundary', TRUE,
        'supersededBoundary',
          'half_kneeling_dynamic_press_vs_tall_kneeling_hold',
        'exactVariantDimensions',
          jsonb_build_object(
            'stance', jsonb_build_array('half_kneeling', 'tall_kneeling'),
            'doseMode', jsonb_build_array('repetitions', 'isometric_hold'),
            'resistanceSource', 'declared_band_or_cable'
          ),
        'researchSources', jsonb_build_array(
          'nasm_progressive_core_training',
          'nsca_foundations_fitness_programming',
          'pallof_body_position_postural_control'
        ),
        'exerciseDifficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      resolution_source = 'deterministic_identity_equivalence',
      reviewed_by = NULL,
      resolved_at = now()
  FROM coaching.exercise_definition_v1 half_kneeling,
       coaching.exercise_definition_v1 tall_kneeling
  WHERE half_kneeling.slug = 'half-kneeling-pallof-press'
    AND tall_kneeling.slug = 'tall-kneeling-pallof-press-hold'
    AND resolution.survivor_definition_id = half_kneeling.id
    AND resolution.resolved_definition_id = tall_kneeling.id
    AND resolution.decision IN (
      'distinct_exercises',
      'duplicate_consolidated'
    )
    AND resolution.resolution_source <> 'human_review';

  IF active_source_count = 13 AND NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 half_kneeling
      ON half_kneeling.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 tall_kneeling
      ON tall_kneeling.id = resolution.resolved_definition_id
    WHERE half_kneeling.slug = 'half-kneeling-pallof-press'
      AND tall_kneeling.slug = 'tall-kneeling-pallof-press-hold'
      AND resolution.decision = 'duplicate_consolidated'
      AND resolution.resolution_source =
        'deterministic_identity_equivalence'
  ) THEN
    RAISE EXCEPTION
      'Pallof identity consolidation could not supersede the provisional kneeling-stance boundary';
  END IF;

  -- Preserve the already-researched overhead-press boundary on the final
  -- generic Pallof survivor before the half-kneeling source becomes lineage.
  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET survivor_definition_id = final_survivor.id,
      rationale =
        'Pallof Press uses a side-anchored bilateral horizontal anti-rotation press; Half-Kneeling Single-Arm Press is a unilateral vertical overhead press and remains a distinct exercise.',
      evidence_json = resolution.evidence_json
        || jsonb_build_object(
          'survivorSlug', 'pallof-press-pallof-hold',
          'remappedFromSlug', 'half-kneeling-pallof-press',
          'identityBoundary',
            'horizontal_anti_rotation_press_vs_vertical_overhead_press',
          'researchVersion', '2026-07-26.43',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
      resolved_at = now()
  FROM coaching.exercise_definition_v1 source_definition,
       coaching.exercise_definition_v1 final_survivor,
       coaching.exercise_definition_v1 related_definition
  WHERE source_definition.slug = 'half-kneeling-pallof-press'
    AND final_survivor.facility_id = source_definition.facility_id
    AND final_survivor.slug = 'pallof-press-pallof-hold'
    AND final_survivor.status <> 'archived'
    AND related_definition.facility_id = source_definition.facility_id
    AND related_definition.slug = 'half-kneeling-single-arm-press'
    AND resolution.survivor_definition_id = source_definition.id
    AND resolution.resolved_definition_id = related_definition.id
    AND resolution.decision = 'distinct_exercises'
    AND resolution.resolution_source <> 'human_review'
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 existing
      WHERE existing.survivor_definition_id = final_survivor.id
        AND existing.resolved_definition_id = related_definition.id
    );

  FOR source IN
    SELECT *
    FROM (
      VALUES
        (
          1,
          'half-kneeling-pallof-press',
          'tall-kneeling-pallof-press-hold',
          'stance_dose_resistance_anchor_side_and_hold_duration',
          '{
            "stance":"tall_kneeling",
            "doseMode":"isometric_hold",
            "resistanceSource":"declared_band_or_cable",
            "anchorSide":"declared",
            "holdDuration":"declared"
          }'::JSONB
        ),
        (
          2,
          'pallof-press-pallof-hold',
          'anti-rotation-cable-press-out',
          'cable_resistance_stance_press_range_and_dose_mode',
          '{
            "resistanceSource":"cable_machine",
            "stance":"standing_parallel",
            "pressRange":"declared_horizontal_reach",
            "doseMode":"declared_repetition_or_hold"
          }'::JSONB
        ),
        (
          3,
          'pallof-press-pallof-hold',
          'band-pallof-press',
          'band_resistance_stance_press_range_and_dose_mode',
          '{
            "resistanceSource":"resistance_band",
            "stance":"standing_parallel",
            "pressRange":"declared_horizontal_reach",
            "doseMode":"repetitions"
          }'::JSONB
        ),
        (
          4,
          'pallof-press-pallof-hold',
          'half-kneeling-pallof-press',
          'half_kneeling_lead_side_resistance_press_range_and_dose_mode',
          '{
            "stance":"half_kneeling",
            "leadSide":"declared",
            "resistanceSource":"declared_band_or_cable",
            "pressRange":"declared_horizontal_reach",
            "doseMode":"declared_repetition_or_hold"
          }'::JSONB
        ),
        (
          5,
          'pallof-press-pallof-hold',
          'pallof-press-eccentric-return',
          'return_tempo_resistance_stance_press_range_and_side',
          '{
            "returnTempoSeconds":4,
            "resistanceSource":"declared_band_or_cable",
            "stance":"declared_fixed_stance",
            "pressRange":"declared_horizontal_reach",
            "anchorSide":"declared"
          }'::JSONB
        ),
        (
          6,
          'pallof-press-pallof-hold',
          'pallof-press-reps',
          'repetition_dose_resistance_stance_press_range_and_side',
          '{
            "doseMode":"repetitions",
            "resistanceSource":"declared_band_or_cable",
            "stance":"declared_fixed_stance",
            "pressRange":"declared_horizontal_reach",
            "anchorSide":"declared"
          }'::JSONB
        ),
        (
          7,
          'pallof-press-pallof-hold',
          'partner-pallof-band-hold',
          'partner_anchor_band_hold_stance_press_range_and_side',
          '{
            "resistanceSource":"resistance_band",
            "anchorType":"supervised_partner",
            "doseMode":"isometric_hold",
            "stance":"declared_fixed_stance",
            "pressRange":"declared_horizontal_reach",
            "anchorSide":"declared"
          }'::JSONB
        ),
        (
          8,
          'pallof-press-pallof-hold',
          'split-stance-cable-pallof-iso-hold',
          'split_stance_cable_hold_lead_side_press_range_and_anchor_side',
          '{
            "stance":"split_stance",
            "resistanceSource":"cable_machine",
            "doseMode":"isometric_hold",
            "leadSide":"declared",
            "pressRange":"declared_horizontal_reach",
            "anchorSide":"declared"
          }'::JSONB
        ),
        (
          9,
          'pallof-press-pallof-hold',
          'split-stance-pallof-press',
          'split_stance_resistance_lead_side_press_range_and_dose_mode',
          '{
            "stance":"split_stance",
            "resistanceSource":"declared_band_or_cable",
            "leadSide":"declared",
            "pressRange":"declared_horizontal_reach",
            "doseMode":"declared_repetition_or_hold"
          }'::JSONB
        ),
        (
          10,
          'pallof-press-step-out',
          'band-anti-rotation-walkout',
          'band_resistance_hand_position_step_count_direction_and_return',
          '{
            "resistanceSource":"resistance_band",
            "handPosition":"declared_sternum_or_horizontal_reach",
            "travelDirection":"lateral_away_from_anchor",
            "stepCount":"declared",
            "returnPath":"same_path_under_control"
          }'::JSONB
        ),
        (
          11,
          'pallof-press-step-out',
          'cable-anti-rotation-step-out',
          'cable_resistance_hand_position_step_count_direction_and_return',
          '{
            "resistanceSource":"cable_machine",
            "handPosition":"declared_sternum_or_horizontal_reach",
            "travelDirection":"lateral_away_from_anchor",
            "stepCount":"declared",
            "returnPath":"same_path_under_control"
          }'::JSONB
        )
    ) AS sources(
      sequence_number,
      survivor_slug,
      duplicate_slug,
      identity_boundary,
      variant_dimensions
    )
    ORDER BY sequence_number
  LOOP
    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 active_duplicate
      WHERE active_duplicate.slug = source.duplicate_slug
        AND active_duplicate.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_definition_v1 active_survivor
          WHERE active_survivor.facility_id =
              active_duplicate.facility_id
            AND active_survivor.slug = source.survivor_slug
            AND active_survivor.status <> 'archived'
        )
    ) THEN
      RAISE EXCEPTION
        'Pallof identity consolidation found active duplicate % without active survivor %',
        source.duplicate_slug,
        source.survivor_slug;
    END IF;

    FOR survivor IN
      SELECT
        id,
        facility_id,
        card_version,
        canonical_name,
        display_name
      FROM coaching.exercise_definition_v1
      WHERE slug = source.survivor_slug
        AND status <> 'archived'
    LOOP
      SELECT
        id,
        facility_id,
        legacy_exercise_id,
        canonical_name,
        display_name,
        aliases,
        provenance_json
      INTO duplicate
      FROM coaching.exercise_definition_v1
      WHERE facility_id = survivor.facility_id
        AND slug = source.duplicate_slug
        AND status <> 'archived';

      IF duplicate.id IS NULL THEN
        CONTINUE;
      END IF;

      target_ids := ARRAY[survivor.id, duplicate.id];

      SELECT COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
        )
        OR (
          resolution.survivor_definition_id = duplicate.id
          AND resolution.resolved_definition_id = survivor.id
        )
      )
        AND NOT (
          resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
          AND resolution.decision = 'duplicate_consolidated'
        );

      SELECT conflicting_resolutions + COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        resolution.survivor_definition_id = duplicate.id
        OR resolution.resolved_definition_id = duplicate.id
      )
        AND survivor.id NOT IN (
          resolution.survivor_definition_id,
          resolution.resolved_definition_id
        )
        AND NOT (
          resolution.decision = 'duplicate_consolidated'
          AND resolution.survivor_definition_id = duplicate.id
          AND EXISTS (
            SELECT 1
            FROM coaching.exercise_definition_v1 prior_duplicate
            WHERE prior_duplicate.id =
                resolution.resolved_definition_id
              AND prior_duplicate.status = 'archived'
          )
        );

      IF conflicting_resolutions > 0 THEN
        RAISE EXCEPTION
          'Pallof identity consolidation for % and % conflicts with % existing resolution(s)',
          source.survivor_slug,
          source.duplicate_slug,
          conflicting_resolutions;
      END IF;

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
          'Pallof identity consolidation for % refused to override % protected record(s)',
          source.duplicate_slug,
          protected_records;
      END IF;

      SELECT COALESCE(
        array_agg(DISTINCT definition_source.legacy_exercise_id),
        '{}'::BIGINT[]
      )
      INTO target_legacy_ids
      FROM coaching.exercise_definition_source_v1 definition_source
      WHERE definition_source.definition_id = ANY(target_ids);

      INSERT INTO coaching.exercise_identity_resolution_v1 (
        facility_id,
        survivor_definition_id,
        resolved_definition_id,
        decision,
        rationale,
        evidence_json,
        resolution_source,
        reviewed_by
      )
      VALUES (
        survivor.facility_id,
        survivor.id,
        duplicate.id,
        'duplicate_consolidated',
        format(
          '%s preserves the same base movement contract as %s. Its modifier is retained as exact variant metadata (%s), not as a separate exercise identity.',
          duplicate.canonical_name,
          survivor.canonical_name,
          source.identity_boundary
        ),
        jsonb_build_object(
          'match', 'same_base_movement_with_exact_variant_dimensions',
          'survivorSlug', source.survivor_slug,
          'resolvedSlug', source.duplicate_slug,
          'identityBoundary', source.identity_boundary,
          'variantDimensions', source.variant_dimensions,
          'sameBaseMovementContract', TRUE,
          'modifierBecomesExactVariant', TRUE,
          'researchVersion', '2026-07-26.43',
          'exerciseDifficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        'deterministic_identity_equivalence',
        NULL
      )
      ON CONFLICT (survivor_definition_id, resolved_definition_id)
      DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
          AND resolution.decision = 'duplicate_consolidated'
      ) THEN
        RAISE EXCEPTION
          'Pallof identity consolidation for % was not persisted',
          source.duplicate_slug;
      END IF;

      UPDATE coaching.exercise_definition_source_v1 definition_source
      SET definition_id = survivor.id,
          source_kind = 'duplicate_consolidation',
          provenance_json = definition_source.provenance_json
            || jsonb_build_object(
              'resolvedFromDefinitionId', duplicate.id,
              'resolution',
                'same_base_movement_with_exact_variant_dimensions',
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions
            )
      WHERE definition_source.definition_id = duplicate.id;

      UPDATE coaching.exercise_delivery_profile_v1 profile
      SET status = 'archived',
          updated_at = now()
      WHERE profile.variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = duplicate.id
      );

      UPDATE coaching.exercise_variant_v1 variant
      SET definition_id = survivor.id,
          variant_key = left(
            'legacy-source-'
            || COALESCE(
              duplicate.legacy_exercise_id::TEXT,
              left(duplicate.id::TEXT, 8)
            )
            || '-'
            || variant.variant_key,
            120
          ),
          status = 'archived',
          difficulty_json = variant.difficulty_json
            - 'skillLevel'
            - 'skill_level'
            - 'proficiencyLevel'
            - 'proficiency_level',
          requirements_json = variant.requirements_json
            - 'skillLevel'
            - 'skill_level'
            - 'proficiencyLevel'
            - 'proficiency_level'
            || jsonb_build_object(
              'sourceIdentityDuplicate', TRUE,
              'sourceDefinitionId', duplicate.id,
              'sourceDefinitionLineageIds',
                COALESCE(
                  variant.requirements_json
                    -> 'sourceDefinitionLineageIds',
                  '[]'::JSONB
                ) || to_jsonb(duplicate.id::TEXT),
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions,
              'selectable', FALSE,
              'identityQuarantine', TRUE
            ),
          updated_at = now()
      WHERE variant.definition_id = duplicate.id;

      UPDATE coaching.exercise_section_evidence_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_section_evidence_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND existing.section_key = candidate.section_key
            AND existing.source_url = candidate.source_url
        );

      UPDATE coaching.exercise_alternate_assessment_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_alternate_assessment_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND lower(existing.alternate_name) =
              lower(candidate.alternate_name)
        );

      UPDATE coaching.exercise_media_candidate_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_media_candidate_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND (
              existing.video_id = candidate.video_id
              OR existing.url = candidate.url
            )
        );

      UPDATE coaching.exercise_definition_v1 survivor_definition
      SET aliases = ARRAY(
            SELECT min(alias)
            FROM unnest(
              COALESCE(survivor_definition.aliases, '{}')
              || COALESCE(duplicate.aliases, '{}')
              || ARRAY[
                duplicate.canonical_name,
                duplicate.display_name
              ]
            ) alias
            WHERE nullif(btrim(alias), '') IS NOT NULL
              AND lower(alias) NOT IN (
                lower(survivor_definition.canonical_name),
                lower(survivor_definition.display_name)
              )
            GROUP BY lower(alias)
            ORDER BY lower(alias)
          ),
          provenance_json =
            survivor_definition.provenance_json
            || jsonb_build_object(
              'identityResolution',
                'same_base_movement_with_exact_variant_dimensions',
              'consolidatedDefinitionIds',
                COALESCE(
                  survivor_definition.provenance_json
                    -> 'consolidatedDefinitionIds',
                  '[]'::JSONB
                ) || to_jsonb(duplicate.id::TEXT),
              'consolidatedLegacyExerciseIds',
                COALESCE(
                  survivor_definition.provenance_json
                    -> 'consolidatedLegacyExerciseIds',
                  '[]'::JSONB
                ) || to_jsonb(duplicate.legacy_exercise_id),
              'researchVersion', '2026-07-26.43',
              'exerciseDifficultyModel',
                'max_exercise_complexity_physical_difficulty',
              'humanReviewRequired', TRUE,
              'publicationQuarantined', TRUE
            ),
          updated_at = now()
      WHERE survivor_definition.id = survivor.id;

      UPDATE coaching.exercise
      SET skill_level = NULL,
          updated_at = now()
      WHERE id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_scaling_profile
      SET skill_level = NULL
      WHERE exercise_id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_safety_profile
      SET minimum_skill_level = NULL
      WHERE exercise_id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_card_test_packet_v1 packet
      SET status = 'quarantined',
          blocking_issues_json =
            packet.blocking_issues_json
            || jsonb_build_array(
              jsonb_build_object(
                'code', 'pallof_identity_consolidation_reaudit_required',
                'message',
                  format(
                    'Re-run the canonical card audit after consolidating %s.',
                    source.duplicate_slug
                  ),
                'sourceSlug', source.duplicate_slug
              )
            ),
          human_review_required = TRUE,
          checked_at = now()
      WHERE packet.definition_id = survivor.id;

      UPDATE coaching.exercise_definition_v1 archived_duplicate
      SET status = 'archived',
          approved_video_url = NULL,
          provenance_json =
            archived_duplicate.provenance_json
            || jsonb_build_object(
              'identityResolution', 'duplicate_consolidated',
              'canonicalSurvivorDefinitionId', survivor.id,
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions,
              'researchVersion', '2026-07-26.43',
              'exerciseDifficultyModel',
                'max_exercise_complexity_physical_difficulty',
              'humanReviewRequired', TRUE,
              'publicationQuarantined', TRUE
            ),
          updated_at = now()
      WHERE archived_duplicate.id = duplicate.id;
    END LOOP;
  END LOOP;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_v1
    WHERE status <> 'archived'
      AND slug IN (
        'anti-rotation-cable-press-out',
        'band-anti-rotation-walkout',
        'band-pallof-press',
        'cable-anti-rotation-step-out',
        'half-kneeling-pallof-press',
        'pallof-press-eccentric-return',
        'pallof-press-pallof-hold',
        'pallof-press-reps',
        'pallof-press-step-out',
        'partner-pallof-band-hold',
        'split-stance-cable-pallof-iso-hold',
        'split-stance-pallof-press',
        'tall-kneeling-pallof-press-hold'
      )
  ) <> 2 THEN
    RAISE EXCEPTION
      'Pallof identity consolidation did not leave exactly two active survivors';
  END IF;

  -- Persist explicit boundaries for the nearest related actions. These are
  -- deterministic movement-contract decisions, not human approvals.
  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by
  )
  SELECT
    boundary_survivor.facility_id,
    boundary_survivor.id,
    boundary_related.id,
    'distinct_exercises',
    boundary.rationale,
    jsonb_build_object(
      'match', 'distinct_primary_action_or_force_path',
      'survivorSlug', boundary.survivor_slug,
      'relatedSlug', boundary.related_slug,
      'identityBoundary', boundary.identity_boundary,
      'researchVersion', '2026-07-26.43',
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE
    ),
    'deterministic_identity_equivalence',
    NULL
  FROM (
    VALUES
      (
        'pallof-press-pallof-hold',
        'pallof-press-step-out',
        'fixed_stance_press_or_hold_vs_lateral_step_out_and_return',
        'Pallof Press remains fixed in the declared stance; Pallof Step-Out adds lateral travel away from and back toward the anchor.'
      ),
      (
        'pallof-press-pallof-hold',
        'pallof-press-with-march',
        'fixed_stance_press_or_hold_vs_alternating_march',
        'Pallof Press remains fixed in the declared stance; Pallof Press with March adds alternating hip flexion and single-leg support.'
      ),
      (
        'pallof-press-pallof-hold',
        'half-kneeling-anti-rotation-press-lift-hold',
        'horizontal_press_or_hold_vs_diagonal_lift',
        'Pallof Press uses a horizontal sternum-to-reach path; the press-lift hold adds a diagonal lift and shoulder-elevation action.'
      ),
      (
        'pallof-press-pallof-hold',
        'split-stance-anti-rotation-row',
        'bilateral_horizontal_press_vs_unilateral_row',
        'Pallof Press is a bilateral horizontal press; the anti-rotation row adds a unilateral pulling action.'
      ),
      (
        'pallof-press-pallof-hold',
        'tall-kneeling-anti-rotation-pulldown',
        'horizontal_press_or_hold_vs_vertical_pulldown',
        'Pallof Press uses a horizontal press or hold; the tall-kneeling anti-rotation pulldown adds a vertical pulling action.'
      ),
      (
        'pallof-press-pallof-hold',
        'landmine-anti-rotation-press',
        'linear_side_anchor_press_vs_fixed_arc_landmine_press',
        'Pallof Press uses a side-anchored linear resistance path; the landmine press follows a loaded fixed arc around a grounded bar end.'
      ),
      (
        'pallof-press-step-out',
        'mini-band-lateral-walk',
        'side_anchored_hand_constraint_vs_lower_limb_loop_band_walk',
        'Pallof Step-Out uses a side-anchored hand constraint; the mini-band lateral walk loads the lower limbs and has no Pallof hand constraint.'
      ),
      (
        'pallof-press-step-out',
        'pallof-press-with-march',
        'lateral_travel_vs_alternating_sagittal_march',
        'Pallof Step-Out uses lateral travel away from and back toward the anchor; the march alternates sagittal hip flexion in place.'
      )
  ) AS boundary(
    survivor_slug,
    related_slug,
    identity_boundary,
    rationale
  )
  JOIN coaching.exercise_definition_v1 boundary_survivor
    ON boundary_survivor.slug = boundary.survivor_slug
   AND boundary_survivor.status <> 'archived'
  JOIN coaching.exercise_definition_v1 boundary_related
    ON boundary_related.facility_id = boundary_survivor.facility_id
   AND boundary_related.slug = boundary.related_slug
   AND boundary_related.status <> 'archived'
  ON CONFLICT (survivor_definition_id, resolved_definition_id)
  DO UPDATE
  SET decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';
END;
$$;
