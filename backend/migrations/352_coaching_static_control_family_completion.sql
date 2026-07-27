-- Complete three consolidated candidate families:
--   * Quadruped Thread-the-Needle
--   * Single-Leg Tripod Balance Hold
--   * Split Squat Isometric Hold
--
-- Exact selectable variants, contextual dosage, loading, fatigue, anatomy,
-- constraints, user and coach support, evidence, media candidates,
-- alternates, graph proposals, calibration proposals, and audit quarantine
-- are supplied. No skill/proficiency level belongs to an exercise card.
-- Overall exercise difficulty is max(complexity, physical difficulty).
--
-- All review artifacts remain candidate/review only. Healthy YouTube oEmbed
-- metadata is not full-video viewing or approval. No publication, media,
-- graph, or calibration approval is created. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '352_coaching_static_control_family_completion';
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN (
        'quadruped-thread-the-needle',
        'single-leg-balance-hold-tripod-foot',
        'split-squat-isometric-hold'
      )
      AND status <> 'archived'
  ) <> 3 THEN
    RAISE EXCEPTION
      '% requires all three active survivor definitions',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE survivor.slug || ':' || duplicate.slug IN (
      'quadruped-thread-the-needle:quadruped-thread-the-needle-rotation',
      'single-leg-balance-hold-tripod-foot:single-leg-tripod-balance',
      'split-squat-isometric-hold:split-squat-iso-hold'
    )
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 3 THEN
    RAISE EXCEPTION
      '% requires all three direct identity consolidations',
      migration_key;
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE facility_id = 1
        AND slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
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
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = evidence.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
        AND evidence.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = media.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
        AND media.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = alternate.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
        AND alternate.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = revision.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'quadruped-thread-the-needle',
          'single-leg-balance-hold-tripod-foot',
          'split-squat-isometric-hold'
        )
        AND variant.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT variant.id
          FROM coaching.exercise_variant_v1 variant
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id = variant.definition_id
          WHERE definition.facility_id = 1
            AND definition.slug IN (
              'quadruped-thread-the-needle',
              'single-leg-balance-hold-tripod-foot',
              'split-squat-isometric-hold'
            )
        )
        OR relationship.to_variant_id IN (
          SELECT variant.id
          FROM coaching.exercise_variant_v1 variant
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id = variant.definition_id
          WHERE definition.facility_id = 1
            AND definition.slug IN (
              'quadruped-thread-the-needle',
              'single-leg-balance-hold-tripod-foot',
              'split-squat-isometric-hold'
            )
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
        SELECT variant.id
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_definition_v1 definition
          ON definition.id = variant.definition_id
        WHERE definition.facility_id = 1
          AND definition.slug IN (
            'quadruped-thread-the-needle',
            'single-leg-balance-hold-tripod-foot',
            'split-squat-isometric-hold'
          )
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
      '% refused to overwrite % protected record(s)',
      migration_key,
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'quadruped-thread-the-needle',
      'single-leg-balance-hold-tripod-foot',
      'split-squat-isometric-hold'
    )
    AND variant.status <> 'archived'
    AND (
      (
        definition.slug = 'quadruped-thread-the-needle'
        AND variant.variant_key NOT IN (
          'baseline',
          'baseline-source-1458',
          'quadruped-thread-and-open',
          'heel-sit-thread-and-open'
        )
      )
      OR (
        definition.slug = 'single-leg-balance-hold-tripod-foot'
        AND variant.variant_key NOT IN (
          'baseline',
          'baseline-source-847',
          'supported-eyes-open',
          'unsupported-eyes-open',
          'unsupported-eyes-closed'
        )
      )
      OR (
        definition.slug = 'split-squat-isometric-hold'
        AND variant.variant_key NOT IN (
          'baseline',
          'supported-bodyweight-mid-range',
          'unsupported-bodyweight-mid-range',
          'goblet-loaded-mid-range'
        )
      )
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;
END;
$$;

CREATE TEMP TABLE static_card_seed (
  slug TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  description TEXT NOT NULL,
  family_key TEXT NOT NULL,
  content_confidence SMALLINT NOT NULL,
  scoring_confidence SMALLINT NOT NULL,
  media_confidence SMALLINT NOT NULL,
  movement_patterns TEXT[] NOT NULL,
  body_regions TEXT[] NOT NULL,
  required_equipment TEXT[] NOT NULL,
  optional_equipment TEXT[] NOT NULL,
  environment_json JSONB NOT NULL,
  population_json JSONB NOT NULL,
  anatomy_json JSONB NOT NULL,
  athlete_support_json JSONB NOT NULL,
  coach_support_json JSONB NOT NULL,
  support_operations_json JSONB NOT NULL,
  evidence_claims JSONB NOT NULL,
  primary_source JSONB NOT NULL,
  secondary_source JSONB NOT NULL
);

INSERT INTO static_card_seed VALUES
  (
    'quadruped-thread-the-needle',
    'Quadruped Thread-the-Needle',
    'From an exact hands-and-knees or declared heel-sit quadruped base, keep the support arm active and pelvis controlled, reach the moving arm palm-up beneath the torso through pain-free range, then reverse and rotate it open as the eyes follow the hand. Exhale through the owned range, return without momentum, and stop before shoulder support, pelvic control, breathing, or symptom-free motion changes.',
    'quadruped_thread_and_open_rotation',
    88, 78, 35,
    ARRAY['rotate','brace']::TEXT[],
    ARRAY['spine','rib_cage','shoulder','wrist','core']::TEXT[],
    '{}'::TEXT[],
    ARRAY['mat']::TEXT[],
    '{
      "surface":{"required":"stable_nonslip","avoid":["wet","loose","uneven"]},
      "space":{"clearReachRadiusMeters":1.25,"overheadClearanceRequired":true,"trafficControlled":true},
      "support":{"wristAndKneeContactComfortRequired":true,"optionalKneePadding":true},
      "setup":{"handsUnderShoulders":true,"kneesUnderOrBehindHipsByVariant":true,"movingSideAndRangeDeclared":true},
      "sharedStation":{"athletesPerStation":1,"offsetFromWalkingAndThrowingLanes":true}
    }'::JSONB,
    '{
      "prerequisites":["pain_free_quadruped_support","safe_floor_transfer","pain_free_cross_body_reach","controlled_breathing"],
      "useCaution":["current_wrist_elbow_shoulder_neck_back_or_knee_symptoms","recent_upper_extremity_or_spinal_procedure","dizziness_with_head_turning"],
      "doNotUseWhen":["acute_or_increasing_pain","neurologic_or_dizziness_symptoms","unsafe_floor_or_clearance","cannot_support_bodyweight_through_contact_arm"],
      "regressionOrder":["shorter_pain_free_range","standard_quadruped_instead_of_heel_sit","forearm_or_elevated_support_requires_new_variant_review","side_lying_open_book_substitution"],
      "medicalScope":"The card does not diagnose, treat, or clear symptoms; follow the athlete care plan and local scope."
    }'::JSONB,
    '{
      "primaryMuscles":["thoracic_multifidus","thoracic_rotatores","internal_oblique","external_oblique"],
      "secondaryMuscles":["serratus_anterior","rhomboids","middle_trapezius","posterior_deltoid"],
      "stabilizers":["rotator_cuff","triceps_brachii","rectus_abdominis","gluteus_medius"],
      "joints":["thoracic_spine","scapulothoracic","glenohumeral","elbow","wrist","hip","lumbar_spine"],
      "jointActions":["thoracic_axial_rotation","moving_shoulder_horizontal_adduction_then_abduction","scapular_protraction_then_retraction","support_shoulder_stabilization","lumbar_and_pelvic_rotation_control"],
      "planes":["transverse","sagittal_support","multiplanar"],
      "laterality":"unilateral_alternating",
      "kineticChain":"closed_chain_support_arm_with_open_chain_moving_arm",
      "biomechanics":{"definingAction":"reach_under_then_reverse_to_open_rotation","desiredMotion":"owned_thoracic_and_rib_cage_rotation","controlledRegions":["lumbar_spine","pelvis","support_scapula"],"difficultyLevers":["heel_sit_constraint","available_range","end_range_pause","support_tolerance","tempo"]},
      "evidenceLimit":"Quadruped thoracic rotation is described in the literature, but direct outcome evidence for this exact exercise and exact variants is limited."
    }'::JSONB,
    '{
      "whyItMatters":"Practices usable upper-back and rib-cage rotation while the pelvis and support shoulder stay organized.",
      "primaryCue":"Thread under, then open to the ceiling; keep the belt line quiet.",
      "expectedSensations":["gentle_mid_back_rotation","posterior_shoulder_stretch","support_arm_effort","calm_breathing"],
      "unexpectedSensations":["sharp_or_increasing_pain","shoulder_pinching","numbness_or_tingling","dizziness","low_back_pinching"],
      "painGuidance":"Stop for unexpected symptoms, return to a comfortable base, and tell the coach.",
      "selfChecks":["support_hand_stays_planted","support_shoulder_does_not_collapse","hips_do_not_shift_or_spin","range_is_pain_free","eyes_follow_without_neck_strain","last_rep_matches_first"],
      "accessibility":["knee_padding","shorter_range","slower_repetition","fewer_repetitions","standard_quadruped_base","side_lying_rotation_substitution"],
      "mediaAlternatives":["step_by_step_text","top_and_side_still_sequence","coach_demonstration","verbal_clock_direction"],
      "beforeYouStart":["clear_reach_space","confirm_floor_and_contacts","declare_side_base_range_and_repetitions"],
      "afterSetCheck":["record_range_symmetry","record_compensation_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["floor_and_clearance","wrist_and_knee_tolerance","support_scapula","pelvic_shift_or_rotation","thoracic_and_rib_cage_motion","neck_position","breathing","side_to_side_difference"],
      "faultCorrections":{"pelvis_rotates":["reduce_range","slow_reversal","use_standard_quadruped"],"support_shoulder_collapses":["stop","reset_active_support","use_elevated_or_side_lying_substitution"],"low_back_dominates":["reduce_range","exhale","try_heel_sit_only_if_comfortable"],"neck_strains":["keep_gaze_closer","reduce_open_range"],"momentum":["pause_at_reversal","lower_repetition_count"]},
      "demonstrationPlan":["show_exact_base","show_palm_up_thread","show_controlled_reversal_and_open","contrast_pelvic_spin_and_support_collapse","show_safe_finish"],
      "groupManagement":["one_athlete_per_clear_reach_space","alternate_sides_by_declared_count","do_not_place_beside_active_landing_or_throwing_lanes"],
      "modificationDecisionTree":{"wrist_or_support_intolerance":"side_lying_open_book_review_only_substitution","pelvis_moves_before_thorax":"shorten_range_or_standard_base","clean_symmetric_range":"add_pause_before_more_range","symptoms":"stop_and_escalate"},
      "recordingFields":["variant_key","side","range_marker","repetitions","tempo","breathing","quality_result","symptoms","stop_reason","cue_response"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","range_or_dose","support_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
      "supportEscalation":{"urgent":["fall_or_injury_event","neurologic_symptom"],"coachReview":["persistent_asymmetry","support_collapse","unclear_variant"],"contentReview":["conflicting_instruction","media_mismatch","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact variant, side, dose, range marker, quality result, symptoms, stop reason, evidence, media metadata, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"Changes to the defining action, support base, range contract, dose, stop rules, difficulty, media, or graph require a new card version and renewed affected reviews.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_variant_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"Do not chase range by rotating the pelvis, collapsing the support shoulder, or forcing symptoms."
    }'::JSONB,
    '{
      "identity":["The defining action is a quadruped reach under the torso followed by a controlled reversal into open rotation; the added word rotation is not a second identity.","Hand position, range, heel-sit bias, pause, side, repetitions, and context are variant or delivery dimensions."],
      "taxonomy":["The card declares support base, moving side, reach-under and open action, range, tempo, repetitions, and pelvic-control standard.","Side-lying rotation, static quadruped, and hand-behind-head rotation without a thread-under action remain different definitions or require separate review."],
      "anatomy":["Thoracic rotation involves coordinated spinal, rib-cage, scapular, shoulder, and trunk musculature while the support arm stabilizes.","Muscle roles are described without claiming isolation or exact activation magnitude."],
      "biomechanics":["The moving arm reaches under then reverses to open while the support arm and pelvis constrain compensation.","Heel-sit positioning can constrain lumbar and pelvic contribution, but individual range and comfort govern selection."],
      "difficulty":["Complexity rises with a constrained heel-sit base, greater owned range, a longer pause, and reduced reliance on pelvic motion.","Exercise difficulty uses complexity and physical demand only; overall is their maximum."],
      "load_fatigue_recovery":["External loading is bodyweight support through one hand, both knees, and the opposite lower limb contacts.","Track support-shoulder, wrist, trunk, and positional fatigue plus loss of range or control."],
      "constraints":["Use a stable nonslip surface, comfortable knee and wrist contacts, clear reach space, and a controllable floor transfer.","Do not use through pain, neurologic symptoms, dizziness, or unsafe support."],
      "dosage":["Use slow quality repetitions per side with controlled breathing and a reset rather than fatigue-seeking volume.","Stop before range shrinks, compensation rises, support collapses, or symptoms appear."],
      "instructions":["Set the exact quadruped base, declare the moving side, thread palm-up, reverse without momentum, open through owned range, and return.","Instruction includes breath, range, repetitions, quality gate, and finish."],
      "safety_stop_rules":["Stop for pain, numbness, tingling, dizziness, wrist or shoulder intolerance, support collapse, pelvic spin, forced range, or unsafe floor conditions.","A symptom-free smaller range is preferable to forcing an endpoint."],
      "programming":["Use before rotation-dependent work or as low-fatigue mobility only when it improves or preserves movement quality.","It is not automatically required for every athlete or session."],
      "athlete_support":["Athlete support names expected and unexpected sensations, self-checks, accessibility choices, and nonvideo guidance.","The athlete reports symptoms and side-to-side differences rather than forcing symmetry."],
      "coach_support":["The coach verifies the exact action and observes support, pelvis, thorax, breathing, range, and symmetry.","Record the variant, side, dose, range, compensation, symptoms, and stop reason."],
      "accessibility":["Padding, shorter range, fewer repetitions, slower motion, standard quadruped, and side-lying substitution can reduce access barriers.","Any different support configuration requires exact variant review."],
      "alternates":["Heel-sit support preserves the thread-and-open identity as a variant; shortened range is a modifier.","Open-book rotation and quadruped hand-behind-head rotation change setup or defining action and remain separate."],
      "media":["Four YouTube links have healthy current oEmbed metadata and privacy-enhanced embed URLs.","Full-video exact matching, cue and safety quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://www.acefitness.org/resources/pros/expert-articles/7960/thoracic-mobility-exercises-to-address-shoulder-pain/","title":"Thoracic Mobility Exercises to Address Shoulder Pain","publisher":"American Council on Exercise","kind":"professional_standard","quality":80}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/","title":"Clinical reasoning framework for thoracic spine exercise prescription in sport: a systematic review and narrative synthesis","publisher":"BMJ Open Sport & Exercise Medicine","kind":"peer_reviewed_research","quality":86}'::JSONB
  ),
  (
    'single-leg-balance-hold-tripod-foot',
    'Single-Leg Tripod Balance Hold',
    'Stand on one leg beside an available support when required. Maintain contact through the heel, first-metatarsal head, and fifth-metatarsal head without clawing the toes; keep the stance knee softly flexed and tracking, pelvis and ribs stacked, and head quiet for the declared visual condition and hold time. Touch support or set the lifted foot down before an uncontrolled step, alignment change, breath holding, or symptom.',
    'static_single_leg_tripod_balance',
    89, 80, 35,
    ARRAY['brace']::TEXT[],
    ARRAY['foot','ankle','knee','hip','pelvis','core']::TEXT[],
    '{}'::TEXT[],
    ARRAY['wall','mirror']::TEXT[],
    '{
      "surface":{"required":"level_firm_nonslip","avoid":["wet","loose","highly_compliant","uneven_unless_separately_reviewed"]},
      "space":{"clearFallRadiusMeters":1.5,"sharpEdgesRemoved":true,"trafficControlled":true},
      "support":{"stableHandSupportWithinReachWhenRequired":true,"supportMustNotMove":true},
      "visual":{"lightingAdequate":true,"fixedGazeTargetForEyesOpen":true,"eyesClosedRequiresCloseSupervision":true},
      "footwear":{"conditionDeclared":"barefoot_or_secure_footwear","tractionChecked":true},
      "sharedStation":{"athletesPerStation":1,"coachCanInterveneWithoutCollision":true}
    }'::JSONB,
    '{
      "prerequisites":["pain_free_bilateral_stance","safe_weight_shift","safe_step_down_or_hand_support_strategy"],
      "useCaution":["recent_ankle_knee_hip_or_foot_injury","known_fall_risk","vestibular_or_visual_impairment","dizziness","reduced_plantar_sensation"],
      "doNotUseWhen":["unsafe_fall_environment","acute_or_increasing_pain","dizziness_or_neurologic_symptoms","required_support_unavailable","cannot_exit_without_uncontrolled_fall"],
      "regressionOrder":["add_stable_hand_support","eyes_open_fixed_gaze","shorter_hold","allow_controlled_touch_down","tandem_balance_review_only_substitution"],
      "individualizationRequired":true,
      "medicalScope":"The card is not a diagnostic balance test and does not clear fall risk, injury, or neurologic symptoms."
    }'::JSONB,
    '{
      "primaryMuscles":["foot_intrinsic_muscles","fibularis_longus_and_brevis","tibialis_posterior","soleus","gluteus_medius"],
      "secondaryMuscles":["tibialis_anterior","gastrocnemius","quadriceps","hamstrings","gluteus_maximus"],
      "stabilizers":["deep_hip_rotators","internal_oblique","external_oblique","spinal_erectors"],
      "joints":["metatarsophalangeal","subtalar","talocrural","knee","hip","lumbar_spine"],
      "jointActions":["foot_pressure_distribution_control","ankle_plantarflexion_dorsiflexion_and_frontal_plane_adjustment","knee_flexion_extension_isometric_control","hip_abduction_and_rotation_control","trunk_postural_control"],
      "planes":["sagittal","frontal","transverse","multiplanar"],
      "laterality":"unilateral_alternating",
      "kineticChain":"closed_chain_single_lower_limb",
      "biomechanics":{"definingAction":"static_single_leg_stance_with_declared_tripod_contact","balanceStrategies":["ankle","hip","controlled_touch_down"],"difficultyLevers":["hand_support","visual_input","hold_duration","footwear","stance_knee_angle","head_motion"],"notAllowedAsSameVariant":["unstable_surface","external_load","reaching","perturbation"]},
      "evidenceLimit":"Single-leg balance training evidence supports balance outcomes across protocols; it does not validate every tripod cue, population, or exact dose."
    }'::JSONB,
    '{
      "whyItMatters":"Practices quiet single-leg posture and repeatable foot, ankle, knee, hip, and trunk control.",
      "primaryCue":"Heel, big-toe base, little-toe base; knee quiet, hips level.",
      "expectedSensations":["whole_foot_pressure","calf_and_foot_effort","outer_hip_effort","small_corrective_sway"],
      "unexpectedSensations":["sharp_or_increasing_pain","numbness_or_tingling","dizziness","joint_giving_way","loss_of_sensation"],
      "painGuidance":"Use support and stop immediately for symptoms, a giving-way event, or unsafe balance loss.",
      "selfChecks":["three_pressure_points_remain","toes_do_not_claw","knee_tracks_with_foot","pelvis_stays_quiet","breathing_continues","touch_down_occurs_before_a_fall"],
      "accessibility":["stable_hand_support","eyes_open","shorter_hold","secure_footwear","controlled_touch_down","tandem_stance_substitution"],
      "mediaAlternatives":["step_by_step_text","front_side_and_foot_stills","coach_demonstration","audio_count_with_touch_down_cue"],
      "beforeYouStart":["clear_fall_space","place_support","check_surface_and_footwear","declare_side_visual_condition_and_hold"],
      "afterSetCheck":["record_hold_time_and_touch_downs","record_alignment_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["fall_space_and_support","foot_contact_and_toe_clawing","ankle_strategy","knee_tracking","pelvic_drop_or_rotation","trunk_and_head_motion","breathing","touch_down_strategy","side_difference"],
      "faultCorrections":{"toe_clawing":["reduce_hold","restore_tripod_contact","use_support"],"knee_moves_inward":["use_support","shorten_hold","reset_foot_and_hip"],"pelvis_drops":["use_support","reduce_duration","regain_rib_pelvis_stack"],"arms_flail":["add_fingertip_support","declare_arm_position"],"unsafe_step":["stop","clear_space","regress_to_supported_or_tandem"]},
      "demonstrationPlan":["show_three_foot_contacts","show_safe_hand_support","show_quiet_knee_and_pelvis","show_controlled_touch_down","contrast_toe_clawing_and_uncontrolled_step"],
      "groupManagement":["one_athlete_per_clear_fall_space","eyes_closed_only_with_close_supervision","do_not_place_near_weights_platform_edges_or_moving_athletes"],
      "modificationDecisionTree":{"unsafe_without_support":"supported_eyes_open","supported_hold_repeatable":"unsupported_eyes_open","eyes_open_repeatable_and_close_supervision_available":"eyes_closed_candidate","symptoms_or_giving_way":"stop_and_escalate"},
      "recordingFields":["variant_key","side","footwear","visual_condition","support_used","target_seconds","actual_seconds","touch_downs","quality_result","symptoms","stop_reason"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","difficulty_or_dose","surface_support_or_environment","media_exact_match","accessibility","pain_fall_or_safety","graph_relationship","calibration"],
      "supportEscalation":{"urgent":["fall_or_injury_event","neurologic_symptom","loss_of_consciousness"],"coachReview":["repeated_giving_way","large_side_difference","unexpected_touch_downs"],"contentReview":["media_mismatch","conflicting_tripod_instruction","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact side and variant, footwear, visual condition, support, target and actual hold, touch-downs, quality result, symptoms, stop reason, evidence, media metadata, and reviews.",
      "changeImpactPolicy":"Changes to support, surface, visual input, external load, perturbation, hold rules, difficulty, media, or graph require a new card version and renewed affected reviews.",
      "knownLimitations":["candidate_media_not_human_viewed","tripod_cue_is_operational_not_a_diagnostic_claim","scores_and_graph_are_review_proposals"],
      "supportSummary":"Never remove support or vision solely to finish a prescribed clock."
    }'::JSONB,
    '{
      "identity":["The defining action is a static single-leg stance with declared heel, first-metatarsal-head, and fifth-metatarsal-head contact and controlled posture.","Naming order does not create separate exercise identities; support, vision, footwear, knee angle, and duration are variant or delivery dimensions."],
      "taxonomy":["The card declares side, support, visual condition, footwear, surface, stance posture, hold duration, touch-down rule, and fall space.","Reaching, unstable surfaces, external load, and perturbation add actions or constraints that require separate definitions or review."],
      "anatomy":["Foot and ankle musculature contribute to pressure control while knee, hip, pelvis, and trunk musculature organize single-leg posture.","The card does not claim that one muscle or a visible arch shape alone determines balance."],
      "biomechanics":["Postural control uses ankle, hip, and safe touch-down strategies under changing sensory conditions.","Removing hand support or visual input increases balance complexity without adding external impact."],
      "difficulty":["Complexity rises when hand support is removed and rises further when visual input is removed; physical demand changes more modestly.","Exercise difficulty is complexity plus physical demand, with overall equal to their maximum."],
      "load_fatigue_recovery":["Loading is bodyweight through one stance limb; external load and unstable surfaces are excluded from these variants.","Track local foot, calf, hip, and postural fatigue plus touch-downs, toe clawing, knee motion, and unsafe sway."],
      "constraints":["Use a firm nonslip surface, clear fall space, adequate light, declared footwear, and a stable support when needed.","Eyes-closed work requires close supervision and is never an automatic progression."],
      "dosage":["Program submaximal holds with normal breathing, side balance, rest, and a touch-down before uncontrolled loss.","Quality time, not survival time, determines the completed dose."],
      "instructions":["Set the foot contacts, shift to one leg, soften the knee, stack pelvis and ribs, use the declared visual condition, and hold only while controlled.","Instruction names the safe touch-down and stop signal."],
      "safety_stop_rules":["Stop for pain, giving way, numbness, tingling, dizziness, unsafe sway, unavailable support, or an uncontrolled step.","Restore hand support or a lower-demand stance before repeating."],
      "programming":["Use supported holds to establish access, unsupported eyes-open holds for static balance practice, and eyes-closed holds only when justified and supervised.","Balance gains are task-sensitive; do not assume universal transfer."],
      "athlete_support":["Athlete guidance distinguishes expected small sway from unexpected symptoms and explains support, touch-down, and nonvideo options.","The athlete reports side differences and does not hide touch-downs."],
      "coach_support":["The coach verifies exact support and sensory conditions and observes foot, knee, pelvis, trunk, breathing, and fall strategy.","Record actual clean hold time and touch-downs rather than only the target."],
      "accessibility":["Stable support, eyes open, shorter holds, secure footwear, touch-down permission, and tandem stance can improve access.","Removing support or vision is optional and requires the exact safety contract."],
      "alternates":["Supported, unsupported, and eyes-closed conditions are exact variants; footwear and hold duration are modifiers.","Reach tasks, loaded holds, perturbations, and unstable surfaces require separate review."],
      "media":["Four YouTube links have healthy current oEmbed metadata and privacy-enhanced embed URLs.","Full-video exact matching, cue and fall-safety quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pubmed.ncbi.nlm.nih.gov/35084234/","title":"Single Leg Balance Training: A Systematic Review","publisher":"Perceptual and Motor Skills","kind":"peer_reviewed_research","quality":90}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC7739583/","title":"How to Evaluate and Improve Foot Strength in Athletes: An Update","publisher":"Frontiers in Sports and Active Living","kind":"peer_reviewed_research","quality":86}'::JSONB
  ),
  (
    'split-squat-isometric-hold',
    'Split Squat Isometric Hold',
    'Set the declared split stance and optional support, lower to the recorded mid-range knee and hip position, keep the front foot grounded and knee tracking, back heel raised, pelvis and ribs controlled, then hold with normal breathing for the prescribed quality time. End the effort and exit under control before depth changes, the knee drifts, the back knee rests, posture twists, breathing fails, or symptoms appear.',
    'static_split_stance_squat_hold',
    90, 81, 35,
    ARRAY['squat','brace']::TEXT[],
    ARRAY['hip','knee','ankle','pelvis','core']::TEXT[],
    '{}'::TEXT[],
    ARRAY['wall','rack','dumbbell','mat']::TEXT[],
    '{
      "surface":{"required":"level_firm_nonslip","avoid":["wet","loose","uneven"]},
      "space":{"clearExitAreaMeters":1.5,"trafficControlled":true},
      "support":{"wallOrRackMustBeStableWhenUsed":true,"supportHeightDeclared":true},
      "load":{"dumbbellInspectionRequiredWhenLoaded":true,"clearSetDownZoneRequired":true},
      "setup":{"side_stride_depth_torso_and_holdDeclared":true,"backKneeMustNotRestUnlessSeparateVariant":true},
      "sharedStation":{"athletesPerStation":1,"spotterOrCoachAccessForLoadedVariant":true}
    }'::JSONB,
    '{
      "prerequisites":["pain_free_split_stance","controlled_split_squat_descent","safe_exit_from_declared_depth","normal_breathing_under_submaximal_tension"],
      "useCaution":["current_foot_ankle_knee_hip_or_back_symptoms","recent_lower_extremity_or_spinal_procedure","balance_limit","blood_pressure_or_pressure_symptom_precautions"],
      "doNotUseWhen":["acute_or_increasing_pain","numbness_tingling_dizziness_or_pressure_symptoms","unsafe_surface_support_or_load","cannot_exit_without_collapse_or_dropping_load"],
      "regressionOrder":["add_stable_hand_support","reduce_depth","shorten_hold","reduce_or_remove_external_load","wall_sit_review_only_substitution"],
      "individualizationRequired":true,
      "medicalScope":"The card does not prescribe rehabilitation or clear symptoms; follow the athlete care plan and local scope."
    }'::JSONB,
    '{
      "primaryMuscles":["quadriceps","gluteus_maximus"],
      "secondaryMuscles":["adductor_magnus","hamstrings","soleus","gastrocnemius"],
      "stabilizers":["gluteus_medius","deep_hip_rotators","foot_intrinsic_muscles","internal_oblique","external_oblique","spinal_erectors"],
      "joints":["hip","knee","talocrural","subtalar","lumbar_spine"],
      "jointActions":["hip_flexion_position_with_isometric_extensor_torque","knee_flexion_position_with_isometric_extensor_torque","ankle_dorsiflexion_position_control","frontal_and_transverse_plane_knee_control","trunk_postural_isometric_control"],
      "planes":["sagittal","frontal_control","transverse_control"],
      "laterality":"bilateral_split_stance_with_front_leg_bias",
      "kineticChain":"closed_chain_bilateral_asymmetric",
      "biomechanics":{"definingAction":"static_split_squat_position_at_declared_depth","loadDistribution":"front_leg_bias_with_rear_leg_support_declared","difficultyLevers":["hand_support","stride","depth","torso_inclination","external_load","hold_duration"],"separateDefinitions":["rear_foot_elevation","dynamic_repetitions","external_perturbation","jump_or_landing"]},
      "evidenceLimit":"Split-squat biomechanics and general isometric adaptations inform the card; direct trials of each exact hold variant and dose are not established."
    }'::JSONB,
    '{
      "whyItMatters":"Builds repeatable force and posture in a static split stance without impact.",
      "primaryCue":"Front foot owns the floor; knee tracks, back knee hovers, ribs over pelvis, breathe.",
      "expectedSensations":["front_thigh_and_glute_effort","rear_hip_and_leg_tension","foot_and_trunk_support","rising_effort_during_hold"],
      "unexpectedSensations":["sharp_or_increasing_pain","joint_pinching","numbness_or_tingling","dizziness_or_pressure_symptoms","giving_way"],
      "painGuidance":"Exit immediately for symptoms, loss of control, or an unsafe load; tell the coach before another effort.",
      "selfChecks":["front_foot_remains_grounded","front_knee_tracks","back_knee_does_not_rest","pelvis_and_ribs_do_not_twist","depth_remains_at_marker","breathing_continues","exit_is_controlled"],
      "accessibility":["stable_hand_support","shallower_depth","shorter_hold","bodyweight","mat_as_exit_marker_not_rest","wall_sit_substitution"],
      "mediaAlternatives":["step_by_step_text","front_and_side_stills_with_depth_marker","coach_demonstration","audible_time_and_exit_cue"],
      "beforeYouStart":["clear_exit_and_set_down_space","check_support_surface_and_load","declare_side_stride_depth_torso_load_and_hold"],
      "afterSetCheck":["record_actual_quality_time","record_depth_drift_compensation_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["surface_support_and_load","stance_width_and_length","front_foot_contact","knee_tracking","back_knee_clearance","pelvic_and_trunk position","depth_marker","breathing","controlled_exit"],
      "faultCorrections":{"front_heel_lifts":["adjust_stride_or_depth","reduce_load","restore_whole_foot_contact"],"knee_drifts_inward":["add_support","reduce_depth_or_load","reset_foot_and_hip"],"back_knee_rests":["raise_depth","shorten_hold"],"torso_twists":["reduce_load","use_support","reset_ribs_and_pelvis"],"breath_holding":["end_set","reduce_hold_or_load"],"unsafe_exit":["stop","add_support","remove_load"]},
      "demonstrationPlan":["show_stance_and_depth_marker","show_front_foot_and_knee","show_hover_and_breath","contrast_depth_drift_twist_and_resting","show_safe_exit_and_load_set_down"],
      "groupManagement":["one_athlete_per_clear_station","loaded_variant_requires_coach_access","keep_dumbbells_out_of_walkways","alternate_sides_with_declared_rest"],
      "modificationDecisionTree":{"balance_limits_position":"supported_bodyweight","supported_hold_repeatable":"unsupported_bodyweight","bodyweight_quality_and_capacity_repeatable":"goblet_loaded_candidate","symptoms_or_unsafe_exit":"stop_and_escalate"},
      "recordingFields":["variant_key","side","stance_length","stance_width","depth_marker","torso_contract","external_load","target_seconds","actual_quality_seconds","quality_result","symptoms","stop_reason"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","difficulty_load_or_dose","equipment_support_or_environment","media_exact_match","accessibility","pain_pressure_or_safety","graph_relationship","calibration"],
      "supportEscalation":{"urgent":["fall_load_drop_or_injury_event","neurologic_or_pressure_symptom"],"coachReview":["repeated_depth_drift","large_side_difference","unsafe_exit"],"contentReview":["media_mismatch","conflicting_depth_instruction","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact side and variant, stance and depth marker, torso contract, load, target and actual quality time, compensation, symptoms, stop reason, evidence, media metadata, and reviews.",
      "changeImpactPolicy":"Changes to support, stance, depth, torso, load, hold or exit rules, difficulty, media, or graph require a new card version and renewed affected reviews.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_variant_dose_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"End the hold when position or breathing changes; completing the clock is not the quality standard."
    }'::JSONB,
    '{
      "identity":["The defining action is a static split-squat position at a declared depth; iso is an abbreviation of isometric and does not create a second identity.","Support, stance, depth, torso, load, and hold duration are variant or delivery dimensions."],
      "taxonomy":["The card declares side, stance, depth marker, torso contract, support, load, hold duration, breathing, quality gate, and exit.","Dynamic split squats, rear-foot elevation, perturbation, jumps, and partner resistance change the action or constraints."],
      "anatomy":["The split stance places substantial demand on quadriceps and hip extensors with foot, ankle, hip, pelvis, and trunk stabilization.","Muscle contribution varies with stance, depth, torso, load, and individual anatomy."],
      "biomechanics":["Stride length and joint angles change lower-extremity mechanics; exact setup must be recorded rather than inferred from the name.","Isometric force is produced without intentional joint motion at the declared position."],
      "difficulty":["Hand support lowers balance complexity; removing support increases complexity; external load primarily raises physical demand and failure consequence.","Overall difficulty is the maximum of exercise complexity and physical demand."],
      "load_fatigue_recovery":["Track bodyweight or goblet load, stance, depth, hold time, quadriceps and glute fatigue, postural drift, and side difference.","Isometric adaptations are specific to task variables including muscle length, intensity, and intent."],
      "constraints":["Use a stable surface and support, clear exit and set-down space, inspected load, and an exact depth marker.","Do not continue through symptoms, breath holding, collapse, or an unsafe exit."],
      "dosage":["Use submaximal quality holds with side-balanced sets and sufficient rest; actual quality time ends at the first failed criterion.","Progress duration before load only when the intended adaptation and session budget support it."],
      "instructions":["Set stance and support, descend to the recorded depth, establish foot-knee-pelvis-trunk position, breathe, hold, and exit before change.","Instruction names load, time, quality gate, stop rules, and set-down."],
      "safety_stop_rules":["Stop for pain, pinching, giving way, neurologic, dizziness or pressure symptoms, breath holding, depth drift, knee collapse, load instability, or unsafe exit.","Use support, shallower depth, shorter time, or less load after review."],
      "programming":["Use supported bodyweight for positional access, unsupported bodyweight for static capacity, and loaded holds only after position and exit are repeatable.","Count local lower-body and postural fatigue before sprint, jump, or high-priority strength work."],
      "athlete_support":["Athlete guidance names expected effort, unexpected symptoms, self-checks, accessibility choices, and nonvideo instruction.","The athlete exits before failure and reports actual quality time."],
      "coach_support":["The coach verifies stance, depth, support, load, knee and foot, pelvis and trunk, breathing, and exit.","Record actual quality time and why the hold ended."],
      "accessibility":["Stable support, shallower depth, shorter hold, bodyweight, and a wall-sit substitution can reduce balance or load demand.","A back-knee pad is an exit marker, not permission to rest during the selectable variants."],
      "alternates":["Supported, unsupported, and goblet-loaded mid-range holds are exact variants; stance and hold time are modifiers.","Rear-foot elevation, dynamic motion, perturbation, partner resistance, and jumps require separate definitions."],
      "media":["Four YouTube links have healthy current oEmbed metadata and privacy-enhanced embed URLs.","Full-video exact matching, cue and safety quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pubmed.ncbi.nlm.nih.gov/24345718/","title":"Joint angles of the ankle, knee, and hip and loading conditions during split squats","publisher":"Journal of Applied Biomechanics","kind":"peer_reviewed_research","quality":88}'::JSONB,
    '{"url":"https://pubmed.ncbi.nlm.nih.gov/30580468/","title":"Isometric training and long-term adaptations: Effects of muscle length, intensity, and intent: A systematic review","publisher":"Scandinavian Journal of Medicine & Science in Sports","kind":"peer_reviewed_research","quality":91}'::JSONB
  );

UPDATE coaching.exercise_variant_v1 variant
SET variant_key = CASE
      WHEN definition.slug = 'quadruped-thread-the-needle'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-27-baseline'
      WHEN definition.slug = 'quadruped-thread-the-needle'
        AND variant.variant_key = 'baseline-source-1458'
        THEN 'legacy-source-1458-baseline'
      WHEN definition.slug = 'single-leg-balance-hold-tripod-foot'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-227-baseline'
      WHEN definition.slug = 'single-leg-balance-hold-tripod-foot'
        AND variant.variant_key = 'baseline-source-847'
        THEN 'legacy-source-847-baseline'
      WHEN definition.slug = 'split-squat-isometric-hold'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-212-baseline'
      ELSE variant.variant_key
    END,
    display_name = 'Legacy ' || variant.display_name || ' Source',
    status = 'archived',
    requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
      || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'Legacy source omits the exact selectable support, position, dose, quality, and stop contract.'
      ),
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = variant.definition_id
  AND definition.facility_id = 1
  AND (
    (
      definition.slug = 'quadruped-thread-the-needle'
      AND variant.variant_key IN ('baseline','baseline-source-1458')
    )
    OR (
      definition.slug = 'single-leg-balance-hold-tripod-foot'
      AND variant.variant_key IN ('baseline','baseline-source-847')
    )
    OR (
      definition.slug = 'split-squat-isometric-hold'
      AND variant.variant_key = 'baseline'
    )
  );

UPDATE coaching.exercise_delivery_profile_v1 profile
SET status = 'archived',
    updated_at = now()
FROM coaching.exercise_variant_v1 variant
JOIN coaching.exercise_definition_v1 definition
  ON definition.id = variant.definition_id
WHERE variant.id = profile.variant_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  )
  AND variant.status = 'archived';

