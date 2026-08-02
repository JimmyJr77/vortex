-- Replace the ambiguous Cartwheel hand-placement baseline with exact marked-line
-- working specifications. Full unmarked Cartwheel performance remains in the
-- skill library; partial returns, panel-mat step-overs, finish-only drills,
-- hurdle entries, round-offs, one-arm/aerial/beam tasks, and other action or
-- support changes remain separate definitions or explicit review queues. All
-- evidence, media, graph, calibration, content, and publication decisions stay
-- review-only. No athlete proficiency or skill-library level is created here.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '478_coaching_cartwheel_hand_placement_line_drill_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.83';
  canonical_definition CONSTANT UUID := '847bebc6-1eb0-4a61-835d-56ea156b4fca';
  source_ids CONSTANT BIGINT[] := ARRAY[15];
  source_variant CONSTANT UUID := 'b6c55d93-4ad8-4be1-aa08-2d31978dac0b';
  standing_variant CONSTANT UUID := 'db4013cd-9047-498b-be80-48e89e1c285f';
  half_kneeling_variant CONSTANT UUID := 'ce85fdb7-ca80-49b6-9408-48d9cb879ebd';
  wall_assisted_variant CONSTANT UUID := '77548a95-23b7-4dcb-bd4f-75239739ca8f';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    standing_variant,half_kneeling_variant,wall_assisted_variant];
  step_over_definition CONSTANT UUID := '4d7b5337-24a5-43d4-8e8f-ebabd07d1a8b';
  finish_lunge_definition CONSTANT UUID := '18c670ef-ce08-443e-a6d8-541413d7853d';
  power_hurdle_definition CONSTANT UUID := '807c7a91-e022-4631-886d-b4d9a04ee091';
  roundoff_definition CONSTANT UUID := '60f5b21a-991c-4ce8-9068-3c42b2043021';
  free_handstand_definition CONSTANT UUID := '74ff4c17-2a19-4ae4-8f0b-320eac87c3f3';
  wall_handstand_definition CONSTANT UUID := '8f4d89bd-8c34-45b0-bc79-12b7f0d29b9f';
  donkey_kick_definition CONSTANT UUID := '4f36930b-a3db-429d-9c65-21dab2760527';
  neighbor_definition_ids CONSTANT UUID[] := ARRAY[
    step_over_definition,finish_lunge_definition,power_hurdle_definition,
    roundoff_definition,free_handstand_definition,wall_handstand_definition,
    donkey_kick_definition];
  video_ids CONSTANT TEXT[] := ARRAY[
    'J4DISL56-kI','tc6EYwsUaws','kdPlscoyYO8','dFkTY-ZOSpU','CZb-afEMaIc'];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=15 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(neighbor_definition_ids) AND status<>'archived')<>7 THEN
    RAISE EXCEPTION '% prerequisite Cartwheel line-drill state is missing or drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
          OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=15
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
      OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 source SET
    provenance_json=(coalesce(source.provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','identity_quarantine',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','legacy text permits an undefined early stop and does not fix lead side hand orientation marker geometry turnover wall or spotter contact terminal foot order or repetition completion',
        'exactWorkingSpecificationRequired',TRUE,
        'skillLibraryBoundary','full unmarked cartwheel performance remains a skill card and is not an exercise proficiency label',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=15;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-15',
    display_name='Cartwheel Hand-Placement Line Drill Identity Quarantine — Source 15',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',15,
      'archiveReason','source_does_not_fix_lead_side_hand_orientation_markers_support_contact_turnover_terminal_foot_order_or_repetition_boundary',
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,b.definition_id,'distinct_exercises',b.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',b.boundary_key,
      'baseContract','marked_line_cartwheel_drill_with_declared_lead_side_t_shape_hand_marks_sequential_hand_hand_foot_foot_contacts_and_exact_terminal_lunge',
      'neighborContract',b.neighbor_contract,
      'researchSources',jsonb_build_array(
        'https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_12_cartwheel.html',
        'https://pubmed.ncbi.nlm.nih.gov/29343188/'),
      'identityOnlyNeighborStillRequiresItsOwnAudit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (step_over_definition,'marked_line_contacts_vs_panel_mat_or_obstacle_step_over',
      'The step-over card uses a low obstacle or panel mat to change leg path, support height, clearance, and landing; line markers alone do not create that task.','panel_mat_or_obstacle_step_over_with_declared_height_and_contacts'),
    (finish_lunge_definition,'full_marked_contact_cycle_vs_terminal_finish_only',
      'Finish Lunge isolates or emphasizes the terminal step-down and freeze; the line drill scores the complete declared hand-hand-foot-foot sequence.','terminal_cartwheel_step_down_and_lunge_freeze'),
    (power_hurdle_definition,'static_or_step_entry_vs_power_hurdle_entry',
      'Power Hurdle scores a dynamic hurdle, speed, front-foot placement, arm path, and arrival before turnover; the line drill has a declared stationary or half-kneeling start.','dynamic_power_hurdle_to_cartwheel_or_roundoff_entry'),
    (roundoff_definition,'sequential_foot_finish_vs_feet_together_snapdown',
      'The Cartwheel line drill lands first foot then second into a lunge; Round-Off brings the feet together through a snap-down action.','roundoff_feet_together_snapdown_shape_drill'),
    (free_handstand_definition,'four_contact_rotation_vs_static_inverted_hold',
      'Freestanding Handstand retains fixed hands and static unsupported balance; the Cartwheel drill travels through sequential hand and foot contacts.','static_no_external_contact_inverted_hand_support'),
    (wall_handstand_definition,'wall_assisted_turnover_vs_static_wall_hold',
      'The wall-assisted Cartwheel drill uses temporary foot contact during a rotational repetition; Wall Handstand retains declared foot contact for timed static support.','static_wall_supported_inverted_hand_support'),
    (donkey_kick_definition,'alternating_hand_hand_foot_foot_sequence_vs_bilateral_foot_hop',
      'Donkey Kick or Bunny Hop uses a bilateral hand base and two-foot hop pattern without the declared cartwheel lead-side sequence and terminal lunge.','bilateral_hand_support_and_foot_hop_cycle')
  ) b(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    slug='cartwheel-hand-placement-line-drill',
    canonical_name='Cartwheel Hand-Placement Line Drill',
    display_name='Cartwheel Hand-Placement Line Drill',
    aliases=ARRAY[
      'Cartwheel Hand Placement Line Drill','Cartwheel Line-Marker Drill',
      'Cartwheel Hand-and-Foot Placement Line Drill']::TEXT[],
    description='A marked-line cartwheel drill with a declared lead side, start, T-shape candidate hand orientation, first-hand and second-hand marks, sequential first-foot and second-foot marks, exact support or wall contact, complete turnover, terminal lunge, and quality stop. A partial hand-placement return or full unmarked Cartwheel is not this exercise.',
    family_key='marked_line_cartwheel_contact_sequence_drill',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=88,scoring_confidence=60,media_confidence=48,
    movement_patterns=ARRAY['invert','rotate','push','brace','locomote']::TEXT[],
    body_regions=ARRAY['full_body','hand','wrist','elbow','shoulder','scapula','neck','spine','rib_cage','core','pelvis','hip','knee','ankle','foot']::TEXT[],
    required_equipment=ARRAY['line_tape']::TEXT[],
    optional_equipment=ARRAY['mat','wall','partner','timer']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('wrist_flexors','finger_flexors','triceps_brachii','anterior_deltoid','serratus_anterior','upper_trapezius','obliques','gluteus_medius','hip_adductors_and_abductors'),
      'secondaryMuscles',jsonb_build_array('wrist_extensors','rotator_cuff','pectoralis_major','latissimus_dorsi','rectus_abdominis','spinal_stabilizers','gluteus_maximus','quadriceps','hamstrings','calf_complex'),
      'stabilizers',jsonb_build_array('intrinsic_hand_muscles','forearm_pronators_supinators','scapular_stabilizers','deep_cervical_and_trunk_stabilizers','hip_knee_and_ankle_stabilizers'),
      'connectiveTissues',jsonb_build_array('palmar_and_wrist_weight_bearing_tissues','elbow_and_shoulder_supporting_tissues','spinal_and_pelvic_connective_tissues','hip_knee_ankle_and_foot_landing_tissues'),
      'joints',jsonb_build_array('hand_and_fingers','radiocarpal_and_midcarpal_joints','elbow','glenohumeral_joint','scapulothoracic_articulation','cervical_thoracic_and_lumbar_spine','hip','knee','ankle'),
      'jointActions',jsonb_build_array('wrist_extension_weight_bearing','elbow_extension_support','shoulder_flexion_and_abduction','scapular_upward_rotation_and_elevation','trunk_lateral_rotation_and_anti_collapse','hip_abduction_and_flexion_extension','knee_extension_and_landing_flexion','ankle_plantar_flexion_and_landing_control'),
      'jointActionPhases',jsonb_build_object(
        'entry',jsonb_build_array('declared_lead_side_lunge_or_half_kneeling_start','reach_and_quarter_turn_toward_first_hand_mark'),
        'handSupport',jsonb_build_array('first_hand_then_second_hand_on_declared_t_shape_marks','sequential_upper_extremity_loading','active_shoulder_support'),
        'turnover',jsonb_build_array('split_leg_passage_through_declared_inverted_path','temporary_wall_foot_contact_only_for_wall_variant'),
        'stepDown',jsonb_build_array('first_foot_then_second_foot_on_declared_marks','terminal_opposite_lunge_and_controlled_stand')),
      'planes',jsonb_build_array('frontal_or_sagittal_axis_side_rotation_primary','sagittal_lunge_and_step_down','transverse_quarter_turn_and_hand_orientation'),
      'laterality',jsonb_build_object('baseline','side_specific_lead_hand_and_lead_leg','leftAndRightLoggedSeparately',TRUE,'dominantSideNotAssumed',TRUE,'oneArmVersionRequiresSeparateSkillOrExerciseDefinition',TRUE),
      'evidenceLimit','Research describes full Cartwheel mechanics, hand-position loading, practice order, marker guidance, and foundation tumbling impacts. It does not validate every drill variant, universal T-shape use, readiness rule, dose, recovery interval, injury threshold, transfer outcome, or numeric difficulty.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_nonslip_sprung_floor_or_locked_mat_exactly_declared',
      'markerContract',jsonb_build_array('lead_foot_start','first_hand','second_hand','first_foot','second_foot_and_finish'),
      'clearance',jsonb_build_array('full_leg_sweep_and_body_rotation_lane','no_ceiling_fixture_or_cross_traffic','no_hard_objects_in_hand_or_foot_contact_zone','coach_view_without_blocking_exit'),
      'station','one_marked_cartwheel_lane_per_athlete_with_side_and_direction_signage',
      'equipmentSafety',jsonb_build_array('tape_or_markers_flat_nonlifting_and_high_contrast','mat_locked_and_nonshifting','wall_clean_stable_and_clear_only_for_wall_variant','timer_or camera_outside_lane'),
      'changeRule','Lead side, start, hand orientation, marker geometry, surface, wall or spotter contact, turnover, finish, dose, rest, and stop signal must be declared and revalidated.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_sequential_hand_support_side_rotation_and_two_controlled_foot_contacts_and_follow_the_declared_lane_without_symptoms',
      'individualizationRequired',TRUE,
      'readinessInputs',jsonb_build_array('current hand wrist elbow shoulder neck spine hip knee ankle and foot symptoms','ability to bear weight through each hand without collapse','ability to follow lead-side and five-marker sequence','safe leg clearance and terminal lunge','current fear attention and communication','same-session hand-support tumbling and landing exposure'),
      'notAutomaticClearance',jsonb_build_array('age','body size','sport','experience label','skill-library level','prior unverified cartwheel claim'),
      'clinicalBoundary','The card does not diagnose, treat, or clear injury. Use qualified medical or safeguarding pathways when indicated.'),
    athlete_support_json=jsonb_build_object(
      'shortInstruction','Use your assigned side and marks: lead foot, hand, hand, foot, foot. Push the floor, finish the opposite lunge, and stop at the first miss or symptom.',
      'before',jsonb_build_array('confirm lead side start and finish','point to all five marks in order','confirm whether wall contact is required or prohibited','rehearse stop and exit'),
      'during',jsonb_build_array('reach long from the declared start','first hand then second hand on their marks','push through straight supported arms','first foot then second foot on their marks','finish controlled and wait for feedback'),
      'selfReport',jsonb_build_array('pain numbness tingling dizziness or fear','missed mark or changed hand orientation','elbow or shoulder collapse','wall or spotter contact outside the variant','wrong foot order extra step or uncontrolled finish'),
      'after',jsonb_build_array('record side valid and invalid repetitions','record first fault and symptoms','report whether the last repetition matched the first')),
    coach_support_json=jsonb_build_object(
      'preflight',jsonb_build_array('verify exact variant side hand orientation and marker spacing','verify surface wall mat and full sweep lane','confirm hand-support tolerance and terminal lunge','declare spotter role without silently changing assistance'),
      'observationOrder',jsonb_build_array('start and lead side','first hand and second hand order and orientation','elbow shoulder and head clearance','split-leg turnover and wall contact if assigned','first foot second foot finish and extra steps','symptoms breathing and response'),
      'faultCorrections',jsonb_build_object('wrong_side_or_order','stop reset and point through the five marks','hand_miss_or_orientation_change','end repetition and reduce range or select the half-kneeling variant','elbow_or_shoulder_collapse','end repetition and regress hand-support demand','leg_or_lane_clearance','stop and rebuild station','wrong_foot_order_or_extra_step','end repetition and use a separately reviewed terminal drill','symptom_or_fear','stop and reassess without forcing another attempt'),
      'escalation',jsonb_build_array('stop immediately for symptoms loss of control or unsafe lane','secure the station and determine immediate support needs','record exact side variant contact fault and context','follow facility emergency safeguarding and clinical referral policy'),
      'reviewBoundary','Coaching observations do not approve a media candidate, relationship, calibration, card, or publication.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_variant_profile_card_and_research_version','objective_and_session_phase','lead_side_start_hand_orientation_marker_geometry_surface_wall_and_spotter_policy','sets_repetitions_per_side_rest_duration_and_station_time','same_session_hand_support_cartwheel_roundoff_handstand_tumbling_and_landing_exposure','symptoms_fear_recovery_population_environment_and_supervision'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_card_and_research_version','lead_side_start_hand_orientation_markers_surface_wall_contact_and_spotter_role','planned_and_completed_valid_invalid_and_incident_repetitions_per_side','hand_and_foot_marks_first_fault_extra_steps_symptoms_rest_duration_and_substitution','linked_skill_targets_without_copying_skill_level','athlete_and_coach_rendering_versions'),
      'skillLibraryBoundary',jsonb_build_object('exerciseCardHasNoSkillLevel',TRUE,'fullUnmarkedCartwheelPerformanceRemainsSkillLibraryContent',TRUE,'relatedSkillSlugs',jsonb_build_array('usag-tt-cartwheel','usag-tt-step-cartwheel','usag-tt-cartwheel-step-in','wag-comp-forward-cartwheel-quarter-in','wag-comp-cartwheel-step-in')),
      'incidentPath',jsonb_build_array('call_stop_and_clear_lane','assess_immediate_help_needs_without_in_product_diagnosis','record_side_variant_contact_fault_symptom_and_context','follow_facility_emergency_safeguarding_or_referral_policy','quarantine_uncertain_identity_instruction_or_media'),
      'changeImpact','Any side, start, hand orientation, marker, surface, wall, spotter, turnover, finish, dose, fatigue, recovery, population, station, or media change invalidates cached selection, duration, logistics, rendering, and approval assumptions.',
      'publication',jsonb_build_object('humanMediaGraphCalibrationContentAndSeparateApprovalRequired',TRUE)),
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'cartwheelLineDrillAuditHardeningMigration',migration_key,
        'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
        'legacySourcesQuarantined',source_ids,
        'activeWorkingSpecifications',jsonb_build_array(
          'standing-t-shape-marked-line-four-contact',
          'half-kneeling-t-shape-marked-line-four-contact',
          'wall-assisted-t-shape-marked-line-four-contact'),
        'identityDecision','marked_line_cartwheel_drill_is_an_exercise_card_linked_to_but_not_a_duplicate_of_full_unmarked_skill_library_cartwheel_performance',
        'handOrientationEvidence','T-shape is a research-informed candidate for the exact working variants and is not asserted universally across disciplines or individuals.',
        'mediaState','five_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'approvalsCreated',FALSE,'publicationQuarantined',TRUE,
        'humanReviewRequired',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    updated_at=now()
  WHERE id=canonical_definition;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',v.speed,'decisionDemand',v.decision,
      'workCapacityDemand',v.work_capacity,'impact',v.impact,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',v.inversion,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',v.spotting,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'selectable',TRUE,'representation','exact_working_specification',
      'leadSide','declared_left_or_right_and_logged_separately',
      'startPosition',v.start_position,'supportInterface',v.support_interface,
      'handOrientation','declared_t_shape_candidate_not_universal',
      'markerSequence',jsonb_build_array('lead_foot_start','first_hand','second_hand','first_foot','second_foot_finish'),
      'handContract','first_hand_then_second_hand_on_fixed_declared_marks_with_no_slide_or_regrasp',
      'turnoverContract',v.turnover_contract,'wallContact',v.wall_contact,
      'spotterContract','direct_observation_required; physical guidance if used is declared and recorded and cannot be inferred as successful independent execution',
      'footContract','first_foot_then_second_foot_on_declared_marks_into_opposite_lunge',
      'repetitionBoundary','start passes exact setup; sequential hand-hand-foot-foot contacts complete; opposite lunge is controlled without extra step',
      'invalidatingEvents',jsonb_build_array('wrong side or contact order','hand or foot misses or slides from mark','hand orientation changes','elbow or shoulder collapses','wall contact changes from the assigned contract','head neck or trunk contact','wrong first foot or feet together','extra step fall or uncontrolled exit','symptom stop or coach rescue'),
      'equipmentRequired',v.equipment_required,
      'identityQuarantine',FALSE,'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_sequential_hand_support_and_two_foot_contacts',
      'supportLoad','bodyweight shifts from lead foot through first and second hands to first and second feet; exact left-right share is not assumed',
      'wallLoadShare','not_assumed_or_quantified',
      'gripDemand',v.grip,'spinalLoading',v.spinal_loading,
      'eccentricStress',v.eccentric,'landingContactsPerRep',2,
      'handContactsPerRep',2,'plannedImpactContacts',4,
      'impactClass','low_to_moderate_foundation_tumbling_candidate',
      'dominantContraction','dynamic_sequential_support_rotation_and_landing_control',
      'effectiveLoadDrivers',jsonb_build_array('body_mass_and_segment_distribution','entry height and speed','hand orientation and spacing','surface stiffness','wall or spotter assistance','split leg path','repetition count and side order','prior wrist shoulder trunk and landing fatigue'),
      'loadTracking',jsonb_build_array('exact variant side and surface','two hand and two foot contacts per completed repetition','failed and partial contacts','wall and spotter contacts','head neck or trunk contact','same session hand support tumbling and landing exposure')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',v.impact,'recoveryHours',v.recovery_hours,
      'recoveryWindow','candidate planning estimate only; typically 12 to 36 hours depending on novelty volume surface symptoms and adjacent tumbling hand support or landing work',
      'primaryFatigueSites',jsonb_build_array('hands and forearms','wrists','triceps and shoulders','trunk and pelvis','hip abductors and adductors','knees ankles and feet'),
      'earlyFatigueSignals',jsonb_build_array('late or misplaced first hand','hand orientation drift','elbow or shoulder softening','low or bent leg path','wrong first foot or extra step','lane drift','breath holding delayed response or symptom'),
      'downstreamConflicts',jsonb_build_array('priority cartwheel roundoff handstand or tumbling work','high volume wrist or hand support','impact jumping sprinting or landing work','symptomatic hand wrist elbow shoulder neck spine hip knee ankle or foot loading')),
    jsonb_build_object(
      'trainingStimuli',v.stimuli,
      'stimulusDose',jsonb_build_object('primary','quality_terminated_valid_repetitions_per_declared_side','countInvalidPartialAndAssistedRepetitionsAndEveryContactAsExposure',TRUE,'fatigueCeiling','low_for_learning_quality'),
      'weeklyExposure','Combine valid invalid partial and assisted repetitions plus every hand and foot contact with Cartwheel Round-Off Handstand Wall Walk Donkey Kick tumbling jumping and landing exposure.',
      'prerequisites',jsonb_build_array('symptom free sequential hand support and controlled foot contacts','lead side five marks and stop signal understood','clear marked lane stable exact surface and direct observation','sufficient range and control for the exact variant','current fatigue permits repeatable contact order and finish'),
      'completionCriteria',jsonb_build_array('exact side start hand orientation and marks','hand hand foot foot order without slide or extra contact','no identity changing action or unplanned assistance','continuous breathing and no symptoms','controlled opposite lunge and full record'),
      'sequenceRules',jsonb_build_array('use after wrist shoulder trunk hip and landing preparation','place before fatiguing tumbling upper body or impact work when learning quality is the objective','do not use as a race blind circuit or unplanned maximum','stop before contact order hand support line or finish deteriorates'),
      'pairingCompatibility',jsonb_build_array('low demand mobility after full recovery','noncompeting instruction or visualization','technical work without shared wrist shoulder inversion rotation or landing fatigue'),
      'interferenceRules',jsonb_build_array('do not pre fatigue hands wrists triceps shoulders trunk hips or landing tissues','do not pair with cross traffic or uncontrolled impact near lane','revalidate after any side marker support assistance surface action or dose change'),
      'selection',jsonb_build_object('phaseDefault','movement_intelligence','prepareAndAccessOnlyAtLowDose',TRUE,'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (standing_variant,'standing-t-shape-marked-line-four-contact','Standing T-Shape Marked-Line Cartwheel Drill',ARRAY['standing_lunge','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],64,58,58,68,72,70,82,38,50,36,30,64,20,68,72,42,70,48,72,68,52,84,24,
      'standing_lunge_with_lead_foot_on_start_mark','flat_floor_or_locked_mat_on_marked_line','complete_split_leg_turnover_without_pause','no_wall_contact_valid','line_tape_or_equivalent_markers',ARRAY['line_tape']::TEXT[],jsonb_build_array('marked contact sequencing','side-specific rotational coordination','sequential hand support','controlled terminal lunge')),
    (half_kneeling_variant,'half-kneeling-t-shape-marked-line-four-contact','Half-Kneeling T-Shape Marked-Line Cartwheel Drill',ARRAY['half_kneeling','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],56,50,52,62,66,66,76,34,42,30,24,58,18,62,68,38,68,44,66,62,46,78,18,
      'half_kneeling_with_front_foot_on_start_mark_and_rear_knee_on_locked_mat','flat_floor_or_locked_mat_on_marked_line','complete_turnover_from_reduced_entry_height_without_pause','no_wall_contact_valid','line_tape_and_mat',ARRAY['line_tape','mat']::TEXT[],jsonb_build_array('reduced-entry marked sequencing','side-specific rotational coordination','sequential hand support','controlled terminal stand or lunge')),
    (wall_assisted_variant,'wall-assisted-t-shape-marked-line-four-contact','Wall-Assisted T-Shape Marked-Line Cartwheel Drill',ARRAY['wall_assisted','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],58,54,54,66,68,68,78,36,44,28,26,62,20,64,74,46,78,56,70,64,50,82,24,
      'standing_lunge_with_lead_foot_on_start_mark_facing_declared_wall_station','flat_floor_or_locked_mat_with_stable_wall_and_marked_line','complete_turnover_with_declared_temporary_foot_contact_at_side_handstand_then_step_down','declared_toe_or_forefoot_contact_with_stable_wall_only_during_mid_repetition','line_tape_wall_and_mat',ARRAY['line_tape','wall','mat']::TEXT[],jsonb_build_array('wall-referenced marked sequencing','side-specific rotational coordination','sequential hand support','controlled wall contact and step-down'))
  ) v(id,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,speed,decision,work_capacity,eccentric,joint_stress,spinal_loading,grip,inversion,fear,supervision,spotting,failure,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,start_position,support_interface,turnover_contract,wall_contact,marker_type,equipment_required,stimuli)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT gen_random_uuid(),v.id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Rehearse the exact lead side, five marks, hand orientation, support, contact order, and terminal lunge at minimal exposure before the primary task.'
    ELSE
      'Practice repeatable marked-line Cartwheel contact order, sequential hand support, side rotation, and controlled finish while attention and tissues are fresh.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_suitability ELSE v.mi_suitability END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 92 END,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'prepare_and_access' THEN 'marked_sequence_rehearsal_and_readiness_observation' ELSE 'marked_cartwheel_contact_sequence_learning_quality' END,
      'variant',v.variant_key,'validOnlyWhenExactVariantPasses',TRUE,
      'leadSidesMustBePlannedAndLogged',TRUE,'fatigueCeiling','low',
      'notConditioningOrMaximumTesting',TRUE,'doesNotRankAthletes',TRUE),
    jsonb_build_object(
      'sets',CASE p.phase_key WHEN 'prepare_and_access' THEN 1 ELSE v.mi_sets END,
      'repetitionsPerDeclaredSide',CASE p.phase_key WHEN 'prepare_and_access' THEN 2 ELSE v.mi_reps END,
      'restSecondsMin',CASE p.phase_key WHEN 'prepare_and_access' THEN 30 ELSE v.mi_rest END,
      'restSecondsMax',CASE p.phase_key WHEN 'prepare_and_access' THEN 60 ELSE v.mi_rest+45 END,
      'validContactSequence','lead foot hand hand foot foot terminal lunge',
      'countInvalidPartialAssistedAndIncidentRepetitionsAsExposure',TRUE,
      'countTwoHandAndTwoFootContactsPerCompletedRepetition',TRUE,
      'effortCap','stop_before_contact_order_support_line_or_finish_deteriorates',
      'doseAuthority','candidate_profile_pending_human_review'),
    'Exact side, start, T-shape candidate hand marks, sequential hand-hand-foot-foot contacts, assigned wall policy, controlled opposite lunge, breathing, and no symptoms pass; the final valid repetition resembles the first.',
    ARRAY[
      'Sharp or increasing hand, wrist, elbow, shoulder, neck, spine, hip, knee, ankle, or foot pain.',
      'Numbness, tingling, weakness, vision change, dizziness, nausea, faintness, panic, pressure symptoms, or unusual exertional symptoms.',
      'The floor, mat, wall, tape, marker, timer, or surrounding lane shifts or becomes unsafe.',
      'The athlete starts on the wrong side or cannot state the five-contact sequence.',
      'A hand or foot misses, slides from, or changes the assigned mark or orientation.',
      'An elbow or shoulder collapses or head, neck, trunk, knee, or other unplanned body part contacts support.',
      'Wall or spotter contact occurs outside the exact assigned contract.',
      'The leg path enters another lane, obstacle, wall, coach, or athlete clearance zone.',
      'Foot order changes, feet land together, an extra step occurs, or the terminal lunge is uncontrolled.',
      'Breathing stops or the athlete cannot answer the stop cue.',
      'The coach cannot directly observe every contact or cross-traffic enters the lane.',
      'The planned repetition, hand-contact, foot-contact, tumbling, or landing budget is reached.'
    ]::TEXT[],
    'Verify exact card, variant, side, start, hand orientation, five marks, surface, wall and spotter contract, clearance, prior hand-support and landing fatigue, dose, and stop signal. Observe and record every contact. Revalidate duration, logistics, fatigue budgets, substitutions, persistence, linked skill targets, and both renderings after any change.',
    'Use your assigned side and five marks: lead foot, hand, hand, foot, foot. Push the floor, finish your opposite lunge, and stop at the first miss or symptom.',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Clearer side, sequence, marker, support, and stop readiness with minimal fatigue.'
    ELSE
      'More repeatable line, contact order, sequential hand support, leg path, and controlled terminal lunge under low fatigue.' END,
    v.equipment_required,
    jsonb_build_object(
      'stationType',v.station_type,'athletesPerStation',1,
      'setupSeconds',v.setup_seconds,'attemptSeconds',v.attempt_seconds,
      'resetSeconds',20,'transitionSeconds',15,
      'requiresDirectObservation',TRUE,'requiresFullLegSweepLane',TRUE,
      'markerInspectionBeforeEverySet',TRUE,
      'sharedLanePolicy','one athlete moves only after the previous athlete and coach clear the full rotation and finish zone',
      'equipmentChangeInvalidatesCachedLogistics',TRUE),
    v.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup + sum(each observed attempt + lane clear and reset + inter repetition rest) + set rest + transitions',
      'estimateSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration ELSE v.mi_duration END,
      'lowerBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration-60 ELSE v.mi_duration-120 END,
      'upperBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration+120 ELSE v.mi_duration+240 END,
      'includeInvalidPartialAssistedAndIncidentAttempts',TRUE,
      'includeEveryLaneResetAndMarkerRepair',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce repetitions','increase rest','reduce entry height through exact half-kneeling variant','add exact wall assistance through reviewed graph','change drill only through reviewed graph'),
      'progressionOrder',jsonb_build_array('improve contact repeatability','add the opposite side only when intentionally planned','increase repetitions within the reviewed profile','move to exact standing variant','transfer to a skill card only through coach review'),
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unplanned spotter force','larger uncontrolled leg swing','speed after marker misses','repetitions after support collapse'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('variant','side order','sets','repetitions per side','rest','surface and markers','wall and spotter contract','supervision'),
      'actual',jsonb_build_array('valid invalid partial assisted and incident repetitions','hand and foot contacts','first fault','mark misses or slides','wall or spotter contacts','extra steps or falls','symptoms','duration'),
      'cumulativeBudgets',jsonb_build_array('hand contacts','foot contacts','cartwheel and roundoff repetitions','inverted support exposures','unplanned body contacts','same session tumbling jumping and landing exposure'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear uncertainty the first missed mark and whether the finish stayed controlled.',
      'coachPrompt','Record exact variant side contact sequence first fault assistance symptoms cumulative exposure substitution and recovery note.',
      'supportPrompt','Quarantine identity environment skill-link media instruction dose rendering or persistence mismatches; never convert them into approval.',
      'incidentPrompt','Stop, clear and secure the lane, assess immediate help needs, document the exact event, and follow facility policy.')
  FROM (VALUES
    (standing_variant,'standing_marked_line',ARRAY['line_tape']::TEXT[],
      'clear_marked_floor_cartwheel_lane',35,4,94,3,3,60,600,240,
      ARRAY[half_kneeling_variant,wall_assisted_variant]::UUID[]),
    (half_kneeling_variant,'half_kneeling_marked_line',ARRAY['line_tape','mat']::TEXT[],
      'clear_marked_half_kneeling_cartwheel_lane',40,5,92,3,3,60,630,270,
      ARRAY[standing_variant,wall_assisted_variant]::UUID[]),
    (wall_assisted_variant,'wall_assisted_marked_line',ARRAY['line_tape','wall','mat']::TEXT[],
      'clear_marked_wall_cartwheel_lane',55,7,90,3,3,75,720,300,
      ARRAY[half_kneeling_variant,standing_variant]::UUID[])
  ) v(id,variant_key,equipment_required,station_type,setup_seconds,attempt_seconds,mi_suitability,mi_sets,mi_reps,mi_rest,mi_duration,prepare_duration,substitution_ids)
  CROSS JOIN (VALUES
    ('prepare-and-access-rehearsal','prepare_and_access','rehearsal'),
    ('movement-intelligence-quality','movement_intelligence','primary')
  ) p(profile_key,phase_key,role)
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
