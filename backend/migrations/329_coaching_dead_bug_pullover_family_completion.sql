-- Complete the candidate-only loaded dead-bug pullover family after migration
-- 328 consolidates implement- and breathing-labeled duplicate definitions.
--
-- Exact selectable variants:
--   * dumbbell pullover with tabletop hold
--   * medicine-ball pullover with tabletop hold
--   * anchored-band pullover with tabletop hold
--   * dumbbell pullover with contralateral leg extension
--   * anchored-band pullover with contralateral leg extension
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Exercise cards receive no skill or
-- proficiency level. Evidence, media, graph, calibration, and publication
-- remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '329_coaching_dead_bug_pullover_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'dead-bug-pullover-band-dead-bug'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Dead-bug pullover completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'dumbbell-dead-bug-pullover',
      'band-resisted-dead-bug-pullover',
      'medicine-ball-dead-bug-pullover',
      'dead-bug-pullover-with-exhale'
    )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Dead-bug pullover completion requires migration 328 first';
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
      'Dead-bug pullover completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'baseline-source-660',
      'dumbbell-tabletop-hold',
      'medicine-ball-tabletop-hold',
      'band-tabletop-hold',
      'dumbbell-contralateral-leg-extension',
      'band-contralateral-leg-extension'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Dead-bug pullover completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE variant_key
        WHEN 'baseline' THEN 'legacy-loaded-pullover-source-238'
        WHEN 'baseline-source-660' THEN 'legacy-generic-pullover-source-660'
        ELSE variant_key
      END,
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare an exact implement, leg-action, anchor, range, dosage, and stop-rule contract.'
      ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key IN ('baseline', 'baseline-source-660');

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
      canonical_name = 'Dead Bug Pullover',
      display_name = 'Dead Bug Pullover',
      description =
        'From a declared supine dead-bug start, move a declared external resistance through a controlled bilateral overhead pullover path while preserving the rib-pelvis stack, breathing, shoulder control, and only the declared leg action. Return under control and reset before the next repetition.',
      family_key = 'loaded_supine_anti_extension_pullover',
      movement_patterns = ARRAY['brace', 'pull']::TEXT[],
      body_regions = ARRAY[
        'shoulder', 'scapula', 'core', 'spine', 'rib_cage',
        'pelvis', 'hip'
      ]::TEXT[],
      required_equipment = ARRAY[]::TEXT[],
      optional_equipment = ARRAY[
        'dumbbell', 'medicine_ball', 'bands', 'mat', 'mirror'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_stable_floor_or_mat',
        'overheadSpace', 'clear_for_declared_owned_pullover_range',
        'implement', 'declared_exact_type_load_and_grip',
        'bandAnchor', 'secure_inspected_and_aligned_before_every_band_set',
        'traffic', 'implements_and_people_outside_overhead_and_walking_paths',
        'lighting', 'rib_pelvis_shoulder_implement_and_leg_path_visible',
        'coachSightline', 'side_or_oblique_view_without_entering_implement_path'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_supine_dead_bug_start',
          'pain_free_declared_shoulder_range',
          'can_hold_rib_pelvis_stack_while_breathing',
          'can_control_declared_implement_or_band_tension',
          'can_follow_implement_leg_action_range_tempo_reset_and_stop_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_neck_back_abdominal_hip_or_pelvic_pain',
          'numbness_dizziness_pressure_symptoms_coning_or_doming',
          'unsafe_implement_grip_band_anchor_floor_or_overhead_space',
          'uncontrolled_rib_flare_lumbar_extension_or_pelvic_shift',
          'unassessed_recent_injury_surgery_pregnancy_postpartum_or_rehabilitation_restriction'
        ),
        'supervision',
          'Direct observation until start, implement control, range, breathing, declared leg action, and stop response are repeatable.',
        'selectionBoundary',
          'Select exact implement, load, anchor, leg action, range, tempo, breathing, repetitions, and rest from current control; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, pressure symptoms, coning or doming, recent injury or surgery, neurologic symptoms, pregnancy/postpartum concerns, or rehabilitation restrictions require individualized qualified guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'rectus_abdominis', 'internal_and_external_obliques',
          'transversus_abdominis', 'latissimus_dorsi'
        ),
        'secondaryMuscles', jsonb_build_array(
          'serratus_anterior', 'rotator_cuff', 'triceps_brachii',
          'hip_flexors', 'multifidus_and_spinal_stabilizers',
          'diaphragm_and_pelvic_floor_pressure_system'
        ),
        'stabilizers', jsonb_build_array(
          'abdominal_wall', 'spinal_stabilizers', 'rotator_cuff',
          'scapular_stabilizers', 'pelvic_stabilizers'
        ),
        'joints', jsonb_build_array(
          'shoulder', 'scapulothoracic_articulation', 'elbow',
          'wrist_and_hand', 'spine', 'rib_cage', 'pelvis', 'hip'
        ),
        'jointActions', jsonb_build_array(
          'shoulder_flexion_during_controlled_overhead_reach',
          'shoulder_extension_during_return',
          'scapulothoracic_upward_rotation_and_control',
          'lumbar_pelvic_anti_extension',
          'hip_extension_and_return_when_leg_motion_is_prescribed'
        ),
        'planes', jsonb_build_array(
          'sagittal', 'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'bilateral_arm_path_with_declared_none_or_contralateral_leg_action',
        'primaryActions', jsonb_build_array(
          'establish_declared_supine_dead_bug_start',
          'brace_while_continuing_to_breathe',
          'move_declared_resistance_through_owned_overhead_range',
          'perform_only_declared_leg_action',
          'return_without_rib_flare_lumbar_extension_or_pelvic_shift',
          'reset_before_next_repetition'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task builds loaded shoulder motion and trunk anti-extension control while you keep the ribs, pelvis, breathing, implement, and optional leg movement organized.',
        'beforeYouStart', jsonb_build_array(
          'Confirm the exact implement, load, leg action, range, tempo, repetitions, and rest.',
          'For a band, confirm the anchor has been inspected and cannot move.',
          'Use only a pain-free shoulder and leg range that lets you breathe without your back arching.'
        ),
        'primaryCue',
          'Ribs over pelvis; reach only as far as you can own; exhale, return, reset.',
        'expectedSensations', jsonb_build_array(
          'abdominal_wall_bracing', 'controlled_lat_and_shoulder_effort',
          'light_grip_or_band_tension', 'calm_breathing_behind_the_brace'
        ),
        'unexpectedSensations', jsonb_build_array(
          'pain_or_pinching', 'numbness_or_dizziness',
          'pressure_symptoms_coning_or_doming', 'neck_or_low_back_strain'
        ),
        'selfChecks', jsonb_build_array(
          'My ribs and pelvis stay stacked and my low back position does not change.',
          'The implement follows the declared path without drifting or dropping.',
          'I perform only the declared leg action and can reset before every repetition.',
          'I can breathe without rushing or holding my breath.'
        ),
        'painGuidance',
          'Stop immediately for pain, pinching, numbness, dizziness, pressure symptoms, coning or doming, lost implement or band control, or a back position you cannot restore.',
        'accessibility', jsonb_build_array(
          'feet_supported_or_tabletop_hold', 'lighter_resistance',
          'shorter_shoulder_range', 'fewer_or_no_leg_movements',
          'slower_tempo', 'fewer_repetitions', 'longer_rest',
          'plain_text_audio_tactile_visual_or_live_demonstration'
        ),
        'mediaAlternatives',
          'Use the written contract and a qualified live demonstration until an exact video is independently reviewed and approved.'
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'declared_implement_load_grip_and_band_anchor',
          'supine_start_and_rib_pelvis_stack', 'breathing',
          'shoulder_scapular_and_implement_path', 'declared_leg_action',
          'lumbar_pelvic_control', 'range_tempo_return_and_full_reset'
        ),
        'faultCorrections', jsonb_build_object(
          'rib_flare_or_lumbar_extension',
            'Shorten arm or leg range, reduce resistance, or use feet support.',
          'shoulder_shrug_or_path_drift',
            'Reduce range or load and restore a controlled two-hand path.',
          'breath_holding',
            'Reduce demand and cue a quiet exhale without losing the brace.',
          'pelvic_shift_or_leg_path_error',
            'Return to tabletop hold or reduce leg lever and tempo.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'Show exact start, implement, load, grip, anchor, leg action, range, tempo, breathing, return, reset, and stop signal.',
          'Show one correct repetition and the rib-flare, path-drift, and lost-anchor stop examples without loading the athlete.'
        ),
        'groupManagement', jsonb_build_array(
          'One athlete per floor or mat station.',
          'Store implements outside neighboring overhead and walking paths.',
          'Inspect each band and anchor before the set and after any adjustment.',
          'Position the coach outside all implement and band recoil paths.'
        ),
        'modificationDecisionTree', jsonb_build_array(
          'Symptoms or unsafe equipment: stop and select a reviewed pain-free alternative.',
          'Trunk position fails: shorten range, remove leg motion, reduce resistance, or support the feet.',
          'Control holds: change only one of load, range, leg lever, tempo, or dose at a time.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'pain_pressure_symptoms_coning_doming_numbness_or_dizziness',
          'uncontrolled_rib_flare_lumbar_extension_or_pelvic_shift',
          'unsafe_implement_band_anchor_floor_overhead_space_or_traffic',
          'unresolved_clinical_restriction'
        ),
        'qualityGate',
          'Count only repetitions with the exact implement and leg-action contract, stable rib-pelvis position, calm breathing, controlled shoulder and implement path, owned range, controlled return, and full reset.',
        'immediateStop', jsonb_build_array(
          'symptoms_or_pressure_signs',
          'implement_slip_band_anchor_shift_or_band_damage',
          'rib_flare_lumbar_extension_pelvic_shift_or_coning',
          'shoulder_shrug_path_drift_breath_holding_or_repeated_tempo_failure'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch', 'equipment_or_anchor_safety',
          'symptoms_or_population_constraint', 'difficulty_or_dose_mismatch',
          'instruction_or_accessibility_gap', 'media_or_link_issue',
          'graph_or_substitution_issue'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent',
            'Stop use for injury, pressure symptoms, equipment failure, or unsafe anchor and route through the facility safety process.',
          'clinical',
            'Refer symptom, pregnancy/postpartum, surgery, or rehabilitation questions to the appropriate qualified professional.',
          'content',
            'Quarantine identity, instruction, scoring, relationship, or media disputes for coach and content review.'
        ),
        'retentionPolicy',
          'Retain variant, profile, dose, equipment, anchor check, symptoms, stop reason, substitution, and reviewer history under facility policy.',
        'changeImpactPolicy',
          'Any identity, implement, leg-action, difficulty, stop-rule, relationship, or media change requires card-version increment, audit rerun, and renewed human review.',
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_and_readiness', 'implement_and_load',
          'band_and_anchor_status', 'leg_action', 'range_and_tempo',
          'available_time', 'weekly_trunk_shoulder_lat_grip_and_hip_flexor_budgets'
        )
      ),
      content_confidence = 86,
      scoring_confidence = 64,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration',
          '328_coaching_dead_bug_pullover_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'dead-bug-pullover-family-v1',
        'researchVersion', '2026-07-26.37',
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

  CREATE TEMP TABLE dead_bug_pullover_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implement_key TEXT NOT NULL,
    leg_action TEXT NOT NULL,
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

  INSERT INTO dead_bug_pullover_variant_seed VALUES
    (
      'dumbbell-tabletop-hold',
      'Dead Bug Pullover — Dumbbell Tabletop Hold',
      'dumbbell', 'tabletop_hold',
      34, 30, 44, 36, 34, 24, 28, 18, 24, 34, 24, 48, 24
    ),
    (
      'medicine-ball-tabletop-hold',
      'Dead Bug Pullover — Medicine-Ball Tabletop Hold',
      'medicine_ball', 'tabletop_hold',
      32, 28, 40, 34, 32, 22, 24, 16, 22, 32, 20, 44, 24
    ),
    (
      'band-tabletop-hold',
      'Dead Bug Pullover — Band Tabletop Hold',
      'bands', 'tabletop_hold',
      36, 30, 46, 42, 38, 24, 16, 18, 20, 34, 14, 52, 24
    ),
    (
      'dumbbell-contralateral-leg-extension',
      'Dead Bug Pullover — Dumbbell with Contralateral Leg Extension',
      'dumbbell', 'alternating_contralateral_leg_extension',
      46, 40, 62, 48, 42, 30, 30, 26, 34, 46, 26, 66, 30
    ),
    (
      'band-contralateral-leg-extension',
      'Dead Bug Pullover — Band with Contralateral Leg Extension',
      'bands', 'alternating_contralateral_leg_extension',
      48, 40, 66, 54, 46, 30, 18, 26, 32, 46, 16, 70, 30
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
      seed.leg_action,
      'bilateral_pullover',
      'trunk_anti_extension',
      'controlled_range',
      'full_reset'
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
      'start', 'supine_declared_dead_bug_start',
      'implement', seed.implement_key,
      'implementLoad', 'declared_and_repeatable',
      'grip', 'declared_two_hand_control',
      'bandAnchor',
        CASE WHEN seed.implement_key = 'bands'
          THEN 'secure_inspected_overhead_anchor_required'
          ELSE 'not_applicable'
        END,
      'armAction', 'bilateral_controlled_overhead_pullover',
      'legAction', seed.leg_action,
      'trunkContract', 'rib_pelvis_stack_and_lumbar_pelvic_anti_extension',
      'range', 'declared_owned_pain_free_range',
      'breathing', 'continuous_or_declared_exhale_without_losing_brace',
      'completion', 'controlled_return_and_full_reset',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod',
        CASE seed.implement_key
          WHEN 'bands' THEN 'declared_band_tension_and_anchor_distance'
          ELSE 'declared_implement_mass'
        END,
      'loadingType', 'external_arm_resistance_with_supine_trunk_anti_extension',
      'impactClass', 'no_impact',
      'primaryStress', jsonb_build_array(
        'loaded_shoulder_flexion_and_extension',
        'latissimus_and_serratus_control',
        'abdominal_wall_anti_extension',
        'grip_or_band_tension_control',
        CASE WHEN seed.leg_action = 'tabletop_hold'
          THEN 'static_hip_position_control'
          ELSE 'contralateral_hip_extension_and_trunk_coordination'
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
        'loaded_shoulder_flexion_volume', 'trunk_anti_extension_volume',
        'grip_or_band_tension_time', 'contralateral_limb_repetitions',
        'technical_sensitivity', 'overhead_and_lat_fatigue'
      ),
      'fatigueSignals', jsonb_build_array(
        'rib_flare_or_lumbar_extension', 'pelvic_shift_or_leg_path_change',
        'shoulder_shrug_or_range_loss', 'implement_or_band_path_drift',
        'breath_holding', 'tempo_or_reset_failure'
      )
    ),
    jsonb_build_object(
      'primaryPhase', 'resilience',
      'secondaryPhase', 'capacity',
      'placement',
        'before_material_trunk_lat_shoulder_overhead_grip_or_hip_flexor_fatigue',
      'freshnessSensitive',
        seed.leg_action = 'alternating_contralateral_leg_extension',
      'prescriptionUnit', 'quality_repetitions',
      'implementAndLegActionMustBeExplicit', TRUE,
      'bandAnchorCheckRequired', seed.implement_key = 'bands',
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM dead_bug_pullover_variant_seed seed
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
      WHEN 'strength-capacity'
        THEN 'Build controlled loaded pullover and anti-extension capacity while preserving exact implement, leg-action, range, breathing, return, and reset contracts.'
      ELSE
        'Develop repeatable trunk, shoulder, breathing, implement, and declared leg-action control at low-to-moderate loading.'
    END,
    CASE phase.profile_key WHEN 'strength-capacity' THEN 86 ELSE 94 END,
    CASE phase.profile_key WHEN 'strength-capacity' THEN 88 ELSE 94 END,
    jsonb_build_object(
      'trunkAntiExtensionControl',
        CASE phase.profile_key WHEN 'control-resilience' THEN 96 ELSE 82 END,
      'loadedPulloverCapacity',
        CASE phase.profile_key WHEN 'strength-capacity' THEN 92 ELSE 68 END,
      'breathingAndPosition', 88,
      'fatigueConditioning', 8
    ),
    jsonb_build_object(
      'sets', CASE phase.profile_key WHEN 'strength-capacity' THEN '2-4' ELSE '1-3' END,
      'repetitions', CASE phase.profile_key WHEN 'strength-capacity' THEN '5-10' ELSE '4-8' END,
      'restSeconds', CASE phase.profile_key WHEN 'strength-capacity' THEN '60-120' ELSE '30-75' END,
      'tempo', 'controlled_two_to_four_second_reach_and_return',
      'effort',
        CASE phase.profile_key
          WHEN 'strength-capacity'
            THEN 'challenging_only_while_every_position_and_control_gate_holds'
          ELSE 'submaximal_quality_rehearsal'
        END,
      'implement', seed.implement_key,
      'legAction', seed.leg_action,
      'range', 'declared_owned_pain_free_range',
      'breathing', 'continuous_or_declared_exhale_without_losing_brace',
      'reset', 'full_before_every_repetition'
    ),
    'The exact implement, load, anchor when applicable, and leg action are used; ribs and pelvis stay organized; breathing continues; shoulder, implement, and leg paths remain controlled through owned range; return and reset are complete without symptoms.',
    ARRAY[
      'Stop for pain, pinching, numbness, dizziness, pressure symptoms, coning, doming, or apprehension.',
      'Stop for an implement slip, damaged band, anchor shift, unsafe floor, overhead space, or traffic condition.',
      'Stop for rib flare, lumbar extension, pelvic shift, shoulder shrug, path drift, breath-holding, or an undeclared leg action.',
      'Stop when range, tempo, breathing, return, reset, or repetition quality materially declines.'
    ]::TEXT[],
    'Declare implement, load, anchor, leg action, range, tempo, breathing, repetitions, rest, and reset. Observe rib-pelvis position, shoulder and implement path, breathing, leg path, symptoms, return, and reset from outside the implement or band recoil path.',
    'Ribs over pelvis; reach only as far as you can own; exhale, return, reset.',
    CASE phase.profile_key
      WHEN 'strength-capacity'
        THEN 'Greater loaded pullover and trunk anti-extension capacity without losing position or breathing.'
      ELSE
        'More repeatable rib-pelvis, shoulder, breathing, implement, and leg-action control.'
    END,
    ARRAY[seed.implement_key]::TEXT[],
    jsonb_build_object(
      'surface', 'level_floor_or_mat',
      'participants', 'one_athlete_per_station',
      'setupSeconds', CASE seed.implement_key WHEN 'bands' THEN 60 ELSE 30 END,
      'transitionSeconds', 15,
      'anchorInspectionRequired', seed.implement_key = 'bands',
      'implementStorage', 'outside_neighboring_overhead_and_walking_paths',
      'coachPosition', 'outside_implement_and_band_recoil_paths'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'repetitionSeconds', 8,
      'resetSeconds', 4,
      'setDurationFormula', 'repetitions_x_repetition_plus_reset',
      'setupSeconds', CASE seed.implement_key WHEN 'bands' THEN 60 ELSE 30 END,
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_resistance', 'shorten_shoulder_range',
        'use_tabletop_hold_or_feet_support', 'remove_leg_motion',
        'reduce_repetitions', 'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'resistance', 'shoulder_range', 'leg_lever',
        'tempo', 'repetitions'
      ),
      'symptomRule', 'stop_and_select_reviewed_pain_free_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'implement', 'load_or_band_tension', 'anchor_status',
        'leg_action', 'range', 'tempo', 'quality_repetitions',
        'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'shoulder_angle', 'band_anchor_distance', 'breathing_pattern',
        'rib_flare_or_lumbar_extension_error',
        'pelvic_or_leg_path_error', 'rate_of_perceived_effort'
      ),
      'comparisonRule',
        'Compare only when implement, load or band tension, anchor, leg action, range, tempo, breathing, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm implement, load, anchor status, leg action, range, tempo, breathing, and reset.',
        'Report pain, pressure symptoms, coning, doming, dizziness, apprehension, or equipment uncertainty.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch start, ribs and pelvis, shoulder and implement path, breathing, declared leg action, return, and reset.',
        'Stop immediately on any symptom, equipment, anchor, safety, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions, exact setup, errors, symptoms, stop reason, and substitutions.',
        'Do not increase load, range, or leg lever after a stop trigger.'
      ),
      'supportEscalation',
        'Escalate symptoms, anchor failure, identity mismatch, or inaccessible instruction through the documented support path.',
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM dead_bug_pullover_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN (
    VALUES
      ('control-resilience', 'resilience', 'primary'),
      ('strength-capacity', 'capacity', 'secondary')
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
        'dumbbell-tabletop-hold',
        'dumbbell-contralateral-leg-extension',
        'progression', 94,
        ARRAY['complexity', 'load', 'leverage']::TEXT[],
        'Adding alternating contralateral leg extension preserves the dumbbell pullover while increasing lever, coordination, anti-extension, and technical demand.',
        '{"requiresStableTabletopVariant":true,"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-contralateral-leg-extension',
        'dumbbell-tabletop-hold',
        'regression', 94,
        ARRAY['complexity', 'load', 'leverage']::TEXT[],
        'Removing leg motion preserves the dumbbell pullover while lowering lever, coordination, and anti-extension demand.',
        '{"legAction":"tabletop_hold","humanReviewRequired":true}'::JSONB
      ),
      (
        'band-tabletop-hold',
        'band-contralateral-leg-extension',
        'progression', 94,
        ARRAY['complexity', 'load', 'leverage']::TEXT[],
        'Adding alternating contralateral leg extension preserves the anchored-band pullover while increasing lever, coordination, and technical demand.',
        '{"requiresStableTabletopVariant":true,"anchorMustRemainIdentical":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'band-contralateral-leg-extension',
        'band-tabletop-hold',
        'regression', 94,
        ARRAY['complexity', 'load', 'leverage']::TEXT[],
        'Removing leg motion preserves the anchored-band pullover while reducing lever and coordination demand.',
        '{"legAction":"tabletop_hold","humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-tabletop-hold',
        'dumbbell-tabletop-hold',
        'lateral_substitution', 84,
        ARRAY['equipment', 'grip', 'load']::TEXT[],
        'A declared two-hand dumbbell can preserve the tabletop loaded pullover intent when medicine-ball mass, grip, and range are reassessed.',
        '{"exactLoadRangeAndGripMustBeReassessed":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-tabletop-hold',
        'medicine-ball-tabletop-hold',
        'lateral_substitution', 84,
        ARRAY['equipment', 'grip', 'load']::TEXT[],
        'A declared medicine ball can preserve the tabletop loaded pullover intent when mass, grip, and range are reassessed.',
        '{"exactLoadRangeAndGripMustBeReassessed":true,"humanReviewRequired":true}'::JSONB
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
  FROM dead_bug_pullover_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        'Exercise complexity reflects exact implement handling, anchor management when used, shoulder range, breathing, anti-extension, declared leg action, return, and reset.'
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        'Physical difficulty reflects declared external resistance, shoulder and lat loading, trunk anti-extension, grip or band tension, and leg lever when prescribed.'
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

  CREATE TEMP TABLE dead_bug_pullover_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO dead_bug_pullover_source_seed VALUES
    (
      'nasm_dead_bug_instruction',
      'https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug',
      'National Academy of Sports Medicine',
      'professional_standard',
      80
    ),
    (
      'dying_bug_trunk_emg_progression',
      'https://pubmed.ncbi.nlm.nih.gov/11689975/',
      'Electromyographic activity of selected trunk muscles during dynamic spine stabilization exercises',
      'Archives of Physical Medicine and Rehabilitation',
      'peer_reviewed_research',
      86
    ),
    (
      'dead_bug_limb_and_speed_emg',
      'https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise',
      'Physical Therapy Rehabilitation Science',
      'peer_reviewed_research',
      82
    ),
    (
      'rpi_anti_extension_dead_bug_progressions',
      'https://rehabilitationperformance.com/training-anti-extension/',
      'Training Anti-Extension',
      'Rehabilitation & Performance Institute',
      'expert_instruction',
      74
    ),
    (
      'total_pt_dead_bug_variations',
      'https://total-pt.com/2020/03/27/core-stability-exercises-dead-bug-variations/',
      'Dead Bug Exercise Variations',
      'Total Physical Therapy',
      'expert_instruction',
      72
    ),
    (
      'barbend_dead_bug_dumbbell_pullover',
      'https://barbend.com/dumbbell-pullover-guide/',
      'How to Do the Dumbbell Pullover for a Bigger Back and Chest',
      'BarBend',
      'expert_instruction',
      68
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE dead_bug_pullover_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO dead_bug_pullover_evidence_seed VALUES
    (
      'identity', 'nasm_dead_bug_instruction',
      '["The stable identity is a loaded bilateral pullover under a supine dead-bug anti-extension contract.","Dumbbell, medicine-ball, band, breathing, and declared leg-motion differences are variants or delivery dimensions, not exercise skill levels."]'::JSONB
    ),
    (
      'taxonomy', 'total_pt_dead_bug_variations',
      '["Weighted and band reaches are dead-bug variations selected according to control and symptoms.","Implement, resistance direction, arm path, leg action, range, tempo, and breathing must be explicit."]'::JSONB
    ),
    (
      'anatomy', 'dying_bug_trunk_emg_progression',
      '["Dying-bug progressions recruit rectus abdominis and abdominal obliques with activity changing by progression.","Declare abdominal and spinal stabilization, lat and shoulder control, hip contribution, joints, actions, planes, and laterality."]'::JSONB
    ),
    (
      'biomechanics', 'dead_bug_limb_and_speed_emg',
      '["Upper-limb, lower-limb, combined-limb, and movement-speed conditions change abdominal activity.","Observe start, rib-pelvis stack, shoulder and implement path, declared leg action, range, breathing, return, and reset."]'::JSONB
    ),
    (
      'difficulty', 'dead_bug_limb_and_speed_emg',
      '["Combined upper- and lower-limb motion changes demand compared with upper-limb-only work.","Score exercise complexity and physical difficulty by exact variant and derive overall as their maximum; assign no exercise skill level."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'barbend_dead_bug_dumbbell_pullover',
      '["A dead-bug pullover adds external arm loading while requiring positional trunk control.","Budget shoulder and lat loading, anti-extension work, grip or band tension, optional hip motion, and technical sensitivity without impact contacts."]'::JSONB
    ),
    (
      'constraints', 'rpi_anti_extension_dead_bug_progressions',
      '["Band assistance, knee angle, and leg lever vary while low-back control remains required.","Declare floor, implement, load, anchor, overhead space, leg action, pain-free range, coach sightline, and immediate equipment stop rules."]'::JSONB
    ),
    (
      'dosage', 'total_pt_dead_bug_variations',
      '["Variation selection should preserve control and avoid symptoms.","Use low-to-moderate quality repetitions, deliberate tempo, full reset, and enough rest to preserve trunk, shoulder, breathing, implement, and leg-action control."]'::JSONB
    ),
    (
      'instructions', 'nasm_dead_bug_instruction',
      '["A supine 90/90 setup, trunk engagement, and controlled limb movement establish the baseline.","Set ribs over pelvis, declare implement and leg action, reach only through owned range, exhale without losing the brace, return, and reset."]'::JSONB
    ),
    (
      'safety_stop_rules', 'rpi_anti_extension_dead_bug_progressions',
      '["Range and lever should change when low-back control cannot be maintained.","Stop for symptoms, equipment or anchor problems, rib flare, lumbar extension, pelvic shift, shoulder shrug, breath-holding, or repeated path and tempo failure."]'::JSONB
    ),
    (
      'programming', 'dead_bug_limb_and_speed_emg',
      '["Limb combination and movement speed change abdominal demand.","Use tabletop variants for lower-complexity control and contralateral-leg variants for higher coordination, with load and phase intent declared separately."]'::JSONB
    ),
    (
      'athlete_support', 'total_pt_dead_bug_variations',
      '["Expose implement, load, anchor, leg action, range, tempo, breathing, repetitions, rest, cue, and stop signal.","Offer lighter resistance, shorter range, feet support, tabletop hold, fewer movements, fewer repetitions, and longer rest without exercise skill levels."]'::JSONB
    ),
    (
      'coach_support', 'barbend_dead_bug_dumbbell_pullover',
      '["The task combines pullover loading with core stability and positional awareness.","Coach support must expose resistance, anchor, start, leg action, range, tempo, dose, observation, faults, symptoms, and shutdown."]'::JSONB
    ),
    (
      'accessibility', 'total_pt_dead_bug_variations',
      '["Dead-bug variations can be selected to match control and symptoms.","Options include support, light resistance, shorter range, slower tempo, tactile or visual targets, fewer repetitions, longer rest, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'rpi_anti_extension_dead_bug_progressions',
      '["Resistance source and leg lever change within the dead-bug family.","Rotation-resist pulldowns, presses, unloaded dead bugs, unilateral pullovers, and compression tasks require separate variant or definition review."]'::JSONB
    ),
    (
      'media', 'youtube_embed_help',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five candidates have healthy metadata only; full viewing, exact-match, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
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
  FROM dead_bug_pullover_evidence_seed evidence
  JOIN dead_bug_pullover_source_seed source
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
    NULL,
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
        'eaHxEKTiviQ',
        'https://www.youtube.com/watch?v=eaHxEKTiviQ',
        'Exercise Tutorial: Dead Bug Pullover',
        'Functional Fitness VA',
        'Legacy exact-name link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing, exact implement and leg-action match, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        '7ee9w2zYFr0',
        'https://www.youtube.com/watch?v=7ee9w2zYFr0',
        'Dead Bug Dumbbell Pullover - OPEX Exercise Library',
        'OPEX Fitness',
        'Legacy dumbbell link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'lOsWCeXZuU8',
        'https://www.youtube.com/watch?v=lOsWCeXZuU8',
        'Band Resisted Dead Bug Pullover',
        'Sergent Wellness',
        'Legacy band link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'KiOGLd7RWqk',
        'https://www.youtube.com/watch?v=KiOGLd7RWqk',
        'How to do a DEAD BUG | Modifications + 2 Variations [Dumbbell & Resistance Bands]',
        'trainwell',
        'Legacy multi-variation link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'qv3XJ_bG_Lc',
        'https://www.youtube.com/watch?v=qv3XJ_bG_Lc',
        'Dead Bug Pullover Tutorial',
        'Chad Hargrove',
        'Legacy exact-name link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      )
  ) AS media(
    video_id, url, title, channel_name, source_query, notes
  )
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
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
        'Dead Bug Pullover', 'same_identity',
        'Stable broad identity for the loaded bilateral pullover under a dead-bug trunk-control contract.',
        '{"implement":"declared_by_variant","legAction":"declared_by_variant"}'::JSONB
      ),
      (
        'Dumbbell Dead Bug Pullover', 'same_identity',
        'Dumbbell loading changes resistance and physical difficulty without changing the primary action.',
        '{"implement":"dumbbell"}'::JSONB
      ),
      (
        'Medicine Ball Dead Bug Pullover', 'same_identity',
        'Medicine-ball loading changes implement handling without changing the primary action.',
        '{"implement":"medicine_ball"}'::JSONB
      ),
      (
        'Band-Resisted Dead Bug Pullover', 'same_identity',
        'An anchored band changes resistance direction and setup but preserves the loaded pullover identity.',
        '{"implement":"resistance_band","anchor":"declared_and_secure"}'::JSONB
      ),
      (
        'Dead Bug Pullover with Exhale', 'modifier_annotation',
        'A coached exhale changes breathing emphasis and phase intent but not primary movement identity.',
        '{"breathing":"declared_exhale_emphasis"}'::JSONB
      ),
      (
        'Dumbbell Dead Bug Pullover with Contralateral Leg Extension', 'new_variant',
        'Adding alternating leg extension increases lever, coordination, and anti-extension demand.',
        '{"implement":"dumbbell","legAction":"contralateral_extension"}'::JSONB
      ),
      (
        'Band Dead Bug Pullover with Contralateral Leg Extension', 'new_variant',
        'Combined leg motion and anchored band tension increase coordination and setup demand.',
        '{"implement":"resistance_band","legAction":"contralateral_extension"}'::JSONB
      ),
      (
        'Kettlebell Dead Bug Pullover', 'new_variant',
        'A kettlebell changes grip and mass distribution while retaining the loaded pullover identity.',
        '{"implement":"kettlebell"}'::JSONB
      ),
      (
        'Single-Arm Dead Bug Pullover', 'new_variant',
        'Unilateral loading adds anti-rotation and asymmetrical grip and shoulder demand requiring exact scoring.',
        '{"armLoading":"unilateral","antiRotationDemand":"increased"}'::JSONB
      ),
      (
        'Dead Bug Band Pulldown with Rotation Resist', 'new_definition',
        'A downward band pull with rotational resistance changes resistance direction and anti-motion contract.',
        '{"primaryAction":"band_pulldown_hold","antiMotion":"anti_extension_and_anti_rotation"}'::JSONB
      ),
      (
        'Medicine Ball Dead Bug Press', 'new_definition',
        'A hand-to-knee press changes the primary action from shoulder pullover to compression or press.',
        '{"primaryAction":"press_or_compression"}'::JSONB
      ),
      (
        'Unloaded Dead Bug', 'new_definition',
        'The ordinary alternating-limb dead bug has no external pullover resistance and remains separate.',
        '{"externalResistance":"none","primaryAction":"alternating_limb_control"}'::JSONB
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
  SET technical = 3.4,
      load = 3.0,
      overall = greatest(3.4, 3.0),
      notes =
        'Candidate baseline values represent the dumbbell tabletop-hold variant; exact variant assignment and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 34,
      absolute_load_demand = 30,
      coordination_demand = 44,
      impact = 1,
      supervision_demand = 36,
      base_overall_difficulty = greatest(34, 30),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'loaded_supine_anti_extension_pullover',
        'legacyExactContractSelectable', FALSE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 64,
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
      movement_family = 'Loaded supine anti-extension pullover',
      primary_phase_key = 'resilience',
      phase_subrole = 'loaded_anti_extension_control',
      primary_order_slot = 'trunk_anti_extension_control',
      card_summary =
        'Loaded bilateral pullover from a declared dead-bug start with exact implement, leg-action, range, breathing, and reset contracts.',
      description =
        'Move a declared resistance through a controlled bilateral pullover while preserving the rib-pelvis stack and only the declared leg action.',
      instructions =
        'Declare implement, load, anchor, leg action, range, tempo, breathing, repetitions, rest, and reset. Reach only through owned range, return under control, and reset.',
      coach_language =
        'Observe start, rib-pelvis position, breathing, shoulder and implement path, anchor, declared leg action, range, return, and reset. Stop on symptoms, unsafe equipment, position loss, or repeated quality error.',
      athlete_language =
        'Ribs over pelvis; reach only as far as you can own; exhale, return, reset.',
      scalable_variables = ARRAY[
        'implement', 'load_or_band_tension', 'anchor_distance',
        'leg_action', 'shoulder_range', 'tempo', 'breathing_emphasis',
        'repetitions', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'start', 'supine_declared_dead_bug',
        'arm_action', 'bilateral_controlled_pullover',
        'trunk_contract', 'rib_pelvis_stack_and_anti_extension',
        'implement_and_leg_action', 'exact_variant_required',
        'completion', 'controlled_return_and_full_reset',
        'selectable_exact_variant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact implement, load, anchor, leg action, range, tempo, breathing, dose, rest, and reset.',
          'Inspect floor, overhead space, implement, band and anchor when used, traffic, and coach sightline.'
        ),
        'quality_gate', jsonb_build_array(
          'Ribs and pelvis remain organized while breathing continues.',
          'Shoulder, implement, and declared leg paths remain controlled through owned range.',
          'Return and full reset occur without symptoms or equipment error.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, pressure symptoms, coning, doming, numbness, dizziness, or apprehension',
          'Implement slip, damaged band, anchor shift, unsafe floor, space, or traffic',
          'Rib flare, lumbar extension, pelvic shift, shoulder shrug, path drift, breath-holding, or repeated tempo failure'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule', 'select_exact_implement_and_leg_action_contract',
        'fatigue_rule',
          'place_before_material_trunk_lat_shoulder_overhead_grip_or_hip_flexor_fatigue',
        'substitution_rule',
          'never_silently_change_implement_anchor_leg_action_range_or_primary_action',
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
        '328_coaching_dead_bug_pullover_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'dead-bug-pullover-family-v1',
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
