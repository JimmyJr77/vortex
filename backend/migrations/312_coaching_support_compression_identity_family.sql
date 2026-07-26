-- Resolve the grounded support-compression cluster into three exercise identities:
--
--   1. Seated Compression Lift: seated, dynamically lifting one or both legs
--      without suspending bodyweight through the hands. Pike, straddle, knee
--      angle, and unilateral execution are controlled variants/modifiers.
--   2. V-Sit: static straight-arm push support with the feet clearly above
--      horizontal. This changes range, balance, shoulder relationship, and
--      compression demand relative to an L-sit.
--   3. Manna: static straight-arm push support with the hips elevated and the
--      legs carried behind/above the shoulder line. This changes the principal
--      shoulder, trunk, flexibility, balance, and strength demands again.
--
-- Exercise cards contain exercise-complexity and physical-difficulty scores
-- only; overall difficulty is their maximum. Formal proficiency levels remain
-- exclusively on coaching.skill cards. This migration does not edit
-- coaching.skill.
--
-- All new content, relationships, test packets, and media remain in review or
-- quarantine. No human approval, calibration approval, or exact media
-- verification is claimed. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  compression_id UUID;
  compression_exercise_id BIGINT := 803;
  v_sit_id UUID;
  v_sit_exercise_id BIGINT;
  manna_id UUID;
  manna_exercise_id BIGINT;
  l_sit_id UUID;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  SELECT id, facility_id
  INTO compression_id, facility
  FROM coaching.exercise_definition_v1
  WHERE legacy_exercise_id = compression_exercise_id
    AND slug = 'straddle-compression-lift'
    AND status <> 'archived';

  IF compression_id IS NULL THEN
    RAISE EXCEPTION
      'Support-compression migration requires active legacy exercise 803 / straddle-compression-lift';
  END IF;

  SELECT id
  INTO l_sit_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'l-sit'
    AND status <> 'archived';

  IF l_sit_id IS NULL THEN
    RAISE EXCEPTION
      'Support-compression migration requires the active L-sit canonical definition';
  END IF;

  SELECT id
  INTO v_sit_exercise_id
  FROM coaching.exercise
  WHERE facility_id = facility
    AND slug = 'v-sit';

  SELECT id
  INTO v_sit_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'v-sit'
    AND status <> 'archived';

  IF v_sit_exercise_id IS NOT NULL AND v_sit_id IS NULL THEN
    RAISE EXCEPTION
      'Support-compression migration found a pre-existing legacy v-sit without canonical migration provenance';
  END IF;

  IF v_sit_id IS NOT NULL AND (
    v_sit_exercise_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 d
      WHERE d.id = v_sit_id
        AND d.legacy_exercise_id = v_sit_exercise_id
        AND d.provenance_json->>'identityMigration'
          = '312_coaching_support_compression_identity_family'
    )
  ) THEN
    RAISE EXCEPTION
      'Support-compression migration found a conflicting active v-sit definition';
  END IF;

  SELECT id
  INTO manna_exercise_id
  FROM coaching.exercise
  WHERE facility_id = facility
    AND slug = 'manna-hold';

  SELECT id
  INTO manna_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'manna-hold'
    AND status <> 'archived';

  IF manna_exercise_id IS NOT NULL AND manna_id IS NULL THEN
    RAISE EXCEPTION
      'Support-compression migration found a pre-existing legacy manna-hold without canonical migration provenance';
  END IF;

  IF manna_id IS NOT NULL AND (
    manna_exercise_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 d
      WHERE d.id = manna_id
        AND d.legacy_exercise_id = manna_exercise_id
        AND d.provenance_json->>'identityMigration'
          = '312_coaching_support_compression_identity_family'
    )
  ) THEN
    RAISE EXCEPTION
      'Support-compression migration found a conflicting active manna-hold definition';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = compression_id
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
      WHERE definition_id = compression_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = compression_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = compression_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = compression_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = compression_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = compression_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = compression_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 p
      JOIN coaching.exercise_variant_v1 v ON v.id = p.variant_id
      WHERE v.definition_id = compression_id
        AND p.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 r
      WHERE (
        r.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = compression_id
        )
        OR r.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = compression_id
        )
      )
        AND (
          r.review_status <> 'review'
          OR r.reviewed_by IS NOT NULL
          OR r.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1 c
      JOIN coaching.exercise_variant_v1 v ON v.id = c.variant_id
      WHERE v.definition_id = compression_id
        AND (
          c.status <> 'review'
          OR c.reviewed_by IS NOT NULL
          OR c.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Support-compression identity migration requires human review: % protected records',
      protected_records;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = compression_id
      AND legacy_exercise_id = compression_exercise_id
  ) <> 1 THEN
    RAISE EXCEPTION
      'Support-compression migration source lineage differs from legacy exercise 803';
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Seated Compression Lift',
      display_name = 'Seated Compression Lift',
      aliases = ARRAY[
        'Straddle Compression Lift',
        'Straddle Compression Lifts',
        'Seated Compression Lifts',
        'Pike Compression Lift',
        'Pike Compression Lifts',
        'Seated Pike Leg Lift',
        'Seated Straddle Leg Lift'
      ]::TEXT[],
      description = 'Sit on a stable surface with the trunk and pelvis in the declared position, place the hands where prescribed without using them to pull, and lift one or both legs from the floor through an owned pike or straddle range before lowering with control.',
      family_key = 'Grounded dynamic compression lift',
      status = 'review',
      content_confidence = 75,
      scoring_confidence = 57,
      media_confidence = 20,
      movement_patterns = ARRAY['brace']::TEXT[],
      body_regions = ARRAY[
        'core', 'rib_cage', 'spine', 'pelvis', 'hip', 'knee', 'hamstrings'
      ]::TEXT[],
      required_equipment = ARRAY['none']::TEXT[],
      optional_equipment = ARRAY[
        'mat', 'parallettes', 'parallettes_or_blocks', 'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_non_slip_and_clear_of_objects_in_the_leg_arc',
        'seat', 'stable_surface_with_space_for_the_declared_pike_or_straddle',
        'handSupport', 'hands_or_handles_cannot_slide_and_do_not_pull_the_legs_up',
        'traffic', 'no_person_or_equipment_enters_the_leg_or_hand_space',
        'supervision', 'direct_until_trunk_position_range_and_controlled_lower_are_repeatable'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_seated_pike_or_declared_straddle_position',
          'can_lift_the_selected_lever_without_leaning_or_momentum',
          'can_lower_without_dropping_or_joint_pinching',
          'can_breathe_through_short_quality_sets'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hip_groin_knee_or_low_back_pain',
          'hip_pinching_numbness_tingling_or_neural_symptoms',
          'forced_end_range_or_uncontrolled_cramping',
          'trunk_rocking_or_hand_pull_replaces_active_hip_flexion',
          'inability_to_lower_or_reset_safely'
        ),
        'clinicalBoundary', 'Pain, neurologic symptoms, recent surgery, instability, or rehabilitation restrictions require individualized clinician guidance instead of generic range or volume progression.'
      ),
      anatomy_json = jsonb_build_object(
        'jointActions', jsonb_build_array(
          'bilateral_or_unilateral_hip_flexion_concentric',
          'controlled_hip_extension_eccentric_to_the_floor',
          'knee_extension_isometric_by_variant',
          'pelvic_and_trunk_position_control',
          'hip_abduction_held_for_straddle_variant'
        ),
        'primaryMuscles', jsonb_build_array(
          'iliopsoas_and_other_hip_flexors',
          'rectus_femoris',
          'rectus_abdominis',
          'internal_and_external_obliques'
        ),
        'secondaryMuscles', jsonb_build_array(
          'deep_trunk_stabilizers',
          'quadriceps_for_extended_knees',
          'hip_abductors_and_adductors_for_straddle_control',
          'finger_wrist_and_shoulder_stabilizers_when_hands_are_planted'
        ),
        'joints', jsonb_build_array(
          'thoracic_and_lumbar_spine',
          'pelvis',
          'hip',
          'knee',
          'hand_and_wrist_when_supported'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_hip_abduction_for_straddle_variant',
          'transverse_isometric_control'
        ),
        'laterality', 'bilateral_baseline_with_declared_unilateral_alternating_variant'
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters', 'Builds active hip-flexion compression and trunk control without requiring the athlete to suspend bodyweight through the arms.',
        'primaryCue', 'Sit tall enough to own the position, press the floor lightly, lift from the hips, and lower quietly.',
        'expectedSensations', jsonb_build_array(
          'front_of_hip_and_quadriceps_effort',
          'abdominal_and_trunk_control_effort',
          'hamstring_stretch_tension_without_sharp_pain',
          'adductor_effort_in_the_straddle_variant'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_or_increasing_pain',
          'hip_or_groin_pinching',
          'numbness_or_tingling',
          'low_back_pain',
          'uncontrolled_cramping',
          'dizziness_or_breathing_distress'
        ),
        'painGuidance', 'Stop instead of forcing range or using momentum through pain, pinching, neurologic symptoms, or uncontrolled cramping. A coach can change the lever or exercise; persistent or concerning symptoms need clinician guidance.',
        'selfChecks', jsonb_build_array(
          'the_surface_and_hand_contact_are_stable',
          'the_declared_knee_angle_and_leg_position_remain_unchanged',
          'the_trunk_does_not_rock_to_create_the_lift',
          'each_leg_lifts_and_lowers_through_an_owned_range',
          'breathing_and_reset_remain_controlled'
        ),
        'accessibility', jsonb_build_object(
          'range', jsonb_build_array('smaller_lift_height', 'comfortable_pike_or_straddle_width'),
          'lever', jsonb_build_array('bent_knee', 'single_leg_alternating'),
          'support', jsonb_build_array('hands_farther_back', 'stable_blocks_or_handles'),
          'dose', jsonb_build_array('fewer_reps', 'longer_rest'),
          'communication', jsonb_build_array('plain_language', 'visual_floor_markers', 'coach_demonstration')
        ),
        'mediaAlternatives', jsonb_build_object(
          'written', 'Setup, lift, quiet lower, quality gate, and stop rules in plain language.',
          'visual', 'Front and side still images with the selected knee angle and hand position.',
          'live', 'Coach demonstration and a low-range rehearsal before the prescribed set.'
        )
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'surface_hand_position_and_leg_clearance',
          'trunk_and_pelvis_before_the_first_rep',
          'declared_knee_angle_and_pike_or_straddle_position',
          'leg_height_without_rocking_or_hand_pull',
          'controlled_lower_symmetry_breathing_and_reset'
        ),
        'faultCorrections', jsonb_build_object(
          'trunk_rocks_back', 'Shorten the lever, reduce range, or move the hands to a stable support position.',
          'knees_bend_unintentionally', 'Use the declared bent-knee variant or lower the range instead of hiding the lever change.',
          'hip_or_groin_pinches', 'Stop and substitute; do not force a wider straddle or higher lift.',
          'legs_drop', 'Reduce rep count or height and require a quiet controlled lower.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'show_the_selected_variant_from_front_and_side',
          'show_hand_position_and_the_exact_owned_range',
          'contrast_active_lift_with_trunk_rocking',
          'show_the_first_quality_failure_and_stop',
          'show_the_controlled_reset'
        ),
        'groupManagement', jsonb_build_array(
          'one_athlete_per_marked_floor_station',
          'keep_leg_arcs_from_overlapping',
          'preselect_variant_and_floor_markers',
          'use_short_sets_and_staggered_starts_for_observation'
        ),
        'modificationDecisionTree', jsonb_build_object(
          'symptoms', 'Stop and triage; do not solve pain by forcing a smaller painful range.',
          'cannot_lift_without_rocking', 'Use bent-knee or single-leg, reduce height, or substitute.',
          'range_is_clean_but_low', 'Keep the range and accumulate clean repetitions before increasing height.',
          'quality_is_repeatable_with_reserve', 'Progress one dimension after recovery is confirmed.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'the_floor_or_hand_support_can_slide',
          'seated_pike_or_straddle_position_is_painful',
          'hip_pinching_or_neural_symptoms_are_present',
          'fatigue_requires_momentum_or_an_undeclared_lever_change'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_selection',
          'equipment_or_environment',
          'technique_or_quality_gate',
          'dose_or_recovery',
          'accessibility_or_media',
          'pain_or_medical',
          'incident_or_emergency'
        ),
        'supportEscalation', jsonb_build_object(
          'coach', 'Variant, range, technique, dose, sequencing, fatigue, and substitution.',
          'contentReviewer', 'Identity, anatomy, evidence, difficulty calibration, media exact match, captions, accessibility, and approval.',
          'clinician', 'Persistent pain, neurologic symptoms, instability, post-operative restrictions, or rehabilitation decisions.',
          'emergency', 'Acute injury, loss of consciousness, chest pain, severe breathing difficulty, or other urgent symptoms.'
        ),
        'retentionPolicy', 'Retain card version, selected variant, range, dose, quality result, stop reason, symptom response, substitution, reviewer decisions, and media verification timestamps under the canonical audit policy.',
        'changeImpactPolicy', 'Identity, difficulty, safety, stop-rule, approved-media, or graph changes require card-version and workout revalidation. Dose-only changes require profile and duration revalidation.'
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration', '312_coaching_support_compression_identity_family',
        'legacySlugRetained', 'straddle-compression-lift',
        'identityResolution', 'straddle_is_variant_of_grounded_dynamic_compression_lift',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'canonicalAuditRequired', TRUE,
        'operationalSupportReviewRequired', TRUE
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      updated_at = now()
  WHERE id = compression_id;

  IF v_sit_exercise_id IS NULL THEN
    INSERT INTO coaching.exercise (
      facility_id,
      name,
      slug,
      description,
      instructions,
      skill_level,
      default_sets,
      default_work_seconds,
      default_rest_seconds,
      est_seconds_per_set,
      is_published,
      visibility,
      archived,
      card_summary,
      coach_language,
      athlete_language,
      programming_logic,
      why_publish_ready,
      scalable_variables,
      movement_family,
      primary_phase_key,
      phase_subrole,
      primary_order_slot,
      movement_requirements,
      coaching_execution,
      pairing_logic,
      media_library,
      participant_structure,
      programming_kind
    )
    VALUES (
      facility,
      'V-Sit',
      'v-sit',
      'From a stable straight-arm push support, lift and hold both extended legs clearly above horizontal while maintaining active shoulders, trunk and pelvic control, breathing, and a safe exit.',
      'Check the support and clearance. Establish straight elbows and active shoulders, lift the declared V position without momentum, hold only while the shape and breathing remain controlled, then exit safely.',
      NULL,
      3,
      5,
      150,
      18,
      FALSE,
      'facility',
      FALSE,
      'Review-only high compression support hold; distinct from L-sit and Manna.',
      'Score exercise complexity and physical demand only. Protect hands, wrists, elbows, shoulders, hamstring range, breathing, and exit.',
      'Push down, lift into your V, breathe, and come down before the position changes.',
      jsonb_build_object(
        'publicationQuarantined', TRUE,
        'humanReviewRequired', TRUE,
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only'
      ),
      FALSE,
      ARRAY[
        'leg_position', 'straddle_or_together', 'hold_seconds', 'sets',
        'rest_seconds', 'assistance', 'support_height', 'implement'
      ]::TEXT[],
      'High straight-arm support compression hold',
      'capacity',
      'tissue_capacity_isometric_eccentric_accessory',
      'main_strength',
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'legHeight', 'clearly_above_horizontal',
        'clearance', 'full_leg_and_safe_exit_space'
      ),
      jsonb_build_object(
        'qualityGate', 'Stable support, straight elbows, active shoulders, declared V position, controlled breathing, and safe exit.',
        'stopRules', jsonb_build_array(
          'pain_or_neurologic_symptoms',
          'support_or_hand_slip',
          'elbow_or_shoulder_collapse',
          'feet_fall_below_declared_height',
          'uncontrolled_breath_holding',
          'unsafe_exit'
        )
      ),
      jsonb_build_object(
        'avoidWith', jsonb_build_array(
          'support_failure', 'exhaustive_pressing', 'high_volume_compression'
        )
      ),
      jsonb_build_object('candidateOnly', TRUE, 'approvedMedia', FALSE),
      'individual',
      'exercise'
    )
    RETURNING id INTO v_sit_exercise_id;
  END IF;

  IF manna_exercise_id IS NULL THEN
    INSERT INTO coaching.exercise (
      facility_id,
      name,
      slug,
      description,
      instructions,
      skill_level,
      default_sets,
      default_work_seconds,
      default_rest_seconds,
      est_seconds_per_set,
      is_published,
      visibility,
      archived,
      card_summary,
      coach_language,
      athlete_language,
      programming_logic,
      why_publish_ready,
      scalable_variables,
      movement_family,
      primary_phase_key,
      phase_subrole,
      primary_order_slot,
      movement_requirements,
      coaching_execution,
      pairing_logic,
      media_library,
      participant_structure,
      programming_kind
    )
    VALUES (
      facility,
      'Manna Hold',
      'manna-hold',
      'From a stable straight-arm push support, elevate the hips and carry the extended legs beyond the shoulder line into the declared Manna position while maintaining hand, elbow, shoulder, trunk, breathing, and exit control.',
      'Use qualified direct supervision and a stable support. Enter only through a cleared progression or declared assistance, hold with reserve, and exit before the shoulders, elbows, legs, breathing, or support position change.',
      NULL,
      3,
      3,
      180,
      18,
      FALSE,
      'facility',
      FALSE,
      'Review-only extreme straight-arm support compression hold; separate from V-sit.',
      'Treat this as a high-demand exercise. Score the exercise, not the athlete. Require qualified supervision, progression, safe support, and exit.',
      'Push down, lift your hips and legs only into the position you own, keep breathing, and exit early.',
      jsonb_build_object(
        'publicationQuarantined', TRUE,
        'humanReviewRequired', TRUE,
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only'
      ),
      FALSE,
      ARRAY[
        'hold_seconds', 'sets', 'rest_seconds', 'assistance',
        'support_height', 'entry', 'exit'
      ]::TEXT[],
      'Extreme straight-arm support compression hold',
      'capacity',
      'tissue_capacity_isometric_eccentric_accessory',
      'main_strength',
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'hipHeight', 'near_or_above_shoulder_line',
        'legPosition', 'beyond_shoulder_line',
        'supervision', 'qualified_direct'
      ),
      jsonb_build_object(
        'qualityGate', 'Stable support, straight elbows, owned shoulder position, declared hip and leg line, controlled breathing, and planned exit.',
        'stopRules', jsonb_build_array(
          'pain_or_neurologic_symptoms',
          'support_or_hand_slip',
          'elbow_or_shoulder_position_loss',
          'hip_or_leg_position_loss',
          'uncontrolled_breath_holding',
          'assistance_or_exit_becomes_unsafe'
        )
      ),
      jsonb_build_object(
        'avoidWith', jsonb_build_array(
          'support_failure', 'shoulder_fatigue', 'exhaustive_pressing',
          'high_volume_compression', 'unsupervised_high_consequence_skill'
        )
      ),
      jsonb_build_object('candidateOnly', TRUE, 'approvedMedia', FALSE),
      'individual',
      'exercise'
    )
    RETURNING id INTO manna_exercise_id;
  END IF;

  IF v_sit_id IS NULL THEN
    INSERT INTO coaching.exercise_definition_v1 (
      facility_id,
      legacy_exercise_id,
      slug,
      canonical_name,
      display_name,
      aliases,
      description,
      family_key,
      status,
      content_confidence,
      scoring_confidence,
      media_confidence,
      movement_patterns,
      body_regions,
      required_equipment,
      optional_equipment,
      environment_json,
      population_json,
      provenance_json,
      anatomy_json,
      athlete_support_json,
      coach_support_json,
      support_operations_json
    )
    VALUES (
      facility,
      v_sit_exercise_id,
      'v-sit',
      'V-Sit',
      'V-Sit',
      ARRAY['V Sit', 'V-Sit Hold', 'V Sit Hold', 'Support V-Sit']::TEXT[],
      'From a stable straight-arm push support on the floor, parallettes, dip bars, parallel bars, or rings, hold both extended legs clearly above horizontal while maintaining active shoulders, trunk and pelvic control, breathing, and a safe exit.',
      'High straight-arm support compression hold',
      'review',
      74,
      56,
      20,
      ARRAY['push', 'brace']::TEXT[],
      ARRAY[
        'hand', 'wrist', 'elbow', 'shoulder', 'scapula', 'rib_cage',
        'core', 'spine', 'pelvis', 'hip', 'knee', 'hamstrings', 'full_body'
      ]::TEXT[],
      ARRAY['none']::TEXT[],
      ARRAY[
        'parallettes', 'parallel_bars', 'box', 'rings', 'mat', 'timer'
      ]::TEXT[],
      jsonb_build_object(
        'support', 'stable_non_slip_and_checked_before_use',
        'clearance', 'full_leg_arc_and_safe_exit_space',
        'surface', 'level_non_slip_with_a_planned_step_or_sit_down',
        'rings', 'rated_matched_height_and_still_before_mount',
        'traffic', 'no_cross_traffic_in_the_support_or_exit_space',
        'supervision', 'direct_until_entry_hold_and_exit_are_repeatable'
      ),
      jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_straight_arm_support',
          'repeatable_full_l_sit_with_reserve',
          'owned_active_pike_or_straddle_compression_range',
          'controlled_entry_breathing_and_exit'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hand_wrist_elbow_shoulder_hip_hamstring_or_low_back_pain',
          'numbness_tingling_dizziness_or_instability',
          'painful_hip_pinching_or_forced_hamstring_range',
          'elbow_or_shoulder_collapse',
          'unsafe_support_entry_or_exit'
        ),
        'clinicalBoundary', 'Symptoms, recent surgery, instability, neurologic signs, or rehabilitation restrictions require individualized clinician guidance.'
      ),
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'source_id', v_sit_exercise_id,
        'identityMigration', '312_coaching_support_compression_identity_family',
        'identityBoundary', 'feet_clearly_above_horizontal_changes_range_balance_and_shoulder_relationship_from_l_sit',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'canonicalAuditRequired', TRUE,
        'operationalSupportReviewRequired', TRUE
      ),
      jsonb_build_object(
        'jointActions', jsonb_build_array(
          'finger_and_wrist_support_isometric',
          'elbow_extension_isometric',
          'scapular_depression_and_protraction_control',
          'shoulder_extension_relative_to_trunk_isometric',
          'high_range_bilateral_hip_flexion_isometric',
          'pelvic_and_trunk_position_control',
          'knee_extension_isometric'
        ),
        'primaryMuscles', jsonb_build_array(
          'iliopsoas_and_other_hip_flexors',
          'rectus_abdominis',
          'internal_and_external_obliques',
          'triceps_brachii',
          'serratus_anterior',
          'latissimus_dorsi_and_scapular_depressors',
          'quadriceps'
        ),
        'secondaryMuscles', jsonb_build_array(
          'finger_and_wrist_flexors_and_extensors',
          'rotator_cuff',
          'pectoral_and_anterior_shoulder_stabilizers',
          'deep_trunk_stabilizers',
          'hip_abductors_for_straddle_variant'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist', 'elbow',
          'glenohumeral_and_scapulothoracic_complex',
          'thoracic_and_lumbar_spine', 'pelvis', 'hip', 'knee'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_and_transverse_isometric_control',
          'frontal_hip_abduction_for_straddle_variant'
        ),
        'laterality', 'bilateral_symmetric'
      ),
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO v_sit_id;

    INSERT INTO coaching.exercise_definition_source_v1 (
      definition_id,
      legacy_exercise_id,
      source_kind,
      provenance_json
    )
    VALUES (
      v_sit_id,
      v_sit_exercise_id,
      'legacy_migration',
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'created_by_migration', '312_coaching_support_compression_identity_family',
        'publicationQuarantined', TRUE
      )
    );
  END IF;

  IF manna_id IS NULL THEN
    INSERT INTO coaching.exercise_definition_v1 (
      facility_id,
      legacy_exercise_id,
      slug,
      canonical_name,
      display_name,
      aliases,
      description,
      family_key,
      status,
      content_confidence,
      scoring_confidence,
      media_confidence,
      movement_patterns,
      body_regions,
      required_equipment,
      optional_equipment,
      environment_json,
      population_json,
      provenance_json,
      anatomy_json,
      athlete_support_json,
      coach_support_json,
      support_operations_json
    )
    VALUES (
      facility,
      manna_exercise_id,
      'manna-hold',
      'Manna Hold',
      'Manna Hold',
      ARRAY['Manna', 'Manna Support Hold', 'Gymnastics Manna']::TEXT[],
      'From a stable straight-arm push support, elevate the hips toward or above the shoulder line and carry the extended legs beyond the shoulder line into the declared Manna position while maintaining hand, elbow, shoulder, trunk, breathing, assistance, and exit control.',
      'Extreme straight-arm support compression hold',
      'review',
      72,
      52,
      20,
      ARRAY['push', 'brace']::TEXT[],
      ARRAY[
        'hand', 'wrist', 'elbow', 'shoulder', 'scapula', 'rib_cage',
        'core', 'spine', 'pelvis', 'hip', 'knee', 'hamstrings', 'full_body'
      ]::TEXT[],
      ARRAY['parallettes_or_blocks']::TEXT[],
      ARRAY[
        'parallel_bars', 'box', 'mat', 'timer'
      ]::TEXT[],
      jsonb_build_object(
        'support', 'stable_rated_non_slip_and_checked_before_use',
        'clearance', 'full_leg_arc_assistance_and_exit_space',
        'surface', 'level_non_slip_with_protective_matting_as_needed',
        'assistance', 'qualified_spot_and_hand_positions_agreed_before_entry',
        'traffic', 'station_isolated_from_cross_traffic',
        'supervision', 'qualified_direct_supervision_for_every_attempt'
      ),
      jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_straight_arm_support',
          'repeatable_v_sit_with_visible_reserve',
          'owned_shoulder_extension_and_high_compression_progressions',
          'qualified_spotter_and_planned_entry_exit',
          'no_prior_support_or_compression_fatigue'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hand_wrist_elbow_shoulder_hip_hamstring_or_spine_pain',
          'numbness_tingling_dizziness_or_instability',
          'forced_shoulder_extension_or_hip_range',
          'elbow_bend_or_uncontrolled_shoulder_translation',
          'missing_qualified_supervision_or_safe_exit'
        ),
        'clinicalBoundary', 'Symptoms, recent surgery, instability, neurologic signs, or rehabilitation restrictions require individualized clinician guidance; this card is not rehabilitation instruction.'
      ),
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'source_id', manna_exercise_id,
        'identityMigration', '312_coaching_support_compression_identity_family',
        'identityBoundary', 'hip_and_leg_position_beyond_v_sit_materially_changes_shoulder_trunk_flexibility_and_balance_demands',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'canonicalAuditRequired', TRUE,
        'operationalSupportReviewRequired', TRUE
      ),
      jsonb_build_object(
        'jointActions', jsonb_build_array(
          'finger_and_wrist_support_isometric',
          'elbow_extension_isometric',
          'large_range_shoulder_extension_relative_to_trunk_isometric',
          'scapular_depression_protraction_and_posterior_support_control',
          'extreme_bilateral_hip_flexion_isometric',
          'pelvic_and_trunk_position_control',
          'knee_extension_isometric'
        ),
        'primaryMuscles', jsonb_build_array(
          'triceps_brachii',
          'posterior_deltoid_and_shoulders_extensors',
          'latissimus_dorsi_and_scapular_depressors',
          'serratus_anterior_and_scapular_stabilizers',
          'iliopsoas_and_other_hip_flexors',
          'rectus_abdominis_and_obliques',
          'quadriceps'
        ),
        'secondaryMuscles', jsonb_build_array(
          'finger_and_wrist_flexors_and_extensors',
          'rotator_cuff',
          'deep_trunk_and_spinal_stabilizers',
          'pectoral_and_upper_back_stabilizers'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist', 'elbow',
          'glenohumeral_and_scapulothoracic_complex',
          'thoracic_and_lumbar_spine', 'pelvis', 'hip', 'knee'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_and_transverse_isometric_control'
        ),
        'laterality', 'bilateral_symmetric'
      ),
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO manna_id;

    INSERT INTO coaching.exercise_definition_source_v1 (
      definition_id,
      legacy_exercise_id,
      source_kind,
      provenance_json
    )
    VALUES (
      manna_id,
      manna_exercise_id,
      'legacy_migration',
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'created_by_migration', '312_coaching_support_compression_identity_family',
        'publicationQuarantined', TRUE
      )
    );
  END IF;

  UPDATE coaching.exercise_definition_v1 d
  SET athlete_support_json = jsonb_build_object(
        'whyItMatters', CASE
          WHEN d.id = v_sit_id
            THEN 'Builds high-range compression and straight-arm support capacity while teaching the athlete to control the changed shoulder, trunk, leg-height, breathing, and exit demands above an L-sit.'
          ELSE 'Builds extreme straight-arm support, shoulder-extension, high-compression, and whole-body positional capacity for the declared Manna hold under qualified supervision.'
        END,
        'primaryCue', CASE
          WHEN d.id = v_sit_id
            THEN 'Push down, keep your elbows long, lift both feet clearly above horizontal, breathe, and exit early.'
          ELSE 'Push down, keep the support and shoulders owned, lift hips and legs only through the cleared path, breathe, and exit early.'
        END,
        'expectedSensations', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_array(
            'strong_front_of_hips_abdominals_and_quadriceps_effort',
            'triceps_and_shoulder_support_effort',
            'strong_but_non_painful_hamstring_stretch_tension'
          )
          ELSE jsonb_build_array(
            'very_high_triceps_shoulder_and_upper_back_support_effort',
            'very_high_front_of_hips_abdominals_and_quadriceps_effort',
            'strong_but_non_painful_shoulder_and_hamstring_range_demand'
          )
        END,
        'unexpectedSensations', jsonb_build_array(
          'sharp_or_increasing_pain',
          'shoulder_or_hip_pinching',
          'numbness_or_tingling',
          'joint_instability',
          'uncontrolled_cramping',
          'dizziness_or_breathing_distress'
        ),
        'painGuidance', 'Stop rather than forcing range, changing the shape, or relying on assistance through pain, pinching, neurologic symptoms, instability, or breathing distress. A coach can substitute; persistent or concerning symptoms require clinician guidance.',
        'selfChecks', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_array(
            'support_is_stable_and_exit_is_clear',
            'elbows_stay_straight_and_shoulders_do_not_sink',
            'both_feet_remain_clearly_above_horizontal',
            'declared_together_or_straddle_shape_is_repeatable',
            'breathing_and_exit_remain_controlled'
          )
          ELSE jsonb_build_array(
            'qualified_supervision_support_assistance_and_exit_are_ready',
            'elbows_remain_straight_and_shoulders_follow_the_cleared_path',
            'hips_and_legs_reach_only_the_declared_owned_position',
            'breathing_continues_without_forcing',
            'the_spotter_and_athlete_can_exit_immediately'
          )
        END,
        'accessibility', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_object(
            'range', jsonb_build_array('lower_owned_v_angle', 'straddle_if_individually_appropriate'),
            'support', jsonb_build_array('stable_higher_parallettes', 'neutral_grip_handles'),
            'dose', jsonb_build_array('shorter_holds', 'more_rest'),
            'substitution', jsonb_build_array('l_sit', 'seated_compression_lift'),
            'communication', jsonb_build_array('plain_language', 'visual_height_marker', 'coach_demonstration')
          )
          ELSE jsonb_build_object(
            'range', jsonb_build_array('v_sit_substitution', 'cleared_partial_progression_only'),
            'support', jsonb_build_array('stable_high_parallettes_or_blocks', 'qualified_assistance'),
            'dose', jsonb_build_array('very_short_holds', 'full_recovery'),
            'substitution', jsonb_build_array('v_sit', 'l_sit', 'seated_compression_lift'),
            'communication', jsonb_build_array('plain_language', 'entry_exit_rehearsal', 'coach_demonstration')
          )
        END,
        'mediaAlternatives', jsonb_build_object(
          'written', 'Exact setup, entry, declared position, quality gate, stop rules, and exit in plain language.',
          'visual', 'Front and side still images with leg-height and shoulder-position markers.',
          'live', 'Qualified coach demonstration plus the selected lower-demand rehearsal.'
        )
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_array(
            'support_stability_height_clearance_and_exit',
            'hand_position_elbow_extension_and_shoulder_height',
            'pelvis_trunk_knee_angle_and_leg_height',
            'together_or_straddle_symmetry',
            'breathing_hold_time_and_controlled_exit'
          )
          ELSE jsonb_build_array(
            'qualified_supervision_support_matting_assistance_and_exit',
            'hand_position_elbow_extension_and_shoulder_path',
            'hip_height_trunk_position_and_leg_line',
            'spotter_contact_and_athlete_control',
            'breathing_hold_time_and_immediate_exit_readiness'
          )
        END,
        'faultCorrections', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_object(
            'feet_drop', 'Return to the L-sit or a lower declared V angle; do not count a failed height as V-sit.',
            'elbows_or_shoulders_change', 'End the set, increase rest, or substitute instead of forcing the position.',
            'hamstring_or_hip_range_forces_shape_loss', 'Use an individually appropriate straddle or seated compression substitute.'
          )
          ELSE jsonb_build_object(
            'shoulders_or_elbows_leave_cleared_path', 'Spot the exit and regress to V-sit or a coach-cleared preparatory drill.',
            'hips_or_legs_stall', 'Do not pull the athlete farther; exit and reassess the progression.',
            'assistance_increases', 'End the attempt; assistance is a declared modifier, not permission to force position.'
          )
        END,
        'demonstrationPlan', jsonb_build_array(
          'show_equipment_assistance_and_exit_check',
          'show_the_exact_selected_position_from_front_and_side',
          'show_the_quality_gate_and_first_stop_signal',
          'show_the_controlled_entry_and_exit',
          'contrast_the_nearest_lower_identity_without_rehearsing_a_risky_failure'
        ),
        'groupManagement', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_array(
            'one_athlete_per_stable_support_station',
            'match_support_height_before_the_block',
            'keep_entry_and_exit_space_clear',
            'use_staggered_attempts_for_direct_observation'
          )
          ELSE jsonb_build_array(
            'one_athlete_one_qualified_spotter_per_isolated_station',
            'preassign_support_assistance_and_exit_roles',
            'do_not_run_unsupervised_group_repetitions',
            'cap_attempts_and_stop_after_any_failed_quality_gate'
          )
        END,
        'modificationDecisionTree', jsonb_build_object(
          'symptoms', 'Stop and triage; do not solve symptoms with more assistance.',
          'equipment_supervision_or_exit_not_ready', 'Do not prescribe; change the station or exercise.',
          'quality_fails_before_minimum_time', 'Use the next lower identity, reduce the declared range, or substitute.',
          'quality_passes_with_reserve', 'Keep the dose or progress one reviewed dimension after recovery is confirmed.'
        ),
        'doNotUseWhen', CASE
          WHEN d.id = v_sit_id THEN jsonb_build_array(
            'support_or_clearance_is_unsafe',
            'full_l_sit_and_active_compression_prerequisites_are_not_repeatable',
            'hand_wrist_elbow_shoulder_hip_or_hamstring_position_is_painful',
            'fatigue_removes_leg_height_breathing_or_exit_reserve'
          )
          ELSE jsonb_build_array(
            'qualified_direct_supervision_is_unavailable',
            'support_assistance_matting_or_exit_is_not_prepared',
            'repeatable_v_sit_and_shoulder_range_prerequisites_are_absent',
            'any_prior_support_shoulder_or_compression_fatigue_is_present'
          )
        END
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_selection',
          'equipment_or_environment',
          'supervision_or_assistance',
          'technique_or_quality_gate',
          'dose_or_recovery',
          'accessibility_or_media',
          'pain_or_medical',
          'incident_or_emergency'
        ),
        'supportEscalation', jsonb_build_object(
          'coach', 'Prerequisites, equipment, assistance, entry, exit, technique, dose, fatigue, sequencing, and substitution.',
          'contentReviewer', 'Identity, taxonomy, anatomy, evidence, difficulty calibration, media exact match, captions, accessibility, and approval.',
          'clinician', 'Persistent pain, neurologic symptoms, instability, post-operative restrictions, or rehabilitation decisions.',
          'emergency', 'Fall, acute injury, loss of consciousness, chest pain, severe breathing difficulty, or other urgent symptoms.'
        ),
        'retentionPolicy', 'Retain card version, selected variant, equipment, assistance, dose, quality result, stop reason, symptom response, substitution, reviewer decisions, and media verification timestamps under the canonical audit policy.',
        'changeImpactPolicy', 'Identity, difficulty, safety, supervision, stop-rule, approved-media, or graph changes require card-version and workout revalidation. Dose-only changes require profile and duration revalidation.'
      ),
      status = 'review',
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      updated_at = now()
  WHERE d.id IN (v_sit_id, manna_id);

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json,
    status
  )
  VALUES
    (
      compression_id,
      'bent-knee',
      'Bent-Knee Seated Compression Lift',
      ARRAY['seated', 'bent_knees', 'bilateral', 'short_lever', 'dynamic']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 24, 'absoluteLoadDemand', 30,
        'coordinationDemand', 28, 'supervisionDemand', 22,
        'failureConsequence', 18, 'impact', 1, 'workCapacityDemand', 34,
        'baseOverallDifficulty', 30
      ),
      jsonb_build_object(
        'supportAction', 'seated_grounded',
        'kneeAngle', 'flexed',
        'legPosition', 'pike_together',
        'laterality', 'bilateral',
        'contractionMode', 'dynamic_lift_and_controlled_lower'
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_short_lever_hip_flexion',
        'gripDemand', 5, 'spinalLoading', 22, 'eccentricStress', 28,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'short_lever_hip_flexion', 'trunk_and_pelvic_control',
          'controlled_leg_lower'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 38, 'gripFatigue', 5,
        'technicalFatigueSensitivity', 42, 'impactAccumulation', 1,
        'recoveryHours', 18,
        'qualityLoss', jsonb_build_array(
          'trunk_rocks', 'knees_drift', 'feet_drop',
          'range_shortens', 'breathing_changes'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 24, 'physicalDifficulty', 30,
        'overallDifficulty', 30,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'short_lever_active_hip_flexion', 'trunk_control',
          'controlled_lowering'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 6, 'typicalTotalReps', 20,
          'maximumUsefulReps', 40
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 18
        ),
        'prerequisites', jsonb_build_array(
          'pain_free_seated_position', 'controlled_single_repetition'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_all_reps_without_rocking',
          'preserve_declared_knee_angle',
          'lower_quietly_and_breathe',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'comfortable_pike_rehearsal'),
          'preferredBefore', jsonb_build_array('high_volume_hip_flexion', 'support_compression_holds'),
          'avoidAfter', jsonb_build_array('hip_flexor_cramping', 'exhaustive_trunk_work')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('upper_body_pull', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('lower_body_strength_with_low_hip_flexor_overlap'),
          'incompatible', jsonb_build_array('high_volume_hip_flexion', 'near_failure_support_compression')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'hip_flexor_or_trunk_fatigue', 'action', 'reduce_dose_or_substitute'),
          jsonb_build_object('stimulus', 'range_requires_rocking', 'action', 'shorten_lever_or_range'),
          jsonb_build_object('stimulus', 'pain_or_neural_symptoms', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when seated tolerance, lever, range, symmetry, fatigue state, or symptom response is unknown.'
      ),
      'review'
    ),
    (
      compression_id,
      'single-leg-pike',
      'Single-Leg Pike Compression Lift',
      ARRAY['seated', 'straight_knee', 'pike', 'unilateral_alternating', 'dynamic']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 30, 'absoluteLoadDemand', 36,
        'coordinationDemand', 34, 'supervisionDemand', 24,
        'failureConsequence', 18, 'impact', 1, 'workCapacityDemand', 40,
        'baseOverallDifficulty', 36
      ),
      jsonb_build_object(
        'supportAction', 'seated_grounded',
        'kneeAngle', 'extended',
        'legPosition', 'pike_together',
        'laterality', 'unilateral_alternating',
        'contractionMode', 'dynamic_lift_and_controlled_lower'
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_single_long_lever_hip_flexion',
        'gripDemand', 5, 'spinalLoading', 24, 'eccentricStress', 32,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'single_leg_long_lever_hip_flexion',
          'trunk_anti_rotation', 'knee_extension_isometric',
          'controlled_leg_lower'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 44, 'gripFatigue', 5,
        'technicalFatigueSensitivity', 50, 'impactAccumulation', 1,
        'recoveryHours', 20,
        'qualityLoss', jsonb_build_array(
          'side_to_side_rock', 'knee_bends', 'leg_drops',
          'range_becomes_asymmetric', 'breathing_changes'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 30, 'physicalDifficulty', 36,
        'overallDifficulty', 36,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'unilateral_active_hip_flexion', 'anti_rotation_control',
          'knee_extension_and_controlled_lowering'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveRepsPerSide', 4, 'typicalTotalRepsPerSide', 12,
          'maximumUsefulRepsPerSide', 24
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 20
        ),
        'prerequisites', jsonb_build_array(
          'pain_free_seated_pike', 'straight_knee_range',
          'both_sides_can_be_trained_symmetrically'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_equal_clean_reps_each_side',
          'preserve_trunk_and_knee_position',
          'lower_quietly_and_breathe',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'bent_knee_compression_rehearsal'),
          'preferredBefore', jsonb_build_array('bilateral_long_lever_compression', 'support_compression_holds'),
          'avoidAfter', jsonb_build_array('hip_flexor_cramping', 'exhaustive_trunk_work')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('upper_body_pull', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('lower_body_strength_with_low_hip_flexor_overlap'),
          'incompatible', jsonb_build_array('high_volume_hip_flexion', 'near_failure_support_compression')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'side_to_side_asymmetry', 'action', 'reduce_range_and_match_sides'),
          jsonb_build_object('stimulus', 'hip_flexor_or_trunk_fatigue', 'action', 'reduce_dose_or_substitute'),
          jsonb_build_object('stimulus', 'pain_or_neural_symptoms', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when both sides cannot be trained symmetrically or the selected range causes rocking, pain, or uncontrolled lowering.'
      ),
      'review'
    ),
    (
      compression_id,
      'pike',
      'Pike Seated Compression Lift',
      ARRAY['seated', 'straight_knees', 'pike', 'bilateral', 'dynamic']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 36, 'absoluteLoadDemand', 46,
        'coordinationDemand', 40, 'supervisionDemand', 26,
        'failureConsequence', 20, 'impact', 1, 'workCapacityDemand', 48,
        'baseOverallDifficulty', 46
      ),
      jsonb_build_object(
        'supportAction', 'seated_grounded',
        'kneeAngle', 'extended',
        'legPosition', 'pike_together',
        'laterality', 'bilateral',
        'contractionMode', 'dynamic_lift_and_controlled_lower'
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_bilateral_long_lever_hip_flexion',
        'gripDemand', 6, 'spinalLoading', 28, 'eccentricStress', 36,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'bilateral_long_lever_hip_flexion',
          'trunk_and_pelvic_control', 'knee_extension_isometric',
          'controlled_leg_lower'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 52, 'gripFatigue', 6,
        'technicalFatigueSensitivity', 58, 'impactAccumulation', 1,
        'recoveryHours', 24,
        'qualityLoss', jsonb_build_array(
          'trunk_rocks', 'knees_bend', 'legs_drop',
          'range_shortens', 'breathing_changes'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 36, 'physicalDifficulty', 46,
        'overallDifficulty', 46,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'bilateral_active_pike_compression', 'trunk_control',
          'knee_extension_and_controlled_lowering'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 4, 'typicalTotalReps', 16,
          'maximumUsefulReps', 30
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 24
        ),
        'prerequisites', jsonb_build_array(
          'pain_free_seated_pike', 'straight_knee_range',
          'repeatable_single_leg_lifts_each_side'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_all_reps_without_rocking',
          'preserve_both_knees_and_leg_symmetry',
          'lower_quietly_and_breathe',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'single_leg_compression_rehearsal'),
          'preferredBefore', jsonb_build_array('support_compression_holds', 'high_volume_hip_flexion'),
          'avoidAfter', jsonb_build_array('hip_flexor_cramping', 'exhaustive_trunk_work')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('upper_body_pull', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('lower_body_strength_with_low_hip_flexor_overlap'),
          'incompatible', jsonb_build_array('high_volume_hip_flexion', 'near_failure_l_sit_or_v_sit')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'hip_flexor_or_trunk_fatigue', 'action', 'reduce_dose_or_substitute'),
          jsonb_build_object('stimulus', 'range_requires_knee_bend_or_rocking', 'action', 'use_single_leg_or_bent_knee'),
          jsonb_build_object('stimulus', 'pain_or_neural_symptoms', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when bilateral range, knee extension, trunk control, fatigue state, or symptom response is unknown.'
      ),
      'review'
    ),
    (
      compression_id,
      'baseline',
      'Straddle Seated Compression Lift',
      ARRAY['seated', 'straight_knees', 'straddle', 'bilateral', 'dynamic']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 40, 'absoluteLoadDemand', 46,
        'coordinationDemand', 44, 'supervisionDemand', 28,
        'failureConsequence', 22, 'impact', 1, 'workCapacityDemand', 48,
        'baseOverallDifficulty', 46
      ),
      jsonb_build_object(
        'supportAction', 'seated_grounded',
        'kneeAngle', 'extended',
        'legPosition', 'straddle',
        'laterality', 'bilateral_symmetric',
        'hipAbductionRange', 'declared_owned_range',
        'contractionMode', 'dynamic_lift_and_controlled_lower'
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_bilateral_straddle_hip_flexion',
        'gripDemand', 6, 'spinalLoading', 28, 'eccentricStress', 36,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'bilateral_straddle_hip_flexion',
          'hip_abduction_and_adductor_control',
          'trunk_and_pelvic_control',
          'knee_extension_and_controlled_leg_lower'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 52, 'gripFatigue', 6,
        'technicalFatigueSensitivity', 62, 'impactAccumulation', 1,
        'recoveryHours', 24,
        'qualityLoss', jsonb_build_array(
          'straddle_becomes_asymmetric', 'trunk_rocks', 'knees_bend',
          'legs_drop', 'breathing_changes'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 40, 'physicalDifficulty', 46,
        'overallDifficulty', 46,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'bilateral_active_straddle_compression',
          'hip_abduction_and_adductor_control',
          'trunk_control', 'controlled_lowering'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 4, 'typicalTotalReps', 16,
          'maximumUsefulReps', 30
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 24
        ),
        'prerequisites', jsonb_build_array(
          'pain_free_owned_straddle', 'straight_knee_range',
          'repeatable_single_leg_or_pike_compression'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_all_reps_without_rocking',
          'preserve_straddle_symmetry_and_knee_position',
          'lower_quietly_and_breathe',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'comfortable_straddle_rehearsal'),
          'preferredBefore', jsonb_build_array('support_compression_holds', 'high_volume_hip_flexion'),
          'avoidAfter', jsonb_build_array('hip_flexor_or_adductor_cramping', 'exhaustive_trunk_work')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('upper_body_pull', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('lower_body_strength_with_low_adductor_overlap'),
          'incompatible', jsonb_build_array('high_volume_hip_flexion', 'high_volume_adductor_work', 'near_failure_support_compression')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'hip_flexor_adductor_or_trunk_fatigue', 'action', 'reduce_dose_or_use_pike_variant'),
          jsonb_build_object('stimulus', 'range_requires_asymmetry_or_rocking', 'action', 'narrow_straddle_or_reduce_range'),
          jsonb_build_object('stimulus', 'pain_or_neural_symptoms', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when straddle tolerance, symmetry, knee extension, trunk control, fatigue state, or symptom response is unknown.'
      ),
      'review'
    ),
    (
      v_sit_id,
      'baseline',
      'V-Sit',
      ARRAY['straight_knees', 'legs_together', 'above_horizontal', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 72, 'absoluteLoadDemand', 80,
        'coordinationDemand', 74, 'supervisionDemand', 68,
        'failureConsequence', 58, 'impact', 1, 'workCapacityDemand', 78,
        'baseOverallDifficulty', 80
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'extended',
        'legPosition', 'together_above_horizontal',
        'laterality', 'bilateral',
        'minimumIdentityHeight', 'feet_clearly_above_horizontal',
        'safeEntryAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_high_compression_support',
        'gripDemand', 38, 'spinalLoading', 42, 'eccentricStress', 14,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support', 'scapular_and_shoulder_support',
          'high_range_hip_flexion_isometric', 'trunk_and_pelvic_control',
          'knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 82, 'gripFatigue', 38,
        'technicalFatigueSensitivity', 84, 'impactAccumulation', 1,
        'recoveryHours', 48,
        'qualityLoss', jsonb_build_array(
          'feet_fall_to_or_below_horizontal', 'elbows_bend',
          'shoulders_sink_or_shift', 'knees_bend',
          'breathing_or_exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 72, 'physicalDifficulty', 80,
        'overallDifficulty', 80,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'high_range_compression_strength',
          'straight_arm_support_strength',
          'trunk_pelvic_and_balance_control'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveSeconds', 3, 'typicalTotalSeconds', 18,
          'maximumUsefulSeconds', 36
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 48
        ),
        'prerequisites', jsonb_build_array(
          'stable_support_and_safe_exit', 'pain_free_straight_arm_support',
          'repeatable_full_l_sit_with_reserve', 'owned_high_active_compression_range'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_declared_clean_hold_time',
          'keep_feet_clearly_above_horizontal',
          'preserve_support_breathing_and_exit',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'wrist_shoulder_and_compression_preparation', 'l_sit_rehearsal'),
          'preferredBefore', jsonb_build_array('fatiguing_pressing', 'high_volume_compression'),
          'avoidAfter', jsonb_build_array('support_failure', 'hip_flexor_cramping', 'exhaustive_pressing')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('lower_body_strength_with_low_hip_flexor_overlap', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('non_competing_technical_work'),
          'incompatible', jsonb_build_array('high_volume_pressing', 'high_volume_hip_flexion', 'near_failure_ring_support')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'support_or_compression_fatigue', 'action', 'reduce_dose_or_use_l_sit'),
          jsonb_build_object('stimulus', 'feet_cannot_clear_horizontal', 'action', 'classify_as_l_sit_or_substitute'),
          jsonb_build_object('stimulus', 'pain_or_unsafe_exit', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when support, active compression range, exact leg height, fatigue state, supervision, or safe exit is unknown.'
      ),
      'review'
    ),
    (
      v_sit_id,
      'straddle',
      'Straddle V-Sit',
      ARRAY['straight_knees', 'straddle', 'above_horizontal', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 76, 'absoluteLoadDemand', 78,
        'coordinationDemand', 78, 'supervisionDemand', 68,
        'failureConsequence', 58, 'impact', 1, 'workCapacityDemand', 78,
        'baseOverallDifficulty', 78
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'extended',
        'legPosition', 'straddle_above_horizontal',
        'laterality', 'bilateral_symmetric',
        'hipAbductionRange', 'declared_owned_range',
        'minimumIdentityHeight', 'feet_clearly_above_horizontal',
        'safeEntryAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_high_straddle_compression_support',
        'gripDemand', 38, 'spinalLoading', 42, 'eccentricStress', 14,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support', 'high_range_straddle_hip_flexion',
          'hip_abduction_and_adductor_control',
          'trunk_pelvic_and_knee_extension_control'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 80, 'gripFatigue', 38,
        'technicalFatigueSensitivity', 86, 'impactAccumulation', 1,
        'recoveryHours', 48,
        'qualityLoss', jsonb_build_array(
          'feet_fall_to_or_below_horizontal',
          'straddle_becomes_asymmetric', 'knees_bend',
          'elbows_or_shoulders_change', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 76, 'physicalDifficulty', 78,
        'overallDifficulty', 78,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'high_range_straddle_compression',
          'straight_arm_support_strength',
          'hip_abduction_adductor_and_balance_control'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveSeconds', 3, 'typicalTotalSeconds', 18,
          'maximumUsefulSeconds', 36
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 48
        ),
        'prerequisites', jsonb_build_array(
          'stable_support_and_safe_exit', 'pain_free_owned_straddle',
          'repeatable_v_height_with_symmetric_knees_and_legs'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_declared_clean_hold_time',
          'keep_both_feet_clearly_above_horizontal',
          'preserve_straddle_symmetry_support_breathing_and_exit',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'wrist_shoulder_and_straddle_compression_preparation'),
          'preferredBefore', jsonb_build_array('fatiguing_pressing', 'high_volume_adductor_or_compression_work'),
          'avoidAfter', jsonb_build_array('support_failure', 'hip_flexor_or_adductor_cramping', 'exhaustive_pressing')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('lower_body_strength_with_low_adductor_overlap', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('non_competing_technical_work'),
          'incompatible', jsonb_build_array('high_volume_pressing', 'high_volume_hip_flexion_or_adductor_work')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'support_compression_or_adductor_fatigue', 'action', 'reduce_dose_or_use_l_sit'),
          jsonb_build_object('stimulus', 'asymmetry_or_height_loss', 'action', 'narrow_straddle_or_use_together_variant'),
          jsonb_build_object('stimulus', 'pain_or_unsafe_exit', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when straddle tolerance, symmetry, height, support, fatigue state, supervision, or safe exit is unknown.'
      ),
      'review'
    ),
    (
      v_sit_id,
      'ring-support',
      'Ring-Support V-Sit',
      ARRAY['straight_knees', 'legs_together', 'above_horizontal', 'unstable_ring_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 82, 'absoluteLoadDemand', 88,
        'coordinationDemand', 86, 'supervisionDemand', 84,
        'failureConsequence', 78, 'impact', 1, 'workCapacityDemand', 86,
        'baseOverallDifficulty', 88
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_ring_support',
        'kneeAngle', 'extended',
        'legPosition', 'together_above_horizontal',
        'laterality', 'bilateral',
        'ringStability', 'still_and_controlled',
        'safeMountAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_high_compression_unstable_ring_support',
        'gripDemand', 64, 'spinalLoading', 44, 'eccentricStress', 18,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'ring_grip_and_stability', 'straight_arm_support',
          'scapular_and_rotator_cuff_stabilization',
          'high_range_hip_flexion_and_trunk_control'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 90, 'gripFatigue', 64,
        'technicalFatigueSensitivity', 94, 'impactAccumulation', 1,
        'recoveryHours', 60,
        'qualityLoss', jsonb_build_array(
          'rings_drift_or_shake', 'elbows_bend', 'shoulders_sink',
          'feet_drop', 'mount_or_exit_becomes_unsafe'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 82, 'physicalDifficulty', 88,
        'overallDifficulty', 88,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'unstable_high_compression_support',
          'ring_stability_and_grip',
          'high_range_hip_flexion_and_trunk_control'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveSeconds', 2, 'typicalTotalSeconds', 12,
          'maximumUsefulSeconds', 24
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 1, 'maximum', 2, 'minimumRecoveryHours', 60
        ),
        'prerequisites', jsonb_build_array(
          'stable_ring_support_with_safe_mount_and_exit',
          'repeatable_floor_or_bar_v_sit_with_reserve',
          'qualified_direct_supervision'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_declared_clean_hold_time',
          'keep_rings_and_feet_in_declared_positions',
          'preserve_breathing_mount_and_exit',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'ring_support_and_compression_preparation'),
          'preferredBefore', jsonb_build_array('fatiguing_ring_or_pressing_work'),
          'avoidAfter', jsonb_build_array('grip_or_support_failure', 'ring_instability', 'exhaustive_pressing')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('lower_body_strength_with_low_hip_flexor_overlap', 'low_demand_mobility'),
          'acceptable', jsonb_build_array('non_competing_technical_work'),
          'incompatible', jsonb_build_array('high_volume_ring_support', 'max_effort_grip', 'high_volume_pressing_or_compression')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'ring_grip_or_support_fatigue', 'action', 'use_stable_support_or_stop'),
          jsonb_build_object('stimulus', 'height_or_stability_loss', 'action', 'use_baseline_v_sit_or_l_sit'),
          jsonb_build_object('stimulus', 'pain_or_unsafe_mount_exit', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when ring setup, grip, stable support, exact height, direct supervision, fatigue state, or safe mount and exit is unknown.'
      ),
      'review'
    ),
    (
      manna_id,
      'baseline',
      'Manna Hold',
      ARRAY['straight_knees', 'legs_together', 'hips_elevated', 'legs_beyond_shoulders', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 88, 'absoluteLoadDemand', 94,
        'coordinationDemand', 90, 'supervisionDemand', 92,
        'failureConsequence', 84, 'impact', 1, 'workCapacityDemand', 92,
        'baseOverallDifficulty', 94
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'extended',
        'hipPosition', 'near_or_above_shoulder_line',
        'legPosition', 'beyond_shoulder_line',
        'laterality', 'bilateral',
        'qualifiedDirectSupervisionRequired', TRUE,
        'safeEntryAssistanceAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_extreme_compression_and_shoulder_extension_support',
        'gripDemand', 46, 'spinalLoading', 52, 'eccentricStress', 20,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support', 'large_range_shoulder_extension_support',
          'scapular_and_triceps_support',
          'extreme_hip_flexion_and_trunk_control',
          'knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 94, 'gripFatigue', 46,
        'technicalFatigueSensitivity', 98, 'impactAccumulation', 1,
        'recoveryHours', 72,
        'qualityLoss', jsonb_build_array(
          'elbows_bend', 'shoulder_path_changes',
          'hips_or_legs_fall_from_declared_position',
          'assistance_increases', 'breathing_or_exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 88, 'physicalDifficulty', 94,
        'overallDifficulty', 94,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'extreme_straight_arm_support_strength',
          'large_range_shoulder_extension_capacity',
          'extreme_high_compression_strength',
          'whole_body_positional_control'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveSeconds', 1, 'typicalTotalSeconds', 8,
          'maximumUsefulSeconds', 18
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 1, 'maximum', 2, 'minimumRecoveryHours', 72
        ),
        'prerequisites', jsonb_build_array(
          'qualified_direct_supervision_and_safe_station',
          'repeatable_v_sit_with_visible_reserve',
          'owned_shoulder_extension_and_high_compression_progressions',
          'planned_entry_assistance_and_exit',
          'no_competing_fatigue'
        ),
        'completionCriteria', jsonb_build_array(
          'complete_declared_clean_hold_time',
          'preserve_elbow_shoulder_hip_leg_and_assistance_standard',
          'breathe_and_exit_immediately_on_command',
          'no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array('general_warm_up', 'wrist_shoulder_and_compression_preparation', 'v_sit_rehearsal'),
          'preferredBefore', jsonb_build_array('all_fatiguing_pressing_support_or_compression_work'),
          'avoidAfter', jsonb_build_array('any_support_grip_shoulder_or_compression_fatigue')
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array('low_demand_non_competing_mobility_after_full_recovery'),
          'acceptable', jsonb_build_array('none_during_the_same_station'),
          'incompatible', jsonb_build_array('high_volume_pressing', 'ring_support', 'max_effort_grip', 'high_volume_hip_flexion', 'high_consequence_skill')
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object('stimulus', 'any_support_shoulder_or_compression_fatigue', 'action', 'do_not_attempt'),
          jsonb_build_object('stimulus', 'position_or_assistance_exceeds_declared_standard', 'action', 'exit_and_use_v_sit'),
          jsonb_build_object('stimulus', 'pain_instability_or_unsafe_exit', 'action', 'stop_and_triage')
        ),
        'uncertaintyPolicy', 'Exclude when prerequisite performance, shoulder range, exact position, support, assistance, direct supervision, fatigue state, or exit plan is unknown.'
      ),
      'review'
    )
  ON CONFLICT (definition_id, variant_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      modifier_keys = EXCLUDED.modifier_keys,
      difficulty_json = EXCLUDED.difficulty_json,
      requirements_json = EXCLUDED.requirements_json,
      load_profile_json = EXCLUDED.load_profile_json,
      fatigue_profile_json = EXCLUDED.fatigue_profile_json,
      programming_profile_json = EXCLUDED.programming_profile_json,
      status = 'review',
      updated_at = now();

  UPDATE coaching.exercise_delivery_profile_v1 p
  SET profile_key = 'movement-intelligence-compression-lift',
      updated_at = now()
  FROM coaching.exercise_variant_v1 v
  WHERE p.variant_id = v.id
    AND v.definition_id = compression_id
    AND v.variant_key = 'baseline'
    AND p.profile_key = 'legacy-movement_intelligence';

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
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    status
  )
  SELECT
    v.id,
    CASE
      WHEN d.id = compression_id THEN 'movement-intelligence-compression-lift'
      WHEN d.id = v_sit_id THEN 'capacity-v-sit-hold'
      ELSE 'capacity-manna-hold'
    END,
    CASE
      WHEN d.id = compression_id THEN 'movement_intelligence'
      ELSE 'capacity'
    END,
    CASE
      WHEN v.variant_key IN ('baseline', 'bent-knee', 'pike') THEN 'primary'
      ELSE 'conditional'
    END,
    CASE
      WHEN d.id = compression_id
        THEN 'Dynamic seated hip-flexion compression through the declared pike or straddle range while preserving knee angle, trunk and pelvic position, breathing, and a controlled lower.'
      WHEN d.id = v_sit_id
        THEN 'Static straight-arm support with the declared V position clearly above horizontal while preserving support, shoulder, trunk, breathing, and exit quality.'
      ELSE 'Extremely high-demand static straight-arm support with the declared Manna position, qualified direct supervision, planned assistance, full recovery, and immediate exit readiness.'
    END,
    CASE
      WHEN d.id = compression_id THEN 84
      WHEN d.id = v_sit_id AND v.variant_key = 'ring-support' THEN 66
      WHEN d.id = v_sit_id THEN 78
      ELSE 58
    END,
    CASE
      WHEN d.id = compression_id THEN 82
      WHEN d.id = v_sit_id THEN 76
      ELSE 62
    END,
    CASE
      WHEN d.id = compression_id THEN jsonb_build_object(
        'movementControl', 90, 'activeMobility', 84,
        'relativeStrength', 68, 'conditioning', 12
      )
      WHEN d.id = v_sit_id THEN jsonb_build_object(
        'relativeStrength', 94, 'trunkControl', 92,
        'activeMobility', 88, 'conditioning', 8
      )
      ELSE jsonb_build_object(
        'relativeStrength', 98, 'trunkControl', 96,
        'activeMobility', 94, 'conditioning', 4
      )
    END,
    CASE
      WHEN d.id = compression_id THEN jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'reps', CASE
          WHEN v.variant_key = 'bent-knee' THEN jsonb_build_array(6, 12)
          ELSE jsonb_build_array(4, 8)
        END,
        'tempo', 'controlled_lift_one_second_pause_two_second_lower',
        'restSeconds', jsonb_build_array(45, 90),
        'rpeCeiling', 7,
        'qualityReserveReps', 2
      )
      WHEN d.id = v_sit_id THEN jsonb_build_object(
        'sets', jsonb_build_array(2, 5),
        'workSeconds', CASE
          WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(2, 6)
          ELSE jsonb_build_array(3, 10)
        END,
        'restSeconds', CASE
          WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(180, 300)
          ELSE jsonb_build_array(120, 240)
        END,
        'rpeCeiling', 8,
        'qualityReserveSeconds', 2,
        'holdStandard', 'feet_clearly_above_horizontal'
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'workSeconds', jsonb_build_array(1, 5),
        'restSeconds', jsonb_build_array(180, 360),
        'rpeCeiling', 8,
        'qualityReserveSeconds', 2,
        'holdStandard', 'declared_hip_leg_shoulder_assistance_and_exit_standard',
        'attemptCap', 4
      )
    END,
    CASE
      WHEN d.id = compression_id
        THEN 'The declared knee angle and pike or straddle position remain unchanged; the trunk does not rock; each leg clears and returns quietly through the owned range; breathing continues; and the next repetition would match the first.'
      WHEN d.id = v_sit_id
        THEN 'Support is stable; elbows remain straight; shoulders follow the declared position; both feet remain clearly above horizontal; breathing continues; and the athlete exits under control.'
      ELSE 'Qualified supervision, support, assistance, and exit are ready; elbows remain straight; shoulder, hip, and leg positions match the declared standard; breathing continues; and the athlete can exit immediately.'
    END,
    CASE
      WHEN d.id = compression_id THEN ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'The surface or hand support moves, or the leg arc is obstructed.',
        'The trunk rocks, the declared knee angle changes, or range becomes asymmetric.',
        'The legs drop instead of lowering under control.',
        'The next repetition would require momentum, a shorter undeclared lever, or breath holding.'
      ]::TEXT[]
      WHEN d.id = v_sit_id THEN ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'The support moves, the hands slip, or the exit is no longer clear.',
        'Elbows bend or shoulders sink or shift outside the declared position.',
        'Either foot falls to or below horizontal, the knees bend, or symmetry is lost.',
        'The next hold would start without support, compression, breathing, or exit reserve.'
      ]::TEXT[]
      ELSE ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'Qualified supervision, support, assistance, matting, or exit is no longer ready.',
        'Elbows bend or the shoulder path leaves the cleared position.',
        'Hip or leg position falls below the declared standard, or assistance increases.',
        'Breathing changes, communication stops, or an immediate controlled exit is uncertain.'
      ]::TEXT[]
    END,
    CASE
      WHEN d.id = compression_id
        THEN 'Set the exact lever, pike or straddle position, hand placement, and range before the set. End at the first persistent trunk, knee, symmetry, range, lowering, breathing, or symptom change.'
      WHEN d.id = v_sit_id
        THEN 'Check the support, clearance, selected leg position, height standard, and exit. End at the first persistent support, elbow, shoulder, leg-height, knee, breathing, or exit change.'
      ELSE 'Use qualified direct supervision. Agree on support, assistance, entry, declared position, communication, and exit before every attempt. Do not pull the athlete into range or continue after any quality loss.'
    END,
    CASE
      WHEN d.id = compression_id
        THEN 'Sit in the selected position, lift from the hips without rocking, lower quietly, breathe, and stop before the shape changes.'
      WHEN d.id = v_sit_id
        THEN 'Push down, keep your elbows long, lift both feet clearly above horizontal, breathe, and exit early.'
      ELSE 'Follow the coach and spotter, push down, lift only through the cleared path, keep breathing, and exit immediately when asked.'
    END,
    CASE
      WHEN d.id = compression_id
        THEN 'Improved active pike or straddle hip-flexion compression, trunk and pelvic control, knee-extension ownership, and controlled lowering.'
      WHEN d.id = v_sit_id
        THEN 'Improved high-range compression, straight-arm support, trunk and pelvic control, balance, breathing, and repeatable V-position quality.'
      ELSE 'Improved extreme straight-arm support, shoulder-extension, high-compression, whole-body positional control, and supervised entry-exit quality.'
    END,
    CASE
      WHEN d.id = compression_id THEN ARRAY['none']::TEXT[]
      WHEN d.id = v_sit_id AND v.variant_key = 'ring-support'
        THEN ARRAY['rings']::TEXT[]
      WHEN d.id = v_sit_id THEN ARRAY['parallettes_or_dip_bars_optional']::TEXT[]
      ELSE ARRAY['parallettes_or_blocks']::TEXT[]
    END,
    jsonb_build_object(
      'station', CASE
        WHEN d.id = compression_id THEN 'one_athlete_per_marked_floor_station'
        WHEN d.id = v_sit_id THEN 'one_athlete_per_stable_support_station'
        ELSE 'one_athlete_and_one_qualified_spotter_per_isolated_station'
      END,
      'setupSeconds', CASE
        WHEN d.id = compression_id THEN 15
        WHEN d.id = v_sit_id THEN 25
        ELSE 60
      END,
      'transitionSeconds', CASE WHEN d.id = manna_id THEN 60 ELSE 20 END,
      'safeExitRequired', TRUE,
      'directSupervisionRequired', d.id IN (v_sit_id, manna_id)
    ),
    CASE
      WHEN d.id = compression_id THEN jsonb_build_object(
        'setupSeconds', 15,
        'workSecondsPerSet', jsonb_build_array(15, 40),
        'transitionSeconds', 20,
        'restSeconds', jsonb_build_array(45, 90),
        'durationFormula', 'setup_plus_sets_times_work_plus_rest_plus_transitions'
      )
      WHEN d.id = v_sit_id THEN jsonb_build_object(
        'setupSeconds', 25,
        'workSeconds', CASE
          WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(2, 6)
          ELSE jsonb_build_array(3, 10)
        END,
        'transitionSeconds', 30,
        'restSeconds', CASE
          WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(180, 300)
          ELSE jsonb_build_array(120, 240)
        END,
        'durationFormula', 'setup_plus_sets_times_hold_plus_rest_plus_transitions'
      )
      ELSE jsonb_build_object(
        'setupSeconds', 60,
        'workSeconds', jsonb_build_array(1, 5),
        'transitionSeconds', 60,
        'restSeconds', jsonb_build_array(180, 360),
        'durationFormula', 'setup_and_spot_brief_plus_attempts_times_hold_plus_full_rest'
      )
    END,
    CASE
      WHEN d.id = compression_id THEN jsonb_build_object(
        'regress', jsonb_build_array(
          'reduce_range', 'bend_knees', 'use_single_leg',
          'narrow_straddle', 'reduce_reps', 'increase_rest'
        ),
        'progress', jsonb_build_array(
          'increase_clean_range', 'increase_clean_reps_within_cap',
          'use_longer_bilateral_lever', 'progress_to_support_hold_only_after_readiness_review'
        ),
        'doNotScaleBy', jsonb_build_array('catalog_proficiency_label', 'class_name')
      )
      WHEN d.id = v_sit_id THEN jsonb_build_object(
        'regress', jsonb_build_array(
          'use_l_sit', 'reduce_declared_v_angle', 'reduce_hold_time',
          'increase_rest', 'use_stable_support', 'use_seated_compression_lift'
        ),
        'progress', jsonb_build_array(
          'increase_clean_hold_time_within_cap',
          'increase_owned_leg_height', 'ring_support_only_after_separate_readiness_review',
          'manna_only_after_separate_identity_review'
        ),
        'doNotScaleBy', jsonb_build_array('catalog_proficiency_label', 'class_name')
      )
      ELSE jsonb_build_object(
        'regress', jsonb_build_array(
          'use_v_sit', 'use_coach_cleared_partial_progression',
          'reduce_hold_time', 'increase_rest', 'end_attempts'
        ),
        'progress', jsonb_build_array(
          'improve_repeatability_within_same_declared_position',
          'reduce_assistance_only_after_coach_review',
          'do_not_add_load_or_fatigue'
        ),
        'doNotScaleBy', jsonb_build_array('catalog_proficiency_label', 'class_name')
      )
    END,
    jsonb_build_object(
      'record', CASE
        WHEN d.id = compression_id THEN jsonb_build_array(
          'variant', 'pike_or_straddle_angle', 'knee_angle',
          'hand_position', 'rep_range', 'sets', 'reps', 'tempo',
          'first_quality_loss', 'symptom_and_next_day_response'
        )
        WHEN d.id = v_sit_id THEN jsonb_build_array(
          'variant', 'implement', 'support_height', 'leg_position',
          'minimum_leg_height', 'hold_seconds', 'sets', 'rest',
          'first_quality_loss', 'symptom_and_next_day_response'
        )
        ELSE jsonb_build_array(
          'support', 'assistance', 'entry', 'declared_position',
          'hold_seconds', 'attempts', 'rest', 'spotter',
          'first_quality_loss', 'exit', 'symptom_and_next_day_response'
        )
      END
    ),
    jsonb_build_object(
      'athlete', CASE
        WHEN d.id = compression_id
          THEN 'Could you lift and lower through the declared range without rocking, pain, or changing the knee angle?'
        WHEN d.id = v_sit_id
          THEN 'Could you keep both feet clearly above horizontal while breathing and exit safely?'
        ELSE 'Did the position, assistance, breathing, communication, and exit remain exactly as planned?'
      END,
      'coach', CASE
        WHEN d.id = compression_id
          THEN 'Did range, trunk position, knee angle, symmetry, lowering, or symptoms limit the set first?'
        WHEN d.id = v_sit_id
          THEN 'Did support, shoulders, leg height, knee position, breathing, or exit limit the hold first?'
        ELSE 'Did support, shoulder path, hip or leg position, assistance, breathing, communication, or exit limit the attempt first?'
      END,
      'support', 'Record the limiting factor and substitution without converting exercise difficulty into a proficiency label.'
    ),
    'review'
  FROM coaching.exercise_variant_v1 v
  JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
  WHERE d.id IN (compression_id, v_sit_id, manna_id)
    AND v.status = 'review'
  ON CONFLICT (variant_id, profile_key) DO UPDATE
  SET phase_key = EXCLUDED.phase_key,
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
      time_model_json = EXCLUDED.time_model_json,
      dose_scaling_json = EXCLUDED.dose_scaling_json,
      measurement_json = EXCLUDED.measurement_json,
      support_prompts_json = EXCLUDED.support_prompts_json,
      status = 'review',
      updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status
  )
  SELECT
    source_variant.id,
    target_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions_json,
    'review'
  FROM (
    VALUES
      (
        compression_id, 'bent-knee', compression_id, 'single-leg-pike',
        'progression', 86, ARRAY['leverage', 'complexity']::TEXT[],
        'One straight leg lengthens the lever while preserving a seated dynamic compression lift and allows symmetric side-by-side exposure.',
        jsonb_build_object('requires', jsonb_build_array('clean_bent_knee_reps', 'both_sides_tolerated'))
      ),
      (
        compression_id, 'single-leg-pike', compression_id, 'pike',
        'progression', 91, ARRAY['leverage', 'complexity', 'fatigue']::TEXT[],
        'Lifting both straight legs increases bilateral lever and fatigue demand while preserving the grounded pike compression identity.',
        jsonb_build_object('requires', jsonb_build_array('equal_clean_reps_each_side', 'bilateral_range_owned'))
      ),
      (
        compression_id, 'pike', compression_id, 'baseline',
        'lateral_substitution', 82, ARRAY['range', 'complexity']::TEXT[],
        'Straddle changes frontal-plane hip position, range, and adductor control while preserving the seated dynamic compression action.',
        jsonb_build_object('requires', jsonb_build_array('pain_free_owned_straddle', 'symmetric_leg_lift'))
      ),
      (
        compression_id, 'pike', l_sit_id, 'tuck',
        'progression', 66, ARRAY['stability', 'leverage', 'complexity']::TEXT[],
        'A tuck L-sit adds straight-arm bodyweight support to compression; it is a distinct exercise identity and requires separate wrist, elbow, shoulder, and exit readiness.',
        jsonb_build_object('requires', jsonb_build_array('clean_seated_compression', 'pain_free_straight_arm_support', 'safe_exit'))
      ),
      (
        l_sit_id, 'baseline', v_sit_id, 'baseline',
        'progression', 78, ARRAY['range', 'leverage', 'complexity', 'fatigue']::TEXT[],
        'Raising both extended legs clearly above horizontal changes range, balance, shoulder relationship, and compression demand enough to enter the separate V-sit identity.',
        jsonb_build_object('requires', jsonb_build_array('full_l_sit_with_reserve', 'active_high_compression_range', 'direct_supervision'))
      ),
      (
        v_sit_id, 'baseline', v_sit_id, 'straddle',
        'lateral_substitution', 80, ARRAY['range', 'complexity']::TEXT[],
        'Straddle changes hip-abduction range and symmetry while preserving the above-horizontal straight-arm support identity.',
        jsonb_build_object('requires', jsonb_build_array('pain_free_owned_straddle', 'symmetric_v_height'))
      ),
      (
        v_sit_id, 'baseline', v_sit_id, 'ring-support',
        'progression', 74, ARRAY['stability', 'complexity', 'fatigue']::TEXT[],
        'Rings preserve the V-sit position but materially increase grip, stability, supervision, mount, and exit demands.',
        jsonb_build_object('requires', jsonb_build_array('stable_ring_support', 'baseline_v_sit_with_reserve', 'qualified_direct_supervision'))
      ),
      (
        v_sit_id, 'baseline', manna_id, 'baseline',
        'progression', 68, ARRAY['range', 'leverage', 'complexity', 'fatigue']::TEXT[],
        'Elevating the hips and carrying the legs beyond the shoulder line materially changes shoulder extension, trunk, flexibility, balance, assistance, and exit demands and enters the separate Manna identity.',
        jsonb_build_object('requires', jsonb_build_array('repeatable_v_sit_with_reserve', 'cleared_shoulder_and_compression_progressions', 'qualified_direct_supervision'))
      )
  ) AS edge(
    from_definition_id,
    from_variant_key,
    to_definition_id,
    to_variant_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json
  )
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = edge.from_definition_id
   AND source_variant.variant_key = edge.from_variant_key
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = edge.to_definition_id
   AND target_variant.variant_key = edge.to_variant_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE
  SET similarity_score = EXCLUDED.similarity_score,
      dimensions = EXCLUDED.dimensions,
      reason = EXCLUDED.reason,
      conditions_json = EXCLUDED.conditions_json,
      review_status = 'review',
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now();

  INSERT INTO coaching.exercise_difficulty_profile (
    exercise_id,
    technical,
    load,
    overall,
    recommended_age_min,
    attention_demand,
    notes,
    source,
    complexity
  )
  VALUES
    (
      v_sit_exercise_id, 7.2, 8.0, 8.0, 10, 'high',
      'Candidate reassessment: exercise complexity 72/100, physical difficulty 80/100; overall is their maximum. This is not a proficiency level.',
      'candidate_canonical_research', 72
    ),
    (
      manna_exercise_id, 8.8, 9.4, 9.4, 12, 'high',
      'Candidate reassessment: exercise complexity 88/100, physical difficulty 94/100; overall is their maximum. This is not a proficiency level.',
      'candidate_canonical_research', 88
    )
  ON CONFLICT (exercise_id) DO UPDATE
  SET technical = EXCLUDED.technical,
      load = EXCLUDED.load,
      overall = EXCLUDED.overall,
      recommended_age_min = EXCLUDED.recommended_age_min,
      attention_demand = EXCLUDED.attention_demand,
      notes = EXCLUDED.notes,
      source = EXCLUDED.source,
      complexity = EXCLUDED.complexity,
      updated_at = now();

  UPDATE coaching.exercise_difficulty_profile
  SET technical = 4.0,
      load = 4.6,
      overall = 4.6,
      complexity = 40,
      notes = 'Candidate reassessment: exercise complexity 40/100, physical difficulty 46/100; overall is their maximum. Pike, straddle, unilateral, and knee-angle choices are variants, not proficiency levels.',
      source = 'candidate_canonical_research',
      updated_at = now()
  WHERE exercise_id = compression_exercise_id;

  INSERT INTO coaching.exercise_score_v1 (
    exercise_id,
    technical_complexity,
    absolute_load_demand,
    coordination_demand,
    impact,
    supervision_demand,
    base_overall_difficulty,
    legacy_scores,
    migration_confidence,
    human_review_status,
    review_notes
  )
  VALUES
    (
      v_sit_exercise_id, 72, 80, 74, 1, 68, 80,
      jsonb_build_object(
        'source_table', 'migration_312_candidate_reassessment',
        'source_scale', 100,
        'exerciseComplexity', 72,
        'physicalDifficulty', 80,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      56, 'queued',
      'Human calibration required; this is exercise demand, not athlete proficiency.'
    ),
    (
      manna_exercise_id, 88, 94, 90, 1, 92, 94,
      jsonb_build_object(
        'source_table', 'migration_312_candidate_reassessment',
        'source_scale', 100,
        'exerciseComplexity', 88,
        'physicalDifficulty', 94,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      52, 'queued',
      'Human calibration required; this is exercise demand, not athlete proficiency.'
    )
  ON CONFLICT (exercise_id) DO UPDATE
  SET technical_complexity = EXCLUDED.technical_complexity,
      absolute_load_demand = EXCLUDED.absolute_load_demand,
      coordination_demand = EXCLUDED.coordination_demand,
      impact = EXCLUDED.impact,
      supervision_demand = EXCLUDED.supervision_demand,
      base_overall_difficulty = EXCLUDED.base_overall_difficulty,
      legacy_scores = EXCLUDED.legacy_scores,
      migration_confidence = EXCLUDED.migration_confidence,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = EXCLUDED.review_notes,
      updated_at = now();

  UPDATE coaching.exercise_score_v1
  SET technical_complexity = 40,
      absolute_load_demand = 46,
      coordination_demand = 44,
      impact = 1,
      supervision_demand = 28,
      base_overall_difficulty = 46,
      legacy_scores = legacy_scores || jsonb_build_object(
        'candidateReassessment', 'migration_312',
        'exerciseComplexity', 40,
        'physicalDifficulty', 46,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'identityResolution', 'seated_compression_family'
      ),
      migration_confidence = 57,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = 'Human calibration required; Pike and straddle are variants of a grounded dynamic compression lift.',
      updated_at = now()
  WHERE exercise_id = compression_exercise_id;

  UPDATE coaching.exercise
  SET skill_level = NULL,
      is_published = CASE
        WHEN id IN (v_sit_exercise_id, manna_exercise_id) THEN FALSE
        ELSE is_published
      END,
      why_publish_ready = FALSE,
      updated_at = now()
  WHERE id IN (compression_exercise_id, v_sit_exercise_id, manna_exercise_id);

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required
  )
  SELECT
    d.id,
    d.facility_id,
    d.card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '312_coaching_support_compression_identity_family',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'formalProficiencyClassification', 'skill_library_only',
      'exerciseCardProficiencyLevel', 'not_applicable'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'support_compression_human_review_required',
        'message', 'Identity, variant boundaries, difficulty, dosage, graph edges, instructions, and safety content require human review.'
      ),
      jsonb_build_object(
        'code', 'support_compression_media_review_required',
        'message', 'Candidate videos require exact-match, safety, captions, accessibility, embedding, and continuing-availability review.'
      ),
      jsonb_build_object(
        'code', 'support_compression_calibration_required',
        'message', 'Difficulty values require approved comparison anchors and coach calibration before publication.'
      )
    ),
    TRUE
  FROM coaching.exercise_definition_v1 d
  WHERE d.id IN (compression_id, v_sit_id, manna_id)
  ON CONFLICT (definition_id) DO UPDATE
  SET facility_id = EXCLUDED.facility_id,
      card_version = EXCLUDED.card_version,
      audit_version = EXCLUDED.audit_version,
      status = 'quarantined',
      checks_json = EXCLUDED.checks_json,
      blocking_issues_json = EXCLUDED.blocking_issues_json,
      human_review_required = TRUE,
      checked_at = now();
END
$$;
