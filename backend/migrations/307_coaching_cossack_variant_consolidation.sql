-- Consolidate Cossack squat cards that differ only by range, tempo, hold,
-- reach overlay, external implement, or contextual delivery into one canonical
-- Cossack squat definition. The medicine-ball wall-toss composite remains a
-- separate definition because release, target, rebound, and reception change
-- the task identity.
--
-- The generic loaded source and generic reach source remain explicitly
-- identity-quarantined until a human resolves the missing implement and reach
-- direction. The second bottom-hold source is preserved as an archived source
-- variant rather than creating two selectable variants for the same hold.
--
-- Legacy source mappings, variants, delivery profiles, candidate evidence,
-- candidate media, aliases, and provenance remain traceable. Any human-reviewed
-- evidence, alternates, card revision/review, or media review fails closed
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
        'cossack-bottom-hold',
        'bottom-hold',
        ARRAY['deep_range', 'isometric_hold']::TEXT[],
        '{"rangeOfMotion":"self_selected_pain_free_deep_frontal_plane","holdRequired":true}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'range_and_isometric_hold',
        'The bottom hold uses the same frontal-plane Cossack squat position and joint actions. Depth and hold duration are range and tempo dimensions, not a separate exercise identity.'
      ),
      (
        'cossack-bottom-hold-cossack-shift-hold',
        'bottom-hold-source-259',
        ARRAY['deep_range', 'isometric_hold', 'duplicate_source_context']::TEXT[],
        '{"rangeOfMotion":"self_selected_pain_free_deep_frontal_plane","holdRequired":true,"duplicateOfVariantKey":"bottom-hold"}'::JSONB,
        ARRAY['none']::TEXT[],
        FALSE,
        'duplicate_source_wording',
        'Cossack Bottom Hold / Cossack Shift Hold describes the same held bottom position as Cossack Bottom Hold. Shift wording describes entry into the hold and does not create another selectable variant.'
      ),
      (
        'cossack-shift-with-reach',
        'reach-overlay',
        ARRAY['reach_overlay', 'reach_direction_unresolved']::TEXT[],
        '{"reachDirection":"unspecified_source_requires_human_review","identityQuarantine":true}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'upper_body_reach_overlay',
        'The source preserves the same side-to-side Cossack squat action and adds an upper-body reach. Reach is a controlled overlay; its unspecified direction remains quarantined for human clarification.'
      ),
      (
        'cossack-shift-with-t-spine-reach',
        'thoracic-rotation-reach',
        ARRAY['reach_overlay', 'thoracic_rotation']::TEXT[],
        '{"reachDirection":"thoracic_rotation_toward_assigned_side","rotationMustRemainPainFree":true}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'thoracic_rotation_reach_overlay',
        'Thoracic rotation adds an upper-body mobility overlay while the same Cossack squat and lateral weight-shift action remains primary. It is an exact reach variant, not a new exercise definition.'
      ),
      (
        'cossack-shift',
        'low-amplitude-shift',
        ARRAY['low_amplitude', 'continuous_lateral_shift']::TEXT[],
        '{"rangeOfMotion":"low_amplitude_self_selected","depthConstraint":"remain_above_end_range_until_controlled"}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'range_of_motion',
        'Low amplitude changes depth and accessibility while retaining the same frontal-plane lateral squat and side-to-side transfer. Range of motion is a controlled variant dimension.'
      ),
      (
        'cossack-squat-pry',
        'bottom-pry',
        ARRAY['deep_range', 'bottom_pry']::TEXT[],
        '{"rangeOfMotion":"self_selected_pain_free_deep_frontal_plane","bottomPositionMovement":"small_controlled_pry"}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'bottom_position_mobility_overlay',
        'The pry adds small controlled motion in the Cossack bottom position without changing the primary squat identity. It is a bottom-position mobility variant.'
      ),
      (
        'cossack-squat-shift-to-stick',
        'shift-to-stick',
        ARRAY['lateral_shift', 'terminal_stick']::TEXT[],
        '{"terminalHoldRequired":true,"terminalHoldSeconds":"coach_selected","extraBalanceContactsAllowed":false}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'terminal_pause',
        'The exercise uses the same Cossack squat shift and adds a deliberately held terminal position. The stick is a terminal pause and quality constraint, not a new movement identity.'
      ),
      (
        'kettlebell-cossack-squat',
        'kettlebell-loaded',
        ARRAY['external_load', 'kettlebell']::TEXT[],
        '{"requiredEquipment":["kettlebell"],"loadSelection":"coach_selected_for_full_control"}'::JSONB,
        ARRAY['kettlebell']::TEXT[],
        TRUE,
        'implement',
        'A kettlebell changes external loading and load position while retaining the same Cossack squat pattern. Implement is a controlled variant dimension.'
      ),
      (
        'landmine-cossack-squat',
        'landmine-loaded',
        ARRAY['external_load', 'landmine']::TEXT[],
        '{"requiredEquipment":["landmine"],"loadSelection":"coach_selected_for_full_control","secureLandmineAnchorRequired":true}'::JSONB,
        ARRAY['landmine']::TEXT[],
        TRUE,
        'implement',
        'The landmine changes external loading, support, and force direction while retaining the same Cossack squat pattern. It belongs to the implement variant set.'
      ),
      (
        'loaded-cossack-squat',
        'loaded-unspecified-implement',
        ARRAY['external_load', 'implement_unresolved']::TEXT[],
        '{"requiredEquipmentIdentity":"unspecified_source_requires_human_review","identityQuarantine":true}'::JSONB,
        ARRAY[]::TEXT[],
        TRUE,
        'unspecified_implement',
        'Loaded Cossack Squat retains the same movement identity, but the source does not identify the implement or load position. It remains an explicitly quarantined variant until a human resolves those requirements.'
      ),
      (
        'sandbag-cossack-squat-strength',
        'sandbag-loaded',
        ARRAY['external_load', 'sandbag']::TEXT[],
        '{"requiredEquipment":["sandbag"],"loadSelection":"coach_selected_for_full_control"}'::JSONB,
        ARRAY['sandbag']::TEXT[],
        TRUE,
        'implement',
        'A sandbag changes external loading and load position while retaining the same Cossack squat pattern. Strength names the delivery intent, not a separate exercise identity.'
      ),
      (
        'slow-cossack-squat-shift',
        'slow-eccentric-shift',
        ARRAY['slow_tempo', 'continuous_lateral_shift']::TEXT[],
        '{"tempo":"slow_controlled_eccentric_and_transition","rangeOfMotion":"pain_free_repeatable"}'::JSONB,
        ARRAY['none']::TEXT[],
        TRUE,
        'tempo',
        'Slow changes cadence and eccentric exposure while retaining the same Cossack squat shift. Tempo is a controlled variant dimension.'
      )
    ) AS pairs(
      duplicate_slug,
      target_variant_key,
      modifier_keys,
      requirements_patch,
      equipment_required,
      keep_selectable,
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
    WHERE slug = 'cossack-squat'
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
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        'Cossack variant consolidation for % requires human review: % protected records',
        pair.duplicate_slug,
        protected_records;
    END IF;

    IF pair.keep_selectable AND EXISTS (
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE definition_id = survivor_id
        AND variant_key = pair.target_variant_key
    ) THEN
      RAISE EXCEPTION
        'Cossack variant consolidation for % conflicts with survivor variant key %',
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
        'selectable_variant', pair.keep_selectable,
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

    IF pair.keep_selectable THEN
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
      SET equipment_required = pair.equipment_required,
          status = 'review',
          updated_at = now()
      FROM coaching.exercise_variant_v1 variant
      WHERE profile.variant_id = variant.id
        AND variant.definition_id = survivor_id
        AND variant.variant_key = pair.target_variant_key;
    ELSE
      UPDATE coaching.exercise_variant_v1
      SET variant_key = pair.target_variant_key,
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
          status = 'archived',
          updated_at = now()
      WHERE definition_id = duplicate_id;

      UPDATE coaching.exercise_delivery_profile_v1 profile
      SET equipment_required = pair.equipment_required,
          status = 'archived',
          updated_at = now()
      FROM coaching.exercise_variant_v1 variant
      WHERE profile.variant_id = variant.id
        AND variant.definition_id = duplicate_id;
    END IF;

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
        approved_by = NULL,
        approved_video_url = NULL,
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_card_test_packet_v1
    SET status = 'quarantined',
        blocking_issues_json = blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'variant_consolidation_reaudit_required',
            'message', 'Re-run the canonical card audit after the Cossack variant consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        approved_by = NULL,
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

  -- The baseline is bodyweight. Its older source-context variant is also
  -- bodyweight and remains in review state.
  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET equipment_required = ARRAY['none']::TEXT[],
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE profile.variant_id = variant.id
    AND definition.slug = 'cossack-squat'
    AND definition.status <> 'archived'
    AND variant.variant_key IN ('baseline', 'baseline-source-1386');

  -- The wall-ball composite stays separate. Exact throw direction, target,
  -- rebound, and reception protocol are unresolved and therefore quarantined.
  UPDATE coaching.exercise_definition_v1
  SET required_equipment = ARRAY['medicine_ball', 'wall']::TEXT[],
      status = 'review',
      approved_by = NULL,
      approved_video_url = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identity_review',
          'release_and_reception_make_this_distinct_from_cossack_squat',
        'identity_uncertainty',
          'throw_direction_target_rebound_and_reception_protocol_unresolved',
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'human_review_required', TRUE,
        'publication_quarantined', TRUE
      ),
      updated_at = now()
  WHERE slug = 'cossack-shift-to-wall-ball-toss'
    AND status <> 'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET modifier_keys = ARRAY(
        SELECT min(modifier)
        FROM unnest(
          COALESCE(variant.modifier_keys, '{}')
          || ARRAY[
            'medicine_ball',
            'wall_target',
            'release_and_reception',
            'throw_protocol_unresolved'
          ]::TEXT[]
        ) modifier
        WHERE nullif(btrim(modifier), '') IS NOT NULL
        GROUP BY lower(modifier)
        ORDER BY lower(modifier)
      ),
      requirements_json = variant.requirements_json || jsonb_build_object(
        'requiredEquipment', ARRAY['medicine_ball', 'wall']::TEXT[],
        'throwProtocol',
          'direction_target_rebound_and_reception_require_human_review',
        'identityQuarantine', TRUE
      ),
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE variant.definition_id = definition.id
    AND definition.slug = 'cossack-shift-to-wall-ball-toss'
    AND definition.status <> 'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET equipment_required = ARRAY['medicine_ball', 'wall']::TEXT[],
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE profile.variant_id = variant.id
    AND definition.slug = 'cossack-shift-to-wall-ball-toss'
    AND definition.status <> 'archived';

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET status = 'quarantined',
      blocking_issues_json = packet.blocking_issues_json || jsonb_build_array(
        jsonb_build_object(
          'code', 'wall_ball_identity_protocol_review_required',
          'message', 'Human review must define throw direction, target, rebound, and reception before publication.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE packet.definition_id = definition.id
    AND definition.slug = 'cossack-shift-to-wall-ball-toss'
    AND definition.status <> 'archived';
END;
$$;
