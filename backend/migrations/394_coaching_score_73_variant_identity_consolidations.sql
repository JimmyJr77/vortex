-- Consolidate mechanically supported duplicate and controlled-variant
-- identities in the score-73 canonical queue.
--
-- Source mappings, aliases, candidate evidence/media, and archived legacy
-- variants remain traceable. This migration creates no human approval.
-- Exercise cards use exercise complexity and physical difficulty only;
-- skill/proficiency levels remain exclusive to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '394_coaching_score_73_variant_identity_consolidations';
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
        'a-march',
        'a-march-linear',
        'A-March Linear',
        NULL::TEXT,
        'same_a_march_with_linear_travel_and_distance_variant',
        'Both sources repeat the same contralateral marching sprint-mechanics cycle with posture, front-side hip position, dorsiflexion, and opposite arm action. Linear delivery changes travel, distance, cadence, arm emphasis, repetitions, rest, and dose within the A-March identity.',
        '["travel","distance","cadence","arm_emphasis","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'approach-vertical-jump',
        'volleyball-approach-jump',
        'Volleyball Approach Jump',
        'Approach Jump',
        'same_approach_jump_with_sport_context_and_reach_target_variant',
        'Both sources use a multi-step approach, penultimate organization, arm swing, and vertical takeoff. Volleyball delivery changes sport context, approach pattern, reach target, arm action, landing rule, repetitions, rest, and dose within the approach-jump identity.',
        '["sport_context","approach_pattern","reach_target","arm_action","landing_rule","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'barbell-rollout',
        'medicine-ball-rollout',
        'Medicine Ball Rollout',
        'Rollout',
        'same_kneeling_or_declared_rollout_with_rolling_implement_variant',
        'Both sources extend a rolling implement away while maintaining rib-pelvis control and return only through owned shoulder and trunk range. Barbell versus medicine-ball delivery changes implement, hand spacing, rolling stability, range, load, tempo, repetitions, rest, and dose within the rollout identity.',
        '["implement","hand_spacing","rolling_stability","range","load","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'barbell-z-press',
        'dumbbell-z-press',
        'Dumbbell Z-Press',
        'Z Press',
        'same_floor_seated_vertical_press_with_implement_variant',
        'Both sources press from an unsupported floor-seated long-sit base while controlling the trunk and returning the load. Barbell versus dumbbell delivery changes implement, hand independence, load symmetry, grip, setup, load, repetitions, rest, and dose within the Z-Press identity.',
        '["implement","hand_independence","load_symmetry","grip","setup","load","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'bear-crawl-ladder',
        'hand-foot-in-out-bear-crawl-ladder',
        'Hand-Foot In-Out Bear Crawl Ladder',
        NULL::TEXT,
        'same_bear_crawl_ladder_with_hand_foot_contact_sequence_variant',
        'Both sources maintain a bear-crawl support shape while hands and feet progress through ladder spaces. The in-out label specifies an ordered contact pattern; contact sequence, lead side, direction, cadence, ladder spacing, repetitions, rest, and dose are controlled variants within the bear-crawl ladder identity.',
        '["contact_sequence","lead_side","direction","cadence","ladder_spacing","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'bent-knee-soleus-raise',
        'seated-soleus-raise',
        'Seated Soleus Raise',
        'Bent-Knee Soleus Raise',
        'same_bent_knee_plantar_flexion_raise_with_seated_base_variant',
        'Both sources perform controlled plantar flexion while the knee remains bent to bias the soleus. Seated delivery changes body support, knee angle, implement, load position, range, tempo, repetitions, rest, and dose within the bent-knee soleus-raise identity.',
        '["body_support","knee_angle","implement","load_position","range","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'dead-bug-iso-press',
        'medicine-ball-dead-bug-press',
        'Medicine-Ball Dead Bug Press',
        NULL::TEXT,
        'same_dead_bug_contralateral_press_with_implement_and_free_limb_variant',
        'Both sources use a supine tabletop base and contralateral hand-to-knee pressure while maintaining rib-pelvis control and breathing. Medicine-ball delivery changes implement, press interface, free-arm and free-leg path, lever length, range, hold, repetitions, rest, and side dosage within the dead-bug press identity.',
        '["implement","press_interface","free_arm_path","free_leg_path","lever_length","range","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'down-dog-to-plank-wave',
        'rocking-plank-to-down-dog',
        'Rocking Plank to Down Dog',
        'Plank to Down Dog',
        'same_plank_down_dog_cycle_with_direction_and_wave_cue_variant',
        'Both sources cycle between a tall plank and down-dog position while controlling shoulders, ribs, pelvis, and breath. Wave versus rock delivery changes start endpoint, movement direction, spinal sequencing cue, range, tempo, repetitions, rest, and dose within the plank-to-down-dog identity.',
        '["start_endpoint","movement_direction","spinal_sequence_cue","range","tempo","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'single-leg-balance-hold-tripod-foot',
        'eyes-closed-single-leg-balance',
        'Eyes-Closed Single-Leg Balance',
        NULL::TEXT,
        'same_single_leg_balance_hold_with_visual_condition_variant',
        'Both sources maintain upright one-leg support with controlled foot, knee, pelvis, trunk, and recovery. Eyes-closed delivery changes visual condition, available support, hold duration, surface, head position, repetitions, rest, and side dosage within the single-leg balance identity.',
        '["visual_condition","available_support","hold_duration","surface","head_position","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'front-plank',
        'front-plank-long-lever-plank',
        'Long-Lever Front Plank',
        NULL::TEXT,
        'same_front_plank_with_support_distance_and_lever_length_variant',
        'Both sources hold a prone braced line through fixed forearm or hand and foot support without required joint motion. Long-lever delivery changes support distance, lever length, hand or elbow position, hold duration, rest, and dose within the front-plank identity.',
        '["support_distance","lever_length","upper_support","hold_duration","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'front-squat',
        'goblet-squat-tempo-d6',
        'Tempo Goblet Squat 3-1',
        NULL::TEXT,
        'same_anterior_loaded_squat_with_goblet_hold_and_tempo_variant',
        'The canonical Front Squat already owns a bilateral anterior-loaded squat and goblet implement delivery. This source fixes a goblet hold and three-second eccentric with a one-second pause; implement, grip, load position, tempo, pause, repetitions, rest, and dose are controlled variants.',
        '["implement","grip","load_position","eccentric_duration","pause","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'hip-airplane-stick',
        'standing-hip-airplane-kick-prep',
        'Standing Hip Airplane Kick Prep',
        'Hip Airplane',
        'same_single_leg_hinge_pelvic_rotation_control_with_sport_context_variant',
        'Both sources hold a single-leg hip hinge while the pelvis rotates internally and externally over the stance hip without losing foot or trunk control. Kick-prep delivery changes sport context, free-leg cue, range, support, hold, repetitions, rest, and side dosage within the hip-airplane identity.',
        '["sport_context","free_leg_cue","range","support","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'landmine-row-with-hip-rotation',
        'landmine-handle-grip-rotational-row',
        'Landmine Handle-Grip Rotational Row',
        'Landmine Rotational Row',
        'same_landmine_row_with_hip_rotation_and_attachment_variant',
        'Both sources row the fixed landmine end while deliberately rotating through the hips and trunk on the declared return path. Handle-grip delivery changes attachment, grip, stance, hand count, range, load, repetitions, rest, and side dosage within the rotational landmine-row identity.',
        '["attachment","grip","stance","hand_count","range","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'nordic-hamstring-curl',
        'nordic-hamstring-iso-hold',
        'Nordic Hamstring Iso Hold',
        NULL::TEXT,
        'same_nordic_kneeling_ankle_anchored_pattern_with_isometric_variant',
        'Both sources use a kneeling ankle-anchored Nordic position while the athlete maintains hip extension and controls the body as one line. Isometric delivery changes contraction mode, hold angle, assistance, hold duration, return, rest, and dose within the Nordic hamstring identity.',
        '["contraction_mode","hold_angle","assistance","hold_duration","return_strategy","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'nordic-hamstring-eccentric',
        'partner-assisted-nordic-hamstring-negative',
        'Partner-Assisted Nordic Hamstring Negative',
        NULL::TEXT,
        'same_nordic_eccentric_with_partner_anchor_and_assistance_variant',
        'Both sources use a kneeling Nordic lowering pattern with the ankles anchored and the body controlled as one line. Partner-assisted negative delivery changes anchor, assistance, range, lowering duration, return strategy, repetitions, rest, and dose within the Nordic hamstring identity.',
        '["anchor","assistance","range","lowering_duration","return_strategy","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'single-leg-pogo',
        'single-leg-in-out-hops',
        'Single-Leg In-Out Hops',
        NULL::TEXT,
        'same_single_leg_repeated_pogo_with_medial_lateral_line_pattern_variant',
        'Both sources repeat low-amplitude ankle-dominant contacts on one declared leg without an intentional stick between repetitions. In-out delivery changes line orientation, medial-lateral direction, foot-placement targets, cadence, contact count, finish, rest, and side dosage within the single-leg pogo identity.',
        '["line_orientation","direction","foot_placement_targets","cadence","contact_count","finish","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'squat-jump',
        'squat-jump-to-stick',
        'Squat Jump to Stick',
        NULL::TEXT,
        'same_static_squat_jump_with_terminal_landing_hold_variant',
        'Both sources begin from a stable squat position, project vertically without a required approach, and return to the floor. Stick delivery changes landing hold, landing depth, arm action, reset, repetitions, rest, and dose within the squat-jump identity.',
        '["landing_hold","landing_depth","arm_action","reset","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'drop-landing-to-stick',
        'single-leg-depth-drop-to-stick',
        'Single-Leg Depth Drop to Stick',
        NULL::TEXT,
        'same_elevated_drop_landing_with_unilateral_landing_variant',
        'Both sources begin elevated, remove active concentric takeoff, absorb the floor contact, and hold an owned landing. Single-leg delivery changes takeoff support, landing stance, laterality, drop height, hold, repetitions, rest, and side dosage within the drop-landing identity.',
        '["takeoff_support","landing_stance","laterality","drop_height","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'split-stance-wall-ball-power-throw',
        'Split-Stance Wall Ball Power Throw',
        NULL::TEXT,
        'same_two_hand_rotational_wall_throw_with_split_stance_variant',
        'Both sources sequence whole-body rotation to project a retained medicine ball into a wall target and use the declared retrieval or rebound return. Split-stance delivery changes base, lead leg, dip, target height, catch policy, load, repetitions, rest, and side dosage within the rotational-throw identity.',
        '["base","lead_leg","dip","target_height","catch_policy","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'landmine-press',
        'landmine-anti-rotation-press',
        'Landmine Anti-Rotation Press',
        NULL::TEXT,
        'same_angled_landmine_press_with_anti_rotation_stance_constraint_variant',
        'Both sources press the fixed landmine end through an angled path while maintaining a controlled trunk and returning the bar. Anti-rotation delivery changes stance, hand count, load symmetry, trunk constraint, range, load, repetitions, rest, and side dosage within the landmine-press identity.',
        '["stance","hand_count","load_symmetry","trunk_constraint","range","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'medicine-ball-catch-to-decel-stick',
        'medicine-ball-chest-pass-catch-and-stick',
        'Medicine Ball Chest Pass Catch-and-Stick',
        NULL::TEXT,
        'same_incoming_ball_catch_and_deceleration_with_chest_trajectory_variant',
        'Both sources receive an incoming medicine ball, absorb its momentum while controlling the trunk and lower body, and finish in an owned stop. Chest-pass delivery changes incoming trajectory, partner distance, ball mass, stance, hold, repetitions, rest, and dose within the catch-to-deceleration identity.',
        '["incoming_trajectory","partner_distance","ball_mass","stance","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'hip-airplane-stick',
        'hip-airplane-supported',
        'Supported Hip Airplane',
        'Hip Airplane',
        'same_single_leg_hinge_pelvic_rotation_with_external_support_variant',
        'Both sources hold a single-leg hinge and rotate the pelvis open and closed over the stance hip while preserving foot, knee, and trunk control. Supported delivery changes external support, balance demand, range, tempo, repetitions, rest, and side dosage within the hip-airplane identity.',
        '["external_support","balance_demand","range","tempo","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'hip-airplane-stick',
        'hip-airplane-iso-hold',
        'Hip Airplane Iso Hold',
        'Hip Airplane',
        'same_single_leg_hinge_pelvic_control_with_isometric_hold_variant',
        'Both sources use the same single-leg hinge and owned pelvic-rotation position while preserving foot, knee, pelvis, and trunk control. Isometric delivery changes contraction mode, hold angle, support, hold duration, repetitions, rest, and side dosage within the hip-airplane identity.',
        '["contraction_mode","hold_angle","external_support","hold_duration","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'drop-landing-to-stick',
        'depth-drop-to-athletic-stick',
        'Depth Drop to Athletic Stick',
        NULL::TEXT,
        'same_elevated_drop_to_floor_landing_and_terminal_stick',
        'Both sources begin on an elevated surface, remove an active concentric takeoff, absorb the floor contact quietly, hold an owned landing, and reset. Depth or box label changes drop height, landing stance, hold, repetitions, rest, and dose within the drop-landing identity.',
        '["drop_height","landing_stance","hold_duration","repetitions","rest","dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'landmine-press',
        'half-kneeling-landmine-anti-rotation-press',
        'Half-Kneeling Landmine Anti-Rotation Press',
        NULL::TEXT,
        'same_angled_landmine_press_with_half_kneeling_anti_rotation_variant',
        'Both sources press the fixed landmine end through an angled path while maintaining a controlled trunk and returning the bar. Half-kneeling anti-rotation delivery changes base, lead leg, hand count, load symmetry, trunk constraint, load, repetitions, rest, and side dosage within the landmine-press identity.',
        '["base","lead_leg","hand_count","load_symmetry","trunk_constraint","load","repetitions","rest","side_dose"]'::JSONB,
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'single-leg-balance-hold-tripod-foot',
        'single-leg-balance-clock',
        'Single-Leg Balance Reach Clock',
        NULL::TEXT,
        'same_single_leg_balance_with_free_foot_reach_target_variant',
        'Both sources maintain one-leg support while preserving stance-foot, knee, pelvis, trunk, and recovery control. Clock delivery changes free-foot reach direction, target sequence, tap policy, range, support, repetitions, rest, and side dosage within the single-leg balance identity.',
        '["free_foot_reach_direction","target_sequence","tap_policy","range","external_support","repetitions","rest","side_dose"]'::JSONB,
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
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
        FROM coaching.exercise_section_evidence_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND source_peer.section_key = candidate.section_key
          AND source_peer.source_url = candidate.source_url
          AND source_peer.id::TEXT < candidate.id::TEXT
      )
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
        FROM coaching.exercise_alternate_assessment_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND lower(source_peer.alternate_name) =
            lower(candidate.alternate_name)
          AND source_peer.id::TEXT < candidate.id::TEXT
      )
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
        FROM coaching.exercise_media_candidate_v1 source_peer
        WHERE source_peer.definition_id = duplicate_id
          AND source_peer.review_status IN ('candidate', 'superseded')
          AND source_peer.id::TEXT < candidate.id::TEXT
          AND (
            source_peer.video_id = candidate.video_id
            OR source_peer.url = candidate.url
          )
      )
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
              'Re-run the canonical card audit after score-73 identity consolidation.',
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
