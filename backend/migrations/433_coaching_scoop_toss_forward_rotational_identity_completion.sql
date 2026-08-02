-- Complete the exact forward scoop toss, add a controlled rotational-scoop
-- release variant to the existing rotational-throw survivor, and retire the
-- contradictory countermovement source without guessing its intended vector.
-- All research, media, relationships, and calibrations remain review-only.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '433_coaching_scoop_toss_forward_rotational_identity_completion';
  research_batch CONSTANT TEXT := 'scoop-toss-forward-rotational-identity-v1';
  research_version CONSTANT TEXT := '2026-08-01.11';
  forward_variant_id CONSTANT UUID :=
    '0c39bfb0-d725-4670-89f2-c072af21abeb'::UUID;
  rotational_scoop_variant_id CONSTANT UUID :=
    '4c150121-25af-4283-a0e9-2c3ffe73d031'::UUID;
  forward_id UUID;
  rotational_id UUID;
  source_id UUID;
  all_ids UUID[];
  applied_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT id INTO forward_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='medicine-ball-scoop-toss';
  SELECT id INTO rotational_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='medicine-ball-rotational-throw';
  SELECT id INTO source_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='countermovement-medicine-ball-scoop-toss';
  IF forward_id IS NULL OR rotational_id IS NULL OR source_id IS NULL THEN
    RAISE EXCEPTION '% requires forward, rotational, and countermovement cards',
      migration_key;
  END IF;
  all_ids := ARRAY[forward_id,rotational_id,source_id];

  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
     WHERE source.definition_id=forward_id
       AND source.legacy_exercise_id IN(355,732,1153))<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 source
       WHERE source.definition_id=forward_id
         AND source.legacy_exercise_id NOT IN(355,732,1153))
    OR(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
       WHERE source.definition_id=source_id
         AND source.legacy_exercise_id=1322)<>1 THEN
    RAISE EXCEPTION '% found unexpected source lineage',migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND definition.provenance_json->>'scoopTossIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,3) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF applied_count=0 THEN
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=forward_id AND status='review' AND card_version=1)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=source_id AND status='review' AND card_version=1)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=rotational_id AND status='review' AND card_version=2) THEN
      RAISE EXCEPTION '% found unexpected initial card versions',migration_key;
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=forward_id AND status='review' AND card_version=2)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=source_id AND status='archived' AND card_version=2)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=rotational_id AND status='review' AND card_version=2) THEN
      RAISE EXCEPTION '% found prior-application state drift',migration_key;
    END IF;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(all_ids) AND(
        definition.status IN('published','deprecated')
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id=ANY(all_ids)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=ANY(all_ids)
        AND(media.review_status NOT IN('candidate','superseded')
          OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=ANY(all_ids)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id=ANY(all_ids))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id=ANY(all_ids))
    +(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.resolution_source='human_review'
        AND resolution.reviewed_by IS NOT NULL
        AND(resolution.survivor_definition_id=ANY(all_ids)
          OR resolution.resolved_definition_id=ANY(all_ids)))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF applied_count=0 THEN
    UPDATE coaching.exercise_section_evidence_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id IN(forward_id,source_id) AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1
    SET review_status='superseded',exact_variant_match=NULL,
      demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id IN(forward_id,source_id) AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id IN(forward_id,source_id) AND review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id IN(forward_id,source_id);
  UPDATE coaching.exercise_variant_v1
  SET status='archived',updated_at=now()
  WHERE definition_id IN(forward_id,source_id);

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Forward Medicine Ball Scoop Toss',
    display_name='Forward Medicine Ball Scoop Toss',
    aliases=ARRAY[
      'Medicine Ball Scoop Toss','Med Ball Scoop Toss',
      'Forward Medicine Ball Scoop Toss','Medicine Ball Forward Scoop Toss',
      'Two-Hand Forward Medicine Ball Scoop Toss'],
    description='From a stationary front-facing parallel stance, hold one medicine ball with two hands below hip level, use a controlled hip hinge and knee bend, extend through the ankles, knees, and hips, and release the ball underhand forward into a clear open lane. Do not add a step or intentional jump, do not catch the throw, finish balanced behind the line, close the lane, retrieve the ball, and reset fully.',
    family_key='forward_medicine_ball_scoop_projection',
    card_version=2,status='review',content_confidence=93,
    scoring_confidence=76,media_confidence=60,
    movement_patterns=ARRAY['hinge','throw'],
    body_regions=ARRAY['full_body','hip','core','shoulder'],
    required_equipment=ARRAY['medicine_ball'],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'non_slip_level_surface','clear_forward_flight_lane',
        'marked_release_line','controlled_retrieval_process',
        'adequate_forward_and_overhead_clearance','no_cross_traffic'),
      'target','open_lane_distance_or_declared_safe_target',
      'returnContract','throw_only_then_retrieve_after_lane_closure',
      'groupLayout',jsonb_build_object(
        'oneThrowerPerLane',TRUE,'sharedStartStopSignal',TRUE,
        'coachSightlineRequired',TRUE)),
    population_json=jsonb_build_object(
      'requires',jsonb_build_array(
        'pain_free_bilateral_grip','pain_free_hip_hinge_and_whole_body_extension',
        'controlled_front_facing_finish','ability_to_release_and_stop_on_command'),
      'screen',jsonb_build_array(
        'back_hip_knee_shoulder_elbow_or_wrist_pain','recent_restriction',
        'grip_or_balance_concern','other_high_intent_throwing_and_lower_body_power_load'),
      'individualize',jsonb_build_array(
        'ball_mass_and_diameter','load_depth','target_or_distance',
        'sets','throws','rest','measurement_pressure'),
      'notMedicalClearance','Symptoms and return-to-sport restrictions require the appropriate clinician or policy process.'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'gluteus_maximus','hamstrings','quadriceps','soleus','gastrocnemius',
        'rectus_abdominis','obliques','latissimus_dorsi','anterior_deltoid'),
      'secondaryMuscles',jsonb_build_array(
        'spinal_stabilizers','serratus_anterior','triceps_brachii',
        'rotator_cuff','forearm_flexors','intrinsic_foot_muscles'),
      'joints',jsonb_build_array(
        'foot','ankle','knee','hip','pelvis','spine',
        'scapulothoracic_articulation','shoulder','elbow','wrist','hand'),
      'jointActions',jsonb_build_array(
        'hip_hinge_and_extension','knee_flexion_and_extension',
        'ankle_plantarflexion','trunk_bracing','shoulder_flexion',
        'elbow_extension_near_release','bilateral_grip_and_release'),
      'planes',jsonb_build_array(
        'sagittal_primary','frontal_and_transverse_stabilization'),
      'laterality','bilateral_two_hand_front_facing'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds high-intent forward whole-body projection while keeping the throw vector, finish, and recovery controlled.',
      'primaryCue','Face the lane, load your hips, drive the floor away, throw forward with two hands, and finish behind the line.',
      'expectedSensations',jsonb_build_array(
        'whole_body_extension','brief_trunk_brace','fast_two_hand_release',
        'balanced_finish'),
      'unexpectedSensations',jsonb_build_array(
        'pain','joint_pinching','numbness','dizziness','grip_slip','loss_of_balance'),
      'painGuidance','Stop for symptoms, unsafe grip, lane entry, or loss of control; do not push through pain.',
      'selfChecks',jsonb_build_array(
        'face_forward','both_hands_hold_and_release_together','hips_start_the_throw',
        'ball_projects_forward_not_vertical_or_rotational',
        'no_step_or_intentional_jump','finish_behind_line','full_reset'),
      'accessibility',jsonb_build_array(
        'lighter_or_smaller_ball','lower_effort','fewer_throws','longer_rest',
        'larger_target_or_no_scoring','text_still_image_audio_or_live_instruction',
        'reviewed_nonthrowing_substitution'),
      'mediaAlternatives',jsonb_build_array(
        'front_and_side_sequence','forward_vector_diagram','release_line_and_lane_map')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'front_facing_parallel_stance','two_hand_low_start','hip_hinge',
        'ankle_knee_hip_extension_sequence','underhand_forward_release',
        'no_step_or_intentional_jump','release_line','balanced_finish',
        'ball_flight','lane_closure','retrieval','symptoms','output_change'),
      'faultCorrections',jsonb_build_array(
        'Reduce ball mass or effort when the athlete lifts slowly or throws with the arms only.',
        'Reduce load depth when the ball path, spine, or balance changes.',
        'End the set rather than accepting vertical, rotational, stepping, jumping, fouled, slow, or uncontrolled throws.'),
      'demonstrationPlan',jsonb_build_array(
        'Show the front-facing stance and low two-hand start.',
        'Show the forward vector, no-step rule, release line, finish, lane closure, retrieval, and reset.'),
      'groupManagement',jsonb_build_object(
        'oneThrowerPerLane',TRUE,'sharedStartStopSignal',TRUE,
        'laneClosureBeforeRetrieval',TRUE,'coachSightlineRequired',TRUE,
        'ballCountAndThrowBudgetTracked',TRUE),
      'modificationDecisionTree',jsonb_build_object(
        'slow_or_arm_dominant','reduce_ball_mass_or_effort_and_increase_rest',
        'cannot_preserve_stance_vector_or_finish','use_reviewed_regression',
        'symptoms_grip_loss_or_unsafe_lane','stop_and_follow_support_or_clinical_process'),
      'doNotUseWhen',jsonb_build_array(
        'pain_or_restriction','unsafe_ball_surface_lane_or_traffic',
        'cannot_grip_release_or_stop_safely','throwing_budget_exhausted',
        'coach_cannot_control_the_lane')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','ball_and_equipment','lane_and_target','dose','fatigue',
        'symptoms','media','accessibility'),
      'supportEscalation',jsonb_build_object(
        'coachReview',jsonb_build_array(
          'stance_vector_or_finish_unclear','repeated_quality_failure',
          'ball_or_target_change','substitution_needed'),
        'contentReview',jsonb_build_array(
          'source_conflict','media_mismatch','taxonomy_or_score_dispute'),
        'urgent',jsonb_build_array('injury_event','ball_strike','lane_collision')),
      'retentionPolicy','Retain exact variant, ball, target, lane, sets, throws, rest, measured output, quality failures, symptoms, substitutions, and stop reason with the workout version.',
      'changeImpactPolicy','Projection direction, stance, hand count, support position, step or jump, release family, target type, return or catch contract, or compound follow-up action requires variant or identity review and workout revalidation.',
      'knownLimitations',jsonb_build_array(
        'candidate_media_not_human_approved','difficulty_not_independently_calibrated',
        'no_universal_ball_mass_or_safe_distance'),
      'supportSummary','Never silently convert the exact forward throw into a rotational, vertical, reverse, stepping, jumping, catching, or compound task.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'scoopTossIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retain_and_complete_exact_forward_scoop_definition',
      'primaryIdentitySources',jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/22744301/',
        'https://pubmed.ncbi.nlm.nih.gov/39589937/'),
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,updated_at=now()
  WHERE definition.id=forward_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',content_confidence=62,
    scoring_confidence=NULL,media_confidence=36,
    family_key='unresolved_scoop_toss_direction_and_release',
    movement_patterns=ARRAY['throw'],
    body_regions=ARRAY['full_body','hip','core','shoulder'],
    required_equipment=ARRAY['medicine_ball'],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'missingIdentityFields',jsonb_build_array(
        'stance','orientation','hand_count','ball_start','projection',
        'entry','pivot','target','return_contract','finish','side_accounting')),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','The source does not define a safe executable movement contract.'),
    anatomy_json=jsonb_build_object(
      'status','unresolved','doNotInfer',TRUE,
      'reason','Anatomy cannot be assigned until forward versus rotational direction, stance, hand count, and release are established.'),
    athlete_support_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'why','This source mixes a generic countermovement label with rotational wording but omits the movement contract.',
      'nextStep','Use a coach-selected exact forward or rotational card only after the intended task is known.',
      'unexpectedSensations',jsonb_build_array('pain','grip_loss','dizziness','loss_of_balance'),
      'accessibility',jsonb_build_array(
        'plain_language_retirement_explanation','text_first_exact_alternatives'),
      'mediaAlternatives',jsonb_build_array(
        'missing_identity_explanation','coach_selected_exact_card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'stance','orientation','hand_count','ball_start','projection','entry',
        'pivot','target','return_contract','finish','side_accounting'),
      'faultCorrections',jsonb_build_array(
        'Do not cue, dose, demonstrate, or score this source until every identity field is declared.'),
      'demonstrationPlan',jsonb_build_array(
        'Explain the ambiguous lineage.','Open the exact forward or rotational replacement card.'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'front_facing_two_hand_forward_throw_only','choose_forward_medicine_ball_scoop_toss',
        'side_on_two_hand_rotational_scoop_throw_only','choose_static_rotational_scoop_variant',
        'other','choose_or_author_a_separate_exact_variant_or_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','projection','release','target','return_contract'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','ball_strike','lane_collision')),
      'retentionPolicy','Preserve source mapping, original wording, aliases, evidence, media, and identity decisions.',
      'changeImpactPolicy','Do not reactivate without an exact stance, direction, release, target, return, finish, and side contract.',
      'knownLimitations',jsonb_build_array(
        'undefined_projection_and_release','no_exact_reviewed_media'),
      'supportSummary','Countermovement is not an identity; never infer forward or rotational intent from this source.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'scoopTossIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,updated_at=now()
  WHERE definition.id=source_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET aliases=array(SELECT DISTINCT alias FROM unnest(
      definition.aliases||ARRAY[
        'Medicine Ball Rotational Scoop Toss',
        'Rotational Medicine Ball Scoop Toss',
        'Two-Hand Rotational Scoop Toss']) alias),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'scoopTossIdentityMigration',migration_key,
      'scoopVariantResearchBatch',research_batch,
      'scoopVariantResearchVersion',research_version,
      'scoopReleaseIdentity','controlled_variant_of_two_hand_rotational_throw',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,updated_at=now()
  WHERE definition.id=rotational_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
    (forward_variant_id,forward_id,
      'standing-two-hand-forward-free-flight-scoop-toss',
      'Standing Two-Hand Forward Scoop Toss — Throw and Retrieve',
      ARRAY['standing','parallel_stance','two_hand','underhand','forward','throw_only'],
      jsonb_build_object(
        'technicalComplexity',50,'absoluteLoadDemand',32,
        'baseOverallDifficulty',50,'coordinationDemand',56,
        'supervisionDemand',60,'failureConsequence',58,'impact',18,
        'workCapacityDemand',38,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'),
        'athleteProficiencyExcluded',TRUE),
      jsonb_build_object(
        'selectable',TRUE,'stance','stationary_front_facing_parallel',
        'support','bilateral_feet_remain_grounded_except_natural_heel_rise',
        'handCount',2,'implement','one_medicine_ball',
        'ballStart','two_hands_below_hip_level_between_or_just_in_front_of_legs',
        'load','controlled_hip_hinge_and_knee_bend',
        'projection','underhand_forward_free_flight',
        'entry','none','intentionalStep',FALSE,'intentionalJump',FALSE,
        'target','declared_open_lane_distance_or_safe_forward_target',
        'returnContract','throw_only_retrieve_after_lane_closure',
        'finish','balanced_behind_release_line_then_full_reset',
        'sideAccounting','bilateral_no_side_dose',
        'equipmentRequired',jsonb_build_array('medicine_ball')),
      'review',
      jsonb_build_object(
        'externalLoadMethod','declared_medicine_ball_mass_diameter_and_material',
        'gripDemand',38,'spinalLoading',36,'eccentricStress',32,
        'landingContactsPerRep',0,'impactLevel',1,
        'exposureMetric','completed_high_intent_forward_throws',
        'loadTracking',jsonb_build_array(
          'ball_mass','ball_diameter','sets','throws','rest','distance_or_velocity',
          'target','quality_failures','symptoms','other_throwing_and_power_load'),
        'doNotInfer',jsonb_build_array(
          'universal_ball_mass','universal_release_angle','injury_prevention')),
      jsonb_build_object(
        'localMuscleFatigue',48,'gripFatigue',34,
        'technicalFatigueSensitivity',72,'impactAccumulation',18,
        'recoveryHours',30,
        'primaryFatigueSites',jsonb_build_array(
          'posterior_chain','quadriceps','trunk','shoulders','grip'),
        'stopBefore',jsonb_build_array(
          'pain_or_grip_loss','slow_or_arm_dominant_throw','vector_change',
          'step_jump_or_line_foul','balance_loss','target_drift',
          'unsafe_ball_lane_or_retrieval')),
      jsonb_build_object(
        'trainingStimuli',jsonb_build_array(
          'bilateral_whole_body_forward_power','hip_to_hand_force_transfer',
          'forward_projection_and_balanced_finish'),
        'stimulusDose',jsonb_build_object(
          'primary','fully_reset_high_quality_throws','fatigueCeiling','low'),
        'weeklyExposure',jsonb_build_object(
          'typicalSessions',1,'maximumWithoutReview',2,
          'countWithOtherMedicineBallThrowsAndLowerBodyPower',TRUE),
        'prerequisites',jsonb_build_array(
          'pain_free_hinge_and_extension','safe_two_hand_grip_and_release',
          'clear_lane_and_release_line','ability_to_stop_on_command'),
        'completionCriteria',jsonb_build_array(
          'front_facing_parallel_stance','two_hand_low_start','hip_led_extension',
          'forward_underhand_release','no_step_or_intentional_jump',
          'balanced_finish_behind_line','safe_retrieval_and_full_reset'),
        'sequenceRules',jsonb_build_array(
          'after_specific_warmup','while_fresh','before_material_throwing_or_power_fatigue',
          'not_density_conditioning'),
        'pairingCompatibility',jsonb_build_object(
          'preferred',jsonb_build_array('low_fatigue_mobility','noncompeting_strength_afterward'),
          'conditional',jsonb_build_array('sprinting','jumping','other_throwing','heavy_hinge_work')),
        'interferenceRules',jsonb_build_array(
          'count_all_high_intent_throws_and_lower_body_power_exposures'),
        'uncertaintyPolicy',jsonb_build_object(
          'ball_lane_or_identity_unclear','do_not_start',
          'symptoms_quality_or_budget_unclear','stop_and_review'),
        'cumulativeBudget',jsonb_build_object(
          'throwCount','count_every_high_intent_release',
          'technicalSensitivity',72,'impactLevel',1))),
    (rotational_scoop_variant_id,rotational_id,
      'static-side-on-two-hand-rotational-scoop-throw-only',
      'Static Two-Hand Rotational Scoop Toss — Throw and Retrieve',
      ARRAY['standing','side_on','two_hand','scoop_release','rotational','throw_only'],
      jsonb_build_object(
        'technicalComplexity',58,'absoluteLoadDemand',34,
        'baseOverallDifficulty',58,'coordinationDemand',66,
        'supervisionDemand',64,'failureConsequence',62,'impact',20,
        'workCapacityDemand',40,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'),
        'athleteProficiencyExcluded',TRUE),
      jsonb_build_object(
        'selectable',TRUE,'stance','static_side_on_athletic',
        'support','bilateral_with_controlled_pivot',
        'handCount',2,'implement','one_medicine_ball',
        'ballStart','two_hands_low_near_declared_back_hip',
        'load','rear_hip_load_without_dynamic_entry',
        'projection','two_hand_rotational_scoop_to_horizontal_or_slightly_rising_wall_target',
        'entry','none','pivot','controlled_ground_up_turn',
        'target','inspected_wall_with_declared_target_and_distance',
        'returnContract','throw_only_no_required_catch',
        'finish','balanced_facing_or_through_target_then_full_reset',
        'sideAccounting','throws_counted_per_declared_side',
        'equipmentRequired',jsonb_build_array('medicine_ball')),
      'review',
      jsonb_build_object(
        'externalLoadMethod','declared_medicine_ball_mass_diameter_material_and_rebound',
        'gripDemand',40,'spinalLoading',38,'eccentricStress',34,
        'landingContactsPerRep',0,'impactLevel',1,
        'exposureMetric','completed_high_intent_rotational_scoop_throws_per_side',
        'loadTracking',jsonb_build_array(
          'ball_mass','wall_distance','target','throw_side','sets','throws_per_side',
          'rest','velocity_or_distance','quality_failures','symptoms',
          'other_rotational_and_throwing_load'),
        'doNotInfer',jsonb_build_array(
          'universal_ball_mass','safe_spinal_rotation_threshold','injury_prevention')),
      jsonb_build_object(
        'localMuscleFatigue',54,'gripFatigue',36,
        'technicalFatigueSensitivity',78,'impactAccumulation',20,
        'recoveryHours',36,
        'primaryFatigueSites',jsonb_build_array(
          'rear_hip','adductors','obliques','trunk_rotators','shoulders','grip'),
        'stopBefore',jsonb_build_array(
          'pain_or_grip_loss','arm_only_or_lumbar_dominant_throw',
          'pivot_or_knee_control_loss','target_or_side_drift','balance_loss',
          'unsafe_ball_wall_rebound_or_retrieval')),
      jsonb_build_object(
        'trainingStimuli',jsonb_build_array(
          'two_hand_rotational_power','hip_trunk_ball_sequencing',
          'side_specific_targeted_projection'),
        'stimulusDose',jsonb_build_object(
          'primary','fully_reset_quality_throws_per_side','fatigueCeiling','low'),
        'weeklyExposure',jsonb_build_object(
          'typicalSessions',1,'maximumWithoutReview',2,
          'countWithOtherRotationalThrowingAndPivotWork',TRUE),
        'prerequisites',jsonb_build_array(
          'pain_free_hip_and_trunk_rotation','safe_pivot_and_balance',
          'safe_two_hand_grip_and_release','tested_ball_wall_and_clear_lane'),
        'completionCriteria',jsonb_build_array(
          'static_side_on_start','two_hand_low_back_hip_load',
          'ground_up_pivot_and_rotation','declared_target_hit_or_clean_miss',
          'throw_only_finish','balanced_reset','side_dose_recorded'),
        'sequenceRules',jsonb_build_array(
          'after_specific_warmup','while_fresh',
          'before_material_rotational_throwing_or_trunk_fatigue',
          'not_density_conditioning'),
        'pairingCompatibility',jsonb_build_object(
          'preferred',jsonb_build_array('low_fatigue_mobility','noncompeting_strength_afterward'),
          'conditional',jsonb_build_array('sport_throwing','swinging','pressing','change_of_direction')),
        'interferenceRules',jsonb_build_array(
          'count_all_rotational_throws_pivots_and_side_specific_ballistic_exposures'),
        'uncertaintyPolicy',jsonb_build_object(
          'ball_wall_lane_or_side_unclear','do_not_start',
          'symptoms_quality_or_budget_unclear','stop_and_review'),
        'cumulativeBudget',jsonb_build_object(
          'throwCount','count_every_high_intent_release_by_side',
          'technicalSensitivity',78,'impactLevel',1)))
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,
    variant_key=EXCLUDED.variant_key,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,
    CASE profile.variant_id WHEN forward_variant_id THEN
      CASE profile.phase_key WHEN 'output' THEN
        'Fresh bilateral forward medicine-ball projection and balanced-finish quality.'
      ELSE 'Low-volume rehearsal of the exact forward hinge, release vector, finish, and lane process.' END
    ELSE CASE profile.phase_key WHEN 'output' THEN
      'Fresh side-specific rotational scoop power, sequencing, target, and balanced-finish quality.'
      ELSE 'Low-volume rehearsal of the exact static rotational scoop, pivot, target, and side process.' END END,
    profile.suitability,profile.alignment,
    CASE profile.variant_id WHEN forward_variant_id THEN jsonb_build_object(
      'forward_whole_body_projection',profile.relevance,
      'hip_to_hand_power',profile.relevance,'fatigue_conditioning',5)
    ELSE jsonb_build_object(
      'rotational_whole_body_projection',profile.relevance,
      'hip_trunk_ball_sequencing',profile.relevance,'fatigue_conditioning',5) END,
    CASE profile.variant_id WHEN forward_variant_id THEN jsonb_build_object(
      'sets',profile.sets,'throwsPerSet',profile.throws,
      'ball','declare_mass_diameter_material','effortPercent',profile.effort,
      'interRepetitionResetSeconds',profile.reset_seconds,
      'interSetRestSeconds',profile.rest_seconds,
      'maximumThrows',profile.sets*profile.throws,'fullReset',TRUE)
    ELSE jsonb_build_object(
      'sets',profile.sets,'throwsPerSide',profile.throws,
      'sides',jsonb_build_array('left','right'),
      'ball','declare_mass_diameter_material_and_rebound',
      'effortPercent',profile.effort,
      'interRepetitionResetSeconds',profile.reset_seconds,
      'interSetRestSeconds',profile.rest_seconds,
      'maximumThrows',profile.sets*profile.throws*2,
      'sideBalanceRequired',TRUE,'fullReset',TRUE) END,
    CASE profile.variant_id WHEN forward_variant_id THEN
      'The athlete stays front-facing in a parallel stance, begins with a two-hand low ball position, extends from the lower body, releases underhand forward without a step or intentional jump, finishes behind the line, and retrieves only after lane closure.'
    ELSE
      'The athlete starts static and side-on with two hands low near the back hip, pivots and rotates from the ground up, releases through the declared wall target, finishes under control without a required catch, and completes the assigned side dose.' END,
    ARRAY[
      'Stop for pain, numbness, dizziness, grip loss, or loss of balance.',
      'Stop when stance, vector, ball path, sequence, target, finish, side accounting, or reset changes.',
      'Stop when the ball, wall, lane, traffic, retrieval process, remaining throw budget, or coach sightline becomes unsafe.'],
    CASE profile.variant_id WHEN forward_variant_id THEN
      'Inspect the ball and lane. Declare ball, target or distance, line, sets, throws, rest, measurement, and retrieval signal. Observe from front and side, count every release, and end the set at the first failed quality gate.'
    ELSE
      'Inspect the ball, wall, and lateral lane. Declare ball, wall distance, target, starting side, sets, throws per side, rest, measurement, and retrieval signal. Observe the pivot and trunk from a safe angle, count each side, and stop at the first failed gate.' END,
    CASE profile.variant_id WHEN forward_variant_id THEN
      'Face the lane, hold the ball low with two hands, load your hips, throw forward, finish behind the line, and wait for the retrieval signal.'
    ELSE
      'Stand side-on, load the ball low by your back hip, turn from the floor, throw through the wall target with two hands, finish balanced, and reset before the next side.' END,
    CASE profile.variant_id WHEN forward_variant_id THEN
      'Repeatable front-facing two-hand forward whole-body projection with a controlled no-step finish.'
    ELSE
      'Repeatable side-specific two-hand rotational scoop projection with controlled ground-up sequencing and target accuracy.' END,
    ARRAY['medicine_ball'],
    jsonb_build_object(
      'stationSeconds',300,'athletesPerStation',1,'setupSeconds',60,
      'transitionSeconds',30,'oneThrowerPerLane',TRUE,
      'laneOrWallInspectionRequired',TRUE,'retrievalSignalRequired',TRUE,
      'coachSightlineRequired',TRUE,'sharedStartStopSignalRequired',TRUE,
      'spareBallOutsideFlightPath',TRUE),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'attemptSeconds',jsonb_build_object('minimum',2,'maximum',8),
      'resetSeconds',profile.reset_seconds,'restSeconds',profile.rest_seconds,
      'durationInputs',CASE profile.variant_id WHEN forward_variant_id THEN
        jsonb_build_array('sets','throws','attempt','reset','rest','setup','transition')
      ELSE jsonb_build_array('sets','throws_per_side','sides','attempt','reset','rest','setup','transition') END),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'reduce_ball_mass','reduce_effort','reduce_throws','increase_rest',
        'remove_output_scoring','use_reviewed_nonthrowing_substitution'),
      'progressOrder',CASE profile.variant_id WHEN forward_variant_id THEN jsonb_build_array(
        'preserve_exact_stance_and_forward_vector','preserve_finish_and_lane_process',
        'stabilize_distance_or_velocity','change_one_delivery_variable_after_review')
      ELSE jsonb_build_array(
        'preserve_static_side_on_start_and_low_scoop_path',
        'preserve_pivot_target_finish_and_side_balance',
        'stabilize_velocity_or_target','change_one_delivery_variable_after_review') END,
      'changeOneVariableAtATime',TRUE,
      'neverChangeSilently',jsonb_build_array(
        'projection_direction','stance_or_support','hand_count','entry',
        'step_or_jump','release_family','return_or_catch_contract','compound_action')),
    CASE profile.variant_id WHEN forward_variant_id THEN jsonb_build_object(
      'primary','completed_quality_forward_scoop_throws',
      'record',jsonb_build_array(
        'ball','target_or_distance','sets','throws','rest','distance_or_velocity',
        'line_fouls','quality_failures','symptoms','substitution','stop_reason'),
      'failedAttemptPolicy','do_not_count_and_end_or_regress')
    ELSE jsonb_build_object(
      'primary','completed_quality_rotational_scoop_throws_per_side',
      'record',jsonb_build_array(
        'ball','wall_distance','target','starting_side','throws_per_side','rest',
        'velocity_or_accuracy','quality_failures','symptoms','substitution','stop_reason'),
      'failedAttemptPolicy','do_not_count_and_end_or_regress') END,
    jsonb_build_object(
      'before',jsonb_build_array(
        'Confirm exact variant, ball, target, lane or wall, return policy, dose, rest, measurement, and remaining throwing budget.',
        'Report pain, restriction, grip concerns, dizziness, or conflicting throwing load before starting.'),
      'during',jsonb_build_array(
        'Call stop immediately for a quality failure, unsafe ball path, lane entry, or symptom.'),
      'after',jsonb_build_array(
        'Record throws, sides when applicable, ball, output, failures, symptoms, substitutions, and stop reason.'))
  FROM(VALUES
    (forward_variant_id,'output-forward-scoop-quality','output','primary',
      88,86,88,3,3,90,8,120),
    (forward_variant_id,'prepare-forward-scoop-pattern','prepare_and_access','secondary',
      76,80,72,2,3,70,10,90),
    (rotational_scoop_variant_id,'output-rotational-scoop-quality','output','primary',
      88,88,90,3,3,90,10,120),
    (rotational_scoop_variant_id,'prepare-rotational-scoop-pattern','prepare_and_access','secondary',
      76,82,74,2,2,70,12,90)
  ) profile(variant_id,profile_key,phase_key,role,suitability,alignment,
    relevance,sets,throws,effort,reset_seconds,rest_seconds)
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
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,2,evidence.section_key,evidence.source_url,
    evidence.source_title,evidence.source_publisher,evidence.source_kind,
    jsonb_build_array(
      replace(evidence.claim_1,'{{card}}',definition.canonical_name),
      replace(evidence.claim_2,'{{card}}',definition.canonical_name),
      jsonb_build_object('researchBatch',research_batch,
        'researchVersion',research_version,'humanReviewRequired',TRUE)),
    evidence.evidence_quality,'candidate',NULL,NULL
  FROM(VALUES
    ('identity','https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',84,
      'Medicine-ball power assessment depends on a standardized task, mass, execution, and outcome measure.',
      '{{card}} must declare direction, stance, hand count, ball start, entry, target, return contract, finish, and side accounting.'),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/37833510/',
      'Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis',
      'Sports Medicine - Open','peer_reviewed_research',91,
      'Medicine-ball throws are ballistic power tasks whose position and throw technique must be controlled.',
      '{{card}} is classified by direction, release family, support, entry, target, return, and finish without athlete-level labels.'),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',81,
      'Standing medicine-ball performance differs from seated performance and includes lower-body contribution.',
      '{{card}} represents the whole kinetic chain used by its exact standing stance and release.'),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/19826303/',
      'Analysis of trunk muscle activity in the side medicine-ball throw',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',80,
      'Side medicine-ball throwing has a distinct trunk-rotation demand from front-facing projection.',
      '{{card}} preserves its declared forward or side-on vector and uses a controlled ground-up sequence.'),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',81,
      'Throw technique and ball mass affect performance variability and task demand.',
      '{{card}} scores exercise complexity and physical difficulty only; overall is their maximum.'),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',81,
      'Ball mass and throw technique affect measured velocity and must remain standardized when output is compared.',
      '{{card}} tracks ball, throws, sides, output change, other throwing load, symptoms, rest, and recovery without claiming a universal threshold.'),
    ('constraints','https://dxpprod.nsca.com/contentassets/574ab3a9e81e4063a759c38f29a717f8/land-based_strength_and_conditioning_-for_swimming.pdf',
      'Land-Based Strength and Conditioning for Swimming',
      'National Strength and Conditioning Association','professional_standard',82,
      'Standing medicine-ball projection requires a stable setup, appropriate implement, target, and clear space.',
      '{{card}} blocks selection when ball, wall or lane, grip, stance, pivot, symptoms, or supervision are unsafe.'),
    ('dosage','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf',
      'NSCA Coach 5.4','National Strength and Conditioning Association',
      'professional_standard',80,
      'Explosive medicine-ball work uses low repetition counts and recovery that preserves intent.',
      '{{card}} counts fully reset throws and sides with a declared ball, target, rest, and stop rule.'),
    ('instructions','https://dxpprod.nsca.com/contentassets/574ab3a9e81e4063a759c38f29a717f8/land-based_strength_and_conditioning_-for_swimming.pdf',
      'Land-Based Strength and Conditioning for Swimming',
      'National Strength and Conditioning Association','professional_standard',82,
      'Instruction declares stance, ball position, sequence, target, finish, and reset.',
      '{{card}} uses observable cues and does not promise sport transfer or injury prevention.'),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/19826303/',
      'Analysis of trunk muscle activity in the side medicine-ball throw',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',80,
      'Rapid trunk demand makes uncontrolled lumbar substitution and symptoms important stop signals.',
      '{{card}} also stops for grip loss, vector or target drift, balance loss, unsafe ball flight, lane entry, or equipment failure.'),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',84,
      'Power assessment requires a stable protocol and outcome measure.',
      '{{card}} validates exact variant, phase, logistics, duration, cumulative budget, substitutions, and persisted output after every change.'),
    ('athlete_support','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf',
      'NSCA Coach 5.4','National Strength and Conditioning Association',
      'professional_standard',80,
      'Athletes need a concise movement goal and enough recovery to keep throws explosive.',
      '{{card}} explains the exact vector, expected effort, self-checks, symptoms, stop rule, and how to request an alternative.'),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',84,
      'Coaches standardize ball, stance, side, target, distance, outcome measure, rest, and valid-attempt rules.',
      '{{card}} also requires lane control, shared signals, side tracking, equipment inspection, and documentation.'),
    ('accessibility','https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',81,
      'Changing support position or throw technique changes the task rather than merely changing difficulty.',
      '{{card}} may scale mass, effort, volume, rest, target pressure, or instruction modality while preserving identity.'),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/19826303/',
      'Analysis of trunk muscle activity in the side medicine-ball throw',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',80,
      'Forward and side-on rotational releases are mechanically distinct.',
      '{{card}} reviews direction, support, entry, release family, return contract, catch, jump, and compound actions separately.'),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists','YouTube Help','manufacturer_instruction',82,
      'YouTube oEmbed health establishes current link and embedding availability only.',
      '{{card}} requires full human review of movement, cues, safety, captions, accessibility, and quality before media approval.')
  ) evidence(section_key,source_url,source_title,source_publisher,source_kind,
    evidence_quality,claim_1,claim_2)
  CROSS JOIN coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
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
  SELECT definition.id,media.variant_id,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,
    now()+INTERVAL '30 days',media.notes
  FROM(VALUES
    ('medicine-ball-scoop-toss',forward_variant_id,'wPEYsRVChNE',
      'Medicine Ball Forward Scoop Toss for Distance','Simone Sports Performance',
      'standing forward medicine ball scoop toss distance',
      'YouTube oEmbed was healthy. Title suggests forward-distance projection; exact stance, hand path, no-step rule, finish, cue quality, captions, accessibility, reviewer, and approval remain unresolved.'),
    ('medicine-ball-scoop-toss',forward_variant_id,'UmLEPjElr4s',
      'How To: Med Ball Forward Scoop Toss','RAWR Strength',
      'standing forward medicine ball scoop toss',
      'YouTube oEmbed was healthy. Exact movement and demonstration quality require full human review.'),
    ('medicine-ball-scoop-toss',forward_variant_id,'npqgpBmI0ys',
      'Medicine Ball Scoop Toss for Distance','Simone Sports Performance',
      'medicine ball forward scoop toss for distance',
      'YouTube oEmbed was healthy. Distance wording is candidate evidence only; no exact-match or quality approval is created.'),
    ('medicine-ball-scoop-toss',forward_variant_id,'GaUjwlJYWtw',
      'Forward Facing MB Scoop Toss','Champion Physical Therapy and Performance',
      'forward facing medicine ball scoop toss',
      'YouTube oEmbed was healthy. Exact contract, safety, captions, accessibility, reviewer, and approval remain unset.'),
    ('medicine-ball-scoop-toss',forward_variant_id,'aAeQkR2uDmo',
      'Med Ball Forward Scoop Throw','Jordan Foley',
      'medicine ball forward scoop throw',
      'YouTube oEmbed was healthy. Full playback and qualified review are still required.'),
    ('medicine-ball-rotational-throw',rotational_scoop_variant_id,'3TSv1SaUpOA',
      'SimoneBaseballPerformance.org - Medicine Ball Rotational Scoop Toss',
      'Simone Sports Performance','static rotational medicine ball scoop toss',
      'YouTube oEmbed was healthy. Exact entry, pivot, target, return, cues, captions, quality, reviewer, and approval remain unresolved.'),
    ('medicine-ball-rotational-throw',rotational_scoop_variant_id,'LIQVEVwjAqU',
      'Rotational Medicine Ball Scoop Toss','Synchronicity Health',
      'rotational medicine ball scoop toss',
      'YouTube oEmbed was healthy. Title match does not establish the exact static throw-only variant or demonstration quality.'),
    ('medicine-ball-rotational-throw',rotational_scoop_variant_id,'xmQfXggU2mU',
      'Med Ball Rotational Scoop','Champion Physical Therapy and Performance',
      'medicine ball rotational scoop',
      'YouTube oEmbed was healthy. Full human review remains required.'),
    ('medicine-ball-rotational-throw',rotational_scoop_variant_id,'V2MTAlOxXVU',
      'Alan teaches the rotational scoop toss. Get more throwing power from your hips',
      'Melissa Witmer','rotational scoop toss hips',
      'YouTube oEmbed was healthy. The title is not approval of movement accuracy, safety, accessibility, or quality.'),
    ('medicine-ball-rotational-throw',rotational_scoop_variant_id,'mxf1D3NtxMo',
      'CresseyMedBall.com: Rotational Medicine Ball Scoop Toss','Eric Cressey',
      'rotational medicine ball scoop toss',
      'YouTube oEmbed was healthy. Candidate was reassigned from ambiguous generic lineage; exact-match and quality review remain human-gated.'),
    ('countermovement-medicine-ball-scoop-toss',NULL::UUID,'wPEYsRVChNE',
      'Medicine Ball Forward Scoop Toss for Distance','Simone Sports Performance',
      'adjacent forward scoop interpretation',
      'Adjacent forward interpretation only. Media cannot establish the missing source identity or create a mapping.'),
    ('countermovement-medicine-ball-scoop-toss',NULL::UUID,'LIQVEVwjAqU',
      'Rotational Medicine Ball Scoop Toss','Synchronicity Health',
      'adjacent rotational scoop interpretation',
      'Adjacent rotational interpretation only. It does not prove the source stance, release, target, return, or side contract.'),
    ('countermovement-medicine-ball-scoop-toss',NULL::UUID,'mxf1D3NtxMo',
      'CresseyMedBall.com: Rotational Medicine Ball Scoop Toss','Eric Cressey',
      'adjacent rotational scoop interpretation',
      'Adjacent title candidate only. No source mapping, reviewer decision, exact-match result, or approval is inferred.')
  ) media(definition_slug,variant_id,video_id,title,channel,source_query,notes)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=media.definition_slug
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
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
  SELECT definition.id,2,alternate.alternate_name,alternate.classification,
    alternate.rationale,alternate.dimensions,
    CASE WHEN alternate.classification IN('new_definition','new_variant') THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    ('medicine-ball-scoop-toss','Static Rotational Medicine Ball Scoop Toss','new_variant',
      'Side-on transverse projection is a scoop-release variant of the canonical two-hand rotational throw, not the forward card.',
      '{"projection":"rotational","parentDefinition":"medicine-ball-rotational-throw"}'::JSONB),
    ('medicine-ball-scoop-toss','Vertical Medicine Ball Scoop Toss','new_definition',
      'An upward free-flight release changes trajectory, ceiling needs, visibility, and outcome.',
      '{"projection":"vertical"}'::JSONB),
    ('medicine-ball-scoop-toss','Reverse Overhead Medicine Ball Toss','new_definition',
      'Backward overhead projection changes direction, release path, visibility, and space.',
      '{"projection":"backward_overhead"}'::JSONB),
    ('medicine-ball-scoop-toss','Half-Kneeling Forward Scoop Toss','new_variant',
      'Half-kneeling removes the standing bilateral extension contract and requires a reviewed support-position variant.',
      '{"support":"half_kneeling"}'::JSONB),
    ('medicine-ball-scoop-toss','Jumping Forward Scoop Toss','new_variant',
      'Intentional flight adds takeoff, landing, impact, and foul rules.',
      '{"jump":true}'::JSONB),
    ('medicine-ball-scoop-toss','Forward Scoop Toss with Step','new_variant',
      'A step adds approach momentum and a different footwork contract.',
      '{"entry":"step"}'::JSONB),
    ('medicine-ball-scoop-toss','Forward Scoop Toss to Broad Rebound','new_definition',
      'A throw followed by a broad rebound is an ordered compound task with impact exposure.',
      '{"orderedActions":["throw","broad_rebound"]}'::JSONB),
    ('medicine-ball-scoop-toss','Ball Mass, Distance, Velocity, Target, Repetitions, or Rest','modifier_annotation',
      'These scale delivery only while stance, two-hand forward underhand projection, no-jump rule, throw-only outcome, finish, and reset remain fixed.',
      '{"modifiers":["ball_mass","distance","velocity","target","repetitions","rest"]}'::JSONB),
    ('medicine-ball-rotational-throw','Forward Medicine Ball Scoop Toss','new_definition',
      'Front-facing sagittal projection is distinct from side-on rotational projection.',
      '{"projection":"forward"}'::JSONB),
    ('medicine-ball-rotational-throw','Rotational Medicine Ball Shot-Put','new_definition',
      'A unilateral shoulder-level push is not the same release as a bilateral low scoop.',
      '{"release":"single_arm_shot_put"}'::JSONB),
    ('medicine-ball-rotational-throw','Step-Behind Rotational Scoop Toss','new_variant',
      'A step-behind adds approach momentum and footwork before the same scoop release.',
      '{"entry":"step_behind"}'::JSONB),
    ('medicine-ball-rotational-throw','Drop-Step Rotational Scoop Toss','new_variant',
      'A drop step adds reorientation and momentum before release.',
      '{"entry":"drop_step"}'::JSONB),
    ('medicine-ball-rotational-throw','Shuffle Rotational Scoop Toss','new_variant',
      'A shuffle adds multiple approach contacts and timing demand.',
      '{"entry":"shuffle"}'::JSONB),
    ('medicine-ball-rotational-throw','Half-Kneeling Rotational Scoop Toss','new_variant',
      'Kneeling removes standing pivot and lower-body contribution.',
      '{"support":"half_kneeling"}'::JSONB),
    ('medicine-ball-rotational-throw','Rotational Scoop Toss with Rebound Catch','new_variant',
      'A required catch adds tracking, return absorption, ball and wall constraints, and catch exposure.',
      '{"returnContract":"rebound_and_catch"}'::JSONB),
    ('medicine-ball-rotational-throw','Ball Mass, Target Height, Wall Distance, Repetitions, or Rest','modifier_annotation',
      'These scale the static scoop-release delivery while its side-on start, low two-hand path, pivot, target vector, throw-only finish, side dose, and reset remain fixed.',
      '{"modifiers":["ball_mass","target_height","wall_distance","repetitions","rest"]}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Forward Medicine Ball Scoop Toss','same_identity',
      'Possible only if authoritative evidence establishes front-facing stationary bilateral underhand forward projection and a throw-only finish.',
      '{"possibleMapping":"medicine-ball-scoop-toss"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Static Rotational Medicine Ball Scoop Toss','same_identity',
      'Possible only if authoritative evidence establishes side-on two-hand rotational scoop projection, pivot, target, side dose, and throw-only finish.',
      '{"possibleMapping":"medicine-ball-rotational-throw:static-side-on-two-hand-rotational-scoop-throw-only"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Vertical Medicine Ball Scoop Toss','new_definition',
      'Vertical free-flight projection is a separate task if later evidence establishes that intent.',
      '{"projection":"vertical"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Rotational Medicine Ball Shot-Put','new_definition',
      'A single-arm shoulder push is a different release identity.',
      '{"release":"single_arm_shot_put"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Dynamic-Entry Scoop Toss','new_variant',
      'Step, shuffle, or drop-step entries require explicit ordered footwork and contact accounting.',
      '{"entry":"dynamic_unspecified"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Scoop Toss with Jump or Rebound','new_definition',
      'A jump, landing, or rebound adds ordered actions and impact that cannot be inferred.',
      '{"compoundAction":"jump_or_rebound"}'::JSONB),
    ('countermovement-medicine-ball-scoop-toss','Ball Mass, Target, Attempts, Velocity, or Rest','modifier_annotation',
      'These can be modifiers only after the missing stance, direction, release, target, return, finish, and side identity are resolved.',
      '{"modifiers":["ball_mass","target","attempts","velocity","rest"]}'::JSONB)
  ) alternate(definition_slug,alternate_name,classification,rationale,dimensions)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=alternate.definition_slug
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (forward_variant_id,rotational_scoop_variant_id,'lateral_substitution',74,
      ARRAY['projection','stance_orientation','pivot','side_accounting','target'],
      'Both variants use a two-hand medicine-ball scoop release and full reset, but forward sagittal projection cannot be substituted silently for side-on transverse projection. A coach must revalidate the training objective, space, target, side dose, fatigue budget, and instructions.',
      '{"useWhen":["rotational_projection_is_the_reviewed_objective","wall_and_side_lane_are_safe","side_dose_and_budget_are_revalidated"],"notEquivalentFor":["forward_distance_assessment","front_facing_projection"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (rotational_scoop_variant_id,forward_variant_id,'lateral_substitution',74,
      ARRAY['projection','stance_orientation','pivot','side_accounting','target'],
      'The front-facing free-flight throw can replace rotational scoop exposure only after the coach accepts the loss of side-specific transverse projection and revalidates lane, ball, dose, measurement, and workout intent.',
      '{"useWhen":["forward_projection_is_the_reviewed_objective","open_lane_is_safe","dose_and_budget_are_revalidated"],"notEquivalentFor":["rotational_power_assessment","side_specific_rotational_projection"]}'::JSONB,
      'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,calibration.dimension,calibration.score,
    CASE WHEN calibration.score<30 THEN 20 WHEN calibration.score<50 THEN 40
      WHEN calibration.score<70 THEN 60 ELSE 80 END,
    CASE calibration.dimension WHEN 'technicalComplexity' THEN
      'Candidate exercise-complexity anchor based on exact stance, hand count, ball start, whole-body sequence, direction, release, target, finish, return policy, reset, and side accounting; independent human calibration is required.'
    ELSE
      'Candidate physical-difficulty anchor based on declared medicine-ball mass and size, grip, whole-body ballistic effort, trunk and shoulder demand, accumulated throwing volume, symptoms, rest, and recovery; independent human calibration is required.' END,
    'review',1,NULL,NULL,'No score approval is created by migration 433.',NULL
  FROM(VALUES
    (forward_variant_id,50,32),
    (rotational_scoop_variant_id,58,34)
  ) variant(id,complexity,physical)
  CROSS JOIN LATERAL(VALUES
    ('technicalComplexity',variant.complexity),
    ('absoluteLoadDemand',variant.physical)
  ) calibration(dimension,score)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET rationale=split_part(
      resolution.rationale,
      ' Migration 433 archives the contradictory source',1
    )||' Migration 433 archives the contradictory source without direct consolidation, completes the exact front-facing forward definition, and adds a static two-hand rotational-scoop release variant to the existing rotational-throw survivor. Reactivation or mapping still requires authoritative stance, direction, release, target, return, finish, and side facts plus qualified human review.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'retirementMigration',migration_key,
        'resolution','retire_ambiguous_source_without_direct_consolidation',
        'exactForwardDefinition','medicine-ball-scoop-toss',
        'rotationalScoopVariant','static-side-on-two-hand-rotational-scoop-throw-only',
        'humanReviewStillRequiredForSourceMapping',TRUE,
        'approvalCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.decision='needs_human_review'
    AND resolution.reviewed_by IS NULL
    AND resolution.survivor_definition_id=ANY(ARRAY[source_id,forward_id])
    AND resolution.resolved_definition_id=ANY(ARRAY[source_id,forward_id]);

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,forward_id,rotational_id,'distinct_exercises',
      'The forward definition uses a stationary front-facing parallel stance and a two-hand underhand sagittal free-flight projection without a pivot or side dose. The rotational survivor uses side-on transverse projection with a controlled pivot and side accounting. Direction, stance orientation, pivot, target, finish, and side dose are identity-bearing.',
      jsonb_build_object(
        'identityBoundary','front_facing_forward_scoop_vs_side_on_rotational_throw',
        'differingDimensions',jsonb_build_array(
          'projection_direction','stance_orientation','pivot','target_type',
          'finish','side_accounting'),
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,source_id,rotational_id,'needs_human_review',
      'The archived source says countermovement and rotational release but does not declare side-on orientation, two-hand low ball position, static entry, pivot, target, throw-only return, finish, or side dose. It could describe the rotational scoop variant, another rotational throw, or an unsafe mixture; mapping requires authoritative source evidence and qualified review.',
      jsonb_build_object(
        'identityBoundary','ambiguous_countermovement_source_vs_exact_rotational_scoop_variant',
        'missingIdentityFacts',jsonb_build_array(
          'stance','orientation','hand_count','ball_start','entry','pivot',
          'projection','target','return_contract','finish','side_accounting'),
        'possibleMapping','medicine-ball-rotational-throw:static-side-on-two-hand-rotational-scoop-throw-only',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  UPDATE coaching.exercise exercise
  SET name='Forward Medicine Ball Scoop Toss',
    slug='medicine-ball-scoop-toss',
    description='From a stationary front-facing parallel stance, hold one medicine ball with two hands below hip level, use a controlled hip hinge and knee bend, extend through the lower body, and release the ball underhand forward into a clear lane. Do not step or intentionally jump, finish behind the line, retrieve only after lane closure, and reset fully.',
    card_summary='Two-hand front-facing underhand medicine-ball projection into a clear forward lane with a stationary no-step start, balanced finish, and full retrieval reset.',
    movement_family='Forward medicine-ball scoop projection',
    primary_phase_key='output',phase_subrole='jump_throw_explosive_power',
    primary_order_slot='forward_medicine_ball_scoop_power',
    default_sets=3,default_reps=3,default_rest_seconds=120,
    default_work_seconds=NULL,est_seconds_per_set=120,
    participant_structure='individual',programming_kind='exercise',
    skill_level=NULL,is_published=TRUE,archived=FALSE,
    movement_requirements=jsonb_build_object(
      'impact_level',1,'balance_demand','moderate_dynamic',
      'coordination_demand','high','postural_shape','front_facing_braced_hinge',
      'required_equipment',jsonb_build_array('medicine_ball'),
      'primary_tissues',jsonb_build_array(
        'glutes','hamstrings','quadriceps','calves','abdominals','lats','shoulders','grip'),
      'primary_joint_actions',jsonb_build_array(
        'hip_hinge_and_extension','knee_flexion_extension','ankle_plantarflexion',
        'trunk_bracing','shoulder_flexion','bilateral_release'),
      'identity_contract',jsonb_build_object(
        'stance','stationary_front_facing_parallel','hands',2,
        'ball_start','below_hip_level','projection','underhand_forward',
        'step',FALSE,'intentional_jump',FALSE,'catch',FALSE,
        'finish','balanced_behind_release_line','reset','full_after_lane_closure')),
    coaching_execution=jsonb_build_object(
      'movement_description','Project a declared medicine ball forward with a two-hand underhand scoop from a stationary front-facing stance, then finish and retrieve under control.',
      'setup',jsonb_build_array(
        'Inspect and declare the ball mass, diameter, and material.',
        'Mark the release line and clear the entire forward flight and retrieval lane.',
        'Declare target or distance, sets, throws, rest, measurement, and retrieval signal.'),
      'execution_steps',jsonb_build_array(
        'Face the lane in a parallel stance and hold the ball low with two hands.',
        'Hinge and bend the knees without changing direction or adding a step.',
        'Extend from the floor and release the ball underhand forward.',
        'Finish balanced behind the line without an intentional jump.',
        'Wait for lane closure, retrieve the ball, and reset fully.'),
      'coach_cues',jsonb_build_array(
        'Face the lane.','Load the hips.','Drive the floor away.',
        'Throw forward, not up.','Finish behind the line.'),
      'athlete_cues',jsonb_build_array(
        'Two hands, hips first, throw forward, stick the finish, and wait.'),
      'quality_gate',jsonb_build_array(
        'Stance, low two-hand start, forward vector, no-step rule, line, finish, and reset remain exact.',
        'Ball speed or distance and posture remain repeatable without symptoms or unsafe flight.'),
      'common_faults',jsonb_build_array(
        'ball_too_heavy','arm_only_lift','vertical_or_rotational_release',
        'lumbar_hyperextension','step_or_jump','line_foul','balance_loss','early_retrieval'),
      'stop_signs',jsonb_build_array(
        'pain_numbness_dizziness_or_grip_loss','two_slow_or_changed_throws',
        'step_jump_line_foul_or_balance_loss','unsafe_ball_lane_traffic_or_retrieval')),
    athlete_language='Face forward, use two hands, load your hips, throw the ball forward, finish behind the line, and wait until the lane is clear.',
    coach_language='Standardize the exact forward variant, ball, lane, release line, dose, rest, measurement, and retrieval signal. Count every throw and stop at the first vector, finish, output, symptom, or safety failure.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseComplexity',50,'physicalDifficulty',32,'overallDifficulty',50,
      'freshnessSensitive',TRUE,
      'cumulativeBudgets',jsonb_build_array(
        'medicine_ball_throws','lower_body_ballistic_power','trunk_and_shoulder_load','technical_sensitivity'),
      'substitutionRule','Any change to direction, stance, hands, entry, jump, catch, return, or compound action requires reviewed variant or identity substitution.'),
    media_library=jsonb_build_object(
      'internal_notes',jsonb_build_array(
        'Five oEmbed-healthy canonical candidates await full human exact-match, quality, captions, accessibility, and safety review.',
        'Do not use prior generic, half-kneeling, sprint-entry, reverse, or rotational media as the approved demonstration.'),
      'demo_video_sources',jsonb_build_array(),
      'coaching_articles',jsonb_build_array(),
      'clinical_or_sport_science_references',jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/22744301/',
        'https://pubmed.ncbi.nlm.nih.gov/39589937/')),
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=732;

  UPDATE coaching.exercise exercise
  SET archived=TRUE,is_published=FALSE,skill_level=NULL,
    programming_logic=coalesce(exercise.programming_logic,'{}'::JSONB)
      ||jsonb_build_object(
        'canonicalRetirementMigration',migration_key,
        'canonicalSurvivorLegacyExerciseId',CASE WHEN exercise.id IN(355,1153) THEN 732 ELSE NULL END,
        'retirementReason',CASE WHEN exercise.id IN(355,1153)
          THEN 'redundant_forward_scoop_source_or_context'
          ELSE 'ambiguous_countermovement_direction_and_release' END,
        'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(355,1153,1322);

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level=NULL
  WHERE safety.exercise_id IN(355,732,1153,1322);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,definition.card_version,'1.0.0',migration_key,
    'quarantined',
    CASE WHEN definition.id=source_id THEN jsonb_build_object(
      'identityKnown',FALSE,'selectableVariant',FALSE,'taxonomyControlled',FALSE,
      'anatomyComplete',FALSE,'difficultyComplete',FALSE,'loadComplete',FALSE,
      'fatigueRecoveryComplete',FALSE,'constraintsComplete',FALSE,
      'deliveryComplete',FALSE,'durationComplete',FALSE,
      'cumulativeFatigueAndImpactBudgetComplete',FALSE,
      'substitutionValidationComplete',FALSE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE)
    ELSE jsonb_build_object(
      'identityKnown',TRUE,'selectableVariant',TRUE,'taxonomyControlled',TRUE,
      'anatomyComplete',TRUE,'difficultyComplete',TRUE,'loadComplete',TRUE,
      'fatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'deliveryComplete',TRUE,'durationComplete',TRUE,
      'cumulativeFatigueAndImpactBudgetComplete',TRUE,
      'substitutionValidationComplete',TRUE,'athleteSupportComplete',TRUE,
      'coachSupportComplete',TRUE,'stopRulesComplete',TRUE,
      'mediaCandidateSetComplete',TRUE,'mediaApprovalComplete',FALSE,
      'graphReviewComplete',FALSE,'calibrationReviewComplete',FALSE,
      'exerciseSkillLevelAbsent',TRUE,'publicationApproved',FALSE) END,
    CASE WHEN definition.id=source_id THEN jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-01',
        'message','Stance, direction, hands, release, target, return, finish, and side contract are unresolved.'),
      jsonb_build_object('code','CARD-DIFFICULTY-01',
        'message','Exercise complexity and physical difficulty cannot be scored for an undefined task.'),
      jsonb_build_object('code','CARD-DELIVERY-01',
        'message','No selectable dose, duration, logistics, or rendering profile is permitted.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Adjacent media cannot establish the missing identity.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Archived source is intentionally nonprescribable.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A human must approve healthy exact-match demonstrations for this card version and variant.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must review and approve substitution proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Independent difficulty calibration and reviewer approval are required.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Publication remains blocked until every human quality gate passes.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
     WHERE definition.id=ANY(all_ids)
       AND definition.provenance_json->>'scoopTossIdentityMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=forward_id AND status='review' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=source_id AND status='archived' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=rotational_id AND status='review' AND card_version=2) THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.reviewed_card_version=2
       AND evidence.review_status='candidate'
       AND evidence.claims_json @> jsonb_build_array(
         jsonb_build_object('researchBatch',research_batch)))<>48
    OR EXISTS(SELECT 1 FROM unnest(all_ids) ids(definition_id)
       WHERE(SELECT count(DISTINCT evidence.section_key)
         FROM coaching.exercise_section_evidence_v1 evidence
         WHERE evidence.definition_id=ids.definition_id
           AND evidence.reviewed_card_version=2
           AND evidence.review_status='candidate'
           AND evidence.claims_json @> jsonb_build_array(
             jsonb_build_object('researchBatch',research_batch)))<>16) THEN
    RAISE EXCEPTION '% expected 16 current evidence sections per card',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id=ANY(all_ids)
       AND media.reviewed_card_version=2
       AND media.video_id=ANY(ARRAY[
         'wPEYsRVChNE','UmLEPjElr4s','npqgpBmI0ys','GaUjwlJYWtw','aAeQkR2uDmo',
         '3TSv1SaUpOA','LIQVEVwjAqU','xmQfXggU2mU','V2MTAlOxXVU','mxf1D3NtxMo'])
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>13 THEN
    RAISE EXCEPTION '% expected 13 healthy candidate-only media rows',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
     WHERE alternate.definition_id=forward_id
       AND alternate.reviewed_card_version=2
       AND alternate.review_status='candidate')<8
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=rotational_id
         AND alternate.reviewed_card_version=2
         AND alternate.review_status='candidate')<8
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=source_id
         AND alternate.reviewed_card_version=2
         AND alternate.review_status='candidate')<7 THEN
    RAISE EXCEPTION '% found incomplete alternate assessments',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.id IN(forward_variant_id,rotational_scoop_variant_id)
       AND variant.status='review'
       AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
         =greatest(
           (variant.difficulty_json->>'technicalComplexity')::INTEGER,
           (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>2
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=forward_id AND variant.status='review')<>1
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=source_id AND variant.status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.id IN(forward_variant_id,rotational_scoop_variant_id)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id IN(forward_variant_id,rotational_scoop_variant_id)
       AND profile.status='review'
       AND profile.equipment_required=ARRAY['medicine_ball']::TEXT[])<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id IN(forward_variant_id,rotational_scoop_variant_id)
         AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review' AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
       WHERE relationship.from_variant_id IN(forward_variant_id,rotational_scoop_variant_id)
         AND relationship.to_variant_id IN(forward_variant_id,rotational_scoop_variant_id)
         AND relationship.relationship='lateral_substitution'
         AND relationship.review_status='review'
         AND relationship.reviewed_by IS NULL
         AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected complete profiles, calibration, and graph proposals',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.survivor_definition_id=ANY(ARRAY[source_id,forward_id])
         AND resolution.resolved_definition_id=ANY(ARRAY[source_id,forward_id])
         AND resolution.decision='needs_human_review'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'retirementMigration'=migration_key)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.survivor_definition_id=forward_id
         AND resolution.resolved_definition_id=rotational_id
         AND resolution.decision='distinct_exercises'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.survivor_definition_id=source_id
         AND resolution.resolved_definition_id=rotational_id
         AND resolution.decision='needs_human_review'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key) THEN
    RAISE EXCEPTION '% failed to preserve source uncertainty and exact boundary',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise exercise
       WHERE exercise.facility_id=1 AND exercise.id=732
         AND exercise.archived IS FALSE AND exercise.is_published IS TRUE
         AND exercise.skill_level IS NULL)
    OR(SELECT count(*) FROM coaching.exercise exercise
       WHERE exercise.facility_id=1 AND exercise.id IN(355,1153,1322)
         AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
         AND exercise.skill_level IS NULL)<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(355,732,1153,1322)
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE)<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(all_ids)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           definition.anatomy_json,definition.athlete_support_json,
           definition.coach_support_json,definition.support_operations_json,
           definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
       WHERE media.definition_id=ANY(all_ids)
         AND(media.review_status IN('approved','shortlisted','rejected')
           OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
           OR media.exact_variant_match IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
