-- Retire the foot-count-ambiguous low-hurdle source and author exact bilateral
-- and ipsilateral single-leg lateral low-hurdle clearance-to-stick cards.
-- Evidence, media, relationships, calibrations, and publication remain
-- candidate/review-only; no human approval is fabricated.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '434_coaching_lateral_low_hurdle_stick_identity_completion';
  research_batch CONSTANT TEXT := 'lateral-low-hurdle-stick-identity-v1';
  research_version CONSTANT TEXT := '2026-08-01.12';
  bilateral_id CONSTANT UUID :=
    '452c5f80-c157-42f8-9882-fa83c6a38c98'::UUID;
  single_id CONSTANT UUID :=
    '9a1aa70b-9f83-4cc2-90ff-71576c8d6c8a'::UUID;
  bilateral_variant_id CONSTANT UUID :=
    'd0a03aee-ad76-4dfe-a895-06313ea3f263'::UUID;
  single_variant_id CONSTANT UUID :=
    '4fc44439-62da-4f0c-becf-15b1736962b3'::UUID;
  source_id UUID;
  bilateral_ground_id UUID;
  single_ground_id UUID;
  bilateral_ground_variant_id UUID;
  single_ground_variant_id UUID;
  all_ids UUID[];
  applied_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT id INTO source_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='low-hurdle-lateral-hop-to-stick';
  SELECT id INTO bilateral_ground_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='lateral-hop-to-stick';
  SELECT id INTO single_ground_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='single-leg-lateral-hop-to-stick';
  SELECT variant.id INTO bilateral_ground_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=bilateral_ground_id
    AND variant.variant_key='distance-bilateral-control'
    AND variant.status='review';
  SELECT variant.id INTO single_ground_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=single_ground_id
    AND variant.variant_key='distance-output'
    AND variant.status='review';

  IF source_id IS NULL OR bilateral_ground_id IS NULL OR single_ground_id IS NULL
    OR bilateral_ground_variant_id IS NULL OR single_ground_variant_id IS NULL THEN
    RAISE EXCEPTION '% requires the ambiguous source and both completed ground-only parents',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=bilateral_ground_id AND status='review' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=single_ground_id AND status='review' AND card_version=2) THEN
    RAISE EXCEPTION '% found unexpected parent card state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
     WHERE source.definition_id=source_id
       AND source.legacy_exercise_id=1500)<>1
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 source
       WHERE source.definition_id=source_id
         AND source.legacy_exercise_id<>1500) THEN
    RAISE EXCEPTION '% found unexpected ambiguous-source lineage',migration_key;
  END IF;

  all_ids:=ARRAY[source_id,bilateral_id,single_id];
  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND definition.provenance_json->>'lateralLowHurdleIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,3) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF applied_count=0 THEN
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=source_id AND status='review' AND card_version=1)
      OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id IN(bilateral_id,single_id)) THEN
      RAISE EXCEPTION '% found unexpected initial definition state',migration_key;
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
         WHERE id=source_id AND status='archived' AND card_version=2)
      OR(SELECT count(*) FROM coaching.exercise_definition_v1
         WHERE id IN(bilateral_id,single_id)
           AND status='review' AND card_version=1)<>2 THEN
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
    UPDATE coaching.exercise_section_evidence_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id=source_id AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1
    SET review_status='superseded',exact_variant_match=NULL,
      demonstration_quality_score=NULL,reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id=source_id AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE definition_id=source_id AND review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id AND variant.definition_id=source_id;
  UPDATE coaching.exercise_variant_v1
  SET status='archived',updated_at=now()
  WHERE definition_id=source_id;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at)
  VALUES
    (bilateral_id,1,NULL,'bilateral-lateral-low-hurdle-jump-to-stick',
      'Bilateral Lateral Low-Hurdle Jump to Stick',
      'Bilateral Lateral Low-Hurdle Jump to Stick',
      ARRAY['Two-Leg Lateral Hurdle Jump and Stick',
        'Double-Leg Lateral Low-Hurdle Hop to Stick',
        'Two-Foot Lateral Low-Hurdle Jump to Stick'],
      'From a stationary two-foot stance beside one declared collapsible low hurdle, take off from both feet together, clear the hurdle laterally once, land on both feet together in the marked zone, absorb under control, hold without an extra step or hop, exit safely, and reset fully.',
      'bilateral_lateral_low_hurdle_clearance_to_terminal_stick',
      '1.0.0',1,'review',93,74,58,
      ARRAY['jump','clear_obstacle','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['low_hurdle'],
      ARRAY['floor_markers','cones','landing_mat','video_capture'],
      '{}'::JSONB,'{}'::JSONB,
      jsonb_build_object('canonicalAuthoredFromResearch',TRUE),
      NULL,NULL,NULL,NULL),
    (single_id,1,NULL,'single-leg-lateral-low-hurdle-hop-to-stick',
      'Single-Leg Lateral Low-Hurdle Hop to Stick',
      'Single-Leg Lateral Low-Hurdle Hop to Stick',
      ARRAY['One-Leg Lateral Hurdle Hop and Stick',
        'Same-Leg Lateral Low-Hurdle Hop to Stick',
        'Single-Leg Lateral Hurdle Hop with Stick'],
      'From a stationary stance on one declared leg beside one declared collapsible low hurdle, take off from that leg, clear the hurdle laterally once, land on the same leg in the marked zone, absorb under control, hold without a free-foot touch, extra hop, or step, exit safely, and reset before changing direction or side.',
      'ipsilateral_single_leg_lateral_low_hurdle_clearance_to_terminal_stick',
      '1.0.0',1,'review',93,74,58,
      ARRAY['hop','clear_obstacle','land','stabilize'],
      ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
      ARRAY['low_hurdle'],
      ARRAY['floor_markers','cones','landing_mat','video_capture'],
      '{}'::JSONB,'{}'::JSONB,
      jsonb_build_object('canonicalAuthoredFromResearch',TRUE),
      NULL,NULL,NULL,NULL)
  ON CONFLICT(id) DO NOTHING;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Low-Hurdle Lateral Hop to Stick (Unresolved Legacy)',
    display_name='Low-Hurdle Lateral Hop to Stick (Unresolved Legacy)',
    aliases=array_append(definition.aliases,
      'Low Hurdle Lateral Hop to Stick (Ambiguous Foot Contract)'),
    description='Archived nonprescribable source. The record names a lateral low-hurdle clearance and terminal stick but does not declare takeoff foot count, landing foot count or leg, obstacle dimensions, contact count, direction relative to stance, landing zone, hold, exit, or reset.',
    family_key='unresolved_lateral_low_hurdle_support_and_landing_identity',
    card_version=2,status='archived',content_confidence=94,
    scoring_confidence=1,media_confidence=42,
    movement_patterns=ARRAY['clear_obstacle','land','stabilize'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY['low_hurdle'],
    optional_equipment=ARRAY['floor_markers','landing_mat'],
    environment_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'known',jsonb_build_array(
        'lateral_projection','raised_low_hurdle','terminal_stick_wording'),
      'unresolved',jsonb_build_array(
        'takeoff_foot_count','landing_foot_count','landing_leg',
        'obstacle_dimensions','contact_count','direction_relative_to_stance',
        'landing_zone','hold','exit','reset')),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness, side dose, trip exposure, and impact cannot be matched to an undefined support contract',
      'supportPath','choose_an_exact_bilateral_or_same_leg_low_hurdle_card'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'generic_lower_limb_hurdle_clearance_and_landing_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'blocked_pending_takeoff_landing_and_obstacle_contract'),
      'planes',jsonb_build_array('frontal_projection_known_other_demands_unresolved'),
      'laterality','unresolved_bilateral_unilateral_or_mixed',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This source can mean materially different support and landing tasks and is unavailable until an exact card is selected.',
      'primaryCue','Ask for the exact two-foot or same-leg low-hurdle card.',
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'pain','instability','joint_pinching','numbness','dizziness'),
      'painGuidance','Do not begin from this unresolved card; stop any replacement for symptoms, obstacle contact, or uncontrolled landing.',
      'selfChecks',jsonb_build_array(
        'takeoff and landing feet are declared','one obstacle and landing zone are visible',
        'hold, exit, and reset are declared'),
      'accessibility',jsonb_build_array(
        'plain_language_retirement_explanation','text_first_exact_alternatives'),
      'mediaAlternatives',jsonb_build_array(
        'missing_identity_explanation','coach_selected_exact_card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'takeoff_feet','landing_feet','landing_leg','hurdle_dimensions',
        'direction','contact_count','landing_zone','hold','exit','reset'),
      'faultCorrections',jsonb_build_array(
        'Do not cue, dose, or demonstrate until every identity field is declared.'),
      'demonstrationPlan',jsonb_build_array(
        'Explain the ambiguous lineage','Open an exact replacement card'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'two_foot_two_foot','choose_bilateral_lateral_low_hurdle_jump_to_stick',
        'same_leg','choose_single_leg_lateral_low_hurdle_hop_to_stick',
        'other','choose_or_author_a_separate_exact_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','takeoff_support','landing_support','obstacle','terminal_action'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','obstacle_trip_or_collision')),
      'retentionPolicy','Preserve source mapping, original wording, aliases, evidence, media, and queue decisions.',
      'changeImpactPolicy','Do not reactivate without exact takeoff, landing, obstacle, contact, hold, exit, and reset evidence.',
      'knownLimitations',jsonb_build_array(
        'undefined_takeoff_and_landing_contract','no_exact_reviewed_media'),
      'supportSummary','Retirement is deliberate; never infer foot count from hop or jump wording.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'lateralLowHurdleIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'possibleExactDefinitions',jsonb_build_array(
        'bilateral-lateral-low-hurdle-jump-to-stick',
        'single-leg-lateral-low-hurdle-hop-to-stick'),
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    approved_video_url=NULL,updated_at=now()
  WHERE definition.id=source_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET status='review',card_version=1,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Bilateral Lateral Low-Hurdle Jump to Stick',
    display_name='Bilateral Lateral Low-Hurdle Jump to Stick',
    aliases=ARRAY['Two-Leg Lateral Hurdle Jump and Stick',
      'Double-Leg Lateral Low-Hurdle Hop to Stick',
      'Two-Foot Lateral Low-Hurdle Jump to Stick'],
    description='From a stationary two-foot stance beside one declared collapsible low hurdle, take off from both feet together, clear the hurdle laterally once, land on both feet together in the marked zone, absorb under control, hold without an extra step or hop, exit safely, and reset fully.',
    family_key='bilateral_lateral_low_hurdle_clearance_to_terminal_stick',
    content_confidence=93,scoring_confidence=74,media_confidence=58,
    movement_patterns=ARRAY['jump','clear_obstacle','land','stabilize'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY['low_hurdle'],
    optional_equipment=ARRAY['floor_markers','cones','landing_mat','video_capture'],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'collapsible_low_hurdle_with_declared_height_width_and_orientation',
        'level_high_traction_resilient_surface','marked_two_foot_takeoff_zone',
        'marked_two_foot_landing_zone','clear_lateral_flight_and_fall_space',
        'stable_footwear_policy','no_cross_traffic','complete_coach_sightline'),
      'obstacleCount',1,'projection','lateral_single_clearance',
      'groupLayout',jsonb_build_object(
        'oneAthletePerLane',TRUE,'sharedStartStopSignal',TRUE,
        'hurdleResetByCoachOrDesignatedPerson',TRUE,
        'coachSightlineRequired',TRUE)),
    population_json=jsonb_build_object(
      'requires',jsonb_build_array(
        'pain_free_two_foot_takeoff_and_landing',
        'controlled_bilateral_lateral_jump_and_stick_on_floor_target',
        'tolerance_for_planned_bilateral_jump_landing_contacts',
        'ability_to_clear_a_low_obstacle_without_tucking_or_reaching',
        'ability_to_follow_start_stop_exit_and_reset_commands'),
      'screen',jsonb_build_array(
        'current_foot_ankle_knee_hip_or_back_pain',
        'recent_injury_surgery_or_restriction','bone_stress_or_tendon_irritability',
        'dizziness_balance_or_depth_perception_concern',
        'accumulated_jump_running_and_change_of_direction_contacts'),
      'individualize',jsonb_build_array(
        'hurdle_height','lateral_distance','attempts','hold_seconds','rest',
        'direction_order','surface','session_impact_budget'),
      'notMedicalClearance','Symptoms or return-to-sport restrictions require the appropriate clinician or policy process.'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'gluteus_maximus','gluteus_medius','quadriceps','hamstrings',
        'soleus','gastrocnemius','intrinsic_foot_muscles'),
      'secondaryMuscles',jsonb_build_array(
        'hip_adductors','hip_rotators','fibularis_group','tibialis_anterior',
        'obliques','deep_trunk_stabilizers','spinal_extensors'),
      'joints',jsonb_build_array(
        'metatarsophalangeal','talocrural','subtalar','knee','hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'bilateral_ankle_plantarflexion_and_dorsiflexion',
        'bilateral_knee_flexion_and_extension','bilateral_hip_flexion_and_extension',
        'frontal_plane_lateral_projection','hip_and_trunk_alignment_control',
        'bilateral_landing_deceleration_and_stabilization'),
      'planes',jsonb_build_array(
        'frontal_primary_projection','sagittal_takeoff_and_landing_absorption',
        'transverse_alignment_control'),
      'laterality','bilateral_simultaneous_takeoff_and_landing'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Practises one controlled two-foot lateral obstacle clearance and a stable two-foot landing without turning the task into repeated rebound work.',
      'primaryCue','Both feet push together, clear the low hurdle, both feet land together, absorb and freeze.',
      'expectedSensations',jsonb_build_array(
        'brief_whole_body_effort','balanced_two_foot_pressure',
        'controlled_ankle_knee_and_hip_absorption'),
      'unexpectedSensations',jsonb_build_array(
        'pain','joint_pinching','instability','numbness','dizziness',
        'obstacle_contact_or_fear_that_changes_the_jump'),
      'painGuidance','Stop immediately for pain, guarding, instability, dizziness, obstacle contact, or an uncontrolled landing; do not repeat to test the symptom.',
      'selfChecks',jsonb_build_array(
        'both feet start and leave together','one hurdle is fully cleared',
        'both whole feet land together in the zone','landing is quiet and controlled',
        'hold has no extra step or hop','exit and reset happen only after the coach signal'),
      'accessibility',jsonb_build_array(
        'plain_language_steps','high_contrast_hurdle_and_landing_marks',
        'coach_demonstration_from_front_and_side','visual_and_spoken_start_stop_cues',
        'ground_only_alternative_when_clearance_is_not_appropriate'),
      'mediaAlternatives',jsonb_build_array(
        'captioned_video_after_approval','written_sequence','still_frame_sequence')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'stationary_two_foot_start','simultaneous_takeoff','lateral_projection',
        'clean_single_hurdle_clearance','simultaneous_two_foot_whole_foot_landing',
        'foot_knee_hip_pelvis_trunk_alignment','quiet_absorption',
        'declared_hold','safe_exit','full_reset'),
      'faultCorrections',jsonb_build_array(
        'Split takeoff or landing: remove the hurdle and restore the exact bilateral floor task.',
        'Toe catch or excessive tuck: reduce obstacle height and distance; do not cue a riskier clearance.',
        'Loud or stiff landing: reduce intent and obstacle demand or use the ground-only parent.',
        'Extra step or hop: shorten distance and require the held two-foot finish.'),
      'demonstrationPlan',jsonb_build_array(
        'Show hurdle inspection, takeoff and landing marks, one clearance, hold, exit, and reset.',
        'Show invalid split-foot, obstacle-contact, rebound, and sprint-exit examples.'),
      'groupManagement',jsonb_build_object(
        'lane','one_athlete_one_hurdle_one_landing_zone',
        'traffic','closed_during_attempt_and_hurdle_reset',
        'signals','shared_start_stop_and_exit_cues',
        'coachPosition','takeoff_hurdle_landing_and_fall_space_visible'),
      'modificationDecisionTree',jsonb_build_object(
        'clearance_or_confidence_not_repeatable','use_bilateral_ground_only_lateral_jump_to_stick',
        'bilateral_landing_not_repeatable','use_snap_down_or_lateral_step_to_two_foot_stick',
        'single_leg_objective','select_the_exact_single_leg_low_hurdle_card',
        'pain_or_restriction','stop_and_follow_clinical_or_facility_process'),
      'doNotUseWhen',jsonb_build_array(
        'hurdle_or_lane_cannot_be_made_safe','bilateral_support_contract_is_not_understood',
        'landing_quality_is_not_repeatable','impact_budget_is_unknown_or_exceeded')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','equipment','hurdle_height','takeoff','landing','hold',
        'lane','symptoms','substitution','accessibility','media'),
      'supportEscalation',jsonb_build_object(
        'coach',jsonb_build_array('repeated_technical_fault','identity_or_dose_unclear'),
        'contentReview',jsonb_build_array(
          'candidate_media_mismatch','taxonomy_or_score_question'),
        'urgent',jsonb_build_array(
          'injury_event','obstacle_trip_or_collision','broken_or_unstable_hurdle')),
      'requiredIssueContext',jsonb_build_array(
        'card_and_variant_id','card_version','hurdle_dimensions','direction',
        'surface','attempt_number','observed_fault_or_symptom','substitution_used'),
      'retentionPolicy','Retain generated prescription, card version, hurdle and lane setup, contact count, validation result, edits, substitutions, and stop events.',
      'changeImpactPolicy','Any support, obstacle category, contact-count, terminal-action, safety, or instruction change requires card and saved-workout revalidation.',
      'knownLimitations',jsonb_build_array(
        'proposed_scores_not_independently_calibrated','candidate_media_not_human_reviewed',
        'no_universal_hurdle_height_or_safe_contact_threshold'),
      'supportSummary','Verify the exact two-foot single-clearance contract before troubleshooting dose or technique.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'lateralLowHurdleIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','author_exact_bilateral_low_hurdle_definition_without_source_mapping',
      'legacySourceMapped',FALSE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=bilateral_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET status='review',card_version=1,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Single-Leg Lateral Low-Hurdle Hop to Stick',
    display_name='Single-Leg Lateral Low-Hurdle Hop to Stick',
    aliases=ARRAY['One-Leg Lateral Hurdle Hop and Stick',
      'Same-Leg Lateral Low-Hurdle Hop to Stick',
      'Single-Leg Lateral Hurdle Hop with Stick'],
    description='From a stationary stance on one declared leg beside one declared collapsible low hurdle, take off from that leg, clear the hurdle laterally once, land on the same leg in the marked zone, absorb under control, hold without a free-foot touch, extra hop, or step, exit safely, and reset before changing direction or side.',
    family_key='ipsilateral_single_leg_lateral_low_hurdle_clearance_to_terminal_stick',
    content_confidence=93,scoring_confidence=74,media_confidence=58,
    movement_patterns=ARRAY['hop','clear_obstacle','land','stabilize'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','pelvis','core','spine'],
    required_equipment=ARRAY['low_hurdle'],
    optional_equipment=ARRAY['floor_markers','cones','landing_mat','video_capture'],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'collapsible_low_hurdle_with_declared_height_width_and_orientation',
        'level_high_traction_resilient_surface','marked_single_leg_takeoff_zone',
        'marked_same_leg_landing_zone','clear_lateral_flight_and_fall_space',
        'stable_footwear_policy','no_cross_traffic','complete_coach_sightline'),
      'obstacleCount',1,'projection','lateral_single_clearance',
      'sideContract','stance_leg_and_direction_declared_before_attempt',
      'groupLayout',jsonb_build_object(
        'oneAthletePerLane',TRUE,'sharedStartStopSignal',TRUE,
        'hurdleResetByCoachOrDesignatedPerson',TRUE,
        'coachSightlineRequired',TRUE)),
    population_json=jsonb_build_object(
      'requires',jsonb_build_array(
        'pain_free_single_leg_takeoff_and_same_leg_landing',
        'controlled_same_leg_lateral_hop_and_stick_on_floor_target',
        'tolerance_for_planned_unilateral_jump_landing_contacts',
        'ability_to_clear_a_low_obstacle_without_tucking_or_reaching',
        'ability_to_follow_leg_direction_start_stop_exit_and_reset_commands'),
      'screen',jsonb_build_array(
        'current_foot_ankle_knee_hip_or_back_pain',
        'recent_injury_surgery_or_restriction','bone_stress_or_tendon_irritability',
        'dizziness_balance_or_depth_perception_concern',
        'side_specific_asymmetry_or_instability',
        'accumulated_jump_running_and_change_of_direction_contacts'),
      'individualize',jsonb_build_array(
        'hurdle_height','lateral_distance','attempts_per_side','hold_seconds',
        'rest','direction_order','side_order','surface','session_impact_budget'),
      'notMedicalClearance','Symptoms or return-to-sport restrictions require the appropriate clinician or policy process.'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'stance_leg_gluteus_maximus','stance_leg_gluteus_medius_and_minimus',
        'stance_leg_quadriceps','stance_leg_hamstrings',
        'stance_leg_soleus_and_gastrocnemius','stance_leg_intrinsic_foot_muscles'),
      'secondaryMuscles',jsonb_build_array(
        'stance_leg_hip_adductors_and_rotators','stance_leg_fibularis_group',
        'stance_leg_tibialis_anterior','contralateral_hip_flexors',
        'obliques','deep_trunk_stabilizers','spinal_extensors'),
      'joints',jsonb_build_array(
        'stance_metatarsophalangeal','stance_talocrural','stance_subtalar',
        'stance_knee','stance_hip','pelvis','spine'),
      'jointActions',jsonb_build_array(
        'stance_ankle_plantarflexion_and_dorsiflexion',
        'stance_knee_flexion_and_extension','stance_hip_flexion_and_extension',
        'frontal_plane_lateral_projection','hip_pelvis_and_trunk_alignment_control',
        'same_leg_landing_deceleration_and_stabilization'),
      'planes',jsonb_build_array(
        'frontal_primary_projection','sagittal_takeoff_and_landing_absorption',
        'transverse_alignment_control'),
      'laterality','ipsilateral_single_leg_takeoff_and_landing_sides_programmed'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Practises one controlled same-leg lateral obstacle clearance and a stable same-leg landing with exact side accounting.',
      'primaryCue','Name the leg and direction, push from that leg, clear the low hurdle, land on the same leg, absorb and freeze.',
      'expectedSensations',jsonb_build_array(
        'brief_stance_leg_effort','whole_foot_pressure_on_landing',
        'controlled_ankle_knee_hip_and_trunk_absorption'),
      'unexpectedSensations',jsonb_build_array(
        'pain','joint_pinching','instability','numbness','dizziness',
        'obstacle_contact_or_fear_that_changes_the_hop'),
      'painGuidance','Stop immediately for pain, guarding, instability, dizziness, obstacle contact, free-foot contact, or an uncontrolled landing; do not repeat to test the symptom.',
      'selfChecks',jsonb_build_array(
        'stance leg and direction match the card','same leg starts, leaves, and lands',
        'one hurdle is fully cleared','whole foot lands in the zone',
        'hold has no free-foot touch, step, or extra hop',
        'exit and reset happen only after the coach signal'),
      'accessibility',jsonb_build_array(
        'plain_language_steps','left_right_and_direction_labels',
        'high_contrast_hurdle_and_landing_marks',
        'coach_demonstration_from_front_and_side','visual_and_spoken_start_stop_cues',
        'ground_only_or_bilateral_alternative_when_clearance_is_not_appropriate'),
      'mediaAlternatives',jsonb_build_array(
        'captioned_video_after_approval','written_sequence','still_frame_sequence')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'declared_stance_leg_and_direction','stationary_single_leg_start',
        'same_leg_takeoff','lateral_projection','clean_single_hurdle_clearance',
        'same_leg_whole_foot_landing','foot_knee_hip_pelvis_trunk_alignment',
        'quiet_absorption','declared_hold','safe_exit','full_reset','side_count'),
      'faultCorrections',jsonb_build_array(
        'Wrong or opposite-leg landing: remove the hurdle and restore the exact same-leg floor task.',
        'Toe catch or excessive tuck: reduce obstacle height and distance; do not cue a riskier clearance.',
        'Free-foot touch or extra hop: shorten distance and restore the held same-leg landing.',
        'Loud, stiff, or unstable landing: reduce intent or use the ground-only or bilateral alternative.'),
      'demonstrationPlan',jsonb_build_array(
        'Show leg and direction naming, hurdle inspection, marks, one clearance, hold, exit, reset, and side change.',
        'Show invalid opposite-leg, free-foot-touch, obstacle-contact, rebound, and sprint-exit examples.'),
      'groupManagement',jsonb_build_object(
        'lane','one_athlete_one_hurdle_one_landing_zone',
        'traffic','closed_during_attempt_and_hurdle_reset',
        'signals','shared_start_stop_and_exit_cues',
        'sideTracking','coach_or_station_card_records_leg_and_direction',
        'coachPosition','takeoff_hurdle_landing_and_fall_space_visible'),
      'modificationDecisionTree',jsonb_build_object(
        'clearance_or_confidence_not_repeatable','use_single_leg_ground_only_lateral_hop_to_stick',
        'same_leg_landing_not_repeatable','use_bilateral_ground_or_low_hurdle_card_after_objective_review',
        'opposite_leg_objective','choose_an_exact_contralateral_bound_definition',
        'pain_or_restriction','stop_and_follow_clinical_or_facility_process'),
      'doNotUseWhen',jsonb_build_array(
        'hurdle_or_lane_cannot_be_made_safe','same_leg_contract_is_not_understood',
        'landing_quality_is_not_repeatable','side_or_impact_budget_is_unknown_or_exceeded')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','equipment','hurdle_height','stance_leg','direction',
        'takeoff','landing','hold','lane','symptoms','substitution','accessibility','media'),
      'supportEscalation',jsonb_build_object(
        'coach',jsonb_build_array('repeated_technical_fault','identity_side_or_dose_unclear'),
        'contentReview',jsonb_build_array(
          'candidate_media_mismatch','taxonomy_or_score_question'),
        'urgent',jsonb_build_array(
          'injury_event','obstacle_trip_or_collision','broken_or_unstable_hurdle')),
      'requiredIssueContext',jsonb_build_array(
        'card_and_variant_id','card_version','hurdle_dimensions','stance_leg',
        'direction','surface','attempt_number','observed_fault_or_symptom',
        'substitution_used'),
      'retentionPolicy','Retain generated prescription, card version, hurdle and lane setup, per-side contact count, validation result, edits, substitutions, and stop events.',
      'changeImpactPolicy','Any support, obstacle category, landing-leg, contact-count, terminal-action, safety, or instruction change requires card and saved-workout revalidation.',
      'knownLimitations',jsonb_build_array(
        'proposed_scores_not_independently_calibrated','candidate_media_not_human_reviewed',
        'no_universal_hurdle_height_or_safe_contact_threshold'),
      'supportSummary','Verify the exact same-leg single-clearance and side contract before troubleshooting dose or technique.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'lateralLowHurdleIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','author_exact_same_leg_low_hurdle_definition_without_source_mapping',
      'legacySourceMapped',FALSE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=single_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
    (bilateral_variant_id,bilateral_id,
      'stationary-two-foot-single-lateral-low-hurdle-clearance-to-two-foot-stick',
      'Bilateral Lateral Low-Hurdle Jump — Single Clearance to Two-Foot Stick',
      ARRAY['stationary','two_foot','lateral','single_low_hurdle','two_foot_stick'],
      jsonb_build_object(
        'technicalComplexity',48,'absoluteLoadDemand',44,
        'baseOverallDifficulty',48,'coordinationDemand',58,
        'supervisionDemand',70,'failureConsequence',72,'impact',50,
        'workCapacityDemand',30,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'),
        'athleteProficiencyExcluded',TRUE),
      jsonb_build_object(
        'selectable',TRUE,'start','stationary_two_foot_athletic_stance',
        'takeoff','simultaneous_two_foot','projection','lateral_single_clearance',
        'obstacle','one_collapsible_low_hurdle',
        'obstacleDimensions','declared_height_width_and_orientation',
        'landing','simultaneous_two_foot_whole_foot_in_marked_zone',
        'absorption','ankle_knee_hip_with_pelvis_and_trunk_control',
        'hold','declared_and_stable_without_step_or_extra_hop',
        'exit','coach_signaled_away_from_hurdle_and_lane',
        'completion','full_reset_before_next_attempt',
        'sideAccounting','attempts_counted_by_projection_direction',
        'equipmentRequired',jsonb_build_array('low_hurdle')),
      'review',
      jsonb_build_object(
        'externalLoadMethod','bodyweight_plus_declared_low_hurdle_clearance_demand',
        'gripDemand',1,'spinalLoading',18,'eccentricStress',48,
        'landingContactsPerRep',2,'impactLevel',3,
        'exposureMetric','completed_bilateral_lateral_clearances_and_two_foot_landings',
        'loadTracking',jsonb_build_array(
          'hurdle_height','hurdle_width','lateral_distance','sets','attempts',
          'direction','hold','rest','obstacle_contacts','landing_faults',
          'symptoms','other_jump_running_and_change_of_direction_contacts'),
        'doNotInfer',jsonb_build_array(
          'universal_hurdle_height','universal_safe_contact_count',
          'injury_prevention')),
      jsonb_build_object(
        'localMuscleFatigue',48,'gripFatigue',1,
        'technicalFatigueSensitivity',74,'impactAccumulation',50,
        'recoveryHours',36,
        'primaryFatigueSites',jsonb_build_array(
          'feet','calves_and_achilles','quadriceps_and_patellar_tendon',
          'gluteals_and_hips','trunk'),
        'stopBefore',jsonb_build_array(
          'pain_guarding_or_instability','obstacle_contact_or_toe_catch',
          'split_takeoff_or_landing','loud_stiff_or_target_missed_landing',
          'valgus_pelvic_or_trunk_control_loss','extra_step_hop_or_failed_hold',
          'two_consecutive_output_or_technique_changes','unsafe_hurdle_lane_or_traffic')),
      jsonb_build_object(
        'trainingStimuli',jsonb_build_array(
          'bilateral_lateral_projection','low_obstacle_clearance',
          'two_foot_frontal_plane_landing_and_terminal_control'),
        'stimulusDose',jsonb_build_object(
          'primary','fully_reset_valid_single_clearances','fatigueCeiling','low'),
        'weeklyExposure',jsonb_build_object(
          'typicalSessions',1,'maximumWithoutReview',2,
          'countWithOtherJumpLandingRunningAndChangeOfDirectionWork',TRUE),
        'prerequisites',jsonb_build_array(
          'pain_free_bilateral_jump_and_landing',
          'repeatable_ground_only_bilateral_lateral_jump_to_stick',
          'safe_collapsible_hurdle_lane_and_landing_zone',
          'ability_to_stop_exit_and_reset_on_command'),
        'completionCriteria',jsonb_build_array(
          'stationary_two_foot_start','simultaneous_two_foot_takeoff',
          'clean_single_hurdle_clearance','simultaneous_two_foot_landing',
          'quiet_aligned_absorption','stable_hold','safe_exit','full_reset'),
        'sequenceRules',jsonb_build_array(
          'after_specific_warmup','while_fresh','before_material_jump_or_running_fatigue',
          'not_density_conditioning'),
        'pairingCompatibility',jsonb_build_object(
          'preferred',jsonb_build_array('low_fatigue_mobility','noncompeting_strength_afterward'),
          'conditional',jsonb_build_array('sprinting','change_of_direction','other_jump_landings')),
        'interferenceRules',jsonb_build_array(
          'count_all_jump_landing_running_and_change_of_direction_contacts'),
        'uncertaintyPolicy',jsonb_build_object(
          'hurdle_lane_support_or_landing_unclear','do_not_start',
          'symptoms_quality_or_budget_unclear','stop_and_review'),
        'cumulativeBudget',jsonb_build_object(
          'landingContacts','two_per_valid_attempt',
          'technicalSensitivity',74,'impactLevel',3))),
    (single_variant_id,single_id,
      'stationary-same-leg-single-lateral-low-hurdle-clearance-to-same-leg-stick',
      'Single-Leg Lateral Low-Hurdle Hop — Single Clearance to Same-Leg Stick',
      ARRAY['stationary','same_leg','lateral','single_low_hurdle','same_leg_stick'],
      jsonb_build_object(
        'technicalComplexity',60,'absoluteLoadDemand',52,
        'baseOverallDifficulty',60,'coordinationDemand',72,
        'supervisionDemand',78,'failureConsequence',80,'impact',62,
        'workCapacityDemand',32,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'),
        'athleteProficiencyExcluded',TRUE),
      jsonb_build_object(
        'selectable',TRUE,'start','stationary_declared_single_leg_athletic_stance',
        'takeoff','declared_single_leg','projection','lateral_single_clearance',
        'directionRelativeToStanceLeg','declared_before_attempt',
        'obstacle','one_collapsible_low_hurdle',
        'obstacleDimensions','declared_height_width_and_orientation',
        'landing','same_leg_whole_foot_in_marked_zone',
        'absorption','stance_ankle_knee_hip_with_pelvis_and_trunk_control',
        'hold','declared_and_stable_without_free_foot_step_or_extra_hop',
        'exit','coach_signaled_away_from_hurdle_and_lane',
        'completion','full_reset_before_direction_or_side_change',
        'sideAccounting','attempts_counted_by_stance_leg_and_direction',
        'equipmentRequired',jsonb_build_array('low_hurdle')),
      'review',
      jsonb_build_object(
        'externalLoadMethod','bodyweight_plus_declared_low_hurdle_clearance_demand',
        'gripDemand',1,'spinalLoading',22,'eccentricStress',58,
        'landingContactsPerRep',1,'impactLevel',3,
        'exposureMetric','completed_same_leg_lateral_clearances_and_landings_by_leg_and_direction',
        'loadTracking',jsonb_build_array(
          'hurdle_height','hurdle_width','lateral_distance','stance_leg',
          'direction','sets','attempts_per_side','hold','rest','obstacle_contacts',
          'landing_faults','symptoms','other_jump_running_and_change_of_direction_contacts'),
        'doNotInfer',jsonb_build_array(
          'universal_hurdle_height','universal_safe_contact_count',
          'injury_prevention')),
      jsonb_build_object(
        'localMuscleFatigue',56,'gripFatigue',1,
        'technicalFatigueSensitivity',82,'impactAccumulation',62,
        'recoveryHours',48,
        'primaryFatigueSites',jsonb_build_array(
          'stance_foot','stance_calf_and_achilles','stance_quadriceps_and_patellar_tendon',
          'stance_gluteals_and_hip','trunk'),
        'stopBefore',jsonb_build_array(
          'pain_guarding_or_instability','obstacle_contact_or_toe_catch',
          'wrong_or_opposite_leg_landing','free_foot_touch_step_or_extra_hop',
          'loud_stiff_or_target_missed_landing',
          'valgus_pelvic_or_trunk_control_loss',
          'two_consecutive_output_or_technique_changes','unsafe_hurdle_lane_or_traffic')),
      jsonb_build_object(
        'trainingStimuli',jsonb_build_array(
          'same_leg_lateral_projection','low_obstacle_clearance',
          'unilateral_frontal_plane_landing_and_terminal_control'),
        'stimulusDose',jsonb_build_object(
          'primary','fully_reset_valid_single_clearances_per_side','fatigueCeiling','low'),
        'weeklyExposure',jsonb_build_object(
          'typicalSessions',1,'maximumWithoutReview',2,
          'countWithOtherUnilateralJumpLandingRunningAndChangeOfDirectionWork',TRUE),
        'prerequisites',jsonb_build_array(
          'pain_free_single_leg_takeoff_and_same_leg_landing',
          'repeatable_ground_only_same_leg_lateral_hop_to_stick',
          'safe_collapsible_hurdle_lane_and_landing_zone',
          'ability_to_name_leg_direction_stop_exit_and_reset'),
        'completionCriteria',jsonb_build_array(
          'declared_stance_leg_and_direction','stationary_single_leg_start',
          'same_leg_takeoff','clean_single_hurdle_clearance','same_leg_whole_foot_landing',
          'quiet_aligned_absorption','stable_hold_without_free_foot_touch',
          'safe_exit','full_reset','side_dose_recorded'),
        'sequenceRules',jsonb_build_array(
          'after_specific_warmup','while_fresh',
          'before_material_unilateral_jump_running_or_change_of_direction_fatigue',
          'not_density_conditioning'),
        'pairingCompatibility',jsonb_build_object(
          'preferred',jsonb_build_array('low_fatigue_mobility','noncompeting_strength_afterward'),
          'conditional',jsonb_build_array('sprinting','change_of_direction','other_unilateral_landings')),
        'interferenceRules',jsonb_build_array(
          'count_all_unilateral_jump_landing_running_and_change_of_direction_contacts_by_side'),
        'uncertaintyPolicy',jsonb_build_object(
          'hurdle_lane_leg_direction_or_landing_unclear','do_not_start',
          'symptoms_quality_side_balance_or_budget_unclear','stop_and_review'),
        'cumulativeBudget',jsonb_build_object(
          'landingContacts','one_per_valid_attempt_counted_by_side',
          'technicalSensitivity',82,'impactLevel',3)))
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
      CASE profile.phase_key WHEN 'output' THEN
        'Fresh bilateral lateral low-hurdle projection, clearance, landing, and terminal-stick quality.'
      ELSE 'Low-volume bilateral hurdle-clearance and two-foot landing-control exposure after exact ground-task ownership.' END
    ELSE CASE profile.phase_key WHEN 'output' THEN
        'Fresh same-leg lateral low-hurdle projection, clearance, landing, and side-specific terminal control.'
      ELSE 'Low-volume same-leg hurdle-clearance and landing-control exposure after exact ground-task ownership.' END END,
    CASE profile.phase_key WHEN 'output' THEN 88 ELSE 76 END,
    CASE profile.phase_key WHEN 'output' THEN 90 ELSE 82 END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      jsonb_build_object(
        'primary',jsonb_build_array(
          'bilateral_lateral_power','low_obstacle_clearance','two_foot_landing_control'),
        'secondary',jsonb_build_array('frontal_plane_alignment','terminal_balance'),
        'notFor',jsonb_build_array(
          'single_leg_assessment','repeated_rebound_training','fatigue_conditioning'))
    ELSE jsonb_build_object(
        'primary',jsonb_build_array(
          'same_leg_lateral_power','low_obstacle_clearance',
          'unilateral_landing_control_and_side_comparison'),
        'secondary',jsonb_build_array('frontal_plane_alignment','terminal_balance'),
        'notFor',jsonb_build_array(
          'bilateral_assessment','contralateral_bound_training',
          'repeated_rebound_training','fatigue_conditioning')) END,
    CASE WHEN profile.variant_id=bilateral_variant_id THEN
      CASE profile.phase_key WHEN 'output' THEN jsonb_build_object(
        'volumeUnit','attempts','sets',jsonb_build_array(2,3),
        'attemptsPerSet',jsonb_build_array(2,4),'restSeconds',jsonb_build_array(75,150),
        'holdSeconds',jsonb_build_array(2,4),'effort','high_intent_with_quality_limit',
        'contactAccounting','two_landing_foot_contacts_per_attempt',
        'stopAfter','first_invalid_or_two_materially_changed_attempts')
      ELSE jsonb_build_object(
        'volumeUnit','attempts','sets',jsonb_build_array(1,3),
        'attemptsPerSet',jsonb_build_array(2,3),'restSeconds',jsonb_build_array(60,150),
        'holdSeconds',jsonb_build_array(2,5),'effort','submaximal_to_crisp',
        'contactAccounting','two_landing_foot_contacts_per_attempt',
        'stopAfter','first_invalid_or_two_materially_changed_attempts') END
    ELSE CASE profile.phase_key WHEN 'output' THEN jsonb_build_object(
        'volumeUnit','attempts_per_stance_leg_and_direction',
        'sets',jsonb_build_array(2,3),'attemptsPerSidePerSet',jsonb_build_array(2,3),
        'restSeconds',jsonb_build_array(90,180),'holdSeconds',jsonb_build_array(2,4),
        'effort','high_intent_with_quality_limit',
        'contactAccounting','one_same_leg_landing_contact_per_attempt_by_side',
        'stopAfter','first_invalid_or_two_materially_changed_attempts')
      ELSE jsonb_build_object(
        'volumeUnit','attempts_per_stance_leg_and_direction',
        'sets',jsonb_build_array(1,3),'attemptsPerSidePerSet',jsonb_build_array(1,3),
        'restSeconds',jsonb_build_array(75,180),'holdSeconds',jsonb_build_array(2,5),
        'effort','submaximal_to_crisp',
        'contactAccounting','one_same_leg_landing_contact_per_attempt_by_side',
        'stopAfter','first_invalid_or_two_materially_changed_attempts') END END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'Both feet start and leave together, the declared low hurdle is cleared without contact, both whole feet land together in the zone, alignment stays controlled, the hold is stable, and exit and reset follow the declared process.'
    ELSE 'The declared leg starts, leaves, and lands; the low hurdle is cleared without contact, the whole foot lands in the zone, alignment and pelvis remain controlled, the hold has no free-foot touch or extra contact, and side dose is recorded.' END,
    ARRAY['pain_or_guarding','instability_or_dizziness','obstacle_contact_or_toe_catch',
      'wrong_split_or_partial_foot_contact','loud_stiff_or_target_missed_landing',
      'valgus_pelvic_or_trunk_control_loss','extra_contact_or_failed_hold',
      'two_consecutive_output_or_technique_changes','unsafe_hurdle_lane_or_traffic'],
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      ARRAY['Inspect and measure the collapsible hurdle; mark takeoff and landing zones.',
        'Name the projection direction, attempt count, hold, exit, and stop signal.',
        'Observe both feet, clearance, landing, alignment, hold, and reset.',
        'Count two landing-foot contacts per attempt in the cumulative impact budget.']
    ELSE ARRAY['Inspect and measure the collapsible hurdle; mark same-leg takeoff and landing zones.',
        'Name stance leg, direction, attempts per side, hold, exit, and stop signal.',
        'Observe takeoff leg, clearance, same-leg landing, alignment, hold, and reset.',
        'Count every same-leg landing by leg and direction in the cumulative impact budget.'] END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      ARRAY['Set both feet beside the hurdle.','Push sideways from both feet together.',
        'Clear once, land on both whole feet together, absorb and freeze.',
        'Wait for the exit signal, leave the lane, and reset.']
    ELSE ARRAY['Name your stance leg and direction.','Push sideways from that leg.',
        'Clear once, land on the same whole foot, absorb and freeze.',
        'Keep the free foot off, wait for the exit signal, leave the lane, and reset.'] END,
    CASE profile.variant_id WHEN bilateral_variant_id THEN
      'More repeatable bilateral lateral obstacle clearance and controlled two-foot landing under a fixed low-hurdle contract.'
    ELSE 'More repeatable same-leg lateral obstacle clearance and side-specific unilateral landing control under a fixed low-hurdle contract.' END,
    ARRAY['low_hurdle'],
    CASE profile.variant_id WHEN bilateral_variant_id THEN jsonb_build_object(
      'stationFootprint','one_measured_collapsible_hurdle_with_marked_two_foot_takeoff_and_landing_zones',
      'lane','closed_lateral_flight_landing_fall_and_exit_space',
      'groupCapacity','one_active_athlete_per_lane',
      'reset','coach_or_designated_person_restores_hurdle_only_after_lane_closure',
      'visibility','both_feet_hurdle_landing_zone_and_trunk_visible')
    ELSE jsonb_build_object(
      'stationFootprint','one_measured_collapsible_hurdle_with_marked_same_leg_takeoff_and_landing_zones',
      'lane','closed_lateral_flight_landing_fall_and_exit_space',
      'groupCapacity','one_active_athlete_per_lane',
      'sideTracking','stance_leg_and_direction_recorded',
      'reset','coach_or_designated_person_restores_hurdle_only_after_lane_closure',
      'visibility','stance_leg_hurdle_landing_leg_zone_and_trunk_visible') END,
    ARRAY[]::UUID[],'review',
    CASE profile.variant_id WHEN bilateral_variant_id THEN jsonb_build_object(
      'setupSeconds',50,'attemptSeconds',7,'holdSeconds',3,
      'resetSeconds',18,'transitionSeconds',20,
      'durationFormula','setup + sets*(attempts*(attempt+hold+reset)+between_attempt_rest) + between_set_rest + transition',
      'validation','recompute_after_hurdle_distance_attempt_rest_or_substitution_change')
    ELSE jsonb_build_object(
      'setupSeconds',60,'attemptSeconds',8,'holdSeconds',3,
      'resetSeconds',22,'transitionSeconds',25,
      'durationFormula','setup + sides*sets*(attempts*(attempt+hold+reset)+between_attempt_rest) + between_side_and_set_rest + transition',
      'validation','recompute_after_hurdle_leg_direction_attempt_rest_or_substitution_change') END,
    jsonb_build_object(
      'reduceFirst',jsonb_build_array(
        'hurdle_height','lateral_distance','effort','attempts','measurement_pressure'),
      'increaseFirst',jsonb_build_array('rest','visual_marking','instruction_time'),
      'neverScaleAcross',CASE profile.variant_id WHEN bilateral_variant_id THEN
        jsonb_build_array('takeoff_foot_count','landing_foot_count','obstacle_presence',
          'contact_count','terminal_stick','full_reset')
      ELSE jsonb_build_array('stance_leg','landing_leg','obstacle_presence',
          'contact_count','terminal_stick','side_accounting','full_reset') END),
    CASE profile.variant_id WHEN bilateral_variant_id THEN jsonb_build_object(
      'required',jsonb_build_array(
        'hurdle_height','hurdle_width','projection_direction','attempts',
        'valid_clearances','landing_quality','hold_success','obstacle_contacts',
        'symptoms','rest','cumulative_landing_contacts'),
      'optional',jsonb_build_array('flight_time','jump_distance','video_review'),
      'doNotInfer',jsonb_build_array(
        'injury_prevention','unmeasured_force','universal_safe_height_or_volume'))
    ELSE jsonb_build_object(
      'required',jsonb_build_array(
        'hurdle_height','hurdle_width','stance_leg','projection_direction',
        'attempts_per_side','valid_clearances','landing_quality','hold_success',
        'obstacle_contacts','symptoms','rest','cumulative_contacts_by_side'),
      'optional',jsonb_build_array('flight_time','hop_distance','video_review'),
      'doNotInfer',jsonb_build_array(
        'injury_prevention','unmeasured_force','universal_safe_height_or_volume')) END,
    jsonb_build_object(
      'athletePrompt','Report pain, instability, dizziness, obstacle contact, landing uncertainty, or a need for a ground-only alternative before continuing.',
      'coachPrompt','Record exact support, hurdle dimensions, lane, direction, valid attempts, landing contacts, faults, symptoms, rest, substitutions, and stop events.',
      'supportPrompt','Retain card and variant IDs, version, profile, hurdle setup, validation evidence, rendered instructions, edits, substitutions, and outcome.')
  FROM(VALUES
    (bilateral_variant_id,'output-quality','output','primary'),
    (bilateral_variant_id,'resilience-control','resilience','secondary'),
    (single_variant_id,'output-quality','output','primary'),
    (single_variant_id,'resilience-control','resilience','secondary')
  ) profile(variant_id,profile_key,phase_key,role)
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
  SELECT definition.id,
    CASE WHEN definition.id=source_id THEN 2 ELSE 1 END,
    evidence.section_key,evidence.source_url,evidence.source_title,
    evidence.source_publisher,evidence.source_kind,
    jsonb_build_array(
      replace(evidence.claim_1,'{{card}}',definition.canonical_name),
      replace(evidence.claim_2,'{{card}}',definition.canonical_name),
      jsonb_build_object('researchBatch',research_batch,
        'researchVersion',research_version,'humanReviewRequired',TRUE)),
    evidence.evidence_quality,'candidate',NULL,NULL
  FROM(VALUES
    ('identity','https://pubmed.ncbi.nlm.nih.gov/17620779/',
      'Lower extremity biomechanics during single- and double-leg landing tasks',
      'Clinical Biomechanics','peer_reviewed_research',84,
      'Single- and double-leg landings produce different lower-extremity kinematics and muscle-activation patterns.',
      '{{card}} must declare takeoff support, landing support, direction, obstacle, contact count, terminal action, and reset rather than inferring them from hop or jump wording.'),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/21873903/',
      'Training specificity of hurdle vs. countermovement jump training',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',82,
      'Bilateral and unilateral hurdle-jump tasks can differ in contact time and force expression, so support and obstacle contracts are identity-bearing.',
      '{{card}} uses controlled movement taxonomy and contains no athlete skill or proficiency classification.'),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/17620779/',
      'Lower extremity biomechanics during single- and double-leg landing tasks',
      'Clinical Biomechanics','peer_reviewed_research',84,
      'Landing support changes knee kinematics and lower-extremity muscle activation.',
      '{{card}} records joints, actions, tissues, planes, laterality, support, and stabilization for its exact landing contract.'),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/37519153/',
      'The effects of hurdle height on lower extremity biomechanics during hurdle jumps',
      'Sports Biomechanics','peer_reviewed_research',80,
      'Changing hurdle height changes aspects of flight posture and task execution.',
      '{{card}} therefore declares hurdle dimensions, clearance, landing zone, absorption, hold, exit, and reset without inventing a universal safe height.'),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/21873903/',
      'Training specificity of hurdle vs. countermovement jump training',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',82,
      'Hurdle and support contracts change coordination, contact, and force demands.',
      '{{card}} scores exercise complexity and physical difficulty only; overall difficulty is their maximum and is not an athlete level.'),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/37519153/',
      'The effects of hurdle height on lower extremity biomechanics during hurdle jumps',
      'Sports Biomechanics','peer_reviewed_research',80,
      'Hurdle dimensions can alter the movement solution and must be tracked with exposure.',
      '{{card}} tracks hurdle setup, attempts, contacts, landing quality, other impact exposure, symptoms, rest, and recovery without claiming a universal threshold.'),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/37519153/',
      'The effects of hurdle height on lower extremity biomechanics during hurdle jumps',
      'Sports Biomechanics','peer_reviewed_research',80,
      'Hurdle height is a task constraint, not a cosmetic equipment annotation.',
      '{{card}} requires a measured collapsible low hurdle, marked takeoff and landing zones, a closed lane, safe surface, visibility, and supervision.'),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/35081839/',
      'Qualitative assessment of single-leg landing from a standardized horizontal hop',
      'International Journal of Sports Physical Therapy','peer_reviewed_research',80,
      'Landing quality can be assessed from observable technique under a standardized task.',
      '{{card}} uses low-volume fully reset attempts, side-aware contact accounting, declared rest, and quality-based stopping; exact dosage remains context-dependent.'),
    ('instructions','https://www.nsca.com/education/articles/kinetic-select/lateral-line-hops/',
      'Lateral Line Hops','National Strength and Conditioning Association',
      'professional_standard',80,
      'Lateral jumping instruction should define stance, direction, body position, and observable landing behavior.',
      '{{card}} supplies concise setup, execution, quality, exit, reset, and symptom-report instructions for athlete and coach.'),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/37519153/',
      'The effects of hurdle height on lower extremity biomechanics during hurdle jumps',
      'Sports Biomechanics','peer_reviewed_research',80,
      'An obstacle creates clearance and contact consequences that ground-only hopping does not have.',
      '{{card}} stops for symptoms, obstacle contact or toe catch, wrong support, landing failure, changed output, equipment failure, or unsafe lane traffic.'),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/21873903/',
      'Training specificity of hurdle vs. countermovement jump training',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',82,
      'Hurdle-jump adaptation is specific to task execution and support conditions.',
      '{{card}} validates identity, profile, dose, duration, logistics, cumulative impact and fatigue budgets, substitutions, and persisted output after every change.'),
    ('athlete_support','https://pubmed.ncbi.nlm.nih.gov/35081839/',
      'Qualitative assessment of single-leg landing from a standardized horizontal hop',
      'International Journal of Sports Physical Therapy','peer_reviewed_research',80,
      'Observable landing technique supports concise feedback and repeatable self-checks.',
      '{{card}} tells the athlete what must remain exact, how success is judged, when to stop, and how to request a ground-only alternative.'),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/21873903/',
      'Training specificity of hurdle vs. countermovement jump training',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',82,
      'Support condition and hurdle task should be standardized when exposure or outcomes are compared.',
      '{{card}} tells the coach what to measure, observe, count, budget, persist, and revalidate without treating a proposed score as approval.'),
    ('accessibility','https://pubmed.ncbi.nlm.nih.gov/17620779/',
      'Lower extremity biomechanics during single- and double-leg landing tasks',
      'Clinical Biomechanics','peer_reviewed_research',84,
      'Changing from bilateral to unilateral support changes the task rather than simply lowering or raising difficulty.',
      '{{card}} can scale hurdle height, distance, effort, attempts, rest, target pressure, or instruction modality only while its support, obstacle, landing, terminal action, and reset remain fixed.'),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/37519153/',
      'The effects of hurdle height on lower extremity biomechanics during hurdle jumps',
      'Sports Biomechanics','peer_reviewed_research',80,
      'Obstacle height and task setup affect execution and must be distinguished from support or contact-pattern changes.',
      '{{card}} reviews ground-only, bilateral, unilateral, opposite-leg, repeated, multi-hurdle, reactive, rotational, and loaded alternatives separately.'),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists','YouTube Help','manufacturer_instruction',82,
      'A successful YouTube oEmbed response establishes current link and embedding availability only.',
      '{{card}} requires human playback review for exact movement, cues, safety, captions, accessibility, quality, and approval before any candidate is rendered as approved media.')
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
  SELECT definition.id,media.variant_id,
    CASE WHEN definition.id=source_id THEN 2 ELSE 1 END,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,
    now()+INTERVAL '30 days',media.notes
  FROM(VALUES
    ('bilateral-lateral-low-hurdle-jump-to-stick',bilateral_variant_id,
      'lymbF-brPvQ','Double Leg Lateral Hurdle Hop Stick','Levelup Jared Hatz',
      'double leg lateral hurdle hop stick',
      'YouTube oEmbed was healthy. Title names a double-leg lateral hurdle hop and stick; exact setup, contact, landing, hold, cues, captions, accessibility, quality, reviewer, and approval remain unresolved.'),
    ('bilateral-lateral-low-hurdle-jump-to-stick',bilateral_variant_id,
      'ear4XAser10','Bilateral Lateral Hurdle Hops (stick landing)',
      'Flight Performance & Fitness','bilateral lateral hurdle hop stick landing',
      'YouTube oEmbed was healthy. Title match is discovery evidence only; full playback and qualified review are required.'),
    ('bilateral-lateral-low-hurdle-jump-to-stick',bilateral_variant_id,
      '362qbIZF1jE','2-Leg Lateral Hurdle Jumps','BSC Strength WI',
      'two leg lateral hurdle jump stick',
      'YouTube oEmbed was healthy. The title does not establish a terminal stick, exact contact contract, or demonstration quality.'),
    ('bilateral-lateral-low-hurdle-jump-to-stick',bilateral_variant_id,
      '0I0oWEnrEVc','Lateral Hurdle Jump+Stick (short demo) "stick and hold the landing"',
      'ADAM REES','bilateral lateral hurdle jump stick hold landing',
      'YouTube oEmbed was healthy. Support, hurdle, landing, exit, safety, captions, accessibility, quality, reviewer, and approval remain unset.'),
    ('bilateral-lateral-low-hurdle-jump-to-stick',bilateral_variant_id,
      'Bw5ytVM3U_8','Lateral Hurdle Hop Stick','Performance Unlimited',
      'lateral hurdle hop stick bilateral',
      'YouTube oEmbed was healthy. The generic title cannot prove the exact bilateral contract; human review is required.'),
    ('single-leg-lateral-low-hurdle-hop-to-stick',single_variant_id,
      'iPNiem2uJA8','Single Leg Lateral Hurdle Hops With Sticks',
      'SHIFT Movement Science and Gymnastics Education',
      'single leg lateral hurdle hop stick',
      'YouTube oEmbed was healthy. Exact same-leg contract, single-clearance dose, landing, cues, captions, accessibility, quality, reviewer, and approval remain unresolved.'),
    ('single-leg-lateral-low-hurdle-hop-to-stick',single_variant_id,
      '7aMbZAmd2qY','1 Leg Lateral Hurdle Hop with Stick',
      'Champion Physical Therapy and Performance',
      'one leg lateral hurdle hop with stick',
      'YouTube oEmbed was healthy. Title match does not create exact-match or quality approval.'),
    ('single-leg-lateral-low-hurdle-hop-to-stick',single_variant_id,
      'pIb9NJyRKMk','Single-leg hurdle hop with lateral stick',
      'LEGACY HEALTH AND PERFORMANCE','single leg hurdle hop lateral stick',
      'YouTube oEmbed was healthy. Full movement, safety, cues, captions, accessibility, quality, and reviewer checks remain required.'),
    ('single-leg-lateral-low-hurdle-hop-to-stick',single_variant_id,
      'a9clGYbxAjw','Single Leg Lateral Hurdle Hop Stick','Levelup Jared Hatz',
      'single leg lateral hurdle hop stick',
      'YouTube oEmbed was healthy. Same-leg landing and exact terminal contract must be verified by a qualified human.'),
    ('single-leg-lateral-low-hurdle-hop-to-stick',single_variant_id,
      'e1AQ_ZT4B10','Single Leg Lateral Hurdle Hop and stick',
      'Prepare For Performance','single leg lateral hurdle hop and stick',
      'YouTube oEmbed was healthy. Candidate-only discovery; no external verification or approval is claimed.'),
    ('low-hurdle-lateral-hop-to-stick',NULL::UUID,
      'lymbF-brPvQ','Double Leg Lateral Hurdle Hop Stick','Levelup Jared Hatz',
      'adjacent bilateral interpretation',
      'Adjacent bilateral interpretation only. Media cannot establish the missing source foot contract or create a mapping.'),
    ('low-hurdle-lateral-hop-to-stick',NULL::UUID,
      '7aMbZAmd2qY','1 Leg Lateral Hurdle Hop with Stick',
      'Champion Physical Therapy and Performance','adjacent single-leg interpretation',
      'Adjacent single-leg interpretation only. Media cannot establish the missing source takeoff and landing contract.'),
    ('low-hurdle-lateral-hop-to-stick',NULL::UUID,
      'Bw5ytVM3U_8','Lateral Hurdle Hop Stick','Performance Unlimited',
      'adjacent ambiguous interpretation',
      'Adjacent title candidate only. No source mapping, exact-match result, reviewer decision, or approval is inferred.')
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
  SELECT definition.id,
    CASE WHEN definition.id=source_id THEN 2 ELSE 1 END,
    alternate.alternate_name,alternate.classification,alternate.rationale,
    alternate.dimensions,
    CASE WHEN alternate.classification IN('new_definition','new_variant') THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Bilateral Lateral Jump to Stick','new_definition',
      'The ground-only task has no raised obstacle, minimum clearance, or trip exposure.',
      '{"obstacle":"none","existingDefinition":"lateral-hop-to-stick"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Single-Leg Lateral Low-Hurdle Hop to Stick','new_definition',
      'Same-leg support changes impulse distribution, landing mechanics, side dose, and readiness.',
      '{"support":"ipsilateral_single_leg"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Continuous Bilateral Lateral Hurdle Hops','new_definition',
      'Repeated rebounds remove the terminal hold and full reset.',
      '{"terminalAction":"rebound","contacts":"repeated"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Bilateral Multi-Hurdle Lateral Jump-and-Stick Series','new_definition',
      'Multiple ordered clearances and landings change contact count, fatigue, spacing, and dose.',
      '{"obstacles":"multiple","contacts":"multiple"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Bilateral Lateral Hurdle Jump to Sprint','new_definition',
      'A sprint exit replaces the terminal stick and adds acceleration contacts.',
      '{"terminalAction":"sprint"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Bilateral Lateral Hurdle Jump with Rotation','new_definition',
      'Aerial reorientation adds a different landing orientation and failure mode.',
      '{"rotation":"declared_nonzero"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Reactive-Cue Bilateral Lateral Hurdle Jump to Stick','new_variant',
      'A late direction cue materially increases decision and lane-management demand.',
      '{"cueing":"reactive"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Weighted-Vest Bilateral Lateral Hurdle Jump to Stick','new_variant',
      'External torso load changes physical difficulty and landing load.',
      '{"externalLoad":"weighted_vest"}'::JSONB),
    ('bilateral-lateral-low-hurdle-jump-to-stick',
      'Hurdle Height, Lateral Distance, Hold, Attempts, Rest, or Side Order',
      'modifier_annotation',
      'These scale delivery only inside reviewed low-hurdle and support bounds.',
      '{"modifiers":["hurdle_height","lateral_distance","hold","attempts","rest","side_order"]}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Single-Leg Lateral Hop to Stick','new_definition',
      'The ground-only task has no raised obstacle, minimum clearance, or trip exposure.',
      '{"obstacle":"none","existingDefinition":"single-leg-lateral-hop-to-stick"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Bilateral Lateral Low-Hurdle Jump to Stick','new_definition',
      'Two-foot support changes impulse distribution, landing mechanics, dose, and readiness.',
      '{"support":"bilateral"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Opposite-Leg Lateral Bound over Low Hurdle to Stick','new_definition',
      'Contralateral landing changes the takeoff-to-landing relationship.',
      '{"landingLeg":"opposite"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Continuous Single-Leg Lateral Hurdle Hops','new_definition',
      'Repeated rebound contacts remove the terminal hold and full reset.',
      '{"terminalAction":"rebound","contacts":"repeated"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Single-Leg Multi-Hurdle Lateral Hop-and-Stick Series','new_definition',
      'Multiple clearances and landings change contact count, fatigue, spacing, and side dose.',
      '{"obstacles":"multiple","contacts":"multiple"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Same-Leg Medial Crossover Low-Hurdle Hop to Stick','new_variant',
      'Crossing toward and over the stance leg changes hip strategy while preserving same-leg support.',
      '{"directionRelativeToStanceLeg":"medial_crossover"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Reactive-Cue Single-Leg Lateral Low-Hurdle Hop to Stick','new_variant',
      'A late side or distance cue increases decision and lane-management demand.',
      '{"cueing":"reactive"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Weighted-Vest Single-Leg Lateral Low-Hurdle Hop to Stick','new_variant',
      'External torso load changes unilateral propulsion and landing demand.',
      '{"externalLoad":"weighted_vest"}'::JSONB),
    ('single-leg-lateral-low-hurdle-hop-to-stick',
      'Hurdle Height, Lateral Distance, Hold, Attempts, Rest, Direction, or Side Order',
      'modifier_annotation',
      'These scale delivery only inside reviewed low-hurdle and same-leg bounds.',
      '{"modifiers":["hurdle_height","lateral_distance","hold","attempts","rest","direction","side_order"]}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Bilateral Lateral Low-Hurdle Jump to Stick','same_identity',
      'Possible only if authoritative evidence establishes simultaneous two-foot takeoff and landing, one clearance, and a terminal hold.',
      '{"possibleMapping":"bilateral-lateral-low-hurdle-jump-to-stick"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Single-Leg Lateral Low-Hurdle Hop to Stick','same_identity',
      'Possible only if authoritative evidence establishes same-leg takeoff and landing, one clearance, side accounting, and terminal hold.',
      '{"possibleMapping":"single-leg-lateral-low-hurdle-hop-to-stick"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Opposite-Leg Lateral Bound over Low Hurdle to Stick','new_definition',
      'A contralateral landing is a third support identity.',
      '{"takeoffLandingRelationship":"contralateral"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Continuous Lateral Hurdle Hops','new_definition',
      'Repeated rebounds remove the terminal hold and full reset.',
      '{"terminalAction":"rebound"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Multi-Hurdle Lateral Hop-and-Stick Series','new_definition',
      'Multiple obstacles and contacts change sequence, fatigue, spacing, and dosage.',
      '{"obstacles":"multiple"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Ground-Only Lateral Jump or Hop to Stick','new_definition',
      'Removing the obstacle removes clearance, trip, and equipment constraints but still requires foot-count identity.',
      '{"obstacle":"none"}'::JSONB),
    ('low-hurdle-lateral-hop-to-stick',
      'Hurdle Height, Distance, Hold, Attempts, Rest, or Side Order',
      'modifier_annotation',
      'These become delivery modifiers only after exact support, contact, obstacle, hold, and reset identity is resolved.',
      '{"modifiers":["hurdle_height","distance","hold","attempts","rest","side_order"]}'::JSONB)
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
    (bilateral_ground_variant_id,bilateral_variant_id,'progression',82,
      ARRAY['obstacle','minimum_clearance','trip_exposure','landing_location','equipment'],
      'The low-hurdle task preserves stationary bilateral lateral projection and a two-foot terminal stick but adds a measured obstacle, minimum clearance, trip exposure, exact landing zone, equipment inspection, and lane-reset duties.',
      '{"requires":["repeatable_ground_only_bilateral_lateral_jump_to_stick","measured_collapsible_hurdle","closed_lane","impact_budget_revalidated"],"notEquivalentFor":["ground_only_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (bilateral_variant_id,bilateral_ground_variant_id,'regression',90,
      ARRAY['obstacle','minimum_clearance','trip_exposure','landing_location','equipment'],
      'Removing the hurdle preserves bilateral lateral takeoff and landing support plus the terminal hold while reducing clearance, trip, equipment, and lane-reset demands.',
      '{"useWhen":["clearance_or_trip_risk_is_not_appropriate","ground_task_remains_safe","dose_duration_and_impact_budget_revalidated"],"notEquivalentFor":["hurdle_clearance_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (single_ground_variant_id,single_variant_id,'progression',80,
      ARRAY['obstacle','minimum_clearance','trip_exposure','landing_location','equipment'],
      'The low-hurdle task preserves stationary same-leg lateral takeoff, same-leg landing, terminal hold, and side accounting but adds a measured obstacle, minimum clearance, trip exposure, landing zone, and lane-reset duties.',
      '{"requires":["repeatable_ground_only_same_leg_lateral_hop_to_stick","measured_collapsible_hurdle","closed_lane","side_specific_impact_budget_revalidated"],"notEquivalentFor":["ground_only_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (single_variant_id,single_ground_variant_id,'regression',90,
      ARRAY['obstacle','minimum_clearance','trip_exposure','landing_location','equipment'],
      'Removing the hurdle preserves same-leg lateral support, landing, terminal hold, and side accounting while reducing clearance, trip, equipment, and lane-reset demands.',
      '{"useWhen":["clearance_or_trip_risk_is_not_appropriate","same_leg_ground_task_remains_safe","dose_duration_and_side_budget_revalidated"],"notEquivalentFor":["hurdle_clearance_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (bilateral_variant_id,single_variant_id,'progression',68,
      ARRAY['takeoff_support','landing_support','laterality','impact_concentration','side_accounting'],
      'The same-leg hurdle task preserves one lateral low-hurdle clearance and terminal control but changes takeoff and landing from two feet to one named leg, increasing balance, unilateral load concentration, side accounting, and failure consequences.',
      '{"requires":["bilateral_hurdle_task_repeatable","single_leg_ground_prerequisite_repeatable","same_leg_contract_understood","side_specific_budget_revalidated"],"notEquivalentFor":["bilateral_assessment","unilateral_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (single_variant_id,bilateral_variant_id,'regression',72,
      ARRAY['takeoff_support','landing_support','laterality','impact_concentration','side_accounting'],
      'The bilateral hurdle task preserves one lateral low-hurdle clearance and terminal control while reducing unilateral support, side-accounting, and single-limb impact concentration.',
      '{"useWhen":["same_leg_support_is_not_repeatable_without_symptoms","bilateral_hurdle_task_is_appropriate","dose_duration_and_budget_revalidated"],"notEquivalentFor":["unilateral_assessment"]}'::JSONB,
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
      'Candidate exercise-complexity anchor based on exact takeoff and landing support, lateral direction, measured low-hurdle clearance, landing zone, absorption, terminal hold, exit, reset, and side accounting; independent human calibration is required.'
    ELSE
      'Candidate physical-difficulty anchor based on bodyweight projection, obstacle clearance, bilateral or unilateral landing impact and braking, accumulated jump and running exposure, symptoms, rest, and recovery; independent human calibration is required.' END,
    'review',1,NULL,NULL,
    'No score approval is created by migration 434; exercise scores are complexity and physical difficulty, never athlete skill levels.',NULL
  FROM(VALUES
    (bilateral_variant_id,48,44),
    (single_variant_id,60,52)
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
  SET decision='distinct_exercises',
    rationale='The archived source requires a low-hurdle clearance, while the completed Single-Leg Lateral Hop to Stick is explicitly ground-only. The source remains ambiguous about foot support, but obstacle presence alone is sufficient to distinguish it from this ground-only definition. No mapping to either new hurdle card is implied.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'identityBoundary','required_low_hurdle_vs_ground_only_same_leg_hop',
        'resolvedUnknown','obstacle_presence_is_known_even_though_foot_contract_is_not',
        'sourceRetirementMigration',migration_key,
        'researchBatch',research_batch,'researchVersion',research_version,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.survivor_definition_id=source_id
    AND resolution.resolved_definition_id=single_ground_id
    AND resolution.reviewed_by IS NULL
    AND resolution.resolution_source<>'human_review';

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET rationale='Bilateral Lateral Jump to Stick is explicitly ground-only, while the archived source requires a low hurdle. Obstacle presence, clearance, trip exposure, equipment, landing location, and lane operations distinguish the tasks even though the archived source foot contract remains unresolved.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'identityBoundary','ground_only_bilateral_jump_vs_required_low_hurdle_source',
        'sourceRetirementMigration',migration_key,
        'researchBatch',research_batch,'researchVersion',research_version,
        'decisionScope','identity_only_not_human_approval',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.survivor_definition_id=bilateral_ground_id
    AND resolution.resolved_definition_id=source_id
    AND resolution.decision='distinct_exercises'
    AND resolution.reviewed_by IS NULL
    AND resolution.resolution_source<>'human_review';

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=source_id
         AND resolved_definition_id=single_ground_id
         AND decision='distinct_exercises'
         AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=bilateral_ground_id
         AND resolved_definition_id=source_id
         AND decision='distinct_exercises'
         AND reviewed_by IS NULL) THEN
    RAISE EXCEPTION '% failed to resolve source-to-ground boundaries',migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,source_id,bilateral_id,'needs_human_review',
      'The archived source could map to the exact bilateral low-hurdle card only if authoritative evidence establishes simultaneous two-foot takeoff and landing, one clearance, a marked landing, terminal hold, safe exit, and full reset. Those facts are absent, so no consolidation is permitted.',
      jsonb_build_object(
        'possibleMapping','bilateral-lateral-low-hurdle-jump-to-stick',
        'missingIdentityFacts',jsonb_build_array(
          'takeoff_foot_count','landing_foot_count','obstacle_dimensions',
          'contact_count','landing_zone','hold','exit','reset'),
        'researchBatch',research_batch,'researchVersion',research_version,
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,source_id,single_id,'needs_human_review',
      'The archived source could map to the exact same-leg low-hurdle card only if authoritative evidence establishes a named single stance leg, same-leg landing, direction relative to stance, one clearance, side accounting, terminal hold, safe exit, and full reset. Those facts are absent, so no consolidation is permitted.',
      jsonb_build_object(
        'possibleMapping','single-leg-lateral-low-hurdle-hop-to-stick',
        'missingIdentityFacts',jsonb_build_array(
          'stance_leg','landing_leg','direction_relative_to_stance',
          'obstacle_dimensions','contact_count','side_accounting',
          'landing_zone','hold','exit','reset'),
        'researchBatch',research_batch,'researchVersion',research_version,
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,boundary.left_id,boundary.right_id,'distinct_exercises',
    boundary.rationale,
    jsonb_build_object(
      'identityBoundary',boundary.boundary_key,
      'differingDimensions',boundary.dimensions,
      'researchBatch',research_batch,'researchVersion',research_version,
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM(VALUES
    (bilateral_ground_id,bilateral_id,
      'ground_only_bilateral_jump_vs_bilateral_low_hurdle_clearance',
      'The tasks share bilateral lateral takeoff and landing plus a terminal hold, but only the hurdle definition requires a measured raised obstacle, minimum clearance, trip exposure, marked post-obstacle landing zone, equipment inspection, and lane reset.',
      jsonb_build_array('obstacle','minimum_clearance','trip_exposure','landing_location','equipment','lane_reset')),
    (single_ground_id,single_id,
      'ground_only_same_leg_hop_vs_same_leg_low_hurdle_clearance',
      'The tasks share same-leg lateral takeoff and landing plus a terminal hold, but only the hurdle definition requires a measured raised obstacle, minimum clearance, trip exposure, marked post-obstacle landing zone, equipment inspection, and lane reset.',
      jsonb_build_array('obstacle','minimum_clearance','trip_exposure','landing_location','equipment','lane_reset')),
    (bilateral_id,single_id,
      'bilateral_vs_same_leg_low_hurdle_support',
      'Both clear one low hurdle laterally to a terminal stick, but the bilateral task starts, leaves, and lands on two feet while the same-leg task starts, leaves, and lands on one named leg. Support, laterality, load distribution, side dose, readiness, and failure consequences differ.',
      jsonb_build_array('takeoff_support','landing_support','laterality','load_distribution','side_accounting','failure_consequence')),
    (bilateral_id,single_ground_id,
      'bilateral_low_hurdle_vs_ground_only_same_leg_hop',
      'The bilateral hurdle task differs from the ground-only same-leg hop in both obstacle contract and foot support. It cannot be consolidated or substituted without explicit workout revalidation.',
      jsonb_build_array('obstacle','takeoff_support','landing_support','laterality','equipment','trip_exposure')),
    (single_id,bilateral_ground_id,
      'same_leg_low_hurdle_vs_ground_only_bilateral_jump',
      'The same-leg hurdle task differs from the ground-only bilateral jump in both obstacle contract and foot support. It cannot be consolidated or substituted without explicit workout revalidation.',
      jsonb_build_array('obstacle','takeoff_support','landing_support','laterality','equipment','trip_exposure'))
  ) boundary(left_id,right_id,boundary_key,rationale,dimensions)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,left_definition.id,right_definition.id,boundary.decision,
    boundary.rationale,
    jsonb_build_object(
      'identityBoundary',boundary.boundary_key,
      'differingOrMissingDimensions',boundary.dimensions,
      'researchBatch',research_batch,'researchVersion',research_version,
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM(VALUES
    ('bilateral-lateral-low-hurdle-jump-to-stick','low-hurdle-hop-to-stick',
      'needs_human_review','exact_bilateral_lateral_hurdle_vs_undefined_hurdle_hop',
      'The completed card requires lateral projection, simultaneous two-foot takeoff and landing, one low-hurdle clearance, a marked two-foot landing zone, terminal hold, exit, and reset. The older Low Hurdle Hop to Stick does not declare projection direction, takeoff or landing foot count, contact count, landing zone, or reset and could be this task or a different vertical, forward, or unilateral hurdle task.',
      jsonb_build_array('projection_direction','takeoff_foot_count','landing_foot_count','contact_count','landing_zone','exit','reset')),
    ('single-leg-lateral-low-hurdle-hop-to-stick','low-hurdle-hop-to-stick',
      'needs_human_review','exact_same_leg_lateral_hurdle_vs_undefined_hurdle_hop',
      'The completed card requires a named stance leg, lateral direction relative to stance, same-leg landing, one low-hurdle clearance, side accounting, terminal hold, exit, and reset. The older Low Hurdle Hop to Stick does not declare direction, takeoff or landing leg, side contract, contact count, landing zone, or reset and cannot be consolidated without authoritative evidence.',
      jsonb_build_array('projection_direction','stance_leg','landing_leg','side_accounting','contact_count','landing_zone','exit','reset')),
    ('single-leg-lateral-low-hurdle-hop-to-stick','single-leg-hop-to-stick',
      'distinct_exercises','same_leg_lateral_low_hurdle_vs_ground_only_unspecified_single_leg_hop',
      'The completed card requires a measured low hurdle, lateral clearance, trip exposure, a post-obstacle landing zone, and hurdle-lane operations. The existing Single-Leg Hop to Stick has no required obstacle or hurdle equipment. Obstacle presence alone is an identity boundary even though the older ground task direction is underspecified.',
      jsonb_build_array('obstacle','minimum_clearance','trip_exposure','equipment','landing_location','lane_operations')),
    ('bilateral-lateral-low-hurdle-jump-to-stick','tuck-jump-to-lateral-stick',
      'distinct_exercises','bilateral_lateral_hurdle_clearance_vs_vertical_tuck_then_lateral_landing',
      'The hurdle task begins beside a raised obstacle and projects laterally across it to a two-foot landing. Tuck Jump to Lateral Stick requires a vertical tuck action before a lateral terminal landing. Ordered actions, obstacle, projection, hip action, flight goal, and failure conditions differ.',
      jsonb_build_array('ordered_actions','obstacle','projection','flight_action','landing_target','failure_conditions')),
    ('bilateral-lateral-low-hurdle-jump-to-stick','lateral-hurdle-hop-to-box-jump',
      'distinct_exercises','single_low_hurdle_to_floor_stick_vs_hurdle_box_compound',
      'The completed card clears one low hurdle and ends on the floor in a two-foot terminal stick. Lateral Hurdle Hop to Box Jump is a compound hurdle-to-box task whose terminal surface is a box followed by standing and step-down. Equipment, ordered actions, landing surface, exit, contact sequence, and failure consequences differ.',
      jsonb_build_array('equipment','ordered_actions','landing_surface','terminal_action','exit','contact_sequence')),
    ('bilateral-lateral-low-hurdle-jump-to-stick','two-foot-quarter-turn-jump-to-stick',
      'distinct_exercises','bilateral_lateral_hurdle_clearance_vs_bilateral_quarter_turn',
      'Both use bilateral takeoff and landing with a terminal hold, but the hurdle task projects laterally over a raised obstacle without a rotation contract while the quarter-turn task requires exactly 90 degrees of aerial reorientation with minimal displacement and no obstacle.',
      jsonb_build_array('obstacle','projection','rotation_degrees','orientation','displacement','equipment')),
    ('single-leg-lateral-low-hurdle-hop-to-stick','single-leg-quarter-turn-hop-to-stick',
      'distinct_exercises','same_leg_lateral_hurdle_clearance_vs_same_leg_quarter_turn',
      'Both start and land on the same named leg with a terminal hold, but the hurdle task requires lateral projection over a raised obstacle while the quarter-turn task requires exactly 90 degrees of aerial reorientation, minimal displacement, and no obstacle.',
      jsonb_build_array('obstacle','projection','rotation_degrees','orientation','displacement','equipment')),
    ('single-leg-lateral-low-hurdle-hop-to-stick','single-leg-triple-hop-to-stick',
      'distinct_exercises','single_same_leg_hurdle_clearance_vs_three_horizontal_hops',
      'The hurdle task contains one clearance and one same-leg landing before a terminal hold. Single-Leg Triple Hop to Stick requires three ordered unilateral horizontal hops and a final landing without a required raised obstacle. Contact count, repetition boundary, obstacle, fatigue accumulation, distance measure, and failure conditions differ.',
      jsonb_build_array('contact_count','repetition_boundary','obstacle','fatigue_accumulation','measurement','failure_conditions'))
  ) boundary(left_slug,right_slug,decision,boundary_key,rationale,dimensions)
  JOIN coaching.exercise_definition_v1 left_definition
    ON left_definition.facility_id=1
      AND left_definition.slug=boundary.left_slug
      AND left_definition.status<>'archived'
  JOIN coaching.exercise_definition_v1 right_definition
    ON right_definition.facility_id=1
      AND right_definition.slug=boundary.right_slug
      AND right_definition.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  UPDATE coaching.exercise exercise
  SET name='Low-Hurdle Lateral Hop to Stick — Archived Ambiguous Source',
    description='Archived nonprescribable source: lateral low-hurdle clearance and a terminal stick are named, but takeoff foot count, landing foot count or leg, obstacle dimensions, contact count, direction relative to stance, landing zone, hold, exit, and reset are not defined.',
    card_summary='Archived lineage record with unresolved foot-support and landing contract; select an exact bilateral or same-leg low-hurdle card instead.',
    coach_language='Do not prescribe this source. Choose the exact bilateral or same-leg low-hurdle card and revalidate hurdle setup, dose, duration, logistics, impact budget, rendering, and persistence.',
    athlete_language='This old card is not specific enough to perform safely. Ask your coach for the exact two-foot or same-leg version.',
    archived=TRUE,is_published=FALSE,skill_level=NULL,
    programming_logic=jsonb_build_object(
        'canonicalRetirementMigration',migration_key,
        'retirementReason','foot_count_landing_leg_and_contact_contract_ambiguous',
        'exactReplacementOptions',jsonb_build_array(
          'bilateral-lateral-low-hurdle-jump-to-stick',
          'single-leg-lateral-low-hurdle-hop-to-stick'),
        'directReplacement',NULL,
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'athleteProficiencyExcluded',TRUE,
        'humanReviewRequired',TRUE,'approvalCreated',FALSE),
    why_publish_ready=FALSE,
    updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=1500;

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level=NULL
  WHERE safety.exercise_id=1500;

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
        'message','Takeoff foot count, landing foot count or leg, obstacle dimensions, contact count, direction relative to stance, landing zone, hold, exit, and reset are unresolved.'),
      jsonb_build_object('code','CARD-DIFFICULTY-01',
        'message','Exercise complexity and physical difficulty cannot be scored for an undefined movement contract.'),
      jsonb_build_object('code','CARD-DELIVERY-01',
        'message','No selectable dose, duration, logistics, impact budget, substitution, or rendering profile is permitted.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Adjacent bilateral and single-leg media cannot establish the missing source identity.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Archived source is intentionally nonprescribable.'))
    ELSE jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A qualified human must approve healthy exact-match demonstrations, cue quality, safety, captions, and accessibility for this exact variant.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must review all progression, regression, and substitution proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Independent calibration and reviewer approval are required for exercise complexity and physical difficulty.'),
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
       AND definition.provenance_json->>'lateralLowHurdleIdentityMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
       WHERE id=source_id AND status='archived' AND card_version=2)
    OR(SELECT count(*) FROM coaching.exercise_definition_v1
       WHERE id IN(bilateral_id,single_id)
         AND status='review' AND card_version=1)<>2 THEN
    RAISE EXCEPTION '% found invalid final definition state',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=evidence.definition_id
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.reviewed_card_version=
         CASE WHEN definition.id=source_id THEN 2 ELSE 1 END
       AND evidence.review_status='candidate'
       AND evidence.claims_json @> jsonb_build_array(
         jsonb_build_object('researchBatch',research_batch)))<>48
    OR EXISTS(SELECT 1 FROM unnest(all_ids) ids(definition_id)
       WHERE(SELECT count(DISTINCT evidence.section_key)
         FROM coaching.exercise_section_evidence_v1 evidence
         JOIN coaching.exercise_definition_v1 definition
           ON definition.id=evidence.definition_id
         WHERE evidence.definition_id=ids.definition_id
           AND evidence.reviewed_card_version=
             CASE WHEN definition.id=source_id THEN 2 ELSE 1 END
           AND evidence.review_status='candidate'
           AND evidence.claims_json @> jsonb_build_array(
             jsonb_build_object('researchBatch',research_batch)))<>16) THEN
    RAISE EXCEPTION '% expected 16 current evidence sections per card',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=media.definition_id
     WHERE media.definition_id=ANY(all_ids)
       AND media.reviewed_card_version=
         CASE WHEN definition.id=source_id THEN 2 ELSE 1 END
       AND media.video_id=ANY(ARRAY[
         'lymbF-brPvQ','ear4XAser10','362qbIZF1jE','0I0oWEnrEVc','Bw5ytVM3U_8',
         'iPNiem2uJA8','7aMbZAmd2qY','pIb9NJyRKMk','a9clGYbxAjw','e1AQ_ZT4B10'])
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.captions_available IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>13 THEN
    RAISE EXCEPTION '% expected 13 healthy candidate-only media rows',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
     WHERE alternate.definition_id=bilateral_id
       AND alternate.reviewed_card_version=1
       AND alternate.review_status='candidate')<9
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=single_id
         AND alternate.reviewed_card_version=1
         AND alternate.review_status='candidate')<9
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=source_id
         AND alternate.reviewed_card_version=2
         AND alternate.review_status='candidate')<7 THEN
    RAISE EXCEPTION '% found incomplete alternate assessments',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.id IN(bilateral_variant_id,single_variant_id)
       AND variant.status='review'
       AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
         =greatest(
           (variant.difficulty_json->>'technicalComplexity')::INTEGER,
           (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=source_id AND variant.status<>'archived')
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.id IN(bilateral_variant_id,single_variant_id)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id IN(bilateral_variant_id,single_variant_id)
       AND profile.status='review'
       AND profile.equipment_required=ARRAY['low_hurdle']::TEXT[])<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id IN(bilateral_variant_id,single_variant_id)
         AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review' AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
       WHERE(relationship.from_variant_id,relationship.to_variant_id,
         relationship.relationship) IN(
           (bilateral_ground_variant_id,bilateral_variant_id,'progression'),
           (bilateral_variant_id,bilateral_ground_variant_id,'regression'),
           (single_ground_variant_id,single_variant_id,'progression'),
           (single_variant_id,single_ground_variant_id,'regression'),
           (bilateral_variant_id,single_variant_id,'progression'),
           (single_variant_id,bilateral_variant_id,'regression'))
         AND relationship.review_status='review'
         AND relationship.reviewed_by IS NULL
         AND relationship.reviewed_at IS NULL)<>6 THEN
    RAISE EXCEPTION '% expected complete profiles, calibration, and graph proposals',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.survivor_definition_id=source_id
       AND resolution.resolved_definition_id IN(bilateral_id,single_id)
       AND resolution.decision='needs_human_review'
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'migration'=migration_key)<>2
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE(resolution.survivor_definition_id,resolution.resolved_definition_id) IN(
         (bilateral_ground_id,bilateral_id),(single_ground_id,single_id),
         (bilateral_id,single_id),(bilateral_id,single_ground_id),
         (single_id,bilateral_ground_id))
         AND resolution.decision='distinct_exercises'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key)<>5
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=source_id
         AND resolved_definition_id=single_ground_id
         AND decision='distinct_exercises' AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
       WHERE survivor_definition_id=bilateral_ground_id
         AND resolved_definition_id=source_id
         AND decision='distinct_exercises' AND reviewed_by IS NULL)
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.evidence_json->>'identityBoundary'=ANY(ARRAY[
         'exact_bilateral_lateral_hurdle_vs_undefined_hurdle_hop',
         'exact_same_leg_lateral_hurdle_vs_undefined_hurdle_hop',
         'same_leg_lateral_low_hurdle_vs_ground_only_unspecified_single_leg_hop',
         'bilateral_lateral_hurdle_clearance_vs_vertical_tuck_then_lateral_landing',
         'single_low_hurdle_to_floor_stick_vs_hurdle_box_compound',
         'bilateral_lateral_hurdle_clearance_vs_bilateral_quarter_turn',
         'same_leg_lateral_hurdle_clearance_vs_same_leg_quarter_turn',
         'single_same_leg_hurdle_clearance_vs_three_horizontal_hops'])
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key)<>8
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.evidence_json->>'identityBoundary'=ANY(ARRAY[
         'exact_bilateral_lateral_hurdle_vs_undefined_hurdle_hop',
         'exact_same_leg_lateral_hurdle_vs_undefined_hurdle_hop'])
         AND resolution.decision='needs_human_review'
         AND resolution.reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% failed to preserve source uncertainty and exact boundaries',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise exercise
       WHERE exercise.facility_id=1 AND exercise.id=1500
         AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
         AND exercise.skill_level IS NULL
         AND exercise.why_publish_ready IS FALSE)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id=1500
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE
       AND packet.checks_json->>'exerciseSkillLevelAbsent'='true')<>3
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
           OR media.exact_variant_match IS NOT NULL
           OR media.demonstration_quality_score IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