UPDATE coaching.exercise_definition_v1 definition
SET canonical_name = seed.canonical_name,
    display_name = seed.canonical_name,
    description = seed.description,
    family_key = seed.family_key,
    schema_version = '1.0.0',
    card_version = greatest(definition.card_version, 2),
    status = 'review',
    content_confidence = seed.content_confidence,
    scoring_confidence = seed.scoring_confidence,
    media_confidence = seed.media_confidence,
    movement_patterns = seed.movement_patterns,
    body_regions = seed.body_regions,
    required_equipment = seed.required_equipment,
    optional_equipment = seed.optional_equipment,
    environment_json = seed.environment_json,
    population_json = seed.population_json,
    anatomy_json = seed.anatomy_json,
    athlete_support_json = seed.athlete_support_json,
    coach_support_json = seed.coach_support_json,
    support_operations_json = seed.support_operations_json,
    approved_video_url = NULL,
    reviewed_by = NULL,
    approved_by = NULL,
    last_reviewed_at = NULL,
    provenance_json = definition.provenance_json || jsonb_build_object(
      'structuralCompletionMigration',
        '352_coaching_static_control_family_completion',
      'researchBatch', 'static-control-identity-collisions-v1',
      'researchVersion', '2026-07-27.45',
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'evidenceState', 'candidate_requires_human_review',
      'mediaState', 'candidate_oembed_metadata_only',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
      'mediaApprovalCreated', FALSE,
      'graphApprovalCreated', FALSE,
      'calibrationApprovalCreated', FALSE
    ),
    updated_at = now()
