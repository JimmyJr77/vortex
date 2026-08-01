-- Resolve the ambiguous 180-degree wall-ball source without rewriting history.
--
-- Legacy source 1284 remains a traceable, non-prescribable identity quarantine:
-- "receive or pick up" cannot satisfy Catch-and-Throw, and neither the ball nor
-- the terminal throw is defined. A separate definition records the exact KIT
-- throw-through-legs -> wall -> grounded 180-degree turn -> two-hand catch task.
--
-- Difficulty is exercise complexity plus physical difficulty; overall is their
-- maximum. Athlete proficiency belongs only to coaching.skill. All content,
-- evidence, media, graph, calibration, and score rows remain review-only.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '423_coaching_180_wall_ball_identity_resolution';
  legacy_slug CONSTANT TEXT := '180-turn-wall-ball-catch-and-throw';
  exact_slug CONSTANT TEXT := 'through-legs-wall-throw-180-turn-catch';
  exact_definition_id CONSTANT UUID :=
    '512dca0f-de71-4c7d-8c5d-1d1a73a1e89a'::UUID;
  standard_variant_id CONSTANT UUID :=
    '32f54c0b-ae0f-42cf-9877-fa72f11dcbcf'::UUID;
  rehearsal_variant_id CONSTANT UUID :=
    '5763d41a-9094-4f3f-b656-af0c519c92b5'::UUID;
  target_slugs CONSTANT TEXT[] := ARRAY[legacy_slug,exact_slug];
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug
    AND definition.status<>'archived';
  IF actual_count<>1 THEN
    RAISE EXCEPTION '% requires exactly one active legacy definition; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=source.definition_id
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug
    AND definition.status<>'archived' AND source.legacy_exercise_id=1284;
  IF actual_count<>1 OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=source.definition_id
    WHERE definition.facility_id=1 AND definition.slug=legacy_slug
      AND definition.status<>'archived' AND source.legacy_exercise_id<>1284
  ) THEN
    RAISE EXCEPTION '% requires exactly legacy source 1284',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=exact_slug
      AND definition.id<>exact_definition_id
  ) THEN
    RAISE EXCEPTION '% found an unexpected definition identity for %',
      migration_key,exact_slug;
  END IF;

  IF EXISTS(
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id=resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id=resolution.resolved_definition_id
    WHERE resolution.resolution_source='human_review'
      AND ((left_definition.slug=legacy_slug AND right_definition.slug=exact_slug)
        OR (left_definition.slug=exact_slug AND right_definition.slug=legacy_slug))
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug
    AND definition.status<>'archived'
    AND definition.provenance_json->>'identityResolutionMigration'=migration_key;
  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=legacy_slug
      AND definition.status<>'archived' AND definition.card_version<>1
  ) THEN
    RAISE EXCEPTION '% expected legacy card version 1 before first application',
      migration_key;
  END IF;
  IF already_applied_count=1 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=legacy_slug
      AND definition.status<>'archived' AND definition.card_version<>2
  ) THEN
    RAISE EXCEPTION '% found legacy card-version drift after resolution',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.facility_id=1 AND definition.slug=ANY(target_slugs) AND(
        definition.status IN('published','deprecated')
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(target_slugs))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=ANY(target_slugs))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=ANY(target_slugs))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND(
        relationship.review_status<>'review'
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND(
        calibration.status<>'review'
        OR calibration.reviewed_by IS NOT NULL
        OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=1284 AND(
        score.human_review_status<>'queued'
        OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF already_applied_count=0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status='archived',updated_at=now()
    FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE profile.variant_id=variant.id AND definition.facility_id=1
      AND definition.slug=legacy_slug;

    UPDATE coaching.exercise_variant_v1 variant
    SET variant_key=CASE WHEN variant.variant_key='baseline'
          THEN 'legacy-ambiguous-composite'
          ELSE left('legacy-pre-423-'||variant.variant_key,120) END,
        display_name=CASE WHEN variant.variant_key='baseline'
          THEN '180-Turn Wall Ball Catch-and-Throw — Identity Review Required'
          ELSE variant.display_name END,
        status=CASE WHEN variant.variant_key='baseline' THEN 'review'
          ELSE 'archived' END,
        requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
          ||jsonb_build_object(
            'selectable',FALSE,'identityQuarantine',TRUE,
            'quarantineReason','Catch is optional, ball and delivery source are undefined, and the terminal wall throw is unnamed.'),
        updated_at=now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id=definition.id AND definition.facility_id=1
      AND definition.slug=legacy_slug;
  END IF;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at)
  VALUES(
    exact_definition_id,1,NULL,exact_slug,
    'Through-the-Legs Wall Throw, 180° Turn and Catch',
    'Through-the-Legs Wall Throw, 180° Turn and Catch',
    ARRAY['Throw and Catch (T&C)','Through-the-Legs Throw, Turn and Catch']::TEXT[],
    'From behind the assigned line with the back to a clear smooth wall, look through straddled legs and throw the specified light gymnastic ball directly to the wall. Stand and turn 180 degrees toward the wall, visually reacquire the rebound, catch it with two hands before it touches the floor, control the ball, and reset.',
    'throw_turn_catch_coordination','1.0.0',1,'review',82,68,20,
    ARRAY['through_legs_ball_throw','grounded_180_reorientation',
      'two_hand_rebound_catch']::TEXT[],
    ARRAY['hand','wrist','forearm','elbow','shoulder','spine','core',
      'pelvis','hip','thigh','knee','calf','ankle','foot','full_body']::TEXT[],
    ARRAY['gymnastic_ball','smooth_wall','floor_markers','wall_target_marker']::TEXT[],
    ARRAY['attempt_scoring_sheet','video_capture']::TEXT[],
    '{}'::JSONB,'{}'::JSONB,
    jsonb_build_object('temporaryDisposableResearchSeed',FALSE),
    NULL,NULL,NULL,NULL)
  ON CONFLICT(facility_id,slug) DO NOTHING;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='180-Turn Wall Ball Catch-and-Throw — Identity Review Required',
      display_name='180-Turn Wall Ball Catch-and-Throw — Identity Review Required',
      aliases=ARRAY(
        SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
          ||ARRAY['180-Turn Wall Ball Catch-and-Throw']::TEXT[]) alias
        WHERE nullif(btrim(alias),'') IS NOT NULL
          AND lower(btrim(alias))<>'180-turn wall ball catch-and-throw — identity review required'
        GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
      description='Identity quarantine only. Legacy source 1284 says the athlete may receive or pick up an unspecified ball after turning, then perform an unnamed wall-ball throw. Because reception is optional and ball, delivery source, catch window, throw pattern, target, rebound, and terminal outcome are undefined, this record must not be selected, dosed, demonstrated, or presented as an exercise until a human identity decision creates or maps an exact definition.',
      family_key='turn_and_throw_coordination_unresolved',
      schema_version='1.0.0',
      card_version=CASE WHEN definition.provenance_json
        ->>'identityResolutionMigration' IS DISTINCT FROM migration_key
        THEN definition.card_version+1 ELSE definition.card_version END,
      status='review',content_confidence=62,scoring_confidence=45,
      media_confidence=20,
      movement_patterns=ARRAY['rotate','throw']::TEXT[],
      body_regions=ARRAY[
        'hand','wrist','elbow','shoulder','spine','core','pelvis','hip',
        'hamstrings','knee','calf','ankle','foot','full_body']::TEXT[],
      required_equipment='{}'::TEXT[],optional_equipment='{}'::TEXT[],
      anatomy_json=jsonb_build_object(
        'status','candidate_pending_exact_movement_contract',
        'candidatePrimaryMuscles',jsonb_build_array(
          'gluteals','quadriceps','calves','obliques',
          'throw_pattern_dependent_shoulder_and_arm_muscles'),
        'candidateSecondaryMuscles',jsonb_build_array(
          'hamstrings','adductors','hip_rotators','rotator_cuff',
          'scapular_stabilizers','forearm_and_hand_muscles','spinal_stabilizers'),
        'candidateJoints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine','shoulder',
          'elbow','wrist','hand'),
        'primaryMuscles',jsonb_build_array(
          'gluteals','quadriceps','calves','obliques',
          'throw_pattern_dependent_shoulder_and_arm_muscles'),
        'joints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine','shoulder',
          'elbow','wrist','hand'),
        'jointActions',jsonb_build_array(
          'pending_exact_turn_reception_or_pickup_and_throw_contract'),
        'planes',jsonb_build_array('pending_exact_throw_vector_review'),
        'laterality','turn_direction_and_throw_laterality_unresolved'),
      environment_json=jsonb_build_object(
        'selectionBlocked',TRUE,'exactBallPending',TRUE,
        'deliverySourcePending',TRUE,'wallAndTargetPending',TRUE,
        'reboundAndMissZonePending',TRUE,'athletePrescriptionProhibited',TRUE),
      population_json=jsonb_build_object(
        'selectionStatus','identity_quarantine_do_not_prescribe',
        'prerequisites',jsonb_build_array(
          'human_identity_reviewer_assigned','exact_sequence_ball_delivery_catch_throw_target_and_terminal_outcome_recorded'),
        'doNotUseWhen',jsonb_build_array(
          'identity_review_incomplete','facility_risk_review_incomplete',
          'exact_media_review_incomplete','publication_quarantine_active'),
        'medicalScope','This source-label quarantine is not an athlete prescription, diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance.'),
      athlete_support_json=jsonb_build_object(
        'whyItMatters','Retains source traceability without exposing an underspecified ball task to workout selection.',
        'primaryCue','Do not select or perform from this card while identity review is incomplete.',
        'beforeYouStart',jsonb_build_array('no_athlete_start_is_authorized'),
        'expectedSensations',jsonb_build_array('none_no_athlete_delivery_is_authorized'),
        'unexpectedSensations',jsonb_build_array('any_attempt_to_perform_from_this_identity_quarantine'),
        'selfChecks',jsonb_build_array('card_selection_is_blocked'),
        'painGuidance','No athlete delivery is allowed from this card.',
        'accessibility',jsonb_build_object(
          'allAthletes','Use a reviewed exact turn, catch, or throw definition instead.'),
        'mediaAlternatives',jsonb_build_object(
          'available',FALSE,'reason','identity_quarantine_no_demonstration_authorized'),
        'recordAfterSet',jsonb_build_array('no_set_may_be_generated')),
      coach_support_json=jsonb_build_object(
        'observationChecklist',jsonb_build_array(
          'confirm_selection_is_blocked','confirm_no_athlete_delivery_or_demonstration'),
        'faultCorrections',jsonb_build_array(
          jsonb_build_object('fault','card_selected_or_displayed','action','remove_and_route_to_human_identity_review')),
        'demonstrationPlan',jsonb_build_object(
          'authorized',FALSE,'reason','exact_identity_is_unresolved'),
        'identityReviewChecklist',jsonb_build_array(
          'sequence_order','ball_type_mass_diameter_and_bounce','start_orientation',
          'turn_direction_and_footwork','delivery_source_speed_and_path',
          'catch_required_or_not','catch_height_and_stabilization',
          'throw_pattern_vector_target_rebound_and_terminal_outcome',
          'miss_zone_reset_and_valid_repetition','existing_identity_boundaries'),
        'decisionTree',jsonb_build_object(
          'turnCatchNamedThrow','create_or_map_exact_definition',
          'turnPickupNamedThrow','create_separate_no_catch_definition',
          'wallBallShotAfterTurn','map_only_if_squat_to_overhead_pattern_is_explicit',
          'throwTurnCatch','use_separate_exact_definition',
          'stillAmbiguous','retain_quarantine'),
        'groupManagement',jsonb_build_object(
          'stationEligible',FALSE,'athletesPerStation',0,
          'rules',jsonb_build_array('do_not_place_in_station_plan','do_not_generate_dose','do_not_display_as_athlete_option')),
        'modificationDecisionTree',jsonb_build_array(
          jsonb_build_object('when','identity_unresolved','action','retain_quarantine'),
          jsonb_build_object('when','exact_identity_documented','action','create_or_map_reviewed_exact_definition')),
        'doNotUseWhen',jsonb_build_array(
          'identity_review_incomplete','publication_quarantine_active')),
      support_operations_json=jsonb_build_object(
        'supportSummary','Route identity, media, graph, calibration, and publication questions to human content review; no athlete delivery is authorized.',
        'issueCategories',jsonb_build_array(
          'identity_or_variant','difficulty_or_dose','equipment_or_environment',
          'instruction_or_accessibility','media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'identityQuestion','route_to_human_content_review',
          'selectionAttempt','block_and_remove_from_workout',
          'safetyOrIncident','follow_facility_incident_and_medical_escalation_policy'),
        'knownLimitations',jsonb_build_array(
          'legacy_identity_internally_contradictory',
          'difficulty_is_only_a_provisional_envelope',
          'candidate_media_not_human_viewed','no_approvals_created'),
        'retentionPolicy',jsonb_build_object(
          'retain',jsonb_build_array('source_trace','identity_decision','review_state','superseded_mapping'),
          'athletePerformanceDataAuthorized',FALSE),
        'changeImpactPolicy','An exact sequence, ball, source, catch rule, throw, target, terminal outcome, dose, stop rule, relationship, or media decision requires a new card version and independent review.'),
      approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,
      provenance_json=definition.provenance_json||jsonb_build_object(
        'identityResolutionMigration',migration_key,
        'researchBatch','180-degree-transitions-v1',
        'researchVersion','2026-07-25.22',
        'evidenceState','candidate_requires_human_review',
        'mediaState','five_unverified_adjacent_component_candidates',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'identityState','identity_quarantine',
        'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE),
      updated_at=now()
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug
    AND definition.status<>'archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Through-the-Legs Wall Throw, 180° Turn and Catch',
      display_name='Through-the-Legs Wall Throw, 180° Turn and Catch',
      aliases=ARRAY['Throw and Catch (T&C)',
        'Through-the-Legs Throw, Turn and Catch']::TEXT[],
      description='From behind the assigned line with the back to a clear smooth wall, look through straddled legs and throw the specified light gymnastic ball directly to the wall. Stand and turn 180 degrees toward the wall, visually reacquire the rebound, catch it with two hands before it touches the floor, control the ball, and reset.',
      family_key='throw_turn_catch_coordination',schema_version='1.0.0',
      card_version=1,status='review',content_confidence=82,
      scoring_confidence=68,media_confidence=20,
      movement_patterns=ARRAY['hinge','throw','rotate','catch']::TEXT[],
      body_regions=ARRAY[
        'hand','wrist','elbow','shoulder','spine','core','pelvis','hip',
        'hamstrings','knee','calf','ankle','foot','eye_hand','full_body']::TEXT[],
      required_equipment=ARRAY['ball','wall','line_tape']::TEXT[],
      optional_equipment=ARRAY['cones']::TEXT[],
      anatomy_json=jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array(
          'gluteals','quadriceps','hamstrings','calves','abdominal_wall',
          'posterior_deltoid','triceps','forearm_and_hand_muscles'),
        'primaryMuscles',jsonb_build_array(
          'gluteals','quadriceps','hamstrings','calves','abdominal_wall',
          'posterior_deltoid','triceps','forearm_and_hand_muscles'),
        'secondaryMusclesAndTissues',jsonb_build_array(
          'adductors','hip_rotators','spinal_stabilizers','rotator_cuff',
          'scapular_stabilizers'),
        'joints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine','shoulder',
          'elbow','wrist','hand'),
        'actions',jsonb_build_array(
          'hip_hinge_and_straddle','two_hand_underhand_release',
          'hip_knee_extension','grounded_half_turn','visual_reacquisition',
          'two_hand_catch_deceleration'),
        'jointActions',jsonb_build_array(
          'hip_hinge_and_straddle','two_hand_underhand_release',
          'hip_knee_extension','grounded_half_turn','visual_reacquisition',
          'two_hand_catch_deceleration'),
        'planes',jsonb_build_array(
          'sagittal_throw_and_recovery','transverse_reorientation',
          'frontal_postural_control'),
        'laterality','bilateral_throw_and_catch_with_turn_direction_recorded'),
      environment_json=jsonb_build_object(
        'surface','level_non_slip_clear_floor',
        'wall','smooth_clear_wall_to_at_least_three_metres_for_standardized_variant',
        'line','measured_three_metre_drop_line_for_standardized_variant',
        'target','DIN_A4_visual_marker_centered_at_120_cm_for_standardized_variant',
        'lane','clear_throw_rebound_and_miss_zone_with_no_cross_traffic',
        'lighting','adequate_for_early_ball_reacquisition'),
      population_json=jsonb_build_object(
        'selectionStatus','candidate_requires_human_review',
        'programmingEligibility','explicit_coordination_assessment_or_non_normative_rehearsal_only',
        'readinessChecks',jsonb_build_array(
          'pain_free_hinge_stand_and_grounded_turn','no_turn_provoked_dizziness',
          'predictable_two_hand_catch_with_selected_ball',
          'understands_throw_turn_catch_order_and_stop_signal'),
        'constraints',jsonb_build_array(
          'standardized_scores_only_for_exact_validated_population_and_protocol',
          'medicine_slam_or_stability_ball_not_assumed',
          'rehearsal_changes_are_non_normative'),
        'contraindications',jsonb_build_array(
          'pain_dizziness_or_guarding','unsafe_wall_floor_ball_or_lane',
          'cannot_track_or_receive_selected_ball_safely')),
      athlete_support_json=jsonb_build_object(
        'plainLanguageSummary','Throw the named light ball through your legs directly to the wall, stand and turn around, find the rebound, catch it with two hands before it touches the floor, and reset.',
        'whyItMatters','This precision task links a direct wall throw, rapid grounded reorientation, visual reacquisition, and controlled catch; it is not a power or conditioning exercise.',
        'primaryCue','Hit the wall, turn now, find the rebound, and catch softly away from your face.',
        'expectedSensations',jsonb_build_array(
          'light_ball_release','controlled_grounded_turn','eyes_finding_the_rebound','soft_two_hand_reception'),
        'unexpectedSensations',jsonb_build_array(
          'pain','dizziness_or_disorientation','face_or_head_contact','unpredictable_rebound','loss_of_balance'),
        'painGuidance','Stop immediately for pain, dizziness, disorientation, head or face contact, or loss of balance. Do not chase an unsafe rebound.',
        'selfChecks',jsonb_build_array(
          'ball_reaches_wall_before_floor','turn_finishes_in_time','eyes_find_rebound_early',
          'catch_stays_away_from_face','attempt_ends_in_control'),
        'setupChecklist',jsonb_build_array(
          'confirm_ball_line_wall_marker_and_clear_lane','confirm_turn_direction',
          'complete_predictable_catch_and_slow_sequence_rehearsal'),
        'cues',jsonb_build_array(
          'look_through_the_legs_and_hit_the_wall','stand_and_turn_now',
          'find_the_rebound_early','soft_two_hand_catch_away_from_face',
          'control_and_reset'),
        'feedbackPrompt','Did the ball hit the wall directly, did you turn in time, and was the catch controlled away from your face?',
        'accessibility',jsonb_build_object(
          'coordinationScale','Use only the explicitly non-normative rehearsal variant with a larger or lighter predictable ball, shorter declared distance, slower turn, or component rehearsal.',
          'visualSupport','Use floor arrows, a high-contrast wall marker, and an additional live demonstration after human review.',
          'instructionSupport','Use one action cue at a time and require teach-back of the stop rule.'),
        'mediaAlternatives',jsonb_build_object(
          'captionsRequired',TRUE,'transcriptRequired',TRUE,'stillSequenceRequired',TRUE,
          'audioDescriptionRequired',TRUE,
          'requiredViews',jsonb_build_array('throw_and_turn_side_view','wall_side_rebound_and_catch_view'),
          'availability','pending_human_content_and_media_review'),
        'accessibilityOptions',jsonb_build_array(
          'non_normative_larger_or_lighter_predictable_ball',
          'non_normative_shorter_distance','slower_turn','component_rehearsal',
          'visual_floor_arrows','extra_demonstration','longer_reset')),
      coach_support_json=jsonb_build_object(
        'observationChecklist',jsonb_build_array(
          'exact_ball_wall_line_marker_lane_and_turn_direction_are_declared',
          'ball_reaches_wall_directly','turn_is_grounded_and_timely',
          'eyes_reacquire_rebound_early','catch_is_soft_and_away_from_face',
          'athlete_and_ball_remain_in_clear_space','attempt_ends_in_control'),
        'faultCorrections',jsonb_build_array(
          jsonb_build_object('fault','ball_hits_floor_before_wall','action','reduce_release_force_or_rehearse_direct_throw'),
          jsonb_build_object('fault','late_or_uncontrolled_turn','action','slow_or_component_rehearse_the_turn'),
          jsonb_build_object('fault','late_visual_pickup','action','cue_find_the_rebound_before_reaching'),
          jsonb_build_object('fault','rigid_or_face_level_catch','action','stop_then_scale_ball_distance_or_sequence'),
          jsonb_build_object('fault','boundary_exit_or_uncontrolled_finish','action','stop_and_restore_clear_lane_and_predictable_rebound')),
        'demonstrationPlan',jsonb_build_object(
          'status','requires_human_content_review_before_athlete_delivery',
          'views',jsonb_build_array('side_for_throw_and_turn','wall_side_for_rebound_and_catch'),
          'show',jsonb_build_array('one_slow_component_sequence','two_complete_correct_attempts','stop_signal_and_no_chase_rule'),
          'comprehensionCheck','Athlete repeats throw-turn-catch order and the stop/no-chase rule.'),
        'observationPriorities',jsonb_build_array(
          'exact_ball_and_setup','direct_wall_contact','turn_timing_and_direction',
          'eyes_reacquire_ball','catch_height_and_hand_adaptation',
          'floor_contact_boundary_exit_and_terminal_control'),
        'qualityGate','Count only an attempt using the declared variant setup in which the ball reaches the wall directly, the grounded turn finishes in time, the athlete visually reacquires the rebound, reception stays away from the face, and the attempt ends in control inside clear space.',
        'stopRules',jsonb_build_array(
          'pain_guarding_dizziness_or_disorientation',
          'head_face_hand_shoulder_back_hip_knee_or_ankle_symptom',
          'repeated_face_level_or_rigid_catch','unsafe_or_unpredictable_rebound',
          'ball_or_athlete_enters_occupied_space','setup_changes',
          'material_tracking_turn_or_catch_quality_loss'),
        'recordingFields',jsonb_build_array(
          'variant','ball_type_diameter_mass_and_bounce','distance','wall_and_marker',
          'turn_direction','attempts','direct_wall_hits','timely_turns',
          'floor_contacts','catches_touches_and_misses','boundary_exits',
          'symptoms_faults_and_stop_reason'),
        'groupManagement',jsonb_build_object(
          'format','single_athlete_clear_lane','athletesPerStation',1,
          'queueRule','No person may stand between athlete and wall or in the rebound and miss zone.',
          'coachSightLine','Observe throw and turn from the side and rebound reception from the wall-side oblique.',
          'equipmentSharing','One declared ball remains with one active lane until the set is complete.'),
        'modificationDecisionTree',jsonb_build_array(
          jsonb_build_object('when','pain_dizziness_disorientation_or_head_face_contact','action','stop_and_escalate'),
          jsonb_build_object('when','rebound_is_unpredictable_or_lane_is_not_clear','action','stop_and_correct_environment'),
          jsonb_build_object('when','turn_tracking_or_catch_is_not_repeatable','action','use_non_normative_rehearsal_or_component_practice'),
          jsonb_build_object('when','standardized_protocol_is_not_exact','action','do_not_score_or_compare'),
          jsonb_build_object('when','quality_is_repeatable_and_review_is_complete','action','retain_declared_variant_and_dose')),
        'doNotUseWhen',jsonb_build_array(
          'pain_dizziness_guarding_or_disorientation','unsafe_wall_floor_ball_lane_or_rebound',
          'athlete_cannot_track_or_receive_selected_ball_safely','exact_variant_or_stop_signal_is_not_understood',
          'human_content_media_or_facility_review_is_incomplete')),
      support_operations_json=jsonb_build_object(
        'supportSummary','Keep standardized assessment and non-normative rehearsal distinct; resolve setup, symptom, scoring, and media questions before delivery.',
        'issueCategories',jsonb_build_array(
          'protocol_or_variant','difficulty_or_dose','equipment_or_environment',
          'symptom_or_population_constraint','instruction_or_accessibility',
          'media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array('head_or_face_impact','acute_injury','neurologic_or_cardiovascular_symptom'),
          'coachReview',jsonb_build_array('repeated_tracking_turn_catch_or_boundary_fault','meaningful_turn_direction_difference','unclear_standardized_setup'),
          'equipmentReview',jsonb_build_array('ball_wall_floor_marker_or_lane_damage_or_drift'),
          'contentReview',jsonb_build_array('protocol_translation_or_identity_conflict','media_mismatch','normative_interpretation_request')),
        'knownLimitations',jsonb_build_array(
          'candidate_media_are_adjacent_and_not_human_viewed',
          'no_universal_training_dose_or_adult_norms',
          'scores_edges_calibrations_and_cards_are_unapproved_proposals'),
        'retentionPolicy',jsonb_build_object(
          'retain',jsonb_build_array(
            'declared_setup','attempt_outcomes','symptoms_and_incidents','material_faults',
            'stop_reason','card_and_protocol_version','review_state','superseded_decisions'),
          'healthData','apply_facility_privacy_and_incident_retention_policy'),
        'changeImpactPolicy','Changes to sequence, ball, distance, wall, marker, turn, catch outcome, scoring, dose, stop rule, relationship, or media require a new card version and renewed review.'),
      approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,
      provenance_json=(definition.provenance_json-'temporaryDisposableResearchSeed')
        ||jsonb_build_object(
          'identityResolutionMigration',migration_key,
          'researchBatch','through-legs-wall-throw-180-turn-catch-v1',
          'researchVersion','2026-08-01.2',
          'primaryIdentitySource','https://www.ifss.kit.edu/more/english/245.php',
          'canonicalAuthoredFromResearch',TRUE,
          'evidenceState','candidate_requires_human_review',
          'mediaState','three_unverified_adjacent_component_candidates',
          'difficultyModel','max_exercise_complexity_physical_difficulty',
          'identityState','exact_candidate',
          'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
          'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
          'calibrationApprovalCreated',FALSE),
      updated_at=now()
  WHERE definition.id=exact_definition_id AND definition.facility_id=1
    AND definition.slug=exact_slug;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,legacy_definition.id,exact_definition.id,'distinct_exercises',
    'The legacy record is an unresolved turn then receive-or-pick-up then unnamed wall-throw composite. The exact card throws a specified ball through the legs to a wall first, performs a grounded 180-degree turn second, and catches the rebound third. Action order, reception requirement, ball, throw, target, rebound, terminal outcome, assessment setup, dose, failure criteria, and scoring are identity-bearing and prohibit consolidation or silent substitution.',
    jsonb_build_object(
      'identityBoundary','unresolved_turn_receive_or_pickup_throw_vs_exact_throw_turn_catch',
      'orderedActions',jsonb_build_object(
        'legacy','turn__receive_or_pick_up__unnamed_wall_throw',
        'exact','through_legs_throw_to_wall__grounded_180_turn__two_hand_rebound_catch'),
      'differingDimensions',jsonb_build_array(
        'action_order','catch_required','ball_specification','delivery_source',
        'throw_pattern','target','wall_rebound','terminal_outcome','setup',
        'dose','failure_criteria','scoring'),
      'primarySource','https://www.ifss.kit.edu/more/english/245.php',
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM coaching.exercise_definition_v1 legacy_definition
  JOIN coaching.exercise_definition_v1 exact_definition
    ON exact_definition.id=exact_definition_id
  WHERE legacy_definition.facility_id=1
    AND legacy_definition.slug=legacy_slug
    AND legacy_definition.status<>'archived'
    AND exact_definition.facility_id=1
    AND exact_definition.slug=exact_slug
    AND exact_definition.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  UPDATE coaching.exercise_variant_v1 variant
  SET display_name='180-Turn Wall Ball Catch-and-Throw — Identity Review Required',
      modifier_keys=ARRAY['identity_quarantine']::TEXT[],
      difficulty_json=jsonb_build_object(
        'technicalComplexity',70,'absoluteLoadDemand',48,
        'coordinationDemand',78,'supervisionDemand',82,
        'failureConsequence',76,'impact',28,'workCapacityDemand',38,
        'baseOverallDifficulty',70,'scoreStatus','provisional_identity_envelope',
        'scoreMeaning','Complexity and physical-demand envelope only; no athlete proficiency classification and no prescription authorization.'),
      load_profile_json=jsonb_build_object(
        'status','deferred_until_identity_resolution',
        'candidateLoadingType','light_to_moderate_ball_reception_or_pickup_and_ballistic_throw',
        'candidateExternalLoadMethod','ball_type_mass_bounce_delivery_and_throw_must_be_recorded',
        'impactClass','low_lower_body_with_material_ball_collision_risk',
        'gripDemand',40,'spinalLoading',30,'eccentricStress',25,
        'landingContactsPerRep',0,
        'externalLoadMethod','unresolved_ball_type_mass_bounce_delivery_and_throw'),
      fatigue_profile_json=jsonb_build_object(
        'status','deferred_until_identity_resolution',
        'candidateSignals',jsonb_build_array(
          'late_visual_pickup','rigid_or_face_level_catch','dropped_ball',
          'poor_target_accuracy','trunk_overrotation','throw_pattern_drift'),
        'localMuscleFatigue',36,'gripFatigue',42,
        'technicalFatigueSensitivity',78,'impactAccumulation',28,
        'recoveryHours',jsonb_build_array(0,48),
        'recoveryUncertainty','depends_on_unresolved_ball_delivery_catch_throw_intent_and_volume'),
      programming_profile_json=jsonb_build_object(
        'selectable',FALSE,'selectionReason','identity_quarantine',
        'primaryPhase','movement_intelligence','primaryRole','avoid',
        'trainingStimuli',jsonb_build_array('none_identity_quarantine'),
        'stimulusDose',jsonb_build_object(
          'authorized',FALSE,'sets',0,'repetitions',0),
        'weeklyExposure',jsonb_build_object(
          'authorized',FALSE,'maximum',0),
        'prerequisites',jsonb_build_array('human_identity_resolution'),
        'completionCriteria',jsonb_build_array('exact_exercise_definition_created_or_mapped'),
        'sequenceRules',jsonb_build_object(
          'authorized',FALSE,'reason','no_sequence_is_prescribed_from_an_unresolved_identity'),
        'pairingCompatibility',jsonb_build_object(
          'recommended',jsonb_build_array(),'acceptable',jsonb_build_array(),
          'incompatible',jsonb_build_array('all_workout_content_until_identity_resolution')),
        'interferenceRules',jsonb_build_array(
          jsonb_build_object('condition','identity_unresolved','action','exclude_from_all_generation')),
        'uncertaintyPolicy','Fail closed: never select, dose, substitute, demonstrate, or render until human identity review creates or maps an exact card.',
        'cumulativeBudget',jsonb_build_object(
          'countInWorkout',FALSE,'reason','no_athlete_delivery_authorized'),
        'excludedIdentities',jsonb_build_array(
          'throw_turn_catch','turn_pickup_named_throw','turn_catch_named_throw',
          'wall_ball_squat_to_overhead_shot','catch_slam')),
      requirements_json=jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'requiresHumanIdentityDecision',TRUE,
        'missingContract',jsonb_build_array(
          'sequence','ball','delivery_source','catch_requirement','catch_window',
          'stabilization','throw_pattern','target','rebound','terminal_outcome',
          'miss_zone','reset','valid_repetition')),
      status='review',updated_at=now()
  FROM coaching.exercise_definition_v1 definition
  WHERE variant.definition_id=definition.id AND definition.facility_id=1
    AND definition.slug=legacy_slug
    AND variant.variant_key='legacy-ambiguous-composite';

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT seed.id,definition.id,seed.variant_key,seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',seed.complexity,'absoluteLoadDemand',seed.physical,
      'coordinationDemand',seed.coordination,'supervisionDemand',seed.supervision,
      'failureConsequence',seed.failure_consequence,'impact',seed.impact,
      'workCapacityDemand',seed.work_capacity,
      'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
      'scoreStatus','candidate_requires_human_review',
      'scoreMeaning','Exercise complexity and physical difficulty only; athlete proficiency is selection context and never a card score.'),
    seed.requirements,'review',
    jsonb_build_object(
      'loadingType','light_ball_throw_turn_and_rebound_reception',
      'externalLoadMethod','record_ball_type_diameter_mass_bounce_wall_distance_and_attempts',
      'impactClass','low_body_impact_with_ball_rebound_collision_risk',
      'gripDemand',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 30 ELSE 22 END,
      'spinalLoading',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 20 ELSE 16 END,
      'eccentricStress',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 18 ELSE 12 END,
      'landingContactsPerRep',0,
      'primaryStress',jsonb_build_array(
        'hinge_and_recovery','rapid_reorientation','visual_tracking',
        'hand_and_upper_body_rebound_deceleration'),
      'ballContract',seed.ball_contract),
    jsonb_build_object(
      'primary',jsonb_build_array(
        'visual_tracking','rapid_reorientation','hand_and_upper_body_reception'),
      'technicalSensitivity',jsonb_build_array(
        'missed_wall','slower_turn','late_visual_pickup','rigid_or_face_level_catch',
        'floor_contact','boundary_exit'),
      'localMuscleFatigue',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 18 ELSE 12 END,
      'gripFatigue',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 24 ELSE 16 END,
      'technicalFatigueSensitivity',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 72 ELSE 60 END,
      'impactAccumulation',CASE WHEN seed.variant_key='standardized-three-metre-assessment' THEN 12 ELSE 8 END,
      'recoveryHours',jsonb_build_array(0,24),
      'recoveryBasis','low_volume_light_ball_exposure_subject_to_symptoms_total_throwing_and_individual_response'),
    jsonb_build_object(
      'selectable',TRUE,'selectionState','candidate_requires_human_review',
      'primaryPhase','movement_intelligence',
      'primaryRole',CASE WHEN seed.variant_key='standardized-three-metre-assessment'
        THEN 'conditional' ELSE 'secondary' END,
      'intent',seed.intent,
      'trainingStimuli',jsonb_build_array(
        'precision_coordination','perception_action_coupling',
        'rapid_grounded_reorientation','visual_reacquisition','controlled_rebound_reception'),
      'stimulusDose',jsonb_build_object(
        'primaryUnit','attempts','fullResetRequired',TRUE,
        'attempts',CASE WHEN seed.variant_key='standardized-three-metre-assessment'
          THEN jsonb_build_array(10,10) ELSE jsonb_build_array(4,16) END),
      'weeklyExposure',jsonb_build_object(
        'minimum',1,'typical',1,'maximum',2,'minimumRecoveryHours',0,
        'adjustFor','total_throwing_reception_turning_symptoms_and_technical_fatigue'),
      'prerequisites',jsonb_build_array(
        'pain_free_hinge_stand_and_grounded_turn','no_turn_provoked_dizziness',
        'predictable_two_hand_catch_with_selected_ball','safe_wall_ball_and_clear_lane',
        'understands_throw_turn_catch_order_and_stop_signal'),
      'completionCriteria',jsonb_build_array(
        'direct_wall_contact','timely_controlled_grounded_turn','early_visual_reacquisition',
        'safe_two_hand_catch_away_from_face','terminal_control_inside_clear_space'),
      'sequenceRules',jsonb_build_object(
        'order',jsonb_build_array('throw_directly_to_wall','stand_and_turn_180','reacquire_and_catch','control_and_full_reset'),
        'preferredBefore',jsonb_build_array('fatiguing_throwing','reactive_change_of_direction','conditioning'),
        'avoidAfter',jsonb_build_array('high_fatigue_throwing','grip_fatigue','dizziness_or_tracking_symptoms')),
      'pairingCompatibility',jsonb_build_object(
        'recommended',jsonb_build_array('low_demand_mobility','non_competing_instruction'),
        'acceptable',jsonb_build_array('low_fatigue_lower_body_patterning'),
        'incompatible',jsonb_build_array('high_density_ball_work','fatiguing_rotational_or_throwing_work','shared_rebound_lane_activity')),
      'interferenceRules',jsonb_build_array(
        jsonb_build_object('condition','priority_precision_or_assessment','action','place_before_fatigue_and_preserve_full_reset'),
        jsonb_build_object('condition','throwing_reception_or_turn_budget_is_already_high','action','reduce_or_omit'),
        jsonb_build_object('condition','dizziness_tracking_loss_or_unpredictable_rebound','action','stop_and_do_not_substitute_automatically')),
      'uncertaintyPolicy','Fail closed: use the exact card only after human content, facility, and media review; otherwise select neither variant for production and never infer a standardized score from rehearsal.',
      'cumulativeBudget',jsonb_build_object(
        'countInWorkout',TRUE,'throwAttempts',TRUE,'reboundReceptions',TRUE,
        'turns',TRUE,'impactContacts',FALSE,'localFatigue',TRUE,
        'technicalFatigue',TRUE,'sessionDuration',TRUE),
      'excludedUses',jsonb_build_array(
        'medicine_ball_power','wall_ball_conditioning','generic_skill_level_assignment',
        'normative_scoring_outside_exact_standardized_protocol'))
  FROM (VALUES
    (standard_variant_id,'standardized-three-metre-assessment',
      'Through-the-Legs Wall Throw, 180° Turn and Catch — Standardized 3 m Assessment',
      ARRAY['standardized_assessment','three_metre_line','ten_attempts']::TEXT[],
      68,30,82,72,58,16,24,
      jsonb_build_object(
        'selectable',TRUE,'protocol','standardized_candidate',
        'requires',jsonb_build_array(
          'specified_light_bouncing_gymnastic_ball','smooth_wall',
          'measured_three_metre_line','DIN_A4_marker_centered_at_120_cm',
          'ten_attempt_scoring_sheet','clear_rebound_and_miss_zone'),
        'populationInterpretation','only_validated_population_and_exact_protocol'),
      'specified_light_bouncing_gymnastic_ball_not_medicine_slam_or_stability_ball',
      'precision_coordination_assessment'),
    (rehearsal_variant_id,'scaled-coordination-rehearsal',
      'Through-the-Legs Wall Throw, 180° Turn and Catch — Scaled Rehearsal',
      ARRAY['non_normative_rehearsal','scaled_ball_or_distance','full_reset']::TEXT[],
      58,22,72,68,48,12,20,
      jsonb_build_object(
        'selectable',TRUE,'protocol','non_normative_rehearsal_candidate',
        'requires',jsonb_build_array(
          'larger_or_lighter_predictable_ball','smooth_wall',
          'declared_shorter_distance','clear_rebound_and_miss_zone'),
        'forbids',jsonb_build_array(
          'standardized_score_interpretation','conditioning_density')),
      'larger_or_lighter_predictable_bouncing_ball_with_declared_properties',
      'sequence_learning_and_safe_visual_reacquisition'))
    seed(id,variant_key,display_name,modifier_keys,complexity,physical,
      coordination,supervision,failure_consequence,impact,work_capacity,
      requirements,ball_contract,intent)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=exact_definition_id AND definition.facility_id=1
      AND definition.slug=exact_slug
  ON CONFLICT(definition_id,variant_key)
  DO UPDATE SET display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
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
  SELECT variant.id,'identity-quarantine-no-delivery','movement_intelligence','avoid',
    'Preserve source traceability while blocking every athlete prescription until the exact identity is adjudicated.',1,1,
    jsonb_build_object('selectionBlocked',TRUE,'identityReviewRequired',TRUE),
    jsonb_build_object('sets',0,'repetitions',0,'durationSeconds',0,
      'doseAuthorized',FALSE,'reason','identity_quarantine'),
    'No repetition is valid and no dose may be generated from an internally contradictory identity.',
    ARRAY['any_attempt_to_generate_or_deliver_this_card']::TEXT[],
    'Do not place this card in a workout, station, substitution list, or athlete display. Route identity decisions to human content review.',
    'Do not perform this card. Ask for a reviewed exact exercise instead.',
    'No athlete adaptation is authorized from this quarantine record.',
    ARRAY['ball','wall']::TEXT[],jsonb_build_object(
      'athletesPerStation',0,'setupSeconds',0,'transitionSeconds',0,
      'stationEligible',FALSE,'substitutionEligible',FALSE),
    '{}'::UUID[],'review',
    jsonb_build_object('estimatedTotalMinutes',jsonb_build_array(0,0),
      'restIsExplicit',FALSE,'durationAuthorized',FALSE),
    jsonb_build_object('scaleDown',jsonb_build_array('use_reviewed_exact_substitution'),
      'scaleUp',jsonb_build_array(),'neverScaleBy',jsonb_build_array('guessing_the_identity')),
    jsonb_build_object('track',jsonb_build_array('identity_review_status'),
      'productionSelectable',FALSE),
    jsonb_build_object('beforeSet',jsonb_build_array('block_selection'),
      'duringSet',jsonb_build_array('no_set_authorized'),
      'afterSet',jsonb_build_array('route_identity_issue_to_content_review'))
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug
    AND variant.variant_key='legacy-ambiguous-composite'
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,seed.profile_key,'movement_intelligence',seed.role,
    seed.purpose,seed.phase_suitability,seed.methodology_alignment,
    jsonb_build_object(
      'coordination',94,'precision',94,'perceptionAction',90,
      'power',8,'conditioning',1,'assessment',seed.assessment_relevance),
    seed.dosage,
    'Count only an attempt using the declared variant setup in which the ball reaches the wall directly, the grounded turn finishes in time, the athlete visually reacquires the rebound, reception stays away from the face, and the attempt ends in control inside clear space.',
    ARRAY[
      'pain_guarding_dizziness_or_disorientation',
      'head_face_hand_shoulder_back_hip_knee_or_ankle_symptom',
      'repeated_face_level_or_rigid_catch','unsafe_or_unpredictable_rebound',
      'ball_or_athlete_enters_occupied_space','wall_floor_ball_line_or_marker_setup_changes',
      'material_throw_turn_tracking_or_catch_quality_loss']::TEXT[],
    'Declare the exact setup and variant. Observe direct wall path, turn timing, visual pickup, catch, boundary, and terminal control; stop and record the first material fault.',
    'Throw directly through your legs to the wall, stand and turn 180 degrees, find the rebound, catch softly with two hands away from your face, control it, and reset.',
    seed.expected_adaptation,
    ARRAY['ball','wall','line_tape']::TEXT[],
    jsonb_build_object(
      'athletesPerStation',1,'stationSpacing','one_clear_throw_rebound_and_miss_lane',
      'coachSightline','side_view_for_throw_and_turn_plus_wall_side_view_for_rebound_and_catch',
      'requiredClearance','three_metre_or_declared_scaled_lane_plus_rebound_and_miss_zone',
      'setupSeconds',180,'transitionSeconds',30,
      'groupRule','no_person_between_athlete_wall_or_in_rebound_and_miss_path',
      'optionalTools',jsonb_build_array('attempt_scoring_sheet','video_capture')),
    '{}'::UUID[],'review',seed.time_model,seed.scaling,
    jsonb_build_object(
      'track',jsonb_build_array(
        'variant','ball_type_diameter_mass_and_bounce','distance','wall_and_marker',
        'turn_direction','attempts','direct_wall_hits','timely_turns',
        'floor_contacts','catches_touches_misses','boundary_exits',
        'rest_seconds','symptoms','faults','stop_reason'),
      'qualityThreshold','Direct wall path, timely controlled turn, early visual pickup, safe reception, clear boundary, and terminal control.',
      'productionSelectable',TRUE),
    jsonb_build_object(
      'beforeSet',jsonb_build_array(
        'confirm_variant_ball_wall_line_marker_lane_recovery_and_stop_signal',
        'confirm_pain_free_hinge_turn_and_predictable_catch_rehearsal'),
      'duringSet',jsonb_build_array(
        'watch_throw_turn_eyes_catch_floor_boundary_and_control',
        'announce_first_material_quality_or_safety_stop','protect_lane_and_full_reset'),
      'afterSet',jsonb_build_array(
        'record_setup_attempt_outcomes_symptoms_faults_and_stop_reason',
        'update_throw_reception_turn_technical_fatigue_and_duration_budgets',
        'keep_standardized_score_and_rehearsal_data_separate'))
  FROM (VALUES
    ('standardized-three-metre-assessment','standardized-ten-attempt-assessment',
      'conditional','Use the documented fixed setup to assess precision coordination; do not use as conditioning or infer norms outside the validated protocol.',92,88,100,
      jsonb_build_object(
        'attempts',10,'sets',1,'repetitionsPerSet',10,
        'restSecondsBetweenAttempts',jsonb_build_array(15,30),
        'restSecondsBetweenSets',0,'intensity','precision_first',
        'ballLoad','specified_light_bouncing_gymnastic_ball',
        'distanceMetres',3,'scoreInterpretation','exact_protocol_only',
        'fullResetBetweenAttempts',TRUE),
      'Reproducible coordination-assessment execution using the documented protocol without implying a training adaptation or universal norm.',
      jsonb_build_object(
        'setupSeconds',180,'attemptSeconds',jsonb_build_array(3,8),
        'restSeconds',jsonb_build_array(15,30),'transitionSeconds',30,
        'estimatedTotalMinutes',jsonb_build_array(6,10),'restIsExplicit',TRUE),
      jsonb_build_object(
        'scaleDown',jsonb_build_array('switch_to_scaled_coordination_rehearsal_without_standardized_scoring'),
        'scaleUp',jsonb_build_array('none_inside_standardized_protocol'),
        'neverScaleBy',jsonb_build_array(
          'changing_ball_distance_wall_marker_sequence_or_scoring_while_retaining_standardized_interpretation',
          'adding_load_speed_or_conditioning_density','continuing_through_symptoms_or_quality_loss'))),
    ('scaled-coordination-rehearsal','scaled-sequence-rehearsal',
      'secondary','Practice the exact throw-turn-reacquire-catch order with a declared non-normative scale and full reset.',84,82,10,
      jsonb_build_object(
        'sets',jsonb_build_array(2,4),'repetitionsPerSet',jsonb_build_array(2,4),
        'restSecondsBetweenRepetitions',jsonb_build_array(15,30),
        'restSecondsBetweenSets',jsonb_build_array(60,90),
        'intensity','precision_first_submaximal','fullResetBetweenAttempts',TRUE,
        'scoreInterpretation','non_normative_rehearsal_only'),
      'Improved sequence familiarity, visual reacquisition, and safe predictable reception without a standardized-score claim.',
      jsonb_build_object(
        'setupSeconds',180,'attemptSeconds',jsonb_build_array(3,8),
        'restSeconds',jsonb_build_array(15,90),'transitionSeconds',30,
        'estimatedTotalMinutes',jsonb_build_array(5,16),'restIsExplicit',TRUE),
      jsonb_build_object(
        'scaleDown',jsonb_build_array(
          'use_larger_or_lighter_predictable_ball','shorten_declared_distance',
          'slow_the_turn','rehearse_throw_turn_and_catch_components_separately',
          'add_visual_arrows','increase_reset'),
        'scaleUp',jsonb_build_array(
          'restore_exact_sequence_timing','progress_toward_standardized_ball_and_distance_after_review'),
        'neverScaleBy',jsonb_build_array(
          'adding_medicine_or_slam_ball_load','adding_jump_or_reactive_choice',
          'turning_rehearsal_into_conditioning','interpreting_rehearsal_as_standardized_score',
          'continuing_through_symptoms_or_quality_loss'))))
    seed(variant_key,profile_key,role,purpose,phase_suitability,
      methodology_alignment,assessment_relevance,dosage,expected_adaptation,
      time_model,scaling)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=exact_definition_id AND definition.facility_id=1
      AND definition.slug=exact_slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key AND variant.status<>'archived'
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  CREATE TEMP TABLE family_packet_seed(
    packet_slug TEXT PRIMARY KEY,research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('180-turn-wall-ball-catch-and-throw','2026-07-25.22',$packet${"assessmentSummary":{"identity":"An internally ambiguous turn, receive, and wall-ball-throw composite. The current instructions make the catch optional, do not define whether wall ball means a squat-to-overhead wall-ball shot or a medicine-ball wall throw, and do not specify the throw pattern. It cannot be made production-ready without choosing one exact sequence and implement.","currentCardFindings":["Receive or pick up contradicts Catch-and-Throw because picking up removes the reception task.","Wall ball can name an implement, a target exercise, or a squat-to-overhead shot; the card does not distinguish them.","The start-facing-away cue does not identify who delivers the ball, where the athlete turns, the catch height, whether the athlete must stabilize before throwing, or where misses travel.","A Karlsruhe Institute of Technology protocol documents a different coherent sequence: throw a ball backward to a wall, turn 180 degrees, then catch the rebound. That sequence must not be silently substituted for this catch-then-throw title.","No exact full-sequence video was located; selected links are explicitly adjacent turn/throw or turn/catch candidates."],"proposedTaxonomy":{"movementPatterns":["reactive_180_ground_turn","two_hand_ball_reception","medicine_ball_throw"],"jointActions":["foot_pivot_or_step_turn","whole_body_reorientation","catch_deceleration","specified_throw_pattern"],"planes":["transverse_reorientation","throw_vector_must_be_selected"],"laterality":"turn_direction_recorded_bilateral_catch","intent":"perception_action_reorientation_catch_control_and_accurate_throw","identityRequirement":"select_exact_ball_implement_delivery_source_catch_rule_throw_pattern_target_and_terminal_outcome_before_publication"},"proposedAnatomy":{"primaryMuscles":["gluteals","quadriceps","calves","obliques","pectoralis_major_or_deltoid_by_throw_pattern","triceps"],"secondaryMuscles":["hamstrings","adductors","hip_rotators","rotator_cuff","serratus_anterior","forearm_and_hand_muscles","spinal_stabilizers"],"joints":["ankle","knee","hip","pelvis","thoracic_spine","shoulder","elbow","wrist","hand"],"primaryActions":["grounded_half_turn","visual_reorientation","ball_deceleration","whole_body_throw"]},"proposedDifficulty":{"technicalComplexity":70,"absoluteLoadDemand":48,"coordinationDemand":78,"supervisionDemand":82,"failureConsequence":76,"impact":28,"workCapacityDemand":38,"baseOverallDifficulty":70},"proposedLoadProfile":{"loadingType":"light_to_moderate_implement_reception_and_ballistic_throw","impactClass":"low_lower_body_with_moderate_ball_collision_risk","externalLoadMethod":"medicine_ball_mass_and_rebound_behavior_must_be_recorded","primaryStress":["rapid_reorientation","hand_and_upper_body_catch_deceleration","trunk_force_transfer","ballistic_throw"],"fatigueProfile":["late_visual_pickup","rigid_or_face_level_catch","dropped_ball","poor_target_accuracy","trunk_overrotation","throw_pattern_drift"],"recoveryHours":"minimal_to_48_based_on_ball_mass_throw_intent_repetition_count_and_overlapping_throwing_load"},"proposedConstraints":{"requiredEquipment":["specified_soft_or_medicine_ball","specified_delivery_partner_or_reinforced_wall","clear_target","marked_safety_zone"],"optionalEquipment":["visual_or_audio_cue","video_capture","non_rebound_slam_ball_for_a_different_variant"],"environment":["wall_rated_for_ball_impact_if_used","non_slip_floor","clear_miss_and_rebound_zone","no_people_between_thrower_target_or_delivery_source"],"population":["can_turn_without_dizziness","can_receive_the_selected_ball_safely","can_execute_the_selected_throw_pattern_pain_free","understands_miss_and_stop_rules"]},"proposedDosage":{"setsAndReps":"2-4_sets_of_2-5_repetitions_per_turn_direction","restSeconds":"30-90_between_sets_or_longer_for_high_intent_throws","ballLoad":"light_enough_for_consistent_two_hand_reception_and_accuracy_before_velocity_or_mass_is_increased","intensity":"moderate_for_coordination_or_high_intent_only_after_sequence_and_miss_management_are_owned","measurement":"turn_direction_delivery_quality_clean_catches_target_hits_throw_pattern_ball_mass_and_misses","progressWhen":"the_athlete_reorients_early_catches_away_from_the_face_controls_the_ball_and_hits_the_target_without_rushing"},"proposedInstructions":{"coachCues":["Turn and find the ball","Show soft hands","Control before you throw","Use the named throw","Finish inside your lane"],"athleteInstructions":["Start in the marked stance facing away from the delivery point","Turn in the assigned direction on the cue","Find and catch the ball with two hands at the assigned height","Stabilize according to the card rule","Use the specified throw to the marked target and reset only when the ball is controlled"],"commonFaults":["catch_is_replaced_by_pickup","unknown_ball_or_throw","late_head_and_eye_turn","face_level_catch","rigid_elbows","traveling_out_of_lane","low_back_rotation","uncontrolled_rebound","throw_before_control"]},"proposedSafety":{"readiness":["pain_free_grounded_turn_both_directions","two_hand_catch_with_selected_ball","specified_throw_pattern","understands_wall_partner_and_miss_zones"],"qualityGates":["ball_source_and_target_are_unambiguous","athlete_finds_ball_before_reception","catch_is_away_from_face","feet_and_trunk_are_controlled","throw_uses_named_pattern","misses_remain_in_clear_zone"],"stopRules":["head_face_hand_shoulder_back_hip_knee_or_ankle_pain","dizziness","repeated_dropped_or_face_level_catch","unsafe_partner_delivery","uncontrolled_wall_rebound","miss_enters_occupied_space","throw_pattern_or_accuracy_breaks_down"]},"proposedContextualProfiles":[{"context":"movement_intelligence_reorientation_and_catch","dose":"2-3_sets_of_2-4_low_velocity_repetitions_per_turn_direction","purpose":"learn_early_visual_pickup_safe_reception_and_sequence_control"},{"context":"output_turn_catch_and_throw","dose":"2-4_sets_of_2-3_high_quality_repetitions_per_direction_with_full_ball_retrieval_and_recovery","purpose":"link_reorientation_and_safe_reception_to_a_named_high_intent_throw"}],"proposedRelationships":{"regressions":["turn_find_and_catch_without_throw","prepositioned_ball_180_turn_and_named_throw","quarter_turn_catch_and_throw"],"progressions":["faster_partner_delivery","unpredictable_turn_direction","high_intent_throw_after_clean_catch"],"substitutions":["180_turn_medicine_ball_throw_without_catch","catch_and_named_wall_throw_without_turn"],"doNotSubstitute":["behind_the_legs_wall_throw_180_turn_and_catch","wall_ball_squat_to_overhead_shot_unless_that_pattern_is_explicit","180_catch_slam"]},"proposedSupport":{"athlete":["sequence_diagram","ball_source_and_target_icons","catch_window_overlay","named_throw_animation","miss_zone_and_stop_signal"],"coach":["partner_delivery_script","wall_and_rebound_check","ball_mass_and_bounce_log","turn_catch_throw_quality_checklist","lane_and_group_spacing_layout"]},"calibrationEvidence":{"basis":"documented 180-degree wall throw-and-catch protocol, catching-perception research, medicine-ball throw research, legacy-card comparison, and component-video discovery","uncertainty":"The legacy card does not reveal the intended implement, delivery source, catch requirement, wall-ball pattern, or throw vector. Scores and dose are provisional for a light medicine-ball catch followed by one specified throw.","reviewNeeded":["identity_and_naming_adjudication","wall_ball_versus_medicine_ball_implement_review","throw_pattern_selection","facility_risk_review","difficulty_anchor_comparison","full_video_review"]},"programmingDecision":"Do not publish the current composite. Require a content decision among a true turn-catch-named-throw card, a turn-and-throw card without catch, a wall-ball shot after turn, or the documented throw-turn-catch sequence. Create separate definitions when the order, reception requirement, throw pattern, or terminal outcome changes; never let receive or pick up remain interchangeable.","currentCardSnapshot":{"capturedAt":"2026-07-26T04:00:00.000Z","cardVersion":1,"status":"review","description":"Start facing away, turn on cue, receive or pick up the ball, square to the wall, and perform one accurate wall-ball throw.","familyKey":"Turn and throw coordination","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The Karlsruhe protocol defines a coherent but different order: throw a ball backward to a wall, turn 180 degrees, and catch the rebound.","The current catch-then-throw title and receive-or-pick-up instruction cannot be treated as that protocol or as one stable identity; order, catch requirement, implement, throw, and target require adjudication."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented task separates throwing, body rotation, and catching as three scored sub-elements.","Classify 180-Turn Wall Ball Catch-and-Throw by sequence order, grounded versus jumping turn, cue, delivery source, ball type and mass, catch height and requirement, throw pattern and vector, target, rebound, and terminal outcome."]},{"sectionKey":"anatomy","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/19826303/","sourceTitle":"Analysis of trunk muscle activity in the side medicine-ball throw","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":80,"claims":["Medicine-ball side throwing recruits trunk musculature as part of a whole-body ballistic action.","Represent lower-body turning, trunk force transfer, shoulder and scapular control, elbow extension, grip and reception demands according to the chosen throw rather than using generic core labels."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance depends on available visual information and ball-flight constraints.","The athlete must reorient head and eyes early enough to locate the ball, decelerate it with a safe two-hand catch, control posture, and only then execute the named throw."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Reducing advance visual information changes perception-action demands during catching.","Assess technical complexity and physical load directly and separately score coordination, supervision, failure consequence, impact, work capacity, and overall difficulty; an athlete level is not an exercise-card field."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/22744301/","sourceTitle":"Reliability of seated and standing throwing velocity using differently weighted medicine balls","sourcePublisher":"Journal of Strength and Conditioning Research","sourceKind":"peer_reviewed_research","evidenceQuality":81,"claims":["Medicine-ball mass changes throwing velocity and must be specified when comparing or prescribing throws.","Track ball type, mass, bounce, delivery speed, catch count, throw count, target accuracy, side, symptoms, and overlap with other throwing volume."]},{"sectionKey":"constraints","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented task specifies a wall, ball, marked line, target, fixed distance, and error criteria.","Any retained card must specify its own rated wall or partner, ball, delivery path, target, distance, turn and catch zone, and a clear area for misses and rebounds."]},{"sectionKey":"dosage","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/37833510/","sourceTitle":"Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis","sourcePublisher":"Sports Medicine - Open","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Upper-body plyometric interventions vary in exercise, load, repetition volume, and population.","Use low repetitions and a ball light enough for safe reception and accurate throwing; the proposed dose is a conservative programming inference, not a universal evidence-based prescription for this composite."]},{"sectionKey":"instructions","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented protocol gives an exact start orientation, wall relationship, throw path, turn, catch requirement, and trial count.","The Vortex card needs equal precision but must use its chosen catch-then-throw order: cue, turn, ball source, catch window, stabilization rule, named throw, target, reset, and valid repetition."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Training should use appropriate loads, qualified supervision, safe equipment, and progressive instruction.","Stop for pain, dizziness, unsafe delivery, face-level catches, repeated drops, uncontrolled rebounds, occupied miss zones, loss of posture, or inability to use the selected throw accurately."]},{"sectionKey":"programming","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching is a perception-action task whose demand changes with visual and flight information.","Use the card for a defined reorientation and reception objective before adding throw velocity; do not treat it as generic wall-ball conditioning."]},{"sectionKey":"athlete_support","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented test identifies its three sub-elements and common errors.","Athlete support must show sequence order, ball source, turn arrow, catch window, target, safe miss zone, one successful rep, and the stop signal."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Ball-flight and advance visual information are controllable task constraints.","Coach support should prescribe delivery speed and predictability, ball mass and bounce, turn side, catch quality, named throw, partner communication, wall safety, and group spacing."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Tasks should be progressed according to demonstrated technique and capacity.","Scale with a lighter or larger soft ball, visible predictable delivery, quarter turn, slower cue, catch-only or prepositioned-ball throw component, lower target, extra reset, and visual plus verbal instruction."]},{"sectionKey":"alternates","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["Changing the order of throw, rotation, and catch changes the defined task and scoring.","Turn-and-throw, turn-and-catch, throw-turn-catch, catch-and-slam, and squat-to-overhead wall-ball shot sequences require separate identity or variant decisions; picking up a ball cannot satisfy a required catch."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The selected links are adjacent turn/throw or turn/catch demonstrations, not an asserted exact match for the unresolved current sequence. Full viewing, captions, safety, quality, reviewer identity, and approval remain pending."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=uD-ERQqcz_Y","title":"180° Turn & Throw w/ Med Ball","channelName":"EDGE Athletics","sourceQuery":"180 turn catch medicine ball wall throw","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Direct turn-and-throw candidate without a confirmed preceding catch. It is adjacent evidence only until the card identity is adjudicated and the full video is reviewed."},{"url":"https://www.youtube.com/watch?v=wu_P9YoNLPk","title":"Med Ball 180 Turn Shot Put Throws","channelName":"Travis Osborne","sourceQuery":"180 turn medicine ball wall throw","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Shot-put throw variant candidate. The throw vector and absence or presence of a catch must be reviewed; no exact match is claimed."},{"url":"https://www.youtube.com/watch?v=sMICxHYRlcQ","title":"180 Jump to Med Ball Catch w/ Partner","channelName":"Orenda Force","sourceQuery":"180 catch medicine ball throw","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Turn-and-catch component with a jumping rather than grounded turn and no confirmed subsequent wall throw. It is included to adjudicate sequence and laterality, not for approval."},{"url":"https://www.youtube.com/watch?v=jiTo7KfXKYc","title":"180 Catch Slam [Slam Ball Exercise]","channelName":"Baxter Basics Group Personal Training","sourceQuery":"180 turn catch ball drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Catch-to-slam alternate with a different terminal throw. It must remain classified as an adjacent identity unless human review determines otherwise."},{"url":"https://www.youtube.com/watch?v=p4NlK0bCr_I","title":"Rapid Fire Rotational Med Ball Drill - Do With A Partner or Wall!","channelName":"Catching Made Simple (Coach Bougie)","sourceQuery":"180 turn catch medicine ball wall throw","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Rotational catch-and-release component for partner or wall use. The turn angle, sequence, and delivery may differ from the unresolved card."}],"alternateAssessments":[{"name":"180-Turn Medicine-Ball Catch and Chest Pass","classification":"new_definition","rationale":"A required partner-delivered two-hand catch followed by a named two-hand chest pass creates a coherent reception-to-throw identity and removes wall-ball ambiguity.","distinguishingDimensions":{"catch":"required_two_hand","throwPattern":"two_hand_chest_pass","implement":"medicine_ball"}},{"name":"180-Turn Medicine-Ball Throw","classification":"new_definition","rationale":"Turning to a prepositioned or held ball and performing a named throw removes the perception and reception task and should not retain Catch-and-Throw in its identity.","distinguishingDimensions":{"catch":"none","ballStart":"held_or_prepositioned","throwPattern":"must_be_named"}},{"name":"Behind-the-Legs Wall Throw, 180 Turn and Catch","classification":"new_definition","rationale":"The documented sequence is throw first, turn second, catch third; order, throw path, rebound, and terminal outcome differ from catch then throw.","distinguishingDimensions":{"sequence":"throw_turn_catch","rebound":"required_wall_return","terminalOutcome":"catch"}},{"name":"180 Catch Slam","classification":"new_definition","rationale":"A required slam has a downward terminal force vector, non-rebound implement constraints, and different spacing and reception rules from a wall throw.","distinguishingDimensions":{"terminalThrow":"downward_slam","target":"floor","implement":"non_rebound_slam_ball"}},{"name":"Reactive Turn Direction","classification":"new_variant","rationale":"An unpredictable left or right cue increases perception and decision demand while preserving an adjudicated base catch-and-throw sequence.","distinguishingDimensions":{"cue":"unpredictable_left_or_right","decisionDemand":"added"}}]}$packet$::JSONB),
    ('through-legs-wall-throw-180-turn-catch','2026-08-01.2',$packet${"assessmentSummary":{"identity":"A fixed-order coordination task: from behind a marked line with the back to a smooth wall, throw a specified light gymnastic ball directly through straddled legs to the wall, stand and turn 180 degrees toward the wall, then visually reacquire and catch the rebound with two hands before it touches the floor. Throw, turn, and catch are all identity-bearing; this is not the legacy catch-then-throw composite.","currentCardFindings":["This exact definition is newly authored because the legacy 180-Turn Wall Ball Catch-and-Throw reverses the order, makes catching optional, and does not name the ball or throw.","The Karlsruhe Institute of Technology source specifies a gymnastic ball, a smooth wall, a 3 m drop line, a visual wall marker, ten attempts, and separate scoring for throwing, turning, and catching.","The source is a coordination assessment for children; it does not establish a medicine-ball power exercise, a wall-ball squat-to-overhead shot, a universal training dose, or suitability for every population.","No exact full-sequence YouTube demonstration was located. All three video records are adjacent-component discovery candidates and remain non-embeddable until full human review."],"proposedTaxonomy":{"movementPatterns":["through_legs_two_hand_ball_throw","grounded_180_reorientation","two_hand_rebound_catch"],"jointActions":["hip_hinge_and_straddle","two_hand_underhand_release","hip_knee_extension","foot_pivot_or_step_turn","visual_reacquisition","two_hand_catch_deceleration"],"planes":["sagittal_throw_and_recovery","transverse_reorientation","frontal_postural_control"],"laterality":"bilateral_throw_and_catch_with_turn_direction_recorded","sequence":"throw_to_wall__stand_and_turn_180__reacquire__two_hand_catch","intent":"precision_coordination_assessment_not_ballistic_power_or_conditioning"},"proposedAnatomy":{"primaryMuscles":["gluteals","quadriceps","hamstrings","calves","abdominal_wall","posterior_deltoid","triceps","forearm_and_hand_muscles"],"secondaryMuscles":["adductors","hip_rotators","spinal_stabilizers","rotator_cuff","scapular_stabilizers"],"joints":["foot","ankle","knee","hip","pelvis","spine","shoulder","elbow","wrist","hand"],"primaryActions":["hinge_and_underhand_throw","rapid_whole_body_reorientation","visual_tracking","rebound_catch_deceleration"]},"proposedDifficulty":{"technicalComplexity":68,"absoluteLoadDemand":30,"coordinationDemand":82,"supervisionDemand":72,"failureConsequence":58,"impact":16,"workCapacityDemand":24,"baseOverallDifficulty":68},"variantDifficultyCandidates":[{"variantKey":"standardized-three-metre-assessment","technicalComplexity":68,"absoluteLoadDemand":30,"baseOverallDifficulty":68,"identityQuarantine":false},{"variantKey":"scaled-coordination-rehearsal","technicalComplexity":58,"absoluteLoadDemand":22,"baseOverallDifficulty":58,"identityQuarantine":false}],"proposedLoadProfile":{"loadingType":"light_ball_throw_turn_and_rebound_reception","impactClass":"low_body_impact_with_ball_rebound_collision_risk","externalLoadMethod":"record_ball_type_diameter_mass_bounce_and_wall_distance","primaryStress":["hinge_and_recovery","rapid_reorientation","visual_tracking","hand_and_upper_body_rebound_deceleration"],"fatigueProfile":["slower_turn","late_visual_pickup","rigid_or_face_level_catch","missed_wall","ball_contacts_floor","leaving_marked_area"],"recoveryHours":"minimal_to_24_for_low_volume_light_ball_exposure_subject_to_symptoms_total_throwing_and_individual_response"},"proposedConstraints":{"requiredEquipment":["specified_light_bouncing_gymnastic_ball","smooth_clear_wall","three_metre_drop_line_for_standardized_variant","visual_wall_marker","clear_rebound_and_miss_zone"],"optionalEquipment":["attempt_scoring_sheet","video_capture","additional_floor_boundary_markers"],"environment":["non_slip_level_floor","wall_clear_and_smooth_to_at_least_three_metres_for_standardized_variant","no_people_in_throw_rebound_or_miss_path","adequate_light_for_ball_tracking"],"population":["can_hinge_straddle_stand_and_turn_without_pain_or_dizziness","can_track_and_receive_selected_ball_with_two_hands","understands_throw_turn_catch_order_and_stop_signal","standardized_scores_used_only_for_the_validated_population_and_protocol"]},"proposedDosage":{"assessment":"ten_scored_attempts_after_instruction_and_allowed_familiarization_using_the_exact_standardized_setup","rehearsal":"two_to_four_sets_of_two_to_four_full_reset_repetitions_with_a_larger_or_lighter_predictable_ball_and_reduced_distance_as_needed","restSeconds":"fifteen_to_thirty_between_attempts_and_sixty_to_ninety_between_rehearsal_sets_or_longer_if_tracking_turn_or_catch_quality_declines","intensity":"precision_first_and_never_conditioning","measurement":"ball_wall_contact_turn_timing_floor_contact_catch_or_touch_location_boundary_exit_symptoms_and_exact_ball_setup","progressWhen":"the_throw_hits_the_wall_directly_the_turn_finishes_in_time_the_ball_is_found_early_and_two_hand_catches_stay_away_from_the_face"},"proposedInstructions":{"coachCues":["Look through your legs and hit the wall","Stand and turn as soon as the ball leaves","Find the rebound early","Soft two-hand catch away from your face","Stay inside the marked area"],"athleteInstructions":["Stand behind the assigned line with your back to the wall and the named ball in both hands","Straddle and look through your legs, then throw the ball directly to the wall without a floor bounce","Stand and turn one half rotation toward the wall immediately","Find the returning ball and catch it with two hands before it touches the floor","Control the ball, stop, and wait for the next attempt"],"commonFaults":["ball_hits_floor_before_wall","late_or_incomplete_turn","eyes_close_or_look_away","rigid_hands_or_excess_body_motion","face_level_catch","leaving_marked_area","continuing_without_full_reset"]},"proposedSafety":{"readiness":["pain_free_hinge_stand_and_grounded_turn","predictable_two_hand_catch_with_selected_ball","clear_wall_rebound_and_miss_zone","understands_no_chasing_into_occupied_space"],"qualityGates":["exact_ball_wall_line_and_marker_are_declared","throw_reaches_wall_directly","turn_is_grounded_and_controlled","eyes_reacquire_ball_before_reception","catch_stays_away_from_face","attempt_ends_in_control_inside_clear_space"],"stopRules":["pain_or_guarding","dizziness_or_disorientation","head_face_hand_shoulder_back_hip_knee_or_ankle_symptom","repeated_face_level_or_rigid_catch","unsafe_or_unpredictable_rebound","ball_or_athlete_enters_occupied_space","wall_floor_ball_or_marker_setup_changes","tracking_turn_or_catch_quality_materially_declines"]},"proposedContextualProfiles":[{"context":"movement_intelligence_standardized_coordination_assessment","dose":"ten_scored_attempts_with_exact_setup_and_full_recording","purpose":"assess_precision_coordination_using_the_documented_protocol"},{"context":"movement_intelligence_scaled_sequence_rehearsal","dose":"two_to_four_sets_of_two_to_four_full_reset_repetitions","purpose":"practice_throw_turn_visual_reacquisition_and_safe_two_hand_reception_without_interpreting_scores_as_standardized"}],"proposedRelationships":{"regressions":["scaled_coordination_rehearsal","turn_find_and_catch_without_throw","through_legs_wall_throw_without_turn_or_catch"],"progressions":["standardized_three_metre_assessment_after_exact_setup_and_familiarization"],"substitutions":["none_for_standardized_score_unless_the_same_validated_protocol_is_preserved"],"doNotSubstitute":["catch_then_wall_throw","medicine_ball_power_throw","wall_ball_squat_to_overhead_shot","180_catch_slam","jumping_180_catch"]},"proposedSupport":{"athlete":["four_frame_sequence_diagram","three_metre_line_and_wall_marker_layout","turn_direction_arrow","safe_catch_window","stop_signal"],"coach":["setup_measurement_checklist","attempt_scoring_sheet","side_view_for_throw_and_turn","wall_side_view_for_rebound_and_catch","miss_zone_and_group_spacing_layout"]},"calibrationEvidence":{"basis":"the exact Karlsruhe protocol, ball-catching perception-action research, youth supervision guidance, and explicit comparison with adjacent Vortex identities","uncertainty":"The source specifies a child coordination assessment but does not provide a universal training dose, adult normative interpretation, ball mass range, or exact YouTube demonstration. Scores and the rehearsal profile remain review-only proposals.","reviewNeeded":["translation_and_protocol_review","ball_specification_and_facility_risk_review","difficulty_anchor_comparison","population_and_normative_use_review","full_video_review"]},"programmingDecision":"Create a separate exact review-only definition. Permit the standardized variant only in an explicit assessment context using the documented setup; permit the scaled rehearsal only as non-normative sequence practice. Never alias or substitute the reversed legacy catch-then-throw composite, a medicine-ball power throw, a wall-ball shot, a slam, or a jumping turn-catch.","currentCardSnapshot":{"capturedAt":"2026-08-01T16:00:00.000Z","cardVersion":1,"status":"review","description":"From behind the assigned line with the back to a clear smooth wall, look through straddled legs and throw the specified light gymnastic ball directly to the wall. Stand and turn 180 degrees toward the wall, visually reacquire the rebound, catch it with two hands before it touches the floor, control the ball, and reset.","familyKey":"throw_turn_catch_coordination","movementPatterns":["hinge","throw","rotate","catch"],"bodyRegions":["hand","wrist","elbow","shoulder","spine","core","pelvis","hip","hamstrings","knee","calf","ankle","foot","eye_hand","full_body"],"requiredEquipment":["ball","wall","line_tape"],"optionalEquipment":["cones"],"environment":{"lane":"clear_throw_rebound_and_miss_zone_with_no_cross_traffic","line":"measured_three_metre_drop_line_for_standardized_variant","wall":"smooth_clear_wall_to_at_least_three_metres_for_standardized_variant","target":"DIN_A4_visual_marker_centered_at_120_cm_for_standardized_variant","surface":"level_non_slip_clear_floor","lighting":"adequate_for_early_ball_reacquisition"},"population":{"constraints":["standardized_scores_only_for_exact_validated_population_and_protocol","medicine_slam_or_stability_ball_not_assumed","rehearsal_changes_are_non_normative"],"readinessChecks":["pain_free_hinge_stand_and_grounded_turn","no_turn_provoked_dizziness","predictable_two_hand_catch_with_selected_ball","understands_throw_turn_catch_order_and_stop_signal"],"selectionStatus":"candidate_requires_human_review","contraindications":["pain_dizziness_or_guarding","unsafe_wall_floor_ball_or_lane","cannot_track_or_receive_selected_ball_safely"],"programmingEligibility":"explicit_coordination_assessment_or_non_normative_rehearsal_only"},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented task order is a direct through-the-legs throw to the wall, rapid 180-degree turn toward the wall, then rebound catch or touch.","Through-the-Legs Wall Throw, 180° Turn and Catch is a new exact throw-turn-catch identity and cannot replace the legacy catch-then-throw composite."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The protocol explicitly scores three sub-elements: throw, body rotation, and catch.","Classify the task by fixed sequence, through-the-legs throw, grounded 180-degree turn, wall rebound, two-hand catch, ball specification, distance, and terminal control."]},{"sectionKey":"anatomy","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented sequence combines a straddled hinge and throw, rapid standing reorientation, and two-hand rebound reception.","Represent lower-body recovery and turn, trunk control, shoulder and elbow throw actions, and hand and upper-body catch deceleration without treating this light-ball task as a medicine-ball power throw."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Catching performance changes with advance visual information and ball-flight constraints.","The athlete must finish the turn, visually reacquire the rebound, orient toward the wall and ball, and receive with adaptable hands rather than a rigid face-level catch."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Reduced advance visual information raises the perception-action demand of catching even when external load is light.","Score complexity and physical difficulty separately: the proposed overall score is driven by sequence and tracking complexity, not athlete proficiency or heavy load."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The source uses a gymnastic ball and ten attempts; it does not prescribe a medicine ball or conditioning density.","Record exact ball properties, attempts, misses, floor contacts, catch outcomes, symptoms, and overlapping throwing volume; stop before tracking or reception degrades."]},{"sectionKey":"constraints","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The standardized setup uses a gymnastic ball, smooth wall, 3 m line, floor tape, visual wall marker, and scoring sheet.","Require a clear non-slip throw and rebound lane with no person in the ball path and distinguish any scaled rehearsal from the standardized setup."]},{"sectionKey":"dosage","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The documented assessment uses ten attempts and awards execution-dependent points.","Ten attempts apply only to the exact assessment. The lower-volume rehearsal dose is a conservative programming proposal and must not be interpreted with standardized scores."]},{"sectionKey":"instructions","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The source specifies looking through the legs, hitting the wall directly before any floor contact, turning quickly, catching with two hands, and remaining in place.","Instructions must preserve this order and distinguish successful catch, touch, floor contact, boundary exit, and failed direct wall throw."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Youth training should use qualified supervision, safe equipment, appropriate progression, and technically sound execution.","Stop for pain, dizziness, face-level or rigid reception, unsafe rebound, occupied miss space, setup drift, or material loss of throw, turn, tracking, or catch control."]},{"sectionKey":"programming","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The task objective is coordination performance in a precision task, not power or conditioning.","Select the standardized profile only when an explicit coordination assessment is required; use the rehearsal profile only for non-normative sequence practice."]},{"sectionKey":"athlete_support","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The protocol names the start orientation, line, wall target, throw path, turn, catch objective, attempt count, and common errors.","Athlete support should show the four-frame sequence, layout, direct wall path, turn arrow, safe catch window, valid finish, and stop signal."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/23435115/","sourceTitle":"Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching","sourcePublisher":"Acta Psychologica","sourceKind":"peer_reviewed_research","evidenceQuality":84,"claims":["Ball-flight and visual-information constraints materially affect catching behavior.","Coach support must control ball, distance, wall, marker, lighting, turn direction, observation angle, scoring, miss management, full reset, and whether the attempt is standardized or rehearsal."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["Exercise progression should match demonstrated technique and current capacity under qualified supervision.","For non-normative rehearsal only, scale with a larger or lighter predictable ball, shorter distance, slower turn, isolated components, visible arrows, demonstration, and extra reset time."]},{"sectionKey":"alternates","sourceUrl":"https://www.ifss.kit.edu/more/english/245.php","sourceTitle":"Throw and Catch (T&C)","sourcePublisher":"Karlsruhe Institute of Technology","sourceKind":"professional_standard","evidenceQuality":78,"claims":["The exact protocol depends on its throw-turn-catch order, wall rebound, turn timing, and catch outcome.","Catch-then-throw, held-ball turn-and-throw, wall-ball shot, medicine-ball power throw, catch-and-slam, jumping turn-catch, and changed scoring protocols are separate identities or variants."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embed URLs.","The three selected links are adjacent component candidates only. Availability, embedding, exact full sequence, ball and setup match, complete viewing, safety, captions, reviewer identity, and approval remain unverified human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=uD-ERQqcz_Y","title":"180° Turn & Throw w/ Med Ball","channelName":"EDGE Athletics","sourceQuery":"throw through legs wall 180 turn catch ball","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Adjacent turn-and-throw component using a different likely implement and reversed terminal action. It is not an exact match and cannot be embedded or approved without full human review."},{"url":"https://www.youtube.com/watch?v=sMICxHYRlcQ","title":"180 Jump to Med Ball Catch w/ Partner","channelName":"Orenda Force","sourceQuery":"180 turn catch ball drill","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Adjacent turn-and-catch component with a jump, partner delivery, and no through-the-legs wall throw. It is not an exact match."},{"url":"https://www.youtube.com/watch?v=p4NlK0bCr_I","title":"Rapid Fire Rotational Med Ball Drill - Do With A Partner or Wall!","channelName":"Catching Made Simple (Coach Bougie)","sourceQuery":"wall rebound turn catch ball coordination","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Adjacent rotational catch-and-release component. Turn angle, order, ball, distance, wall path, and terminal catch differ or remain unknown; no exact-match claim is made."}],"alternateAssessments":[{"name":"Scaled Through-the-Legs Wall Throw, Turn and Catch Rehearsal","classification":"new_variant","rationale":"A lighter or larger ball, shorter distance, or slower turn preserves the sequence for practice but invalidates standardized scoring and must be labeled as rehearsal.","distinguishingDimensions":{"protocol":"non_standardized_rehearsal","ballDistanceOrSpeed":"scaled"}},{"name":"180-Turn Medicine-Ball Catch and Chest Pass","classification":"new_definition","rationale":"Partner delivery, catch-first order, medicine-ball load, and a chest-pass terminal action define a different task.","distinguishingDimensions":{"sequence":"turn_catch_throw","implement":"medicine_ball","terminalAction":"chest_pass"}},{"name":"180-Turn Prepositioned-Ball Wall Throw","classification":"new_definition","rationale":"Removing the rebound catch and starting with a held or prepositioned ball eliminates the perception-action reception task.","distinguishingDimensions":{"sequence":"turn_throw","catch":"none"}},{"name":"180 Catch Slam","classification":"new_definition","rationale":"A partner-delivered catch followed by a downward slam changes order, load, terminal force vector, equipment, and miss zone.","distinguishingDimensions":{"sequence":"turn_catch_slam","target":"floor","implement":"non_rebound_slam_ball"}},{"name":"Jumping 180 Turn and Catch","classification":"new_definition","rationale":"An aerial turn adds takeoff, landing, impact, and failure consequences and removes the exact grounded reorientation contract.","distinguishingDimensions":{"turn":"aerial","impact":"landing"}},{"name":"Reactive Left-or-Right Turn Direction","classification":"new_variant","rationale":"An unpredictable turn-direction cue adds a choice requirement while retaining the physical sequence, but it is not part of the standardized protocol.","distinguishingDimensions":{"cue":"unpredictable_turn_direction","protocol":"non_standardized"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  WITH packet_evidence AS(
    SELECT packet.packet_slug,evidence.item->>'sectionKey' section_key,
      evidence.item->>'sourceUrl' source_url,
      evidence.item->>'sourceTitle' source_title,
      evidence.item->>'sourcePublisher' source_publisher,
      evidence.item->>'sourceKind' source_kind,
      (evidence.item->>'evidenceQuality')::SMALLINT evidence_quality,
      to_jsonb(ARRAY(SELECT jsonb_array_elements_text(
        evidence.item->'claims'))) claims_json
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.section_key,
    evidence.source_url,evidence.source_title,evidence.source_publisher,
    evidence.source_kind,evidence.claims_json,evidence.evidence_quality,
    'candidate',NULL,NULL
  FROM packet_evidence evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=evidence.packet_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.packet_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='unverified',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,
    reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    coalesce(alternate.item->'distinguishingDimensions','{}'::JSONB),
    NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.packet_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (standard_variant_id,rehearsal_variant_id,'regression',88,
      ARRAY['load','range','speed','complexity','stability'],
      'The scaled rehearsal preserves throw-turn-reacquire-catch order while reducing ball, distance, or speed demand and explicitly removes standardized score interpretation.',
      jsonb_build_object('useWhen',jsonb_build_array(
        'exact_standardized_setup_or_sequence_is_not_yet_owned',
        'familiarization_or_safe_component_rehearsal_is_required'),
        'humanReviewRequired',TRUE),'review',NULL,NULL,NULL),
    (rehearsal_variant_id,standard_variant_id,'progression',88,
      ARRAY['load','range','speed','complexity','stability'],
      'Progression restores the exact documented ball, 3 m line, wall marker, timing, ten-attempt protocol, and scoring only after safe repeatable rehearsal and human protocol review.',
      jsonb_build_object('requires',jsonb_build_array(
        'repeatable_direct_wall_throw','controlled_grounded_turn',
        'early_visual_reacquisition','safe_two_hand_catch',
        'exact_standardized_setup_and_authorized_assessment_context'),
        'humanReviewRequired',TRUE),'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=30
      THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=50
      THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END)<=70
      THEN 60 ELSE 80 END,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      CASE WHEN definition.slug=legacy_slug THEN
        'Provisional complexity envelope reflects the unresolved turn, reception or pickup, stabilization, named-throw, target, rebound, miss, and reset decisions; it is not a prescribable identity anchor.'
      ELSE
        'Candidate complexity anchor reflects the fixed through-legs throw, immediate grounded half-turn, visual reacquisition, wall rebound, two-hand reception, boundary, terminal control, supervision, and failure consequence.' END
      ELSE CASE WHEN definition.slug=legacy_slug THEN
        'Provisional physical-demand envelope reflects an unknown ball, delivery, catch or pickup, throw intent, target, rebound, and volume; identity review must precede calibration approval.'
      ELSE
        'Candidate physical-difficulty anchor reflects a light specified ball, hinge and recovery, rapid turn, rebound reception, attempt count, low body impact, and full-reset precision dose rather than athlete proficiency.' END END,
    'review',1,NULL,NULL,
    'Candidate migration-423 anchor; independent human review required.',NULL
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  WHERE definition.facility_id=1 AND definition.slug=ANY(target_slugs)
    AND variant.status<>'archived'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,legacy_scores,migration_confidence,human_review_status,
    review_notes)
  VALUES(1284,jsonb_build_object(
      'migration',migration_key,'candidateOnly',TRUE,
      'identityQuarantine',TRUE,'humanReviewRequired',TRUE),45,'queued',
    'Provisional difficulty envelope only. Legacy source 1284 remains non-prescribable until sequence, ball, delivery, catch, throw, target, rebound, miss, and reset are adjudicated.')
  ON CONFLICT(exercise_id) DO NOTHING;

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=70,absolute_load_demand=48,
    coordination_demand=78,impact=28,supervision_demand=82,
    base_overall_difficulty=70,
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)
      ||jsonb_build_object(
        'migration',migration_key,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'candidateOnly',TRUE,'identityQuarantine',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=45,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Provisional difficulty envelope only. Legacy source 1284 remains non-prescribable until sequence, ball, delivery, catch, throw, target, rebound, miss, and reset are adjudicated.',
    updated_at=now()
  WHERE score.exercise_id=1284 AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',
    CASE WHEN definition.slug=legacy_slug THEN jsonb_build_object(
      'stableLegacyIdentityAndSourceTraceability',TRUE,
      'identityContradictionsExplicit',TRUE,
      'athleteSelectionAndDoseBlocked',TRUE,
      'provisionalComplexityAndPhysicalEnvelopePresent',TRUE,
      'overallDifficultyDerivedAsMaximum',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'candidateAnatomyLoadFatigueConstraintsAndSupportPresent',TRUE,
      'sixteenCandidateEvidenceSectionsPresent',TRUE,
      'fiveAdjacentMediaCandidatesQuarantined',TRUE,
      'fiveAlternateIdentityAssessmentsPresent',TRUE,
      'approvalsCreated',FALSE,'externalMediaVerificationPerformed',FALSE)
    ELSE jsonb_build_object(
      'newExactStableIdentityPresent',TRUE,
      'legacyCompositeNotSilentlyRewritten',TRUE,
      'standardizedAndScaledVariantsDistinct',TRUE,
      'controlledTaxonomyPresent',TRUE,
      'anatomyJointsActionsPlanesLateralityPresent',TRUE,
      'complexityAndPhysicalDifficultyPresent',TRUE,
      'overallDifficultyDerivedAsMaximum',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'numericLoadFatigueImpactAndRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationConstraintsPresent',TRUE,
      'deliveryDosageTimeLogisticsMeasurementAndScalingPresent',TRUE,
      'coachAthleteAndOperationsSupportPresent',TRUE,
      'qualityGatesAndStopRulesPresent',TRUE,
      'sixteenCandidateEvidenceSectionsPresent',TRUE,
      'threeAdjacentMediaCandidatesQuarantined',TRUE,
      'sixAlternateAssessmentsPresent',TRUE,
      'progressionRegressionAndCalibrationProposalsPresent',TRUE,
      'approvalsCreated',FALSE,'externalMediaVerificationPerformed',FALSE) END,
    CASE WHEN definition.slug=legacy_slug THEN jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-01','message','Legacy source remains internally contradictory and cannot be selected until a human chooses the exact sequence, ball, delivery, catch rule, throw, target, rebound, miss zone, reset, and identity mapping.'),
      jsonb_build_object('code','CARD-SCORE-04','message','Difficulty is only a provisional envelope for the unresolved composite and cannot authorize a prescription.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Five adjacent media candidates require playback, exact-sequence, safety, caption, accessibility, embedding, and reviewer approval.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Human identity, content, facility-risk, media, graph, calibration, pilot, and publication review are incomplete.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-PROTOCOL-01','message','Translation, exact ball specification, facility setup, population, and normative interpretation require independent human review.'),
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence, authored claims, rehearsal dose, and scores require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','No exact full-sequence video is approved; three adjacent candidates require complete human review.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression and regression relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, pilot evidence, and production rollout are incomplete.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=ANY(target_slugs)
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF EXISTS(
    SELECT 1 FROM unnest(target_slugs) target_slug(value)
    WHERE (SELECT count(*)
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=target_slug.value
        AND evidence.reviewed_card_version=definition.card_version
        AND evidence.review_status='candidate')<>16
      OR (SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        JOIN coaching.exercise_definition_v1 definition
          ON definition.id=evidence.definition_id
        WHERE definition.slug=target_slug.value
          AND evidence.reviewed_card_version=definition.card_version
          AND evidence.review_status='candidate')<>16
  ) THEN
    RAISE EXCEPTION '% requires exactly 16 candidate evidence sections per card',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT definition.slug
    FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id=definition.id
      AND media.reviewed_card_version=definition.card_version
      AND media.review_status='candidate' AND media.link_status='unverified'
      AND media.embedding_allowed=FALSE AND media.exact_variant_match IS NULL
      AND media.demonstration_quality_score IS NULL
      AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL
    WHERE definition.slug=ANY(target_slugs)
    GROUP BY definition.slug
    HAVING count(media.id)<>CASE WHEN definition.slug=legacy_slug THEN 5 ELSE 3 END
  ) THEN
    RAISE EXCEPTION '% found an invalid quarantined-media count or state',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT definition.slug
    FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id=definition.id
      AND alternate.reviewed_card_version=definition.card_version
      AND alternate.review_status='candidate'
    WHERE definition.slug=ANY(target_slugs)
    GROUP BY definition.slug
    HAVING count(alternate.id)<>CASE WHEN definition.slug=legacy_slug THEN 5 ELSE 6 END
  ) THEN
    RAISE EXCEPTION '% found an invalid alternate-assessment count',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=legacy_slug AND variant.status<>'archived')<>1
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=exact_slug AND variant.status<>'archived')<>2 THEN
    RAISE EXCEPTION '% found an invalid active variant count',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=legacy_slug AND variant.status<>'archived'
        AND profile.status<>'archived' AND profile.role='avoid'
        AND (variant.requirements_json->>'selectable')::BOOLEAN=FALSE
        AND (variant.programming_profile_json->>'selectable')::BOOLEAN=FALSE)<>1
    OR(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=exact_slug AND variant.status<>'archived'
        AND profile.status<>'archived')<>2 THEN
    RAISE EXCEPTION '% found an invalid delivery or legacy-selection quarantine',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug=ANY(target_slugs) AND variant.status<>'archived' AND(
      (variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
      OR variant.difficulty_json ? 'skillLevel'
      OR variant.difficulty_json ? 'athleteLevel'
      OR variant.requirements_json ? 'skillLevel'
      OR variant.requirements_json ? 'athleteLevel')) THEN
    RAISE EXCEPTION '% found invalid difficulty derivation or level field',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=exact_slug AND relationship.review_status='review'
        AND relationship.reviewed_by IS NULL
        AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected two review-only graph proposals',migration_key;
  END IF;

  IF(SELECT count(*)
      FROM coaching.exercise_identity_resolution_v1 resolution
      JOIN coaching.exercise_definition_v1 left_definition
        ON left_definition.id=resolution.survivor_definition_id
      JOIN coaching.exercise_definition_v1 right_definition
        ON right_definition.id=resolution.resolved_definition_id
      WHERE left_definition.slug=legacy_slug AND right_definition.slug=exact_slug
        AND resolution.decision='distinct_exercises'
        AND resolution.resolution_source='deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'decisionScope'
          ='identity_only_not_card_media_graph_calibration_or_publication_approval')<>1 THEN
    RAISE EXCEPTION '% expected one deterministic distinct-identity boundary',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND variant.status<>'archived'
        AND calibration.status='review'
        AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
        AND calibration.reviewed_by IS NULL
        AND calibration.reviewed_at IS NULL)<>6 THEN
    RAISE EXCEPTION '% expected six review-only calibration proposals',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=1284 AND score.human_review_status='queued'
        AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL
        AND score.base_overall_difficulty=greatest(
          score.technical_complexity,score.absolute_load_demand))<>1 THEN
    RAISE EXCEPTION '% expected one queued provisional source-score packet',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise definition
    WHERE definition.id=1284 AND definition.skill_level IS NOT NULL
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=ANY(target_slugs) AND variant.status<>'archived'
      AND profile.status<>'archived' AND(
        coaching.exercise_json_has_non_neutral_level_classification(
          definition.provenance_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          definition.population_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.difficulty_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.requirements_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.programming_profile_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.dosage_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.logistics_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.support_prompts_json))) THEN
    RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id=definition.id
    LEFT JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=ANY(target_slugs) AND(
      definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
      OR variant.status='published' OR profile.status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND media.review_status IN('shortlisted','approved','rejected'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND relationship.review_status<>'review')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=ANY(target_slugs) AND calibration.status<>'review') THEN
    RAISE EXCEPTION '% created forbidden approval or publication state',migration_key;
  END IF;

  IF(SELECT card_version FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=legacy_slug AND status<>'archived')<>2
    OR(SELECT card_version FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=exact_slug AND status<>'archived')<>1
    OR(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=packet.definition_id
      WHERE definition.slug=ANY(target_slugs)
        AND packet.audit_version=migration_key AND packet.status='quarantined'
        AND packet.human_review_required=TRUE)<>2 THEN
    RAISE EXCEPTION '% expected current quarantined version-2 and version-1 packets',
      migration_key;
  END IF;
END
$$;
