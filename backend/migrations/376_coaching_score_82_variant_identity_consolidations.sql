-- Consolidate the mechanically supported duplicate/variant identities in the
-- score-82 canonical queue.
--
-- Stable survivors retain source traceability, aliases, candidate evidence,
-- candidate media, and archived legacy variants. Implement, support, lever,
-- landing, range, distance, target, load, breathing, tempo, and dosage remain
-- exact variant dimensions. This migration creates no human approval.
--
-- Exercise cards use exercise complexity and physical difficulty only. Athlete
-- skill/proficiency levels remain exclusive to skill-library cards.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '376_coaching_score_82_variant_identity_consolidations';
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
        'banded-good-morning',
        'sandbag-good-morning-strength',
        'Sandbag Good Morning',
        'same_bilateral_good_morning_hip_hinge_with_implement_variant',
        'Both sources use a bilateral good-morning hinge with soft knees, controlled torso inclination, a braced trunk, and hip extension to stand. Band versus sandbag changes resistance curve, load placement, pickup, grip, setup, and load tolerance without changing the ordered movement.',
        '["implement","load_placement","resistance_curve","pickup","grip","range","tempo","rest","dose"]'::JSONB
      ),
      (
        'bent-knee-soleus-raise',
        'seated-soleus-raise-bent-knee-calf-raise',
        'Seated Soleus Raise / Bent-Knee Calf Raise',
        'same_bent_knee_plantarflexion_with_seated_support_variant',
        'Both sources train controlled plantarflexion with the knee flexed to bias soleus capacity, include a top pause, and prohibit bouncing. Seated support, hip angle, external load over the thighs, forefoot elevation, range, and dose are exact variants.',
        '["support_position","hip_angle","knee_angle","external_load","forefoot_elevation","range","pause","tempo","rest","dose"]'::JSONB
      ),
      (
        'bent-over-barbell-row',
        'dumbbell-bent-over-row',
        'Dumbbell Bent-Over Row',
        'same_hinge_held_horizontal_row_with_implement_variant',
        'Both sources hold a bilateral hip hinge while rowing an external load toward the trunk and controlling the return. Barbell versus dumbbell changes hand independence, grip, load path, range, symmetry, setup, and load tolerance within the same bent-over row identity.',
        '["implement","hand_independence","grip","load_path","bilateral_or_alternating","range","tempo","load","rest","dose"]'::JSONB
      ),
      (
        'single-leg-balance-clock',
        'clock-reach-balance',
        'Clock Reach Balance',
        'same_single_leg_clock_target_reach',
        'Both sources maintain single-leg support while the free limb reaches to declared clock-face targets and the stance foot, knee, pelvis, and trunk remain controlled. Target order, reach direction, reach distance, support, touch policy, side, and dose are exact variants.',
        '["target_order","reach_direction","reach_distance","support","touch_policy","stance_side","tempo","rest","dose"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'close-grip-dumbbell-floor-press',
        'Close-Grip Dumbbell Floor Press',
        'same_supine_free_weight_floor_press_with_grip_variant',
        'Both sources use a supine floor-supported press with free weights, controlled upper-arm contact with the floor, and a stable terminal press. Close grip changes implement spacing, elbow path, triceps demand, wrist position, load, and range within the existing dumbbell or kettlebell floor-press identity.',
        '["implement","grip_width","implement_spacing","elbow_path","wrist_position","range","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'copenhagen-plank-short-lever',
        'copenhagen-plank-long-lever',
        'Copenhagen Plank Long Lever',
        'same_copenhagen_side_support_with_lever_variant',
        'Both sources use a side-plank support with the upper leg on a bench while the athlete maintains hip adduction, pelvic position, trunk alignment, and breathing. Knee or thigh support versus ankle or foot support changes lever length, contact point, adductor demand, difficulty, hold duration, and dose without changing the exercise identity.',
        '["lever_length","bench_contact_point","bottom_leg_position","support_height","hold_duration","side","assistance","rest","dose"]'::JSONB
      ),
      (
        'countermovement-jump',
        'countermovement-jump-to-stick',
        'Countermovement Jump to Stick',
        'same_countermovement_vertical_jump_with_terminal_landing_variant',
        'Both sources use a rapid dip and vertical drive from the same countermovement-jump action. Requiring a quiet landing and fixed hold changes terminal action, landing quality gate, reset, measurement priority, impact tolerance, and dose, but not the jump identity.',
        '["terminal_action","stick_duration","landing_quality_gate","arm_action","countermovement_depth","measurement","reset","rest","dose"]'::JSONB
      ),
      (
        'static-squat-jump-to-box',
        'deep-squat-jump-to-box',
        'Deep Squat Jump to Box',
        'same_static_squat_start_to_terminal_box_jump_with_depth_variant',
        'Both sources begin from a deliberately still squat, create a concentric jump to a box, land with the whole foot, stand, step down, and reset. Deep start wording changes squat depth, hold duration, range, box height, and dose within the static squat-jump-to-box identity.',
        '["start_depth","start_hold_duration","range","arm_action","box_height","landing","step_down","rest","dose"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'kettlebell-crush-grip-floor-press',
        'Kettlebell Crush-Grip Floor Press',
        'same_supine_free_weight_floor_press_with_crush_grip_variant',
        'Both sources use a supine floor-supported press with controlled upper-arm contact and a stable terminal position. A kettlebell crush grip changes implement, inward compression intent, hand spacing, wrist demand, elbow path, load, and range within the same floor-press identity.',
        '["implement","grip","compression_intent","implement_spacing","wrist_position","elbow_path","range","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'dumbbell-bench-press',
        'dumbbell-bench-press-eccentric',
        'Dumbbell Bench Press Eccentric',
        'same_dumbbell_bench_press_with_eccentric_emphasis',
        'Both sources use a dumbbell bench press path from a stable supine bench base. A declared slow eccentric or eccentric-only reset changes contraction emphasis, lowering duration, assistance, range, load, and dose without changing the underlying press identity.',
        '["contraction_emphasis","eccentric_duration","concentric_assistance","bench_angle","grip","range","load","rest","dose"]'::JSONB
      ),
      (
        'dumbbell-z-press',
        'kettlebell-z-press',
        'Kettlebell Z Press',
        'same_floor_seated_strict_overhead_press_with_implement_variant',
        'Both sources use a floor-seated strict overhead press with extended legs, no leg drive, and high trunk and hip-position demand. Dumbbell versus kettlebell changes implement balance, grip, rack position, hand independence, setup, load, and range within the same Z-press identity.',
        '["implement","grip","rack_position","hand_independence","bilateral_or_alternating","range","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'flying-10',
        'flying-20',
        'Flying 20',
        'same_build_in_to_max_velocity_fly_with_distance_variant',
        'Both sources use a progressive build-in, a declared near-maximal upright fly zone, a safe deceleration lane, and full recovery. Ten versus twenty yards changes exposure distance, run-in, deceleration space, time at velocity, hamstring and neural load, repetition count, and rest within the same flying-sprint identity.',
        '["fly_distance","distance_unit","build_in_distance","deceleration_distance","time_at_velocity","measurement","rest","dose"]'::JSONB
      ),
      (
        'goblet-squat',
        'heels-elevated-goblet-squat',
        'Heels-Elevated Goblet Squat',
        'same_front_held_goblet_squat_with_heel_elevation_variant',
        'Both sources use a front-held goblet load and controlled bilateral squat. Elevating the heels changes ankle demand, allowable knee travel, torso angle, depth, equipment, setup, and load tolerance within the same goblet-squat identity.',
        '["heel_elevation","wedge_or_plate","stance","knee_travel","torso_angle","depth","load","tempo","rest","dose"]'::JSONB
      ),
      (
        'hollow-body-hold',
        'medicine-ball-hollow-body-hold',
        'Medicine Ball Hollow Body Hold',
        'same_supine_hollow_hold_with_external_load_variant',
        'Both sources maintain a supine hollow-body position with trunk anti-extension and a declared arm and leg lever. Holding a medicine ball changes external load, hand position, arm lever, pickup and set-down, breathing demand, hold duration, and difficulty within the same hollow-hold identity.',
        '["external_load","implement","hand_position","arm_lever","leg_lever","pickup","set_down","hold_duration","rest","dose"]'::JSONB
      ),
      (
        'kettlebell-deadlift',
        'kettlebell-suitcase-deadlift',
        'Kettlebell Suitcase Deadlift',
        'same_dead_start_kettlebell_hinge_with_offset_load_variant',
        'Both sources use a dead-start kettlebell hinge, controlled extension to stand, and a reset on the floor. Placing one bell beside one leg changes load symmetry, hand, anti-lateral-flexion demand, grip, stance, load path, side-specific dose, and difficulty within the kettlebell-deadlift identity.',
        '["load_symmetry","hand","bell_count","bell_position","anti_lateral_flexion_demand","grip","stance","range","load","rest","dose"]'::JSONB
      ),
      (
        'low-box-step-off-to-stick',
        'low-box-step-off-to-horizontal-stick',
        'Low Box Step-Off to Horizontal Stick',
        'same_low_box_step_off_landing_with_travel_variant',
        'Both sources begin on a low box, step off without an active jump, absorb the floor contact, and hold a controlled terminal landing. Requiring small forward travel changes step direction, horizontal momentum, landing location, box placement, impact profile, and difficulty within the same step-off-to-stick identity.',
        '["step_off_direction","horizontal_travel","landing_location","box_height","stick_duration","stance","impact","rest","dose"]'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'moving-target-medicine-ball-chest-pass',
        'Moving Target Medicine Ball Chest Pass',
        'same_two_hand_chest_projection_with_moving_target_delivery_variant',
        'Both sources project a medicine ball forward from the chest with two hands. A moving partner changes target behavior, visual tracking, prediction, foot adjustment, accuracy constraint, partner logistics, return policy, and difficulty as a contextual delivery profile rather than a new pass action.',
        '["target_behavior","visual_tracking","prediction","foot_adjustment","accuracy_constraint","partner","return_policy","distance","ball_mass","rest","dose"]'::JSONB
      ),
      (
        'medicine-ball-front-squat',
        'medicine-ball-front-rack-breathing-squat',
        'Medicine Ball Front Rack Breathing Squat',
        'same_medicine_ball_front_squat_with_breathing_delivery_variant',
        'Both sources hold a medicine ball at the chest or front rack and perform controlled squats without a throw. Declared breathing into the brace changes tempo, pause, breath cadence, phase placement, load, range, and dose within the same medicine-ball front-squat identity.',
        '["breathing_cadence","tempo","pause","phase_context","ball_mass","range","load","rest","dose"]'::JSONB
      ),
      (
        'single-leg-balance-clock',
        'single-leg-balance-reach-clock-control',
        'Single-Leg Balance Reach Clock — Control Version',
        'same_single_leg_clock_target_reach_with_control_emphasis',
        'Both sources maintain single-leg support while the free limb reaches to declared clock targets without losing foot, knee, pelvic, or trunk control. Control emphasis changes reach distance, tempo, touch policy, support, target order, quality gate, side, and dose within the same identity.',
        '["reach_distance","tempo","touch_policy","support","target_order","quality_gate","stance_side","rest","dose"]'::JSONB
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
              'Re-run the canonical card audit after score-82 identity consolidation.',
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