FROM static_card_seed seed
WHERE definition.facility_id = 1
  AND definition.slug = seed.slug;

CREATE TEMP TABLE static_variant_seed (
  slug TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  modifier_keys TEXT[] NOT NULL,
  exercise_complexity SMALLINT NOT NULL,
  physical_difficulty SMALLINT NOT NULL,
  supervision_demand SMALLINT NOT NULL,
  failure_consequence SMALLINT NOT NULL,
  impact SMALLINT NOT NULL,
  work_capacity_demand SMALLINT NOT NULL,
  requirements_json JSONB NOT NULL,
  load_profile_json JSONB NOT NULL,
  fatigue_profile_json JSONB NOT NULL,
  programming_profile_json JSONB NOT NULL,
  PRIMARY KEY (slug, variant_key)
);

INSERT INTO static_variant_seed VALUES
  (
    'quadruped-thread-the-needle',
    'quadruped-thread-and-open',
    'Quadruped Thread-and-Open',
    ARRAY['hands_and_knees','palm_up_thread','open_rotation','alternating_sides']::TEXT[],
    28, 14, 20, 14, 1, 16,
    '{"selectable":true,"supportBase":"both_knees_and_one_hand","movingArm":"palm_up_reach_under_then_open","hipPosition":"knees_under_hips","range":"pain_free_owned_range_declared_per_side","tempo":"slow_with_controlled_reversal","sideContract":"equal_quality_repetitions","safeExit":"return_hand_then_sit_or_rise_under_control"}'::JSONB,
    '{"gripDemand":8,"spinalLoading":8,"eccentricStress":8,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"bodyweight shared across one hand and both knees with the other arm moving","loadTracking":["side","range_marker","repetitions","tempo","support_tolerance"]}'::JSONB,
    '{"localMuscleFatigue":12,"gripFatigue":8,"technicalFatigueSensitivity":28,"impactAccumulation":1,"recoveryHours":6,"primaryFatigueSites":["support_shoulder","wrist","thoracic_trunk"],"stopBefore":["support_collapse","pelvic_rotation","range_forcing","momentum","breath_holding"]}'::JSONB,
    '{"trainingStimuli":["thoracic_rotation_access","rib_cage_rotation_control","closed_chain_shouldersupport"],"stimulusDose":{"primary":"quality_repetitions_per_side","fatigueCeiling":"low"},"weeklyExposure":{"typical":2,"maximumWithoutReview":5},"prerequisites":["pain_free_quadruped_support","safe_floor_transfer"],"completionCriteria":["same_owned_range_each_repetition","quiet_pelvis","active_support","calm_breathing"],"sequenceRules":["before_rotation_dependent_work","not_a_fatigue_block"],"pairingCompatibility":{"preferred":["general_warmup","breathing_reset"],"avoid":["already_irritable_wrist_or_shoulder"]},"uncertaintyPolicy":{"symptom_or_support_uncertainty":"do_not_use","range_uncertainty":"use_shorter_range"},"cumulativeBudget":{"technicalSensitivity":28,"impact":1,"upperLimbSupport":14}}'::JSONB
  ),
  (
    'quadruped-thread-the-needle',
    'heel-sit-thread-and-open',
    'Heel-Sit Quadruped Thread-and-Open',
    ARRAY['heel_sit','palm_up_thread','open_rotation','alternating_sides']::TEXT[],
    34, 16, 24, 16, 1, 18,
    '{"selectable":true,"supportBase":"both_knees_shins_and_one_hand","movingArm":"palm_up_reach_under_then_open","hipPosition":"hips_toward_heels_at_comfortable_depth","range":"pain_free_owned_range_without_pelvic_shift","tempo":"slow_with_end_range_pause","sideContract":"equal_quality_repetitions","safeExit":"return_to_quadruped_before_rising"}'::JSONB,
    '{"gripDemand":8,"spinalLoading":8,"eccentricStress":8,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"bodyweight floor support with hips biased toward heels","loadTracking":["heel_sit_depth","side","range_marker","pause_seconds","repetitions"]}'::JSONB,
    '{"localMuscleFatigue":14,"gripFatigue":8,"technicalFatigueSensitivity":34,"impactAccumulation":1,"recoveryHours":6,"primaryFatigueSites":["support_shoulder","wrist","thoracic_trunk","hips_or_knees_if_position_limited"],"stopBefore":["hip_or_knee_discomfort","pelvic_shift","support_collapse","range_forcing","breath_holding"]}'::JSONB,
    '{"trainingStimuli":["thoracic_rotation_access_with_pelvic_constraint","rib_cage_control"],"stimulusDose":{"primary":"quality_repetitions_with_pause","fatigueCeiling":"low"},"weeklyExposure":{"typical":2,"maximumWithoutReview":5},"prerequisites":["comfortable_heel_sit","pain_free_quadruped_support","repeatable_standard_thread_and_open"],"completionCriteria":["heel_sit_position_stays_constant","owned_rotation_without_pelvic_shift","calm_breathing"],"sequenceRules":["use_only_when_heel_sit_is_comfortable","before_rotation_dependent_work"],"pairingCompatibility":{"preferred":["low_fatigue_mobility"],"avoid":["knee_or_hip_flexion_irritability"]},"uncertaintyPolicy":{"heel_sit_uncertain":"use_standard_quadruped","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":34,"impact":1,"upperLimbSupport":14}}'::JSONB
  ),
  (
    'single-leg-balance-hold-tripod-foot',
    'supported-eyes-open',
    'Supported Eyes-Open Single-Leg Tripod Hold',
    ARRAY['fingertip_support','eyes_open','fixed_gaze','static_hold']::TEXT[],
    22, 18, 18, 16, 1, 18,
    '{"selectable":true,"support":"stable_fingertip_or_hand_support","visualCondition":"eyes_open_fixed_gaze","surface":"firm_level_nonslip","footContact":"heel_first_and_fifth_metatarsal_heads","stanceKnee":"soft_and_tracking","touchDownRule":"touch_support_or_lifted_foot_before_uncontrolled_step","sideContract":"both_sides_recorded"}'::JSONB,
    '{"gripDemand":2,"spinalLoading":4,"eccentricStress":4,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"single-limb bodyweight with stable hand support","loadTracking":["side","support_contact","hold_seconds","touch_downs","footwear"]}'::JSONB,
    '{"localMuscleFatigue":18,"gripFatigue":1,"technicalFatigueSensitivity":22,"impactAccumulation":1,"recoveryHours":6,"primaryFatigueSites":["foot","calf","lateral_hip"],"stopBefore":["toe_clawing","knee_drift","pelvic_drop","unsafe_sway","breath_holding"]}'::JSONB,
    '{"trainingStimuli":["supported_static_balance","tripod_pressure_control","single_leg_posture"],"stimulusDose":{"primary":"clean_hold_seconds","fatigueCeiling":"low"},"weeklyExposure":{"typical":3,"maximumWithoutReview":6},"prerequisites":["safe_weight_shift","stable_support_available"],"completionCriteria":["tripod_contact","quiet_knee_and_pelvis","controlled_touch_down","normal_breathing"],"sequenceRules":["before_fatigued_single_leg_work","support_remains_available"],"pairingCompatibility":{"preferred":["foot_ankle_prep","single_leg_strength_prep"],"avoid":["fatigued_or_dizzy_state"]},"uncertaintyPolicy":{"fall_risk_unclear":"require_support_and_supervision","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":22,"impact":1,"balance":18}}'::JSONB
  ),
  (
    'single-leg-balance-hold-tripod-foot',
    'unsupported-eyes-open',
    'Unsupported Eyes-Open Single-Leg Tripod Hold',
    ARRAY['unsupported','eyes_open','fixed_gaze','static_hold']::TEXT[],
    34, 24, 28, 24, 1, 24,
    '{"selectable":true,"support":"available_within_reach_but_not_used","visualCondition":"eyes_open_fixed_gaze","surface":"firm_level_nonslip","footContact":"heel_first_and_fifth_metatarsal_heads","stanceKnee":"soft_and_tracking","touchDownRule":"use_support_or_lifted_foot_before_uncontrolled_step","sideContract":"both_sides_recorded"}'::JSONB,
    '{"gripDemand":1,"spinalLoading":5,"eccentricStress":5,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"unsupported single-limb bodyweight stance","loadTracking":["side","hold_seconds","touch_downs","footwear","sway_or_alignment_errors"]}'::JSONB,
    '{"localMuscleFatigue":24,"gripFatigue":1,"technicalFatigueSensitivity":36,"impactAccumulation":1,"recoveryHours":8,"primaryFatigueSites":["foot","calf","lateral_hip","postural_trunk"],"stopBefore":["uncontrolled_step","toe_clawing","knee_drift","pelvic_drop","arm_flailing","breath_holding"]}'::JSONB,
    '{"trainingStimuli":["unsupported_static_balance","tripod_pressure_control","single_leg_posture"],"stimulusDose":{"primary":"clean_hold_seconds_and_touch_downs","fatigueCeiling":"low_to_moderate"},"weeklyExposure":{"typical":3,"maximumWithoutReview":6},"prerequisites":["repeatable_supported_hold","safe_touch_down","clear_fall_space"],"completionCriteria":["declared_clean_hold","no_uncontrolled_step","normal_breathing"],"sequenceRules":["before_high_fatigue_or_high_impact_single_leg_work"],"pairingCompatibility":{"preferred":["single_leg_strength_or_landing_prep"],"avoid":["post_fatigue_balance_testing"]},"uncertaintyPolicy":{"fall_risk_or_space_uncertain":"use_supported_variant","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":36,"impact":1,"balance":32}}'::JSONB
  ),
  (
    'single-leg-balance-hold-tripod-foot',
    'unsupported-eyes-closed',
    'Unsupported Eyes-Closed Single-Leg Tripod Hold',
    ARRAY['unsupported','eyes_closed','close_supervision','static_hold']::TEXT[],
    52, 28, 52, 40, 1, 30,
    '{"selectable":true,"support":"stable_support_immediately_within_reach","visualCondition":"eyes_closed_after_position_is_set","surface":"firm_level_nonslip","supervision":"coach_within_intervention_distance","footContact":"heel_first_and_fifth_metatarsal_heads","touchDownRule":"open_eyes_and_use_support_or_lifted_foot_at_first_control_loss","sideContract":"short_both_side_holds_recorded"}'::JSONB,
    '{"gripDemand":1,"spinalLoading":5,"eccentricStress":5,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"unsupported single-limb bodyweight stance with vision removed","loadTracking":["side","eyes_closed_seconds","touch_downs","coach_interventions","footwear"]}'::JSONB,
    '{"localMuscleFatigue":28,"gripFatigue":1,"technicalFatigueSensitivity":58,"impactAccumulation":1,"recoveryHours":8,"primaryFatigueSites":["foot","calf","lateral_hip","postural_system"],"stopBefore":["unsafe_sway","uncontrolled_step","coach_rescue","dizziness","toe_clawing","breath_holding"]}'::JSONB,
    '{"trainingStimuli":["sensory_constrained_static_balance","tripod_pressure_control"],"stimulusDose":{"primary":"short_clean_eyes_closed_seconds","fatigueCeiling":"low"},"weeklyExposure":{"typical":1,"maximumWithoutReview":3},"prerequisites":["repeatable_unsupported_eyes_open_hold","no_current_dizziness","close_supervision","safe_support_and_space"],"completionCriteria":["short_controlled_hold","safe_eye_open_and_touch_down","no_coach_rescue"],"sequenceRules":["optional_not_automatic","never_in_crowded_or_fatigued_setting"],"pairingCompatibility":{"preferred":["dedicated_low_fatigue_balance_block"],"avoid":["circuits","eyes_closed_group_unsupervised","post_fatigue"]},"uncertaintyPolicy":{"any_safety_uncertainty":"use_eyes_open","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":58,"impact":1,"balance":52}}'::JSONB
  ),
  (
    'split-squat-isometric-hold',
    'supported-bodyweight-mid-range',
    'Supported Bodyweight Mid-Range Split Squat Hold',
    ARRAY['stable_hand_support','bodyweight','mid_range','isometric_hold']::TEXT[],
    26, 32, 24, 24, 1, 38,
    '{"selectable":true,"support":"stable_wall_or_rack","load":"bodyweight","stance":"coach_declared_and_recorded","depth":"repeatable_mid_range_marker","backKnee":"hovering_not_resting","torso":"declared_upright_or_slight_incline","breathing":"continuous","safeExit":"use_support_and_rise_or_step_out"}'::JSONB,
    '{"gripDemand":2,"spinalLoading":12,"eccentricStress":8,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"split-stance bodyweight with stable hand support","loadTracking":["side","stance","depth_marker","hold_seconds","support_contact"]}'::JSONB,
    '{"localMuscleFatigue":38,"gripFatigue":1,"technicalFatigueSensitivity":30,"impactAccumulation":1,"recoveryHours":18,"primaryFatigueSites":["front_quadriceps","front_glute","rear_leg","trunk"],"stopBefore":["depth_drift","knee_drift","back_knee_rest","breath_holding","unsafe_exit"]}'::JSONB,
    '{"trainingStimuli":["split_stance_position_control","submaximal_lower_body_isometric_capacity"],"stimulusDose":{"primary":"quality_hold_seconds_per_side","fatigueCeiling":"moderate"},"weeklyExposure":{"typical":2,"maximumWithoutReview":4},"prerequisites":["pain_free_split_stance","stable_support","safe_exit"],"completionCriteria":["depth_and_alignment_held","normal_breathing","controlled_exit"],"sequenceRules":["before_high_fatigue_accessory_work","count_toward_quadriceps_budget"],"pairingCompatibility":{"preferred":["upper_body_strength","low_fatigue_mobility"],"avoid":["before_priority_sprint_or_jump_when_fatiguing"]},"uncertaintyPolicy":{"balance_uncertain":"retain_support","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":30,"impact":1,"quadriceps":38}}'::JSONB
  ),
  (
    'split-squat-isometric-hold',
    'unsupported-bodyweight-mid-range',
    'Unsupported Bodyweight Mid-Range Split Squat Hold',
    ARRAY['unsupported','bodyweight','mid_range','isometric_hold']::TEXT[],
    36, 42, 34, 30, 1, 48,
    '{"selectable":true,"support":"available_within_reach_but_not_used","load":"bodyweight","stance":"coach_declared_and_recorded","depth":"repeatable_mid_range_marker","backKnee":"hovering_not_resting","torso":"declared_upright_or_slight_incline","breathing":"continuous","safeExit":"rise_or_step_out_without_collapse"}'::JSONB,
    '{"gripDemand":1,"spinalLoading":14,"eccentricStress":8,"landingContactsPerRep":0,"externalLoadMethod":"bodyweight","externalLoadDescription":"unsupported split-stance bodyweight at declared depth","loadTracking":["side","stance","depth_marker","hold_seconds","alignment_errors"]}'::JSONB,
    '{"localMuscleFatigue":48,"gripFatigue":1,"technicalFatigueSensitivity":42,"impactAccumulation":1,"recoveryHours":24,"primaryFatigueSites":["front_quadriceps","front_glute","rear_leg","foot_ankle","trunk"],"stopBefore":["depth_drift","knee_drift","front_heel_lift","torso_twist","breath_holding","unsafe_exit"]}'::JSONB,
    '{"trainingStimuli":["unsupported_split_stance_isometric_capacity","lower_body_position_control"],"stimulusDose":{"primary":"quality_hold_seconds_per_side","fatigueCeiling":"moderate"},"weeklyExposure":{"typical":2,"maximumWithoutReview":3},"prerequisites":["repeatable_supported_hold","safe_unsupported_exit"],"completionCriteria":["depth_and_alignment_held","side_difference_within_reviewed_tolerance","normal_breathing"],"sequenceRules":["count_toward_lower_body_strength_and_postural_fatigue"],"pairingCompatibility":{"preferred":["upper_body_strength","noncompeting_accessory"],"avoid":["before_priority_speed_jump_or_heavy_squat_when_fatiguing"]},"uncertaintyPolicy":{"balance_or_exit_uncertain":"use_supported_variant","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":42,"impact":1,"quadriceps":48}}'::JSONB
  ),
  (
    'split-squat-isometric-hold',
    'goblet-loaded-mid-range',
    'Goblet-Loaded Mid-Range Split Squat Hold',
    ARRAY['goblet_load','unsupported','mid_range','isometric_hold']::TEXT[],
    44, 58, 46, 42, 1, 62,
    '{"selectable":true,"support":"stable_support_nearby_for_exit_but_not_used_during_hold","load":"single_dumbbell_goblet","stance":"coach_declared_and_recorded","depth":"repeatable_mid_range_marker","backKnee":"hovering_not_resting","torso":"declared_and_repeatable","breathing":"continuous","safeExit":"rise_then_set_load_in_clear_zone_or_use_predeclared_assist"}'::JSONB,
    '{"gripDemand":24,"spinalLoading":26,"eccentricStress":10,"landingContactsPerRep":0,"externalLoadMethod":"dumbbell_goblet","externalLoadDescription":"single dumbbell held at the chest during a split-stance isometric","loadTracking":["dumbbell_mass","side","stance","depth_marker","hold_seconds","set_down_method"]}'::JSONB,
    '{"localMuscleFatigue":62,"gripFatigue":24,"technicalFatigueSensitivity":52,"impactAccumulation":1,"recoveryHours":36,"primaryFatigueSites":["front_quadriceps","front_glute","rear_leg","trunk","forearms"],"stopBefore":["load_drift","depth_drift","knee_drift","torso_twist","breath_holding","unsafe_exit_or_set_down"]}'::JSONB,
    '{"trainingStimuli":["loaded_split_stance_isometric_strength","position_specific_lower_body_capacity"],"stimulusDose":{"primary":"load_times_quality_hold_seconds_per_side","fatigueCeiling":"moderate_to_high"},"weeklyExposure":{"typical":1,"maximumWithoutReview":2},"prerequisites":["repeatable_unsupported_bodyweight_hold","safe_goblet_pickup_and_set_down","controlled_breathing"],"completionCriteria":["load_and_depth_remain_constant","normal_breathing","safe_exit_and_set_down"],"sequenceRules":["place_with_strength_work","count_toward_lower_body_and_axial_fatigue","avoid_before_priority_speed_or_jump_output"],"pairingCompatibility":{"preferred":["upper_body_pull","low_fatigue_accessory"],"avoid":["high_density_lower_body_or_grip_work"]},"uncertaintyPolicy":{"load_or_exit_uncertain":"use_bodyweight","symptom":"stop"},"cumulativeBudget":{"technicalSensitivity":52,"impact":1,"quadriceps":62,"axial":26,"grip":24}}'::JSONB
  );

