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
      'skillLibraryBoundary',jsonb_build_object('exerciseCardDoesNotClassifyAthletes',TRUE,'fullUnmarkedCartwheelPerformanceRemainsSkillLibraryContent',TRUE,'relatedSkillSlugs',jsonb_build_array('usag-tt-cartwheel','usag-tt-step-cartwheel','usag-tt-cartwheel-step-in','wag-comp-forward-cartwheel-quarter-in','wag-comp-cartwheel-step-in')),
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
    (standing_variant,'standing-t-shape-marked-line-four-contact','Standing T-Shape Marked-Line Cartwheel Drill',ARRAY['standing_lunge','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],64,58,58,68,72,70,82,38,50,36,36,30,64,20,68,72,42,70,48,72,68,52,84,24,
      'standing_lunge_with_lead_foot_on_start_mark','flat_floor_or_locked_mat_on_marked_line','complete_split_leg_turnover_without_pause','no_wall_contact_valid','line_tape_or_equivalent_markers',ARRAY['line_tape']::TEXT[],jsonb_build_array('marked contact sequencing','side-specific rotational coordination','sequential hand support','controlled terminal lunge')),
    (half_kneeling_variant,'half-kneeling-t-shape-marked-line-four-contact','Half-Kneeling T-Shape Marked-Line Cartwheel Drill',ARRAY['half_kneeling','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],56,50,52,62,66,66,76,34,42,30,30,24,58,18,62,68,38,68,44,66,62,46,78,18,
      'half_kneeling_with_front_foot_on_start_mark_and_rear_knee_on_locked_mat','flat_floor_or_locked_mat_on_marked_line','complete_turnover_from_reduced_entry_height_without_pause','no_wall_contact_valid','line_tape_and_mat',ARRAY['line_tape','mat']::TEXT[],jsonb_build_array('reduced-entry marked sequencing','side-specific rotational coordination','sequential hand support','controlled terminal stand or lunge')),
    (wall_assisted_variant,'wall-assisted-t-shape-marked-line-four-contact','Wall-Assisted T-Shape Marked-Line Cartwheel Drill',ARRAY['wall_assisted','marked_line','t_shape_hands','four_contact','side_specific']::TEXT[],58,54,54,66,68,68,78,36,44,28,28,26,62,20,64,74,46,78,56,70,64,50,82,24,
      'standing_lunge_with_lead_foot_on_start_mark_facing_declared_wall_station','flat_floor_or_locked_mat_with_stable_wall_and_marked_line','complete_turnover_with_declared_temporary_foot_contact_at_side_handstand_then_step_down','declared_toe_or_forefoot_contact_with_stable_wall_only_during_mid_repetition','line_tape_wall_and_mat',ARRAY['line_tape','wall','mat']::TEXT[],jsonb_build_array('wall-referenced marked sequencing','side-specific rotational coordination','sequential hand support','controlled wall contact and step-down'))
  ) v(id,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,speed,decision,work_capacity,impact,eccentric,joint_stress,spinal_loading,grip,inversion,fear,supervision,spotting,failure,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,start_position,support_interface,turnover_contract,wall_contact,marker_type,equipment_required,stimuli)
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
    CASE p.phase_key WHEN 'prepare_and_access' THEN v.mi_suitability-4 ELSE v.mi_suitability END,
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
    ('prepare-and-access-rehearsal','prepare_and_access','secondary'),
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,s.section_key,s.source_url,s.source_title,
    s.publisher,s.source_kind,jsonb_build_array(
      jsonb_build_object('supported',s.supported_claim,'scope',s.scope),
      jsonb_build_object('limitation',s.limitation,
        'noUniversalIdentityTechniqueSafetyDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    s.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_12_cartwheel.html','Safe Gymnastics 4all — Floor 12: Cartwheel','Masaryk University Faculty of Sports Studies','professional_standard','A Cartwheel uses sequential hand and foot contacts, and marker drills may progress from a semicircle to a straight line.','academic_coaching_resource','The resource describes a full Cartwheel and selected drills, not this complete canonical card or every discipline-specific hand orientation.',82),
    ('taxonomy','https://resources.usasfmembers.net/wp-content/uploads/2020/09/02-PreSchool-FUNdamentals-Tumbling-PT14.pdf','Preschool FUNdamentals Tumbling — Cartwheel PT.14','U.S. All Star Federation','governing_body','The drill module identifies a lunge, sequential support, side-handstand passage, marker aids, panel-mat and wall or lane progressions.','cheer_governing_body_drill_module','A preschool cheer module is not a universal gymnastics identity, dose, readiness, or progression authority.',82),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/','Upper and lower limb impact loading during artistic gymnastics foundation floor tumbling skills','Sports Biomechanics','peer_reviewed_research','Foundation tumbling includes distinct upper- and lower-limb contacts whose loading varies by skill and sequence.','instrumented_foundation_tumbling_study','Measured full skills and sequences do not establish tissue tolerance or this drill dose for an individual.',90),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/29343188/','Technique selection in young female gymnasts: Elbow and wrist joint loading during the cartwheel and round-off','European Journal of Sport Science','peer_reviewed_research','Cartwheel and round-off hand positions changed vertical ground reaction force, elbow and wrist compression, elbow moment, and wrist angle in the tested gymnasts.','repeated_measures_young_female_gymnast_study','Seventeen young female gymnasts and successful full-skill trials do not make one hand position universally correct or safe.',91),
    ('difficulty','https://doi.org/10.1080/14763141.2021.1876755','The effect of changes in fundamental skill complexity on upper limb loading and biomechanical characteristics of performance in female gymnastics','Sports Biomechanics','peer_reviewed_research','Upper-limb mechanics varied with Cartwheel, Round-Off, Round-Off–Back Handspring complexity and hand position.','small_repeated_measures_skill_complexity_study','Ten female gymnasts and full-skill comparisons do not calibrate this library numeric score or athlete proficiency.',89),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/','Upper and lower limb impact loading during artistic gymnastics foundation floor tumbling skills','Sports Biomechanics','peer_reviewed_research','Hand and foot impacts are separate exposures and sequence complexity affects foundation tumbling loading.','instrumented_foundation_tumbling_study','The study does not establish safe weekly contacts, fatigue ceilings, recovery hours, or injury thresholds.',90),
    ('constraints','https://www.ijsp-online.com/abstract/view/41/255','When is manual guidance effective for the acquisition of complex skills in Gymnastics?','International Journal of Sport Psychology','peer_reviewed_research','Manual guidance effects differed by gymnastics task and influenced fear or self-efficacy measures in the tested methodical progressions.','small_cartwheel_and_somersault_learning_experiments','Twenty-six gymnasts and balance-beam transfer tasks do not prove that spotting is required, sufficient, or transferable to this floor drill.',82),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/12929780/','Alternating versus blocked practice in learning a cartwheel','Perceptual and Motor Skills','peer_reviewed_research','A study of left- and right-leading Cartwheel practice compared blocked and alternating orders across many trials.','adult_motor_learning_experiment','Thirty-two participants and 192 study trials do not establish a workout dose, side order, recovery interval, or youth prescription.',84),
    ('instructions','https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_12_cartwheel.html','Safe Gymnastics 4all — Floor 12: Cartwheel','Masaryk University Faculty of Sports Studies','professional_standard','The resource identifies sequential contacts, line spacing, common hand and leg faults, marker rhythmization, preparation, and spotting context.','academic_coaching_resource','Its instructions require qualified adaptation and do not approve this card wording or media.',82),
    ('safety_stop_rules','https://resources.usasfmembers.net/wp-content/uploads/2020/09/02-PreSchool-FUNdamentals-Tumbling-PT14.pdf','Preschool FUNdamentals Tumbling — Cartwheel PT.14','U.S. All Star Federation','governing_body','The module uses mats, markers, a clear line, progressive support, and full turnover rather than an undefined partial endpoint.','cheer_governing_body_drill_module','It does not provide clinical contraindications, universal spotting rules, or injury thresholds.',82),
    ('programming','https://www.ijsp-online.com/abstract/view/41/255','When is manual guidance effective for the acquisition of complex skills in Gymnastics?','International Journal of Sport Psychology','peer_reviewed_research','Methodical progressions and manual guidance should be task-specific rather than assumed effective across gymnastics skills.','small_learning_experiments','The study does not establish this profile order, session duration, or optimal progression.',82),
    ('athlete_support','https://doi.org/10.26858/cpjok.v18i1.524','Application of Floor Tape Media to Improve Psychomotor Ability: Cartwheel Movement Floor Exercise at Elementary School','Competitor: Jurnal Pendidikan Kepelatihan Olahraga','peer_reviewed_research','Floor tape was studied as visual guidance for direction, rotation, and spatial orientation during Cartwheel learning.','small_one_group_school_intervention','A 25-student one-group pretest-posttest design does not isolate the tape effect or validate this marker layout and cue set.',68),
    ('coach_support','https://www.ijsp-online.com/abstract/view/41/255','When is manual guidance effective for the acquisition of complex skills in Gymnastics?','International Journal of Sport Psychology','peer_reviewed_research','Guidance may change mechanics, fear, and self-efficacy and should be recorded as support, assistance, or assurance rather than assumed neutral.','small_learning_experiments','The findings do not validate one spotting method or authorize hands-on guidance beyond coach qualification.',82),
    ('accessibility','https://resources.usasfmembers.net/wp-content/uploads/2020/09/02-PreSchool-FUNdamentals-Tumbling-PT14.pdf','Preschool FUNdamentals Tumbling — Cartwheel PT.14','U.S. All Star Federation','governing_body','Markers, panel mats, wedges, and progressive starts can change task constraints while retaining a Cartwheel teaching objective.','cheer_governing_body_drill_module','Each equipment or support change still requires exact identity, environment, population, and coach review.',82),
    ('alternates','https://doi.org/10.1080/14763141.2021.1876755','The effect of changes in fundamental skill complexity on upper limb loading and biomechanical characteristics of performance in female gymnastics','Sports Biomechanics','peer_reviewed_research','Cartwheel, Round-Off, and connected Round-Off–Back Handspring tasks plus hand-position techniques have measurably different mechanics.','small_repeated_measures_skill_complexity_study','The study does not define every exercise-versus-skill boundary or prove universal progression order.',89),
    ('media','https://www.youtube.com/watch?v=J4DISL56-kI','Cartwheel 1-2-3-4 hand position to T','Lakes Area Gymnastics','expert_instruction','Current oEmbed metadata supplied a candidate title, channel, thumbnail, and iframe response.','candidate_media_metadata_only','Playback, exact card or variant, side, marks, support, contacts, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unverified.',60)
  ) s(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,evidence_quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT canonical_definition,NULL,2,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,
    m.channel,NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',m.source_query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current metadata on 2026-08-02. This does not establish full playback, exact card or variant, side, start, hand orientation, marks, support, wall or spotter contact, turnover, finish, captions, accessibility, safety, conflicts, cue quality, reviewer identity, or approval.'
  FROM (VALUES
    ('J4DISL56-kI','Cartwheel 1-2-3-4 hand position to T','Lakes Area Gymnastics','cartwheel four contact hand position T drill'),
    ('tc6EYwsUaws','Hand placement and exercises for cartwheels','TYG','cartwheel hand placement exercises'),
    ('kdPlscoyYO8','Cartwheel Wall Drills: Improve Body Position, Hand Placement & Control','Back Handspring Academy','cartwheel wall hand placement drill'),
    ('dFkTY-ZOSpU','Cartwheel Drills & Exercises | Floor | Gymnastics','Gymnastics Tools','cartwheel floor drills hand placement'),
    ('CZb-afEMaIc','Floor drills: Cartwheel, beginner','Mismo Gymnastics Staff','beginner cartwheel floor drills contact sequence')
  ) m(video_id,title,channel,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.alternate_name,a.classification,a.rationale,
    jsonb_build_object(
      'boundaryKey',a.boundary_key,'factsRequired',a.facts_required,
      'exactSideStartHandMarksSupportContactActionFinishAndDoseRequired',TRUE,
      'neverInferFromNameOrAthleteRanking',TRUE),
    jsonb_build_object(
      'status','research_queue','classificationCandidate',a.classification,
      'requiredFacts',a.facts_required,
      'humanIdentityAndContentReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Standing T-Shape Marked-Line Four-Contact Drill','same_identity','Exact standing working specification inside the marked-line drill identity.','standing_marked_line_variant',jsonb_build_array('side','lunge','hand_marks','hand_orientation','foot_marks','finish')),
    ('Half-Kneeling T-Shape Marked-Line Four-Contact Drill','same_identity','Exact reduced-entry working specification inside the marked-line drill identity.','half_kneeling_marked_line_variant',jsonb_build_array('side','front_foot','rear_knee','hand_marks','turnover','finish')),
    ('Wall-Assisted T-Shape Marked-Line Four-Contact Drill','same_identity','Exact temporary wall-contact working specification inside the marked-line drill identity.','wall_assisted_marked_line_variant',jsonb_build_array('side','wall_orientation','foot_contact','hand_marks','turnover','step_down')),
    ('Full Unmarked Cartwheel Performance','new_definition','Removing the required markers and evaluating the full element is skill-library performance, not this marked-line exercise drill.','exercise_drill_vs_skill_performance',jsonb_build_array('discipline','entry','support','contact_order','line','finish','evaluation')),
    ('T&T Step Cartwheel','new_definition','The governing-body skill has discipline-specific entry, track, form, finish, and evaluation rules.','generic_drill_vs_tt_skill',jsonb_build_array('discipline','track','entry','hand_position','foot_finish','evaluation')),
    ('T&T Cartwheel Step-In','new_definition','Feet-closing step-in mechanics and compulsory continuation are not the sequential opposite-lunge finish.','sequential_feet_vs_step_in',jsonb_build_array('entry','leg_close','foot_finish','direction','continuation','evaluation')),
    ('WAG Compulsory Cartwheel','new_definition','Official side, direction, choreography, counts, finish, and deductions remain skill-library authority.','generic_drill_vs_wag_compulsory',jsonb_build_array('level','official_text','side','music_count','finish','deductions')),
    ('Cartwheel Hand Placement Then Return','new_definition','Stopping after hands contact changes the repetition endpoint and never completes the four-contact turnover.','partial_hand_contact_return',jsonb_build_array('start','one_or_two_hands','foot_support','return','dose','stop')),
    ('Cartwheel Step-Over or Panel-Mat Drill','new_definition','Obstacle height, panel support, clearance, and leg path change the task and logistics.','panel_mat_step_over',jsonb_build_array('obstacle','height','hand_surface','leg_path','foot_contacts','finish')),
    ('Cartwheel Finish Lunge Drill','new_definition','Isolating or emphasizing only the terminal step-down and freeze is not a full marked contact sequence.','terminal_finish_only',jsonb_build_array('entry_phase','first_foot','second_foot','lunge','hold','reset')),
    ('Power Hurdle to Cartwheel Entry','new_definition','A dynamic hurdle and acceleration are scored actions before hand support.','power_hurdle_entry',jsonb_build_array('approach','hurdle','speed','lead_foot','arm_path','arrival')),
    ('Round-Off','new_definition','Feet-together snap-down and rebound mechanics change the terminal action and repetition.','cartwheel_vs_roundoff',jsonb_build_array('hand_orientation','leg_close','snapdown','feet_together','rebound','finish')),
    ('Donkey Kick or Bunny Hop','new_definition','A bilateral hand base and foot hop does not use the declared side-specific hand-hand-foot-foot Cartwheel sequence.','cartwheel_vs_donkey_kick',jsonb_build_array('hand_support','foot_takeoff','flight','foot_landing','direction','finish')),
    ('Freestanding Handstand Hold','new_definition','Fixed-hand static balance is not a traveling four-contact rotational repetition.','dynamic_rotation_vs_static_hold',jsonb_build_array('entry','hand_motion','external_contact','hold_time','exit','dose_unit')),
    ('Wall-Supported Handstand Hold','new_definition','Retained wall contact and a timed static hold are not temporary wall contact during turnover.','temporary_wall_turnover_vs_static_wall_hold',jsonb_build_array('orientation','contact','timer','hand_motion','descent','dose_unit')),
    ('One-Arm Cartwheel','new_definition','Removing one hand changes laterality, load, contact sequence, balance, and failure consequence.','two_hand_vs_one_hand',jsonb_build_array('supporting_hand','omitted_hand','side','contact_sequence','surface','finish')),
    ('Aerial Cartwheel','new_definition','Eliminating hand support adds flight, power, timing, landing, and failure demands.','hand_supported_vs_aerial',jsonb_build_array('takeoff','flight','hand_contact','leg_path','landing','surface')),
    ('Beam Cartwheel','new_definition','A narrow elevated surface changes marks, support width, fall consequence, spotting, and evaluation.','floor_line_vs_beam',jsonb_build_array('beam_width','beam_height','hand_orientation','foot_contacts','fall_zone','finish')),
    ('Incline or Wedge Cartwheel Drill','new_variant','Slope changes entry, support height, momentum, load, and landing and requires an exact working specification.','surface_slope_variant',jsonb_build_array('slope','height','direction','hand_surface','foot_surface','finish')),
    ('Parallel-Hand Marked-Line Cartwheel Drill','new_variant','Parallel hand orientation changes wrist and elbow mechanics and cannot inherit the T-shape working specification.','parallel_hand_orientation',jsonb_build_array('side','first_hand_angle','second_hand_angle','spacing','surface','finish')),
    ('Reverse-Hand Marked-Line Cartwheel Drill','new_variant','Reverse hand orientation changes wrist and elbow mechanics and cannot inherit the T-shape working specification.','reverse_hand_orientation',jsonb_build_array('side','first_hand_angle','second_hand_angle','spacing','surface','finish')),
    ('Left-Lead Marked-Line Repetitions','modifier_annotation','Lead side is planned, rendered, and logged per repetition without classifying the athlete or creating a new exercise identity.','lead_side_annotation',jsonb_build_array('lead_leg','first_hand','first_foot','sets','repetitions','side_order')),
    ('Right-Lead Marked-Line Repetitions','modifier_annotation','Lead side is planned, rendered, and logged per repetition without classifying the athlete or creating a new exercise identity.','lead_side_annotation',jsonb_build_array('lead_leg','first_hand','first_foot','sets','repetitions','side_order')),
    ('Tape Versus Flat High-Contrast Markers','modifier_annotation','Marker material can be equipment-equivalent only when geometry, visibility, adhesion, and surface remain exact.','marker_material_annotation',jsonb_build_array('material','geometry','contrast','adhesion','surface','inspection')),
    ('Marker Spacing Adjustment','modifier_annotation','Spacing is an individual setup fact while contact order and exact working variant remain unchanged.','marker_spacing_annotation',jsonb_build_array('limb_lengths','reach','hand_spacing','foot_spacing','line','finish')),
    ('Sprung Floor Versus Locked Mat','modifier_annotation','Surface is recorded as an environment and load fact; slope, height, or instability requires a new variant.','level_surface_annotation',jsonb_build_array('surface','stiffness','friction','mat_edges','markers','load')),
    ('Qualified Manual Guidance','modifier_annotation','Spotting or guidance is a declared delivery support and every assisted repetition is logged; it never becomes independent skill proof.','guidance_delivery_annotation',jsonb_build_array('coach_qualification','contact_points','force','phase','reason','result')),
    ('Speed Cartwheel Line Drill','new_definition','Speed emphasis changes entry momentum, contact time, loading, lane length, and objective beyond this quality-first drill.','speed_emphasis',jsonb_build_array('approach','velocity','contact_time','line','finish','measurement')),
    ('Cartwheel Conditioning Circuit','new_definition','Fatigue-density intent conflicts with this low-fatigue learning contract and requires its own reviewed prescription.','learning_vs_conditioning',jsonb_build_array('work_interval','density','fatigue','contact_budget','quality_stop','recovery')),
    ('Pause in Split Handstand','new_definition','A prescribed static pause changes the turnover timing and adds a handstand-hold action.','continuous_turnover_vs_pause',jsonb_build_array('pause_position','hold_seconds','wall_contact','leg_shape','restart','finish')),
    ('Cartwheel to Side Handstand at Wall Without Step-Down','new_definition','Ending at a wall-supported side handstand changes the terminal state and removes the two-foot finish.','wall_arrival_without_four_contact_finish',jsonb_build_array('entry','wall_contact','hold','foot_contacts','descent','dose')),
    ('Cartwheel with Feet Together Finish','new_definition','A feet-together finish approaches a step-in or round-off contract rather than the sequential opposite-lunge finish.','sequential_feet_vs_together_finish',jsonb_build_array('leg_close','first_foot','second_foot','simultaneity','direction','next_action'))
  ) a(alternate_name,classification,rationale,boundary_key,facts_required)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.similarity,r.dimensions,r.reason,
    jsonb_build_object(
      'migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','side','start','hand_orientation','markers','support','wall_or_spotter_contact','turnover','finish','equipment','environment','symptoms','dose','contact_and_fatigue_budgets','duration','logistics','persistence','skill_link','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (half_kneeling_variant,standing_variant,'progression',76,ARRAY['stability','complexity']::TEXT[],'Standing entry increases lunge, momentum, reach, and whole-sequence control, but progression is individual and review-only.'),
    (standing_variant,half_kneeling_variant,'regression',76,ARRAY['stability','complexity']::TEXT[],'Half-kneeling can reduce entry demand while retaining exact marks and contact order, but side and finish must be revalidated.'),
    (wall_assisted_variant,standing_variant,'progression',70,ARRAY['stability','complexity','decision_demand']::TEXT[],'Removing declared wall contact increases independent turnover and lane control; readiness is not inferred from exercise difficulty.'),
    (standing_variant,wall_assisted_variant,'regression',70,ARRAY['stability','complexity','decision_demand']::TEXT[],'Adding exact temporary wall contact can reduce one control demand while changing support, timing, station, and exit.'),
    (half_kneeling_variant,'47cf94b0-cb7a-4153-98df-80fd2c17cc1a'::UUID,'regression',58,ARRAY['range','complexity','impact']::TEXT[],'Donkey Kick may reduce rotational sequence and terminal-lunge demand but is a distinct task requiring full revalidation.'),
    (standing_variant,'6728212d-ae9e-4831-9a07-ad5f8264102f'::UUID,'lateral_substitution',60,ARRAY['range','stability','complexity']::TEXT[],'Panel-mat step-over changes obstacle, support height, leg path, and logistics; substitute only after exact objective and station review.'),
    (standing_variant,'064e650c-28e8-4820-b0da-7043bb509c2c'::UUID,'progression',52,ARRAY['speed','complexity','impact']::TEXT[],'Round-Off snap-down adds leg closure, feet-together landing, speed, and rebound demands; no automatic skill progression is authorized.'),
    (standing_variant,'128281fa-0f87-4722-b7c4-acd86c455cdb'::UUID,'lateral_substitution',56,ARRAY['range','complexity','decision_demand']::TEXT[],'Finish Lunge isolates a different phase and can replace the drill only when the session objective is explicitly changed and revalidated.')
  ) r(from_id,to_id,relationship,similarity,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    v.anchor_tier,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on lead side, start, T-shape candidate hand marks, sequential contacts, side rotation, wall or no-wall contract, leg path, terminal lunge, attention, quality stop, and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on sequential bodyweight hand support, wrist and shoulder mechanics, entry height, split-leg turnover, wall or spotter assistance, two foot contacts, surface, repetition count, cumulative tumbling exposure, symptoms, and recovery.' END
      ||' This scores the exercise, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (standing_variant,'standing-t-shape-marked-line-four-contact',64,58,60),
    (half_kneeling_variant,'half-kneeling-t-shape-marked-line-four-contact',56,50,60),
    (wall_assisted_variant,'wall-assisted-t-shape-marked-line-four-contact',58,54,60)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=64,absolute_load_demand=58,
    coordination_demand=82,impact=36,supervision_demand=70,
    base_overall_difficulty=64,
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exactVariantAndSideRequired',TRUE,
      'fourContactAndTerminalLungeBoundaryRequired',TRUE,
      'fullUnmarkedCartwheelRemainsSkillLibraryContent',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=64,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact variant, side, hand orientation, markers, support, contact sequence, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=15;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=6.4,complexity=6.4,load=5.8,overall=6.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty only; exact variant, side, markers, support, contact sequence, and independent calibration required. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=15;

  UPDATE coaching.exercise SET
    slug='cartwheel-hand-placement-line-drill',
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,
    why_publish_ready=FALSE,archived=FALSE,
    description='Marked-line Cartwheel exercise drill. Select an exact standing, half-kneeling, or wall-assisted T-shape candidate variant with declared side, five marks, hand-hand-foot-foot order, complete turnover, opposite-lunge finish, and quality stop. Full unmarked Cartwheel remains skill-library performance.',
    instructions='Declare variant, lead side, start, hand orientation, five marks, surface, wall and spotter policy, sets, repetitions per side, rest, contact budget, and stop. Count every valid, invalid, partial, assisted, and incident repetition plus every hand and foot contact.',
    default_sets=3,default_reps=3,default_work_seconds=NULL,
    default_rest_seconds=60,est_seconds_per_set=120,
    card_summary='Marked-line hand-hand-foot-foot Cartwheel drill; exact side, support, contacts, turnover, terminal lunge, and review state are mandatory.',
    coach_language='Verify variant, side, five marks, T-shape candidate hands, surface, wall and spotter contract, clearance, contact order, support, leg path, first-foot finish, symptoms, cumulative hand and foot contacts, and controlled opposite lunge. Stop at the first miss, collapse, unsafe contact, symptom, lane conflict, or uncontrolled finish.',
    athlete_language='Use your assigned side and marks: lead foot, hand, hand, foot, foot. Push the floor, finish your opposite lunge, and stop at the first miss or symptom.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_marked_line_variant_required_never_silently_change_side_start_hand_orientation_markers_support_contact_turnover_or_finish',
      'skillLibraryRule','full_unmarked_cartwheel_performance_and_skill_levels_remain_in_skill_cards',
      'loadRule','record two hand and two foot contacts per complete repetition plus every invalid partial assisted and incident contact',
      'fatigueRule','combine all Cartwheel Round-Off Handstand Donkey Kick tumbling jumping landing wrist and shoulder exposure',
      'substitutionRule','revalidate identity side support contacts objective skill link dose fatigue duration logistics persistence and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY[
      'lead_side','marker_spacing','level_surface','sets','repetitions_per_side',
      'rest','qualified_spotter_role','standing_exact_variant',
      'half_kneeling_exact_variant','wall_assisted_exact_variant'
    ]::TEXT[],
    movement_family='Tumbling foundation',primary_phase_key='movement_intelligence',
    phase_subrole='rotation_inversion_tumbling_foundations',
    primary_order_slot='cartwheel_foundation',programming_kind='skill_drill',
    linked_skill_id=NULL,updated_at=now()
  WHERE id=15;

  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    requires_spotting=TRUE,requires_coach_supervision='required',
    readiness_checks=ARRAY[
      'Exact variant, lead side, five marks, hand orientation, wall and spotter contract, finish, and stop signal are understood.',
      'Hand, wrist, elbow, shoulder, neck, spine, hip, knee, ankle, and foot positions and contacts are symptom-free.',
      'The floor, mat, wall, tape, markers, leg-sweep lane, and finish zone are stable, visible, and clear.',
      'The athlete can support sequentially through both hands, follow contact order, breathe, communicate, and stop before loss of control.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, numbness, tingling, weakness, pressure, vision change, dizziness, nausea, faintness, panic, or unusual exertional symptoms.',
      'Wrong side or order, marker miss or slide, elbow or shoulder collapse, head neck or trunk contact, unexpected wall or spotter contact, lane conflict, wrong foot order, extra step, fall, or uncontrolled finish.',
      'Breathing stops, the athlete cannot answer the stop command, or the coach cannot observe every contact.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or conditions for which inverted sequential upper-extremity support or tumbling contact has not been cleared when clearance is appropriate.',
      'No stable marked surface, safe wall if assigned, qualified supervision, full leg-sweep clearance, controlled foot-contact zone, or enforceable one-athlete lane.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact half-kneeling or wall-assisted line-drill variant only after full revalidation.',
      'Use a separately reviewed Donkey Kick or hand-support preparation card when side rotation is not appropriate.',
      'Use a separately reviewed Finish Lunge or marker walk-through card when the session objective is terminal position or sequence cognition without turnover.'
    ]::TEXT[]
  WHERE exercise_id=15;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(
    canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','marked_line_cartwheel_contact_sequence_drill','legacySources',1,'activeWorkingSpecifications',3,'identityQuarantinedSources',source_ids,'neighborBoundaries',7,'skillLibraryBoundaryExplicit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('invert','rotate','push','brace','locomote')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesTissuesJointsActionsPhasesPlanesAndLaterality',TRUE,'leftRightLeadSideLoggedSeparately',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'handContactsPerCompletedRep',2,'landingContactsPerCompletedRep',2,'plannedImpactContactsPerCompletedRep',4,'allInvalidPartialAssistedAndIncidentContactsCounted',TRUE,'cumulativeTumblingAndLandingExposure',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'sideStartHandOrientationMarkersSurfaceWallSpotterPopulationClearanceAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'prepareAndAccessAndMovementIntelligenceOnly',TRUE,'durationDoseRestStationAndSubstitution',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'fiveContactSequenceStopFinishIncidentAndSkillBoundary',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'governingBodyProfessionalAndResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',32,'fullUnmarkedCartwheelSkillBoundary',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeHandFootTumblingAndLandingBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'skillLinkWithoutLevelCopy',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact card and variant, side, start, T-shape candidate hand orientation, five marks, support, wall or spotter contact, turnover, foot order, finish, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, card version, and current playback.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, and substitution proposal; no automatic transfer from an exercise drill to Cartwheel skill performance is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores are not athlete proficiency and do not modify skill-library levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. The legacy baseline remains an identity quarantine and every side, marker, support, contact, turnover, finish, and skill boundary requires exact review.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=15 AND definition_id=canonical_definition
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
          AND status='review' AND requirements_json->>'selectable'='true'
          AND difficulty_json->>'technicalMeaning'='exercise_complexity'
          AND difficulty_json->>'loadMeaning'='physical_difficulty'
          AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
          AND (load_profile_json->>'landingContactsPerRep')::INTEGER=2
          AND (load_profile_json->>'handContactsPerRep')::INTEGER=2)<>3 THEN
    RAISE EXCEPTION '% found invalid source quarantine or working specifications',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>6
    OR (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND video_id=ANY(video_ids) AND link_status='healthy'
          AND review_status='candidate' AND embedding_allowed
          AND captions_available IS NULL AND exact_variant_match IS NULL
          AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>32 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_definition
          AND resolved_definition_id=ANY(neighbor_definition_ids)
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>7 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity boundaries',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      WHERE r.from_variant_id=ANY(active_variant_ids)
        AND r.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(r.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=15 AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=15
        AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND (review_status='approved' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% retained or fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
