-- Complete the candidate-only bilateral Romanian-deadlift family after
-- migration 330 consolidates implement- and tempo-labeled definitions.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Exercise cards receive no skill or
-- proficiency level. Evidence, media, graph, calibration, and publication
-- remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '331_coaching_romanian_deadlift_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'romanian-deadlift'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Romanian-deadlift completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'dumbbell-romanian-deadlift',
      'kettlebell-romanian-deadlift',
      'double-kettlebell-romanian-deadlift',
      'sandbag-romanian-deadlift-strength',
      'landmine-romanian-deadlift',
      'romanian-deadlift-eccentric'
    )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Romanian-deadlift completion requires migration 330 first';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = target_definition_id
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_variant_v1
      WHERE definition_id = target_definition_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id = profile.variant_id
      WHERE variant.definition_id = target_definition_id
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
        )
        OR relationship.to_variant_id IN (
          SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
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
      JOIN coaching.exercise_variant_v1 variant ON variant.id = calibration.variant_id
      WHERE variant.definition_id = target_definition_id
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
        WHERE source.definition_id = target_definition_id
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
      'Romanian-deadlift completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'barbell-standard-tempo',
      'dumbbell-standard-tempo',
      'single-kettlebell-standard-tempo',
      'double-kettlebell-standard-tempo',
      'sandbag-front-hold-standard-tempo',
      'landmine-two-hand-standard-tempo',
      'barbell-slow-eccentric',
      'dumbbell-slow-eccentric'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Romanian-deadlift completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-rdl-source-178',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source permits multiple implements but does not declare one exact implement, quantity, load, range, tempo, pickup, set-down, dosage, and stop-rule contract.'
      ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Romanian Deadlift',
      display_name = 'Romanian Deadlift',
      description =
        'From a declared bilateral standing loaded start, keep the knees softly flexed, brace, and move the hips backward while the exact declared implement stays controlled and close or follows its owned landmine arc. Stop at the deepest range that preserves foot pressure, knee position, trunk organization, grip, and load control; extend the hips to a stacked finish, reset, and set down safely.',
      family_key = 'loaded_bilateral_romanian_deadlift',
      movement_patterns = ARRAY['hinge', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'pelvis', 'hamstring',
        'core', 'spine', 'shoulder', 'elbow', 'wrist', 'hand'
      ]::TEXT[],
      required_equipment = ARRAY[]::TEXT[],
      optional_equipment = ARRAY[
        'barbell', 'dumbbell', 'kettlebell', 'sandbag', 'landmine',
        'plates', 'rack', 'mirror'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_high_traction_floor_with_declared_footwear_policy',
        'station', 'exclusive_clear_load_path_and_set_down_zone',
        'implement', 'declared_exact_type_quantity_load_grip_and_attachment',
        'barbell', 'collars_and_rack_or_pickup_method_declared_and_inspected',
        'landmine', 'base_sleeve_handle_plates_and_arc_inspected',
        'traffic', 'people_loose_plates_and_unused_implements_outside_station',
        'lighting', 'feet_knees_hips_pelvis_spine_grip_and_load_path_visible',
        'coachSightline', 'side_or_oblique_view_outside_load_and_set_down_paths'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_bilateral_stance_and_hip_hinge',
          'can_hold_soft_knees_without_turning_the_hinge_into_a_squat',
          'can_maintain_organized_spine_and_pelvis_through_owned_range',
          'can_control_declared_implement_grip_pickup_and_set_down',
          'can_follow_load_range_tempo_repetition_rest_and_stop_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_back_hip_hamstring_knee_shoulder_wrist_or_hand_pain',
          'numbness_dizziness_pressure_symptoms_or_uncontrolled_breath_holding',
          'unsafe_grip_implement_attachment_collar_rack_anchor_floor_or_station',
          'uncontrolled_spinal_position_load_drift_balance_or_knee_motion',
          'unassessed_recent_injury_surgery_pregnancy_postpartum_or_rehabilitation_restriction'
        ),
        'supervision',
          'Direct observation until setup, brace, soft-knee hinge, range, load path, finish, reset, and set-down are repeatable with the exact implement.',
        'selectionBoundary',
          'Select exact implement, quantity, load, grip, pickup, stance, range, tempo, repetitions, rest, and set-down from current control; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, neurologic signs, pressure symptoms, recent injury or surgery, pregnancy/postpartum concerns, or rehabilitation restrictions require individualized qualified guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'hamstrings', 'gluteus_maximus',
          'adductor_magnus_posterior_fibers',
          'erector_spinae_and_multifidus'
        ),
        'secondaryMuscles', jsonb_build_array(
          'latissimus_dorsi', 'abdominal_wall',
          'gluteus_medius_and_minimus',
          'quadriceps_isometric_support', 'forearm_and_hand_flexors',
          'foot_and_ankle_stabilizers'
        ),
        'stabilizers', jsonb_build_array(
          'abdominal_wall', 'spinal_stabilizers', 'latissimus_dorsi',
          'scapular_stabilizers', 'forearm_and_hand_flexors',
          'foot_and_ankle_stabilizers'
        ),
        'joints', jsonb_build_array(
          'foot', 'ankle', 'knee', 'hip', 'pelvis', 'spine',
          'shoulder', 'elbow', 'wrist_and_hand'
        ),
        'jointActions', jsonb_build_array(
          'eccentric_hip_flexion', 'concentric_hip_extension',
          'controlled_knee_isometric_or_small_angle_flexion',
          'lumbar_pelvic_stabilization',
          'scapular_and_grip_stabilization'
        ),
        'planes', jsonb_build_array(
          'sagittal', 'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'bilateral_stance_and_bilateral_or_centered_external_load',
        'primaryActions', jsonb_build_array(
          'establish_declared_standing_loaded_start',
          'brace_and_set_lats_and_grip',
          'push_hips_back_with_soft_knees',
          'control_exact_implement_through_declared_owned_path',
          'stop_at_declared_owned_range',
          'extend_hips_to_stacked_finish',
          'reset_or_set_down_safely'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task builds loaded posterior-chain strength and controlled hip motion while you organize your feet, knees, hips, trunk, grip, breathing, and exact implement.',
        'beforeYouStart', jsonb_build_array(
          'Confirm implement, quantity, load, grip, pickup, range, tempo, repetitions, rest, and set-down.',
          'Check the station, rack, collars, plates, handles, landmine base, and set-down zone that apply.',
          'Use only a pain-free range that lets the load stay controlled and your trunk stay organized.'
        ),
        'primaryCue',
          'Brace, soften knees, hips back, load close, own the bottom, drive tall, reset.',
        'expectedSensations', jsonb_build_array(
          'hamstring_and_glute_tension', 'trunk_and_lat_bracing',
          'controlled_grip_effort', 'stable_foot_pressure'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_pain_or_joint_pinching', 'numbness_or_dizziness',
          'pressure_symptoms', 'uncontrolled_low_back_grip_or_balance_strain'
        ),
        'selfChecks', jsonb_build_array(
          'My knees stay softly bent without continuing to squat.',
          'My hips travel back and the load stays close or follows the declared landmine arc.',
          'I stop before my back position, balance, grip, or load control changes.',
          'I finish stacked and can reset or set the load down safely.'
        ),
        'painGuidance',
          'Stop immediately for pain, pinching, numbness, dizziness, pressure symptoms, grip loss, equipment movement, balance loss, or a back or load position you cannot restore.',
        'accessibility', jsonb_build_array(
          'lighter_load', 'shorter_range', 'elevated_start',
          'dumbbells_or_kettlebell_instead_of_long_bar_when_appropriate',
          'tactile_hip_hinge_target', 'fewer_repetitions', 'longer_rest',
          'plain_text_audio_tactile_visual_or_live_demonstration'
        ),
        'mediaAlternatives',
          'Use the written exact-variant contract and a qualified live demonstration until a matching video is independently reviewed and approved.'
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'implement_quantity_load_grip_attachments_collars_anchor_and_station',
          'bilateral_stance_and_foot_pressure', 'brace_and_breathing',
          'soft_knee_position_and_hips_back',
          'spine_pelvis_and_load_path', 'owned_range_and_tempo',
          'hip_driven_finish_reset_and_safe_set_down'
        ),
        'faultCorrections', jsonb_build_object(
          'progressive_knee_bend_or_squat',
            'Reduce load or range and restore hips-back motion with stable shins.',
          'spinal_position_change',
            'Shorten range, reduce load, elevate the start, and rebuild brace.',
          'load_path_drift',
            'Reduce load and restore lat, grip, and implement path control.',
          'grip_or_set_down_failure',
            'End the set, clear the station, and choose a controllable implement or load.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'Show exact implement, pickup, start, stance, brace, knee position, hip path, load path, range, tempo, finish, reset, and set-down.',
          'Show one correct repetition and the squat, spinal-change, load-drift, missed-tempo, and unsafe-set-down stop examples without exposing the athlete to load.'
        ),
        'groupManagement', jsonb_build_array(
          'One athlete per lifting station.',
          'Keep unused implements and plates outside neighboring lifting and walking paths.',
          'Inspect collars, racks, handles, sleeves, blocks, and landmine anchors before use and after adjustment.',
          'Position the coach outside pickup, load, plate, bar-end, and set-down paths.'
        ),
        'modificationDecisionTree', jsonb_build_array(
          'Symptoms or unsafe equipment: stop and select a reviewed pain-free alternative.',
          'Position or path fails: shorten range, reduce load, elevate the start, or change to a more controllable implement.',
          'Control holds: change only one of load, range, tempo, implement, or dose at a time.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'pain_numbness_dizziness_pressure_symptoms_or_apprehension',
          'uncontrolled_spine_pelvis_knee_balance_grip_or_load_path',
          'unsafe_implement_attachment_collar_rack_anchor_floor_or_station',
          'unresolved_clinical_restriction'
        ),
        'qualityGate',
          'Count only repetitions with the exact implement contract, stable feet and soft knees, hips-back motion, organized spine and pelvis, controlled load path, owned range and tempo, hip-driven stacked finish, full reset, and safe set-down.',
        'immediateStop', jsonb_build_array(
          'symptoms_or_pressure_signs',
          'grip_implement_attachment_collar_rack_anchor_or_station_failure',
          'spinal_position_change_load_drift_progressive_knee_bend_or_balance_loss',
          'missed_tempo_grinding_failed_finish_or_unsafe_set_down'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch', 'equipment_or_station_safety',
          'symptoms_or_population_constraint', 'difficulty_or_dose_mismatch',
          'instruction_or_accessibility_gap', 'media_or_link_issue',
          'graph_or_substitution_issue'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent',
            'Stop use for injury, equipment movement, grip failure, dropped load, or unsafe station and route through the facility safety process.',
          'clinical',
            'Refer symptom, pregnancy/postpartum, surgery, or rehabilitation questions to the appropriate qualified professional.',
          'content',
            'Quarantine identity, instruction, scoring, relationship, equipment, or media disputes for coach and content review.'
        ),
        'retentionPolicy',
          'Retain exact variant, implement, load, range, tempo, dose, equipment checks, symptoms, stop reason, substitution, and reviewer history under facility policy.',
        'changeImpactPolicy',
          'Any identity, implement, difficulty, range, tempo, equipment, stop-rule, relationship, or media change requires card-version increment, audit rerun, and renewed human review.',
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_and_readiness', 'implement_and_load',
          'station_and_equipment_status', 'range_and_tempo',
          'available_time',
          'weekly_hamstring_glute_hinge_spinal_grip_and_eccentric_budgets'
        )
      ),
      content_confidence = 88,
      scoring_confidence = 66,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration',
          '330_coaching_romanian_deadlift_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'romanian-deadlift-family-v1',
        'researchVersion', '2026-07-26.38',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'exerciseDifficultyDimensions',
          jsonb_build_array('exercise_complexity', 'physical_difficulty'),
        'proficiencyClassificationScope', 'coaching_skill_library_only',
        'exerciseSkillLevelAllowed', FALSE,
        'legacyExactContractsSelectable', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  SELECT card_version
  INTO target_card_version
  FROM coaching.exercise_definition_v1
  WHERE id = target_definition_id;

  CREATE TEMP TABLE romanian_deadlift_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implement_key TEXT NOT NULL,
    implement_quantity TEXT NOT NULL,
    load_path TEXT NOT NULL,
    tempo_contract TEXT NOT NULL,
    exercise_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    grip_demand INTEGER NOT NULL,
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    grip_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO romanian_deadlift_variant_seed VALUES
    (
      'barbell-standard-tempo',
      'Romanian Deadlift — Barbell Standard Tempo',
      'barbell', 'one_bar', 'close_bilateral_free_path', 'standard_controlled',
      42, 58, 48, 48, 52, 36, 48, 58, 56, 62, 48, 64, 48
    ),
    (
      'dumbbell-standard-tempo',
      'Romanian Deadlift — Dumbbell Standard Tempo',
      'dumbbell', 'two', 'close_independent_paths', 'standard_controlled',
      38, 48, 46, 42, 44, 34, 44, 48, 48, 54, 44, 58, 42
    ),
    (
      'single-kettlebell-standard-tempo',
      'Romanian Deadlift — Single Kettlebell Standard Tempo',
      'kettlebell', 'one', 'centered_two_hand_path', 'standard_controlled',
      36, 42, 40, 38, 40, 32, 36, 42, 44, 50, 36, 54, 36
    ),
    (
      'double-kettlebell-standard-tempo',
      'Romanian Deadlift — Double Kettlebell Standard Tempo',
      'kettlebell', 'two', 'close_independent_paths', 'standard_controlled',
      40, 52, 48, 44, 48, 36, 50, 52, 52, 58, 50, 62, 42
    ),
    (
      'sandbag-front-hold-standard-tempo',
      'Romanian Deadlift — Sandbag Front Hold Standard Tempo',
      'sandbag', 'one', 'deformable_front_hold', 'standard_controlled',
      40, 50, 46, 46, 50, 36, 48, 52, 50, 58, 48, 62, 42
    ),
    (
      'landmine-two-hand-standard-tempo',
      'Romanian Deadlift — Landmine Two-Hand Standard Tempo',
      'landmine', 'one', 'fixed_angled_arc', 'standard_controlled',
      42, 54, 48, 50, 52, 36, 44, 54, 50, 58, 44, 64, 42
    ),
    (
      'barbell-slow-eccentric',
      'Romanian Deadlift — Barbell Slow Eccentric',
      'barbell', 'one_bar', 'close_bilateral_free_path', 'four_to_six_second_eccentric',
      48, 60, 56, 54, 56, 38, 50, 62, 72, 68, 50, 76, 60
    ),
    (
      'dumbbell-slow-eccentric',
      'Romanian Deadlift — Dumbbell Slow Eccentric',
      'dumbbell', 'two', 'close_independent_paths', 'four_to_six_second_eccentric',
      44, 52, 54, 48, 50, 36, 46, 54, 68, 62, 46, 72, 54
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id, variant_key, display_name, modifier_keys,
    difficulty_json, requirements_json, load_profile_json,
    fatigue_profile_json, programming_profile_json, status
  )
  SELECT
    target_definition_id,
    seed.variant_key,
    seed.display_name,
    ARRAY[
      seed.implement_key,
      seed.implement_quantity,
      seed.load_path,
      seed.tempo_contract,
      'bilateral_stance',
      'standing_top_start',
      'soft_knee_hip_hinge',
      'stacked_finish'
    ]::TEXT[],
    jsonb_build_object(
      'exerciseComplexity', seed.exercise_complexity,
      'technicalComplexity', seed.exercise_complexity,
      'physicalDifficulty', seed.physical_difficulty,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', seed.coordination_demand,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', 1,
      'workCapacityDemand', seed.work_capacity_demand,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'start', 'declared_bilateral_standing_loaded_top_start',
      'stance', 'bilateral_approximately_hip_width',
      'implement', seed.implement_key,
      'implementQuantity', seed.implement_quantity,
      'loadPath', seed.load_path,
      'tempoContract', seed.tempo_contract,
      'kneePosition', 'soft_flexion_without_progressive_squat',
      'hipAction', 'hips_back_then_hip_extension_to_stacked_finish',
      'range', 'declared_owned_hamstring_limited_range',
      'trunkContract', 'organized_spine_pelvis_and_brace',
      'breathing', 'declared_brace_and_breathing_strategy',
      'completion', 'stacked_finish_full_reset_and_safe_set_down',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod', 'declared_implement_mass',
      'loadingType', 'bilateral_external_load_with_hip_hinge',
      'impactClass', 'no_impact',
      'primaryStress', jsonb_build_array(
        'hamstring_lengthening_and_force',
        'glute_and_adductor_hip_extension',
        'trunk_and_spinal_stabilization',
        'lat_and_load_path_control',
        'grip_and_implement_management',
        CASE WHEN seed.tempo_contract = 'four_to_six_second_eccentric'
          THEN 'elevated_eccentric_tissue_and_tempo_demand'
          ELSE 'controlled_standard_eccentric_demand'
        END
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'loaded_hip_hinge_volume', 'hamstring_lengthened_loading',
        'spinal_loading', 'eccentric_tissue_stress',
        'grip_time_and_load', 'technical_sensitivity',
        'heavy_set_down_exposures'
      ),
      'fatigueSignals', jsonb_build_array(
        'spinal_position_change', 'load_path_drift',
        'progressive_knee_bend_or_squat', 'range_loss_or_bounce',
        'grip_or_implement_control_loss', 'tempo_failure_or_grinding',
        'unsafe_finish_or_set_down'
      )
    ),
    jsonb_build_object(
      'primaryPhase',
        CASE WHEN seed.tempo_contract = 'four_to_six_second_eccentric'
          THEN 'resilience'
          ELSE 'capacity'
        END,
      'secondaryPhase',
        CASE WHEN seed.tempo_contract = 'four_to_six_second_eccentric'
          THEN 'capacity'
          ELSE 'resilience'
        END,
      'placement',
        'before_material_hamstring_glute_trunk_spinal_grip_or_hinge_fatigue',
      'freshnessSensitive', TRUE,
      'prescriptionUnit', 'quality_repetitions',
      'implementRangeTempoAndSetDownMustBeExplicit', TRUE,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM romanian_deadlift_variant_seed seed
  ON CONFLICT (definition_id, variant_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    status = 'review',
    updated_at = now();

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id, profile_key, phase_key, role, purpose,
    phase_suitability, methodology_alignment, objective_relevance_json,
    dosage_json, quality_gate, stop_rules, coach_instructions,
    athlete_instructions, expected_adaptation, equipment_required,
    logistics_json, substitution_ids, time_model_json, dose_scaling_json,
    measurement_json, support_prompts_json, status
  )
  SELECT
    variant.id,
    phase.profile_key,
    phase.phase_key,
    phase.role,
    CASE phase.profile_key
      WHEN 'capacity-strength'
        THEN 'Build bilateral posterior-chain force capacity with the exact implement while preserving stance, brace, knee position, hip path, load path, range, breathing, finish, reset, and set-down.'
      ELSE
        'Develop deliberate eccentric hinge control and lengthened posterior-chain loading while preserving every position, path, tempo, breathing, and equipment gate.'
    END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 94 ELSE 88 END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 94 ELSE 90 END,
    jsonb_build_object(
      'posteriorChainStrength',
        CASE phase.profile_key WHEN 'capacity-strength' THEN 96 ELSE 78 END,
      'eccentricControl',
        CASE phase.profile_key WHEN 'eccentric-control' THEN 96 ELSE 72 END,
      'hipHingeTechnique', 90,
      'fatigueConditioning', 10
    ),
    jsonb_build_object(
      'sets', CASE phase.profile_key WHEN 'capacity-strength' THEN '2-5' ELSE '2-4' END,
      'repetitions', CASE phase.profile_key WHEN 'capacity-strength' THEN '3-10' ELSE '3-8' END,
      'restSeconds', CASE phase.profile_key WHEN 'capacity-strength' THEN '90-240' ELSE '90-180' END,
      'tempo',
        CASE phase.profile_key
          WHEN 'eccentric-control' THEN 'declared_four_to_six_second_lowering'
          ELSE seed.tempo_contract
        END,
      'effort',
        CASE phase.profile_key
          WHEN 'capacity-strength'
            THEN 'challenging_strength_only_while_every_quality_gate_holds'
          ELSE 'submaximal_to_moderate_with_exact_eccentric_tempo'
        END,
      'implement', seed.implement_key,
      'quantity', seed.implement_quantity,
      'range', 'declared_owned_hamstring_limited_range',
      'reset', 'full_top_reset_and_safe_set_down'
    ),
    'The exact implement and equipment contract is used; feet and soft knees remain stable; hips move back; spine and pelvis stay organized; the load path, owned range, breathing, and declared tempo remain controlled; the athlete returns by hip extension, finishes stacked, resets, and can set down safely.',
    ARRAY[
      'Stop for pain, pinching, numbness, dizziness, pressure symptoms, or apprehension.',
      'Stop for grip loss, implement shift, loose collar or plate, rack or landmine movement, unsafe floor, traffic, or set-down zone.',
      'Stop for spinal position change, load drift, progressive knee bend, balance loss, bounce, or range that cannot be controlled.',
      'Stop when tempo, breathing, bar speed, finish, reset, or set-down quality materially declines or grinding begins.'
    ]::TEXT[],
    'Declare implement, quantity, load, grip, pickup, stance, range, tempo, repetitions, rest, finish, reset, and set-down. Observe from outside the load path with feet, knees, hips, pelvis, spine, grip, load path, and station visible.',
    'Brace, soften knees, hips back, load close, own the bottom, drive tall, reset.',
    CASE phase.profile_key
      WHEN 'capacity-strength'
        THEN 'Greater bilateral posterior-chain strength and load control with repeatable hinge mechanics.'
      ELSE
        'Greater slow-eccentric range, tissue tolerance, positional control, and tempo ownership.'
    END,
    CASE seed.implement_key
      WHEN 'landmine' THEN ARRAY['landmine', 'barbell']::TEXT[]
      ELSE ARRAY[seed.implement_key]::TEXT[]
    END,
    jsonb_build_object(
      'surface', 'level_high_traction_floor',
      'participants', 'one_athlete_per_lifting_station',
      'setupSeconds',
        CASE seed.implement_key
          WHEN 'landmine' THEN 90
          WHEN 'barbell' THEN 75
          ELSE 45
        END,
      'transitionSeconds', 20,
      'equipmentInspection',
        'before_session_after_load_or_attachment_change_and_after_any_shift',
      'setDownZone', 'clear_and_exclusive',
      'coachPosition', 'outside_pickup_load_plate_bar_end_and_set_down_paths'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'repetitionSeconds',
        CASE phase.profile_key WHEN 'eccentric-control' THEN 10 ELSE 6 END,
      'resetSeconds', 6,
      'setDurationFormula', 'repetitions_x_repetition_plus_reset',
      'setupSeconds',
        CASE seed.implement_key
          WHEN 'landmine' THEN 90
          WHEN 'barbell' THEN 75
          ELSE 45
        END,
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_load', 'shorten_range', 'elevate_start',
        'use_more_controllable_implement', 'reduce_repetitions',
        'use_standard_tempo', 'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'load', 'range', 'eccentric_duration', 'repetitions',
        'implement_complexity'
      ),
      'symptomRule', 'stop_and_select_reviewed_pain_free_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'implement', 'quantity', 'load', 'grip',
        'pickup', 'range', 'tempo', 'quality_repetitions',
        'rest', 'set_down', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'bar_speed', 'range_depth', 'eccentric_time',
        'rate_of_perceived_effort', 'repetitions_in_reserve',
        'spinal_or_load_path_error', 'grip_or_set_down_error'
      ),
      'comparisonRule',
        'Compare only when implement, quantity, load, grip, pickup, stance, range, tempo, footwear, surface, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm implement, load, equipment checks, pickup, range, tempo, repetitions, rest, and set-down.',
        'Report pain, numbness, dizziness, pressure symptoms, apprehension, or equipment uncertainty.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch feet, knees, hips, spine, load path, range, tempo, breathing, finish, reset, and set-down.',
        'Stop immediately on any symptom, equipment, station, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions, exact setup, load, range, tempo, errors, symptoms, stop reason, and substitutions.',
        'Do not increase load, range, or eccentric time after a stop trigger.'
      ),
      'supportEscalation',
        'Escalate symptoms, dropped or shifting equipment, identity mismatch, or inaccessible instruction through the documented support path.',
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM romanian_deadlift_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN (
    VALUES
      ('capacity-strength', 'capacity', 'primary'),
      ('eccentric-control', 'resilience', 'secondary')
  ) AS phase(profile_key, phase_key, role)
  ON CONFLICT (variant_id, profile_key) DO UPDATE SET
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
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    status = 'review',
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id, to_variant_id, relationship, similarity_score,
    dimensions, reason, conditions_json, review_status
  )
  SELECT
    from_variant.id,
    to_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions_json,
    'review'
  FROM (
    VALUES
      (
        'barbell-standard-tempo', 'barbell-slow-eccentric',
        'progression', 94, ARRAY['complexity', 'fatigue']::TEXT[],
        'Adding a four-to-six-second lowering tempo preserves the barbell RDL while increasing eccentric, positional, breathing, and technical-fatigue demand.',
        '{"requiresStableStandardTempoVariant":true,"loadMayNeedReduction":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'barbell-slow-eccentric', 'barbell-standard-tempo',
        'regression', 94, ARRAY['complexity', 'fatigue']::TEXT[],
        'Returning to controlled standard tempo preserves the barbell RDL while reducing eccentric and tempo-control demand.',
        '{"tempo":"standard_controlled","humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-standard-tempo', 'dumbbell-slow-eccentric',
        'progression', 94, ARRAY['complexity', 'fatigue']::TEXT[],
        'Adding a four-to-six-second lowering tempo preserves the dumbbell RDL while increasing eccentric, path, breathing, and technical-fatigue demand.',
        '{"requiresStableStandardTempoVariant":true,"loadMayNeedReduction":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-slow-eccentric', 'dumbbell-standard-tempo',
        'regression', 94, ARRAY['complexity', 'fatigue']::TEXT[],
        'Returning to controlled standard tempo preserves the dumbbell RDL while reducing eccentric and tempo-control demand.',
        '{"tempo":"standard_controlled","humanReviewRequired":true}'::JSONB
      ),
      (
        'barbell-standard-tempo', 'dumbbell-standard-tempo',
        'equipment_equivalent', 86, ARRAY['equipment', 'grip', 'load']::TEXT[],
        'Two dumbbells can preserve the bilateral RDL intent when load, grip, path, pickup, range, and set-down are reassessed.',
        '{"exactLoadGripRangeAndSetDownMustBeReassessed":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-standard-tempo', 'barbell-standard-tempo',
        'equipment_equivalent', 86, ARRAY['equipment', 'grip', 'load']::TEXT[],
        'A barbell can preserve the bilateral RDL intent when loading, long-bar path, collars, rack or pickup, range, and set-down are reassessed.',
        '{"exactLoadGripRangeAndSetDownMustBeReassessed":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'single-kettlebell-standard-tempo', 'double-kettlebell-standard-tempo',
        'progression', 90, ARRAY['load', 'complexity']::TEXT[],
        'Adding a second kettlebell preserves the bilateral RDL while increasing load, grip, independent-path, pickup, and set-down demand.',
        '{"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'double-kettlebell-standard-tempo', 'single-kettlebell-standard-tempo',
        'regression', 90, ARRAY['load', 'complexity']::TEXT[],
        'Using one centered kettlebell preserves the bilateral RDL while reducing load, independent-path, grip, pickup, and set-down demand.',
        '{"quantity":"one_centered_kettlebell","humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    from_variant_key, to_variant_key, relationship, similarity_score,
    dimensions, reason, conditions_json
  )
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = target_definition_id
   AND from_variant.variant_key = edge.from_variant_key
   AND from_variant.status <> 'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = target_definition_id
   AND to_variant.variant_key = edge.to_variant_key
   AND to_variant.status <> 'archived'
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id, variant_id, dimension, proposed_score, anchor_tier,
    rationale, status, version, created_by, reviewed_by, review_notes,
    reviewed_at
  )
  SELECT
    facility,
    variant.id,
    calibration.dimension,
    calibration.proposed_score,
    CASE
      WHEN calibration.proposed_score <= 30 THEN 20
      WHEN calibration.proposed_score <= 50 THEN 40
      WHEN calibration.proposed_score <= 70 THEN 60
      ELSE 80
    END,
    calibration.rationale,
    'review',
    1,
    NULL,
    NULL,
    'Research-backed proposal only; independent anchor comparison and human approval remain required.',
    NULL
  FROM romanian_deadlift_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        'Exercise complexity reflects exact implement setup, pickup, stance, brace, knee and hip control, load path, range, tempo, finish, reset, and safe set-down.'
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        'Physical difficulty reflects external load, posterior-chain force, spinal and trunk loading, grip, range, and eccentric demand for the exact variant.'
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Overall exercise difficulty is mechanically derived as the maximum of exercise complexity and physical difficulty; it is not a skill or proficiency level.'
      )
  ) AS calibration(dimension, proposed_score, rationale)
  ON CONFLICT (facility_id, variant_id, dimension, version) DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE romanian_deadlift_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO romanian_deadlift_source_seed VALUES
    (
      'nsca_romanian_deadlift_technique',
      'https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/',
      'Romanian Deadlift (RDL)',
      'National Strength and Conditioning Association',
      'professional_standard',
      88
    ),
    (
      'ace_romanian_deadlift_instruction',
      'https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/',
      'Romanian Deadlift',
      'American Council on Exercise',
      'professional_standard',
      78
    ),
    (
      'romanian_deadlift_joint_kinetics_emg',
      'https://pubmed.ncbi.nlm.nih.gov/30662500/',
      'An electromyographic and kinetic comparison of conventional and Romanian deadlifts',
      'Journal of Exercise Science & Fitness',
      'peer_reviewed_research',
      87
    ),
    (
      'deadlift_variants_emg_systematic_review',
      'https://pubmed.ncbi.nlm.nih.gov/32107499/',
      'Electromyographic activity in deadlift exercise and its variants. A systematic review',
      'PLOS ONE',
      'peer_reviewed_research',
      90
    ),
    (
      'romanian_deadlift_hamstring_emg',
      'https://pubmed.ncbi.nlm.nih.gov/24149748/',
      'Muscle activation during various hamstring exercises',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      84
    ),
    (
      'eccentric_romanian_deadlift_hamstring_adaptation',
      'https://pubmed.ncbi.nlm.nih.gov/40085810/',
      'Hamstrings Muscle Architecture and Morphology Following 6 wk of an Eccentrically Biased Romanian Deadlift or Nordic Hamstring Exercise Intervention',
      'Medicine & Science in Sports & Exercise',
      'peer_reviewed_research',
      89
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE romanian_deadlift_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO romanian_deadlift_evidence_seed VALUES
    (
      'identity', 'nsca_romanian_deadlift_technique',
      '["The stable identity is a bilateral loaded standing hip hinge with soft knees, hips back, controlled close load path, owned range, and hip-driven return.","Implement, quantity, fixed or free path, grip, range, and tempo are variants or delivery dimensions, not exercise skill levels."]'::JSONB
    ),
    (
      'taxonomy', 'ace_romanian_deadlift_instruction',
      '["ACE describes the same bilateral hip-back hinge, soft knees, close load path, posterior-leg tension, and standing return.","Declare stance, implement, quantity, grip, path, range, tempo, pickup, set-down, and intent; different stance or added action remains separate."]'::JSONB
    ),
    (
      'anatomy', 'deadlift_variants_emg_systematic_review',
      '["Deadlift research evaluates hamstrings, gluteus maximus, erector spinae, quadriceps, and related musculature, with RDL-specific findings.","Declare hip, knee, pelvis, spine, shoulder, grip, muscles, actions, planes, and bilateral laterality without isolation claims."]'::JSONB
    ),
    (
      'biomechanics', 'romanian_deadlift_joint_kinetics_emg',
      '["The RDL has a distinct joint-kinetic and muscle-activity profile from the conventional deadlift.","Observe standing start, feet, soft knees, hips back, organized trunk, controlled load path, owned range, hip-driven return, finish, and set-down."]'::JSONB
    ),
    (
      'difficulty', 'nsca_romanian_deadlift_technique',
      '["Controlled knee position, hip motion, balance, neutral-spine range, straight-arm load handling, and close path create technical demand.","Score exercise complexity and physical difficulty per exact variant, derive overall as their maximum, and assign no exercise skill level."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'romanian_deadlift_hamstring_emg',
      '["RDL research measures eccentric and concentric hamstring and surrounding muscle activity.","Budget hip-hinge load, lengthened hamstring work, glute and trunk demand, spinal loading, grip time, eccentric stress, and technical sensitivity without impact."]'::JSONB
    ),
    (
      'constraints', 'nsca_romanian_deadlift_technique',
      '["The load remains controlled and close, and range stops before neutral spinal position cannot be maintained.","Declare implement, quantity, load, attachments, floor, rack or pickup, clear path, set-down zone, footwear, pain-free range, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'eccentric_romanian_deadlift_hamstring_adaptation',
      '["The cited trial used twice-weekly eccentrically biased RDL training over six weeks.","Use quality strength or exact slow-eccentric sets with enough rest to preserve every position, path, breathing, tempo, reset, and set-down gate."]'::JSONB
    ),
    (
      'instructions', 'nsca_romanian_deadlift_technique',
      '["NSCA cues soft knees, slow lowering, hips back, straight arms, close path, and hip extension to return.","Brace, soften knees, hips back, load close, stop at owned range, drive tall, reset, and set down safely."]'::JSONB
    ),
    (
      'safety_stop_rules', 'ace_romanian_deadlift_instruction',
      '["ACE emphasizes straight-back control, slight knee bend, close load path, and posterior-leg-limited range.","Stop for symptoms, grip or equipment loss, spinal change, load drift, squat conversion, balance loss, missed tempo, grinding, or unsafe set-down."]'::JSONB
    ),
    (
      'programming', 'eccentric_romanian_deadlift_hamstring_adaptation',
      '["Eccentrically biased RDL training is a tempo and dosage application of the same hinge pattern.","Use standard variants for capacity and slow-eccentric variants for resilience, before material posterior-chain, trunk, grip, or back fatigue."]'::JSONB
    ),
    (
      'athlete_support', 'ace_romanian_deadlift_instruction',
      '["Expose implement, load, pickup, stance, range, tempo, repetitions, rest, cue, and stop signal.","Offer lighter load, shorter range, elevated start, controllable implements, fewer repetitions, and longer rest without exercise skill levels."]'::JSONB
    ),
    (
      'coach_support', 'romanian_deadlift_joint_kinetics_emg',
      '["The RDL is biomechanically distinct from the conventional deadlift.","Coach support must expose setup, equipment, stance, knee and hip path, load path, range, tempo, dose, observation, fatigue, symptoms, and shutdown."]'::JSONB
    ),
    (
      'accessibility', 'nsca_romanian_deadlift_technique',
      '["Range stops before neutral spinal position can no longer be maintained.","Options include lighter load, shorter range, elevated start, alternative controllable implements, tactile hinge targets, fewer repetitions, longer rest, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'nsca_romanian_deadlift_technique',
      '["Grip and bar configuration can vary while the bilateral RDL contract remains intact.","Single-leg, staggered-stance, row-combination, floor deadlift, good morning, and swing tasks change stance, start, action, load position, or cadence."]'::JSONB
    ),
    (
      'media', 'youtube_embed_help',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have healthy metadata only; full viewing, exact match, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
    );

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id, reviewed_card_version, section_key, source_url,
    source_title, source_publisher, source_kind, claims_json,
    evidence_quality, review_status, reviewer_user_id, reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    evidence.section_key,
    source.source_url,
    source.source_title,
    source.source_publisher,
    source.source_kind,
    evidence.claims_json,
    source.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM romanian_deadlift_evidence_seed evidence
  JOIN romanian_deadlift_source_seed source
    ON source.source_key = evidence.source_key
  ON CONFLICT (
    definition_id, reviewed_card_version, section_key, source_url
  ) DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_media_candidate_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id, variant_id, reviewed_card_version, url, embed_url,
    video_id, title, channel_name, embedding_allowed, exact_variant_match,
    demonstration_quality_score, link_status, review_status,
    discovery_method, source_query, reviewer_user_id, reviewed_at, notes
  )
  SELECT
    target_definition_id,
    variant.id,
    target_card_version,
    media.url,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      (
        'barbell-standard-tempo',
        '5bJEigM5iVg',
        'https://www.youtube.com/watch?v=5bJEigM5iVg',
        'FIX Your RDL Form! (Ultimate Romanian Deadlift Tutorial)',
        'Squat University',
        'Legacy generic-RDL link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing, exact implement and tempo match, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'dumbbell-standard-tempo',
        'IJdUtnxAmNo',
        'https://www.youtube.com/watch?v=IJdUtnxAmNo',
        'Dumbbell Romanian Deadlift | Exercise Technique Library',
        'Dr. Jacob Goodin',
        'Legacy dumbbell-RDL link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'single-kettlebell-standard-tempo',
        'mVSgE9S0G4w',
        'https://www.youtube.com/watch?v=mVSgE9S0G4w',
        'Kettlebell Romanian Deadlift - OPEX Exercise Library',
        'OPEX Fitness',
        'Legacy kettlebell-RDL link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'double-kettlebell-standard-tempo',
        '5EGDritflEw',
        'https://www.youtube.com/watch?v=5EGDritflEw',
        'Double-Kettlebell Romanian Deadlift (RDL)',
        'Zen Athletic Performance',
        'Legacy double-kettlebell-RDL link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'sandbag-front-hold-standard-tempo',
        'zlPDMykne5w',
        'https://www.youtube.com/watch?v=zlPDMykne5w',
        'U.S. Marine Corps Fitness - Sandbag Romanian Deadlift',
        'U.S. Forces Fitness',
        'Legacy sandbag-RDL link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      )
  ) AS media(
    variant_key, video_id, url, title, channel_name, source_query, notes
  )
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = media.variant_key
   AND variant.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
    variant_id = EXCLUDED.variant_id,
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = EXCLUDED.discovery_method,
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id, reviewed_card_version, alternate_name, classification,
    rationale, distinguishing_dimensions, proposed_card_json, review_status,
    reviewer_user_id, reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    NULL,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      (
        'Romanian Deadlift', 'same_identity',
        'Stable broad identity for the bilateral loaded standing hip hinge.',
        '{"implement":"declared_by_variant","tempo":"declared_by_variant"}'::JSONB
      ),
      (
        'Dumbbell Romanian Deadlift', 'same_identity',
        'Dumbbells change implement handling and loading without changing the bilateral RDL action.',
        '{"implement":"dumbbell","quantity":"two"}'::JSONB
      ),
      (
        'Kettlebell Romanian Deadlift', 'same_identity',
        'A centered kettlebell changes grip and mass distribution while preserving the RDL contract.',
        '{"implement":"kettlebell","quantity":"one"}'::JSONB
      ),
      (
        'Double Kettlebell Romanian Deadlift', 'same_identity',
        'Two kettlebells change quantity, load, grip, and path management within the same bilateral hinge.',
        '{"implement":"kettlebell","quantity":"two"}'::JSONB
      ),
      (
        'Sandbag Romanian Deadlift', 'same_identity',
        'A deformable front-held sandbag changes grip and mass distribution while preserving the bilateral RDL.',
        '{"implement":"sandbag","hold":"front_hold"}'::JSONB
      ),
      (
        'Landmine Romanian Deadlift', 'same_identity',
        'A secure landmine changes the path to a fixed arc and adds anchor constraints without changing the bilateral RDL action.',
        '{"implement":"landmine","path":"fixed_arc"}'::JSONB
      ),
      (
        'Romanian Deadlift Eccentric', 'new_variant',
        'A declared slow lowering tempo changes eccentric and recovery demand within the same identity.',
        '{"tempo":"four_to_six_second_eccentric"}'::JSONB
      ),
      (
        'Deficit Romanian Deadlift', 'new_variant',
        'An elevated stance can increase range and requires exact scoring and setup while retaining the bilateral RDL action.',
        '{"range":"deficit","platform":"declared"}'::JSONB
      ),
      (
        'Snatch-Grip Romanian Deadlift', 'new_variant',
        'A wider grip changes torso angle, range, grip, and lat demand while retaining the barbell RDL action.',
        '{"grip":"snatch_width"}'::JSONB
      ),
      (
        'Single-Leg Romanian Deadlift', 'new_definition',
        'Unilateral stance materially changes balance, pelvis control, laterality, and failure modes.',
        '{"stance":"unilateral"}'::JSONB
      ),
      (
        'Staggered-Stance Romanian Deadlift', 'new_definition',
        'A kickstand base changes load distribution, laterality, stance, and side prescription.',
        '{"stance":"staggered"}'::JSONB
      ),
      (
        'Romanian Deadlift to Row', 'new_definition',
        'Adding a row changes the primary action, hinge-hold duration, and upper-body demand.',
        '{"primaryAction":"hinge_plus_row"}'::JSONB
      )
  ) AS alternate(alternate_name, classification, rationale, dimensions)
  ON CONFLICT (
    definition_id, reviewed_card_version, alternate_name
  ) DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_difficulty_profile profile
  SET technical = 4.2,
      load = 5.8,
      overall = greatest(4.2, 5.8),
      notes =
        'Candidate baseline values represent the barbell standard-tempo variant; exact variant assignment and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 42,
      absolute_load_demand = 58,
      coordination_demand = 48,
      impact = 1,
      supervision_demand = 48,
      base_overall_difficulty = greatest(42, 58),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'loaded_bilateral_romanian_deadlift',
        'legacyExactContractSelectable', FALSE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 66,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact variant assignment and independent calibration remain required.',
      updated_at = now()
  WHERE score.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise legacy
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      movement_family = 'Loaded bilateral Romanian deadlift',
      primary_phase_key = CASE
        WHEN legacy.id = 758 THEN 'resilience'
        ELSE 'capacity'
      END,
      phase_subrole = CASE
        WHEN legacy.id = 758 THEN 'slow_eccentric_hinge_control'
        ELSE 'hinge_posterior_chain_strength'
      END,
      primary_order_slot = 'bilateral_romanian_deadlift',
      card_summary =
        'Bilateral loaded standing hip hinge with exact implement, quantity, load path, range, tempo, finish, reset, and set-down contracts.',
      description =
        'From a declared standing loaded start, keep soft knees, push hips back, control the exact implement through owned range, and extend the hips to a stacked finish.',
      instructions =
        'Declare implement, quantity, load, grip, pickup, range, tempo, repetitions, rest, finish, reset, and set-down. Brace, hinge back, keep the load controlled, drive tall, and reset.',
      coach_language =
        'Observe equipment, stance, feet, knees, hips, pelvis, spine, grip, load path, range, tempo, breathing, finish, reset, and set-down. Stop on symptoms, unsafe equipment, position loss, path error, grind, or fatigue.',
      athlete_language =
        'Brace, soften knees, hips back, load close, own the bottom, drive tall, reset.',
      scalable_variables = ARRAY[
        'implement', 'implement_quantity', 'load', 'grip',
        'pickup_and_set_down', 'range', 'tempo',
        'repetitions', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'stance', 'bilateral',
        'start', 'declared_standing_loaded_top_start',
        'primary_action', 'soft_knee_hip_hinge_and_hip_extension',
        'implement_range_tempo', 'exact_variant_required',
        'completion', 'stacked_finish_full_reset_and_safe_set_down',
        'selectable_exact_variant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact implement, quantity, load, grip, equipment, pickup, range, tempo, dose, rest, and set-down.',
          'Inspect floor, station, rack, collars, plates, handles, landmine, traffic, and coach sightline.'
        ),
        'quality_gate', jsonb_build_array(
          'Feet and soft knees remain stable while hips move back.',
          'Spine, pelvis, grip, load path, range, and tempo remain controlled.',
          'The athlete returns by hip extension, finishes stacked, resets, and sets down safely.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, neurologic symptoms, pressure symptoms, dizziness, or apprehension',
          'Grip loss, dropped or shifting implement, loose equipment, unsafe station, or blocked set-down',
          'Spinal change, load drift, squat conversion, balance loss, missed tempo, grind, failed finish, or unsafe set-down'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule', 'select_exact_implement_quantity_path_and_tempo_contract',
        'fatigue_rule',
          'place_before_material_hamstring_glute_trunk_spinal_grip_or_hinge_fatigue',
        'substitution_rule',
          'never_silently_change_stance_start_implement_path_range_tempo_or_added_action',
        'legacy_source_rule', 'incomplete_exact_contract_sources_are_nonselectable'
      ),
      updated_at = now()
  WHERE legacy.id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id, facility_id, card_version, audit_version, status,
    checks_json, blocking_issues_json, human_review_required
  )
  SELECT
    target_definition_id,
    facility,
    target_card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration',
        '330_coaching_romanian_deadlift_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'romanian-deadlift-family-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions',
        jsonb_build_array('exercise_complexity', 'physical_difficulty'),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
      'exerciseSkillLevelAllowed', FALSE,
      'legacySourcesSelectable', FALSE,
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'category', 'calibration',
        'message', 'Independent score-anchor review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'category', 'relationship_graph',
        'message', 'Progression, regression, and substitution edges remain review-only.'
      ),
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'category', 'media',
        'message', 'Exact-variant full-video, safety, caption, accessibility, and approval review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'category', 'publication',
        'message', 'Independent content and publication review remains required.'
      )
    ),
    TRUE
  ON CONFLICT (definition_id) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END;
$$;