INSERT INTO coaching.exercise_variant_v1 (
  definition_id,
  variant_key,
  display_name,
  modifier_keys,
  difficulty_json,
  requirements_json,
  status,
  load_profile_json,
  fatigue_profile_json,
  programming_profile_json
)
SELECT
  definition.id,
  seed.variant_key,
  seed.display_name,
  seed.modifier_keys,
  jsonb_build_object(
    'technicalComplexity', seed.exercise_complexity,
    'absoluteLoadDemand', seed.physical_difficulty,
    'baseOverallDifficulty',
      greatest(seed.exercise_complexity, seed.physical_difficulty),
    'coordinationDemand', seed.exercise_complexity,
    'supervisionDemand', seed.supervision_demand,
    'failureConsequence', seed.failure_consequence,
    'impact', seed.impact,
    'workCapacityDemand', seed.work_capacity_demand,
    'difficultyModel',
      'max_exercise_complexity_physical_difficulty'
  ),
  seed.requirements_json,
  'review',
  seed.load_profile_json,
  seed.fatigue_profile_json,
  seed.programming_profile_json
FROM static_variant_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.slug
ON CONFLICT (definition_id, variant_key)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  modifier_keys = EXCLUDED.modifier_keys,
  difficulty_json = EXCLUDED.difficulty_json,
  requirements_json = EXCLUDED.requirements_json,
  status = 'review',
  load_profile_json = EXCLUDED.load_profile_json,
  fatigue_profile_json = EXCLUDED.fatigue_profile_json,
  programming_profile_json = EXCLUDED.programming_profile_json,
  updated_at = now();

