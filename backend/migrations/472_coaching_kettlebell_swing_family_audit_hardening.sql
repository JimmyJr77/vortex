-- Replace the generic Kettlebell Swing source baseline with exact shoulder-height
-- working specifications and author the mechanically distinct overhead swing as
-- its own review-only card. No media, relationship, calibration, or publication
-- approval is inferred by this migration.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '472_coaching_kettlebell_swing_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.79';
  swing_definition UUID;
  overhead_definition UUID := gen_random_uuid();
  affected_definition_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[11];
  source_variant UUID;
  swing_two_hand UUID := gen_random_uuid();
  swing_one_hand UUID := gen_random_uuid();
  overhead_two_hand UUID := gen_random_uuid();
  overhead_one_hand UUID := gen_random_uuid();
  active_variant_ids UUID[];
  all_family_variant_ids UUID[];
  deadlift_definition UUID;
  deadlift_variant UUID;
  rdl_definition UUID;
  rdl_variant UUID;
  overhead_carry_definition UUID;
  strict_press_definition UUID;
  swing_video_ids CONSTANT TEXT[] := ARRAY[
    'IW979LifpGo','PAhDt_0PjP4','fvQoQsDk40M','yHxcTn1UeAc'];
  overhead_video_ids CONSTANT TEXT[] := ARRAY[
    'MjZgWEr7dn8','d94xX-AQZ0A','dUlk6ZmFtAU','mKDIuUbH94Q'];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO swing_definition
  FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=11;

  SELECT id INTO source_variant
  FROM coaching.exercise_variant_v1
  WHERE definition_id=swing_definition AND variant_key='baseline';

  SELECT id INTO deadlift_definition FROM coaching.exercise_definition_v1
  WHERE slug='kettlebell-deadlift' AND status<>'archived';
  SELECT id INTO deadlift_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=deadlift_definition AND variant_key='baseline' AND status<>'archived';

  SELECT id INTO rdl_definition FROM coaching.exercise_definition_v1
  WHERE slug='romanian-deadlift' AND status<>'archived';
  SELECT id INTO rdl_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=rdl_definition AND variant_key='single-kettlebell-standard-tempo'
    AND status<>'archived';

  SELECT id INTO overhead_carry_definition FROM coaching.exercise_definition_v1
  WHERE slug='overhead-carry' AND status<>'archived';
  SELECT id INTO strict_press_definition FROM coaching.exercise_definition_v1
  WHERE slug='strict-overhead-press' AND status<>'archived';

  affected_definition_ids := ARRAY[swing_definition,overhead_definition];
  active_variant_ids := ARRAY[
    swing_two_hand,swing_one_hand,overhead_two_hand,overhead_one_hand];
  all_family_variant_ids := ARRAY[
    source_variant,swing_two_hand,swing_one_hand,overhead_two_hand,overhead_one_hand];

  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=swing_definition AND slug='kettlebell-swing' AND status<>'archived')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE definition_id=swing_definition AND legacy_exercise_id=11)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=swing_definition)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=deadlift_definition AND slug='kettlebell-deadlift' AND status<>'archived')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=deadlift_variant AND definition_id=deadlift_definition AND status<>'archived')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rdl_definition AND slug='romanian-deadlift' AND status<>'archived')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rdl_variant AND definition_id=rdl_definition AND status<>'archived') THEN
    RAISE EXCEPTION '% prerequisite identity state is missing or drifted',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(ARRAY[overhead_carry_definition,strict_press_definition])
        AND status<>'archived')<>2 THEN
    RAISE EXCEPTION '% overhead carry or strict press neighbor is missing',migration_key;
  END IF;

  IF EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND definition_id<>ALL(affected_definition_ids)) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(all_family_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_family_variant_ids)
          OR to_variant_id=ANY(all_family_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status IN('approved'))
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_family_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=ANY(source_ids)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_family_variant_ids)
      OR to_variant_id=ANY(all_family_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_family_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET source_kind='legacy_migration',
      provenance_json=coalesce(provenance_json,'{}'::JSONB)
        ||jsonb_build_object(
          'migration',migration_key,
          'sourceDisposition','mapped_to_exact_shoulder_height_working_specifications',
          'sourceMovementEvidence','ballistic_hip_hinge_with_kettlebell_terminal_height_unspecified',
          'representedBySelectableSourceVariant',FALSE,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE definition_id=swing_definition AND legacy_exercise_id=11;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1
  SET variant_key='identity-quarantine-source-11',
      display_name='Kettlebell Swing Identity Quarantine — Source 11',
      modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
      requirements_json=jsonb_build_object(
        'selectable',FALSE,'representation','identity_quarantine',
        'sourceLegacyExerciseId',11,
        'archiveReason','generic_source_does_not_fix_hand_count_bell_count_terminal_height_swing_style_start_reset_load_cadence_dose_or_stop_rule',
        'researchAuthoredReplacementRequired',TRUE,
        'humanReviewRequired',TRUE),
      load_profile_json=jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=jsonb_build_object('selectable',FALSE),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','identity_quarantine','selectable',FALSE,
        'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  SELECT d.id,1,d.legacy_id,d.slug,d.canonical_name,d.display_name,d.aliases,
    d.description,d.family_key,'2.0.0',2,'review',
    d.content_confidence,d.scoring_confidence,50,d.movement_patterns,
    d.body_regions,ARRAY['kettlebell']::TEXT[],
    ARRAY['floor_marker','timer','video_capture']::TEXT[],
    jsonb_build_object(
      'surface','level_dry_non_slip_floor_compatible_with_kettlebell_set_down',
      'station','one_athlete_one_declared_bell_and_clear_swing_arc',
      'clearance',CASE WHEN d.overhead THEN jsonb_build_array(
        'full_backswing_arc','full_overhead_bell_and_arm_path','ceiling_and_fixture_clearance',
        'safe_bell_park_zone','no_cross_traffic') ELSE jsonb_build_array(
        'full_backswing_arc','chest_to_shoulder_height_forward_arc',
        'safe_bell_park_zone','no_cross_traffic') END,
      'equipmentInspection',jsonb_build_array(
        'bell_mass_and_handle_recorded','handle_dry_and_undamaged',
        'bell_stable_on_floor','footwear_and_floor_dry'),
      'coachSightline','side_view_for_hinge_and_front_quarter_for_symmetry_grip_and_bell_path',
      'changeRule','Hand count, bell count, terminal height, swing style, stance, release, catch, stop between repetitions, load, cadence, dose, and park method must be declared and revalidated.'),
    jsonb_build_object(
      'defaultPopulation','participants_with_a_repeatable_loaded_hip_hinge_secure_grip_and_controlled_bell_hike_float_return_and_park',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array(
        'pain_free_loaded_hip_hinge','secure_two_hand_or_one_hand_grip_for_assigned_variant',
        'can_hike_and_park_the_bell_under_control','can_brace_and_breathe_without_losing_trunk_position',
        CASE WHEN d.overhead THEN 'assigned_overhead_range_and_bell_control_are_tolerated'
          ELSE 'assigned_chest_to_shoulder_height_float_is_controlled' END,
        'can_stop_on_command_and_report_symptoms_or_uncertainty'),
      'cautions',jsonb_build_array(
        'current_or_recent_hand_wrist_elbow_shoulder_spine_hip_knee_ankle_or_pelvic_floor_symptoms',
        'uncontrolled_blood_pressure_or_exertional_symptoms_requiring_clinical_guidance',
        'dizziness_balance_concern_or_grip_uncertainty',
        'pregnancy_or_postpartum_pressure_load_or_balance_concern',
        'recent_high_volume_hinge_sprint_jump_deadlift_carry_or_grip_training',
        'unfamiliar_bell_handle_or_unsafe_floor_clearance_or_group_spacing'),
      'doNotAutoSelect',jsonb_build_array(
        'loaded_hinge_or_bell_park_is_not_controlled','grip_or_bell_path_is_uncertain',
        'pain_guarding_neurologic_dizzy_or_unusual_exertional_symptoms',
        CASE WHEN d.overhead THEN 'overhead_range_control_or_ceiling_clearance_is_unavailable'
          ELSE 'chest_height_arc_or_forward_clearance_is_unavailable' END),
      'notClinicalClearance',TRUE,
      'exerciseDifficultyDoesNotEstablishIndividualReadiness',TRUE),
    jsonb_build_object(
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource',d.identity_source,
      'kettlebellSwingAuditMigration',migration_key,
      'researchVersion',research_version,
      'legacySources',CASE WHEN d.legacy_id IS NULL THEN '[]'::JSONB ELSE '[11]'::JSONB END,
      'identityContract',CASE WHEN d.overhead
        THEN 'ballistic_hip_hinge_to_full_overhead_terminal_position'
        ELSE 'ballistic_hip_hinge_to_chest_or_shoulder_height_float' END,
      'activeWorkingSpecifications',CASE WHEN d.overhead
        THEN jsonb_build_array('two-hand-overhead-continuous','one-hand-overhead-continuous')
        ELSE jsonb_build_array('two-hand-shoulder-height-continuous','one-hand-shoulder-height-continuous') END,
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/',
        'https://pubmed.ncbi.nlm.nih.gov/21997449/',
        'https://pubmed.ncbi.nlm.nih.gov/26618061/',
        'https://pubmed.ncbi.nlm.nih.gov/32131695/',
        'https://pubmed.ncbi.nlm.nih.gov/22207261/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/',
        'https://pubmed.ncbi.nlm.nih.gov/37126368/',
        'https://pubmed.ncbi.nlm.nih.gov/36548500/'),
      'researchLimits','Acute biomechanics and descriptive EMG do not establish individual safety, treatment effect, injury prevention, universal load, universal dose, long-term transfer, or difficulty score.',
      'mediaState','four_current_oembed_healthy_candidates_unreviewed',
      'oembedCheckedAt','2026-08-02',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'gluteus_maximus','hamstrings','adductor_magnus','erector_spinae'),
      'secondaryMuscles',jsonb_build_array(
        'quadriceps','gastrocnemius','soleus','latissimus_dorsi',
        'anterior_deltoid','posterior_deltoid','forearm_flexors','abdominal_wall'),
      'stabilizers',jsonb_build_array(
        'obliques','deep_spinal_stabilizers','gluteus_medius',
        'rotator_cuff','scapular_stabilizers','foot_intrinsics'),
      'joints',jsonb_build_array(
        'foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine',
        'glenohumeral_joint','scapulothoracic_articulation','elbow','wrist','hand'),
      'jointActions',CASE WHEN d.overhead THEN jsonb_build_array(
        'backswing_hip_flexion_with_small_knee_flexion',
        'ballistic_hip_extension_with_knee_and_ankle_contribution',
        'trunk_bracing_against_bell_momentum',
        'shoulder_flexion_and_scapular_upward_rotation_to_full_overhead_position',
        'elbow_extension_and_grip_control','controlled_overhead_to_backswing_return')
        ELSE jsonb_build_array(
        'backswing_hip_flexion_with_small_knee_flexion',
        'ballistic_hip_extension_with_knee_and_ankle_contribution',
        'trunk_bracing_against_bell_momentum',
        'shoulder_flexion_to_chest_or_shoulder_height_float_without_front_raise',
        'elbow_extension_and_grip_control','controlled_float_to_backswing_return') END,
      'jointActionPhases',jsonb_build_object(
        'hike','bell_passes_high_between_legs_after_hips_move_back',
        'propulsion','hips_extend_and_project_bell_without_an_arm_dominant_lift',
        'terminal',CASE WHEN d.overhead
          THEN 'bell_reaches_declared_full_overhead_position_with_controlled_ribs_pelvis_shoulders_elbows_and_grip'
          ELSE 'bell_floats_at_declared_chest_to_shoulder_height_with_body_tall_and_arms_guiding' END,
        'return','bell_falls_before_the_hips_hinge_and_is_redirected_or_parked'),
      'planes',jsonb_build_array('sagittal','frontal','transverse'),
      'laterality','bilateral',
      'variantLaterality','two_hand_bilateral_or_one_hand_unilateral_with_side_specific_dose',
      'evidenceLimit','Listed muscle and joint roles synthesize technique, EMG, kinematic, kinetic, and modeling evidence; they do not quantify every individual, style, load, repetition, or outcome.'),
    jsonb_build_object(
      'whyItMatters',CASE WHEN d.overhead
        THEN 'A ballistic hinge that continues the bell to a controlled overhead terminal position. It adds overhead range, timing, clearance, and return-path demands beyond a shoulder-height swing.'
        ELSE 'A ballistic loaded hinge used for repeatable power or capacity work when the bell floats from hip drive rather than being lifted by the arms.' END,
      'primaryCue',CASE WHEN d.overhead
        THEN 'Hike, snap the hips, guide the bell overhead, own the top, and let it fall before you hinge.'
        ELSE 'Hike, snap the hips, let the bell float to chest or shoulder height, then hinge only as it returns.' END,
      'before',jsonb_build_array(
        'Confirm exact card, hand count, working side, bell count and mass, terminal height, start, cadence, repetitions or time, rest, and park method.',
        'Inspect handle, bell, floor, footwear, backswing and forward or overhead clearance, spacing, and stop signal.',
        'Rehearse the assigned hinge, hike, first repetition, and controlled park with a suitable load.'),
      'during',jsonb_build_array(
        'Keep the bell close on the hike and the feet planted.',
        'Drive the bell with the hips; do not turn the repetition into a squat or front raise.',
        'Stay organized at the terminal position and breathe without losing grip or trunk control.',
        'Let the bell begin returning before moving the hips back; keep the return path clear.'),
      'expectedSensations',jsonb_build_array(
        'glute_hamstring_and_hip_extension_effort','trunk_bracing',
        'forearm_and_grip_effort','heart_rate_and_breathing_increase_with_repeated_work',
        CASE WHEN d.overhead THEN 'shoulder_girdle_effort_through_controlled_overhead_range'
          ELSE 'shoulder_girdle_guidance_at_the_chest_height_float' END),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_pain','joint_pinch','numbness_tingling_or_radiating_symptoms',
        'dizziness_faintness_chest_pressure_or_unusual_breathlessness',
        'grip_slip_or_bell_contact','pelvic_floor_pressure_or_leakage_concern',
        'loss_of_balance_or_uncontrolled_back_or_overhead_position'),
      'painGuidance','Do not complete another repetition. Guide the bell to the assigned safe park only if control remains; otherwise follow the facility emergency-drop plan, clear the area, and tell the coach.',
      'selfChecks',jsonb_build_array(
        'exact_variant_and_load','feet_stable_and_bell_close_on_hike',
        'hips_drive_before_arms','declared_terminal_height_only',
        'ribs_pelvis_and_head_controlled','grip_secure','return_precedes_hinge',
        'cadence_quality_and_breathing_repeatable','controlled_park'),
      'accessibility',jsonb_build_array(
        'written_phase_sequence','live_coach_demonstration','side_and_front_quarter_stills',
        'floor_and_arc_markers','lighter_reviewed_bell','fewer_repetitions',
        'longer_rest','two_hand_shoulder_height_variant_when_the_objective_can_change'),
      'mediaAlternatives',jsonb_build_array(
        'written_hike_propulsion_terminal_return_park_contract',
        'side_and_front_quarter_still_sequence','qualified_live_demonstration'),
      'stopSignal','Call stop, keep others clear, and use the assigned controlled park or emergency-drop procedure.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_definition_variant_hand_side_bell_mass_terminal_height_cadence_and_dose',
        'handle_bell_floor_footwear_arc_clearance_spacing_and_drop_zone',
        'stance_foot_pressure_hinge_depth_and_bell_hike',
        'hip_drive_knee_contribution_and_arm_non_dominance',
        'trunk_head_shoulder_elbow_grip_and_terminal_position',
        'return_timing_bell_proximity_breathing_symptoms_and_park'),
      'faultCorrections',jsonb_build_object(
        'squat_dominant','reduce_load_and_rehearse_the_loaded_hinge',
        'arms_lift_bell','reduce_load_and_cue_hip_drive_then_float',
        'bell_drops_away_or_below_knees','rehearse_close_hike_and_later_hinge_timing',
        'lumbar_extension_or_rib_flare','reduce_height_or_load_and_reestablish_trunk_control',
        'grip_or_bell_path_uncertain','stop_and_park_do_not_coach_through_a_slipping_bell',
        'cadence_or_power_falls','end_set_and_record_first_quality_break',
        'symptoms','stop_exposure_and_follow_facility_health_or_incident_protocol'),
      'demonstrationPlan',jsonb_build_array(
        'show_equipment_and_clearance_check','show_setup_hike_and_first_rep',
        CASE WHEN d.overhead THEN 'show_full_overhead_terminal_position_without_excess_trunk_extension'
          ELSE 'show_chest_to_shoulder_height_float_without_front_raise' END,
        'show_return_timing_and_close_backswing','show_controlled_park_and_emergency_drop_zone',
        'show_first_invalid_repetition_and_stop'),
      'groupManagement',jsonb_build_array(
        'one_athlete_per_marked_station','all_bells_parked_before_coach_enters_arc',
        'stagger_stations_and_face_swing_paths_away_from_traffic',
        'declare_work_rest_and_stop_signal','record_each_side_separately_for_one_hand_variants'),
      'modificationDecisionTree',jsonb_build_array(
        'pain_neurologic_dizzy_unusual_exertional_grip_or_bell_control_issue_stop',
        'identity_hand_count_height_style_or_load_unknown_quarantine_selection',
        'hinge_hike_or_park_failure_use_reviewed_deadlift_or_hinge_practice_if_objective_allows',
        'terminal_position_failure_reduce_load_or_select_reviewed_lower_height_definition',
        'fatigue_or_cadence_failure_end_set_and_recompute_remaining_work',
        'recompute_identity_dose_fatigue_duration_equipment_and_rendering_after_any_change'),
      'validRepetition','The declared setup, hike, ballistic hip drive, terminal height, hand and side contract, controlled return, cadence, breathing, clearance, symptom, and park rules all pass.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity_or_variant_mismatch','unsafe_bell_handle_floor_arc_clearance_or_spacing',
        'pain_neurologic_dizzy_exertional_grip_or_bell_control_event',
        'hinge_hike_terminal_return_cadence_breathing_or_park_failure',
        'load_dose_duration_fatigue_or_recovery_mismatch',
        'broken_inaccessible_or_mismatched_media'),
      'supportEscalation',jsonb_build_object(
        'safety','remove_from_selection_and_alert_coach_or_library_owner',
        'identity','quarantine_and_route_to_canonical_identity_review',
        'symptoms','stop_exposure_and_follow_facility_health_or_incident_protocol',
        'doseOrFatigue','route_to_programming_review_before_reuse',
        'media','quarantine_candidate_and_schedule_re_review'),
      'retentionPolicy',jsonb_build_object(
        'attemptLoadAndDoseRecord','retain_with_saved_workout_version',
        'symptomAndIncidentRecord','facility_health_and_incident_policy',
        'athleteFeedbackDays',365,
        'mediaReview','retain_reviewer_timestamp_card_version_and_decision'),
      'changeImpactPolicy',jsonb_build_object(
        'identityOrSafetyChange','invalidate_release_and_revalidate_saved_workouts',
        'variantScoreLoadOrDoseChange','recompute_selection_fatigue_duration_and_substitutions',
        'instructionChange','increment_card_version_and_recheck_media',
        'mediaChange','invalidate_media_review_only',
        'relationshipChange','revalidate_substitution_and_progression_paths'),
      'generationRecords',jsonb_build_array(
        'definition_id','variant_id','profile_key','hand_count','working_side',
        'bell_count_and_mass','terminal_height','style','start_and_park_method',
        'planned_completed_and_failed_repetitions_or_seconds','cadence_and_rest',
        'first_quality_break_symptoms_stop_reason_duration_and_substitution'),
      'publicationQuarantined',TRUE,'mediaReviewRequired',TRUE,
      'relationshipReviewRequired',TRUE,'calibrationReviewRequired',TRUE)
  FROM (VALUES
    (swing_definition,11,'kettlebell-swing','Kettlebell Swing',
      'Kettlebell Swing',ARRAY[
        'KB Swing','KB Swings','Kettlebell Swings','Russian Kettlebell Swing',
        'Shoulder-Height Kettlebell Swing']::TEXT[],
      'From a declared two-hand or one-hand stance with one kettlebell parked in front, hinge and hike the bell high between the legs. Reverse the backswing with ballistic hip extension so the bell floats to the declared chest-to-shoulder height without an arm-dominant front raise. Stay organized through the terminal float, let the bell fall before hinging, repeat at the assigned cadence, then park under control. Every selectable variant fixes hand count, side, bell mass, terminal height, style, start, cadence, dose, and stop rule.',
      'ballistic_kettlebell_hip_hinge_to_shoulder_height',FALSE,
      ARRAY['hinge','brace']::TEXT[],
      ARRAY['full_body','hip','hamstrings','knee','ankle','core','shoulder','forearm','hand']::TEXT[],
      91,70,
      'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/'),
    (overhead_definition,NULL,'overhead-kettlebell-swing',
      'Overhead Kettlebell Swing','Overhead Kettlebell Swing (American Swing)',
      ARRAY[
        'American Kettlebell Swing','American Swing','KB Overhead Swing',
        'Kettlebell Overhead Swing']::TEXT[],
      'From a declared two-hand or one-hand stance with one kettlebell parked in front, hinge and hike the bell high between the legs. Reverse the backswing with ballistic hip extension and guide the bell through a continuous arc to the declared full overhead terminal position while retaining trunk, shoulder, elbow, grip, and clearance control. Let the bell begin falling before hinging, repeat at the assigned cadence, then park under control. Every selectable variant fixes hand count, side, bell mass, overhead standard, style, start, cadence, dose, and stop rule.',
      'ballistic_kettlebell_hip_hinge_to_full_overhead',TRUE,
      ARRAY['hinge','brace','reach']::TEXT[],
      ARRAY['full_body','hip','hamstrings','knee','ankle','core','shoulder','forearm','hand']::TEXT[],
      90,68,
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/')
  ) d(id,legacy_id,slug,canonical_name,display_name,aliases,description,
      family_key,overhead,movement_patterns,body_regions,content_confidence,
      scoring_confidence,identity_source)
  ON CONFLICT(id) DO UPDATE SET
    legacy_exercise_id=EXCLUDED.legacy_exercise_id,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version='2.0.0',card_version=2,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=50,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,boundary.left_id,boundary.right_id,'distinct_exercises',
    boundary.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',boundary.identity_boundary,
      'leftContract',boundary.left_contract,'rightContract',boundary.right_contract,
      'researchSources',boundary.sources,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_only_neighbor_cards_retain_independent_review_state'),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (swing_definition,overhead_definition,
      'The shoulder-height swing terminates at a chest-to-shoulder float. The overhead swing requires a continuous path to full overhead shoulder flexion, adding range, cycle time, clearance, shoulder control, return path, and failure consequences. They share a hinge base but are not interchangeable identities.',
      'shoulder_height_float_vs_full_overhead_terminal_position',
      'ballistic_hip_hinge_to_chest_or_shoulder_height_float',
      'ballistic_hip_hinge_to_full_overhead_terminal_position',
      jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/',
        'https://pubmed.ncbi.nlm.nih.gov/36548500/')),
    (swing_definition,deadlift_definition,
      'The Kettlebell Swing uses repeated ballistic hip extension to project and redirect the bell. Kettlebell Deadlift starts and finishes with the implement supported on the floor and uses controlled lift and lower phases without a free swing arc.',
      'ballistic_projected_cycle_vs_controlled_floor_to_stand_lift',
      'repeated_hike_float_return_or_declared_park',
      'controlled_floor_lift_lockout_and_floor_return',
      jsonb_build_array(
        'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/',
        'https://pubmed.ncbi.nlm.nih.gov/22207261/')),
    (swing_definition,rdl_definition,
      'The Kettlebell Swing is ballistic and projects the bell away from the body before redirecting it. Romanian Deadlift is a controlled loaded hinge with the implement retained close to the body and no free-flight-like float or cyclic backswing.',
      'ballistic_projected_hinge_vs_controlled_close_load_hinge',
      'rapid_hike_propulsion_float_and_return',
      'controlled_eccentric_hinge_and_concentric_stand',
      jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/21997449/',
        'https://pubmed.ncbi.nlm.nih.gov/22207261/')),
    (overhead_definition,overhead_carry_definition,
      'The Overhead Kettlebell Swing repeatedly propels the bell from a backswing to full overhead and returns it. Overhead Carry begins with a stabilized overhead hold and adds locomotion or sustained position without a ballistic hike, swing cycle, or repeated terminal transition.',
      'ballistic_overhead_swing_cycle_vs_stabilized_overhead_carry',
      'hike_hip_propulsion_overhead_terminal_and_return',
      'overhead_hold_with_declared_carry_distance_or_time',
      jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/')),
    (overhead_definition,strict_press_definition,
      'The Overhead Kettlebell Swing uses hip-generated momentum and a continuous arc from backswing to overhead. Standing Strict Overhead Press starts from a supported rack or shoulder position and uses active shoulder and elbow pressing without leg drive or a backswing.',
      'ballistic_hip_driven_overhead_arc_vs_strict_rack_to_overhead_press',
      'hike_hip_propulsion_overhead_terminal_and_return',
      'strict_upper_body_press_from_declared_rack_to_lockout',
      jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/',
        'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/'))
  ) boundary(left_id,right_id,rationale,identity_boundary,left_contract,
      right_contract,sources)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,v.definition_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',v.speed,'decisionDemand',v.decision,
      'workCapacityDemand',v.work_capacity,'impact',1,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',1,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',1,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'implement','one_kettlebell','handCount',v.hand_count,
      'laterality',CASE WHEN v.hand_count=1
        THEN 'unilateral_left_and_right_sets_recorded_separately'
        ELSE 'bilateral_two_hand_grip' END,
      'style',CASE WHEN v.overhead
        THEN 'continuous_hip_hinge_overhead_swing'
        ELSE 'continuous_hip_hinge_shoulder_height_swing' END,
      'start','bell_parked_ahead_hinge_grip_tilt_and_hike',
      'backswing','bell_high_between_legs_with_hips_back_and_shins_near_vertical',
      'propulsion','ballistic_hip_extension_projects_bell_without_arm_dominant_lift',
      'terminalHeight',v.terminal_height,
      'return','bell_begins_falling_before_hips_hinge_and_stays_close',
      'finish','controlled_final_backswing_then_park_in_declared_zone',
      'load','exact_bell_mass_recorded_and_scaled_to_quality',
      'cadence','profile_declared_and_quality_terminated',
      'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'externalLoadMethod','relative_external',
      'externalLoadDescription','One declared kettlebell; record mass, handle, hand count, working side, terminal height, cadence, repetitions or time, failed repetitions, and park method.',
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'effectiveLoadDrivers',jsonb_build_array(
        'bell_mass','hand_count','working_side','terminal_height','swing_style',
        'hinge_depth','bell_acceleration','cadence','repetitions_or_seconds',
        'rest','grip_fatigue','prior_hinge_sprint_jump_deadlift_carry_and_grip_work'),
      'loadTracking',jsonb_build_array(
        'definition_and_variant','bell_count_and_mass','hand_count_and_side',
        'terminal_height','style','planned_completed_and_failed_repetitions_or_seconds',
        'cadence','rest','first_quality_break','symptoms','same_session_overlap')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',v.recovery_hours,
      'recoveryWindow','context_load_volume_novelty_training_history_symptoms_and_overlapping_hinge_power_grip_or_overhead_work_dependent',
      'primaryFatigueSites',CASE WHEN v.overhead THEN jsonb_build_array(
        'gluteals','hamstrings','trunk_extensors','abdominal_wall','forearms_and_grip',
        'shoulder_girdle','upper_back') ELSE jsonb_build_array(
        'gluteals','hamstrings','trunk_extensors','abdominal_wall','forearms_and_grip') END,
      'earlyFatigueSignals',jsonb_build_array(
        'swing_cycle_lengthens_or_cadence_changes','hip_power_or_terminal_height_falls',
        'squat_depth_increases_or_hinge_timing_changes','bell_drifts_away_or_backswing_drops',
        'arms_lift_or_elbows_bend','ribs_flare_or_spine_position_changes',
        'grip_repositions_or_slips','breath_holding_or_unusual_exertional_response',
        'park_or_stop_becomes_uncertain'),
      'downstreamConflicts',jsonb_build_array(
        'priority_sprint_jump_throw_or_olympic_lift_output',
        'heavy_deadlift_rdl_squat_or_hip_extension_work',
        'high_volume_grip_carry_pull_or_trunk_work',
        CASE WHEN v.overhead THEN 'priority_overhead_press_throw_or_shoulder_work'
          ELSE 'symptomatic_shoulder_or_spine_loading' END),
      'fatigueEvidenceLimit','Observed changes in one maximum-effort interval protocol do not define a universal fatigue threshold, dose, or recovery duration.'),
    jsonb_build_object(
      'trainingStimuli',CASE WHEN v.overhead THEN jsonb_build_array(
        'ballistic_hip_extension','overhead_swing_timing','grip_and_trunk_control',
        'repeat_power_or_capacity_context') ELSE jsonb_build_array(
        'ballistic_hip_extension','shoulder_height_swing_timing',
        'grip_and_trunk_control','repeat_power_or_capacity_context') END,
      'stimulusDose',jsonb_build_object(
        'primary','quality_repetitions_or_seconds_at_declared_cadence',
        'load','exact_kettlebell_mass','countFailedAttemptsAsExposure',TRUE,
        'powerQualityCeiling','end_before_terminal_height_velocity_timing_grip_or_position_declines'),
      'weeklyExposure','Combine valid and failed repetitions and time with all same-session and recent hinge, sprint, jump, deadlift, carry, grip, trunk, and applicable overhead work.',
      'prerequisites',jsonb_build_array(
        'pain_free_loaded_hip_hinge','controlled_hike_and_park',
        'secure_assigned_grip','exact_terminal_height_and_stop_signal_understood'),
      'completionCriteria',jsonb_build_array(
        'exact_definition_variant_load_hand_side_height_style_cadence_and_dose',
        'repeatable_hike_hip_drive_terminal_return_and_park',
        'controlled_feet_knees_hips_trunk_shoulders_elbows_grip_and_breathing',
        'completed_failed_duration_rest_symptoms_and_first_quality_break_recorded'),
      'sequenceRules',jsonb_build_array(
        'place_output_profile_after_general_and_specific_preparation',
        'end_output_set_before_power_timing_or_position_declines',
        'capacity_profile_never_overrides_technique_symptom_grip_or_space_stop_rules',
        'avoid_pre_fatiguing_priority_sprint_jump_lift_or_overhead_work'),
      'interferenceRules',jsonb_build_array(
        'do_not_silently_change_terminal_height_hand_count_bell_count_style_or_stop_contract',
        'do_not_treat_repetition_count_or_time_as_valid_when_quality_gate_fails',
        'recompute_selection_load_fatigue_duration_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object(
        'unknownIdentityLoadHeightStyleCadenceDoseClearanceOrSymptoms','fail_closed_and_request_coach_review',
        'neverInferMissingMechanicsFromNameVideoTitleOrLegacyDose',TRUE,
        'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE),
      'cumulativeBudget',jsonb_build_object(
        'qualityRepetitions',v.rep_budget,'swingSecondsEstimate',v.seconds_budget,
        'landingContacts',0,'failedAttemptsCount',TRUE,
        'sameSessionHingePowerGripTrunkAndApplicableOverheadWorkRequired',TRUE))
  FROM (VALUES
    (swing_two_hand,swing_definition,'two-hand-shoulder-height-continuous',
      'Kettlebell Swing — Two Hand Shoulder Height',
      ARRAY['one_kettlebell','two_hand','shoulder_height','continuous','hip_hinge']::TEXT[],
      2,FALSE,'chest_to_shoulder_height_float',
      56,58,50,34,24,54,58,70,24,60,48,48,55,58,30,52,62,62,60,72,24,40,600),
    (swing_one_hand,swing_definition,'one-hand-shoulder-height-continuous',
      'Kettlebell Swing — One Hand Shoulder Height',
      ARRAY['one_kettlebell','one_hand','shoulder_height','continuous','hip_hinge','side_specific']::TEXT[],
      1,FALSE,'chest_to_shoulder_height_float',
      64,60,56,38,40,66,68,72,32,60,50,50,58,68,38,58,68,64,70,78,24,30,600),
    (overhead_two_hand,overhead_definition,'two-hand-overhead-continuous',
      'Overhead Kettlebell Swing — Two Hand',
      ARRAY['one_kettlebell','two_hand','overhead','continuous','hip_hinge']::TEXT[],
      2,TRUE,'full_overhead_position',
      66,62,54,62,30,64,68,72,32,62,52,56,60,62,44,62,72,66,64,80,30,30,600),
    (overhead_one_hand,overhead_definition,'one-hand-overhead-continuous',
      'Overhead Kettlebell Swing — One Hand',
      ARRAY['one_kettlebell','one_hand','overhead','continuous','hip_hinge','side_specific']::TEXT[],
      1,TRUE,'full_overhead_position',
      74,64,60,68,46,76,78,74,40,62,54,60,64,74,52,70,80,68,76,86,36,24,540)
  ) v(id,definition_id,variant_key,display_name,modifiers,hand_count,overhead,
      terminal_height,complexity,physical,relative_strength,mobility,balance,
      stability,coordination,speed,decision,work_capacity,eccentric,joint_stress,
      spinal_loading,grip,fear,supervision,failure,local_fatigue,grip_fatigue,
      technical_fatigue,recovery_hours,rep_budget,seconds_budget)
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,
    variant_key=EXCLUDED.variant_key,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.variant_id,p.profile_key,p.phase_key,p.role,p.purpose,p.suitability,88,
    jsonb_build_object(
      'ballisticHipExtension',5,'repeatPower',CASE WHEN p.phase_key='output' THEN 5 ELSE 3 END,
      'workCapacity',CASE WHEN p.phase_key='capacity' THEN 5 ELSE 2 END,
      'gripAndTrunkControl',4,'overheadControl',CASE WHEN p.overhead THEN 4 ELSE 0 END,
      'strengthHypertrophyClaim',0,'injuryPreventionClaim',0),
    jsonb_build_object(
      'doseType','quality_repetitions','sets',p.sets,'repetitions',p.reps,
      'sidesMultiplier',CASE WHEN p.hand_count=1 THEN 2 ELSE 1 END,
      'restSeconds',p.rest_seconds,'tempo',p.tempo,
      'bellMass','coach_selected_recorded_quality_preserving_load',
      'terminalHeight',CASE WHEN p.overhead THEN 'full_overhead_position'
        ELSE 'chest_to_shoulder_height_float' END,
      'qualityTerminated',TRUE,'countFailedAttemptsAsExposure',TRUE,
      'evidenceStatus','provisional_coaching_dose_not_a_universal_research_prescription'),
    'Every counted repetition uses the assigned definition, hand count, side, bell mass, terminal height, start, hike, hip drive, return timing, cadence, breathing, clearance, and controlled park while grip and body positions pass.',
    ARRAY[
      'sharp_or_increasing_pain_joint_pinch_numbness_tingling_radiation_dizziness_faintness_chest_pressure_or_unusual_breathlessness',
      'wrong_or_unknown_definition_hand_count_side_bell_mass_terminal_height_style_cadence_dose_or_park_method',
      'bell_handle_floor_footwear_arc_ceiling_spacing_or_drop_zone_becomes_unsafe',
      'grip_slips_repositions_or_can_no_longer_control_the_bell',
      'bell_contacts_body_floor_fixture_or_another_station_unintentionally',
      'stance_changes_feet_shift_balance_is_lost_or_knees_collapse',
      'squat_replaces_hinge_or_backswing_drops_away_from_the_body',
      'arms_lift_elbows_bend_early_or_terminal_height_is_forced',
      'ribs_flare_spine_position_changes_or_overhead_position_is_not_owned',
      'cycle_time_terminal_height_velocity_or_hip_power_declines',
      'breathing_bracing_or_pelvic_floor_response_becomes_uncontrolled',
      'planned_repetitions_duration_or_cumulative_hinge_grip_power_or_overhead_budget_is_reached'],
    p.coach_instructions,p.athlete_instructions,p.expected_adaptation,
    ARRAY['kettlebell']::TEXT[],
    jsonb_build_object(
      'athletesPerStation',1,'setupSeconds',45,'transitionSeconds',30,
      'station','one_marked_kettlebell_swing_arc_per_athlete',
      'equipmentCheck','bell_mass_handle_floor_footwear_arc_clearance_and_park_zone',
      'coachPosition','side_then_front_quarter_outside_swing_and_drop_paths',
      'groupRule','all_bells_parked_before_coach_or_athlete_enters_another_station',
      'changeRule','coach_rechecks_identity_and_recomputes_load_dose_fatigue_duration_and_rendering',
      'substitutionRevalidation',jsonb_build_array(
        'identity','hand_count','side','bell_count_and_mass','terminal_height',
        'style','start_and_park','population','clearance','dose','fatigue',
        'duration','equipment','rendering')),
    CASE p.variant_id
      WHEN swing_two_hand THEN ARRAY[swing_one_hand,deadlift_variant,rdl_variant]::UUID[]
      WHEN swing_one_hand THEN ARRAY[swing_two_hand,deadlift_variant,rdl_variant]::UUID[]
      WHEN overhead_two_hand THEN ARRAY[overhead_one_hand,swing_two_hand]::UUID[]
      ELSE ARRAY[overhead_two_hand,swing_one_hand]::UUID[] END,
    'review',
    jsonb_build_object(
      'setupSeconds',45,'repetitionSeconds',p.rep_seconds,
      'sidesMultiplier',CASE WHEN p.hand_count=1 THEN 2 ELSE 1 END,
      'parkSecondsPerSet',10,'transitionSeconds',30,'durationIncludesRest',TRUE,
      'durationFormula','setup + sets * (repetitions * sides_multiplier * repetition_seconds + park_seconds) + inter_set_rest + transition',
      'durationCeilingSeconds',p.duration_ceiling,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'reduce',CASE WHEN p.overhead THEN jsonb_build_array(
        'reduce_bell_mass','reduce_repetitions','increase_rest',
        'select_two_hand_overhead_if_one_hand_and_objective_is_preserved',
        'select_shoulder_height_definition_only_if_overhead_objective_can_change')
        ELSE jsonb_build_array(
        'reduce_bell_mass','reduce_repetitions','increase_rest',
        'select_two_hand_if_one_hand_and_objective_is_preserved',
        'select_reviewed_deadlift_or_hinge_practice_if_ballistic_objective_can_change') END,
      'increase',jsonb_build_array(
        'add_one_quality_repetition_within_budget',
        'increase_bell_mass_only_if_height_timing_grip_and_park_are_unchanged',
        'reduce_rest_only_in_a_capacity_profile_after_review'),
      'changeOneVariableAtATime',TRUE,'revalidateAfterChange',TRUE,
      'symptomRule','stop_and_select_a_separately_reviewed_pain_free_alternative'),
    jsonb_build_object(
      'record',jsonb_build_array(
        'definition_id','variant_id','profile_key','hand_count','working_side',
        'bell_count_and_mass','terminal_height','style','start_and_park_method',
        'planned_completed_and_failed_repetitions','cadence','rest_duration',
        'first_hinge_height_timing_grip_position_or_breathing_break',
        'symptoms','stop_reason','actual_duration','substitution'),
      'comparisonRule','Compare only when definition, variant, hand count, side, bell mass, terminal height, style, cadence, and measurement method match.',
      'validity','all_identity_equipment_clearance_hinge_hike_terminal_return_grip_breathing_dose_symptom_and_park_gates_pass'),
    jsonb_build_object(
      'before','Which exact card, hand count, side, bell mass, terminal height, cadence, repetitions, rest, park method, and stop signal are assigned?',
      'during','Are the hinge, hip drive, bell path, terminal position, return timing, grip, breathing, spacing, and cadence still exact?',
      'after','Store completed and failed repetitions, load, side, cadence, first break, symptoms, rest, duration, park, and substitution.',
      'supportEscalation','Escalate symptoms, grip or bell-control events, identity mismatch, unsafe equipment or clearance, inaccessible instruction, or media mismatch.',
      'mediaFallback','Use the written phase contract and qualified live demonstration until exact current-version media is independently approved.')
  FROM (VALUES
    (swing_two_hand,'output-two-hand-shoulder-height-power','output','primary',
      'Use crisp two-hand shoulder-height swings for repeat ballistic hip-extension output while every repetition retains the same height, timing, grip, and park.',94,4,6,90,
      'explosive_hip_drive_full_reset_quality_between_repetitions',2.2,520,FALSE,2,
      'Verify the exact two-hand shoulder-height card and load. Observe the first and last repetition from the side; end the set before height, cycle time, hinge timing, trunk position, grip, breathing, or park changes.',
      'Two hands. Hike close, snap the hips, let the bell float to shoulder height, wait for it to fall, then hinge. Park while every rep still matches.',
      'A low-repetition exposure to repeatable ballistic hip extension at a declared load and terminal height.'),
    (swing_two_hand,'capacity-two-hand-shoulder-height','capacity','secondary',
      'Accumulate quality two-hand shoulder-height swing repetitions when conditioning is the declared objective and technique remains the limiting stop.',86,4,10,60,
      'repeatable_submaximal_cadence_quality_terminated',2.4,700,FALSE,2,
      'Declare cadence and cumulative hinge and grip budget. Record the first decline in height, cycle time, hip speed, bell proximity, grip, position, or breathing; do not use time or repetitions to override the quality stop.',
      'Keep every swing the same. Stop the set when the bell, hinge, grip, breathing, or pace changes—before the target count if needed.',
      'A controlled capacity exposure using repeatable shoulder-height swing mechanics, not proof of a universal conditioning dose.'),
    (swing_one_hand,'output-one-hand-shoulder-height-power','output','primary',
      'Use side-specific one-hand shoulder-height swings for repeat ballistic output with explicit anti-rotation, grip, and side accounting.',90,4,5,90,
      'explosive_side_specific_repetitions_with_full_between_side_reset',2.3,620,FALSE,1,
      'Verify side, load, free-arm rule, and equal planned exposure. End the set on grip shift, pelvic or trunk rotation, uneven terminal height, changed hinge timing, or any side-specific symptom; reset fully before switching hands.',
      'One hand on the assigned side. Hike close, snap, stay square, let the bell float, then hinge. Park before changing hands.',
      'A side-specific ballistic hinge exposure with recorded load, quality, and asymmetry observations.'),
    (swing_one_hand,'capacity-one-hand-shoulder-height','capacity','secondary',
      'Accumulate quality one-hand shoulder-height repetitions with separate side totals and conservative grip and anti-rotation limits.',80,3,8,75,
      'repeatable_side_specific_cadence_quality_terminated',2.5,760,FALSE,1,
      'Use separate left and right records; never switch hands in flight. Count failed repetitions and stop each side independently when grip, height, timing, trunk control, breathing, or cadence first changes.',
      'Finish one side, park, reset, then change hands. Stop that side as soon as grip, height, timing, posture, or breathing changes.',
      'A controlled side-specific capacity exposure without assuming equal tolerance or a universal dose.'),
    (overhead_two_hand,'output-two-hand-overhead-power','output','primary',
      'Use low-repetition two-hand overhead swings when full overhead terminal control is specifically required and remains crisp.',88,4,5,105,
      'explosive_hip_drive_controlled_full_overhead_terminal_and_return',2.8,660,TRUE,2,
      'Verify ceiling, fixtures, bell mass, overhead standard, and emergency-drop zone. End the set before overhead path, shoulder or elbow position, rib-pelvis control, cycle time, grip, or return timing changes.',
      'Two hands. Drive with the hips, guide the bell overhead, own the top without leaning back, then let it fall before you hinge.',
      'A low-repetition exposure to the exact overhead swing path and its additional terminal-position control demands.'),
    (overhead_two_hand,'capacity-two-hand-overhead','capacity','secondary',
      'Accumulate a conservative number of two-hand overhead swings only when the overhead path and return remain the quality limiter.',74,3,8,75,
      'repeatable_overhead_cycle_quality_terminated',3.0,760,TRUE,2,
      'Track overhead and hinge quality together. Stop before the athlete chases range, extends the trunk, bends the elbows, loses grip, changes cadence, or allows the bell to pull away on the return.',
      'Make every overhead path match. Stop when the top, trunk, grip, return, pace, or breathing changes—even if repetitions remain.',
      'A controlled overhead-swing capacity exposure; the proposed dose is not a universal prescription.'),
    (overhead_one_hand,'output-one-hand-overhead-power','output','primary',
      'Use low-repetition one-hand overhead swings with explicit side, grip, anti-rotation, overhead, and reset controls.',82,3,4,120,
      'explosive_side_specific_full_overhead_repetitions_with_reset',3.0,760,TRUE,1,
      'Verify side, free-arm rule, ceiling, load, and full overhead control. End immediately on grip migration, trunk rotation or extension, uneven top position, altered return path, timing loss, or side-specific symptoms.',
      'One hand. Stay square, drive with the hips, guide the bell overhead, control the top, then let it fall before you hinge. Park before switching.',
      'A side-specific exposure to the most complex exact overhead working specification, with quality and asymmetry recorded.'),
    (overhead_one_hand,'capacity-one-hand-overhead','capacity','secondary',
      'Accumulate a small side-specific overhead-swing dose only while grip, trunk, overhead path, return, and cadence remain identical.',68,3,6,90,
      'conservative_side_specific_overhead_cadence_quality_terminated',3.2,820,TRUE,1,
      'Use independent side stops and totals. Do not switch hands in flight or continue after any overhead, trunk, grip, cadence, breathing, clearance, or return-path change. Count failed attempts as exposure.',
      'Complete one side, park, then reset. Stop that side when the overhead path, posture, grip, return, pace, or breathing first changes.',
      'A conservative side-specific overhead capacity exposure without assuming symmetric tolerance or universal volume.')
  ) p(variant_id,profile_key,phase_key,role,purpose,suitability,sets,reps,
      rest_seconds,tempo,rep_seconds,duration_ceiling,overhead,hand_count,
      coach_instructions,athlete_instructions,expected_adaptation)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT card.definition_id,2,section.section_key,source.url,source.title,
    source.publisher,source.kind,
    jsonb_build_array(
      jsonb_build_object(
        'claim',CASE WHEN card.overhead THEN section.overhead_claim
          ELSE section.standard_claim END,
        'limits',CASE WHEN card.overhead THEN section.overhead_limit
          ELSE section.standard_limit END),
      jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'limitations','The cited source does not establish individual readiness, medical safety, injury prevention, treatment effect, every listed muscle role, universal load, universal dose, universal recovery, long-term transfer, difficulty score, media approval, or publication approval.',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    source.quality,'candidate',NULL,NULL
  FROM (VALUES
    (swing_definition,FALSE),(overhead_definition,TRUE)
  ) card(definition_id,overhead)
  CROSS JOIN (VALUES
    ('identity','technique','style',
      'Professional instruction fixes a two-hand hip-hinge swing whose hip drive floats the bell to chest or shoulder height rather than an arm-dominant raise.',
      'The comparative study defines the overhead swing by a bell path that terminates at full shoulder flexion and elbow extension.',
      'Professional technique defines a working contract but is not comparative outcome evidence.',
      'A small laboratory comparison supports an identity boundary but does not validate every coaching cue or population.'),
    ('taxonomy','style','style',
      'The study separates shoulder-height and overhead swing styles while retaining their shared lower-body hip-extension pattern.',
      'The overhead style adds a longer vertical path and full overhead terminal action to the shared swing pattern.',
      'Laboratory style labels do not settle every commercial or sport naming convention.',
      'The study does not make the overhead and shoulder-height styles interchangeable.'),
    ('anatomy','emg','overhead_load',
      'Two-hand and one-hand swings produced measurable gluteus maximus, gluteus medius, and biceps femoris activity in healthy college-age participants.',
      'Overhead-swing kinetics in trained women were hip dominant, with ankle and knee contributions also measured.',
      'Surface EMG in a descriptive sample does not quantify force or activation for every listed muscle, person, load, or style.',
      'Lower-body inverse dynamics do not measure every trunk, shoulder, elbow, forearm, or hand contribution.'),
    ('biomechanics','spine','style',
      'A seven-man laboratory sample using 16 kg showed rapid hip and back activation-relaxation cycles, modeled compression, and a kettlebell-specific posterior shear direction.',
      'Compared with shoulder-height swings, overhead swings had longer cycle time and greater vertical impulse in the studied sample.',
      'Modeled loads from a small sample cannot be treated as universal tissue tolerance, benefit, or contraindication.',
      'Between-style differences do not alone prove a superior adaptation or safety profile.'),
    ('difficulty','mechanics','style',
      'Swing force, power, impulse, velocity, and displacement changed with load, supporting separate complexity and physical-demand review rather than a single generic level.',
      'The added overhead path and cycle-time difference support higher exercise-complexity review for the overhead definition.',
      'The study did not create or validate Vortex difficulty scores.',
      'The style study did not create or validate Vortex difficulty scores.'),
    ('load_fatigue_recovery','fatigue','fatigue',
      'Within repeated 30-second maximum-effort intervals in experienced men, swing duration and ground reaction force increased while hip power decreased.',
      'The same maximum-effort protocol demonstrates why terminal height, path, cadence, and hip power must remain fatigue stop signals for overhead work.',
      'One demanding protocol does not establish a universal fatigue ceiling or recovery duration.',
      'The protocol did not isolate an overhead swing or define universal recovery.'),
    ('constraints','spine','overhead_load',
      'Measured spine loading and posterior shear make load, technique, symptoms, training history, and individual tolerance relevant constraints.',
      'Overhead-swing research enrolled women with at least six months of swing experience and used controlled laboratory space and specified bell masses.',
      'The study does not create medical clearance rules or diagnose who should perform swings.',
      'The participant criteria and laboratory setup limit generalization to novices or symptomatic populations.'),
    ('dosage','fatigue','overhead_load',
      'Ten rounds of 30 seconds work and 30 seconds rest created measurable within-round fatigue changes in experienced men.',
      'Fifteen-repetition overhead trials at 8, 12, and 16 kg measured load-dependent kinetics in trained women.',
      'These protocols are evidence contexts, not default prescriptions; all migration doses remain review-only coaching proposals.',
      'The experimental protocol does not establish a universal training dose.'),
    ('instructions','technique','style',
      'The professional sequence specifies a long spine, near-vertical shins, close hike, explosive hip extension, chest-to-shoulder float, brace, and controlled return.',
      'The study operationalizes the overhead style as a swing to full overhead position rather than shoulder height.',
      'Professional instruction does not prove that one cue works for every athlete.',
      'The study used minimal standardized instruction and does not validate this card’s full coaching script.'),
    ('safety_stop_rules','spine','overhead_load',
      'The modeled compression and unusual shear direction support fail-closed load, symptom, technique, grip, and park rules without implying that the exercise is universally safe or unsafe.',
      'Increasing overhead-swing mass changed hip and ankle kinetic responses, supporting load- and technique-sensitive stopping rather than a fixed universal bell.',
      'Small-sample biomechanics cannot determine individual tissue capacity.',
      'Kinetic change does not establish injury risk or medical clearance.'),
    ('programming','mechanics','style',
      'Swing mechanical power was greater than back-squat power and broadly comparable with jump-squat power in the tested conditions, while load changed velocity and impulse.',
      'The overhead and shoulder-height styles shared some characteristics but differed in cycle time and vertical impulse, so selection must preserve the intended style.',
      'Acute mechanical comparison does not prove sport transfer, superiority, or universal sequencing.',
      'The style comparison does not establish long-term adaptation or dose.'),
    ('athlete_support','technique','style',
      'The technique source distinguishes a hip-driven float from a squat or shoulder-driven front raise, supporting a concise athlete self-check.',
      'The overhead definition requires a visibly different terminal position, supporting explicit identity, ceiling, and top-position prompts.',
      'A written cue cannot substitute for individualized observation or symptom reporting.',
      'The source does not establish individual overhead readiness.'),
    ('coach_support','fatigue','fatigue',
      'Hip power declined and cycle duration changed under fatigue, supporting observation of height, timing, force expression, and cadence rather than count alone.',
      'Fatigue-sensitive observation remains necessary because a longer overhead path can hide declining hip contribution behind compensatory arm or trunk motion.',
      'The observed group response is not a universal per-repetition threshold.',
      'The inference about compensatory observation is conservative and requires human coaching review.'),
    ('accessibility','mass','overhead_load',
      'Joint moments at L4/5, hip, and ankle increased as relative bell mass increased, supporting mass as a declared scaling variable.',
      'Overhead joint kinetics changed across 8, 12, and 16 kg conditions, supporting a lighter reviewed bell without redefining the exercise.',
      'Reducing mass does not by itself establish readiness or accessibility for an individual.',
      'A smaller bell does not resolve overhead range, balance, grip, or symptom constraints.'),
    ('alternates','style','style',
      'Shoulder-height and overhead swings have explicit terminal-height boundaries; hand count remains a separately declared variant dimension.',
      'Overhead and shoulder-height labels should not be collapsed, and a kettlebell snatch adds a catch rather than merely more swing height.',
      'Dead-stop, hand-to-hand, double-bell, sport-style, clean, high-pull, and snatch boundaries still require their own exact review.',
      'The study does not exhaust every swing style or commercial name.'),
    ('media','media','media',
      'Current YouTube oEmbed metadata can establish candidate URL, title, channel, thumbnail, and iframe response only.',
      'Current YouTube oEmbed metadata can establish candidate URL, title, channel, thumbnail, and iframe response only.',
      'Metadata does not establish full playback, exact movement, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.',
      'Metadata does not establish full playback, exact movement, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.')
  ) section(section_key,standard_source_key,overhead_source_key,
      standard_claim,overhead_claim,standard_limit,overhead_limit)
  JOIN (VALUES
    ('technique',
      'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/',
      'The ACE Do it Better Series: The Two-handed Kettlebell Swing',
      'American Council on Exercise','professional_standard',80),
    ('spine','https://pubmed.ncbi.nlm.nih.gov/21997449/',
      'Kettlebell swing, snatch, and bottoms-up carry: back and hip muscle activation, motion, and low back loads',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',87),
    ('emg','https://pubmed.ncbi.nlm.nih.gov/26618061/',
      'EMG Analysis and Sagittal Plane Kinematics of the Two-Handed and Single-Handed Kettlebell Swing: A Descriptive Study',
      'International Journal of Sports Physical Therapy','peer_reviewed_research',82),
    ('mass','https://pubmed.ncbi.nlm.nih.gov/32131695/',
      'Effects of kettlebell mass on lower-body joint kinetics during a kettlebell swing exercise',
      'Sports Biomechanics','peer_reviewed_research',84),
    ('mechanics','https://pubmed.ncbi.nlm.nih.gov/22207261/',
      'Mechanical demands of kettlebell swing exercise',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',86),
    ('style','https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/',
      'Kinematic and kinetic variables differ between kettlebell swing styles',
      'International Journal of Sports Physical Therapy','peer_reviewed_research',84),
    ('fatigue','https://pubmed.ncbi.nlm.nih.gov/37126368/',
      'Biomechanical effects of fatigue on lower-body extremities during a maximum effort kettlebell swing protocol',
      'Sports Biomechanics','peer_reviewed_research',83),
    ('overhead_load','https://pubmed.ncbi.nlm.nih.gov/36548500/',
      'Effects of Kettlebell Load on Joint Kinetics and Global Characteristics during Overhead Swings in Women',
      'Sports','peer_reviewed_research',83),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists','YouTube Help','manufacturer_instruction',82)
  ) source(source_key,url,title,publisher,kind,quality)
    ON source.source_key=CASE WHEN card.overhead
      THEN section.overhead_source_key ELSE section.standard_source_key END
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT media.definition_id,NULL,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate',media.discovery_method,
    media.source_query,NULL,NULL,'2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This proves metadata and an embedding response only. Full playback, exact definition and variant, hand count, side, bell count and mass, terminal height, style, start, cadence, dose, return, park, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unresolved.'
  FROM (VALUES
    (swing_definition,'IW979LifpGo','How To Do A PERFECT Kettlebell Swing',
      'Meridian ID Gonstead Spine & Wellness Chiropractic','legacy_import',
      'legacy Kettlebell Swing references rechecked through YouTube oEmbed on 2026-08-02'),
    (swing_definition,'PAhDt_0PjP4','Improve Your Kettlebell Swing | StrongFirst',
      'StrongFirst','legacy_import',
      'legacy Kettlebell Swing references rechecked through YouTube oEmbed on 2026-08-02'),
    (swing_definition,'fvQoQsDk40M','StrongFirst Kettlebell Swing: Timing the Hinge',
      'StrongFirst','legacy_import',
      'legacy Kettlebell Swing references rechecked through YouTube oEmbed on 2026-08-02'),
    (swing_definition,'yHxcTn1UeAc','Kettlebell Swing Basics',
      'StrongFirst','legacy_import',
      'legacy Kettlebell Swing references rechecked through YouTube oEmbed on 2026-08-02'),
    (overhead_definition,'MjZgWEr7dn8',
      'AMERICAN KETTLEBELL SWING technique: How to perform AM KB Swings - demonstration with proper form',
      'MSP Fitness','manual_research',
      'American Kettlebell Swing technique candidates checked through YouTube oEmbed on 2026-08-02'),
    (overhead_definition,'d94xX-AQZ0A','The American Kettlebell Swing | Exercise Tutorial',
      'Onnit','manual_research',
      'American Kettlebell Swing technique candidates checked through YouTube oEmbed on 2026-08-02'),
    (overhead_definition,'dUlk6ZmFtAU',
      'How To Do An Overhead Kettlebell Swing (American Kettlebell Swing)',
      'PureGym','manual_research',
      'Overhead Kettlebell Swing technique candidates checked through YouTube oEmbed on 2026-08-02'),
    (overhead_definition,'mKDIuUbH94Q','The Kettlebell Swing',
      'CrossFit','manual_research',
      'CrossFit Kettlebell Swing candidate checked through YouTube oEmbed on 2026-08-02; generic title increases exact-match uncertainty')
  ) media(definition_id,video_id,title,channel,discovery_method,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method=EXCLUDED.discovery_method,source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT alternate.definition_id,2,alternate.name,alternate.classification,
    alternate.rationale,alternate.dimensions,NULL,'candidate',NULL,NULL
  FROM (VALUES
    (swing_definition,'Kettlebell Swing','same_identity',
      'Stable display name for the exact shoulder-height ballistic hip-hinge family; a selectable variant must still declare hand count and the remaining mechanics.',
      jsonb_build_object('displayName','Kettlebell Swing')),
    (swing_definition,'KB Swing','same_identity',
      'Common abbreviation for the same shoulder-height family after the exact variant is supplied.',
      jsonb_build_object('alias','KB Swing')),
    (swing_definition,'Russian Kettlebell Swing','same_identity',
      'Common name for the chest-to-shoulder-height hip-hinge swing rather than the overhead American swing.',
      jsonb_build_object('alias','Russian Kettlebell Swing','terminalHeight','chest_to_shoulder')),
    (swing_definition,'Two-Hand Shoulder-Height Kettlebell Swing','same_identity',
      'Matches the exact two-hand working specification.',
      jsonb_build_object('variantKey','two-hand-shoulder-height-continuous')),
    (swing_definition,'One-Hand Shoulder-Height Kettlebell Swing','same_identity',
      'Matches the exact one-hand side-specific working specification.',
      jsonb_build_object('variantKey','one-hand-shoulder-height-continuous')),
    (swing_definition,'Working Side','modifier_annotation',
      'Left or right is mandatory dose and rendering metadata for the one-hand variant, not a separate exercise.',
      jsonb_build_object('modifier','working_side')),
    (swing_definition,'Kettlebell Mass','modifier_annotation',
      'Bell mass scales external loading only while the exact hand count, style, height, path, cadence, and quality contract remain fixed.',
      jsonb_build_object('modifier','bell_mass')),
    (swing_definition,'Swing Cadence','modifier_annotation',
      'Cadence changes power and fatigue exposure but not identity when the full movement remains exact.',
      jsonb_build_object('modifier','cadence')),
    (swing_definition,'Sets Repetitions Work Time and Rest','modifier_annotation',
      'Dose is contextual delivery metadata and never repairs an ambiguous movement label.',
      jsonb_build_object('modifiers',jsonb_build_array('sets','repetitions','work_seconds','rest_seconds'))),
    (swing_definition,'Chest-to-Shoulder Terminal Height','modifier_annotation',
      'A declared terminal height within the nonoverhead working range is recorded; continuing to full overhead changes definition.',
      jsonb_build_object('modifier','terminal_height','overheadBoundary',TRUE)),
    (swing_definition,'Stance Width','modifier_annotation',
      'A coached parallel stance adjustment is setup metadata while the hinge, path, and laterality remain fixed.',
      jsonb_build_object('modifier','stance_width')),
    (swing_definition,'Breathing Strategy','modifier_annotation',
      'Breathing cue and timing are recorded without creating an athlete-level or separate exercise.',
      jsonb_build_object('modifier','breathing')),
    (swing_definition,'Start and Park Method','modifier_annotation',
      'The safe first hike and final park are required delivery details when no extra dead-stop is inserted between repetitions.',
      jsonb_build_object('modifiers',jsonb_build_array('start','park_method'))),
    (swing_definition,'Hand-to-Hand Kettlebell Swing','new_variant',
      'Releasing and catching the handle during the float adds exchange timing, flight, grip reacquisition, side order, and drop risk.',
      jsonb_build_object('releaseCatch',TRUE,'handExchange','in_flight')),
    (swing_definition,'Double-Kettlebell Swing','new_variant',
      'One bell in each hand changes implement count, stance clearance, grip, symmetry, loading, and park behavior while retaining the shoulder-height hinge identity.',
      jsonb_build_object('bellCount',2,'handCount',2)),
    (swing_definition,'Dead-Stop Kettlebell Swing','new_variant',
      'Parking and fully resetting every repetition removes the continuous return cycle and changes repetition boundary, duration, and fatigue.',
      jsonb_build_object('reset','park_each_repetition')),
    (swing_definition,'Band-Resisted Kettlebell Swing','new_variant',
      'A band changes the resistance vector, anchoring, trajectory, equipment inspection, and failure behavior.',
      jsonb_build_object('externalResistance','band','anchorReviewRequired',TRUE)),
    (swing_definition,'Staggered-Stance Kettlebell Swing','new_variant',
      'A staggered base changes load distribution, laterality, balance, side accounting, and trunk control.',
      jsonb_build_object('stance','staggered','sideSpecific',TRUE)),
    (swing_definition,'Kettlebell Sport Pendulum Swing','new_definition',
      'A sport-style pendulum deliberately changes knee action, torso path, relaxation-tension strategy, bell trajectory, cadence, and competition context.',
      jsonb_build_object('style','girevoy_sport_pendulum')),
    (swing_definition,'Overhead or American Kettlebell Swing','new_definition',
      'Full overhead termination adds shoulder flexion, path, cycle time, impulse, clearance, control, and failure consequences.',
      jsonb_build_object('targetDefinitionId',overhead_definition,'terminalHeight','full_overhead')),
    (swing_definition,'Kettlebell High Pull','new_definition',
      'A required elbow-led pull redirects the bell toward the torso and adds an active upper-body pull and different terminal action.',
      jsonb_build_object('terminalAction','elbow_led_high_pull')),
    (swing_definition,'Kettlebell Clean','new_definition',
      'A clean terminates with the bell rotating into a rack and requires a catch and rack standard.',
      jsonb_build_object('terminalAction','rack_catch')),
    (swing_definition,'Kettlebell Snatch','new_definition',
      'A snatch uses one hand and a punch-through or catch to fix the bell overhead rather than a continuous two-way swing arc.',
      jsonb_build_object('terminalAction','overhead_catch')),
    (swing_definition,'Kettlebell Swing to Goblet Catch and Squat','new_definition',
      'Catching the bell at the chest and completing a squat adds ordered actions, load transfer, and a new repetition boundary.',
      jsonb_build_object('orderedActions',jsonb_build_array('swing','goblet_catch','squat'))),
    (swing_definition,'Squat-Style Kettlebell Swing','new_definition',
      'A deliberately squat-dominant swing changes the primary lower-body strategy and is not an annotation on this hip-hinge contract.',
      jsonb_build_object('lowerBodyStrategy','squat_dominant')),
    (swing_definition,'Kettlebell Swing Release or Throw','new_definition',
      'Intentional release without same-repetition handle reacquisition creates a projectile task with a landing zone and different safety system.',
      jsonb_build_object('terminalAction','projectile_release')),
    (swing_definition,'Kettlebell Swing One- or Five-Repetition Maximum Test','new_definition',
      'A maximal standardized test changes purpose, familiarization, loading increments, attempts, validity, termination, and result persistence.',
      jsonb_build_object('purpose','assessment','protocol','one_or_five_repetition_maximum')),
    (swing_definition,'Undefined Kettlebell Swing','reject',
      'A generic label without hand count, bell count and mass, terminal height, style, start, cadence, dose, return, and park is not selectable.',
      jsonb_build_object('identityQuarantine',TRUE)),
    (swing_definition,'Arm-Dominant Kettlebell Front Raise','reject',
      'Lifting the bell primarily with the shoulders violates the hip-driven float contract.',
      jsonb_build_object('quality','invalid_repetition')),
    (swing_definition,'Pain-Through or Uncontrolled Swing','reject',
      'Continuing through symptoms, grip loss, unsafe clearance, uncontrolled trajectory, or uncertain park violates stop rules.',
      jsonb_build_object('safety','prohibited')),

    (overhead_definition,'Overhead Kettlebell Swing','same_identity',
      'Stable canonical name for the ballistic hip hinge that terminates in a controlled full overhead position.',
      jsonb_build_object('displayName','Overhead Kettlebell Swing (American Swing)')),
    (overhead_definition,'American Swing','same_identity',
      'Common short alias for the full-overhead swing family.',
      jsonb_build_object('alias','American Swing')),
    (overhead_definition,'American Kettlebell Swing','same_identity',
      'Common alias for the same full-overhead terminal contract.',
      jsonb_build_object('alias','American Kettlebell Swing')),
    (overhead_definition,'Two-Hand Overhead Kettlebell Swing','same_identity',
      'Matches the exact two-hand overhead working specification.',
      jsonb_build_object('variantKey','two-hand-overhead-continuous')),
    (overhead_definition,'One-Hand Overhead Kettlebell Swing','same_identity',
      'Matches the exact one-hand side-specific overhead working specification.',
      jsonb_build_object('variantKey','one-hand-overhead-continuous')),
    (overhead_definition,'Overhead Swing Working Side','modifier_annotation',
      'Left or right is mandatory dose and rendering metadata for the one-hand overhead variant.',
      jsonb_build_object('modifier','working_side')),
    (overhead_definition,'Overhead Swing Bell Mass','modifier_annotation',
      'Bell mass scales load only while the exact overhead path, hand count, cadence, and quality contract remain fixed.',
      jsonb_build_object('modifier','bell_mass')),
    (overhead_definition,'Overhead Swing Cadence Sets Repetitions and Rest','modifier_annotation',
      'Cadence and dose change physical exposure without changing the full-overhead identity.',
      jsonb_build_object('modifiers',jsonb_build_array('cadence','sets','repetitions','rest_seconds'))),
    (overhead_definition,'Overhead Alignment Standard','modifier_annotation',
      'The exact reviewed top-position standard and individual controllable range must be recorded; a partial-height swing does not silently qualify as overhead.',
      jsonb_build_object('modifier','overhead_standard')),
    (overhead_definition,'Overhead Swing Start and Park Method','modifier_annotation',
      'The first hike and final park are mandatory delivery details when no extra dead-stop is inserted between repetitions.',
      jsonb_build_object('modifiers',jsonb_build_array('start','park_method'))),
    (overhead_definition,'Hand-to-Hand Overhead Swing','new_variant',
      'An in-flight hand exchange adds release, catch, grip reacquisition, side order, and drop risk.',
      jsonb_build_object('releaseCatch',TRUE)),
    (overhead_definition,'Double-Kettlebell Overhead Swing','new_variant',
      'Two bells change implement count, clearance, symmetry, shoulder and grip load, and park behavior.',
      jsonb_build_object('bellCount',2)),
    (overhead_definition,'Dead-Stop Overhead Swing','new_variant',
      'Parking after every repetition removes the continuous cycle and changes repetition boundary and fatigue.',
      jsonb_build_object('reset','park_each_repetition')),
    (overhead_definition,'Shoulder-Height Kettlebell Swing','new_definition',
      'Stopping at chest or shoulder height removes the required full-overhead terminal action and maps to the existing standard swing definition.',
      jsonb_build_object('targetDefinitionId',swing_definition)),
    (overhead_definition,'Kettlebell Snatch','new_definition',
      'A snatch fixes one bell overhead with a catch rather than maintaining the overhead swing’s continuous return arc.',
      jsonb_build_object('terminalAction','overhead_catch')),
    (overhead_definition,'Kettlebell High Pull','new_definition',
      'An elbow-led pull changes the upper-body action and terminates below the overhead position.',
      jsonb_build_object('terminalAction','elbow_led_high_pull')),
    (overhead_definition,'Kettlebell Swing to Overhead Press','new_definition',
      'A distinct press after a catch adds a rack or stabilized transition and active pressing action.',
      jsonb_build_object('orderedActions',jsonb_build_array('swing','catch','press'))),
    (overhead_definition,'Overhead Swing Maximum-Repetition Test','new_definition',
      'A maximal test changes purpose, validity, termination, attempts, and persistence from a training card.',
      jsonb_build_object('purpose','assessment')),
    (overhead_definition,'Overhead Carry','new_definition',
      'A carry begins with a stabilized overhead hold and adds distance or time under locomotion instead of a repeated ballistic swing cycle.',
      jsonb_build_object('targetDefinitionId',overhead_carry_definition)),
    (overhead_definition,'Standing Strict Overhead Press','new_definition',
      'A strict press starts from a rack or shoulder position and uses active shoulder and elbow pressing without a backswing or hip-generated swing arc.',
      jsonb_build_object('targetDefinitionId',strict_press_definition)),
    (overhead_definition,'Partial-Height Swing Labeled Overhead','reject',
      'A repetition that does not reach the declared full-overhead standard fails this identity and must be rendered as another reviewed definition or stopped.',
      jsonb_build_object('identity','terminal_height_failure')),
    (overhead_definition,'Overhead Swing under Unsafe Ceiling or Fixtures','reject',
      'Insufficient overhead clearance creates a collision hazard and blocks selection.',
      jsonb_build_object('environment','unsafe')),
    (overhead_definition,'Lumbar-Extension Overhead Finish','reject',
      'Replacing shoulder and scapular overhead motion with uncontrolled trunk extension fails the repetition.',
      jsonb_build_object('quality','invalid_repetition')),
    (overhead_definition,'Overhead Swing without a Controlled Return or Park','reject',
      'An uncontrolled descent, grip, path, or finish violates the complete repetition and station safety contract.',
      jsonb_build_object('safety','invalid_finish'))
  ) alternate(definition_id,name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (swing_two_hand,swing_one_hand,'progression',91,
      ARRAY['stability','complexity'],
      'One-hand execution preserves the shoulder-height hinge and arc but adds side-specific grip, anti-rotation, asymmetry, and separate side accounting.',
      '{"requires":["two_hand_height_timing_hinge_and_park_control","secure_one_hand_grip","side_specific_dose"],"recompute":["difficulty","load","fatigue","duration","rendering"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (swing_one_hand,swing_two_hand,'regression',91,
      ARRAY['stability','complexity'],
      'Two-hand execution removes the unilateral grip and side-specific anti-rotation requirement while retaining the shoulder-height swing identity.',
      '{"onlyWhen":"two_hand_grip_is_tolerated_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (swing_two_hand,deadlift_variant,'regression',72,
      ARRAY['speed','complexity','fatigue'],
      'Kettlebell Deadlift can preserve a loaded hinge purpose when ballistic projection is not required, but it changes identity, speed, repetition boundary, load path, dose, and rendering.',
      '{"onlyWhen":"ballistic_output_objective_can_change","coachConfirmationRequired":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (swing_one_hand,rdl_variant,'regression',68,
      ARRAY['speed','stability','complexity'],
      'A controlled single-kettlebell Romanian Deadlift can preserve a loaded hinge purpose when free swing projection is not required, but the load path and contraction sequence change.',
      '{"onlyWhen":"ballistic_output_and_cyclic_swing_objectives_can_change","coachConfirmationRequired":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (swing_two_hand,overhead_two_hand,'progression',84,
      ARRAY['range','complexity','stability','fatigue'],
      'Continuing the same two-hand hip-driven swing to full overhead adds range, cycle time, shoulder control, clearance, return-path demand, and failure consequence and therefore changes definition.',
      '{"requires":["shoulder_height_swing_control","reviewed_overhead_range","ceiling_clearance","lighter_load_if_needed"],"definitionChanges":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (overhead_two_hand,swing_two_hand,'regression',84,
      ARRAY['range','complexity','stability','fatigue'],
      'The shoulder-height definition removes the required full-overhead path and reduces range, cycle time, clearance, and terminal-position demands.',
      '{"onlyWhen":"overhead_specific_objective_can_change","definitionChanges":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (overhead_two_hand,overhead_one_hand,'progression',90,
      ARRAY['stability','complexity'],
      'One-hand overhead execution retains the full path while adding unilateral grip, anti-rotation, asymmetry, and side-specific dose and observation.',
      '{"requires":["two_hand_overhead_path_control","secure_one_hand_grip","side_specific_overhead_control"],"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (overhead_one_hand,overhead_two_hand,'regression',90,
      ARRAY['stability','complexity'],
      'Two-hand overhead execution removes unilateral grip and side-specific anti-rotation demands while retaining the full-overhead definition.',
      '{"onlyWhen":"two_hand_overhead_grip_is_tolerated","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN variant.complexity ELSE variant.physical END,
    variant.anchor_tier,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on ballistic hinge timing, hike and return sequencing, terminal-height precision, hand count, side accounting, grip, stance, trunk and shoulder control, cadence, bell trajectory, park, observation demand, and quality termination.'
    ELSE
      'Review-only physical-difficulty anchor based on bell mass, acceleration, hinge and posterior-chain loading, grip, terminal height, repetitions or time, cadence, rest, fatigue sensitivity, prior overlapping work, and recovery context.' END
      ||' This is exercise scoring, not an athlete proficiency classification. Variant: '
      ||variant.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (swing_two_hand,'two-hand-shoulder-height-continuous',56,58,60),
    (swing_one_hand,'one-hand-shoulder-height-continuous',64,60,60),
    (overhead_two_hand,'two-hand-overhead-continuous',66,62,60),
    (overhead_one_hand,'one-hand-overhead-continuous',74,64,80)
  ) variant(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand'))
    dimension(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=56,absolute_load_demand=58,
    coordination_demand=58,impact=1,supervision_demand=52,
    base_overall_difficulty=greatest(56,58),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'sourceIdentity','generic_kettlebell_swing_requires_exact_variant',
      'defaultWorkingSpecification','two-hand-shoulder-height-continuous',
      'exactVariantRequired',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=70,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only; exact hand count, load, terminal height, style, cadence, dose, and independent human calibration remain required.',
    updated_at=now()
  WHERE exercise_id=11;

  UPDATE coaching.exercise SET skill_level=NULL,
    name='Kettlebell Swing',
    description='From a declared two-hand or one-hand setup, hike one kettlebell high between the legs and use ballistic hip extension to float it to the assigned chest-to-shoulder height. Let the bell return before hinging, repeat at the assigned cadence, then park under control.',
    instructions='Declare exact variant, hand and side, bell mass, chest-to-shoulder terminal height, cadence, repetitions, rest, and park. Hike close, snap the hips, let the bell float, wait for the return, then hinge. Stop before grip, height, timing, posture, breathing, clearance, or park changes.',
    default_sets=4,default_reps=6,default_work_seconds=NULL,
    default_rest_seconds=90,est_seconds_per_set=30,
    card_summary='Ballistic kettlebell hip hinge to a declared chest-to-shoulder-height float; exact hand count, load, cadence, dose, and park are mandatory.',
    coach_language='Verify exact shoulder-height definition and variant, bell mass, hand and side, stance, hike, hip-driven float, terminal height, return-before-hinge timing, grip, trunk control, breathing, spacing, cadence, dose, and controlled park. Stop for symptoms, grip or trajectory loss, quality decline, or unsafe equipment or clearance.',
    athlete_language='Hike close, snap the hips, let the bell float, wait for it to return, then hinge. Park while every repetition still matches.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_shoulder_height_variant_required_never_silently_change_to_overhead_clean_snatch_high_pull_squat_style_or_release',
      'loadRule','record_bell_count_and_mass_hand_count_side_height_style_and_cadence',
      'fatigueRule','count_valid_and_failed_repetitions_with_all_hinge_power_grip_trunk_and_overlapping_work',
      'substitutionRule','revalidate_identity_objective_equipment_clearance_load_dose_fatigue_duration_and_rendering',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY[
      'bell_mass','cadence','repetitions','sets','rest_seconds',
      'working_side','stance_width_within_variant']::TEXT[],
    movement_family='Ballistic kettlebell hip hinge to shoulder height',
    primary_phase_key='output',phase_subrole='ballistic_hip_extension',
    primary_order_slot='output',
    movement_requirements=jsonb_build_object(
      'implement','one_kettlebell','handCount','exact_variant_required',
      'requiredSequence',jsonb_build_array(
        'declared_setup_and_hike','ballistic_hip_extension',
        'chest_to_shoulder_height_float','return_before_hinge','controlled_park'),
      'terminalHeight','chest_to_shoulder_not_overhead',
      'variantRequired',TRUE,'impactLevel',0),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare card, hand count, side, bell mass, terminal height, cadence, dose, rest, park, and stop signal.',
        'Inspect bell, handle, floor, footwear, swing arc, spacing, and park or drop zone.'),
      'executionSteps',jsonb_build_array(
        'Hinge, grip, tilt, and hike the bell high and close between the legs.',
        'Reverse with ballistic hip extension so the bell floats to the assigned chest-to-shoulder height.',
        'Keep the terminal position organized; let the bell begin returning before hinging.',
        'Repeat at the assigned cadence, then guide the final return into a controlled park.'),
      'qualityGate',jsonb_build_array(
        'Exact hand, side, load, height, style, cadence, and dose.',
        'Repeatable feet, hinge, hip drive, bell path, grip, trunk, breathing, return, and park.',
        'No symptoms, collision, spacing violation, arm-dominant lift, or quality decline.'),
      'stopSigns',jsonb_build_array(
        'Pain, pinch, neurologic symptoms, dizziness, faintness, chest pressure, unusual breathlessness, or concerning pelvic-floor response.',
        'Grip slip, bell contact, trajectory loss, balance loss, squat substitution, arm lift, trunk-position change, height or cadence decline, or uncertain park.',
        'Unsafe bell, handle, floor, footwear, arc, spacing, fixture, or drop zone.')),
    pairing_logic=jsonb_build_object(
      'goodForSessions',jsonb_build_array(
        'ballistic_power','strength_power','hinge_capacity','mixed_modal_capacity'),
      'pairsWellAfter',jsonb_build_array(
        'general_temperature_raise','loaded_hinge_rehearsal','specific_hike_and_park_practice'),
      'pairsWellBefore',jsonb_build_array(
        'lower_priority_accessory_work','non_conflicting_capacity_work'),
      'avoidBefore',jsonb_build_array(
        'priority_sprint_jump_throw_or_olympic_lift_if_swing_volume_creates_fatigue',
        'heavy_deadlift_rdl_or_grip_work_if_overlap_exceeds_budget'),
      'doNotUseWhen',jsonb_build_array(
        'loaded_hinge_hike_grip_or_park_not_controlled','symptoms_or_unusual_exertional_response_present',
        'exact_variant_or_load_unavailable','safe_arc_spacing_or_floor_unavailable')),
    media_library=jsonb_build_object(
      'demoVideoSources',jsonb_build_array(
        'https://www.youtube.com/watch?v=IW979LifpGo',
        'https://www.youtube.com/watch?v=PAhDt_0PjP4',
        'https://www.youtube.com/watch?v=fvQoQsDk40M',
        'https://www.youtube.com/watch?v=yHxcTn1UeAc'),
      'mediaState','oembed_metadata_healthy_exact_match_and_approval_unresolved',
      'internalNotes',jsonb_build_array(
        'Do not treat titles, thumbnails, or oEmbed as movement review.',
        'Film setup, hike, hip drive, terminal height, hand count, side, bell mass, return, cadence, breathing, final park, and stop.')),
    archived=FALSE,is_published=FALSE,why_publish_ready=FALSE,updated_at=now()
  WHERE id=11;
  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=11;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT packet.definition_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'legacySources',CASE WHEN packet.overhead THEN 0 ELSE 1 END,
        'researchAuthoredNewDefinition',packet.overhead,
        'activeWorkingSpecifications',2,'sourceDerivedSelectableVariants',0,
        'shoulderHeightAndOverheadBoundaryRecorded',TRUE,
        'deadliftAndRdlBoundariesRecorded',NOT packet.overhead),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',CASE WHEN packet.overhead
          THEN jsonb_build_array('hinge','brace','reach')
          ELSE jsonb_build_array('hinge','brace') END),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesJointsActionsSagittalFrontalTransverseAndVariantLaterality',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,
        'loadHandSideHeightCadenceAndFailedExposureTracked',TRUE,
        'sameSessionHingePowerGripTrunkAndApplicableOverheadWorkRequired',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'bellHandleFloorFootwearArcClearanceSpacingPopulationSymptomsAndPark',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',4,
        'doseDurationScalingLogisticsSubstitutionAndPersistence',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachAndSupportOperations',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'acuteBiomechanicsLimitsExplicit',TRUE,
        'noUniversalDoseSafetyTransferOrDifficultyClaimed',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',CASE WHEN packet.overhead THEN 3 ELSE 5 END,
        'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object(
        'passed',TRUE,'assessments',CASE WHEN packet.overhead THEN 24 ELSE 30 END),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object(
        'passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01','category','media',
        'message','A qualified human must watch each candidate in full and verify exact definition, hand count, side, bell count and mass, terminal height, style, setup, hike, hip drive, return, cadence, dose, grip, clearance, park, captions, accessibility, safety, cue quality, conflicts, playback, reviewer identity, and card-version match.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03','category','relationship_graph',
        'message','A qualified coach must approve or reject every progression, regression, and substitution proposal.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01','category','calibration',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not represent athlete proficiency.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01','category','publication',
        'message','A qualified reviewer and separate approver must complete content review before publication.')),
    TRUE,now()
  FROM (VALUES
    (swing_definition,FALSE),(overhead_definition,TRUE)
  ) packet(definition_id,overhead)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=swing_definition AND status='review' AND card_version=2
        AND approved_video_url IS NULL AND reviewed_by IS NULL
        AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=overhead_definition AND slug='overhead-kettlebell-swing'
        AND status='review' AND card_version=2
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND approved_video_url IS NULL AND reviewed_by IS NULL
        AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0)<>4 THEN
    RAISE EXCEPTION '% left invalid definitions or working variants',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>8
    OR (SELECT count(*) FROM (
      SELECT definition_id FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND reviewed_card_version=2 AND review_status='candidate'
        AND reviewer_user_id IS NULL
      GROUP BY definition_id HAVING count(DISTINCT section_key)=16
    ) complete_evidence)<>2
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids) AND reviewed_card_version=2
        AND video_id=ANY(swing_video_ids||overhead_video_ids)
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=swing_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>30
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=overhead_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>24 THEN
    RAISE EXCEPTION '% left incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE decision='distinct_exercises' AND (
        (survivor_definition_id=swing_definition
          AND resolved_definition_id=ANY(ARRAY[
            overhead_definition,deadlift_definition,rdl_definition]))
        OR (survivor_definition_id=overhead_definition
          AND resolved_definition_id=ANY(ARRAY[
            overhead_carry_definition,strict_press_definition]))))<>5
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND reviewed_by IS NULL)<>8
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND relationship IN('progression','regression')
        AND NOT dimensions <@ ARRAY[
          'load','leverage','range','speed','stability','complexity',
          'impact','decision_demand','fatigue']::TEXT[])
    OR EXISTS(SELECT 1 FROM coaching.exercise WHERE id=11 AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=11 AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids) AND reviewed_card_version=2
        AND (review_status IN('approved') OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% inferred approval, invalid graph, or athlete skill metadata',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM (
      SELECT packet.definition_id
      FROM coaching.exercise_card_test_packet_v1 packet
      CROSS JOIN LATERAL jsonb_array_elements(packet.blocking_issues_json) item
      WHERE packet.definition_id=ANY(affected_definition_ids)
      GROUP BY packet.definition_id
      HAVING array_agg(item->>'code' ORDER BY item->>'code')=ARRAY[
        'CARD-CALIBRATION-01','CARD-GRAPH-03',
        'CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[]
    ) exact_blockers)<>2 THEN
    RAISE EXCEPTION '% did not retain the exact human-review blockers',migration_key;
  END IF;
END $$;
