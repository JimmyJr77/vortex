-- Retire two ambiguous quarter-turn source cards and author exact bilateral and
-- same-leg unilateral definitions. Availability-checked media, graph edges,
-- calibration scores, and all card content remain review-only. Exercise cards
-- use complexity and physical difficulty; athlete proficiency is excluded.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '432_coaching_quarter_turn_jump_hop_identity_resolution';
  research_batch CONSTANT TEXT := 'quarter-turn-jump-hop-identity-v1';
  research_version CONSTANT TEXT := '2026-08-01.10';
  bilateral_id CONSTANT UUID :=
    'c66bd9c5-a3f9-4afe-bdde-68c4d2904a04'::UUID;
  unilateral_id CONSTANT UUID :=
    'e6be6032-cd3d-4453-84f0-70d764c2dbe1'::UUID;
  bilateral_variant_id CONSTANT UUID :=
    '0964189d-54b2-4154-812c-2503544b8511'::UUID;
  unilateral_variant_id CONSTANT UUID :=
    'bd069f6c-d0a5-4b75-94b3-55c1ad1f49f4'::UUID;
  hop_source_id UUID;
  jump_source_id UUID;
  half_turn_id UUID;
  source_ids UUID[];
  exact_ids UUID[] := ARRAY[bilateral_id,unilateral_id];
  all_ids UUID[];
  applied_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT id INTO hop_source_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='90-degree-hop-to-stick';
  SELECT id INTO jump_source_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='90-degree-jump-turn-to-stick';
  SELECT id INTO half_turn_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='180-jump-to-stick';
  IF hop_source_id IS NULL OR jump_source_id IS NULL OR half_turn_id IS NULL THEN
    RAISE EXCEPTION '% requires both source cards and the half-turn boundary card',
      migration_key;
  END IF;
  source_ids := ARRAY[hop_source_id,jump_source_id];
  all_ids := source_ids||exact_ids;

  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
     WHERE source.definition_id=ANY(source_ids)
       AND source.legacy_exercise_id IN(1489,1512))<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 source
       WHERE source.definition_id=ANY(source_ids)
         AND source.legacy_exercise_id NOT IN(1489,1512)) THEN
    RAISE EXCEPTION '% requires exactly legacy sources 1489 and 1512',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
     WHERE definition.facility_id=1
       AND definition.slug='two-foot-quarter-turn-jump-to-stick'
       AND definition.id<>bilateral_id)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
       WHERE definition.facility_id=1
         AND definition.slug='single-leg-quarter-turn-hop-to-stick'
         AND definition.id<>unilateral_id) THEN
    RAISE EXCEPTION '% found an unexpected exact definition identity',
      migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND definition.provenance_json->>'quarterTurnIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,4) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF applied_count=0 THEN
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(source_ids)
         AND definition.status='review' AND definition.card_version=1)<>2
      OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
         WHERE definition.id=ANY(exact_ids)) THEN
      RAISE EXCEPTION '% expected two version-1 sources and no exact definitions',
        migration_key;
    END IF;
  ELSE
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(source_ids)
         AND definition.status='archived' AND definition.card_version=2)<>2
      OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
         WHERE definition.id=ANY(exact_ids)
           AND definition.status='review' AND definition.card_version=1)<>2 THEN
      RAISE EXCEPTION '% found prior-application state drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.resolution_source='human_review'
       AND resolution.reviewed_by IS NOT NULL
       AND(resolution.survivor_definition_id=ANY(all_ids)
         OR resolution.resolved_definition_id=ANY(all_ids))) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
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
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=ANY(all_ids)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id=ANY(all_ids))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id=ANY(all_ids))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id=ANY(all_ids))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id=ANY(all_ids) AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=ANY(all_ids) AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id=ANY(all_ids) AND(
        relationship.review_status<>'review'
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id=ANY(all_ids) AND(
        calibration.status<>'review'
        OR calibration.reviewed_by IS NOT NULL
        OR calibration.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF applied_count=0 THEN
    UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=ANY(source_ids) AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=ANY(source_ids) AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=ANY(source_ids) AND review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id AND variant.definition_id=ANY(all_ids);
  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',updated_at=now()
  WHERE variant.definition_id=ANY(all_ids);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at)
  VALUES
    (bilateral_id,1,NULL,'two-foot-quarter-turn-jump-to-stick',
      'Two-Foot Quarter-Turn Jump to Stick',
      'Two-Foot Quarter-Turn Jump to Stick',
      ARRAY['Bilateral 90-Degree Jump Turn to Stick',
        'Two-Leg 90-Degree Jump Turn and Stick'],
      'From a stationary two-foot stance, take off from both feet together, turn exactly 90 degrees in the declared direction with minimal horizontal displacement, land on both feet together facing the target orientation, hold under control, and reset before the next attempt.',
      'quarter_turn_jump_landing_control','1.0.0',1,'review',94,74,58,
      ARRAY['jump','rotate','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY[]::TEXT[],ARRAY['floor_markers','orientation_target','video_capture'],
      '{}'::JSONB,'{}'::JSONB,
      jsonb_build_object('canonicalAuthoredFromResearch',TRUE),
      NULL,NULL,NULL,NULL),
    (unilateral_id,1,NULL,'single-leg-quarter-turn-hop-to-stick',
      'Single-Leg Quarter-Turn Hop to Stick',
      'Single-Leg Quarter-Turn Hop to Stick',
      ARRAY['Single-Leg 90-Degree Hop and Stick',
        'Same-Leg Quarter-Turn Hop to Stick'],
      'From a stationary stance on one declared leg, take off from that leg, turn exactly 90 degrees in the declared direction with minimal horizontal displacement, land on the same leg facing the target orientation, hold under control, then reset before changing side or attempting again.',
      'quarter_turn_hop_landing_control','1.0.0',1,'review',94,74,58,
      ARRAY['hop','rotate','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY[]::TEXT[],ARRAY['floor_markers','orientation_target','video_capture'],
      '{}'::JSONB,'{}'::JSONB,
      jsonb_build_object('canonicalAuthoredFromResearch',TRUE),
      NULL,NULL,NULL,NULL)
  ON CONFLICT(id) DO NOTHING;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name=CASE definition.id WHEN hop_source_id
      THEN '90-Degree Hop to Stick (Unresolved Legacy)'
      ELSE '90-Degree Jump Turn to Stick (Unresolved Legacy)' END,
    display_name=CASE definition.id WHEN hop_source_id
      THEN '90-Degree Hop to Stick (Unresolved Legacy)'
      ELSE '90-Degree Jump Turn to Stick (Unresolved Legacy)' END,
    description=CASE definition.id WHEN hop_source_id THEN
      'Archived nonprescribable source. The source says jump or bound and does not declare takeoff foot count, landing foot count or leg, displacement, turn direction, hold criterion, side accounting, or reset.'
      ELSE 'Archived nonprescribable source. The source does not declare takeoff foot count, landing foot count or leg, displacement, turn direction, hold criterion, or reset.' END,
    family_key='unresolved_quarter_turn_jump_hop_identity',
    content_confidence=94,scoring_confidence=1,media_confidence=42,
    movement_patterns=ARRAY['jump','rotate','land'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'known',jsonb_build_array('quarter_turn_wording','terminal_stick_wording'),
      'unresolved',jsonb_build_array(
        'takeoff_foot_count','landing_foot_count','landing_leg','displacement',
        'turn_direction','hold_criterion','side_accounting','reset')),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness and impact exposure cannot be matched to an undefined takeoff and landing contract',
      'supportPath','choose_an_exact_reviewed_quarter_turn_card'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'generic_lower_limb_jump_landing_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'blocked_pending_takeoff_landing_and_displacement_contract'),
      'planes',jsonb_build_array('transverse_reorientation_known_other_planes_unresolved'),
      'laterality','unresolved_bilateral_unilateral_or_mixed',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This source can mean materially different takeoff and landing tasks and is unavailable until an exact card is selected.',
      'primaryCue','Ask for the exact two-foot or same-leg quarter-turn card.',
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'pain','instability','joint_pinching','numbness','dizziness'),
      'painGuidance','Do not begin from this unresolved card; stop any replacement exercise for symptoms or unsafe landing control.',
      'selfChecks',jsonb_build_array(
        'takeoff and landing feet are declared','turn direction and target are visible',
        'hold and reset are declared'),
      'accessibility',jsonb_build_array(
        'plain_language_retirement_explanation','text_first_exact_alternatives'),
      'mediaAlternatives',jsonb_build_array(
        'missing_identity_explanation','coach_selected_exact_card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'takeoff_feet','landing_feet','landing_leg','rotation_degrees',
        'displacement','turn_direction','hold','side_accounting','reset'),
      'faultCorrections',jsonb_build_array(
        'Do not cue, dose, or demonstrate until every identity field is declared.'),
      'demonstrationPlan',jsonb_build_array(
        'Explain the ambiguous lineage','Open the exact replacement card'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'two_foot_two_foot','choose_two_foot_quarter_turn_jump_to_stick',
        'same_leg','choose_single_leg_quarter_turn_hop_to_stick',
        'other','choose_or_author_a_separate_exact_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','takeoff_support','landing_support','turn','terminal_action'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','unsafe_surface_or_collision')),
      'retentionPolicy','Preserve source mappings, original wording, aliases, evidence, media, and queue decisions.',
      'changeImpactPolicy','Do not reactivate without exact takeoff, landing, displacement, turn, hold, side, and reset evidence.',
      'knownLimitations',jsonb_build_array(
        'undefined_takeoff_and_landing_contract','no_exact_reviewed_media'),
      'supportSummary','Retirement is deliberate; never infer foot count from hop or jump wording.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'quarterTurnIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition
  SET status='review',card_version=1,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name=CASE definition.id WHEN bilateral_id
      THEN 'Two-Foot Quarter-Turn Jump to Stick'
      ELSE 'Single-Leg Quarter-Turn Hop to Stick' END,
    display_name=CASE definition.id WHEN bilateral_id
      THEN 'Two-Foot Quarter-Turn Jump to Stick'
      ELSE 'Single-Leg Quarter-Turn Hop to Stick' END,
    family_key=CASE definition.id WHEN bilateral_id
      THEN 'quarter_turn_jump_landing_control'
      ELSE 'quarter_turn_hop_landing_control' END,
    content_confidence=94,scoring_confidence=74,media_confidence=58,
    movement_patterns=CASE definition.id WHEN bilateral_id
      THEN ARRAY['jump','rotate','land','stabilize']
      ELSE ARRAY['hop','rotate','land','stabilize'] END,
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['floor_markers','orientation_target','video_capture'],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'level_high_traction_resilient_surface','clear_takeoff_and_landing_zone',
        'visible_target_orientation','safe_footwear','no_cross_traffic',
        'space_for_unplanned_recovery_step'),
      'displacement','minimal_horizontal_displacement',
      'rotationDegrees',90,
      'groupLayout',jsonb_build_object(
        'oneAthletePerMarkedZone',TRUE,'coachSightlineRequired',TRUE)),
    population_json=jsonb_build_object(
      'requires',CASE definition.id WHEN bilateral_id THEN jsonb_build_array(
        'pain_free_two_foot_takeoff_and_landing','controlled_snap_down_and_stick',
        'ability_to_reorient_90_degrees_and_stop_on_command',
        'tolerance_for_planned_bilateral_landing_contacts') ELSE jsonb_build_array(
        'pain_free_single_leg_takeoff_and_same_leg_landing',
        'controlled_single_leg_land_and_hold',
        'ability_to_reorient_90_degrees_and_stop_on_command',
        'tolerance_for_planned_unilateral_landing_contacts') END,
      'screen',jsonb_build_array(
        'current_lower_limb_or_back_pain','recent_injury_or_restriction',
        'bone_stress_or_tendon_irritability','dizziness_or_balance_concern',
        'accumulated_jump_running_and_change_of_direction_contacts'),
      'individualize',jsonb_build_array(
        'jump_height','attempts','hold_seconds','rest','turn_direction',
        'surface','session_impact_budget'),
      'notMedicalClearance','Symptoms or return-to-sport restrictions require the appropriate clinician or policy process.'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'gluteus_maximus','gluteus_medius','quadriceps','hamstrings',
        'soleus','gastrocnemius','intrinsic_foot_muscles'),
      'secondaryMuscles',jsonb_build_array(
        'hip_rotators','hip_adductors','fibularis_group','tibialis_anterior',
        'obliques','deep_trunk_stabilizers','spinal_extensors'),
      'joints',jsonb_build_array(
        'metatarsophalangeal','talocrural','subtalar','knee','hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'ankle_plantarflexion_dorsiflexion','knee_flexion_extension',
        'hip_flexion_extension','hip_frontal_and_transverse_stabilization',
        'pelvis_and_trunk_axial_reorientation','landing_deceleration_and_stabilization'),
      'planes',jsonb_build_array(
        'transverse_aerial_reorientation','sagittal_takeoff_and_landing',
        'frontal_landing_alignment_control'),
      'laterality',CASE definition.id WHEN bilateral_id
        THEN 'bilateral_simultaneous_takeoff_and_landing'
        ELSE 'unilateral_same_leg_takeoff_and_landing_sides_programmed' END),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds controlled aerial reorientation and a stable direction-specific landing without turning the task into fatigue work.',
      'primaryCue',CASE definition.id WHEN bilateral_id
        THEN 'Jump from two feet, turn one quarter, land on two feet, and freeze under control.'
        ELSE 'Hop from one leg, turn one quarter, land on the same leg, and freeze under control.' END,
      'expectedSensations',jsonb_build_array(
        'brief_powerful_takeoff','whole_body_turn','controlled_lower_limb_braking','balance_demand'),
      'unexpectedSensations',jsonb_build_array(
        'pain','joint_pinching','giving_way','numbness','dizziness','disorientation'),
      'painGuidance','Stop immediately for symptoms, unsafe landing, or loss of orientation; do not push through pain.',
      'selfChecks',CASE definition.id WHEN bilateral_id THEN jsonb_build_array(
        'both_feet_leave_together','turn_finishes_at_target','both_feet_land_together',
        'landing_is_quiet_and_aligned','hold_is_completed_without_step') ELSE jsonb_build_array(
        'declared_leg_takes_off','turn_finishes_at_target','same_leg_lands',
        'landing_is_quiet_and_aligned','hold_is_completed_without_step') END,
      'accessibility',jsonb_build_array(
        'lower_jump_height','fewer_attempts','longer_rest','larger_visual_target',
        'reviewed_lower_impact_substitution','text_still_image_audio_or_live_instruction'),
      'mediaAlternatives',jsonb_build_array(
        'foot_contract_diagram','quarter_turn_target_diagram','coach_demonstration')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'start_orientation','takeoff_feet','rotation_degrees','turn_direction',
        'horizontal_displacement','landing_feet_or_leg','landing_noise',
        'foot_knee_hip_alignment','trunk_orientation','hold','symptoms','reset'),
      'faultCorrections',jsonb_build_array(
        'Reduce height and attempts when turn or landing control changes.',
        'Use a larger visual target and rehearse the exact foot contract before flight.',
        'End the set rather than accepting under-rotation, over-rotation, wrong-foot landing, or a balance step.'),
      'demonstrationPlan',jsonb_build_array(
        'Show start and target orientation.','Show takeoff and landing feet.',
        'Show exactly 90 degrees, the terminal hold, and full reset.'),
      'groupManagement',jsonb_build_object(
        'oneAthletePerMarkedZone',TRUE,'coachSightlineRequired',TRUE,
        'startStopSignalRequired',TRUE,'impactAndSideBudgetTracked',TRUE),
      'modificationDecisionTree',jsonb_build_object(
        'turn_or_landing_quality_loss','reduce_height_or_attempts_and_increase_rest',
        'cannot_meet_foot_contract','use_reviewed_lower_level_substitute',
        'symptoms_or_disorientation','stop_and_follow_support_or_clinical_process'),
      'doNotUseWhen',jsonb_build_array(
        'pain_or_instability','unsafe_surface_space_or_traffic',
        'cannot_meet_takeoff_and_landing_contract','impact_budget_exhausted',
        'coach_cannot_monitor_required_zone')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','takeoff_support','landing_support','turn','dose','impact',
        'symptoms','media','accessibility'),
      'supportEscalation',jsonb_build_object(
        'coachReview',jsonb_build_array(
          'foot_contract_or_turn_unclear','repeated_quality_failure','substitution_needed'),
        'contentReview',jsonb_build_array(
          'source_conflict','media_mismatch','taxonomy_or_score_dispute'),
        'urgent',jsonb_build_array('injury_event','unsafe_surface_or_collision')),
      'retentionPolicy','Retain exact variant, takeoff and landing support, turn direction, side, height, attempts, rest, symptoms, substitutions, and stop reason with the workout version.',
      'changeImpactPolicy','Takeoff support, landing support, landing leg, displacement, rotation magnitude, approach, obstacle, or terminal action changes require identity review and workout revalidation.',
      'knownLimitations',jsonb_build_array(
        'candidate_media_not_human_approved','difficulty_not_independently_calibrated'),
      'supportSummary','Never silently change takeoff feet, landing feet or leg, rotation magnitude, displacement, or terminal action.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'quarterTurnIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','canonical_authored_from_research_without_legacy_mapping',
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/',
        'https://pubmed.ncbi.nlm.nih.gov/17620779/'),
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=ANY(exact_ids);

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT seed.variant_id,seed.definition_id,seed.variant_key,seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',seed.complexity,
      'absoluteLoadDemand',seed.physical,
      'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
      'coordinationDemand',seed.complexity+6,
      'supervisionDemand',CASE WHEN seed.laterality='bilateral' THEN 58 ELSE 68 END,
      'failureConsequence',CASE WHEN seed.laterality='bilateral' THEN 72 ELSE 78 END,
      'impact',CASE WHEN seed.laterality='bilateral' THEN 64 ELSE 72 END,
      'workCapacityDemand',CASE WHEN seed.laterality='bilateral' THEN 38 ELSE 42 END,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty'),
      'athleteProficiencyExcluded',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base','stationary_quarter_turn_takeoff_and_stick',
      'takeoffFootCount',CASE WHEN seed.laterality='bilateral' THEN 2 ELSE 1 END,
      'landingFootCount',CASE WHEN seed.laterality='bilateral' THEN 2 ELSE 1 END,
      'landingLeg',CASE WHEN seed.laterality='bilateral'
        THEN 'both_together' ELSE 'same_as_takeoff' END,
      'laterality',seed.laterality,'rotationDegrees',90,
      'turnDirection','declared_before_attempt',
      'displacement','minimal_horizontal_displacement',
      'terminalAction','controlled_stick_then_full_reset',
      'sideAccounting',CASE WHEN seed.laterality='bilateral'
        THEN 'clockwise_and_counterclockwise_directions_declared'
        ELSE 'takeoff_leg_and_turn_direction_recorded' END,
      'surface','level_high_traction_resilient','equipmentRequired',jsonb_build_array('none')),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight','impactLevel',3,
      'landingContactsPerRep',CASE WHEN seed.laterality='bilateral' THEN 2 ELSE 1 END,
      'exposureMetric',CASE WHEN seed.laterality='bilateral'
        THEN 'total_bilateral_landing_events_and_foot_contacts'
        ELSE 'total_unilateral_landing_contacts_by_leg_and_turn_direction' END,
      'gripDemand','none','spinalLoading','low_dynamic',
      'eccentricStress',CASE WHEN seed.laterality='bilateral'
        THEN 'moderate_to_high_landing' ELSE 'high_unilateral_landing' END,
      'loadTracking',jsonb_build_array(
        'attempts','landing_contacts','takeoff_and_landing_support','turn_direction',
        'jump_height','hold_seconds','rest','surface','quality','symptoms'),
      'doNotInfer',jsonb_build_array(
        'force_threshold','safe_joint_angle','injury_risk_prediction')),
    jsonb_build_object(
      'localMuscleFatigue',CASE WHEN seed.laterality='bilateral' THEN 52 ELSE 62 END,
      'gripFatigue',0,
      'technicalFatigueSensitivity',CASE WHEN seed.laterality='bilateral' THEN 72 ELSE 80 END,
      'impactAccumulation',CASE WHEN seed.laterality='bilateral' THEN 64 ELSE 74 END,
      'recoveryHours',CASE WHEN seed.laterality='bilateral' THEN 24 ELSE 36 END,
      'primaryFatigueSites',jsonb_build_array(
        'foot_ankle_complex','calves_and_Achilles','quadriceps','hamstrings',
        'hip_stabilizers','trunk_stabilizers'),
      'stopBefore',jsonb_build_array(
        'pain_or_instability','disorientation','wrong_foot_contact',
        'under_or_over_rotation','loud_or_stiff_landing','alignment_loss',
        'failed_hold','fatigue_drift','unsafe_surface_space_or_traffic')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'quarter_turn_aerial_orientation','landing_deceleration',
        'terminal_stabilization','direction_specific_body_control'),
      'stimulusDose',jsonb_build_object(
        'primary','fully_reset_quality_attempts','fatigueCeiling','low'),
      'weeklyExposure',jsonb_build_object(
        'typical',1,'maximumWithoutReview',2,'allLandingContactsCount',TRUE),
      'prerequisites',CASE WHEN seed.laterality='bilateral' THEN jsonb_build_array(
        'pain_free_two_foot_jump_and_landing','controlled_snap_down_and_stick',
        'safe_surface_and_marked_zone','ability_to_stop_on_command') ELSE jsonb_build_array(
        'pain_free_single_leg_hop_and_same_leg_landing',
        'controlled_single_leg_land_and_hold','safe_surface_and_marked_zone',
        'ability_to_stop_on_command') END,
      'completionCriteria',jsonb_build_array(
        'exact_takeoff_support','exact_90_degree_reorientation',
        'exact_landing_support','quiet_aligned_landing',
        'declared_hold_completed','full_reset'),
      'sequenceRules',jsonb_build_array(
        'after_specific_warmup','while_fresh','before_heavy_lower_body_fatigue',
        'before_dense_conditioning'),
      'pairingCompatibility',jsonb_build_object(
        'preferred',jsonb_build_array('upper_body_strength','low_fatigue_mobility'),
        'avoid',jsonb_build_array('dense_jumping_running_cutting_or_landing_fatigue')),
      'interferenceRules',jsonb_build_array(
        'counts_toward_jump_landing_ankle_knee_hip_tendon_and_neural_budgets'),
      'uncertaintyPolicy',jsonb_build_object(
        'foot_contract_or_turn_unclear','do_not_start',
        'surface_symptoms_or_budget_unclear','stop_and_review'),
      'cumulativeBudget',jsonb_build_object(
        'landingContacts',CASE WHEN seed.laterality='bilateral'
          THEN 'count_landing_events_and_two_foot_contacts'
          ELSE 'count_each_same_leg_landing_by_side_and_turn_direction' END,
        'technicalSensitivity',CASE WHEN seed.laterality='bilateral' THEN 72 ELSE 80 END,
        'impactLevel',3))
  FROM(VALUES
    (bilateral_variant_id,bilateral_id,
      'stationary-two-foot-quarter-turn-two-foot-stick',
      'Stationary Two-Foot Quarter-Turn to Two-Foot Stick',
      ARRAY['stationary','bilateral_takeoff','quarter_turn','bilateral_landing','stick'],
      'bilateral',58,56),
    (unilateral_variant_id,unilateral_id,
      'stationary-same-leg-quarter-turn-stick',
      'Stationary Same-Leg Quarter-Turn Hop to Stick',
      ARRAY['stationary','single_leg_takeoff','quarter_turn','same_leg_landing','stick'],
      'unilateral_same_leg',68,64)
  ) seed(variant_id,definition_id,variant_key,display_name,modifier_keys,
    laterality,complexity,physical)
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
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      CASE profile.profile_key
        WHEN 'output-quarter-turn-quality' THEN
          'Fresh bilateral quarter-turn output and two-foot landing-control quality.'
        ELSE 'Low-volume bilateral orientation and landing-control preparation.' END
      ELSE CASE profile.profile_key
        WHEN 'output-quarter-turn-quality' THEN
          'Fresh same-leg quarter-turn output, unilateral braking, and stabilization quality.'
        ELSE 'Low-volume same-leg orientation and landing-control preparation.' END END,
    profile.suitability,profile.alignment,
    jsonb_build_object(
      'quarter_turn_orientation',profile.relevance,
      'landing_control',profile.relevance,
      'fatigue_conditioning',5),
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      jsonb_build_object(
        'sets',profile.sets,'attemptsPerTurnDirection',profile.attempts,
        'turnDirections',jsonb_build_array('clockwise','counterclockwise'),
        'holdSeconds',profile.hold_seconds,'restSeconds',profile.rest_seconds,
        'maximumLandingEvents',profile.sets*profile.attempts*2,
        'maximumFootContacts',(profile.sets*profile.attempts*2)*2,
        'rpeRange',jsonb_build_array(3,6),'fullReset',TRUE)
      ELSE jsonb_build_object(
        'sets',profile.sets,'attemptsPerLegAndTurnDirection',profile.attempts,
        'legs',jsonb_build_array('left','right'),
        'turnDirections','declare_and_balance_when_tolerated',
        'holdSeconds',profile.hold_seconds,'restSeconds',profile.rest_seconds,
        'maximumUnilateralLandingContacts',profile.sets*profile.attempts*4,
        'rpeRange',jsonb_build_array(3,6),'fullReset',TRUE) END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'Both feet leave and land together, the body finishes at the exact quarter-turn target with minimal displacement, contact is quiet and aligned, the hold is completed without a step, and the athlete fully resets.'
      ELSE 'The declared leg takes off and the same leg lands, the body finishes at the exact quarter-turn target with minimal displacement, contact is quiet and aligned, the hold is completed without a step, and the athlete fully resets.' END,
    ARRAY[
      'Stop for pain, instability, giving way, numbness, dizziness, or disorientation.',
      'Stop for wrong-foot takeoff or landing, under- or over-rotation, excessive drift, loud or stiff impact, alignment loss, or a failed hold.',
      'Stop when fatigue changes height, turn, landing, or reset, or when surface, spacing, traffic, or the remaining impact budget is unsafe.'],
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'Mark start and target orientation. Declare turn direction, attempts, height, hold, rest, and impact cap. Verify both feet take off and land together, count every landing event and both foot contacts, and end the set at the first failed gate.'
      ELSE 'Mark start and target orientation. Declare takeoff leg, turn direction, attempts per side, height, hold, rest, and impact cap. Verify same-leg takeoff and landing, count every unilateral contact by side, and end the set at the first failed gate.' END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'Start on two feet, jump and turn one quarter, land on two feet facing the target, freeze, then reset.'
      ELSE 'Start on the declared leg, hop and turn one quarter, land on the same leg facing the target, freeze, then reset.' END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'Repeatable two-foot quarter-turn aerial orientation and bilateral terminal landing control.'
      ELSE 'Repeatable same-leg quarter-turn aerial orientation, unilateral braking, and terminal stabilization.' END,
    ARRAY['none'],
    jsonb_build_object(
      'stationSeconds',240,'athletesPerStation',1,'setupSeconds',45,
      'transitionSeconds',30,'oneAthletePerMarkedZone',TRUE,
      'visibleStartAndTargetRequired',TRUE,'recoveryStepSpaceRequired',TRUE,
      'coachSightlineRequired',TRUE,'sharedStartStopSignalRequired',TRUE),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'attemptSeconds',jsonb_build_object('minimum',2,'maximum',8),
      'holdSeconds',profile.hold_seconds,
      'restSeconds',profile.rest_seconds,
      'durationInputs',jsonb_build_array(
        'attempts','legs','turn_directions','hold','reset','rest','setup','transition')),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'reduce_jump_height','reduce_attempts','increase_rest',
        'use_larger_visual_target','use_reviewed_lower_impact_substitute'),
      'progressOrder',jsonb_build_array(
        'complete_exact_foot_contract','complete_exact_quarter_turn',
        'complete_hold_without_step','balance_declared_directions',
        'increase_height_only_after_review'),
      'changeOneVariableAtATime',TRUE,
      'neverChangeSilently',jsonb_build_array(
        'takeoff_foot_count','landing_foot_count','landing_leg','rotation_degrees',
        'displacement','approach','obstacle_or_drop','terminal_action')),
    CASE profile.variant_id WHEN bilateral_variant_id THEN jsonb_build_object(
      'primary','completed_quality_two_foot_quarter_turn_sticks',
      'record',jsonb_build_array(
        'turn_direction','attempts','landing_events','foot_contacts','height',
        'hold','rest','surface','quality_failures','symptoms','stop_reason'),
      'failedAttemptPolicy','do_not_count_and_end_or_regress')
      ELSE jsonb_build_object(
        'primary','completed_quality_same_leg_quarter_turn_sticks',
        'record',jsonb_build_array(
          'takeoff_leg','turn_direction','attempts','unilateral_contacts','height',
          'hold','rest','surface','quality_failures','symptoms','stop_reason'),
        'failedAttemptPolicy','do_not_count_and_end_or_regress') END,
    jsonb_build_object(
      'before',jsonb_build_array(
        'Confirm exact card, foot contract, start and target, surface, space, attempts, hold, rest, and remaining impact budget.',
        'Report pain, instability, tendon or bone-stress symptoms, dizziness, or disorientation before starting.'),
      'during',jsonb_build_array(
        'Call turn, landing, hold, and stop immediately when a quality gate fails.'),
      'after',jsonb_build_array(
        'Record attempts, contacts, directions, sides when applicable, quality failures, symptoms, substitutions, and stop reason.'))
  FROM(VALUES
    (bilateral_variant_id,'output-quarter-turn-quality','output','primary',
      88,86,88,2,2,3,90),
    (bilateral_variant_id,'prepare-quarter-turn-orientation',
      'movement_intelligence','secondary',78,82,80,2,1,3,60),
    (unilateral_variant_id,'output-quarter-turn-quality','output','primary',
      86,86,88,2,1,3,105),
    (unilateral_variant_id,'prepare-quarter-turn-orientation',
      'movement_intelligence','secondary',76,82,80,1,1,3,75)
  ) profile(variant_id,profile_key,phase_key,role,suitability,alignment,
    relevance,sets,attempts,hold_seconds,rest_seconds)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,
    source_title,source_publisher,source_kind,claims_json,evidence_quality,
    review_status,reviewer_user_id,reviewed_at)
  SELECT definition.id,
    CASE WHEN definition.id=ANY(source_ids) THEN 2 ELSE 1 END,
    section.section_key,source.source_url,source.source_title,
    source.source_publisher,source.source_kind,
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_array(
      'Candidate research exposes the missing takeoff, landing, displacement, turn, hold, side, or reset contract for section '||section.section_key||'.',
      'The source is archived and nonselectable; no mapping, difficulty score, delivery profile, media approval, graph approval, calibration approval, or publication approval is created.')
    ELSE jsonb_build_array(
      'Candidate evidence was reassessed for exact foot support, 90-degree aerial orientation, minimal displacement, terminal stabilization, reset, dose, impact, support, and stop rules in section '||section.section_key||'.',
      'Difficulty contains exercise complexity and physical difficulty only; every media, graph, calibration, card, and publication approval remains human work.') END,
    source.quality,'candidate',NULL,NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN(VALUES
    ('identity'),('taxonomy'),('anatomy'),('biomechanics'),('difficulty'),
    ('load_fatigue_recovery'),('constraints'),('dosage'),('instructions'),
    ('safety_stop_rules'),('programming'),('athlete_support'),
    ('coach_support'),('accessibility'),('alternates'),('media')
  ) section(section_key)
  CROSS JOIN LATERAL(SELECT
    CASE
      WHEN section.section_key='media' THEN 'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'
      WHEN section.section_key IN('identity','difficulty') THEN 'https://pubmed.ncbi.nlm.nih.gov/17620779/'
      WHEN section.section_key IN('anatomy','biomechanics','coach_support') THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6776723/'
      WHEN section.section_key='safety_stop_rules' THEN 'https://pubmed.ncbi.nlm.nih.gov/35714032/'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10692103/'
      WHEN section.section_key IN('constraints','instructions','athlete_support') THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/'
      WHEN section.section_key='accessibility' THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11366841/'
      WHEN section.section_key='alternates' THEN 'https://pubmed.ncbi.nlm.nih.gov/32148612/'
      ELSE 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/' END source_url,
    CASE
      WHEN section.section_key='media' THEN 'Embed videos and playlists'
      WHEN section.section_key IN('identity','difficulty') THEN 'Biomechanical differences between unilateral and bilateral landings from a jump'
      WHEN section.section_key IN('anatomy','biomechanics','coach_support') THEN 'The Effects of Mid-flight Whole-Body and Trunk Rotation on Landing Mechanics'
      WHEN section.section_key='safety_stop_rules' THEN 'Entry angle during jump landing changes biomechanical risk factors for ACL injury'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'Maximizing plyometric training for adolescents'
      WHEN section.section_key IN('constraints','instructions','athlete_support') THEN 'The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings'
      WHEN section.section_key='accessibility' THEN 'Unilateral Plyometric Jump Training and Single-Leg Landing Stabilization'
      WHEN section.section_key='alternates' THEN 'Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics'
      ELSE 'Effects of Plyometric Jump Training on the Reactive Strength Index' END source_title,
    CASE
      WHEN section.section_key='media' THEN 'YouTube Help'
      WHEN section.section_key IN('identity','difficulty') THEN 'Clinical Journal of Sport Medicine'
      WHEN section.section_key IN('anatomy','biomechanics','coach_support') THEN 'Journal of Biomechanics'
      WHEN section.section_key='safety_stop_rules' THEN 'Sports Biomechanics'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'Scientific Reports'
      WHEN section.section_key IN('constraints','instructions','athlete_support') THEN 'International Journal of Sports Physical Therapy'
      WHEN section.section_key='accessibility' THEN 'Journal of Sports Science and Medicine'
      WHEN section.section_key='alternates' THEN 'International Journal of Sports Physical Therapy'
      ELSE 'Sports Medicine' END source_publisher,
    CASE WHEN section.section_key='media' THEN 'manufacturer_instruction'
      ELSE 'peer_reviewed_research' END source_kind,
    CASE WHEN section.section_key='media' THEN 82
      WHEN section.section_key IN('anatomy','biomechanics','coach_support') THEN 91
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 94
      WHEN section.section_key IN('identity','difficulty') THEN 83
      WHEN section.section_key='safety_stop_rules' THEN 88
      WHEN section.section_key='accessibility' THEN 90
      ELSE 88 END::SMALLINT quality
  ) source
  WHERE definition.id=ANY(all_ids)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,
    CASE WHEN definition.id=ANY(source_ids) THEN 2 ELSE 1 END,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel_name,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,NULL,
    media.notes
  FROM(VALUES
    ('two-foot-quarter-turn-jump-to-stick','ahWJBrYwLZQ','2 Leg 90 degree jump turn w/ stick','Juddson Smith','double leg 90 degree jump turn stick','oEmbed verified 2026-08-01T20:00:00Z. Exact displacement, landing contract, quality, safety, accessibility, reviewer, and approval remain unresolved.'),
    ('two-foot-quarter-turn-jump-to-stick','3m_MLGVU7QI','Rotational Jump to Stick - 90 Degrees','Trainer Stone','90 degree rotational jump to stick','Title-level quarter-turn stick candidate; exact foot contract and all human gates remain unresolved.'),
    ('two-foot-quarter-turn-jump-to-stick','jWkcwNFR1Ys','Rotational Vertical Jump to Stick','Performance Unlimited','rotational vertical jump to stick','Title-level vertical rotational stick candidate; exact rotation and foot contract require human review.'),
    ('two-foot-quarter-turn-jump-to-stick','i3xHgNclSsc','90 deg Rotational CM Vertical Jump + Stick (Landing)','Depth Training and Physiotherapy Waterloo','90 degree countermovement vertical jump stick','Title-level countermovement quarter-turn candidate; complete quality review remains unresolved.'),
    ('two-foot-quarter-turn-jump-to-stick','Lclpj8Y_utg','Vertical Jump w/90 Degree Turn Landing','Queens College Knight Strength','vertical jump 90 degree turn landing','Title-level quarter-turn landing candidate; terminal hold and all human review fields remain unresolved.'),
    ('single-leg-quarter-turn-hop-to-stick','jsSDIET2dOI','Hop Rotations | Single Leg Hop & Stick with 90 Degree Turn','Simple Speed Coach','single leg 90 degree hop stick landing','Title-level single-leg quarter-turn stick candidate; same-leg landing and all human gates require review.'),
    ('single-leg-quarter-turn-hop-to-stick','Q4JOjWp2dLk','Single Leg 90 Hop and Stick.MP4','YUStrength','single leg 90 hop and stick','Title-level single-leg candidate; exact same-leg contract and all human gates remain unresolved.'),
    ('single-leg-quarter-turn-hop-to-stick','Jd2jKgmVJPc','Single Leg Hops (90 Degree Turn)','Limitless Performance Training','single leg hops 90 degree turn','Title-level single-leg turn candidate; terminal hold and complete review remain unresolved.'),
    ('single-leg-quarter-turn-hop-to-stick','Zo888b5Kcy8','Single Leg 90 Degree Hop','17th STS Resiliency & Human Performance','single leg 90 degree hop','Title-level single-leg candidate; landing leg and terminal hold require human review.'),
    ('single-leg-quarter-turn-hop-to-stick','1qUTJfTEU-A','Single Leg 90*Rotational Jump - Single Leg Landing (Same Leg - Same Turn)','Coach Miguez Sports Performance Training','single leg 90 rotational same leg landing','Title-level same-leg candidate; complete playback, quality, accessibility, reviewer, and approval remain unresolved.'),
    ('90-degree-hop-to-stick','ahWJBrYwLZQ','2 Leg 90 degree jump turn w/ stick','Juddson Smith','90 degree hop to stick interpretation','Bilateral interpretation candidate; it cannot establish the ambiguous source contract.'),
    ('90-degree-hop-to-stick','jsSDIET2dOI','Hop Rotations | Single Leg Hop & Stick with 90 Degree Turn','Simple Speed Coach','90 degree hop to stick interpretation','Unilateral interpretation candidate; it cannot establish the ambiguous source contract.'),
    ('90-degree-hop-to-stick','3m_MLGVU7QI','Rotational Jump to Stick - 90 Degrees','Trainer Stone','90 degree rotational jump stick','Foot-count-unspecified title candidate; no exact-match decision or approval.'),
    ('90-degree-jump-turn-to-stick','ahWJBrYwLZQ','2 Leg 90 degree jump turn w/ stick','Juddson Smith','90 degree jump turn stick interpretation','Bilateral interpretation candidate; it does not prove the source foot contract.'),
    ('90-degree-jump-turn-to-stick','p4voRryQIMw','90 deg Rotational Single leg Vertical Jump + Stick (Landing)','Depth Training and Physiotherapy Waterloo','90 degree jump turn stick interpretation','Unilateral interpretation candidate; no exact source mapping or approval.'),
    ('90-degree-jump-turn-to-stick','P-O5EB9672I','Double Leg 90* Rotational Jump - Single Leg Landing (Turn Opposite)','Coach Miguez Sports Performance Training','double leg 90 jump single leg landing','Mixed-foot interpretation candidate; no exact source mapping or approval.')
  ) media(definition_slug,video_id,title,channel_name,source_query,notes)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=media.definition_slug
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=NULL,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,
    CASE WHEN definition.id=ANY(source_ids) THEN 2 ELSE 1 END,
    alternate.alternate_name,alternate.classification,alternate.rationale,
    alternate.dimensions,
    CASE WHEN alternate.classification IN('new_definition','new_variant') THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    ('two-foot-quarter-turn-jump-to-stick','Single-Leg Same-Leg Quarter-Turn Hop to Stick','new_definition','One-leg takeoff and same-leg landing change laterality, loading, balance, and side dosage.','{"takeoffFeet":1,"landingFeet":1,"landingLeg":"same"}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Two-Foot Quarter-Turn Jump to Single-Leg Stick','new_definition','A unilateral terminal landing changes landing support and failure state.','{"takeoffFeet":2,"landingFeet":1}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Two-Foot Half-Turn Jump to Stick','new_definition','A 180-degree reorientation changes aerial orientation and landing demand.','{"rotationDegrees":180}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Quarter-Turn Broad Jump to Stick','new_variant','Declared horizontal displacement changes projection and braking demand.','{"displacement":"horizontal_declared"}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Drop to Quarter-Turn Landing','new_definition','A box or step-off creates an ordered drop-then-turn sequence and new equipment and impact constraints.','{"entry":"drop_or_step_off"}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Continuous Quarter-Turn Jumps','new_definition','Repeated contacts without a terminal hold change contact strategy and repetition boundary.','{"terminalAction":"continuous"}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Reactive-Cue Quarter-Turn Jump to Stick','new_variant','An external cue adds perception and response demand after the exact physical contract is fixed.','{"cue":"live_external"}'::JSONB),
    ('two-foot-quarter-turn-jump-to-stick','Turn Direction, Start Orientation, Height, Attempts, Hold, or Rest','modifier_annotation','These scale delivery while preserving bilateral takeoff and landing, quarter turn, minimal displacement, stick, and reset.','{"modifiers":["turn_direction","start_orientation","height","attempts","hold_seconds","rest_seconds"]}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Two-Foot Quarter-Turn Jump to Stick','new_definition','Bilateral takeoff and landing change support and impact distribution.','{"takeoffFeet":2,"landingFeet":2}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Single-Leg Quarter-Turn Hop to Opposite-Leg Stick','new_definition','Landing on the opposite leg changes the contact sequence and side accounting.','{"landingLeg":"opposite"}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Single-Leg Half-Turn Hop to Stick','new_definition','A 180-degree turn changes aerial orientation and failure consequence.','{"rotationDegrees":180}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Single-Leg Quarter-Turn Broad Hop to Stick','new_variant','Declared horizontal displacement changes projection and braking demand.','{"displacement":"horizontal_declared"}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Single-Leg Drop to Quarter-Turn Stick','new_definition','A drop entry creates a different ordered sequence, impact, and equipment contract.','{"entry":"drop_or_step_off"}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Continuous Single-Leg Quarter-Turn Hops','new_definition','Repeated contacts without stabilization change terminal action and repetition boundary.','{"terminalAction":"continuous"}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Reactive-Cue Single-Leg Quarter-Turn Hop','new_variant','A live cue adds perception and decision demand after the physical task is fixed.','{"cue":"live_external"}'::JSONB),
    ('single-leg-quarter-turn-hop-to-stick','Turn Direction, Starting Leg, Height, Attempts per Side, Hold, or Rest','modifier_annotation','These scale delivery while preserving same-leg takeoff and landing, quarter turn, minimal displacement, stick, and reset.','{"modifiers":["turn_direction","starting_leg","height","attempts_per_side","hold_seconds","rest_seconds"]}'::JSONB),
    ('90-degree-hop-to-stick','Two-Foot Quarter-Turn Jump to Stick','same_identity','Possible only if authoritative source evidence establishes bilateral takeoff and landing plus the complete stick contract.','{"possibleMapping":"two-foot-quarter-turn-jump-to-stick"}'::JSONB),
    ('90-degree-hop-to-stick','Single-Leg Same-Leg Quarter-Turn Hop to Stick','same_identity','Possible only if authoritative source evidence establishes one-leg takeoff and same-leg landing plus the complete stick contract.','{"possibleMapping":"single-leg-quarter-turn-hop-to-stick"}'::JSONB),
    ('90-degree-hop-to-stick','Single-Leg Opposite-Leg Quarter-Turn Bound to Stick','new_definition','Opposite-leg landing changes the ordered contact contract.','{"landingLeg":"opposite"}'::JSONB),
    ('90-degree-hop-to-stick','Two-Foot to Single-Leg Quarter-Turn Landing','new_definition','Bilateral takeoff and unilateral landing require an exact separate definition.','{"takeoffFeet":2,"landingFeet":1}'::JSONB),
    ('90-degree-hop-to-stick','Quarter-Turn Broad Jump or Hop to Stick','new_variant','Declared horizontal displacement changes projection and braking demand.','{"displacement":"horizontal_declared"}'::JSONB),
    ('90-degree-hop-to-stick','Continuous Quarter-Turn Contacts','new_definition','No terminal hold creates a different repetition boundary.','{"terminalAction":"continuous"}'::JSONB),
    ('90-degree-hop-to-stick','Turn Direction, Height, Attempts, Hold, or Rest','modifier_annotation','These are modifiers only after takeoff, landing, displacement, and reset are fixed.','{"modifiers":["turn_direction","height","attempts","hold_seconds","rest_seconds"]}'::JSONB),
    ('90-degree-jump-turn-to-stick','Two-Foot Quarter-Turn Jump to Stick','same_identity','Possible only if authoritative evidence establishes bilateral takeoff and landing, minimal displacement, hold, and reset.','{"possibleMapping":"two-foot-quarter-turn-jump-to-stick"}'::JSONB),
    ('90-degree-jump-turn-to-stick','Single-Leg Quarter-Turn Hop to Stick','new_definition','Unilateral takeoff and landing change laterality and loading.','{"takeoffFeet":1,"landingFeet":1}'::JSONB),
    ('90-degree-jump-turn-to-stick','Two-Foot Quarter-Turn Jump to Single-Leg Stick','new_definition','Unilateral landing changes the terminal support contract.','{"takeoffFeet":2,"landingFeet":1}'::JSONB),
    ('90-degree-jump-turn-to-stick','Quarter-Turn Broad Jump to Stick','new_variant','Horizontal displacement changes projection and braking demand.','{"displacement":"horizontal_declared"}'::JSONB),
    ('90-degree-jump-turn-to-stick','Drop to Quarter-Turn Landing','new_definition','A drop entry changes sequence, equipment, and impact.','{"entry":"drop_or_step_off"}'::JSONB),
    ('90-degree-jump-turn-to-stick','Continuous Quarter-Turn Jumps','new_definition','No terminal hold changes repetition boundary and fatigue behavior.','{"terminalAction":"continuous"}'::JSONB),
    ('90-degree-jump-turn-to-stick','Turn Direction, Height, Attempts, Hold, or Rest','modifier_annotation','These are modifiers only after takeoff and landing support, displacement, and reset are fixed.','{"modifiers":["turn_direction","height","attempts","hold_seconds","rest_seconds"]}'::JSONB)
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
    (bilateral_variant_id,unilateral_variant_id,'progression',72,
      ARRAY['takeoff_support','landing_support','laterality','impact','stabilization'],
      'The unilateral task preserves stationary quarter-turn reorientation and a terminal stick but changes takeoff and landing from two feet to the same single leg, increasing balance, side accounting, impact concentration, and stabilization demand.',
      '{"useWhen":["bilateral_quarter_turn_is_repeatable_both_directions","single_leg_prerequisites_pass","impact_budget_revalidated"],"notEquivalentFor":["bilateral_assessment","unilateral_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (unilateral_variant_id,bilateral_variant_id,'regression',72,
      ARRAY['takeoff_support','landing_support','laterality','impact','stabilization'],
      'The bilateral task reduces support and side-accounting demand while preserving a stationary 90-degree reorientation, terminal hold, and full reset.',
      '{"useWhen":["same_leg_landing_is_not_repeatable_without_symptoms","bilateral_task_is_appropriate","impact_budget_revalidated"],"notEquivalentFor":["unilateral_assessment"]}'::JSONB,
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
    CASE calibration.dimension
      WHEN 'technicalComplexity' THEN
        'Candidate exercise-complexity anchor based on declared takeoff and landing support, exact 90-degree aerial orientation, turn direction, displacement control, target reacquisition, landing alignment, terminal hold, side accounting, and reset; independent human calibration is required.'
      ELSE
        'Candidate physical-difficulty anchor based on bodyweight takeoff, landing impact, unilateral versus bilateral support, braking, stabilization, contact volume, surface, accumulated exposure, symptoms, and recovery; independent human calibration is required.'
    END,'review',1,NULL,NULL,
    'No score approval is created by migration 432.',NULL
  FROM(VALUES
    (bilateral_variant_id,58,56),
    (unilateral_variant_id,68,64)
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
      ' Migration 432 archives both unresolved source cards',
      1
    )||' Migration 432 archives both unresolved source cards without direct consolidation and authors separate exact bilateral and same-leg unilateral definitions. Reactivation or mapping still requires authoritative missing identity facts and qualified human review.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'retirementMigration',migration_key,
        'resolution','retire_ambiguous_sources_without_direct_consolidation',
        'exactAuthoredDefinitions',jsonb_build_array(
          'two-foot-quarter-turn-jump-to-stick',
          'single-leg-quarter-turn-hop-to-stick'),
        'humanReviewStillRequiredForSourceMapping',TRUE,
        'approvalCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.decision='needs_human_review'
    AND resolution.reviewed_by IS NULL
    AND resolution.survivor_definition_id=ANY(source_ids)
    AND resolution.resolved_definition_id=ANY(source_ids);

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,bilateral_id,unilateral_id,'distinct_exercises',
      'The bilateral card requires two-foot takeoff and two-foot landing. The unilateral card requires one declared leg for takeoff and the same leg for landing. Support, laterality, impact distribution, balance, side dosage, failure state, and assessment meaning are identity-bearing.',
      jsonb_build_object(
        'identityBoundary','two_foot_quarter_turn_vs_same_leg_quarter_turn',
        'sharedContract',jsonb_build_array(
          'stationary','90_degree_aerial_reorientation',
          'minimal_horizontal_displacement','terminal_stick','full_reset'),
        'differingDimensions',jsonb_build_array(
          'takeoff_support','landing_support','landing_leg','laterality','side_accounting'),
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,half_turn_id,bilateral_id,'distinct_exercises',
      'The half-turn card requires 180 degrees of reorientation while the bilateral quarter-turn card requires 90 degrees. Rotation magnitude changes aerial orientation, target reacquisition, landing orientation, complexity, and progression choice.',
      jsonb_build_object(
        'identityBoundary','two_foot_180_degree_vs_two_foot_90_degree_turn',
        'differingDimension','rotation_degrees','leftRotationDegrees',180,
        'rightRotationDegrees',90,'humanReviewRequired',TRUE,
        'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,half_turn_id,unilateral_id,'distinct_exercises',
      'The half-turn card uses a 180-degree task while the exact same-leg card uses 90 degrees and a declared unilateral takeoff and same-leg landing. Rotation magnitude and foot support independently change identity.',
      jsonb_build_object(
        'identityBoundary','180_degree_jump_vs_same_leg_90_degree_hop',
        'differingDimensions',jsonb_build_array(
          'rotation_degrees','takeoff_support','landing_support','landing_leg'),
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
  SET name=CASE exercise.id WHEN 1489
      THEN '90-Degree Hop to Stick (Unresolved Legacy)'
      ELSE '90-Degree Jump Turn to Stick (Unresolved Legacy)' END,
    description='Archived nonprescribable quarter-turn source. Exact takeoff support, landing support or leg, displacement, turn direction, hold criterion, side accounting, and reset are not jointly established.',
    instructions='Do not prescribe from this source. Select the exact two-foot or same-leg quarter-turn card, or author a separate exact contract.',
    card_summary='Archived nonprescribable identity; retained for source traceability.',
    coach_language='Choose an exact replacement. Do not infer takeoff or landing support from hop or jump wording.',
    athlete_language='This card is unavailable because its exact takeoff and landing pattern is not fully defined.',
    programming_logic=jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'replacementPolicy','choose_exact_quarter_turn_jump_or_hop',
      'difficultyStatus','blocked_pending_exact_identity'),
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'missingIdentityDimensions',jsonb_build_array(
        'takeoff_foot_count','landing_foot_count','landing_leg','displacement',
        'turn_direction','hold_criterion','side_accounting','reset')),
    coaching_execution=jsonb_build_object(
      'selectionBlocked',TRUE,
      'supportMessage','Open an exact replacement card before setup or instruction.'),
    skill_level=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(1489,1512);

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level=NULL
  WHERE safety.exercise_id IN(1489,1512);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,
    CASE WHEN definition.id=ANY(source_ids) THEN 2 ELSE 1 END,
    '1.0.0',migration_key,'quarantined',
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_object(
      'stableSlugPreserved',TRUE,'legacySourceMappingPreserved',TRUE,
      'identityExecutable',FALSE,'selectionBlocked',TRUE,
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseSkillLevelAbsent',TRUE,'deliveryProfilesSelectable',FALSE,
      'requiredEvidenceSections',16,'candidateMediaCount',3,
      'alternateInterpretations',7,'mediaApprovalCreated',FALSE,
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE)
    ELSE jsonb_build_object(
      'stableResearchIdentity',TRUE,'legacySourceMappingClaimed',FALSE,
      'identityAndAliasesComplete',TRUE,'controlledTaxonomyComplete',TRUE,
      'anatomyComplete',TRUE,'exerciseDifficultyOnly',TRUE,
      'overallDifficultyFormula','max','exactVariantCount',1,
      'deliveryProfileCount',2,'loadFatigueRecoveryComplete',TRUE,
      'constraintsComplete',TRUE,'dosageAndDurationComplete',TRUE,
      'cumulativeImpactBudgetComplete',TRUE,'sideAccountingComplete',TRUE,
      'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
      'supportOperationsComplete',TRUE,'requiredEvidenceSections',16,
      'candidateMediaCount',5,'alternateInterpretations',8,
      'reviewRelationshipCount',2,'reviewCalibrationCount',2,
      'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE) END,
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-EXECUTABLE-01',
        'message','Takeoff support, landing support or leg, displacement, turn direction, hold, side accounting, or reset requires authoritative evidence.'),
      jsonb_build_object('code','CARD-DIFFICULTY-01',
        'message','Exercise complexity and physical difficulty cannot be scored for an undefined task.'),
      jsonb_build_object('code','CARD-DELIVERY-01',
        'message','No selectable dose, duration, logistics, or rendering profile is permitted.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Adjacent media requires exact-match and quality review.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Archived identity is intentionally nonprescribable.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A human must approve a healthy exact-match demonstration for this card version.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must review and approve relationship proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Independent difficulty calibration evidence and reviewer approval are required.'),
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
       AND definition.provenance_json->>'quarterTurnIdentityMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(source_ids)
         AND definition.status='archived' AND definition.card_version=2)<>2
    OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(exact_ids)
         AND definition.status='review' AND definition.card_version=1)<>2 THEN
    RAISE EXCEPTION '% expected two archived sources and two review definitions',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.review_status='candidate'
       AND evidence.reviewed_card_version=CASE
         WHEN evidence.definition_id=ANY(source_ids) THEN 2 ELSE 1 END)<>64
    OR EXISTS(SELECT 1 FROM unnest(all_ids) AS ids(definition_id)
       WHERE(SELECT count(DISTINCT evidence.section_key)
         FROM coaching.exercise_section_evidence_v1 evidence
         WHERE evidence.definition_id=ids.definition_id
           AND evidence.review_status='candidate'
           AND evidence.reviewed_card_version=CASE
             WHEN ids.definition_id=ANY(source_ids) THEN 2 ELSE 1 END)<>16) THEN
    RAISE EXCEPTION '% expected 16 candidate evidence sections per card',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id=ANY(all_ids)
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL
       AND media.reviewed_card_version=CASE
         WHEN media.definition_id=ANY(source_ids) THEN 2 ELSE 1 END)<>16
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=ANY(all_ids)
         AND alternate.review_status='candidate'
         AND alternate.reviewer_user_id IS NULL
         AND alternate.reviewed_at IS NULL
         AND alternate.reviewed_card_version=CASE
           WHEN alternate.definition_id=ANY(source_ids) THEN 2 ELSE 1 END)<>30 THEN
    RAISE EXCEPTION '% expected candidate-only 16-media and 30-alternate packets',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.id IN(bilateral_variant_id,unilateral_variant_id)
       AND variant.status='review')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=ANY(source_ids) AND variant.status<>'archived')
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
       WHERE variant.id IN(bilateral_variant_id,unilateral_variant_id)
         AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
           =greatest(
             (variant.difficulty_json->>'technicalComplexity')::INTEGER,
             (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=ANY(all_ids)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id IN(bilateral_variant_id,unilateral_variant_id)
       AND profile.profile_key IN(
         'output-quarter-turn-quality','prepare-quarter-turn-orientation')
       AND profile.status='review'
       AND profile.equipment_required=ARRAY['none']::TEXT[])<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id IN(bilateral_variant_id,unilateral_variant_id)
         AND calibration.dimension IN(
           'technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review'
         AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% expected complete review-only profiles and calibration',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
     WHERE relationship.from_variant_id IN(
         bilateral_variant_id,unilateral_variant_id)
       AND relationship.to_variant_id IN(
         bilateral_variant_id,unilateral_variant_id)
       AND relationship.review_status='review'
       AND relationship.reviewed_by IS NULL
       AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected progression and regression proposals',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.survivor_definition_id=hop_source_id
         AND resolution.resolved_definition_id=jump_source_id
         AND resolution.decision='needs_human_review'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'retirementMigration'=migration_key)
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.decision='distinct_exercises'
         AND resolution.resolution_source='deterministic_identity_equivalence'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key)<>3 THEN
    RAISE EXCEPTION '% failed to preserve source review and exact boundaries',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1 AND exercise.id IN(1489,1512)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.skill_level IS NULL)<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(1489,1512)
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE)<>4
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