CREATE TEMP TABLE static_profile_seed (
  slug TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  profile_key TEXT NOT NULL,
  phase_key TEXT NOT NULL,
  role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  suitability SMALLINT NOT NULL,
  alignment SMALLINT NOT NULL,
  dosage_json JSONB NOT NULL,
  quality_gate TEXT NOT NULL,
  stop_rules TEXT[] NOT NULL,
  expected_adaptation TEXT NOT NULL,
  equipment_required TEXT[] NOT NULL,
  PRIMARY KEY (slug, variant_key, profile_key)
);

INSERT INTO static_profile_seed VALUES
  ('quadruped-thread-the-needle','quadruped-thread-and-open','prepare-access','prepare_and_access','primary','Use low-fatigue thread-and-open repetitions to assess and prepare owned thoracic and rib-cage rotation with active shoulder support.',94,92,'{"sets":1,"repetitionsPerSide":{"minimum":4,"target":6,"maximum":8},"tempo":"three_to_four_seconds_each_repetition","endRangePauseSeconds":{"minimum":0,"target":1,"maximum":2},"restSeconds":{"minimum":15,"target":30,"maximum":45},"stopAtTechnicalRir":3}'::JSONB,'Every counted repetition preserves support-hand contact, an active support shoulder, a quiet pelvis, pain-free range, controlled reversal, and calm breathing on both sides.',ARRAY['pain_or_neurologic_or_dizziness_symptom','support_collapse','pelvic_shift_or_rotation','forced_range','momentum','breath_holding','range_or_control_worsens']::TEXT[],'Usable low-fatigue thoracic rotation access with observable pelvic and shoulder control.',ARRAY['none']::TEXT[]),
  ('quadruped-thread-the-needle','quadruped-thread-and-open','restore-control','restore','secondary','Use slow symptom-free repetitions as a low-load movement reset when floor support is appropriate and motion improves across the set.',84,86,'{"sets":{"minimum":1,"target":2,"maximum":2},"repetitionsPerSide":{"minimum":3,"target":5,"maximum":6},"tempo":"slow_breath_led","restSeconds":{"minimum":20,"target":30,"maximum":60},"stopAtTechnicalRir":4}'::JSONB,'The final repetition is at least as comfortable and controlled as the first without added pelvic motion, shoulder collapse, or range forcing.',ARRAY['any_symptom','motion_or_comfort_worsens','support_intolerance','pelvic_compensation','breath_holding']::TEXT[],'Low-load movement variability and controlled breathing without accumulating fatigue.',ARRAY['none']::TEXT[]),
  ('quadruped-thread-the-needle','heel-sit-thread-and-open','prepare-access','prepare_and_access','conditional','Use the heel-sit constraint only when hip, knee, wrist, and shoulder contacts are comfortable and reduced pelvic motion improves the intended thoracic action.',86,88,'{"sets":1,"repetitionsPerSide":{"minimum":3,"target":5,"maximum":6},"tempo":"three_to_five_seconds_each_repetition","endRangePauseSeconds":{"minimum":1,"target":2,"maximum":3},"restSeconds":{"minimum":20,"target":30,"maximum":60},"stopAtTechnicalRir":3}'::JSONB,'Heel-sit depth remains constant, the pelvis stays quiet, the support shoulder remains active, and the moving arm uses only symptom-free owned range.',ARRAY['hip_knee_wrist_or_shoulder_discomfort','pelvic_shift','support_collapse','forced_range','breath_holding']::TEXT[],'Thoracic and rib-cage rotation practice with a stronger pelvic-position constraint.',ARRAY['none']::TEXT[]),
  ('quadruped-thread-the-needle','heel-sit-thread-and-open','restore-control','restore','conditional','Use short heel-sit thread-and-open sets as a movement reset only when the position is more comfortable and more specific than standard quadruped.',76,80,'{"sets":1,"repetitionsPerSide":{"minimum":2,"target":4,"maximum":5},"tempo":"slow_breath_led","restSeconds":{"minimum":20,"target":30,"maximum":60},"stopAtTechnicalRir":4}'::JSONB,'Comfort, breathing, support, and controlled range stay stable or improve; otherwise return to standard quadruped or a side-lying substitution.',ARRAY['any_symptom','heel_sit_discomfort','range_or_control_worsens','support_collapse','breath_holding']::TEXT[],'Low-dose position-specific rotation access without fatigue or forced end range.',ARRAY['none']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','supported-eyes-open','movement-control','movement_intelligence','primary','Establish the exact tripod, knee, pelvis, trunk, gaze, and safe touch-down contract with stable hand support.',94,94,'{"sets":2,"holdSecondsPerSide":{"minimum":10,"target":20,"maximum":30},"restSeconds":{"minimum":20,"target":30,"maximum":60},"support":"light_continuous_or_intermittent_as_declared","stopAtTechnicalRir":3}'::JSONB,'Clean time counts only while three foot contacts, quiet toes, knee tracking, pelvic control, breathing, and a safe support strategy remain.',ARRAY['pain_or_giving_way','dizziness_or_neurologic_symptom','unsafe_sway','toe_clawing','knee_or_pelvic_drift','breath_holding']::TEXT[],'Supported static single-leg balance and repeatable foot-to-hip postural organization.',ARRAY['wall']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','supported-eyes-open','resilience-base','resilience','secondary','Accumulate low-fatigue quality balance time with support available for foot-ankle-hip resilience work.',88,90,'{"sets":{"minimum":2,"target":3,"maximum":3},"holdSecondsPerSide":{"minimum":15,"target":25,"maximum":30},"restSeconds":{"minimum":20,"target":30,"maximum":60},"maximumCleanSecondsPerSide":90,"stopAtTechnicalRir":3}'::JSONB,'No time is counted after toe clawing, knee drift, pelvic drop, breath holding, or loss of the declared support strategy.',ARRAY['any_symptom','unsafe_sway','repeated_touch_down','alignment_change','breath_holding','technical_rir_below_three']::TEXT[],'Low-load foot, ankle, hip, and postural endurance with controlled support.',ARRAY['wall']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-open','movement-control','movement_intelligence','primary','Practice unsupported static balance with fixed gaze while a stable support remains immediately available.',92,92,'{"sets":2,"holdSecondsPerSide":{"minimum":10,"target":20,"maximum":30},"restSeconds":{"minimum":30,"target":45,"maximum":75},"maximumTouchDownsPerSet":1,"stopAtTechnicalRir":3}'::JSONB,'The athlete completes the declared clean time without an uncontrolled step, toe clawing, knee drift, pelvic drop, arm flailing, or breath holding.',ARRAY['pain_or_giving_way','dizziness_or_neurologic_symptom','uncontrolled_step','more_than_one_touch_down','alignment_change','breath_holding']::TEXT[],'Unsupported eyes-open static balance and safe self-correction.',ARRAY['none']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-open','resilience-base','resilience','secondary','Build modest static balance capacity while preserving the exact posture and touch-down standard.',84,88,'{"sets":{"minimum":2,"target":3,"maximum":3},"holdSecondsPerSide":{"minimum":15,"target":25,"maximum":40},"restSeconds":{"minimum":30,"target":45,"maximum":75},"maximumCleanSecondsPerSide":120,"stopAtTechnicalRir":3}'::JSONB,'Actual clean time ends at the first touch-down beyond the allowance, alignment change, breath hold, or unsafe sway.',ARRAY['any_symptom','uncontrolled_step','repeated_touch_down','alignment_change','technical_rir_below_three']::TEXT[],'Submaximal eyes-open single-leg balance capacity without fatigue-driven strategy loss.',ARRAY['none']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-closed','movement-control','movement_intelligence','conditional','Add a brief eyes-closed sensory constraint only after eyes-open control is repeatable and one-to-one close supervision and support are available.',76,84,'{"sets":2,"holdSecondsPerSide":{"minimum":3,"target":8,"maximum":15},"restSeconds":{"minimum":45,"target":60,"maximum":90},"eyesOpenResetBetweenSets":true,"maximumCoachInterventions":0,"stopAtTechnicalRir":4}'::JSONB,'The athlete opens the eyes and uses support before an uncontrolled step; no coach rescue, symptom, or hidden touch-down is allowed.',ARRAY['any_symptom','unsafe_sway','uncontrolled_step','coach_intervention','dizziness','breath_holding']::TEXT[],'Brief supervised sensory-constrained static balance practice.',ARRAY['none']::TEXT[]),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-closed','resilience-base','resilience','avoid','Do not use eyes-closed holds as an unsupervised endurance or fatigue exercise; select the eyes-open variant instead.',20,30,'{"sets":1,"holdSecondsPerSide":{"minimum":3,"target":5,"maximum":8},"restSeconds":{"minimum":60,"target":90,"maximum":120},"requiresExplicitCoachOverride":true}'::JSONB,'This profile passes only when an authorized coach documents why the sensory constraint is needed and provides close supervision and an immediate support.',ARRAY['no_explicit_rationale','no_close_supervision','crowded_environment','fatigue','any_symptom_or_control_loss']::TEXT[],'No routine resilience adaptation is claimed; this profile encodes an avoid-by-default safety boundary.',ARRAY['none']::TEXT[]),
  ('split-squat-isometric-hold','supported-bodyweight-mid-range','resilience-position','resilience','primary','Build repeatable split-stance position and symptom-free tissue tolerance with stable hand support and modest fatigue.',92,92,'{"sets":2,"holdSecondsPerSide":{"minimum":10,"target":20,"maximum":30},"restSeconds":{"minimum":45,"target":60,"maximum":90},"stopAtTechnicalRir":3}'::JSONB,'Actual quality time ends before depth, front-foot contact, knee tracking, back-knee clearance, pelvis, torso, breathing, or exit changes.',ARRAY['pain_pinching_or_giving_way','neurologic_dizziness_or_pressure_symptom','depth_or_alignment_drift','back_knee_rest','breath_holding','unsafe_exit']::TEXT[],'Supported split-stance isometric control and modest lower-body tissue capacity.',ARRAY['wall']::TEXT[]),
  ('split-squat-isometric-hold','supported-bodyweight-mid-range','capacity-quality','capacity','secondary','Accumulate side-balanced bodyweight hold time without allowing support to hide position loss.',84,88,'{"sets":{"minimum":2,"target":3,"maximum":4},"holdSecondsPerSide":{"minimum":15,"target":25,"maximum":40},"restSeconds":{"minimum":60,"target":75,"maximum":120},"maximumQualitySecondsPerSide":120,"stopAtTechnicalRir":2}'::JSONB,'Support remains light and stable while depth, knee, foot, pelvis, torso, breath, and exit remain within the declared contract.',ARRAY['any_symptom','support_bears_unplanned_bodyweight','position_drift','breath_holding','technical_rir_below_two']::TEXT[],'Submaximal supported split-stance isometric work capacity.',ARRAY['wall']::TEXT[]),
  ('split-squat-isometric-hold','unsupported-bodyweight-mid-range','resilience-position','resilience','secondary','Use unsupported bodyweight holds when balance, alignment, breathing, and exit are repeatable without hand support.',86,90,'{"sets":2,"holdSecondsPerSide":{"minimum":10,"target":20,"maximum":30},"restSeconds":{"minimum":60,"target":75,"maximum":120},"stopAtTechnicalRir":3}'::JSONB,'No counted time follows foot, knee, depth, pelvic, torso, breath, or exit change; support remains reachable.',ARRAY['any_symptom','balance_loss','depth_or_alignment_drift','breath_holding','unsafe_exit']::TEXT[],'Unsupported split-stance position control and tissue capacity.',ARRAY['none']::TEXT[]),
  ('split-squat-isometric-hold','unsupported-bodyweight-mid-range','capacity-quality','capacity','primary','Develop submaximal split-stance isometric capacity with exact side, stance, depth, torso, and quality-time tracking.',92,92,'{"sets":{"minimum":2,"target":3,"maximum":4},"holdSecondsPerSide":{"minimum":15,"target":30,"maximum":45},"restSeconds":{"minimum":75,"target":90,"maximum":150},"maximumQualitySecondsPerSide":135,"stopAtTechnicalRir":2}'::JSONB,'The athlete exits with technical reserve before depth, knee, foot, pelvis, torso, breath, or balance changes.',ARRAY['any_symptom','technical_rir_below_two','position_drift','breath_holding','unsafe_exit']::TEXT[],'Bodyweight split-stance isometric capacity with repeatable positions and side comparison.',ARRAY['none']::TEXT[]),
  ('split-squat-isometric-hold','goblet-loaded-mid-range','resilience-position','resilience','conditional','Use a modest goblet load for position-specific force only after bodyweight holds and load handling are repeatable.',74,82,'{"sets":2,"holdSecondsPerSide":{"minimum":8,"target":15,"maximum":25},"restSeconds":{"minimum":90,"target":120,"maximum":180},"loadSelection":"submaximal_with_three_seconds_or_more_technical_reserve","stopAtTechnicalRir":3}'::JSONB,'Load, depth, foot, knee, pelvis, torso, breathing, and safe set-down remain unchanged through the declared quality time.',ARRAY['any_symptom','load_or_depth_drift','knee_or_torso_change','breath_holding','unsafe_exit_or_set_down']::TEXT[],'Loaded position-specific split-stance force with strict reserve and safe handling.',ARRAY['dumbbell']::TEXT[]),
  ('split-squat-isometric-hold','goblet-loaded-mid-range','capacity-quality','capacity','primary','Build loaded split-stance isometric strength-capacity while respecting lower-body, axial, grip, and session fatigue budgets.',88,90,'{"sets":{"minimum":2,"target":3,"maximum":4},"holdSecondsPerSide":{"minimum":10,"target":20,"maximum":30},"restSeconds":{"minimum":120,"target":150,"maximum":240},"loadSelection":"quality_limited_not_failure","maximumLoadedQualitySecondsPerSide":90,"stopAtTechnicalRir":3}'::JSONB,'End before load position, depth, alignment, breathing, grip, or exit quality changes; load is never increased solely because the clock was completed.',ARRAY['any_symptom','technical_rir_below_three','load_depth_or_alignment_drift','grip_or_breath_failure','unsafe_exit_or_set_down']::TEXT[],'Submaximal loaded split-stance isometric capacity with reproducible setup and technical reserve.',ARRAY['dumbbell']::TEXT[]);

