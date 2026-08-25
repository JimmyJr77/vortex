-- Replace generic Hollow Body Hold source representations with exact static,
-- supine, quality-terminated working specifications. Loaded dumbbell and
-- medicine-ball holds remain variants only when the implement is fixed for the
-- hold; dynamic pullovers, rocks, kicks, rolls, lowers, and exchanges remain
-- separate definitions. All evidence, media, graph, calibration, and content
-- decisions remain review-only. No athlete proficiency or approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '476_coaching_hollow_body_hold_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.81';
  canonical_id UUID;
  dumbbell_source_definition UUID;
  medicine_ball_source_definition UUID;
  duplicate_definition_ids UUID[];
  affected_definition_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[13,458,1172];
  source_variant_ids UUID[];
  tuck_variant UUID := gen_random_uuid();
  one_leg_variant UUID := gen_random_uuid();
  straight_forward_variant UUID := gen_random_uuid();
  overhead_variant UUID := gen_random_uuid();
  dumbbell_variant UUID := gen_random_uuid();
  medicine_ball_variant UUID := gen_random_uuid();
  active_variant_ids UUID[];
  hollow_rock_definition UUID;
  rock_freeze_definition UUID;
  flutter_kick_definition UUID;
  hollow_arch_roll_definition UUID;
  eccentric_lower_definition UUID;
  partner_exchange_definition UUID;
  dead_bug_definition UUID;
  l_sit_definition UUID;
  neighbor_definition_ids UUID[];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'QgVOvBM96eE','qU0r6449do4','pLt0s2cimdI','LlDNef_Ztsc','VyrUmzIHmzw'];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_id FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=13;
  SELECT id INTO dumbbell_source_definition FROM coaching.exercise_definition_v1
  WHERE slug='dumbbell-hollow-body-pullover-hold';
  SELECT id INTO medicine_ball_source_definition FROM coaching.exercise_definition_v1
  WHERE slug='medicine-ball-hollow-body-hold';
  SELECT id INTO hollow_rock_definition FROM coaching.exercise_definition_v1
  WHERE slug='hollow-rock' AND status<>'archived';
  SELECT id INTO rock_freeze_definition FROM coaching.exercise_definition_v1
  WHERE slug='hollow-body-rock-to-freeze' AND status<>'archived';
  SELECT id INTO flutter_kick_definition FROM coaching.exercise_definition_v1
  WHERE slug='hollow-flutter-kick' AND status<>'archived';
  SELECT id INTO hollow_arch_roll_definition FROM coaching.exercise_definition_v1
  WHERE slug='hollow-to-arch-roll' AND status<>'archived';
  SELECT id INTO eccentric_lower_definition FROM coaching.exercise_definition_v1
  WHERE slug='eccentric-hollow-body-lower' AND status<>'archived';
  SELECT id INTO partner_exchange_definition FROM coaching.exercise_definition_v1
  WHERE slug='partner-hollow-body-med-ball-exchange' AND status<>'archived';
  SELECT id INTO dead_bug_definition FROM coaching.exercise_definition_v1
  WHERE slug='dead-bug' AND status<>'archived';
  SELECT id INTO l_sit_definition FROM coaching.exercise_definition_v1
  WHERE slug='l-sit' AND status<>'archived';

  SELECT ARRAY[
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND variant_key='baseline'),
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND variant_key='legacy-source-458-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=canonical_id AND variant_key='legacy-source-1172-baseline')]
    INTO source_variant_ids;
  duplicate_definition_ids := ARRAY[dumbbell_source_definition,medicine_ball_source_definition];
  affected_definition_ids := ARRAY[
    canonical_id,dumbbell_source_definition,medicine_ball_source_definition];
  active_variant_ids := ARRAY[
    tuck_variant,one_leg_variant,straight_forward_variant,overhead_variant,
    dumbbell_variant,medicine_ball_variant];
  neighbor_definition_ids := ARRAY[
    hollow_rock_definition,rock_freeze_definition,flutter_kick_definition,
    hollow_arch_roll_definition,eccentric_lower_definition,
    partner_exchange_definition,dead_bug_definition,l_sit_definition];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND slug='hollow-body-hold' AND status<>'archived')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(duplicate_definition_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=ANY(source_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(neighbor_definition_ids) AND status<>'archived')<>8 THEN
    RAISE EXCEPTION '% prerequisite Hollow Body Hold identity state is missing or drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_id) THEN
    RAISE EXCEPTION '% working variant UUID is already owned by another definition',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
          OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=ANY(source_ids)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
      OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_id,
    source_kind=CASE WHEN legacy_exercise_id=13 THEN 'legacy_migration'
      ELSE 'duplicate_consolidation' END,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','identity_quarantine',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation',CASE legacy_exercise_id
          WHEN 13 THEN 'generic_static_hollow_hold_source_omits_exact_arm_leg_levers_entry_exit_breathing_hold_and_quality_termination'
          WHEN 458 THEN 'dumbbell_label_is_accepted_only_as_a_fixed_position_loaded_hold_not_a_dynamic_pullover'
          ELSE 'medicine_ball_label_is_accepted_only_as_a_fixed_position_loaded_hold_not_an_exchange_or_throw' END,
        'invalidPriorCitationsRemoved',jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32707142/',
          'https://pubmed.ncbi.nlm.nih.gov/19620925/'),
        'authoritativeExactSpecificationRequired',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET
    definition_id=canonical_id,
    variant_key='identity-quarantine-source-'
      ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
    display_name='Hollow Body Hold Identity Quarantine — Source '
      ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',source_ids[array_position(source_variant_ids,id)],
      'archiveReason','source_does_not_fix_static_arm_leg_lever_load_position_entry_exit_breathing_hold_rest_and_quality_termination',
      'dynamicPulloverNotImplied',TRUE,'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,
    approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'hollowBodyHoldAuditHardeningMigration',migration_key,
        'canonicalSurvivorDefinitionId',canonical_id,'selectable',FALSE,
        'invalidPriorCitationsRemoved',jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32707142/',
          'https://pubmed.ncbi.nlm.nih.gov/19620925/'),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(duplicate_definition_ids);

  UPDATE coaching.exercise_identity_resolution_v1 SET
    evidence_json=(coalesce(evidence_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'correctionMigration',migration_key,
        'correctedResearchSources',jsonb_build_array(
          'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/21975179/'),
        'invalidPriorCitationsRemoved',jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32707142/',
          'https://pubmed.ncbi.nlm.nih.gov/19620925/'),
        'fixedPositionRequiredForLoadedHoldIdentity',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    reviewed_by=NULL,resolved_at=now()
  WHERE survivor_definition_id=canonical_id
    OR resolved_definition_id=canonical_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_id,boundary.definition_id,'distinct_exercises',
    boundary.rationale,jsonb_build_object(
      'migration',migration_key,'identityBoundary',boundary.boundary_key,
      'baseContract','static_supine_hollow_body_isometric_with_fixed_limb_and_load_positions',
      'neighborContract',boundary.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_only_neighbor_card_still_requires_its_own_audit'),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (hollow_rock_definition,'static_hold_vs_continuous_rocking_cycle',
      'Hollow Rock repeatedly rocks the fixed body shape over the back; the static hold has no intended whole-body rocking cycle.','repeated_whole_body_rocking'),
    (rock_freeze_definition,'continuous_static_hold_vs_rock_then_freeze_repetition',
      'Hollow Body Rock to Freeze alternates a dynamic rock with a timed freeze and therefore has a different repetition boundary.','rock_and_freeze_cycle'),
    (flutter_kick_definition,'fixed_bilateral_leg_position_vs_alternating_flutter_kicks',
      'Hollow Flutter Kick repeatedly alternates leg motion while the static hold fixes both leg positions.','alternating_leg_flutter_cycle'),
    (hollow_arch_roll_definition,'static_supine_hold_vs_supine_prone_roll_transition',
      'Hollow-to-Arch Roll changes orientation and body shape through a repeated roll; the static hold remains supine.','hollow_to_arch_roll_cycle'),
    (eccentric_lower_definition,'static_hold_vs_prescribed_eccentric_leg_lower',
      'Eccentric Hollow Body Lower makes the slow lowering action and reset the repetition; the hold fixes the selected terminal lever.','prescribed_eccentric_leg_lower'),
    (partner_exchange_definition,'fixed_implement_hold_vs_partner_exchange',
      'Partner Hollow Body Medicine-Ball Exchange adds partner timing, release, travel, reception, and ball-control consequences.','partner_ball_exchange_cycle'),
    (dead_bug_definition,'bilateral_static_limbs_vs_alternating_contralateral_reach',
      'Dead Bug alternates an opposite arm and leg through reach and return while Hollow Body Hold fixes the declared limbs.','alternating_contralateral_reach'),
    (l_sit_definition,'supine_floor_contact_vs_straight_arm_support_compression',
      'L-Sit uses loaded hand support and hip-flexion compression while Hollow Body Hold uses supine trunk contact and unsupported limb levers.','straight_arm_support_compression_hold')
  ) boundary(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Static Supine Hollow Body Hold',display_name='Hollow Body Hold',
    aliases=ARRAY[
      'Hollow Body Holds','Hollow Hold','Hollow Holds','Supine Hollow Hold',
      'Dumbbell Hollow Body Hold','Dumbbell Hollow-Body Pullover Hold',
      'Medicine Ball Hollow Body Hold','Loaded Hollow Body Hold']::TEXT[],
    description='A static supine isometric in which the athlete establishes a declared rib-pelvis and lumbar-floor relationship, lifts the shoulders as specified, fixes both arm and leg levers, breathes, and holds without rocking or limb motion until the prescribed time or first quality stop. Tuck, one-leg, straight-leg, overhead, and fixed-position loaded versions require exact variants.',
    family_key='static_supine_hollow_body_isometric_anti_extension',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=90,scoring_confidence=64,media_confidence=54,
    movement_patterns=ARRAY['brace']::TEXT[],
    body_regions=ARRAY[
      'core','spine','rib_cage','pelvis','hip','knee','shoulder','elbow','hand','neck']::TEXT[],
    required_equipment=ARRAY['none']::TEXT[],
    optional_equipment=ARRAY[
      'mat','dumbbell','medicine_ball','timer','line_tape']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'rectus_abdominis','external_oblique','internal_oblique'),
      'secondaryMuscles',jsonb_build_array(
        'transversus_abdominis','iliopsoas','rectus_femoris',
        'anterior_deltoid','serratus_anterior','latissimus_dorsi',
        'gluteus_maximus','quadriceps'),
      'stabilizers',jsonb_build_array(
        'diaphragm','pelvic_floor','multifidus','deep_spinal_stabilizers',
        'cervical_flexors','forearm_and_hand_grip_for_loaded_variants'),
      'connectiveTissues',jsonb_build_array(
        'abdominal_aponeuroses','thoracolumbar_fascia',
        'shoulder_elbow_and_hand_supporting_tissues_for_loaded_variants'),
      'joints',jsonb_build_array(
        'cervical_spine','thoracic_spine','lumbar_spine','lumbosacral_complex',
        'pelvis','hip','knee','glenohumeral_joint',
        'scapulothoracic_articulation','elbow','hand_and_wrist'),
      'jointActions',jsonb_build_array(
        'spinal_anti_extension_with_declared_flexion_shape',
        'posterior_pelvic_tilt_or_declared_lumbar_floor_contact',
        'isometric_trunk_flexion','isometric_hip_flexion_or_extension_lever_control',
        'variant_declared_knee_flexion_or_extension',
        'variant_declared_shoulder_flexion_and_elbow_extension',
        'loaded_variant_bilateral_fixed_grip'),
      'jointActionPhases',jsonb_build_object(
        'entry',jsonb_build_array(
          'supine_start','establish_rib_pelvis_and_lumbar_contact',
          'set_shoulders_arms_and_legs_one_dimension_at_a_time'),
        'hold',jsonb_build_array(
          'no_intended_rocking_or_limb_motion','fixed_declared_levers',
          'continuous_breathing','quality_terminated_isometric'),
        'exit',jsonb_build_array(
          'return_loaded_implement_to_safe_support_if_used',
          'bend_and_lower_limbs_under_control','release_trunk_shape_without_drop')),
      'planes',jsonb_build_array(
        'sagittal_primary','frontal_and_transverse_anti_motion_control'),
      'laterality',jsonb_build_object(
        'baseline','bilateral_symmetric',
        'oneLegVariant','side_specific_extended_leg_with_opposite_leg_tucked',
        'sideMustBeRecorded',TRUE,
        'alternatingOrMovingVersionsRequireSeparateDefinition',TRUE),
      'evidenceLimit','Exact Hollow Body Hold evidence is primarily professional instruction. Adjacent acute EMG and performance-test studies do not establish muscle force, adaptation, transfer, one universal posture, dose, recovery interval, safety threshold, readiness rule, or numeric difficulty.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_stable_floor_with_optional_mat',
      'clearance',jsonb_build_array(
        'full_body_length','overhead_arm_and_implement_path',
        'safe_loaded_pickup_and_set_down_zone','coach_side_view','no_cross_traffic'),
      'station','one_supine_lane_per_athlete',
      'equipmentSafety',jsonb_build_array(
        'mat_lies_flat','timer_visible_or_audible',
        'loaded_implement_exact_mass_dry_undamaged_and_within_control',
        'implement_staged_and_removed_without_passing_over_another_person'),
      'changeRule','Arm lever, leg lever, side, shoulder-blade elevation, lumbar contact, implement, mass, grip, fixed load angle, entry, hold, rest, exit, and stop signal must be declared and revalidated.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_supine_positioning_and_hold_the_exact_declared_levers_while_breathing_without_symptoms',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array(
        'pain_free_supine_entry_hold_and_exit','declared_lumbar_floor_relationship_tolerated',
        'assigned_hip_knee_shoulder_and_elbow_positions_tolerated',
        'continuous_breathing_without_bearing_down',
        'safe_loaded_pickup_grip_and_set_down_when_applicable',
        'can_report_symptoms_position_loss_and_uncertainty'),
      'cautions',jsonb_build_array(
        'current_or_recent_neck_spine_hip_knee_shoulder_elbow_wrist_or_hand_symptoms',
        'neurologic_dizziness_cardiopulmonary_or_pressure_symptoms',
        'pregnancy_or_postpartum_status_requiring_supine_or_pressure_individualization',
        'recent_high_volume_trunk_hip_flexor_overhead_gymnastics_or_loaded_carry_work',
        'unfamiliar_external_load_or_uncertain_floor_transfer'),
      'doNotAutoSelect',jsonb_build_array(
        'exact_static_variant_or_loaded_position_is_unknown',
        'supine_position_or_floor_transfer_is_not_tolerated',
        'pain_pressure_neurologic_dizziness_or_unusual_exertional_symptoms',
        'breathing_requires_bearing_down_or_position_requires_momentum',
        'loaded_implement_cannot_be_picked_up_held_and_set_down_safely'),
      'ageMinimumEvidence','none_established',
      'notClinicalClearance',TRUE,
      'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This drill practices a repeatable static hollow shape while the arms and legs create leverage. The goal is the exact position with breathing, not a longest-possible hold or a forced low-back position.',
      'primaryCue','Set the assigned rib and pelvis shape, lift the shoulders as specified, freeze the exact arm and leg levers, breathe, and stop at the first change.',
      'before',jsonb_build_array(
        'Confirm the exact variant, side if one-leg, implement and mass if loaded, hold, rest, sets, and stop signal.',
        'Check the floor, mat, full limb path, and loaded pickup and set-down zone.',
        'Report pain, pressure symptoms, dizziness, unusual fatigue, or difficulty getting to the floor.'),
      'during',jsonb_build_array(
        'Keep the assigned shoulder, arm, leg, rib, pelvis, and low-back positions fixed.',
        'Breathe continuously; do not silently raise the legs, bend the knees, move the arms, rock, or change sides.',
        'End the hold at the first uncorrected position change or symptom.'),
      'expectedSensations',jsonb_build_array(
        'abdominal_wall_tension','hip_flexor_and_quadriceps_effort',
        'shoulder_flexor_effort_for_overhead_variants',
        'light_hand_and_forearm_effort_for_loaded_variants'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_pain','neck_or_low_back_pressure',
        'numbness_or_tingling','dizziness_or_nausea',
        'pelvic_floor_pressure_or_leakage','breath_lock_or_panic',
        'unsafe_grip_or_implement_movement'),
      'painGuidance','Bend and lower the limbs under control, safely set down any implement, stop the set, and tell the coach. Do not force lumbar contact or retry automatically.',
      'selfChecks',jsonb_build_array(
        'exact_variant_and_side','assigned_lumbar_floor_relationship',
        'fixed_arm_and_leg_levers','continuous_breathing',
        'no_rocking_or_implement_motion','quality_terminated_time_and_controlled_exit'),
      'accessibility',jsonb_build_array(
        'shorter_hold','more_rest','tuck_variant','one_leg_variant',
        'arms_forward_instead_of_overhead','unloaded_variant',
        'dead_bug_or_non_supine_reviewed_substitution'),
      'mediaAlternatives',jsonb_build_array(
        'plain_language_setup_hold_exit','side_view_still_sequence',
        'qualified_live_demonstration','visual_or_tactile_targets_with_consent'),
      'stopSignal','Say stop, bend the knees, bring the arms in, safely set down any implement, and report what changed.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_variant_side_implement_mass_and_entry',
        'head_scapulae_ribs_lumbar_region_pelvis_and_floor_relationship',
        'arm_leg_knee_and_loaded_implement_positions',
        'symmetry_or_declared_one_leg_side','breathing_and_pressure_signs',
        'hold_time_first_quality_break_and_controlled_exit'),
      'faultCorrections',jsonb_build_object(
        'lumbar_contact_or_rib_pelvis_shape_changes','shorten_lever_or_hold_and_rebuild_from_tuck',
        'neck_overworks','reduce_shoulder_lift_or_support_head_only_in_a_separate_reviewed_variant',
        'leg_rises_or_knee_bends','end_hold_then_select_shorter_exact_lever',
        'arm_or_load_moves','end_hold_and_reduce_lever_or_external_load',
        'rocking_or_momentum','stop_and_restore_static_repetition_boundary',
        'breath_lock_or_symptom','end_set_and_reassess'),
      'demonstrationPlan',jsonb_build_array(
        'show_supine_setup_and_rib_pelvis_shape',
        'show_tuck_one_leg_forward_arm_and_overhead_boundaries_from_side',
        'show_loaded_pickup_fixed_position_and_safe_set_down',
        'show_first_quality_break_controlled_exit_and_stop_command'),
      'groupManagement',jsonb_build_array(
        'one_athlete_per_marked_supine_lane','stage_loaded_and_unloaded_lanes_separately',
        'coach_views_side_without_entering_limb_path','stagger_start_times_for_observation',
        'record_valid_failed_and_early_terminated_seconds_as_exposure'),
      'modificationDecisionTree',jsonb_build_array(
        'symptom_or_pressure_sign_stop_and_escalate',
        'unknown_identity_side_or_load_quarantine_selection',
        'position_or_breathing_break_shorten_hold_or_lever',
        'shoulder_limit_move_arms_forward_or_select_reviewed_substitution',
        'loaded_control_limit_remove_load_and_revalidate',
        'recompute_fatigue_duration_logistics_substitution_and_rendering_after_change'),
      'doNotUseWhen',jsonb_build_array(
        'supine_floor_transfer_or_position_is_not_tolerated',
        'pain_pressure_dizziness_neurologic_or_unusual_exertional_symptoms_are_present',
        'exact_variant_and_loaded_position_cannot_be_verified',
        'safe_loaded_pickup_set_down_or_supervision_is_unavailable',
        'session_fatigue_prevents_repeatable_shape_and_breathing'),
      'validHold','Exact shape, levers, side, load position, breathing, symptoms, elapsed time, and controlled exit all pass without a stop rule.',
      'difficultyBoundary','Scores describe exercise complexity and physical difficulty only. Do not assign or infer athlete, class, or skill-library levels from this exercise card.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array(
        'definition_variant_profile_card_and_research_version','objective_and_phase',
        'arm_leg_levers_side_shape_and_lumbar_floor_relationship',
        'implement_mass_grip_fixed_angle_pickup_and_set_down',
        'sets_hold_rest_total_isometric_seconds_and_duration',
        'same_session_trunk_hip_flexor_overhead_gymnastics_and_grip_load',
        'symptoms_recovery_population_environment_and_supervision'),
      'persistence',jsonb_build_array(
        'workout_and_item_id','definition_variant_profile_card_and_research_version',
        'exact_levers_side_shape_and_loaded_setup','planned_valid_failed_and_early_terminated_seconds',
        'first_break_symptoms_rest_duration_recovery_and_substitution',
        'athlete_and_coach_rendering_versions'),
      'issueCategories',jsonb_build_array(
        'identity_variant_or_side_mismatch','unsafe_floor_space_or_loaded_setup',
        'pain_pressure_dizziness_or_neurologic_symptom',
        'position_breathing_or_static_boundary_failure',
        'dose_duration_fatigue_or_recovery_mismatch','media_or_rendering_mismatch'),
      'incidentPath',jsonb_build_array(
        'call_stop_and_control_limbs_and_implement','make_station_safe_and_assess_immediate_help_need',
        'record_exact_setup_elapsed_time_fault_symptom_and_context',
        'follow_facility_emergency_or_clinical_referral_policy',
        'quarantine_uncertain_card_variant_media_or_result'),
      'supportEscalation',jsonb_build_array(
        'stop_and_make_station_safe','record_exact_variant_side_load_elapsed_and_failed_seconds',
        'follow_facility_emergency_or_clinical_referral_policy',
        'quarantine_uncertain_identity_media_instruction_or_result'),
      'feedbackLoop',jsonb_build_array(
        'athlete_reports_symptoms_and_perceived_shape_loss',
        'coach_records_observed_first_break_and_correction',
        'support_triages_identity_equipment_content_or_product_issue',
        'future_review_uses_deidentified_aggregate_failures_without_auto_approval'),
      'changeImpactPolicy','Any lever, side, shape, load, surface, hold, rest, fatigue, symptom, population, substitution, media, or instruction change invalidates cached selection, duration, logistics, rendering, and approval assumptions.',
      'publication',jsonb_build_object(
        'humanMediaGraphCalibrationContentAndSeparateApprovalRequired',TRUE),
      'publicationQuarantined',TRUE),
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'hollowBodyHoldAuditHardeningMigration',migration_key,
        'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
        'legacySources',source_ids,
        'consolidatedDefinitionIds',duplicate_definition_ids,
        'activeWorkingSpecifications',jsonb_build_array(
          'tuck-arms-forward','one-leg-extended-arms-forward-side-specific',
          'straight-leg-arms-forward','straight-leg-arms-overhead',
          'straight-leg-fixed-overhead-dumbbell',
          'straight-leg-fixed-overhead-medicine-ball'),
        'primaryIdentitySource','https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
        'researchSources',jsonb_build_array(
          'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
          'https://www.crossfit.com/essentials/crossfit-mastering-gymnastics',
          'https://pubmed.ncbi.nlm.nih.gov/15085209/',
          'https://pubmed.ncbi.nlm.nih.gov/23127994/',
          'https://pubmed.ncbi.nlm.nih.gov/9118976/',
          'https://pubmed.ncbi.nlm.nih.gov/26467996/',
          'https://pubmed.ncbi.nlm.nih.gov/21975179/',
          'https://pubmed.ncbi.nlm.nih.gov/18443772/'),
        'invalidPriorCitationsRemoved',jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32707142/',
          'https://pubmed.ncbi.nlm.nih.gov/19620925/'),
        'mediaState','five_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'researchLimits','Exact professional instruction plus adjacent acute EMG and performance-test evidence; no universal safety dose recovery outcome transfer or numeric difficulty claim.',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,'physicalDifficulty',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',1,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',1,'decisionDemand',greatest(6,v.coordination-12),
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
      'orientation','supine_on_level_stable_floor_or_flat_mat',
      'entry','establish_rib_pelvis_and_lumbar_floor_relationship_then_set_shoulders_arms_and_legs_one_dimension_at_a_time',
      'trunkContract','declared_posterior_pelvic_tilt_rib_position_and_no_visible_space_between_assigned_lumbar_region_and_floor',
      'shoulderBladePosition','scapulae_elevated_to_declared_repeatable_height',
      'headNeck','neutral_or_slight_flexion_without_forced_chin_tuck_or_neck_pain',
      'legContract',v.leg_contract,'armContract',v.arm_contract,
      'laterality',v.laterality,'sideParameterRequired',v.side_required,
      'loadContract',v.load_contract,'loadPosition','fixed_for_entire_timed_hold',
      'motionBoundary','no_rocking_kicking_reaching_pullover_lowering_exchange_or_repositioning_during_valid_hold',
      'breathing','continuous_without_bearing_down_or_pressure_symptoms',
      'dose','profile_declared_quality_terminated_seconds',
      'exit','control_limbs_inward_and_safely_set_down_implement_before_releasing_shape',
      'equipmentRequired',v.equipment_required,
      'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'externalLoadMethod',v.load_method,
      'externalLoadDescription',v.load_description,
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'dominantContraction','isometric',
      'effectiveLoadDrivers',jsonb_build_array(
        'head_arm_and_leg_segment_mass','hip_knee_and_shoulder_levers',
        'limb_height_and_range','external_implement_mass_and_angle_if_loaded',
        'hold_duration','breathing','prior_trunk_hip_flexor_and_overhead_fatigue'),
      'loadTracking',jsonb_build_array(
        'exact_variant','side_if_one_leg','arm_and_leg_levers',
        'implement_mass_grip_and_fixed_angle','valid_failed_and_early_terminated_seconds',
        'same_session_hollow_leg_raise_dead_bug_l_sit_gymnastics_and_overhead_work')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',v.recovery_hours,
      'recoveryWindow','typically_6_to_36_hours_context_novelty_volume_load_symptoms_and_other_trunk_work_dependent',
      'primaryFatigueSites',jsonb_build_array(
        'abdominal_wall','hip_flexors','quadriceps',
        'shoulder_flexors_for_overhead_variants',
        'hand_forearm_and_upper_body_for_loaded_variants'),
      'earlyFatigueSignals',jsonb_build_array(
        'lumbar_space_or_rib_pelvis_shape_changes','scapulae_or_head_lower',
        'leg_rises_knee_bends_or_side_changes','arm_or_implement_angle_changes',
        'rocking_tremor_or_momentum','breath_lock_bearing_down_or_pressure_sign'),
      'downstreamConflicts',jsonb_build_array(
        'priority_hollow_arch_gymnastics_or_trunk_control_work',
        'high_volume_hip_flexor_leg_raise_l_sit_or_abdominal_training',
        'heavy_or_high_volume_overhead_pull_push_or_pullover_work',
        'symptomatic_spine_hip_shoulder_neck_or_pressure_loading')),
    jsonb_build_object(
      'trainingStimuli',v.stimuli,
      'stimulusDose',jsonb_build_object(
        'primary','quality_terminated_isometric_seconds',
        'countFailedAndEarlyTerminatedSecondsAsExposure',TRUE,
        'fatigueCeiling','low_to_moderate'),
      'weeklyExposure','Combine valid, failed, and early-terminated seconds with hollow rocks, flutter kicks, leg lowers, dead bugs, L-sits, loaded pullovers, trunk isometrics, hip-flexor work, and sport shape training.',
      'prerequisites',jsonb_build_array(
        'pain_free_supine_position_and_floor_transfer','exact_variant_and_side_understood',
        'declared_shape_and_levers_can_be_set_without_momentum',
        'continuous_breathing','safe_loaded_pickup_hold_and_set_down_if_applicable'),
      'completionCriteria',jsonb_build_array(
        'exact_shape_arm_leg_levers_side_and_loaded_position',
        'no_intended_motion_and_continuous_breathing',
        'quality_terminated_time_and_controlled_exit',
        'dose_fault_symptom_duration_and_recovery_recorded'),
      'sequenceRules',jsonb_build_array(
        'use_after_floor_access_and_specific_shape_rehearsal',
        'place_before_fatiguing_trunk_hip_flexor_overhead_or_gymnastics_work_when_quality_is_priority',
        'do_not_use_as_unplanned_max_duration_or_hiit_station',
        'stop_before_position_breathing_grip_or_static_boundary_failure'),
      'pairingCompatibility',jsonb_build_array(
        'noncompeting_lower_body_mobility','low_demand_upper_body_access',
        'rested_technical_work_that_does_not_share_trunk_or_overhead_fatigue'),
      'interferenceRules',jsonb_build_array(
        'do_not_prefatigue_trunk_hip_flexors_shoulders_or_grip_before_quality_holds',
        'do_not_silently_change_arm_leg_side_load_or_static_repetition_boundary',
        'recompute_identity_fatigue_duration_logistics_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object(
        'unknownLeverSideLoadPositionBreathingSymptomsOrExit','fail_closed_and_request_coach_review',
        'neverInferMissingMechanicsFromNameOrVideoTitle',TRUE,
        'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE),
      'cumulativeBudget',jsonb_build_object(
        'hollowIsometricSeconds',v.seconds_budget,
        'loadedHollowSeconds',CASE WHEN v.load_method='bodyweight_lever' THEN 0 ELSE v.seconds_budget END,
        'failedAndEarlyTerminatedSecondsCount',TRUE,
        'sameSessionTrunkHipFlexorOverheadGripAndShapeWorkRequired',TRUE))
  FROM (VALUES
    (tuck_variant,'tuck-arms-forward','Hollow Body Hold — Tuck, Arms Forward',
      ARRAY['tuck','arms_forward','bodyweight','bilateral']::TEXT[],
      34,32,24,22,40,34,28,8,8,12,1,8,20,16,36,34,1,12,
      'both_hips_and_knees_flexed_with_feet_off_floor_and_thighs_at_declared_tuck_angle',
      'both_elbows_extended_arms_reaching_forward_beside_thighs',
      'bilateral_symmetric',FALSE,'bodyweight_only_no_external_implement',
      'bodyweight_lever',ARRAY['none']::TEXT[],
      'Bodyweight segment leverage only; no external implement or partner force.',
      jsonb_build_array('static_hollow_shape_control','short_lever_anti_extension','breathing_under_isometric_tension'),180),
    (one_leg_variant,'one-leg-extended-arms-forward-side-specific',
      'Hollow Body Hold — One Leg Extended, Arms Forward',
      ARRAY['one_leg','arms_forward','bodyweight','side_specific']::TEXT[],
      42,44,34,24,48,44,36,10,10,18,1,10,26,22,46,44,1,12,
      'one_leg_straight_at_declared_height_while_opposite_hip_and_knee_remain_tucked_side_declared',
      'both_elbows_extended_arms_reaching_forward_beside_thighs',
      'side_specific_extended_leg',TRUE,'bodyweight_only_no_external_implement',
      'bodyweight_lever',ARRAY['none']::TEXT[],
      'Bodyweight asymmetric leg leverage only; extended-leg side must be prescribed and recorded.',
      jsonb_build_array('side_specific_hollow_shape_control','asymmetric_leg_lever_anti_extension','breathing_under_isometric_tension'),180),
    (straight_forward_variant,'straight-leg-arms-forward',
      'Hollow Body Hold — Straight Legs, Arms Forward',
      ARRAY['straight_leg','arms_forward','bodyweight','bilateral']::TEXT[],
      40,54,42,26,54,38,44,12,12,24,1,12,30,26,54,48,1,18,
      'both_knees_extended_legs_together_at_individually_owned_declared_height',
      'both_elbows_extended_arms_reaching_forward_parallel_to_thighs',
      'bilateral_symmetric',FALSE,'bodyweight_only_no_external_implement',
      'bodyweight_lever',ARRAY['none']::TEXT[],
      'Bodyweight straight-leg leverage with arms forward; leg height is fixed for the hold.',
      jsonb_build_array('straight_leg_hollow_shape_control','long_leg_anti_extension','breathing_under_isometric_tension'),200),
    (overhead_variant,'straight-leg-arms-overhead',
      'Hollow Body Hold — Straight Legs, Arms Overhead',
      ARRAY['straight_leg','arms_overhead','bodyweight','bilateral']::TEXT[],
      48,66,54,42,62,48,52,14,18,30,1,14,38,32,64,56,1,18,
      'both_knees_extended_legs_together_at_individually_owned_declared_height',
      'both_elbows_extended_arms_by_ears_at_declared_owned_overhead_angle',
      'bilateral_symmetric',FALSE,'bodyweight_only_no_external_implement',
      'bodyweight_lever',ARRAY['none']::TEXT[],
      'Bodyweight long arm-and-leg leverage; shoulder angle and leg height are fixed for the hold.',
      jsonb_build_array('long_lever_hollow_shape_control','combined_arm_leg_anti_extension','overhead_isometric_control'),180),
    (dumbbell_variant,'straight-leg-fixed-overhead-dumbbell',
      'Hollow Body Hold — Fixed Overhead Dumbbell',
      ARRAY['straight_leg','arms_overhead','dumbbell','bilateral','loaded']::TEXT[],
      58,74,62,44,70,56,58,16,26,38,38,20,52,44,70,62,30,24,
      'both_knees_extended_legs_together_at_individually_owned_declared_height',
      'both_hands_secure_one_declared_dumbbell_with_elbows_extended_at_fixed_owned_overhead_angle',
      'bilateral_symmetric',FALSE,'one_dumbbell_fixed_in_both_hands_no_pullover_motion',
      'fixed_external_free_weight',ARRAY['dumbbell','mat','timer']::TEXT[],
      'One exact dumbbell mass held securely with both hands at a fixed declared angle; pickup and set-down are part of the specification.',
      jsonb_build_array('loaded_hollow_isometric','combined_arm_leg_anti_extension','overhead_grip_and_load_control'),150),
    (medicine_ball_variant,'straight-leg-fixed-overhead-medicine-ball',
      'Hollow Body Hold — Fixed Overhead Medicine Ball',
      ARRAY['straight_leg','arms_overhead','medicine_ball','bilateral','loaded']::TEXT[],
      54,70,58,44,68,52,56,16,24,36,30,18,46,40,66,58,24,24,
      'both_knees_extended_legs_together_at_individually_owned_declared_height',
      'both_hands_secure_one_declared_medicine_ball_with_elbows_extended_at_fixed_owned_overhead_angle',
      'bilateral_symmetric',FALSE,'one_medicine_ball_fixed_in_both_hands_no_throw_catch_or_exchange',
      'fixed_external_ball_load',ARRAY['medicine_ball','mat','timer']::TEXT[],
      'One exact medicine-ball mass held securely with both hands at a fixed declared angle; no release, exchange, or catch occurs.',
      jsonb_build_array('loaded_hollow_isometric','combined_arm_leg_anti_extension','overhead_ball_control'),150)
  ) v(id,variant_key,display_name,modifiers,complexity,physical,
      relative_strength,mobility,stability,coordination,work_capacity,
      eccentric,joint_stress,spinal_loading,grip,fear,supervision,failure,
      local_fatigue,technical_fatigue,grip_fatigue,recovery_hours,
      leg_contract,arm_contract,laterality,side_required,load_contract,
      load_method,equipment_required,load_description,stimuli,seconds_budget)
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
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,92,
    jsonb_build_object(
      'staticShapeControl',5,'trunkAntiExtensionControl',5,
      'breathingAndPosition',5,'strengthEndurance',CASE profile.phase_key
        WHEN 'capacity' THEN 4 ELSE 2 END,
      'hypertrophyOrClinicalOutcomeClaim',0),
    jsonb_build_object(
      'doseType','quality_terminated_isometric_seconds','sets',profile.sets,
      'holdSecondsMinimum',profile.hold_min,
      'holdSecondsMaximum',profile.hold_max,
      'restSeconds',profile.rest_seconds,'rpeRange',profile.rpe_range,
      'qualityTerminated',TRUE,'countFailedAndEarlyTerminatedSecondsAsExposure',TRUE,
      'evidenceStatus','provisional_coaching_dose_not_a_research_prescription'),
    'Every counted second retains the assigned rib-pelvis and lumbar-floor relationship, shoulder-blade height, arm and leg levers, side, fixed loaded position, and breathing without rocking, limb motion, symptoms, or another stop rule.',
    ARRAY[
      'sharp_or_increasing_pain_pressure_numbness_tingling_dizziness_nausea_or_fear',
      'wrong_or_unknown_variant_side_arm_leg_lever_implement_mass_or_fixed_load_angle',
      'floor_mat_space_timer_pickup_or_set_down_zone_becomes_unsafe',
      'assigned_lumbar_floor_relationship_rib_position_or_pelvic_position_changes',
      'head_or_scapulae_lower_or_neck_strain_changes_the_declared_position',
      'leg_rises_knee_bends_legs_separate_or_one_leg_side_changes',
      'arm_elbow_grip_or_loaded_implement_angle_changes',
      'rocking_kicking_reaching_pullover_lowering_exchange_or_other_motion_begins',
      'breath_lock_bearing_down_coning_doming_or_pressure_symptom_appears',
      'planned_hold_total_budget_or_first_uncorrected_quality_break_is_reached'],
    profile.coach_instructions,profile.athlete_instructions,
    profile.expected_adaptation,profile.equipment_required,
    jsonb_build_object(
      'athletesPerStation',1,'setupSeconds',profile.setup_seconds,
      'transitionSeconds',20,'station','one_clear_stable_supine_lane_per_athlete',
      'equipmentCheck','dry_flat_floor_optional_mat_timer_and_exact_loaded_implement_if_used',
      'coachPosition','side_view_outside_arm_leg_and_loaded_set_down_paths',
      'loadedLaneSeparation',profile.loaded,
      'changeRule','coach_rechecks_identity_and_recomputes_dose_fatigue_duration_logistics_and_rendering',
      'substitutionRevalidation',jsonb_build_array(
        'identity','shape','arm_lever','leg_lever','side','load','grip',
        'entry','breathing','hold','rest','population','fatigue','duration','exit','rendering')),
    CASE profile.variant_id
      WHEN tuck_variant THEN ARRAY[one_leg_variant,straight_forward_variant]::UUID[]
      WHEN one_leg_variant THEN ARRAY[tuck_variant,straight_forward_variant]::UUID[]
      WHEN straight_forward_variant THEN ARRAY[tuck_variant,one_leg_variant,overhead_variant]::UUID[]
      WHEN overhead_variant THEN ARRAY[straight_forward_variant,dumbbell_variant,medicine_ball_variant]::UUID[]
      WHEN dumbbell_variant THEN ARRAY[overhead_variant,medicine_ball_variant]::UUID[]
      ELSE ARRAY[overhead_variant,dumbbell_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'setupSeconds',profile.setup_seconds,'holdSecondsMinimum',profile.hold_min,
      'holdSecondsMaximum',profile.hold_max,'exitSeconds',10,
      'transitionSeconds',20,'durationIncludesRest',TRUE,
      'durationFormula','setup + sets * (selected_hold_seconds + controlled_exit_and_reset) + inter_set_rest + transition',
      'durationCeilingSeconds',profile.duration_ceiling,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'reduce',jsonb_build_array(
        'reduce_hold','increase_rest','raise_leg_height_within_exact_variant',
        'move_arms_forward_via_reviewed_variant','select_one_leg_or_tuck_variant',
        'remove_external_load_via_reviewed_variant'),
      'increase',jsonb_build_array(
        'add_seconds_within_profile_ceiling','lower_leg_height_within_owned_range',
        'lengthen_one_lever_via_reviewed_variant','add_fixed_external_load_only_after_review'),
      'changeOneVariableAtATime',TRUE,'revalidateAfterChange',TRUE,
      'symptomRule','stop_and_select_reviewed_pain_free_alternative'),
    jsonb_build_object(
      'record',jsonb_build_array(
        'definition_id','variant_id','profile_key','side_if_one_leg',
        'rib_pelvis_lumbar_floor_relationship_and_shoulder_blade_height',
        'arm_leg_levers_and_leg_height','implement_mass_grip_and_fixed_angle',
        'planned_valid_failed_and_early_terminated_seconds',
        'first_position_breathing_grip_or_static_boundary_break',
        'rest_duration_symptoms_stop_reason_and_substitution'),
      'comparisonRule','Compare only when variant, side, levers, limb height, shape, load, grip, fixed angle, breathing, timing, and measurement method match.',
      'validity','all exact identity position breathing load dose symptom duration and exit gates pass'),
    jsonb_build_object(
      'before','Which exact variant, side, levers, load and fixed angle, hold, rest, sets, and stop signal are assigned?',
      'during','Are shape, scapulae, arms, legs, side, implement, breathing, and static boundary still exact?',
      'after','Store valid, failed, and early-terminated seconds, first break, symptoms, duration, rest, and substitution.',
      'supportEscalation','Escalate symptoms, identity or load mismatch, inaccessible instruction, or media mismatch through the documented support path.',
      'mediaFallback','Use the written contract, side-view still sequence, and qualified live demonstration until exact video is independently approved.')
  FROM (VALUES
    (tuck_variant,'movement-intelligence-tuck','movement_intelligence','primary',
      'Develop the short-lever static hollow shape, breathing, and controlled exit with minimal fatigue.',98,2,8,15,35,jsonb_build_array(4,6),FALSE,25,390,ARRAY['none']::TEXT[],
      'Confirm tuck angle, arm reach, shoulder-blade height, lumbar contact, breathing, timer, and controlled exit. End the first time any element changes.',
      'Hold the exact tuck and forward reach, breathe, and stop at the first shape change.',
      'More repeatable short-lever hollow shape and breathing control.'),
    (tuck_variant,'capacity-tuck-hold','capacity','primary',
      'Accumulate quality tuck-hold seconds without turning the task into a maximum-duration test.',92,3,12,20,45,jsonb_build_array(5,7),FALSE,25,560,ARRAY['none']::TEXT[],
      'Keep every set submaximal, count failed seconds, and stop before the athlete raises the feet, lowers the shoulders, changes lumbar contact, or locks breathing.',
      'Match the tuck and breathing every set. Stop while you can still exit under control.',
      'Improved repeatability of a short-lever static hollow under modest volume.'),
    (one_leg_variant,'movement-intelligence-one-leg','movement_intelligence','primary',
      'Develop exact side-specific one-leg leverage while the opposite leg remains tucked and the trunk stays static.',96,2,8,15,45,jsonb_build_array(4,6),FALSE,25,430,ARRAY['none']::TEXT[],
      'Declare and record the extended-leg side. Compare sides only with the same lever, height, arm position, shape, breathing, and hold.',
      'Keep one leg long and the other tucked on the assigned side. Breathe and freeze every position.',
      'More repeatable side-specific hollow shape and asymmetry observation.'),
    (one_leg_variant,'capacity-one-leg-hold','capacity','primary',
      'Accumulate quality one-leg hold seconds on declared sides without alternating during a timed hold.',90,3,10,20,60,jsonb_build_array(5,7),FALSE,25,620,ARRAY['none']::TEXT[],
      'Prescribe side order outside the hold, count both sides separately, and stop on the first lever, side, pelvis, breathing, or exit error.',
      'Hold the assigned side without switching. Reset fully before the other side.',
      'Improved repeatability of side-specific long-leg anti-extension control.'),
    (straight_forward_variant,'movement-intelligence-straight-arms-forward','movement_intelligence','primary',
      'Develop bilateral straight-leg hollow control with arms forward and a recorded leg height.',95,2,8,15,50,jsonb_build_array(4,6),FALSE,25,450,ARRAY['none']::TEXT[],
      'Record leg height and arm reach. Stop if knees bend, legs separate, feet rise, scapulae lower, lumbar contact changes, or breathing locks.',
      'Keep both legs long at the target height, reach forward, breathe, and stop at the first change.',
      'More repeatable straight-leg hollow control with a shorter arm lever.'),
    (straight_forward_variant,'capacity-straight-arms-forward','capacity','primary',
      'Accumulate fully controlled straight-leg arms-forward isometric seconds with total trunk exposure accounted for.',90,3,10,20,60,jsonb_build_array(5,7),FALSE,25,660,ARRAY['none']::TEXT[],
      'Use a submaximal hold, full rest, and the same leg target. Combine exposure with leg raises, dead bugs, L-sits, and other trunk work.',
      'Hold the same long-leg position every set and finish before the shape changes.',
      'Improved repeatable straight-leg hollow capacity at a fixed arm lever.'),
    (overhead_variant,'movement-intelligence-straight-overhead','movement_intelligence','primary',
      'Develop the exact long arm-and-leg hollow shape while preserving owned shoulder range and breathing.',94,2,8,15,60,jsonb_build_array(4,6),FALSE,30,480,ARRAY['none']::TEXT[],
      'Verify shoulder range before starting. Record arm and leg targets and stop if either lever changes or the athlete substitutes rib flare or neck strain.',
      'Keep your arms by your ears and both legs at the targets. Breathe without changing the shape.',
      'More repeatable long-lever static hollow shape with overhead control.'),
    (overhead_variant,'capacity-straight-overhead','capacity','primary',
      'Accumulate controlled long-lever overhead hollow seconds without failure, forced lumbar contact, or unplanned dose.',88,3,10,20,75,jsonb_build_array(5,7),FALSE,30,740,ARRAY['none']::TEXT[],
      'Cap total seconds, use full rest, and combine exposure with overhead, gymnastics, hip-flexor, and trunk work before accepting the dose.',
      'Match the long arm-and-leg shape every set. Stop before your arms, legs, back, or breathing changes.',
      'Improved long-lever hollow repeatability under a quality-terminated dose.'),
    (dumbbell_variant,'movement-intelligence-fixed-dumbbell','movement_intelligence','conditional',
      'Rehearse one exact light dumbbell pickup, fixed overhead hold, static shape, and safe set-down.',86,2,6,12,75,jsonb_build_array(4,6),TRUE,45,520,ARRAY['dumbbell','mat','timer']::TEXT[],
      'Coach controls the lane and verifies mass, two-hand grip, pickup, fixed angle, trunk and limb targets, breathing, and set-down. Dynamic pullover motion invalidates the hold.',
      'Hold the dumbbell still with both hands, freeze the assigned shape, breathe, and set it down safely before relaxing.',
      'More repeatable light loaded static setup and implement control.'),
    (dumbbell_variant,'capacity-fixed-dumbbell','capacity','primary',
      'Accumulate conservative fixed-position dumbbell hollow seconds with grip, overhead, trunk, and total loaded exposure recorded.',82,3,8,15,90,jsonb_build_array(5,7),TRUE,45,800,ARRAY['dumbbell','mat','timer']::TEXT[],
      'Use exact mass and full rest. Stop before grip, elbow, shoulder, implement angle, trunk, legs, or breathing changes; never convert the set to pullovers.',
      'Keep the exact dumbbell still and stop while the grip, shape, breathing, and set-down remain controlled.',
      'Improved repeatability of a fixed light external load over the static hollow shape.'),
    (medicine_ball_variant,'movement-intelligence-fixed-medicine-ball','movement_intelligence','conditional',
      'Rehearse one exact light medicine-ball pickup, fixed overhead hold, static shape, and safe set-down without release.',88,2,6,12,75,jsonb_build_array(4,6),TRUE,45,520,ARRAY['medicine_ball','mat','timer']::TEXT[],
      'Verify ball mass, surface, two-hand grip, pickup, fixed angle, limb targets, breathing, and set-down. A throw, exchange, catch, or roll is a different task.',
      'Hold the ball still with both hands, freeze the assigned shape, breathe, and set it down safely.',
      'More repeatable light loaded static setup and medicine-ball control.'),
    (medicine_ball_variant,'capacity-fixed-medicine-ball','capacity','primary',
      'Accumulate conservative fixed-position medicine-ball hollow seconds with grip, overhead, trunk, and loaded exposure recorded.',84,3,8,15,90,jsonb_build_array(5,7),TRUE,45,800,ARRAY['medicine_ball','mat','timer']::TEXT[],
      'Use exact mass and full rest. Stop before the ball, grip, shoulder, trunk, legs, or breathing changes; no partner exchange is allowed.',
      'Keep the exact ball still and stop while the grip, shape, breathing, and set-down remain controlled.',
      'Improved repeatability of a fixed light ball load over the static hollow shape.')
  ) profile(variant_id,profile_key,phase_key,role,purpose,suitability,
      sets,hold_min,hold_max,rest_seconds,rpe_range,loaded,setup_seconds,
      duration_ceiling,equipment_required,coach_instructions,
      athlete_instructions,expected_adaptation)
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
  SELECT canonical_id,2,e.section_key,e.source_url,e.source_title,
    e.source_publisher,e.source_kind,
    e.claims||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'limitations','Exact professional instruction and adjacent acute EMG, performance-test, pullover, and isometric-fatigue studies do not establish one universal shape, muscle force, adaptation, transfer, treatment effect, dose, recovery interval, safety threshold, readiness rule, numeric difficulty, or publication approval.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity',
      'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
      'Gymnastics Training Guide','CrossFit','professional_standard',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The guide defines the supine hollow body position as a static shape with lumbar-floor contact, elevated scapulae, posterior pelvic tilt, extended hips, locked knees and elbows, and arms by the ears; it also permits a tucked position.',
        'limits','Professional instruction, not comparative safety, outcome, dose, or score evidence.'))),
    ('taxonomy',
      'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
      'Gymnastics Training Guide','CrossFit','professional_standard',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The guide lists static hollow holds separately from hollow rocks, hollow-to-arch transitions, sit-ups, V-ups, and other dynamic drills.',
        'limits','Names alone do not resolve every legacy or loaded variation.'))),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/15085209/',
      'Surface Electromyographic Activity of the Abdominal Muscles During Pelvic-Tilt and Abdominal-Hollowing Exercises',
      'Journal of Athletic Training','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','Rectus abdominis and external-oblique surface EMG was recorded during supine pelvic-tilt and abdominal-hollowing tasks under supported and unsupported leg conditions.',
        'sample','26 healthy active young adult women',
        'limits','Abdominal hollowing is not the same exercise as the gymnastics Hollow Body Hold, and surface EMG is not muscle force or adaptation.'))),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/9118976/',
      'Abdominal and hip flexor muscle activation during various training exercises',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','Bilateral leg lifts, unlike unilateral leg lifts in the tested conditions, required measured abdominal activation, supporting explicit bilateral versus one-leg lever labeling.',
        'limits','The tested dynamic leg lifts are adjacent evidence, not the exact static Hollow Body Hold.'))),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/26467996/',
      'Electromyographic and kinetic analysis of two abdominal muscle performance tests',
      'Physiotherapy Theory and Practice','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','Double-leg-lowering performance depends on simultaneous abdominal activity, pelvic motion, leg position, and external torque.',
        'limits','A performance-test analysis does not validate universal Hollow Body Hold scores; all numeric difficulty remains independently reviewable.'))),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/18443772/',
      'Trunk antagonist co-activation is associated with impaired neuromuscular performance',
      'Journal of Electromyography and Kinesiology','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','Force variability increased during more strenuous graded isometric trunk exertions and after fatigue in the tested protocol.',
        'limits','The laboratory trunk exertions were not Hollow Body Holds and do not prescribe recovery hours or safe fatigue thresholds.'))),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/23127994/',
      'Effects of the pelvic rotatory control method on abdominal muscle activity and the pelvic rotation during active straight leg raising',
      'Manual Therapy','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Pelvic-control instruction changed measured abdominal activity and pelvic rotation during active straight-leg raising.',
        'limits','This adjacent straight-leg-raise study does not establish a universal hollow position, symptom rule, or population clearance.'))),
    ('dosage','https://www.crossfit.com/essentials/crossfit-mastering-gymnastics',
      'Mastering CrossFit Gymnastics: How to Build Strength, Stability, and Confidence',
      'CrossFit','expert_instruction',76,
      jsonb_build_array(jsonb_build_object(
        'claim','The article gives an example practice structure that accumulates 30 seconds of hollow-hold work within three rounds.',
        'limits','A coaching example is not a universal dose, progression threshold, or recovery prescription.'))),
    ('instructions',
      'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
      'Gymnastics Training Guide','CrossFit','professional_standard',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The guide teaches a staged setup: establish lumbar-floor contact and scapular elevation, lower the legs while retaining the torso, then move the arms overhead.',
        'limits','Loaded pickup and set-down are not specified by this source.'))),
    ('safety_stop_rules','https://www.crossfit.com/essentials/crossfit-mastering-gymnastics',
      'Mastering CrossFit Gymnastics: How to Build Strength, Stability, and Confidence',
      'CrossFit','expert_instruction',76,
      jsonb_build_array(jsonb_build_object(
        'claim','The article recommends mastering static hollow and arch tension before adding dynamic motion.',
        'limits','It does not validate medical clearance, universal pain rules, or numeric safety thresholds.'))),
    ('programming','https://www.crossfit.com/essentials/crossfit-mastering-gymnastics',
      'Mastering CrossFit Gymnastics: How to Build Strength, Stability, and Confidence',
      'CrossFit','expert_instruction',76,
      jsonb_build_array(jsonb_build_object(
        'claim','The article separates positional practice, static holds, dynamic hollow rocks, kip swings, and strict-strength work.',
        'limits','Transfer and injury-risk claims are not established by a comparative trial.'))),
    ('athlete_support',
      'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
      'Gymnastics Training Guide','CrossFit','professional_standard',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The guide provides observable body-position points from toes through fingertips and allows a tucked setup before longer levers.',
        'limits','Individual symptoms, accessibility, comprehension, and loaded handling require separate review.'))),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/15085209/',
      'Surface Electromyographic Activity of the Abdominal Muscles During Pelvic-Tilt and Abdominal-Hollowing Exercises',
      'Journal of Athletic Training','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','Supported and unsupported leg conditions were experimentally distinguished rather than treated as one interchangeable posture.',
        'limits','The study task and cohort do not validate a Hollow Body Hold coaching progression.'))),
    ('accessibility',
      'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
      'Gymnastics Training Guide','CrossFit','professional_standard',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The guide explicitly notes that the floor position can be performed in a tuck and teaches leg and arm leverage progressively.',
        'limits','A tuck is one option; it does not resolve supine intolerance, symptoms, language, sensory, or cognitive access needs.'))),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/21975179/',
      'Effects of the pullover exercise on the pectoralis major and latissimus dorsi muscles as evaluated by EMG',
      'Journal of Applied Biomechanics','peer_reviewed_research',84,
      jsonb_build_array(jsonb_build_object(
        'claim','The studied barbell pullover moved an external load through concentric and eccentric phases, with activation dependent on the external-force lever arm.',
        'limits','Dynamic pullover evidence cannot support a fixed static loaded hold; it instead supports keeping the action boundaries explicit.'))),
    ('media','https://www.crossfit.com/at-home/hollow-hold',
      'At-Home: Hollow Hold','CrossFit','expert_instruction',74,
      jsonb_build_array(jsonb_build_object(
        'claim','An exact demonstration candidate must visibly establish supine setup, shape, arm and leg levers, static hold, breathing, quality termination, and controlled exit.',
        'limits','A page, title, thumbnail, or oEmbed response cannot establish full playback, exact variant match, captions, accessibility, cue quality, safety, or approval.')))
  ) e(section_key,source_url,source_title,source_publisher,source_kind,quality,claims)
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
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,NULL,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate',media.discovery_method,media.source_query,
    NULL,NULL,'2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This proves metadata response only. A qualified human must watch the full video and verify exact static identity, variant, shape, arm and leg levers, side, load, entry, breathing, hold, quality stop, exit, captions, accessibility, safety, conflicts, cue quality, reviewer identity, timestamp, and approval.'
  FROM (VALUES
    ('QgVOvBM96eE','At-Home Workout: Hollow Hold','CrossFit','manual_research',
      'CrossFit At-Home Hollow Hold page embed rechecked through YouTube oEmbed'),
    ('qU0r6449do4','Hollow Hold','Pamela Gagnon - Gymnastics Skills & Drills','manual_research',
      'CrossFit gymnastics article Hollow Hold link rechecked through YouTube oEmbed'),
    ('pLt0s2cimdI','HOLLOW BODY | A key to motor control.','Carl Paoli','legacy_import',
      'legacy Hollow Body Hold candidate rechecked through YouTube oEmbed'),
    ('LlDNef_Ztsc','Hollow Body Hold Progression - Gymnastic Core Stability Exercise','GMB Fitness (Praxis)','legacy_import',
      'legacy Hollow Body Hold candidate rechecked through YouTube oEmbed'),
    ('VyrUmzIHmzw','Hollow Body Progression Pt.1','Carl Paoli','legacy_import',
      'legacy Hollow Body Hold candidate rechecked through YouTube oEmbed')
  ) media(video_id,title,channel,discovery_method,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method=EXCLUDED.discovery_method,source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,a.name,a.classification,a.rationale,a.dimensions,
    NULL,'candidate',NULL,NULL
  FROM (VALUES
    ('Hollow Body Hold — Tuck, Arms Forward','same_identity','Matches the exact short-lever static working specification.',jsonb_build_object('variantKey','tuck-arms-forward')),
    ('Hollow Body Hold — One Leg Extended','same_identity','Matches the exact side-specific one-leg static specification when the extended-leg side is declared.',jsonb_build_object('variantKey','one-leg-extended-arms-forward-side-specific')),
    ('Hollow Body Hold — Straight Legs, Arms Forward','same_identity','Matches the exact bilateral straight-leg arms-forward static specification.',jsonb_build_object('variantKey','straight-leg-arms-forward')),
    ('Hollow Body Hold — Straight Legs, Arms Overhead','same_identity','Matches the exact bilateral long arm-and-leg static specification.',jsonb_build_object('variantKey','straight-leg-arms-overhead')),
    ('Fixed Overhead Dumbbell Hollow Body Hold','same_identity','Matches the exact fixed-position two-hand dumbbell variant only when no pullover motion occurs.',jsonb_build_object('variantKey','straight-leg-fixed-overhead-dumbbell')),
    ('Fixed Overhead Medicine-Ball Hollow Body Hold','same_identity','Matches the exact fixed-position two-hand medicine-ball variant only when no release or exchange occurs.',jsonb_build_object('variantKey','straight-leg-fixed-overhead-medicine-ball')),
    ('Hollow Hold','same_identity','Common alias for the static supine Hollow Body Hold when the exact variant is declared.',jsonb_build_object('alias','Hollow Hold')),
    ('Supine Hollow Hold','same_identity','Orientation-explicit synonym for the same static family.',jsonb_build_object('alias','Supine Hollow Hold')),
    ('Hold Duration','modifier_annotation','Prescribed and completed quality-terminated seconds are delivery metadata when the exact shape and levers remain unchanged.',jsonb_build_object('modifier','hold_seconds')),
    ('Rest Interval','modifier_annotation','Rest changes recovery and density, not identity, and must be recorded.',jsonb_build_object('modifier','rest_seconds')),
    ('Set Count','modifier_annotation','Set count changes total exposure and duration while exact mechanics remain fixed.',jsonb_build_object('modifier','sets')),
    ('Leg Height Within Exact Variant','modifier_annotation','A recorded owned height scales moment demand without changing the declared knee and bilateral or one-leg contract.',jsonb_build_object('modifier','leg_height')),
    ('Exact Overhead Arm Angle Within Variant','modifier_annotation','A recorded owned shoulder angle is an annotation only while overhead classification, elbow extension, load state, and static boundary remain fixed.',jsonb_build_object('modifier','arm_angle')),
    ('Breathing Cadence','modifier_annotation','A coached breathing cadence is delivery metadata and cannot override symptom or quality stops.',jsonb_build_object('modifier','breathing_cadence')),
    ('One-Leg Side Order Between Holds','modifier_annotation','Side order is programming metadata; switching sides during a valid timed hold is not allowed.',jsonb_build_object('modifier','side_order')),
    ('Bent-Knee Arms-Overhead Hollow Hold','new_variant','Combines a short leg lever with a long arm lever and requires exact shoulder range, knee angle, dose, and scoring.',jsonb_build_object('armLever','overhead','legLever','bent_knee')),
    ('Straight-Leg Arms-by-Sides Hollow Hold','new_variant','Arms beside the trunk materially shorten the arm lever and change the observation and score contract.',jsonb_build_object('armLever','by_sides')),
    ('Head-Supported Hollow Body Hold','new_variant','External head or neck support changes contact, load distribution, cues, equipment, and stop response.',jsonb_build_object('headSupport',TRUE)),
    ('Heel-Supported Hollow Shape Hold','new_variant','Heel support removes unsupported leg leverage and changes load, floor contact, and purpose.',jsonb_build_object('heelSupport',TRUE)),
    ('Ankle-Weighted Hollow Body Hold','new_variant','Distal external load changes leg moment, failure consequence, equipment retention, dose, and recovery.',jsonb_build_object('externalLoad','ankle_weights')),
    ('Dumbbell-Between-Feet Hollow Body Hold','new_variant','A foot-held implement changes grip interface, retention risk, leg moment, setup, and exit.',jsonb_build_object('externalLoad','foot_held_dumbbell')),
    ('Band-Resisted Hollow Body Hold','new_variant','Band direction, anchor, tension, attachment, and release behavior require an exact reviewed variant.',jsonb_build_object('externalLoad','band_resistance')),
    ('Hollow Rock','new_definition','Repeated whole-body rocking changes the static timed hold into a dynamic cycle.',jsonb_build_object('targetDefinitionId',hollow_rock_definition)),
    ('Hollow Body Rock to Freeze','new_definition','Alternating rock and freeze periods creates a distinct dynamic-static repetition boundary.',jsonb_build_object('targetDefinitionId',rock_freeze_definition)),
    ('Hollow Flutter Kick','new_definition','Alternating leg kicks add repeated hip motion and side timing.',jsonb_build_object('targetDefinitionId',flutter_kick_definition)),
    ('Hollow-to-Arch Roll','new_definition','Rolling to a prone arch changes orientation, body shape, planes, and repetition boundary.',jsonb_build_object('targetDefinitionId',hollow_arch_roll_definition)),
    ('Eccentric Hollow Body Lower','new_definition','A prescribed lowering action and reset define an eccentric repetition rather than a static hold.',jsonb_build_object('targetDefinitionId',eccentric_lower_definition)),
    ('Partner Hollow Body Medicine-Ball Exchange','new_definition','Partner timing, release, travel, catch, and external coordination create a separate task.',jsonb_build_object('targetDefinitionId',partner_exchange_definition)),
    ('Dead Bug','new_definition','Alternating contralateral arm-and-leg reach and return differs from fixed bilateral or side-specific limb positions.',jsonb_build_object('targetDefinitionId',dead_bug_definition)),
    ('Dynamic Dumbbell or Barbell Pullover Labeled Hollow Hold','reject','Repeated shoulder motion through a loaded pullover is not a fixed-position static hold and cannot be selected from this card.',jsonb_build_object('motion','dynamic_pullover','selectable',FALSE)),
    ('Throw, Catch, or Partner Exchange Labeled Loaded Hollow Hold','reject','Releasing or receiving a ball violates the fixed-load static identity and adds collision and coordination consequences.',jsonb_build_object('motion','release_or_exchange','selectable',FALSE)),
    ('Pain-Through, Breath-Held, or Unplanned Maximum Hollow Hold','reject','Holding through symptoms, sustained breath lock, or unbudgeted failure violates the quality-terminated dose and escalation contract.',jsonb_build_object('purpose','unsafe_or_unplanned_failure','selectable',FALSE))
  ) a(name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (tuck_variant,one_leg_variant,'progression',90,ARRAY['load','leverage','complexity'],
      'Extending one declared leg increases the leg moment and adds side-specific observation while the opposite leg remains tucked.',
      '{"revalidate":["side","leg_lever","leg_height","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (one_leg_variant,tuck_variant,'regression',90,ARRAY['load','leverage','complexity'],
      'Returning both legs to the declared tuck shortens the leg lever and removes the side-specific condition.',
      '{"revalidate":["leg_lever","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (one_leg_variant,straight_forward_variant,'progression',88,ARRAY['load','leverage','complexity'],
      'Extending both legs removes the tucked-side support and increases bilateral leg-lever demand.',
      '{"revalidate":["bilateral_leg_lever","leg_height","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (straight_forward_variant,one_leg_variant,'regression',88,ARRAY['load','leverage','complexity'],
      'Tucking one declared leg shortens total leg leverage but introduces side-specific prescription and comparison.',
      '{"revalidate":["side","leg_lever","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (straight_forward_variant,overhead_variant,'progression',90,ARRAY['load','leverage','range','complexity'],
      'Moving both arms from forward reach to the declared overhead angle lengthens the arm lever and adds shoulder-range demand.',
      '{"revalidate":["shoulder_range","arm_lever","leg_height","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (overhead_variant,straight_forward_variant,'regression',90,ARRAY['load','leverage','range','complexity'],
      'Reaching the arms forward shortens the arm lever and reduces overhead-range demand while retaining straight legs.',
      '{"revalidate":["arm_lever","leg_height","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (overhead_variant,dumbbell_variant,'progression',86,ARRAY['load','complexity','fatigue'],
      'Adding one exact dumbbell introduces external mass, two-hand grip, pickup, fixed loaded angle, set-down, and additional fatigue.',
      '{"revalidate":["implement","mass","grip","fixed_angle","pickup","set_down","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,overhead_variant,'regression',86,ARRAY['load','complexity','fatigue'],
      'Removing the dumbbell preserves the long bodyweight arm-and-leg levers while removing loaded grip and handling consequences.',
      '{"revalidate":["unloaded_arm_lever","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (overhead_variant,medicine_ball_variant,'progression',84,ARRAY['load','complexity','fatigue'],
      'Adding one exact medicine ball introduces external mass, ball grip, pickup, fixed loaded angle, set-down, and additional fatigue.',
      '{"revalidate":["implement","mass","grip","fixed_angle","pickup","set_down","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (medicine_ball_variant,overhead_variant,'regression',84,ARRAY['load','complexity','fatigue'],
      'Removing the medicine ball preserves the long bodyweight levers while removing ball-retention and handling consequences.',
      '{"revalidate":["unloaded_arm_lever","hold","fatigue","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (dumbbell_variant,medicine_ball_variant,'lateral_substitution',76,ARRAY['load','complexity'],
      'Changing from a dumbbell to a medicine ball changes grip geometry, implement dimensions, exact mass options, retention, pickup, and set-down.',
      '{"revalidate":["implement","mass","grip","fixed_angle","pickup","set_down","hold","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL),
    (medicine_ball_variant,dumbbell_variant,'lateral_substitution',76,ARRAY['load','complexity'],
      'Changing from a medicine ball to a dumbbell changes grip geometry, implement dimensions, exact mass options, retention, pickup, and set-down.',
      '{"revalidate":["implement","mass","grip","fixed_angle","pickup","set_down","hold","duration","rendering"]}'::JSONB,'review',NULL,NULL,NULL)
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
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    v.anchor_tier,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on supine setup, rib-pelvis and lumbar-floor relationship, shoulder-blade height, exact arm and leg levers, side, static boundary, breathing, loaded handling, observation, quality termination, and controlled exit.'
    ELSE
      'Review-only physical-difficulty anchor based on head, arm, and leg segment moments, limb height, shoulder range, external implement mass and angle, grip, hold duration, total seconds, prior trunk and hip-flexor work, symptoms, and recovery.' END
      ||' This is exercise scoring, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (tuck_variant,'tuck-arms-forward',34,32,40),
    (one_leg_variant,'one-leg-extended-arms-forward-side-specific',42,44,40),
    (straight_forward_variant,'straight-leg-arms-forward',40,54,60),
    (overhead_variant,'straight-leg-arms-overhead',48,66,60),
    (dumbbell_variant,'straight-leg-fixed-overhead-dumbbell',58,74,80),
    (medicine_ball_variant,'straight-leg-fixed-overhead-medicine-ball',54,70,80)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_score_v1 score SET
    technical_complexity=CASE score.exercise_id
      WHEN 458 THEN 58 WHEN 1172 THEN 54 ELSE 40 END,
    absolute_load_demand=CASE score.exercise_id
      WHEN 458 THEN 74 WHEN 1172 THEN 70 ELSE 54 END,
    coordination_demand=CASE score.exercise_id
      WHEN 458 THEN 56 WHEN 1172 THEN 52 ELSE 38 END,
    impact=1,
    supervision_demand=CASE score.exercise_id
      WHEN 458 THEN 52 WHEN 1172 THEN 46 ELSE 30 END,
    base_overall_difficulty=greatest(
      CASE score.exercise_id WHEN 458 THEN 58 WHEN 1172 THEN 54 ELSE 40 END,
      CASE score.exercise_id WHEN 458 THEN 74 WHEN 1172 THEN 70 ELSE 54 END),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exactVariantRequired',TRUE,'staticLoadedPositionRequired',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=68,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact variant and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,is_published=FALSE,why_publish_ready=FALSE,
    archived=id<>13,
    description=CASE WHEN id=13 THEN
      'Static supine hollow-body isometric. Select an exact tuck, one-leg, straight-leg, overhead, or fixed-position loaded variant; hold the declared shape and levers while breathing, without rocking or limb motion.'
      ELSE 'Archived source representation mapped to the exact canonical Hollow Body Hold family. It is not independently selectable.' END,
    instructions=CASE WHEN id=13 THEN
      'Declare rib-pelvis and lumbar-floor relationship, shoulder-blade height, arm and leg levers, side, implement and mass if loaded, fixed angle, entry, hold, rest, sets, exit, and stop signal. End at the first position, breathing, grip, symptom, or static-boundary change.'
      ELSE 'Use the canonical Hollow Body Hold card and select an exact reviewed static variant; do not prescribe this archived source representation.' END,
    default_sets=CASE WHEN id=13 THEN 2 ELSE default_sets END,
    default_reps=CASE WHEN id=13 THEN NULL ELSE default_reps END,
    default_work_seconds=CASE WHEN id=13 THEN 15 ELSE default_work_seconds END,
    default_rest_seconds=CASE WHEN id=13 THEN 45 ELSE default_rest_seconds END,
    est_seconds_per_set=CASE WHEN id=13 THEN 35 ELSE est_seconds_per_set END,
    card_summary=CASE WHEN id=13 THEN
      'Static supine hollow shape; exact levers, side, load, breathing, quality-terminated hold, and controlled exit are mandatory.'
      ELSE 'Archived identity lineage; select the exact canonical Hollow Body Hold variant.' END,
    coach_language=CASE WHEN id=13 THEN
      'Verify exact variant, side, rib-pelvis and lumbar-floor relationship, head and scapulae, arm and leg levers, load and grip, breathing, elapsed time, first quality break, symptoms, and controlled exit. Stop before a rock, kick, pullover, lower, exchange, breath lock, or unsafe loaded set-down.'
      ELSE 'Do not prescribe this archived source representation; select and validate an exact canonical static hold variant.' END,
    athlete_language=CASE WHEN id=13 THEN
      'Set the exact shape, freeze your arms and legs, breathe, and stop at the first change. Set any weight down safely before relaxing.'
      ELSE 'Ask the coach for the exact Hollow Body Hold variant.' END,
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_static_supine_variant_required_never_silently_change_to_rock_kick_roll_lower_pullover_exchange_dead_bug_or_l_sit',
      'loadRule','record_arm_leg_segment_levers_and_exact_implement_mass_grip_fixed_angle_pickup_and_set_down',
      'fatigueRule','count_valid_failed_and_early_terminated_seconds_with_all_hollow_leg_raise_dead_bug_l_sit_gymnastics_trunk_hip_flexor_overhead_and_grip_work',
      'substitutionRule','revalidate_identity_shape_levers_side_load_breathing_dose_fatigue_duration_logistics_exit_and_rendering',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ANY(source_ids);

  UPDATE coaching.exercise_safety_profile SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'legacySources',3,'activeWorkingSpecifications',6,
        'identityQuarantinedSources',source_ids,'duplicateDefinitionsConsolidated',2,
        'dynamicActionsRemainDistinct',8,
        'invalidProneCprAndRowingCitationsRemoved',TRUE),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('brace')),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesTissuesJointsActionsPlanesAndLaterality',TRUE,
        'oneLegSideSpecific',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,
        'cumulativeHollowLoadedTrunkHipFlexorOverheadAndGripSeconds',TRUE,
        'validFailedAndEarlyTerminatedExposure',TRUE,
        'sameSessionShapeAndTrunkWorkRequired',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'surfaceSpacePopulationSupineEntryExitLoadedHandlingAndSupervision',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',12,
        'durationScalingDoseRestStationAndSubstitution',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachSupport',TRUE,
        'shapeLeversSideLoadBreathingStaticBoundaryQualityTerminationAndExit',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'invalidPriorCitationsRemoved',TRUE,
        'exactProfessionalAndAdjacentEvidenceLimitsExplicit',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',12,'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',12,'approved',0),
      'alternates',jsonb_build_object(
        'passed',TRUE,'assessments',32,'sourceIdentityQuarantines',3),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,
        'cumulativeFatigueBudgets',TRUE,'duration',TRUE,
        'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,
        'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object(
        'passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','A qualified human must watch every candidate in full and verify exact static identity, shape, arm and leg levers, side, load, entry, breathing, hold, quality termination, exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, and current playback.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject every progression, regression, and substitution proposal.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores are not athlete proficiency.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','A qualified reviewer and separate approver must complete content review before publication. All three legacy sources remain identity quarantines and loaded variants require exact fixed-position review.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids) AND definition_id=canonical_id
          AND status='archived'
          AND requirements_json->>'representation'='identity_quarantine')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
          AND status='review' AND requirements_json->>'selectable'='true'
          AND difficulty_json->>'technicalMeaning'='exercise_complexity'
          AND difficulty_json->>'loadMeaning'='physical_difficulty'
          AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
          AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0)<>6
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(duplicate_definition_ids) AND status='archived')<>2 THEN
    RAISE EXCEPTION '% found invalid consolidation, source quarantine, or working specifications',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>12
    OR (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=canonical_id AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_id AND reviewed_card_version=2
          AND video_id=ANY(current_video_ids) AND link_status='healthy'
          AND review_status='candidate' AND embedding_allowed
          AND captions_available IS NULL AND exact_variant_match IS NULL
          AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=canonical_id AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>32 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>12
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>12
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_id
          AND resolved_definition_id=ANY(duplicate_definition_ids)
          AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_id
          AND resolved_definition_id=ANY(neighbor_definition_ids)
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>8 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity decisions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      WHERE r.from_variant_id=ANY(active_variant_ids)
        AND r.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(r.dimensions) dimension
          WHERE dimension<>ALL(ARRAY[
            'load','leverage','range','speed','stability','complexity',
            'impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND (skill_level IS NOT NULL OR age_min IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (coalesce(provenance_json->'researchSources','[]'::JSONB)::TEXT LIKE '%32707142%'
          OR coalesce(provenance_json->'researchSources','[]'::JSONB)::TEXT LIKE '%19620925%'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_id OR resolved_definition_id=canonical_id)
        AND (coalesce(evidence_json->'researchSources','[]'::JSONB)::TEXT LIKE '%32707142%'
          OR coalesce(evidence_json->'researchSources','[]'::JSONB)::TEXT LIKE '%19620925%'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (source_url LIKE '%32707142%' OR source_url LIKE '%19620925%'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (review_status='approved' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id
        AND (status<>'quarantined' OR human_review_required<>TRUE
          OR jsonb_array_length(blocking_issues_json)<>4)) THEN
    RAISE EXCEPTION '% retained invalid evidence or fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
