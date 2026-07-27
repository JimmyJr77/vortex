-- Consolidate the mechanically supported duplicate/variant identities in the
-- score-81 canonical queue.
--
-- Stable survivors retain source traceability, aliases, candidate evidence,
-- candidate media, and archived legacy variants. Implement, support, stance,
-- tempo, target, orientation, foot exchange, and dosage remain exact variant
-- dimensions. This migration creates no human approval.
--
-- Exercise cards use exercise complexity and physical difficulty only. Athlete
-- skill/proficiency levels remain exclusive to skill-library cards.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '378_coaching_score_81_variant_identity_consolidations';
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
    FROM (VALUES
      (
        'pro-agility-5-10-5',
        '5-10-5-pro-agility-shuttle',
        '5-10-5 Pro Agility Shuttle',
        'same_five_ten_five_pro_agility_route',
        'Both sources use three aligned cones with five yards from center to each outside cone, repeated 180-degree cuts, and acceleration through the finish. Name order, start side, touch hand, route direction, cone spacing, finish, rest, and dose are exact variants.',
        '["start_side","first_direction","touch_hand","cone_spacing","distance_unit","finish","measurement","rest","dose"]'::JSONB
      ),
      (
        'bent-over-barbell-row',
        'barbell-t-bar-row',
        'Barbell T-Bar Row',
        'same_hinge_held_horizontal_barbell_row_with_pivot_variant',
        'Both sources hold an organized hinge while rowing a barbell load toward the trunk and controlling the return. A T-bar pivot constrains the bar path and changes attachment, grip, stance, range, setup, and load tolerance within the same bent-over row identity.',
        '["bar_path_constraint","pivot_or_attachment","grip","stance","range","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'pike-push-up',
        'box-pike-handstand-push-up',
        'Box Pike Handstand Push-Up',
        'same_pike_vertical_bodyweight_press_with_foot_elevation_variant',
        'Both sources use a high-hip pike position and controlled bodyweight vertical press. Elevating the feet on a box changes support height, body angle, shoulder loading, range, head clearance, setup, spotting, and difficulty without changing the underlying pike press.',
        '["foot_elevation","support_height","body_angle","range","head_clearance","hand_position","tempo","rest","dose"]'::JSONB
      ),
      (
        'wall-handstand-hold',
        'chest-to-wall-handstand-hold',
        'Chest-to-Wall Handstand Hold',
        'same_wall_supported_handstand_with_chest_to_wall_orientation',
        'Wall Handstand Hold already permits a declared wall-supported orientation. Chest-to-wall changes body orientation, wall contact, entry, exit, spotting, line demand, and hold duration within the same wall-supported inverted hold identity.',
        '["body_orientation_to_wall","wall_contact","entry","exit","spotting","hold_duration","rest","dose"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'med-ball-countermovement-rotational-throw',
        'Countermovement Rotational Medicine-Ball Throw',
        'same_rotational_medicine_ball_projection_with_preload_variant',
        'Both sources project a medicine ball transversely to a declared wall target through sequenced whole-body rotation. A declared countermovement changes preload, stance, pivot policy, contact count, target, return policy, ball mass, and dose within the same rotational throw identity.',
        '["preload","countermovement","stance","pivot_policy","throwing_side","target","return_policy","ball_mass","rest","dose"]'::JSONB
      ),
      (
        'front-squat',
        'tempo-front-squat',
        'Tempo Front Squat',
        'same_front_rack_squat_with_eccentric_tempo_variant',
        'Both sources use a front-rack squat with an upright torso, controlled depth, and full-foot ascent. A four-to-five-second lowering changes contraction emphasis, tempo, pause, load, range, rest, and dose within the same front-squat identity.',
        '["contraction_emphasis","eccentric_duration","pause","front_rack_implement","range","load","rest","dose"]'::JSONB
      ),
      (
        'goblet-squat-bottom-iso-hold',
        'kettlebell-goblet-squat-iso-hold',
        'Kettlebell Goblet Squat Iso Hold',
        'same_goblet_loaded_bottom_squat_isometric',
        'Both sources hold a front-loaded goblet squat at a declared bottom position without visible joint motion while preserving foot pressure, alignment, bracing, and breathing. Implement, hold angle, depth, load, hold duration, breathing cadence, rest, and dose are exact variants.',
        '["implement","hold_angle","depth","load","hold_duration","breathing_cadence","rest","dose"]'::JSONB
      ),
      (
        'lateral-lunge',
        'lateral-lunge-shift',
        'Lateral Lunge Shift',
        'same_lateral_lunge_with_continuous_shift_delivery_variant',
        'Both sources load one hip in a wide or stepped frontal-plane stance while the loaded foot stays flat, the opposite leg remains long, and the athlete returns under control. Alternating shifts change entry, side sequence, cadence, reset, range, and dose within the same lateral-lunge identity.',
        '["entry","side_sequence","continuous_or_reset","cadence","stance_width","range","load","rest","dose"]'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'shuffle-to-stick',
        'Shuffle-to-Stick',
        'same_lateral_shuffle_to_terminal_deceleration_hold',
        'Both sources shuffle laterally for a declared short distance, decelerate before the finish, and hold a balanced terminal athletic position. Distance, direction, shuffle contacts, cue, stick duration, target, reset, rest, and dose are exact variants.',
        '["distance","direction","shuffle_contact_count","cue","stick_duration","target","reset","rest","dose"]'::JSONB
      ),
      (
        'low-hurdle-hop-to-stick',
        'low-cone-hop-to-stick',
        'Low Cone Hop to Stick',
        'same_bilateral_low_obstacle_hop_to_terminal_stick',
        'Both sources require a two-foot hop over one low external marker and a controlled terminal landing on the far side. Cone versus soft marker or hurdle changes obstacle type, height, width, clearance, collision risk, setup, and difficulty within the same identity.',
        '["obstacle_type","obstacle_height","obstacle_width","clearance","landing_distance","stick_duration","rest","dose"]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-eccentric-landmine-press',
        'One-Arm Eccentric Landmine Press',
        'same_one_arm_landmine_arc_press_with_eccentric_emphasis',
        'The two source cards use the same fixed angled landmine path, movement description, execution steps, one-arm finish, trunk constraint, and controlled return. Slow lowering changes contraction emphasis, eccentric duration, assistance, load, range, and dose within the same stance-unspecified arc-press identity.',
        '["contraction_emphasis","eccentric_duration","concentric_assistance","hand","range","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'pistol-squat',
        'pistol-squat-to-box',
        'Pistol Squat to Box',
        'same_single_leg_squat_with_box_depth_target_variant',
        'Both sources use a controlled single-leg squat and return through the same support leg. A box changes depth target, terminal contact, support allowance, reversal, setup, range, assistance, and difficulty within the pistol-squat identity.',
        '["box_target","box_height","contact_policy","support_allowance","range","assistance","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'reverse-lunge',
        'reverse-lunge-negative',
        'Reverse Lunge Negative',
        'same_reverse_step_lunge_with_eccentric_emphasis',
        'Both sources step backward, lower through the front leg, lightly contact or approach the bottom position, and return to standing through the front leg. A slow negative changes eccentric duration, bottom touch, assistance, load, tempo, rest, and dose within the reverse-lunge identity.',
        '["contraction_emphasis","eccentric_duration","bottom_touch","rear_leg_assistance","range","load","rest","dose"]'::JSONB
      ),
      (
        'sprint-to-stick-deceleration',
        'sprint-to-balance-deceleration',
        'Sprint-to-Balance Deceleration',
        'same_linear_sprint_deceleration_to_terminal_balance',
        'Both sources accelerate linearly for a short distance, brake inside a declared zone, and finish in a balanced athletic stick before walking back. Finish stance, approach distance, stop-zone length, speed, stick duration, measurement, rest, and dose are exact variants.',
        '["finish_stance","approach_distance","stop_zone_distance","speed","stick_duration","measurement","rest","dose"]'::JSONB
      ),
      (
        'step-up-jump',
        'switch-step-up-jump',
        'Switch Step-Up Jump',
        'same_box_step_up_jump_with_airborne_foot_exchange_variant',
        'Both sources begin with one foot on a low box, drive vertically through that support, create flight, and land with controlled box contact. Switching feet in flight changes foot exchange, landing foot, alternation, contact sequence, box height, rhythm, and dose within the step-up-jump identity.',
        '["airborne_foot_exchange","takeoff_foot","landing_foot","alternation","contact_sequence","box_height","rhythm","rest","dose"]'::JSONB
      )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      retained_alias,
      identity_match,
      rationale,
      variant_dimensions
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
        '% requires active survivor %',
        migration_key,
        pair.survivor_slug;
    END IF;

    IF duplicate_id IS NULL THEN
      RAISE EXCEPTION
        '% requires traceable duplicate %',
        migration_key,
        pair.duplicate_slug;
    END IF;

    IF duplicate_status = 'archived' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate_id
          AND resolution.decision = 'duplicate_consolidated'
      ) THEN
        RAISE EXCEPTION
          '% found archived duplicate % without identity resolution',
          migration_key,
          pair.duplicate_slug;
      END IF;
      CONTINUE;
    END IF;

    IF duplicate_legacy_id IS NULL THEN
      RAISE EXCEPTION
        '% requires legacy traceability for %',
        migration_key,
        pair.duplicate_slug;
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
          resolution.decision <> 'duplicate_consolidated'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for % and %',
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
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_v1 score
        WHERE score.exercise_id IN (
          SELECT source.legacy_exercise_id
          FROM coaching.exercise_definition_source_v1 source
          WHERE source.definition_id IN (survivor_id, duplicate_id)
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
        'legacySourceCardsAudited', TRUE,
        'variantDimensions', pair.variant_dimensions,
        'dimensionIsExactVariant', TRUE,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'decisionScope',
          'identity_and_traceability_only_not_human_approval',
        'humanReviewRequired', TRUE,
        'reviewerAssigned', FALSE,
        'publicationQuarantined', TRUE,
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id)
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', duplicate_id,
          'resolution', pair.identity_match,
          'variantDimensions', pair.variant_dimensions,
          'migration', migration_key
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
          || duplicate_legacy_id::TEXT
          || '-'
          || variant_key,
          120
        ),
        status = 'archived',
        requirements_json = requirements_json || jsonb_build_object(
          'sourceIdentityDuplicate', TRUE,
          'sourceDefinitionId', duplicate_id,
          'variantDimensions', pair.variant_dimensions,
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'migration', migration_key
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
              pair.retained_alias
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
          'identityResolution', pair.identity_match,
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
          'variantDimensions', pair.variant_dimensions,
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
            'code', 'identity_consolidation_reaudit_required',
            'message',
              'Re-run the canonical card audit after score-81 identity consolidation.',
            'resolvedSlug', pair.duplicate_slug
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
          'identityMatch', pair.identity_match,
          'variantDimensions', pair.variant_dimensions,
          'identityMigration', migration_key,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;

    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
        AND resolution.decision = 'duplicate_consolidated'
    ) OR EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1
      WHERE id = duplicate_id
        AND status <> 'archived'
    ) THEN
      RAISE EXCEPTION
        '% did not fully consolidate % into %',
        migration_key,
        pair.duplicate_slug,
        pair.survivor_slug;
    END IF;
  END LOOP;
END;
$$;