INSERT INTO coaching.exercise_delivery_profile_v1 (
  variant_id,
  profile_key,
  phase_key,
  role,
  purpose,
  phase_suitability,
  methodology_alignment,
  objective_relevance_json,
  dosage_json,
  quality_gate,
  stop_rules,
  coach_instructions,
  athlete_instructions,
  expected_adaptation,
  equipment_required,
  logistics_json,
  substitution_ids,
  status,
  time_model_json,
  dose_scaling_json,
  measurement_json,
  support_prompts_json
)
SELECT
  variant.id,
  profile.profile_key,
  profile.phase_key,
  profile.role,
  profile.purpose,
  profile.suitability,
  profile.alignment,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      '{"rotationAccess":94,"shoulderSupport":64,"strength":12,"power":3,"fatigueCost":12}'::JSONB
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      jsonb_build_object(
        'staticBalance', 94,
        'footAnkleControl', 88,
        'strength', 20,
        'power', 2,
        'fatigueCost',
          CASE WHEN profile.variant_key = 'unsupported-eyes-closed' THEN 28 ELSE 20 END
      )
    ELSE
      jsonb_build_object(
        'isometricStrength', 92,
        'positionControl', 88,
        'power', 4,
        'fatigueCost',
          CASE WHEN profile.variant_key = 'goblet-loaded-mid-range' THEN 64 ELSE 46 END
      )
  END,
  profile.dosage_json,
  profile.quality_gate,
  profile.stop_rules,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      'Confirm floor, reach clearance, contact comfort, exact base, moving side, range, and dose. Observe the support shoulder, pelvis, thorax, breath, reversal, and side symmetry; stop before compensation.'
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      'Clear fall space and place support. Declare side, footwear, surface, support, visual condition, and time. Observe foot, knee, pelvis, trunk, breath, touch-downs, and safe exit.'
    ELSE
      'Inspect surface, support, load, and exit. Declare side, stance, depth, torso, support, load, and time. Observe foot, knee, pelvis, torso, breath, depth drift, and set-down.'
  END,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      'Set your base, keep the support shoulder active, thread palm-up, then open only through the range you own. Keep your belt line quiet, breathe, and stop before the shape changes.'
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      'Find heel, big-toe base, and little-toe base. Keep the knee and hips quiet, breathe, and use support or touch down before balance becomes uncontrolled.'
    ELSE
      'Set the split stance and depth. Keep the front foot grounded, knee tracking, back knee hovering, and ribs over pelvis. Breathe and exit before position changes.'
  END,
  profile.expected_adaptation,
  profile.equipment_required,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      '{"stationFootprintMeters":{"length":2.0,"width":2.0},"athletesPerStation":1,"setupSeconds":25,"transitionSeconds":15,"trafficControlRequired":true,"optionalEquipment":["mat"],"safeExit":"return_moving_hand_then_sit_or_rise"}'::JSONB
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      jsonb_build_object(
        'stationFootprintMeters', jsonb_build_object('length', 2.0, 'width', 2.0),
        'athletesPerStation', 1,
        'setupSeconds', 20,
        'transitionSeconds', 15,
        'clearFallSpaceRequired', TRUE,
        'stableSupportImmediatelyAvailable',
          profile.variant_key <> 'unsupported-eyes-open'
          OR profile.profile_key = 'movement-control',
        'closeSupervisionRequired',
          profile.variant_key = 'unsupported-eyes-closed'
      )
    ELSE
      jsonb_build_object(
        'stationFootprintMeters', jsonb_build_object('length', 2.5, 'width', 1.8),
        'athletesPerStation', 1,
        'setupSeconds',
          CASE WHEN profile.variant_key = 'goblet-loaded-mid-range' THEN 35 ELSE 25 END,
        'transitionSeconds', 20,
        'clearExitRequired', TRUE,
        'clearLoadSetDownRequired',
          profile.variant_key = 'goblet-loaded-mid-range'
      )
  END,
  '{}'::UUID[],
  'review',
  jsonb_build_object(
    'setupSeconds',
      CASE
        WHEN profile.slug = 'split-squat-isometric-hold'
          AND profile.variant_key = 'goblet-loaded-mid-range' THEN 35
        WHEN profile.slug = 'quadruped-thread-the-needle' THEN 25
        ELSE 20
      END,
    'workDose', profile.dosage_json,
    'sideTransitionSeconds',
      CASE WHEN profile.slug = 'quadruped-thread-the-needle' THEN 8 ELSE 12 END,
    'durationFormula',
      'setup + sets * both_side_work + side_transitions + interset_rest'
  ),
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      '{"progressionOrder":["cleaner_support_and_breath","equal_side_repetitions","brief_pause","heel_sit_only_when_comfortable","slightly_more_owned_range"],"regressionOrder":["shorter_range","fewer_repetitions","standard_quadruped","side_lying_substitution"],"neverAutoScale":["pain","support_intolerance","forced_range","external_load","ballistic_speed"]}'::JSONB
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      '{"progressionOrder":["cleaner_tripod_and_posture","longer_clean_time_within_cap","less_hand_support","unsupported_eyes_open","eyes_closed_only_with_review"],"regressionOrder":["open_eyes","add_support","shorter_hold","controlled_touch_down","tandem_stance"],"neverAutoScale":["pain","dizziness","fall_risk","unstable_surface","external_load","perturbation"]}'::JSONB
    ELSE
      '{"progressionOrder":["cleaner_position_and_exit","longer_quality_time_within_cap","less_hand_support","unsupported_bodyweight","goblet_load"],"regressionOrder":["remove_load","add_support","reduce_depth","shorter_hold","wall_sit_substitution"],"neverAutoScale":["pain_or_pressure_symptom","unsafe_exit","rear_foot_elevation","perturbation","failure_holds"]}'::JSONB
  END,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      '{"record":["variant_key","side","range_marker","repetitions","tempo","quality_pass","compensation","symptoms","stop_reason"],"repStandard":"One repetition reaches under, reverses, opens through the declared range, and returns without losing support, pelvic control, or breath.","sideDifferenceThreshold":"Any material difference requires range reduction or coach review."}'::JSONB
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      '{"record":["variant_key","side","footwear","surface","support","visual_condition","target_seconds","actual_clean_seconds","touch_downs","quality_pass","symptoms","stop_reason"],"holdStandard":"Clean time ends at the first failed foot, knee, pelvis, trunk, breathing, touch-down, or safety criterion.","sideDifferenceThreshold":"A repeatable material difference requires coach review, not forced matching."}'::JSONB
    ELSE
      '{"record":["variant_key","side","stance_length","stance_width","depth_marker","torso_contract","support","external_load","target_seconds","actual_quality_seconds","quality_pass","symptoms","stop_reason"],"holdStandard":"Quality time ends at the first depth, foot, knee, pelvis, torso, breath, load, or exit failure.","sideDifferenceThreshold":"A material repeatable side difference requires coach review before progression."}'::JSONB
  END,
  CASE profile.slug
    WHEN 'quadruped-thread-the-needle' THEN
      '{"athletePrompt":"Report pain, tingling, dizziness, shoulder collapse, or a side that cannot move without pelvic rotation.","coachPrompt":"Record exact base, side, range, and dose; do not cue more range after compensation.","accessibilityPrompt":"Offer padding, shorter range, fewer repetitions, standard quadruped, or side-lying rotation."}'::JSONB
    WHEN 'single-leg-balance-hold-tripod-foot' THEN
      '{"athletePrompt":"Report pain, giving way, numbness, dizziness, or any touch-down; use support before a fall.","coachPrompt":"Record actual clean time and touch-downs; never remove support or vision solely to finish the clock.","accessibilityPrompt":"Offer stable support, eyes open, shorter holds, secure footwear, touch-down permission, or tandem stance."}'::JSONB
    ELSE
      '{"athletePrompt":"Report pain, pinching, giving way, tingling, dizziness, or pressure symptoms; exit before position changes.","coachPrompt":"Record actual quality time, depth, and load; never continue or add load solely to finish the clock.","accessibilityPrompt":"Offer support, shallower depth, shorter holds, bodyweight, or a wall-sit substitution."}'::JSONB
  END
