-- Consolidate the mechanically supported duplicate/variant identities in the
-- score-79 canonical queue.
--
-- Stable survivors retain source traceability, aliases, candidate evidence,
-- candidate media, and archived legacy variants. Implement, grip, stance,
-- support, direction, tempo, range, and dosage remain exact variant
-- dimensions. This migration creates no human approval.
--
-- Exercise cards use exercise complexity and physical difficulty only. Athlete
-- skill/proficiency levels remain exclusive to skill-library cards.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '382_coaching_score_79_variant_identity_consolidations';
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
        'cable-or-band-ninety-ninety-external-rotation',
        'band-ninety-ninety-external-rotation-activation',
        'Band 90/90 External Rotation Activation',
        NULL::TEXT,
        'same_ninety_ninety_external_rotation_with_implement_and_dose_variant',
        'Both sources hold the upper arm near 90 degrees of abduction and externally rotate the shoulder against cable or elastic resistance. Implement, anchor, resistance, range, tempo, intent, fatigue cap, and dose remain exact variants.',
        '["implement","anchor_position","resistance","range","tempo","intent","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/41559205/"]'::JSONB
      ),
      (
        'box-squat',
        'barbell-box-squat',
        'Barbell Box Squat',
        NULL::TEXT,
        'same_squat_to_declared_box_with_barbell_load_variant',
        'Both sources sit back to a declared box height, maintain brace and alignment, make controlled contact, and stand. Barbell versus dumbbell, kettlebell, or bodyweight loading changes implement, load position, stance, box height, pause, spotting, and dose within the box-squat identity.',
        '["implement","load_position","stance","box_height","contact_policy","pause_duration","spotting","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22505136/"]'::JSONB
      ),
      (
        'bent-over-barbell-row',
        'double-kettlebell-bent-over-row',
        'Double Kettlebell Bent-Over Row',
        'Bent-Over Row',
        'same_unsupported_standing_hinge_row_with_implement_variant',
        'Both sources maintain an unsupported standing hip hinge while pulling external resistance toward the trunk and lowering it under control. Barbell versus independent kettlebells changes implement, grip, path freedom, independent-arm demand, hinge angle, range, load, and dose within the bent-over-row identity.',
        '["implement","implement_quantity","grip","path_constraint","independent_arm_demand","hinge_angle","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'bent-over-barbell-row',
        'sandbag-bent-over-row-strength',
        'Sandbag Bent-Over Row',
        'Bent-Over Row',
        'same_unsupported_standing_hinge_row_with_sandbag_implement_variant',
        'Both sources maintain an unsupported standing hip hinge while pulling external resistance toward the trunk and lowering it under control. A sandbag changes implement shape, grip, pickup and set-down, load distribution, hinge angle, range, load, and dose within the bent-over-row identity.',
        '["implement","implement_shape","grip","pickup_method","setdown_method","load_distribution","hinge_angle","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'isometric-pull-up-hold',
        'chin-up-isometric-hold',
        'Chin-Up Isometric Hold',
        'Pull-Up / Chin-Up Isometric Hold',
        'same_vertical_pull_isometric_with_grip_and_joint_angle_variant',
        'Both sources suspend the body from a fixed overhead implement and hold a declared vertical-pull position without visible movement. Supinated chin-up versus pronated pull-up grip changes arm contribution, grip, hold angle, assistance, external load, duration, effort, and dose within the same isometric identity.',
        '["grip","grip_width","hold_angle","assistance","external_load","hold_duration","effort","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/21068680/","https://pubmed.ncbi.nlm.nih.gov/28011412/"]'::JSONB
      ),
      (
        'copenhagen-side-plank',
        'copenhagen-plank-short-lever',
        'Copenhagen Plank — Short Lever',
        NULL::TEXT,
        'same_copenhagen_adduction_hold_with_short_lever_variant',
        'Both sources use a side-plank base with the top leg supported on a bench or box and the hips lifted to train adduction and lateral-trunk control. Knee or thigh support shortens the lever; ankle support lengthens it. Lever, support point, bottom-leg action, hold duration, load, and dose remain exact variants.',
        '["lever_length","top_leg_support_point","bottom_leg_action","bench_height","hold_duration","external_load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/40827942/"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'kettlebell-alternating-floor-press',
        'Kettlebell Alternating Floor Press',
        NULL::TEXT,
        'same_supine_floor_press_with_alternating_kettlebell_variant',
        'Both sources press external resistance from a supine floor-supported position and use floor contact to bound shoulder extension. Alternating versus simultaneous arms and kettlebell versus dumbbell loading change implement, arm pattern, grip, independent-arm demand, pause, load, tempo, and dose within the floor-press identity.',
        '["implement","arm_pattern","grip","independent_arm_demand","floor_pause","range","load","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'leg-swings-lateral',
        'dynamic-leg-swing-lateral',
        'Dynamic Leg Swing Lateral',
        NULL::TEXT,
        'same_supported_lateral_leg_swing',
        'Both sources use light external support while one leg swings across the body and back out to the side with the stance foot grounded and trunk controlled. Support, swing amplitude, cadence, range, side order, breathing, and dose remain exact variants.',
        '["support","swing_amplitude","cadence","range","side_order","breathing","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'icky-shuffle',
        'reverse-icky-shuffle',
        'Reverse Icky Shuffle',
        NULL::TEXT,
        'same_icky_ladder_contact_pattern_with_reverse_travel_variant',
        'Both sources use the Icky inside-outside ladder contact sequence and coordinated weight shift. Reverse travel changes facing, visual demand, lead side, entry, cadence, spacing, and error state while preserving the footwork identity.',
        '["travel_direction","facing","lead_side","entry","cadence","spacing","error_state","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/24290613/"]'::JSONB
      ),
      (
        'plyo-push-up',
        'incline-plyo-push-up',
        'Incline Plyo Push-Up',
        NULL::TEXT,
        'same_explosive_push_up_with_elevated_hand_support_variant',
        'Both sources rapidly press the body away from the support so the hands unload or leave it, then receive the next contact. Elevating the hands changes support height, relative load, flight demand, landing force, range, progression position, and dose within the plyometric push-up identity.',
        '["support_height","relative_load","flight_requirement","landing_target","range","hand_width","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/"]'::JSONB
      ),
      (
        'lateral-lunge',
        'lateral-lunge-negative',
        'Lateral Lunge Negative',
        NULL::TEXT,
        'same_lateral_lunge_with_eccentric_emphasis_variant',
        'Both sources step or shift laterally, load one hip and knee while the other leg lengthens, and return under control. A slow negative changes eccentric duration, return assistance, range, stance width, external load, fatigue, rest, and dose within the lateral-lunge identity.',
        '["contraction_emphasis","eccentric_duration","return_assistance","range","stance_width","implement","load","fatigue_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/","https://pubmed.ncbi.nlm.nih.gov/42401924/"]'::JSONB
      ),
      (
        'low-box-step-off-to-stick',
        'low-box-drop-to-stick',
        'Low Box Drop to Stick',
        NULL::TEXT,
        'same_low_box_step_off_to_terminal_floor_stick',
        'Both sources begin on a low box, remove the first takeoff by stepping or dropping off, receive the floor, and hold the landing before reset. Step leg, box height, landing direction, stance, hold duration, arm policy, rest, and dose remain exact variants.',
        '["step_leg","box_height","landing_direction","landing_stance","hold_duration","arm_policy","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'med-ball-rebound-rotational-catch-and-throw',
        'Med Ball Rebound Rotational Catch-and-Throw',
        NULL::TEXT,
        'same_two_hand_rotational_wall_throw_with_rebound_catch_variant',
        'Both sources project a medicine ball with two hands from a standing rotational base. The rebound card uses the already declared catch-and-rethrow delivery variant. Return contract, catch stance, reset policy, wall distance, ball, target, rest, and dose remain exact variants.',
        '["return_contract","catch_stance","reset_policy","wall_distance","ball_mass","target","rotation_direction","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-rotational-scoop-toss',
        'Medicine Ball Rotational Scoop Toss',
        NULL::TEXT,
        'same_two_hand_rotational_throw_with_scoop_release_variant',
        'Both sources use a standing athletic base, load the outside hip, rotate from the ground up, and project a medicine ball with two hands. A scoop release changes start height, arm path, release angle, stance, pivot, ball, target, and dose within the rotational-throw identity.',
        '["release_style","start_height","arm_path","release_angle","stance","pivot_policy","ball_mass","target","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-shot-put-throw',
        'medicine-ball-rotational-shot-put',
        'Medicine Ball Rotational Shot Put',
        NULL::TEXT,
        'same_single_arm_shot_put_throw_with_rotational_entry_variant',
        'Both sources project the medicine ball from one hand using an asymmetrical shot-put-style press and front-side brace. A rotational entry changes stance, pivot, hip-shoulder separation, approach, release angle, target, load, and dose within the shot-put-throw identity.',
        '["entry_style","stance","pivot_policy","hip_shoulder_separation","approach","release_angle","target","ball_mass","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/31368410/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-shot-put-throw',
        'partner-medicine-ball-shot-put-pass',
        'Partner Medicine Ball Shot-Put Pass',
        NULL::TEXT,
        'same_single_arm_shot_put_projection_with_partner_pass_variant',
        'Both sources use one-arm shot-put-style projection with an asymmetrical stance and front-side brace. A partner pass changes receiver, distance, target, return contract, side alternation, ball, intensity, and dose within the shot-put-throw identity.',
        '["receiver","distance","target","return_contract","side_alternation","stance","ball_mass","intent","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-shot-put-throw',
        'split-stance-medicine-ball-shot-put-pass',
        'Split-Stance Medicine Ball Shot-Put Pass',
        NULL::TEXT,
        'same_single_arm_shot_put_projection_with_split_stance_variant',
        'Both sources use one-arm shot-put-style projection and front-side bracing. The split-stance source explicitly fixes the base; stance, lead leg, receiver, distance, return contract, ball, intensity, and dose remain exact variants.',
        '["stance","lead_leg","receiver","distance","return_contract","ball_mass","intent","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'push-up-prone-start-sprint',
        'push-up-start-10m',
        'Push-Up Start 10m',
        NULL::TEXT,
        'same_prone_push_up_start_to_short_acceleration_with_distance_variant',
        'Both sources begin prone or at the bottom of a push-up, rise on a cue, recover one foot beneath the body, and accelerate through a short lane. Distance, cue, lead leg, push-up position, intent, timing, rest, and dose remain exact variants.',
        '["distance","distance_unit","start_cue","lead_leg","push_up_position","intent","measurement","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'zercher-carry',
        'sandbag-zercher-carry-strength',
        'Sandbag Zercher Carry',
        NULL::TEXT,
        'same_elbow_crook_loaded_carry_with_sandbag_variant',
        'Both sources support external load in the elbow creases and walk while maintaining trunk, breathing, and gait control. A sandbag changes implement shape, pickup, set-down, load distribution, grip assistance, distance, load, and dose within the Zercher-carry identity.',
        '["implement","pickup_method","setdown_method","load_distribution","grip_assistance","distance","load","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-hop-to-stick-low-amplitude',
        'Single-Leg Hop to Stick — Low Amplitude',
        NULL::TEXT,
        'same_single_leg_hop_to_terminal_stick_with_low_amplitude_variant',
        'Both sources project from one declared leg, land on the declared leg, absorb, and hold before a full reset. Low amplitude changes direction, distance or height, target, hold, arm policy, impact cap, rest, and dose within the single-leg hop-to-stick identity.',
        '["direction","amplitude","distance_or_height","target","hold_duration","arm_policy","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-rdl-reach-bodyweight-control',
        'Single-Leg RDL Reach — Bodyweight Control',
        NULL::TEXT,
        'same_single_leg_hip_hinge_with_bodyweight_reach_variant',
        'Both sources balance on one leg, hinge through the support hip while the free leg reaches back, and return from a controlled range. Bodyweight reach changes implement, hand target, reach direction, balance support, range, tempo, rest, and dose within the single-leg Romanian-deadlift identity.',
        '["implement","hand_target","reach_direction","balance_support","range","tempo","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'snap-down-to-rebound',
        'snap-down-to-low-vertical-rebound',
        'Snap-Down to Low Vertical Rebound',
        NULL::TEXT,
        'same_snap_down_to_immediate_rebound_with_low_vertical_variant',
        'Both sources rapidly descend into a landing shape and immediately reverse into a rebound. Low vertical projection changes rebound direction, amplitude, contact target, arm policy, landing or reset, impact cap, rest, and dose within the snap-down-to-rebound identity.',
        '["rebound_direction","amplitude","contact_target","arm_policy","landing_or_reset","impact_cap","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/20072070/"]'::JSONB
      ),
      (
        'step-up-jump',
        'sprinter-step-up-jump',
        'Sprinter Step-Up Jump',
        NULL::TEXT,
        'same_step_up_jump_with_sprint_arm_and_free_knee_action_variant',
        'Both sources drive through one foot on a box, project into a jump, land under control, and reset. A sprinter action changes free-knee drive, arm action, torso angle, box height, load, landing, rest, and dose within the step-up-jump identity.',
        '["free_knee_action","arm_action","torso_angle","box_height","implement","load","landing","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38886980/"]'::JSONB
      ),
      (
        'three-point-start-acceleration',
        'three-point-acceleration-build-up',
        'Three-Point Acceleration Build-Up',
        NULL::TEXT,
        'same_three_point_start_acceleration_with_build_up_intent_variant',
        'Both sources begin from a still staggered three-point stance and accelerate while rising progressively. Build-up intent changes distance, intensity progression, transition target, timing, lead side, rest, and dose within the three-point-start identity.',
        '["distance","distance_unit","intensity_progression","transition_target","measurement","lead_side","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'wall-drill-march',
        'wall-drill-iso-lean-march',
        'Wall Drill Iso Lean March',
        NULL::TEXT,
        'same_wall_lean_alternating_sprint_march',
        'Both sources establish a rigid wall-supported lean and alternate knee drive with opposite-leg extension while preserving sprint posture. Lean angle, wall distance, exchange cadence, pause, ankle position, side order, rest, and dose remain exact variants.',
        '["lean_angle","wall_distance","exchange_cadence","pause_duration","ankle_position","side_order","rest","dose"]'::JSONB,
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      retained_alias,
      survivor_display_name,
      identity_match,
      rationale,
      variant_dimensions,
      research_sources
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
        'researchSources', pair.research_sources,
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
          'researchSources', pair.research_sources,
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
    SET canonical_name = COALESCE(
          pair.survivor_display_name,
          survivor.canonical_name
        ),
        display_name = COALESCE(
          pair.survivor_display_name,
          survivor.display_name
        ),
        aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            COALESCE(survivor.aliases, '{}')
            || COALESCE(duplicate.aliases, '{}')
            || ARRAY[
              survivor.canonical_name,
              survivor.display_name,
              duplicate.canonical_name,
              duplicate.display_name,
              pair.retained_alias
            ]
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(alias) NOT IN (
              lower(
                COALESCE(
                  pair.survivor_display_name,
                  survivor.canonical_name
                )
              ),
              lower(
                COALESCE(
                  pair.survivor_display_name,
                  survivor.display_name
                )
              )
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
          'researchSources', pair.research_sources,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'stableDisplayName',
            COALESCE(
              pair.survivor_display_name,
              survivor.display_name
            ),
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
              'Re-run the canonical card audit after score-79 identity consolidation.',
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
          'researchSources', pair.research_sources,
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