FROM static_profile_seed profile
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = profile.slug
JOIN coaching.exercise_variant_v1 variant
  ON variant.definition_id = definition.id
 AND variant.variant_key = profile.variant_key
ON CONFLICT (variant_id, profile_key)
DO UPDATE SET
  phase_key = EXCLUDED.phase_key,
  role = EXCLUDED.role,
  purpose = EXCLUDED.purpose,
  phase_suitability = EXCLUDED.phase_suitability,
  methodology_alignment = EXCLUDED.methodology_alignment,
  objective_relevance_json = EXCLUDED.objective_relevance_json,
  dosage_json = EXCLUDED.dosage_json,
  quality_gate = EXCLUDED.quality_gate,
  stop_rules = EXCLUDED.stop_rules,
  coach_instructions = EXCLUDED.coach_instructions,
  athlete_instructions = EXCLUDED.athlete_instructions,
  expected_adaptation = EXCLUDED.expected_adaptation,
  equipment_required = EXCLUDED.equipment_required,
  logistics_json = EXCLUDED.logistics_json,
  substitution_ids = EXCLUDED.substitution_ids,
  status = 'review',
  time_model_json = EXCLUDED.time_model_json,
  dose_scaling_json = EXCLUDED.dose_scaling_json,
  measurement_json = EXCLUDED.measurement_json,
  support_prompts_json = EXCLUDED.support_prompts_json,
  updated_at = now();

UPDATE coaching.exercise_section_evidence_v1 evidence
SET review_status = 'superseded',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = evidence.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  )
  AND evidence.reviewed_card_version <> 2
  AND evidence.review_status = 'candidate';

INSERT INTO coaching.exercise_section_evidence_v1 (
  definition_id,
  reviewed_card_version,
  section_key,
  source_url,
  source_title,
  source_publisher,
  source_kind,
  claims_json,
  evidence_quality,
  review_status,
  reviewer_user_id,
  reviewed_at
)
SELECT
  definition.id,
  2,
  claim.key,
  CASE
    WHEN claim.key = 'media' THEN
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'url'
    ELSE seed.primary_source ->> 'url'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'Embed videos and playlists'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'title'
    ELSE seed.primary_source ->> 'title'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'YouTube Help'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'publisher'
    ELSE seed.primary_source ->> 'publisher'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'manufacturer_instruction'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'kind'
    ELSE seed.primary_source ->> 'kind'
  END,
  claim.value,
  CASE
    WHEN claim.key = 'media' THEN 82
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN (seed.secondary_source ->> 'quality')::SMALLINT
    ELSE (seed.primary_source ->> 'quality')::SMALLINT
  END,
  'candidate',
  NULL,
  NULL
FROM static_card_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.slug
CROSS JOIN LATERAL jsonb_each(seed.evidence_claims) claim
ON CONFLICT (
  definition_id,
  reviewed_card_version,
  section_key,
  source_url
)
DO UPDATE SET
  source_title = EXCLUDED.source_title,
  source_publisher = EXCLUDED.source_publisher,
  source_kind = EXCLUDED.source_kind,
  claims_json = EXCLUDED.claims_json,
  evidence_quality = EXCLUDED.evidence_quality,
  review_status = 'candidate',
  reviewer_user_id = NULL,
  reviewed_at = NULL,
  updated_at = now();

UPDATE coaching.exercise_media_candidate_v1 media
SET review_status = 'superseded',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = media.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  )
  AND media.reviewed_card_version <> 2
  AND media.review_status = 'candidate';

CREATE TEMP TABLE static_media_seed (
  slug TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  source_query TEXT NOT NULL,
  PRIMARY KEY (slug, video_id)
);

INSERT INTO static_media_seed VALUES
  ('quadruped-thread-the-needle','4EPsl0epycc','Quadruped Thread the Needle Thoracic Rotation','Restore Physical Therapy, LLC','quadruped thread the needle thoracic rotation'),
  ('quadruped-thread-the-needle','Cn43k8-7iik','Thoracic Quadruped Thread the Needle','Physical Therapy First','quadruped thread the needle thoracic rotation'),
  ('quadruped-thread-the-needle','Q4fKfxG33sY','Quadruped Thread The Needle','Tactical Athlete Performance & Physical Therapy','quadruped thread the needle'),
  ('quadruped-thread-the-needle','7VQU2-yFZME','Quadruped Thread the Needle','Theory of Motion Exercise Library','quadruped thread the needle'),
  ('single-leg-balance-hold-tripod-foot','cOjBPzFz32E','FOOT TRIPOD EXERCISES   OBTAIN BALANCE AND STABILITY','Jason Hughes','single leg foot tripod balance hold'),
  ('single-leg-balance-hold-tripod-foot','vKonzLCxWrg','Single Leg Balance','Ramage Performance Therapy','single leg balance foot tripod'),
  ('single-leg-balance-hold-tripod-foot','vr2yG84vnnA','How to Perform the Short Foot Exercise Progressing to Single Leg Balance | Exercise Tutorial','Dr. Karen Thomas ','short foot single leg balance'),
  ('single-leg-balance-hold-tripod-foot','XhiffPgvEJ4','Single Leg Balance in Short Foot Position','Dr. Michael Cortese - The Runner Guy','single leg balance short foot position'),
  ('split-squat-isometric-hold','9-E7YW2WAlM','Resilient Performance - Split Squat Isometric Hold','Resilient Performance Physical Therapy','split squat isometric hold'),
  ('split-squat-isometric-hold','FvrSfS9cQ9w','How To: Split Squat Iso Hold','Live Lean TV Daily Exercises','split squat iso hold'),
  ('split-squat-isometric-hold','nRCANP7XsHE','How To Do Split Squat Isometric Hold | Invictus Fitness','CrossFit Invictus','split squat isometric hold'),
  ('split-squat-isometric-hold','OgAuRVSPd5c','Split Squat Isometric Hold','Calvin Dietz','split squat isometric hold');

INSERT INTO coaching.exercise_media_candidate_v1 (
  definition_id,
  variant_id,
  reviewed_card_version,
  url,
  embed_url,
  video_id,
  title,
  channel_name,
  language_code,
  captions_available,
  embedding_allowed,
  exact_variant_match,
  demonstration_quality_score,
  link_status,
  review_status,
  discovery_method,
  source_query,
  reviewer_user_id,
  reviewed_at,
  next_review_at,
  notes
)
SELECT
  definition.id,
  NULL,
  2,
  'https://www.youtube.com/watch?v=' || media.video_id,
  'https://www.youtube-nocookie.com/embed/' || media.video_id,
  media.video_id,
  media.title,
  media.channel_name,
  'en',
  NULL,
  NULL,
  NULL,
  NULL,
  'healthy',
  'candidate',
  'manual_research',
  media.source_query,
  NULL,
  NULL,
  NULL,
  'YouTube oEmbed metadata returned successfully on 2026-07-26. Embed playback permission, the full demonstration, exact variant matching, cue and safety quality, captions, accessibility, reviewer identity, and approval remain unverified and require human review.'
FROM static_media_seed media
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = media.slug
ON CONFLICT (
  definition_id,
  reviewed_card_version,
  video_id
)
DO UPDATE SET
  url = EXCLUDED.url,
  embed_url = EXCLUDED.embed_url,
  title = EXCLUDED.title,
  channel_name = EXCLUDED.channel_name,
  language_code = EXCLUDED.language_code,
  captions_available = NULL,
  embedding_allowed = NULL,
  exact_variant_match = NULL,
  demonstration_quality_score = NULL,
  link_status = 'healthy',
  review_status = 'candidate',
  discovery_method = 'manual_research',
  source_query = EXCLUDED.source_query,
  reviewer_user_id = NULL,
  reviewed_at = NULL,
  next_review_at = NULL,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE coaching.exercise_alternate_assessment_v1 alternate
SET review_status = 'superseded',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = alternate.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  )
  AND alternate.reviewed_card_version <> 2
  AND alternate.review_status = 'candidate';

CREATE TEMP TABLE static_alternate_seed (
  slug TEXT NOT NULL,
  alternate_name TEXT NOT NULL,
  classification TEXT NOT NULL,
  rationale TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  PRIMARY KEY (slug, alternate_name)
);

INSERT INTO static_alternate_seed VALUES
  ('quadruped-thread-the-needle','Quadruped Thread-the-Needle Rotation','same_identity','The word rotation names the existing open phase and does not add an action.','{"nameOnly":true}'::JSONB),
  ('quadruped-thread-the-needle','Quadruped Thread-the-Needle Reach','same_identity','Reach names the existing under-body phase and does not add an action.','{"nameOnly":true}'::JSONB),
  ('quadruped-thread-the-needle','Heel-Sit Thread-the-Needle','new_variant','A comfortable heel-sit constrains pelvis and lumbar contribution while retaining the reach-under then open action.','{"hipPosition":"heel_sit","action":"thread_then_open"}'::JSONB),
  ('quadruped-thread-the-needle','Short-Range Thread-the-Needle','modifier_annotation','A shorter pain-free range changes dose and access but not support or action.','{"range":"shorter_owned_range"}'::JSONB),
  ('quadruped-thread-the-needle','Side-Lying Open Book','new_definition','Side-lying support and no under-body thread materially change setup and movement path.','{"supportBase":"side_lying","action":"open_rotation_without_thread"}'::JSONB),
  ('quadruped-thread-the-needle','Quadruped Hand-Behind-Head Rotation','new_definition','Hand-behind-head open-and-close rotation omits the defining palm-up thread-under path.','{"handPosition":"behind_head","action":"open_close_rotation"}'::JSONB),
  ('quadruped-thread-the-needle','Loaded or Ballistic Thread-the-Needle','new_definition','External load or ballistic intent materially changes loading, speed, failure consequence, and instruction.','{"externalLoad":true,"intent":"ballistic_or_loaded"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Single-Leg Tripod Balance','same_identity','Naming order does not change the static single-leg tripod hold.','{"nameOnly":true}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Supported Eyes-Open Tripod Hold','new_variant','Stable hand support reduces balance complexity while preserving the static tripod hold.','{"support":"stable_hand","vision":"eyes_open"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Unsupported Eyes-Open Tripod Hold','new_variant','Removing hand support raises balance complexity without changing the static action.','{"support":"none_used","vision":"eyes_open"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Unsupported Eyes-Closed Tripod Hold','new_variant','Removing visual input materially raises sensory and supervision demand while preserving the static stance action.','{"support":"available_not_used","vision":"eyes_closed","supervision":"close"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Barefoot or Shoe-On Tripod Hold','modifier_annotation','Footwear must be declared and may alter sensory input and traction, but does not itself change the exercise identity.','{"footwear":"declared"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Single-Leg Balance Reach Clock','new_definition','A reaching limb adds dynamic center-of-mass movement and directional targets.','{"action":"multidirectional_reach"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Single-Leg Balance on Unstable Surface','new_definition','An unstable surface materially changes environment, mechanics, fall risk, and supervision.','{"surface":"unstable"}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','Loaded or Perturbed Single-Leg Hold','new_definition','External load or perturbation changes loading, force predictability, and failure consequence.','{"externalLoadOrPerturbation":true}'::JSONB),
  ('split-squat-isometric-hold','Split Squat Iso Hold','same_identity','Iso is an abbreviation of isometric and adds no action.','{"nameOnly":true}'::JSONB),
  ('split-squat-isometric-hold','Supported Bodyweight Split Squat Hold','new_variant','Stable hand support lowers balance complexity while preserving the static split-squat position.','{"support":"stable_hand","load":"bodyweight"}'::JSONB),
  ('split-squat-isometric-hold','Unsupported Bodyweight Split Squat Hold','new_variant','Removing hand support raises postural demand while preserving the static split-squat position.','{"support":"none_used","load":"bodyweight"}'::JSONB),
  ('split-squat-isometric-hold','Goblet-Loaded Split Squat Hold','new_variant','A goblet load raises physical demand while preserving the static split-squat position and exact load contract.','{"support":"none_used","load":"dumbbell_goblet"}'::JSONB),
  ('split-squat-isometric-hold','Split Squat Hold Depth or Duration Change','modifier_annotation','A recorded depth, stance, torso angle, or hold-time change modifies dose without automatically adding an identity.','{"modifiers":["stance","depth","torso","hold_duration"]}'::JSONB),
  ('split-squat-isometric-hold','Rear-Foot-Elevated Split Squat Isometric','new_definition','Rear-foot elevation materially changes support, joint mechanics, balance, and load distribution.','{"rearFoot":"elevated"}'::JSONB),
  ('split-squat-isometric-hold','Dynamic Split Squat','new_definition','Repeated descent and ascent replace the static hold with dynamic joint motion and eccentric-concentric loading.','{"action":"dynamic_repetitions"}'::JSONB),
  ('split-squat-isometric-hold','Perturbed or Partner-Resisted Split Squat Hold','new_definition','External perturbation or partner force adds unpredictable or directional loading and supervision.','{"forceSource":"partner_or_perturbation"}'::JSONB);

INSERT INTO coaching.exercise_alternate_assessment_v1 (
  definition_id,
  reviewed_card_version,
  alternate_name,
  classification,
  rationale,
  distinguishing_dimensions,
  proposed_card_json,
  review_status,
  reviewer_user_id,
  reviewed_at
)
SELECT
  definition.id,
  2,
  alternate.alternate_name,
  alternate.classification,
  alternate.rationale,
  alternate.dimensions,
  CASE
    WHEN alternate.classification = 'new_definition' THEN
      jsonb_build_object(
        'status', 'proposal_only',
        'humanReviewRequired', TRUE,
        'sourceCard', alternate.slug
      )
    ELSE NULL
  END,
  'candidate',
  NULL,
  NULL
FROM static_alternate_seed alternate
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = alternate.slug
ON CONFLICT (
  definition_id,
  reviewed_card_version,
  alternate_name
)
DO UPDATE SET
  classification = EXCLUDED.classification,
  rationale = EXCLUDED.rationale,
  distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
  proposed_card_json = EXCLUDED.proposed_card_json,
  review_status = 'candidate',
  reviewer_user_id = NULL,
  reviewed_at = NULL,
  updated_at = now();

CREATE TEMP TABLE static_edge_seed (
  slug TEXT NOT NULL,
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  relationship TEXT NOT NULL,
  similarity_score SMALLINT NOT NULL,
  dimensions TEXT[] NOT NULL,
  reason TEXT NOT NULL,
  conditions_json JSONB NOT NULL,
  PRIMARY KEY (slug, from_key, to_key, relationship)
);

INSERT INTO static_edge_seed VALUES
  ('quadruped-thread-the-needle','quadruped-thread-and-open','heel-sit-thread-and-open','progression',82,ARRAY['stability','complexity','range']::TEXT[],'A comfortable heel-sit can constrain pelvic contribution and adds position demand while preserving the thread-under then open action.','{"requires":["comfortable_heel_sit","repeatable_standard_thread_and_open","pain_free_contacts"],"notAutomatic":true}'::JSONB),
  ('quadruped-thread-the-needle','heel-sit-thread-and-open','quadruped-thread-and-open','regression',94,ARRAY['stability','complexity']::TEXT[],'Returning the hips over the knees reduces hip and knee flexion constraints while preserving the defining arm path.','{"useWhen":["heel_sit_discomfort","pelvic_shift","range_or_breath_worsens"]}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','supported-eyes-open','unsupported-eyes-open','progression',90,ARRAY['stability','complexity']::TEXT[],'Removing hand support raises balance complexity while preserving the eyes-open static tripod hold.','{"requires":["repeatable_supported_hold","safe_touch_down","clear_fall_space"]}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-open','supported-eyes-open','regression',96,ARRAY['stability','complexity']::TEXT[],'Adding stable hand support preserves the tripod and posture objective while reducing balance and fall demand.','{"useWhen":["unsafe_sway","repeated_touch_down","alignment_change","fall_risk_uncertain"]}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-open','unsupported-eyes-closed','progression',74,ARRAY['stability','complexity']::TEXT[],'Removing vision adds a sensory constraint and much greater supervision demand without adding external load or movement.','{"requires":["repeatable_unsupported_eyes_open","no_current_dizziness","close_supervision","immediate_support"],"notAutomatic":true}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','unsupported-eyes-closed','unsupported-eyes-open','regression',98,ARRAY['stability','complexity']::TEXT[],'Opening the eyes restores visual input and is the first regression for sway, uncertainty, or safety concerns.','{"useWhen":["any_safety_uncertainty","sway_increases","coach_intervention","fatigue"]}'::JSONB),
  ('split-squat-isometric-hold','supported-bodyweight-mid-range','unsupported-bodyweight-mid-range','progression',90,ARRAY['stability','complexity']::TEXT[],'Removing hand support raises postural and balance demand while preserving bodyweight, stance, depth, and static action.','{"requires":["repeatable_supported_quality_time","safe_unsupported_exit"]}'::JSONB),
  ('split-squat-isometric-hold','unsupported-bodyweight-mid-range','supported-bodyweight-mid-range','regression',96,ARRAY['stability','complexity']::TEXT[],'Adding stable hand support reduces balance demand while preserving the split-stance isometric objective.','{"useWhen":["balance_limits_position","depth_or_knee_drift","exit_uncertain"]}'::JSONB),
  ('split-squat-isometric-hold','unsupported-bodyweight-mid-range','goblet-loaded-mid-range','progression',82,ARRAY['load','leverage','complexity']::TEXT[],'A goblet load raises external load, trunk and grip demand, and set-down consequence while preserving the static split-squat position.','{"requires":["repeatable_bodyweight_hold","safe_goblet_pickup_and_set_down","technical_reserve"],"notAutomatic":true}'::JSONB),
  ('split-squat-isometric-hold','goblet-loaded-mid-range','unsupported-bodyweight-mid-range','regression',98,ARRAY['load','leverage','complexity']::TEXT[],'Removing the goblet load preserves stance and depth while reducing physical demand and load-handling consequence.','{"useWhen":["load_or_depth_drift","grip_or_breath_fatigue","set_down_uncertain"]}'::JSONB);

INSERT INTO coaching.exercise_relationship_v1 (
  from_variant_id,
  to_variant_id,
  relationship,
  similarity_score,
  dimensions,
  reason,
  conditions_json,
  review_status,
  created_by,
  reviewed_by,
  reviewed_at
)
SELECT
  from_variant.id,
  to_variant.id,
  edge.relationship,
  edge.similarity_score,
  edge.dimensions,
  edge.reason,
  edge.conditions_json,
  'review',
  NULL,
  NULL,
  NULL
FROM static_edge_seed edge
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = edge.slug
JOIN coaching.exercise_variant_v1 from_variant
  ON from_variant.definition_id = definition.id
 AND from_variant.variant_key = edge.from_key
JOIN coaching.exercise_variant_v1 to_variant
  ON to_variant.definition_id = definition.id
 AND to_variant.variant_key = edge.to_key
ON CONFLICT (
  from_variant_id,
  to_variant_id,
  relationship
)
DO UPDATE SET
  similarity_score = EXCLUDED.similarity_score,
  dimensions = EXCLUDED.dimensions,
  reason = EXCLUDED.reason,
  conditions_json = EXCLUDED.conditions_json,
  review_status = 'review',
  created_by = NULL,
  reviewed_by = NULL,
  reviewed_at = NULL,
  updated_at = now();

CREATE TEMP TABLE static_substitution_seed (
  source_slug TEXT NOT NULL,
  source_variant_key TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  similarity_score SMALLINT NOT NULL,
  dimensions TEXT[] NOT NULL,
  reason TEXT NOT NULL,
  conditions_json JSONB NOT NULL,
  PRIMARY KEY (source_slug, source_variant_key, target_slug)
);

INSERT INTO static_substitution_seed VALUES
  ('quadruped-thread-the-needle','quadruped-thread-and-open','side-lying-open-book',72,ARRAY['stability','range','complexity']::TEXT[],'Side-Lying Open Book can preserve a low-load thoracic-rotation purpose when quadruped wrist, knee, or support-shoulder loading is not appropriate, but it does not reproduce the thread-under path or closed-chain support.','{"useWhen":["quadruped_support_not_appropriate","side_lying_is_comfortable"],"notEquivalentFor":["closed_chain_shoulder_support","thread_under_path"]}'::JSONB),
  ('single-leg-balance-hold-tripod-foot','supported-eyes-open','tandem-line-balance-hold',68,ARRAY['stability','leverage','complexity']::TEXT[],'Tandem stance can preserve a narrow-base static balance purpose when single-leg loading or fall demand is not appropriate, but it does not reproduce single-leg tripod loading.','{"useWhen":["single_leg_load_not_tolerated","fall_demand_requires_reduction"],"notEquivalentFor":["single_leg_loading","unilateral_hip_control"]}'::JSONB),
  ('split-squat-isometric-hold','supported-bodyweight-mid-range','wall-sit',66,ARRAY['stability','leverage','complexity']::TEXT[],'A Wall Sit can preserve a static knee-extensor capacity purpose when split stance balance is not appropriate, but it changes stance, support, hip and knee mechanics, and unilateral bias.','{"useWhen":["split_stance_balance_not_appropriate","bilateral_supported_isometric_is_acceptable"],"notEquivalentFor":["split_stance_control","front_leg_bias"]}'::JSONB);

INSERT INTO coaching.exercise_relationship_v1 (
  from_variant_id,
  to_variant_id,
  relationship,
  similarity_score,
  dimensions,
  reason,
  conditions_json,
  review_status,
  created_by,
  reviewed_by,
  reviewed_at
)
SELECT
  source_variant.id,
  target_variant.id,
  'lateral_substitution',
  substitution.similarity_score,
  substitution.dimensions,
  substitution.reason,
  substitution.conditions_json,
  'review',
  NULL,
  NULL,
  NULL
FROM static_substitution_seed substitution
JOIN coaching.exercise_definition_v1 source_definition
  ON source_definition.facility_id = 1
 AND source_definition.slug = substitution.source_slug
JOIN coaching.exercise_variant_v1 source_variant
  ON source_variant.definition_id = source_definition.id
 AND source_variant.variant_key = substitution.source_variant_key
JOIN LATERAL (
  SELECT variant.id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = substitution.target_slug
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
  ORDER BY
    CASE variant.variant_key WHEN 'baseline' THEN 1 ELSE 2 END,
    variant.variant_key
  LIMIT 1
) target_variant ON TRUE
ON CONFLICT (
  from_variant_id,
  to_variant_id,
  relationship
)
DO UPDATE SET
  similarity_score = EXCLUDED.similarity_score,
  dimensions = EXCLUDED.dimensions,
  reason = EXCLUDED.reason,
  conditions_json = EXCLUDED.conditions_json,
  review_status = 'review',
  created_by = NULL,
  reviewed_by = NULL,
  reviewed_at = NULL,
  updated_at = now();

INSERT INTO coaching.exercise_score_calibration_v1 (
  facility_id,
  variant_id,
  dimension,
  proposed_score,
  anchor_tier,
  rationale,
  status,
  version,
  created_by,
  reviewed_by,
  review_notes,
  reviewed_at
)
SELECT
  1,
  variant.id,
  calibration.dimension,
  calibration.score,
  CASE
    WHEN calibration.score < 30 THEN 20
    WHEN calibration.score < 50 THEN 40
    WHEN calibration.score < 70 THEN 60
    ELSE 80
  END,
  calibration.rationale,
  'review',
  1,
  NULL,
  NULL,
  'Independent calibration review is required; this migration does not approve the proposed exercise score.',
  NULL
FROM coaching.exercise_definition_v1 definition
JOIN coaching.exercise_variant_v1 variant
  ON variant.definition_id = definition.id
CROSS JOIN LATERAL (
  VALUES
    (
      'technicalComplexity',
      (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
      CASE definition.slug
        WHEN 'quadruped-thread-the-needle' THEN
          'Proposed from support-arm control, reach-under and reversal sequencing, pelvic constraint, owned range, tempo, and side symmetry.'
        WHEN 'single-leg-balance-hold-tripod-foot' THEN
          'Proposed from hand support, visual input, single-leg postural control, touch-down strategy, and supervision requirements.'
        ELSE
          'Proposed from split-stance setup, hand support, depth and trunk control, load handling, breathing, and safe exit.'
      END
    ),
    (
      'absoluteLoadDemand',
      (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
      CASE definition.slug
        WHEN 'quadruped-thread-the-needle' THEN
          'Proposed from bodyweight through one upper limb and both knees, moving-arm range, contact tolerance, and low local fatigue.'
        WHEN 'single-leg-balance-hold-tripod-foot' THEN
          'Proposed from single-limb bodyweight, hold duration, local foot calf and hip demand, with no external load or impact.'
        ELSE
          'Proposed from bodyweight or goblet load, front-leg bias, stance and depth, hold duration, local lower-body fatigue, and load handling.'
      END
    ),
    (
      'technicalFatigueSensitivity',
      (variant.fatigue_profile_json ->>
        'technicalFatigueSensitivity')::SMALLINT,
      CASE definition.slug
        WHEN 'quadruped-thread-the-needle' THEN
          'Proposed from support collapse, pelvic rotation, forced range, momentum, breath holding, and worsening side control.'
        WHEN 'single-leg-balance-hold-tripod-foot' THEN
          'Proposed from toe clawing, knee and pelvis drift, touch-downs, unsafe sway, uncontrolled steps, and sensory constraint.'
        ELSE
          'Proposed from depth drift, foot or knee change, torso rotation, breath holding, load drift, and unsafe exit or set-down.'
      END
    )
) calibration(dimension, score, rationale)
WHERE definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  )
  AND variant.status <> 'archived'
ON CONFLICT (
  facility_id,
  variant_id,
  dimension,
  version
)
DO UPDATE SET
  proposed_score = EXCLUDED.proposed_score,
  anchor_tier = EXCLUDED.anchor_tier,
  rationale = EXCLUDED.rationale,
  status = 'review',
  created_by = NULL,
  reviewed_by = NULL,
  review_notes = EXCLUDED.review_notes,
  reviewed_at = NULL,
  updated_at = now();

UPDATE coaching.exercise_card_test_packet_v1 packet
SET status = 'quarantined',
    blocking_issues_json = jsonb_build_array(
      jsonb_build_object(
        'code', 'media_human_review_required',
        'message',
          'Four candidate links have current YouTube oEmbed metadata but require embed-playback, full-video exact-match, cue, safety, caption, and accessibility review.'
      ),
      jsonb_build_object(
        'code', 'evidence_human_review_required',
        'message',
          'Candidate section evidence and the limits of applying related research to the exact exercise variants require human review.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Progression, regression, and conditional substitution proposals require coach approval.'
      ),
      jsonb_build_object(
        'code', 'calibration_human_review_required',
        'message',
          'Complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
      ),
      jsonb_build_object(
        'code', 'publication_approval_required',
        'message',
          'The completed candidate card remains in review and requires current two-person publication approval.'
      )
    ),
    human_review_required = TRUE,
    checked_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = packet.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'quadruped-thread-the-needle',
    'single-leg-balance-hold-tripod-foot',
    'split-squat-isometric-hold'
  );
