-- Resolve the false One-Arm Landmine Arc identity and author the separately
-- observed two-hand shoulder-to-shoulder landmine arc without rewriting history.
--
-- Legacy 1413 describes the ordinary one-arm fixed diagonal press; legacy 1414
-- differs only by eccentric tempo. Both map to Landmine Press. The misleading
-- mixed-lineage definition is archived. The new exact movement contract remains
-- review-only: automated oEmbed and visual research never grant human approval.
-- Exercise difficulty is complexity plus physical difficulty; overall is their
-- maximum. Athlete proficiency belongs only to coaching.skill.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '424_coaching_landmine_arc_identity_resolution';
  standard_slug CONSTANT TEXT := 'landmine-press';
  legacy_slug CONSTANT TEXT := 'one-arm-landmine-arc-press';
  exact_slug CONSTANT TEXT :=
    'two-hand-landmine-shoulder-to-shoulder-arc-press';
  exact_definition_id CONSTANT UUID :=
    'c71bd2f3-0821-4623-a785-1a7cc0d55f9a'::UUID;
  tall_variant_id CONSTANT UUID :=
    'a49dd79b-8b1c-4986-aa22-f37728089eaa'::UUID;
  half_variant_id CONSTANT UUID :=
    '6b604f75-148d-406f-a9ad-5a7fde9b5aaf'::UUID;
  standard_definition_id UUID;
  legacy_definition_id UUID;
  already_applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=exact_slug
    AND definition.id=exact_definition_id
    AND definition.provenance_json->>'identityResolutionMigration'=migration_key;

  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;

  SELECT id INTO standard_definition_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=standard_slug
    AND definition.status<>'archived';
  IF standard_definition_id IS NULL THEN
    RAISE EXCEPTION '% requires one active % definition',migration_key,standard_slug;
  END IF;

  SELECT id INTO legacy_definition_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=legacy_slug;
  IF legacy_definition_id IS NULL THEN
    RAISE EXCEPTION '% requires the traceable legacy definition',migration_key;
  END IF;

  IF already_applied_count=0 THEN
    SELECT count(*) INTO actual_count
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.id=legacy_definition_id AND definition.status='review'
      AND definition.card_version=2 AND definition.legacy_exercise_id=1413;
    IF actual_count<>1 THEN
      RAISE EXCEPTION '% expected active legacy review card version 2',migration_key;
    END IF;

    SELECT count(*) INTO actual_count
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id=legacy_definition_id
      AND source.legacy_exercise_id IN(1413,1414);
    IF actual_count<>2 OR EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=legacy_definition_id
        AND source.legacy_exercise_id NOT IN(1413,1414)
    ) THEN
      RAISE EXCEPTION '% requires exactly legacy sources 1413 and 1414',
        migration_key;
    END IF;
  ELSE
    IF EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=legacy_definition_id AND(
        definition.status<>'archived' OR definition.card_version<>3)
    ) THEN
      RAISE EXCEPTION '% found archived legacy-card drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=exact_slug
      AND definition.id<>exact_definition_id
  ) THEN
    RAISE EXCEPTION '% found unexpected identity for %',migration_key,exact_slug;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.survivor_definition_id=standard_definition_id
      AND resolution.resolved_definition_id=legacy_definition_id
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id=resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id=resolution.resolved_definition_id
    WHERE resolution.resolution_source='human_review'
      AND(exact_slug IN(left_definition.slug,right_definition.slug))
      AND(left_definition.slug IN(
        standard_slug,'one-arm-landmine-push-press',
        'half-kneeling-one-arm-landmine-press','one-arm-landmine-z-press',
        'tall-kneeling-one-arm-landmine-press','landmine-squat-to-press',
        'one-arm-landmine-floor-press')
        OR right_definition.slug IN(
        standard_slug,'one-arm-landmine-push-press',
        'half-kneeling-one-arm-landmine-press','one-arm-landmine-z-press',
        'tall-kneeling-one-arm-landmine-press','landmine-squat-to-press',
        'one-arm-landmine-floor-press'))
  ) THEN
    RAISE EXCEPTION '% refused to override a human exact-card boundary',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(standard_definition_id,legacy_definition_id,
        exact_definition_id) AND(
        definition.status IN('published','deprecated')
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id IN(legacy_definition_id,exact_definition_id)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id IN(legacy_definition_id,exact_definition_id)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id IN(legacy_definition_id,exact_definition_id)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id IN(legacy_definition_id,exact_definition_id))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id IN(legacy_definition_id,exact_definition_id))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id IN(legacy_definition_id,exact_definition_id))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id IN(legacy_definition_id,exact_definition_id)
        AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id IN(legacy_definition_id,exact_definition_id)
        AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id IN(legacy_definition_id,exact_definition_id)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id IN(legacy_definition_id,exact_definition_id)
        AND(calibration.status<>'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF already_applied_count=0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status='archived',updated_at=now()
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.id=profile.variant_id
      AND variant.definition_id=legacy_definition_id;

    UPDATE coaching.exercise_variant_v1 variant
    SET status='archived',
        requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
          ||jsonb_build_object(
            'selectable',FALSE,
            'identityQuarantine',TRUE,
            'supersededByMigration',migration_key,
            'quarantineReason',
              'Legacy 1413 is a standard one-arm fixed-diagonal press and legacy 1414 changes only eccentric tempo; neither defines the professional two-hand shoulder-to-shoulder Arc Press.'),
        updated_at=now()
    WHERE variant.definition_id=legacy_definition_id;

    UPDATE coaching.exercise_section_evidence_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
        updated_at=now()
    WHERE definition_id=legacy_definition_id AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
        updated_at=now()
    WHERE definition_id=legacy_definition_id AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
        updated_at=now()
    WHERE definition_id=legacy_definition_id AND review_status='candidate';

    UPDATE coaching.exercise_definition_v1 definition
    SET canonical_name='One-Arm Landmine Arc Press — Archived Source Label',
        display_name='One-Arm Landmine Arc Press — Archived Source Label',
        description='Archived source-label record. Legacy 1413 describes a standard one-arm fixed-diagonal landmine press and legacy 1414 adds eccentric tempo only. Both source rows are preserved under Landmine Press. The separately authored two-hand shoulder-to-shoulder Arc Press has its own definition and review gates.',
        family_key='archived_false_landmine_arc_identity',
        card_version=3,status='archived',
        approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
        last_reviewed_at=NULL,
        provenance_json=definition.provenance_json||jsonb_build_object(
          'identityResolutionMigration',migration_key,
          'identityState','archived_false_composite',
          'resolvedToSlug',standard_slug,
          'exactReplacementSlug',exact_slug,
          'source1413Decision','standard_one_arm_fixed_diagonal_press',
          'source1414Decision','eccentric_tempo_modifier_not_new_identity',
          'humanReviewRequired',TRUE,
          'publicationQuarantined',TRUE),
        updated_at=now()
    WHERE definition.id=legacy_definition_id;

    UPDATE coaching.exercise_definition_source_v1 source
    SET definition_id=standard_definition_id,
        source_kind='duplicate_consolidation',
        provenance_json=source.provenance_json||jsonb_build_object(
          'resolvedFromDefinitionId',legacy_definition_id,
          'migration',migration_key,
          'resolution',CASE source.legacy_exercise_id
            WHEN 1413 THEN 'standard_one_arm_fixed_diagonal_press'
            ELSE 'standard_press_with_eccentric_tempo_modifier' END,
          'variantDimensions',CASE source.legacy_exercise_id
            WHEN 1413 THEN jsonb_build_array(
              'hand_count','base','side','rack','range','load','repetitions','rest')
            ELSE jsonb_build_array(
              'eccentric_duration','concentric_assistance','tempo','load',
              'range','repetitions','rest') END,
          'researchSources',jsonb_build_array(
            'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
            'https://platform.instituteofmotion.com/library/activity/r59tleo2/share/'))
    WHERE source.definition_id=legacy_definition_id
      AND source.legacy_exercise_id IN(1413,1414);
  END IF;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    exact_definition_id,1,NULL,exact_slug,
    'Two-Hand Landmine Shoulder-to-Shoulder Arc Press',
    'Two-Hand Landmine Shoulder-to-Shoulder Arc Press',
    ARRAY['Landmine Arc Press','Two-Hand Landmine Arc Press',
      'Kneeling Landmine Arc Press','Shoulder-to-Shoulder Landmine Arc']::TEXT[],
    'From a declared tall- or half-kneeling base, control the free end of a barbell secured in a rated landmine with two hands at one shoulder. Guide it up and across in a clear arc, keep the trunk organized, finish under control at the opposite shoulder, count one crossing as one repetition, then continue or reset as prescribed.',
    'two_hand_landmine_shoulder_to_shoulder_arc','1.0.0',1,'review',
    82,70,58,
    ARRAY['push','brace']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','rib_cage',
      'core','spine','pelvis','hip','knee']::TEXT[],
    ARRAY['landmine','barbell','mat']::TEXT[],
    ARRAY['plates']::TEXT[],
    jsonb_build_object(
      'surface','level_dry_non_slip_floor_with_kneeling_pad',
      'equipment','rated_fixed_pivot_compatible_barbell_collars_and_approved_two_hand_interface',
      'space','full_bar_and_plate_arc_clear_with_exclusion_zone',
      'traffic','one_active_athlete_per_landmine',
      'setup','base_lead_leg_starting_shoulder_load_range_tempo_crossings_pickup_and_set_down_declared'),
    jsonb_build_object(
      'selectionStatus','candidate_requires_human_review',
      'readinessChecks',jsonb_build_array(
        'pain_free_selected_kneeling_base',
        'controlled_unloaded_or_light_arc_both_directions',
        'understands_counting_and_stop_signal'),
      'useCaution',jsonb_build_array(
        'current_hand_wrist_elbow_shoulder_spine_hip_or_knee_symptoms',
        'kneeling_intolerance','meaningful_side_or_direction_difference',
        'fatigue_from_pressing_throwing_grip_or_trunk_work'),
      'contraindications',jsonb_build_array(
        'pain_guarding_numbness_dizziness_or_unusual_breathlessness',
        'unsafe_anchor_bar_collar_attachment_floor_or_clearance',
        'cannot_control_bar_end_or_kneeling_base'),
      'medicalScope','This candidate card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance.'),
    jsonb_build_object(
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://platform.instituteofmotion.com/library/activity/r59tleo2/share/',
      'identityResolutionMigration',migration_key,
      'researchBatch','two-hand-landmine-shoulder-to-shoulder-arc-press-v1',
      'researchVersion','2026-08-01.3',
      'identityState','exact_candidate_contract',
      'evidenceState','candidate_requires_human_review',
      'mediaState','five_oembed_healthy_embeddable_candidates_require_full_human_review',
      'automatedVisualObservation','two_hands_shoulderto_shoulder_arc_with_tall_and_half_kneeling_bases',
      'automatedObservationIsApproval',FALSE,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'anterior_deltoid','clavicular_pectoralis_major','triceps_brachii',
        'serratus_anterior','trapezius','abdominal_wall'),
      'secondaryMuscles',jsonb_build_array(
        'rotator_cuff','latissimus_dorsi','forearm_and_hand_flexors',
        'spinal_stabilizers','gluteals'),
      'joints',jsonb_build_array(
        'hand','wrist','elbow','glenohumeral','scapulothoracic',
        'thoracic_spine','lumbar_spine','pelvis','hip','knee'),
      'jointActions',jsonb_build_array(
        'bilateral_shoulder_flexion_and_horizontal_transfer',
        'scapular_upward_rotation_and_protraction',
        'elbow_extension_then_controlled_flexion',
        'trunk_anti_rotation_and_anti_lateral_flexion'),
      'planes',jsonb_build_array('multiplanar'),
      'laterality','bilateral',
      'directionalConvention','starting_shoulder_declared_and_balanced_crossings',
      'evidenceLimit','Exact muscle contribution, safe range, interface, path, and scores require qualified human review.'),
    jsonb_build_object(
      'whyItMatters','Builds controlled multiplanar shoulder, grip, and trunk capacity through a two-hand shoulder-to-shoulder path.',
      'primaryCue','Two hands own the bar; arc up and across; finish softly at the other shoulder.',
      'expectedSensations',jsonb_build_array(
        'shoulder_and_back_of_arm_effort','upper_back_and_scapular_control',
        'abdominal_and_glute_tension','forearm_and_grip_effort',
        'comfortable_kneeling_pressure_on_the_pad'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_hand_wrist_elbow_shoulder_back_hip_or_knee_pain',
        'pinching_numbness_tingling_dizziness_or_unusual_breathlessness',
        'bar_or_attachment_shift','head_or_face_contact_risk'),
      'painGuidance','Stop immediately for sharp, increasing, radiating, joint, neurologic, dizzy, or unusual breathing symptoms; control or safely set down the bar and tell the coach.',
      'beforeYouStart',jsonb_build_array(
        'confirm_anchor_bar_collars_interface_floor_pad_and_clearance',
        'declare_base_lead_leg_starting_shoulder_load_range_tempo_crossings_rest_pickup_and_set_down',
        'rehearse_one_unloaded_or_light_crossing_each_direction',
        'identify_stop_signal'),
      'selfChecks',jsonb_build_array(
        'two_hands_stay_on_approved_interface','head_stays_clear',
        'both_shoulder_racks_match','ribs_stay_over_pelvis',
        'base_stays_fixed','bar_is_decelerated_not_dropped'),
      'repCounting','One shoulder-to-opposite-shoulder crossing equals one repetition; a round trip equals two repetitions.',
      'accessibility',jsonb_build_array(
        'unloaded_bar','shorter_owned_arc','fewer_crossings','longer_rest',
        'reviewed_base','written_audio_still_image_tactile_or_live_walkthrough'),
      'mediaAlternatives',jsonb_build_object(
        'captionsRequired',TRUE,'transcriptRequired',TRUE,
        'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,
        'requiredAngles',jsonb_build_array('front','front_oblique','side'),
        'availability','five_embeddable_candidates_pending_human_exact_match_and_accessibility_review'),
      'recordAfterSet',jsonb_build_array(
        'variant_key','base','lead_leg','starting_shoulder','load','range',
        'tempo','quality_crossings','rest','symptoms','stop_reason')),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'anchor_bar_collars_interface_pad_floor_and_clearance',
        'base_lead_leg_and_starting_shoulder','grip_wrist_elbow_scapula',
        'head_clearance_arc_and_both_racks','ribs_pelvis_rotation_and_side_bend',
        'crossing_count_fatigue_set_down_and_exit'),
      'faultCorrections',jsonb_build_object(
        'path_or_rack_changes',jsonb_build_array('reduce_load_or_range','reset_start_rack'),
        'trunk_rotates_or_side_bends',jsonb_build_array('end_set','reduce_load','review_base'),
        'grip_or_wrist_changes',jsonb_build_array('end_set','inspect_interface'),
        'bar_end_drops',jsonb_build_array('stop','unload','rehearse_controlled_return')),
      'demonstrationPlan',jsonb_build_object(
        'angles',jsonb_build_array('front','front_oblique','side'),
        'showCorrectReps',2,
        'showCommonFaults',jsonb_build_array(
          'straight_across_head_path','rib_flare_or_rotation','bar_end_drop'),
        'comprehensionCheck','Ask the athlete to show one crossing, name the rep count, point to both shoulder racks, and repeat the stop rule.'),
      'groupManagement',jsonb_build_array(
        'one_active_athlete_per_landmine','mark_pivot_bar_and_plate_exclusion_zone',
        'standardize_one_way_crossing_count','change_load_only_when_bar_is_still'),
      'modificationDecisionTree',jsonb_build_array(
        jsonb_build_object('when','pain_neurologic_dizziness_or_unusual_breathlessness','action','stop_control_bar_and_escalate'),
        jsonb_build_object('when','equipment_moves_or_clearance_is_unsafe','action','stop_station_and_route_to_equipment_review'),
        jsonb_build_object('when','path_rack_grip_base_or_trunk_fails','action','reduce_load_range_or_crossings_then_rehearse'),
        jsonb_build_object('when','all_crossings_are_symmetric_with_reserve','action','progress_one_variable_within_reviewed_profile'),
        jsonb_build_object('when','identity_or_media_is_uncertain','action','exclude_card_and_route_to_content_review')),
      'doNotUseWhen',jsonb_build_array(
        'anchor_bar_collar_plate_interface_floor_pad_or_clearance_is_unsafe',
        'selected_kneeling_base_or_unloaded_arc_is_not_pain_free',
        'athlete_cannot_control_both_shoulder_racks_or_follow_stop_command',
        'pressing_throwing_grip_or_trunk_fatigue_would_compromise_a_priority_task'),
      'recordingFields',jsonb_build_array(
        'variant_key','base','lead_leg','starting_shoulder','bar_type',
        'plate_mass','interface','range','tempo','quality_crossings','rest',
        'symptoms','stop_reason')),
    jsonb_build_object(
      'supportSummary','Count only one-way crossings that preserve the exact equipment, two-hand interface, base, path, both racks, trunk policy, controlled return, and safe set-down.',
      'issueCategories',jsonb_build_array(
        'identity_or_variant','difficulty_or_dose','equipment_or_environment',
        'symptom_or_population_constraint','instruction_or_accessibility',
        'media_exact_match','relationship','calibration'),
      'supportEscalation',jsonb_build_object(
        'urgent',jsonb_build_array(
          'dropped_bar_or_plate','acute_injury',
          'neurologic_or_cardiovascular_symptom'),
        'coachReview',jsonb_build_array(
          'repeated_path_rack_grip_base_or_trunk_fault',
          'meaningful_direction_difference','unclear_count_load_range_or_set_down'),
        'equipmentReview',jsonb_build_array(
          'anchor_bar_collar_plate_or_interface_movement_or_damage'),
        'contentReview',jsonb_build_array(
          'identity_boundary_conflict','media_mismatch',
          'missing_accessibility_or_stop_rule')),
      'retentionPolicy',jsonb_build_object(
        'athleteFeedbackDays',365,
        'incidentEvidence','facility_policy',
        'rawFreeTextContainsHealthData',TRUE,
        'cardAndMediaReviewHistory','retain_by_library_governance_policy'),
      'feedbackPrompts',jsonb_build_array(
        'pain_or_unexpected_sensation','difficulty','confidence','clarity',
        'equipment_problem','path_or_direction_asymmetry','media_problem'),
      'knownLimitations',jsonb_build_array(
        'no_peer_reviewed_study_of_exact_arc','no_human_media_approval',
        'no_universal_load_dose_or_recovery',
        'scores_edges_calibrations_and_card_are_unapproved_proposals'),
      'changeImpactPolicy','Changes to hand count, base, rack, path, rotation, endpoint, terminal control, difficulty, dose, stop rule, relationship, or media require a new card version and renewed review.'))
  ON CONFLICT(facility_id,slug)
  DO UPDATE SET canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,
    population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,
    updated_at=now()
  WHERE coaching.exercise_definition_v1.id=exact_definition_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,standard_definition_id,legacy_definition_id,'duplicate_consolidated',
    'Legacy 1413 uses the same one-arm fixed angled bar path, one-arm finish, trunk bracing, and controlled return as the standard strict Landmine Press and specifies no shoulder-to-shoulder action. Legacy 1414 differs only by eccentric tempo. The professional Arc Press label is preserved on a separate two-hand shoulder-to-shoulder definition.',
    jsonb_build_object(
      'migration',migration_key,
      'legacyExerciseIds',jsonb_build_array(1413,1414),
      'identityBoundary','standard_one_arm_fixed_diagonal_press_and_eccentric_tempo_modifier_vs_two_hand_shoulder_to_shoulder_arc',
      'researchSources',jsonb_build_array(
        'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
        'https://platform.instituteofmotion.com/library/activity/r59tleo2/share/',
        'https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern'),
      'legacySourceCardsAudited',TRUE,
      'missingIdentityFacts',FALSE,
      'humanReviewRequired',FALSE,
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only'),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  WITH boundary_seed(slug,identity_boundary,rationale) AS(VALUES
    (standard_slug,
      'same_shoulder_fixed_diagonal_press_and_return_vs_two_hand_opposite_shoulder_arc',
      'Landmine Press moves from one shoulder or a central rack up and forward through the fixed diagonal pivot path, then returns to the same rack. The exact Arc Press uses two hands, crosses above the head, and terminates at the opposite shoulder; hand count, path, endpoint, directional count, trunk demand, and repetition contract differ.'),
    ('one-arm-landmine-push-press',
      'one_arm_leg_drive_ballistic_press_vs_two_hand_strict_cross_body_arc',
      'Landmine Push Press deliberately uses lower-body impulse for a one-arm ballistic press. The exact Arc Press uses two hands and a controlled shoulder-to-shoulder path without deliberate leg drive or trunk rotation; force strategy, hand count, endpoint, velocity, fatigue, and failure management differ.'),
    ('half-kneeling-one-arm-landmine-press',
      'one_arm_same_rack_diagonal_press_vs_two_hand_opposite_rack_arc',
      'Half-Kneeling One-Arm Landmine Press fixes one working arm and returns along a diagonal path to the same shoulder. The exact half-kneeling Arc variant uses two hands and transfers between opposite shoulder racks; hand count, path, endpoint, laterality, count, and trunk-control demands differ.'),
    ('one-arm-landmine-z-press',
      'long_sit_one_arm_same_rack_press_vs_kneeling_two_hand_opposite_rack_arc',
      'One-Arm Landmine Z-Press uses an upright long-sit base, one hand, a same-shoulder rack, and a fixed diagonal press and return. The exact Arc Press is kneeling, two-hand, and shoulder-to-shoulder; base, hand count, path, endpoint, mobility, setup, and failure strategy differ.'),
    ('tall-kneeling-one-arm-landmine-press',
      'tall_kneeling_one_arm_same_rack_press_vs_tall_kneeling_two_hand_opposite_rack_arc',
      'Tall-Kneeling One-Arm Landmine Press shares the base but uses one working arm and returns to the same shoulder. The exact tall-kneeling Arc variant uses two hands and finishes each crossing at the opposite shoulder; hand count, path, endpoint, laterality, count, and trunk demands differ.'),
    ('landmine-squat-to-press',
      'squat_then_press_lower_body_drive_vs_kneeling_strict_shoulder_to_shoulder_arc',
      'Landmine Squat-to-Press begins with a squat and uses lower-body extension to drive a press. The exact Arc Press remains in a kneeling base and transfers the bar between shoulders without a squat or deliberate leg drive; action order, base, force strategy, hand path, dose, and fatigue differ.'),
    ('one-arm-landmine-floor-press',
      'supine_one_arm_floor_limited_press_vs_kneeling_two_hand_shoulder_to_shoulder_arc',
      'One-Arm Landmine Floor Press is supine and floor-limited with one working arm and a same-side press. The exact Arc Press is upright kneeling with two hands and an opposite-shoulder terminal rack; orientation, support, hand count, range, path, setup, and safe failure differ.')
  )
  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,other.id,exact_definition_id,'distinct_exercises',
    boundary.rationale,
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary',boundary.identity_boundary,
      'researchSources',jsonb_build_array(
        'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
        'https://platform.instituteofmotion.com/library/activity/r59tleo2/share/',
        'https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern'),
      'legacySourceCardsAudited',TRUE,'missingIdentityFacts',FALSE,
      'humanReviewRequired',FALSE,
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only'),
    'deterministic_identity_equivalence',NULL,now()
  FROM boundary_seed boundary
  JOIN coaching.exercise_definition_v1 other
    ON other.facility_id=1 AND other.slug=boundary.slug
      AND other.status<>'archived'
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES
  (tall_variant_id,exact_definition_id,
    'tall-kneeling-two-hand-shoulder-to-shoulder',
    'Tall-Kneeling Two-Hand Landmine Shoulder-to-Shoulder Arc Press',
    ARRAY['tall_kneeling','bilateral','2_hand','shoulder_to_shoulder_arc',
      'strict_no_deliberate_rotation','controlled_opposite_rack']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',52,'absoluteLoadDemand',48,
      'baseOverallDifficulty',52,'coordinationDemand',54,
      'supervisionDemand',48,'failureConsequence',48,'impact',1,
      'workCapacityDemand',50,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty')),
    jsonb_build_object(
      'selectable',TRUE,'base','tall_kneeling','handCount',2,
      'laterality','bilateral_hands_directional_crossing',
      'startingShoulder','declared_and_alternated_between_sets',
      'attachment','approved_secure_two_hand_free_end_interface',
      'grip','two_hand_neutral_or_cupped_as_interface_requires',
      'anchor','rated_fixed_landmine_pivot',
      'path','one_shoulder_rack_up_and_across_to_opposite_shoulder_rack',
      'intent','strict_controlled_no_deliberate_leg_drive_or_trunk_rotation',
      'range','declared_owned_arc_with_head_clearance',
      'tempo','controlled_both_directions',
      'repUnit','one_way_shoulder_to_shoulder_crossing',
      'terminalAction','controlled_opposite_shoulder_rack',
      'pickupAndSetDownMustBeDeclared',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','fixed_external',
      'externalLoadDescription','barbell and declared plate mass rotating around a rated fixed pivot through an approved two-hand interface',
      'effectiveLoadDrivers',jsonb_build_array(
        'bar_mass','plate_mass','plate_position','bar_angle',
        'athlete_distance_from_pivot','base','interface','range','tempo','crossings'),
      'loadTracking',jsonb_build_array(
        'bar_type','plate_mass','interface','base','starting_shoulder',
        'range','tempo','crossings'),
      'gripDemand',50,'spinalLoading',36,'eccentricStress',42,
      'impactClass','none','landingContactsPerRep',0),
    jsonb_build_object(
      'localMuscleFatigue',50,'gripFatigue',50,
      'technicalFatigueSensitivity',56,'impactAccumulation',1,
      'recoveryHours',36,
      'primaryFatigueSites',jsonb_build_array(
        'shoulders','triceps','scapular_stabilizers','grip_and_forearms',
        'trunk_stabilizers','kneeling_contacts'),
      'earlyFatigueSignals',jsonb_build_array(
        'rib_flare_or_back_extension','rotation_or_side_bend',
        'uneven_or_collapsing_arc','grip_or_wrist_change',
        'bar_end_drop','range_or_count_drift'),
      'downstreamConflicts',jsonb_build_array(
        'heavy_pressing','high_velocity_throwing_or_hitting',
        'grip_intensive_training','high_trunk_stability_load')),
    jsonb_build_object(
      'primaryIntent','controlled_multiplanar_press_and_trunk_strength',
      'bestUse','quality_shoulder_to_shoulder_arc_control_or_moderate_strength',
      'appropriatePhases',jsonb_build_array('movement_intelligence','capacity'),
      'trainingStimuli',jsonb_build_array(
        'multiplanar_shoulder_strength','scapular_control','trunk_anti_rotation',
        'grip_control','kneeling_base_control'),
      'stimulusDose',jsonb_build_object(
        'minimumEffectiveCrossings',8,'typicalCrossings',18,
        'maximumUsefulCrossings',40,
        'qualityLimited',TRUE),
      'weeklyExposure',jsonb_build_object(
        'minimum',1,'typical',2,'maximum',3,'minimumRecoveryHours',24),
      'prerequisites',jsonb_build_array(
        'safe_landmine_station','pain_free_selected_kneeling_base',
        'controlled_unloaded_arc_both_directions','understands_one_way_rep_count'),
      'completionCriteria',jsonb_build_array(
        'all_planned_crossings_reach_both_declared_racks',
        'two_hands_grip_base_and_trunk_policy_remain_unchanged',
        'at_least_two_clean_crossings_remain_in_reserve',
        'controlled_set_down_without_symptoms'),
      'sequenceRules',jsonb_build_object(
        'preferredAfter',jsonb_build_array(
          'general_warm_up','shoulder_and_trunk_access','light_path_rehearsal'),
        'preferredBefore',jsonb_build_array(
          'high_fatigue_pressing','throwing_or_hitting_volume','conditioning'),
        'avoidAfter',jsonb_build_array(
          'heavy_pressing','grip_fatigue','high_trunk_stability_load')),
      'pairingCompatibility',jsonb_build_object(
        'recommended',jsonb_build_array(
          'lower_body_strength_with_separate_equipment','low_demand_mobility'),
        'acceptable',jsonb_build_array('horizontal_pull_with_managed_grip'),
        'incompatible',jsonb_build_array(
          'max_effort_pressing','high_velocity_throwing','grip_to_failure')),
      'interferenceRules',jsonb_build_array(
        jsonb_build_object('stimulus','priority_throwing_hitting_or_hand_support_skill','action','place_arc_after_priority_or_use_low_patterning_dose'),
        jsonb_build_object('stimulus','heavy_pressing_or_grip_work','action','reduce_volume_load_or_omit'),
        jsonb_build_object('stimulus','kneeling_intolerance','action','use_only_a_separately_reviewed_alternate')),
      'uncertaintyPolicy','Exclude when identity, equipment interface, clearance, kneeling tolerance, current shoulder or grip readiness, dose, or exact media support is unknown.',
      'avoidUse',jsonb_build_array(
        'ballistic_rotation','conditioning_race','uncontrolled_failure',
        'symptom_provocation'),
      'cumulativeBudget',jsonb_build_object(
        'impact',1,'gripStress',50,'technicalSensitivity',56,
        'shoulderPressLoad',50,'trunkStabilityLoad',46,'kneelingContactLoad',20)))
  ON CONFLICT(definition_id,variant_key)
  DO UPDATE SET display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT half_variant_id,exact_definition_id,
    'half-kneeling-two-hand-shoulder-to-shoulder',
    'Half-Kneeling Two-Hand Landmine Shoulder-to-Shoulder Arc Press',
    ARRAY['half_kneeling','bilateral','2_hand','shoulder_to_shoulder_arc',
      'strict_no_deliberate_rotation','controlled_opposite_rack']::TEXT[],
    jsonb_set(jsonb_set(tall.difficulty_json,'{technicalComplexity}','54'::JSONB),
      '{baseOverallDifficulty}','54'::JSONB),
    tall.requirements_json||jsonb_build_object(
      'base','half_kneeling','leadLeg','declared',
      'startingShoulderToLeadLegRelationship','declared_and_recorded'),
    'review',tall.load_profile_json,
    tall.fatigue_profile_json||jsonb_build_object(
      'technicalFatigueSensitivity',58,'recoveryHours',36),
    tall.programming_profile_json||jsonb_build_object(
      'cumulativeBudget',(tall.programming_profile_json->'cumulativeBudget')
        ||jsonb_build_object('technicalSensitivity',58))
  FROM coaching.exercise_variant_v1 tall
  WHERE tall.id=tall_variant_id AND tall.definition_id=exact_definition_id
  ON CONFLICT(definition_id,variant_key)
  DO UPDATE SET display_name=EXCLUDED.display_name,
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
  SELECT variant.id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,profile.alignment,
    profile.objective_relevance,profile.dosage,
    'Count only one-way crossings that preserve two-hand control, head clearance, both shoulder racks, the declared arc, stacked ribs and pelvis, fixed base, and controlled deceleration.',
    ARRAY[
      'pain_guarding_numbness_dizziness_or_unusual_breathlessness',
      'anchor_bar_collar_plate_or_interface_moves_or_is_damaged',
      'head_hand_or_body_enters_unsafe_bar_or_plate_path',
      'grip_wrist_elbow_scapular_or_shoulder_control_changes',
      'rib_flare_rotation_side_bend_or_base_shift',
      'bar_end_drops_bounces_or_misses_declared_rack',
      'two_consecutive_crossings_fail_the_quality_gate']::TEXT[],
    'Inspect anchor, bar, collars, interface, pad, floor, and full arc. Declare base, lead leg, starting shoulder, load, range, tempo, total crossings, rest, pickup, and set-down. Observe from front or oblique without entering the bar path. Count one crossing as one rep and end the set before compensation.',
    'Set the kneeling base. Hold the approved interface with two hands at one shoulder. Brace, arc up and across without turning, and finish softly at the other shoulder. One crossing is one rep. Stop if path, grip, base, or comfort changes.',
    profile.adaptation,
    ARRAY['landmine','barbell','mat']::TEXT[],
    jsonb_build_object(
      'stationCount',1,'athletesPerStation',1,
      'setupSeconds',45,'changeoverSeconds',30,
      'minimumClearance','full_bar_and_plate_arc_plus_marked_exclusion_zone',
      'groupFlow','one_active_athlete_per_landmine_load_changes_only_when_bar_is_still',
      'durationModel','setup_plus_sets_times_crossings_and_tempo_plus_inter_set_rest_plus_set_down'),
    '{}'::UUID[],'review',
    profile.time_model,profile.scaling,
    jsonb_build_object(
      'requiredFields',jsonb_build_array(
        'variant_key','base','lead_leg','starting_shoulder','bar_type',
        'plate_mass','interface','range','tempo','planned_crossings',
        'quality_crossings','rest_seconds','symptoms','stop_reason'),
      'repUnit','one_way_shoulder_to_shoulder_crossing',
      'roundTripEquals',2),
    jsonb_build_object(
      'athlete',jsonb_build_array(
        'show_start_arc_finish','show_one_crossing_equals_one_rep',
        'show_head_clearance_and_stop_signal'),
      'coach',jsonb_build_array(
        'confirm_equipment_and_exclusion_zone','confirm_base_start_side_and_count',
        'record_quality_crossings_and_stop_reason'),
      'supportEscalation','identity_media_equipment_dose_or_symptom_questions_require_human_review')
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN LATERAL(VALUES
    ('movement-intelligence-arc-control','movement_intelligence','primary',
      'Learn a repeatable two-hand shoulder-to-shoulder arc, directional rep count, and organized kneeling base before meaningful loading.',86,82,
      jsonb_build_object(
        'movementQuality',90,'multiplanarControl',86,'strength',44,
        'conditioning',8,'impactTolerance',2),
      jsonb_build_object(
        'sets',jsonb_build_object('min',2,'max',3,'default',2),
        'repetitions',jsonb_build_object(
          'unit','one_way_crossings','min',4,'max',6,'default',4,
          'mustBeEven',TRUE),
        'tempo','controlled_with_one_second_opposite_rack_control',
        'restSeconds',jsonb_build_object('min',60,'max',90,'default',75),
        'intensity','unloaded_or_light_leave_at_least_three_clean_crossings_in_reserve',
        'startDirection','alternate_starting_shoulder_between_sets',
        'qualityLimited',TRUE),
      'repeatable two-hand arc control, counting accuracy, and trunk organization',
      jsonb_build_object(
        'setupSeconds',45,'secondsPerCrossing',3,
        'setTransitionSeconds',15,'setDownSeconds',20,
        'estimatedDurationSecondsMin',164,
        'estimatedDurationSecondsMax',386),
      jsonb_build_object(
        'scaleDown',jsonb_build_array(
          'unload_bar','shorten_owned_arc','reduce_to_four_crossings',
          'increase_rest','use_tall_kneeling_after_review'),
        'scaleUp',jsonb_build_array(
          'restore_full_owned_arc','add_crossings_within_range',
          'add_small_load_only_after_symmetric_control'),
        'neverScaleBy',jsonb_build_array(
          'adding_speed_or_rotation','racing_for_conditioning',
          'continuing_through_quality_loss_or_symptoms'))),
    ('capacity-controlled-strength','capacity','secondary',
      'Build moderate shoulder, triceps, grip, and trunk capacity while preserving the exact shoulder-to-shoulder path.',76,74,
      jsonb_build_object(
        'movementQuality',82,'multiplanarControl',82,'strength',76,
        'conditioning',18,'impactTolerance',2),
      jsonb_build_object(
        'sets',jsonb_build_object('min',3,'max',4,'default',3),
        'repetitions',jsonb_build_object(
          'unit','one_way_crossings','min',6,'max',10,'default',8,
          'mustBeEven',TRUE),
        'tempo','controlled_two_to_three_seconds_per_crossing',
        'restSeconds',jsonb_build_object('min',90,'max',120,'default',105),
        'intensity','moderate_load_leave_at_least_two_clean_crossings_in_reserve',
        'startDirection','alternate_starting_shoulder_between_sets',
        'qualityLimited',TRUE),
      'controlled multiplanar pressing capacity without ballistic rotation or path loss',
      jsonb_build_object(
        'setupSeconds',45,'secondsPerCrossing',3,
        'setTransitionSeconds',20,'setDownSeconds',20,
        'estimatedDurationSecondsMin',303,
        'estimatedDurationSecondsMax',677),
      jsonb_build_object(
        'scaleDown',jsonb_build_array(
          'reduce_load','reduce_to_six_crossings','shorten_owned_arc',
          'increase_rest','return_to_patterning_profile'),
        'scaleUp',jsonb_build_array(
          'add_crossings_within_range','add_one_set_within_range',
          'add_small_load_after_all_quality_gates_hold'),
        'neverScaleBy',jsonb_build_array(
          'adding_leg_drive','adding_deliberate_rotation','racing_to_failure',
          'continuing_through_quality_loss_or_symptoms')))
  ) profile(profile_key,phase_key,role,purpose,suitability,alignment,
    objective_relevance,dosage,adaptation,time_model,scaling)
  WHERE variant.definition_id=exact_definition_id
    AND variant.status='review'
    AND variant.requirements_json->>'selectable'='true'
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
    ('two-hand-landmine-shoulder-to-shoulder-arc-press','2026-08-01.3',$packet${"assessmentSummary":{"identity":"A two-hand landmine movement that starts with the bar end controlled at one shoulder, travels up and across in one continuous shoulder-to-shoulder arc while the trunk remains organized, and finishes under control at the opposite shoulder. One crossing is one repetition; direction, starting shoulder, kneeling base, load, range, tempo, and return must be declared.","currentCardFindings":["The legacy One-Arm Landmine Arc Press row does not describe this movement. Its description and execution are an ordinary one-arm fixed-diagonal press, and its paired One-Arm Eccentric Landmine Press differs only by lowering tempo.","Institute of Motion labels an embedded demonstration Arc Press and identifies half-kneeling and tall-kneeling bases. Automated visual research of the public storyboard observed two hands moving the free bar end between shoulder racks through a high side-to-side arc; this observation is candidate evidence, not a human media approval.","NIFS lists Landmine Press and Landmine Arc Press separately and names half-kneeling and standing options, supporting a distinct label but not by itself establishing every movement detail.","Five existing YouTube candidates previously returned oEmbed metadata and allow privacy-enhanced embedding. Exact-variant match, full playback review, safety, cue quality, captions, accessibility, reviewer identity, and approval all remain unresolved human gates."],"proposedTaxonomy":{"movementPatterns":["two_hand_shoulder_to_shoulder_landmine_arc","kneeling_anti_rotation_brace","controlled_upper_body_push_transfer"],"jointActions":["bilateral_shoulder_flexion_and_horizontal_transfer","scapular_upward_rotation_and_protraction","elbow_extension_then_controlled_flexion","trunk_anti_rotation_and_anti_lateral_flexion"],"planes":["oblique_frontal_arc","sagittal_press_component","transverse_stabilization"],"laterality":"bilateral_hand_support_with_directional_start_shoulder_and_balanced_crossings","sequence":"one_shoulder_rack__up_and_across_arc__opposite_shoulder_rack","intent":"controlled_multiplanar_shoulder_and_trunk_strength_not_ballistic_rotation"},"proposedAnatomy":{"primaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii","serratus_anterior","trapezius","abdominal_wall"],"secondaryMuscles":["rotator_cuff","latissimus_dorsi","forearm_and_hand_flexors","spinal_stabilizers","gluteals"],"joints":["hand","wrist","elbow","glenohumeral","scapulothoracic","thoracic_spine","lumbar_spine","pelvis","hip","knee"],"primaryActions":["two_hand_bar_end_control","oblique_upward_press_and_cross_body_transfer","controlled_opposite_shoulder_rack","anti_rotation_and_anti_lateral_flexion"]},"proposedDifficulty":{"technicalComplexity":54,"absoluteLoadDemand":48,"coordinationDemand":56,"supervisionDemand":48,"failureConsequence":48,"impact":1,"workCapacityDemand":50,"baseOverallDifficulty":54},"variantDifficultyCandidates":[{"variantKey":"tall-kneeling-two-hand-shoulder-to-shoulder","technicalComplexity":52,"absoluteLoadDemand":48,"baseOverallDifficulty":52,"identityQuarantine":false},{"variantKey":"half-kneeling-two-hand-shoulder-to-shoulder","technicalComplexity":54,"absoluteLoadDemand":48,"baseOverallDifficulty":54,"identityQuarantine":false}],"proposedLoadProfile":{"loadingType":"two_hand_barbell_end_control_about_fixed_landmine_pivot","impactClass":"none","externalLoadMethod":"record_bar_type_plate_mass_attachment_grip_base_lead_leg_starting_shoulder_range_tempo_and_crossings","primaryStress":["shoulder_and_scapular_control","elbow_extension_and_controlled_return","grip_and_forearm_control","trunk_anti_rotation_and_anti_lateral_flexion","kneeling_base_tolerance"],"fatigueProfile":["rib_flare_or_back_extension","torso_rotation_or_side_bend","uneven_or_collapsing_arc","wrist_or_grip_change","bar_end_drops_into_shoulder","range_or_direction_count_drift"],"recoveryHours":"twenty_four_to_forty_eight_after_moderate_strength_volume_subject_to_load_symptoms_and_overlapping_pressing_throwing_grip_or_trunk_work"},"proposedConstraints":{"requiredEquipment":["rated_fixed_landmine_pivot","compatible_barbell","secure_two_hand_free_end_interface","collars_when_loaded","kneeling_pad"],"optionalEquipment":["plates","floor_markers","video_capture"],"environment":["level_dry_non_slip_floor","full_bar_and_plate_arc_clear","no_person_inside_pivot_bar_or_plate_exclusion_zone","enough_space_for_controlled_pickup_set_down_and_exit"],"population":["can_tolerate_selected_kneeling_base","can_control_unloaded_or_light_bar_end_through_owned_arc","can_keep_wrist_elbow_scapula_ribcage_and_pelvis_organized","understands_crossing_count_and_stop_signal"]},"proposedDosage":{"patterning":"two_to_three_sets_of_four_to_six_total_one_way_crossings_with_full_control_and_alternated_starting_shoulder","controlledStrength":"three_to_four_sets_of_six_to_ten_total_crossings_at_a_load_that_preserves_the_same_arc_and_both_shoulder_racks","restSeconds":"sixty_to_one_hundred_twenty_between_sets_or_longer_when_grip_shoulders_or_trunk_change_the_path","intensity":"leave_two_or_more_clean_crossings_in_reserve_and_never_race_the_bar","measurement":"variant_base_lead_leg_starting_shoulder_bar_and_plate_load_attachment_range_tempo_total_crossings_quality_repetitions_rest_symptoms_and_stop_reason","progressWhen":"all_crossings_reach_both_declared_shoulder_racks_with_a_smooth_symmetric_arc_stacked_trunk_stable_base_and_controlled_set_down"},"proposedInstructions":{"coachCues":["Two hands own the bar end","Start at one shoulder","Arc up and across","Keep ribs over pelvis","Finish softly at the other shoulder"],"athleteInstructions":["Set the declared tall- or half-kneeling base on a pad and confirm the bar path is clear","Control the free end with two hands at the starting shoulder and stack wrists and elbows","Brace without holding your breath, then guide the bar up and across without turning or side-bending","Finish under control at the opposite shoulder; that one crossing is one repetition","Continue in alternating directions only while both sides match, then return and set the bar down as coached"],"commonFaults":["one_hand_takes_over","gripping_an_unapproved_plate_edge_or_attachment","bar_cuts_straight_across_instead_of_clearing_the_head","rib_flare_back_extension_or_trunk_rotation","bar_end_drops_or_bounces_at_shoulder","range_shortens_in_one_direction","kneeling_base_or_lead_leg_changes","crossings_are_miscounted_as_round_trips"]},"proposedSafety":{"readiness":["anchor_bar_collar_interface_floor_and_clearance_pass_inspection","pain_free_selected_kneeling_base","controlled_unloaded_or_light_rehearsal_both_directions","pickup_set_down_and_stop_signal_rehearsed"],"qualityGates":["two_hands_remain_on_approved_interface","head_stays_clear_of_bar_and_plate_path","both_shoulder_racks_and_owned_arc_remain_repeatable","ribs_pelvis_and_kneeling_base_remain_organized","bar_end_is_decelerated_not_dropped","direction_count_and_starting_shoulder_are_recorded"],"stopRules":["pain_guarding_numbness_dizziness_or_unusual_breathlessness","anchor_bar_collar_plate_or_attachment_moves_or_is_damaged","head_hand_or_body_enters_unsafe_bar_or_plate_path","grip_wrist_elbow_scapular_or_shoulder_control_changes","rib_flare_rotation_side_bend_or_base_shift","bar_end_drops_bounces_or_misses_declared_rack","two_consecutive_crossings_fail_the_quality_gate"]},"proposedContextualProfiles":[{"context":"movement_intelligence_multiplanar_arc_control","dose":"two_to_three_sets_of_four_to_six_total_crossings_with_sixty_to_ninety_seconds_rest","purpose":"learn_repeatable_two_hand_shoulder_to_shoulder_path_and_trunk_control"},{"context":"capacity_controlled_multiplanar_press_strength","dose":"three_to_four_sets_of_six_to_ten_total_crossings_with_ninety_to_one_hundred_twenty_seconds_rest","purpose":"build_controlled_shoulder_grip_and_trunk_capacity_without_ballistic_rotation"}],"proposedRelationships":{"regressions":["tall_kneeling_variant_with_lighter_load_shorter_owned_arc_and_fewer_crossings","separately_defined_strict_landmine_press_when_side_to_side_path_is_not_tolerated"],"progressions":["half_kneeling_variant_after_tall_kneeling_path_control","greater_owned_arc_or_load_only_after_symmetric_control"],"substitutions":["other_reviewed_controlled_multiplanar_press_only_when_equipment_objective_and_constraints_match"],"doNotSubstitute":["one_arm_strict_landmine_press","one_arm_eccentric_landmine_press_as_a_separate_identity","landmine_rotation_or_rainbow_with_deliberate_trunk_rotation","landmine_push_press_or_throw"]},"proposedSupport":{"athlete":["three_frame_start_arc_finish_visual","one_crossing_equals_one_rep_counter","starting_shoulder_and_lead_leg_labels","head_and_plate_clearance_overlay","stop_signal_and_safe_set_down_clip"],"coach":["anchor_bar_collar_interface_and_clearance_checklist","front_and_oblique_observation_views","base_lead_leg_start_direction_and_load_log","arc_symmetry_and_trunk_compensation_checklist","station_spacing_and_changeover_plan"]},"calibrationEvidence":{"basis":"professional exercise labels, automated visual observation of the Institute of Motion embedded demonstration, comparison with Vortex strict landmine press source rows, and existing landmine difficulty anchors","uncertainty":"No peer-reviewed study isolates this exact shoulder-to-shoulder arc. Exact interface, path landmarks, safe range, dose, difficulty scores, standing variant, media match, and progression ordering remain review-only proposals.","reviewNeeded":["qualified_identity_and_technique_review","equipment_interface_and_facility_risk_review","difficulty_anchor_comparison","dosage_and_recovery_review","full_media_playback_and_accessibility_review","pilot_observation"]},"programmingDecision":"Archive the misleading one-arm Arc identity after remapping legacy source 1413 to the standard strict Landmine Press family and source 1414 to the same family with an eccentric-tempo modifier. Create this separate two-hand shoulder-to-shoulder definition in review state with tall- and half-kneeling variants. Do not publish or select it until human content, equipment, media, calibration, relationship, pilot, and publication review are complete.","currentCardSnapshot":{"capturedAt":"2026-08-01T20:00:00.000Z","cardVersion":1,"status":"review","description":"From a declared tall- or half-kneeling base, control the free end of a barbell secured in a rated landmine with two hands at one shoulder. Guide it up and across in a clear arc, keep the trunk organized, finish under control at the opposite shoulder, count one crossing as one repetition, then continue or reset as prescribed.","familyKey":"two_hand_landmine_shoulder_to_shoulder_arc","movementPatterns":["push","brace"],"bodyRegions":["hand","wrist","elbow","shoulder","scapula","rib_cage","core","spine","pelvis","hip","knee"],"requiredEquipment":["landmine","barbell","mat"],"optionalEquipment":["plates"],"environment":{"surface":"level_dry_non_slip_floor_with_kneeling_pad","equipment":"rated_fixed_pivot_compatible_barbell_collars_and_approved_two_hand_interface","space":"full_bar_and_plate_arc_clear_with_exclusion_zone","traffic":"one_active_athlete_per_landmine"},"population":{"selectionStatus":"candidate_requires_human_review","readinessChecks":["pain_free_selected_kneeling_base","controlled_unloaded_or_light_arc_both_directions","understands_counting_and_stop_signal"],"contraindications":["pain_guarding_or_neurologic_symptoms","unsafe_equipment_or_clearance","cannot_control_bar_end_or_base"]},"difficulty":{},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://platform.instituteofmotion.com/library/activity/r59tleo2/share/","sourceTitle":"Arc Press – Landmine","sourcePublisher":"Institute of Motion","sourceKind":"expert_instruction","evidenceQuality":68,"claims":["Institute of Motion labels its embedded demonstration Arc Press and names half-kneeling and tall-kneeling bases.","Automated storyboard observation indicates a two-hand shoulder-to-shoulder bar-end transfer; this supports a separate candidate definition but is not a human approval."]},{"sectionKey":"taxonomy","sourceUrl":"https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern","sourceTitle":"Shouldering the Load: Safe Alternatives to the Overhead Press Pattern","sourcePublisher":"National Institute for Fitness and Sport","sourceKind":"expert_instruction","evidenceQuality":66,"claims":["NIFS lists Landmine Press and Landmine Arc Press as separate options and names kneeling or standing bases.","Taxonomy must distinguish hand count, start rack, path, endpoint, trunk-rotation policy, base, direction counting, and terminal control."]},{"sectionKey":"anatomy","sourceUrl":"https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/","sourceTitle":"The Landmine Press—Implementation and Variation","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["The landmine is used for shoulder strength and stability through a barbell fixed to a stable base.","The proposed anatomy extends the known landmine press demands to the observed two-hand cross-body path and remains subject to exact-technique review."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41755100/","sourceTitle":"Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling","sourcePublisher":"Sensors","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Landmine press loading and kinematics depend on the fixed pivot geometry and bar path.","Track bar angle, athlete distance, shoulder racks, range, direction, interface, and torso compensation rather than treating plate mass alone as load."]},{"sectionKey":"difficulty","sourceUrl":"https://platform.instituteofmotion.com/library/activity/r59tleo2/share/","sourceTitle":"Arc Press – Landmine","sourcePublisher":"Institute of Motion","sourceKind":"expert_instruction","evidenceQuality":68,"claims":["The observed task combines two-hand bar control, a high cross-body arc, kneeling base control, and repeated deceleration at alternating shoulders.","Difficulty is exercise complexity plus physical difficulty, with overall equal to their maximum; no athlete proficiency level belongs on the exercise card."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41755100/","sourceTitle":"Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling","sourcePublisher":"Sensors","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Fixed-pivot geometry changes the relationship between external mass and force through the path.","Record bar, plates, pivot, interface, base, range, tempo, crossings, symptoms, and overlapping press, throw, grip, and trunk load; the proposed recovery window is conservative and review-only."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/","sourceTitle":"The Landmine Press—Implementation and Variation","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["A landmine requires a stable fixed base and compatible barbell setup.","Require a rated pivot, secure two-hand interface, collars, clear arc and exclusion zone, stable kneeling surface, and rehearsed pickup and set-down."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/","sourceTitle":"The Landmine Press—Implementation and Variation","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Landmine pressing can serve strength and stability objectives, but the source does not prescribe this exact arc dose.","The proposed low-to-moderate crossing ranges, rest, and repetitions in reserve are programming inferences that require coach and pilot review."]},{"sectionKey":"instructions","sourceUrl":"https://platform.instituteofmotion.com/library/activity/r59tleo2/share/","sourceTitle":"Arc Press – Landmine","sourcePublisher":"Institute of Motion","sourceKind":"expert_instruction","evidenceQuality":68,"claims":["The embedded demonstration provides visual evidence of two-hand control and shoulder-to-shoulder travel from kneeling bases.","Instructions must define start shoulder, one-way crossing count, high arc, opposite rack, trunk policy, reset, and set-down; human technique review remains pending."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/","sourceTitle":"The Landmine Press—Implementation and Variation","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Stable equipment and controlled shoulder positioning are material to landmine press implementation.","Stop for symptoms, equipment movement, unsafe head or plate clearance, lost grip, compensation, dropped bar end, or repeated failure of the declared path."]},{"sectionKey":"programming","sourceUrl":"https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern","sourceTitle":"Shouldering the Load: Safe Alternatives to the Overhead Press Pattern","sourcePublisher":"National Institute for Fitness and Sport","sourceKind":"expert_instruction","evidenceQuality":66,"claims":["NIFS presents the Arc Press as an overhead or vertical press option separate from the Landmine Press.","Use this candidate for controlled multiplanar shoulder and trunk work, not as a one-arm strict press, rotational rainbow, ballistic push press, or conditioning race."]},{"sectionKey":"athlete_support","sourceUrl":"https://platform.instituteofmotion.com/library/activity/r59tleo2/share/","sourceTitle":"Arc Press – Landmine","sourcePublisher":"Institute of Motion","sourceKind":"expert_instruction","evidenceQuality":68,"claims":["The demonstration makes the start, cross-body arc, opposite finish, and kneeling base visible.","Athlete support should show start, arc and finish frames, rep counting, base labels, clearance, breathing, stop signal, and controlled set-down."]},{"sectionKey":"coach_support","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/41755100/","sourceTitle":"Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling","sourcePublisher":"Sensors","sourceKind":"peer_reviewed_research","evidenceQuality":86,"claims":["Bar path and joint-angle observation can provide more useful control than plate mass alone.","Coach support should record setup, base, lead leg, start direction, path symmetry, bar load, range, tempo, quality crossings, rest, symptoms, and stop reason."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/","sourceTitle":"The Landmine Press—Implementation and Variation","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":84,"claims":["Landmine loading can be adjusted through equipment, stance and range choices.","Scale with unloaded bar, shorter owned arc, fewer crossings, longer rest, reviewed base, demonstration, visual markers, or alternate instructions without inventing an athlete level."]},{"sectionKey":"alternates","sourceUrl":"https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern","sourceTitle":"Shouldering the Load: Safe Alternatives to the Overhead Press Pattern","sourcePublisher":"National Institute for Fitness and Sport","sourceKind":"expert_instruction","evidenceQuality":66,"claims":["Landmine Press and Landmine Arc Press are listed separately, so the Arc label should not be an alias for a standard one-arm diagonal press.","Base changes may be variants; hand-count, rotation, leg drive, throw, terminal path, or mere eccentric tempo require explicit new-definition or modifier decisions."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embed URLs.","Five candidates have prior automated oEmbed availability and embedding evidence, but exact movement match, complete playback, safety, cues, captions, accessibility, reviewer identity, and approval remain human review gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=JFwX9gJh8Fc","title":"Landmine - Arc Press for shoulders (half-kneeling and tall-kneeling)","channelName":"Brad Sims, CPT","sourceQuery":"landmine arc press shoulders","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-07-27T12:00:00.000Z"},"notes":"Institute of Motion embeds this candidate. Automated storyboard observation found two-hand shoulder-to-shoulder arc mechanics and tall- and half-kneeling bases. Human exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=o77Fevbmr2g","title":"Standing Landmine OH Arc Press","channelName":"Functional Effect Fitness & Rehabilitation","sourceQuery":"standing landmine arc press","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-07-27T12:00:00.000Z"},"notes":"Prior oEmbed metadata responded. The title suggests a standing alternate, but hand count, full path, content, and all human review gates remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=SEFb24cdAZs","title":"Unity Fitness - Landmine Arc Press","channelName":"Jordan Rudolph","sourceQuery":"landmine arc press","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-07-27T12:00:00.000Z"},"notes":"Prior oEmbed metadata responded. Hand count, base, path, safety, instruction quality, captions, accessibility, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=KwQVonn3jeE","title":"Landmine Arc Press (prenatal)","channelName":"Karla Bosnar","sourceQuery":"landmine arc press","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-07-27T12:00:00.000Z"},"notes":"Prior oEmbed metadata responded. This is population-specific and cannot support general selection or any safety claim without full population, content, and media review.","exactVariantMatch":null,"reviewStatus":"candidate"},{"url":"https://www.youtube.com/watch?v=Sgikteuhkkw","title":"Landmine Arcs","channelName":"Josh Kauten","sourceQuery":"landmine arcs","linkStatus":"healthy","embeddingAllowed":true,"externalVerification":{"method":"youtube_oembed","verifiedAt":"2026-07-27T12:00:00.000Z"},"notes":"Prior oEmbed metadata responded. The title is adjacent to the candidate identity; exact path, base, hand count, rotation, content quality, reviewer, and approval remain pending.","exactVariantMatch":null,"reviewStatus":"candidate"}],"alternateAssessments":[{"name":"Tall-Kneeling Two-Hand Shoulder-to-Shoulder Arc Press","classification":"new_variant","rationale":"A symmetrical two-knee base preserves the two-hand shoulder-to-shoulder path while changing lower-body support and base-control demand.","distinguishingDimensions":{"variantKey":"tall-kneeling-two-hand-shoulder-to-shoulder","base":"tall_kneeling"}},{"name":"Half-Kneeling Two-Hand Shoulder-to-Shoulder Arc Press","classification":"new_variant","rationale":"One foot forward creates an asymmetrical base; lead leg and starting shoulder must be declared and balanced.","distinguishingDimensions":{"variantKey":"half-kneeling-two-hand-shoulder-to-shoulder","base":"half_kneeling"}},{"name":"Standing Two-Hand Landmine Arc Press","classification":"new_variant","rationale":"Standing preserves the candidate two-hand shoulder-to-shoulder path but changes support, load tolerance, lower-body contribution, pickup, and set-down; exact review is still required.","distinguishingDimensions":{"base":"standing","reviewGate":"exact_path_and_no_leg_drive_review"}},{"name":"One-Arm Landmine Press","classification":"new_definition","rationale":"A one-arm fixed diagonal press from one shoulder to a forward finish is the existing Landmine Press family, not this two-hand shoulder-to-shoulder arc.","distinguishingDimensions":{"existingSlug":"landmine-press","handCount":1,"terminalAction":"forward_diagonal_finish_then_same_rack_return"}},{"name":"One-Arm Eccentric Landmine Press","classification":"modifier_annotation","rationale":"A slower lowering phase changes contraction emphasis, load, fatigue, and dose within the standard one-arm press; it does not create an Arc identity.","distinguishingDimensions":{"existingSlug":"landmine-press","modifiers":["eccentric_duration","concentric_assistance","tempo"],"legacyExerciseId":1414}},{"name":"Rotational Landmine Rainbow","classification":"new_definition","rationale":"Deliberate torso and hip rotation with a side-to-side bar path changes force strategy, planes, lower-body contribution, fatigue, and stop rules.","distinguishingDimensions":{"primaryAction":"loaded_trunk_and_hip_rotation","rotationPolicy":"deliberate_rotation"}},{"name":"Landmine Push Press or Throw Through an Arc","classification":"new_definition","rationale":"Leg drive, ballistic intent, release, or an uncontrolled terminal action changes action order, power demand, equipment risk, and failure management.","distinguishingDimensions":{"legDrive":true,"intent":"ballistic","releaseOrCatch":"must_be_declared"}},{"name":"Tempo, Pause, Range, Load, or Starting-Shoulder Change","classification":"modifier_annotation","rationale":"These variables change dose or difficulty but preserve identity when two hands, selected base, shoulder-to-shoulder path, trunk policy, and controlled opposite rack remain fixed.","distinguishingDimensions":{"modifiers":["tempo","pause","owned_range","load","starting_shoulder","crossing_count"]}}]}$packet$::JSONB);
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
    media.item->>'channelName',NULL,'en',NULL,
    coalesce((media.item->>'embeddingAllowed')::BOOLEAN,FALSE),
    NULL,NULL,
    CASE WHEN media.item->>'linkStatus'='healthy' THEN 'healthy'
      ELSE 'unverified' END,
    'candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,
    concat_ws(' ',media.item->>'notes',
      'Automated availability and embedding evidence do not establish exact movement match, complete viewing, safety, accessibility, reviewer identity, or approval.')
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=packet.packet_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=EXCLUDED.embedding_allowed,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status=EXCLUDED.link_status,
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
  (tall_variant_id,half_variant_id,'progression',82,
    ARRAY['complexity','stability']::TEXT[],
    'Half kneeling adds a declared lead leg and directional relationship while preserving the two-hand shoulder-to-shoulder arc. Treat this as a proposed progression only after the tall-kneeling path is symmetric and the half-kneeling base is tolerated.',
    jsonb_build_object(
      'requires',jsonb_build_array(
        'qualified_human_relationship_review',
        'repeatable_tall_kneeling_arc_both_directions',
        'pain_free_half_kneeling_base'),
      'approvalCreated',FALSE),'review',NULL,NULL,NULL),
  (half_variant_id,tall_variant_id,'regression',82,
    ARRAY['complexity','stability']::TEXT[],
    'Tall kneeling removes the lead-leg relationship while preserving hand count, equipment, shoulder racks, arc, and rep unit. Treat it as a proposed simplification, not an approved automatic substitution.',
    jsonb_build_object(
      'requires',jsonb_build_array(
        'qualified_human_relationship_review',
        'pain_free_tall_kneeling_base',
        'same_equipment_path_and_training_objective'),
      'approvalCreated',FALSE),'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension
      WHEN 'technicalComplexity'
        THEN (variant.difficulty_json->>'technicalComplexity')::SMALLINT
      ELSE (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN 60 ELSE 40 END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN
        'Candidate complexity reflects two-hand interface control, a shoulder-to-shoulder arc, head clearance, alternating direction, rep counting, kneeling-base control, deceleration, pickup, and set-down; human anchor review is required.'
      ELSE
        'Candidate physical difficulty reflects moderate landmine load, shoulder and triceps work, grip, trunk stabilization, kneeling tolerance, repeated deceleration, and quality-limited volume; human anchor review is required.' END,
    'review',1,NULL,NULL,
    'Proposal only. No calibration, card, graph, media, or publication approval is created.',
    NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand'))
    dimension(dimension)
  WHERE variant.definition_id=exact_definition_id
    AND variant.status='review'
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,definition.card_version,'1.0.0',migration_key,
    'quarantined',
    jsonb_build_object(
      'identityResolved',TRUE,
      'legacySource1413MappedToStandardPress',(
        SELECT source.definition_id=standard_definition_id
        FROM coaching.exercise_definition_source_v1 source
        WHERE source.legacy_exercise_id=1413),
      'legacySource1414ModeledAsTempoModifier',(
        SELECT source.definition_id=standard_definition_id
          AND source.provenance_json->>'resolution'
            ='standard_press_with_eccentric_tempo_modifier'
        FROM coaching.exercise_definition_source_v1 source
        WHERE source.legacy_exercise_id=1414),
      'legacyFalseIdentityArchived',(
        SELECT status='archived' FROM coaching.exercise_definition_v1
        WHERE id=legacy_definition_id),
      'difficultyUsesComplexityAndPhysicalDemandOnly',NOT EXISTS(
        SELECT 1 FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id=definition.id AND(
          (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
            <>greatest(
              (variant.difficulty_json->>'technicalComplexity')::INTEGER,
              (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER)
          OR coaching.exercise_json_has_non_neutral_level_classification(
            variant.difficulty_json))),
      'twoSelectableExactVariants',(
        SELECT count(*)=2 FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id=definition.id AND variant.status='review'
          AND variant.requirements_json->>'selectable'='true'),
      'fourContextualProfiles',(
        SELECT count(*)=4
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
        WHERE variant.definition_id=definition.id AND profile.status='review'),
      'sixteenCandidateEvidenceSections',(
        SELECT count(DISTINCT evidence.section_key)=16
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=definition.id
          AND evidence.reviewed_card_version=definition.card_version
          AND evidence.review_status='candidate'),
      'fiveEmbeddableCandidates',(
        SELECT count(*)=5 FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=definition.id
          AND media.reviewed_card_version=definition.card_version
          AND media.review_status='candidate' AND media.link_status='healthy'
          AND media.embedding_allowed=TRUE
          AND media.exact_variant_match IS NULL
          AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL),
      'eightAlternateAssessments',(
        SELECT count(*)=8
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id=definition.id
          AND alternate.reviewed_card_version=definition.card_version
          AND alternate.review_status='candidate'),
      'relationshipsReviewOnly',NOT EXISTS(
        SELECT 1 FROM coaching.exercise_relationship_v1 relationship
        WHERE relationship.from_variant_id IN(tall_variant_id,half_variant_id)
          AND relationship.review_status<>'review'),
      'calibrationsReviewOnly',NOT EXISTS(
        SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
        WHERE calibration.variant_id IN(tall_variant_id,half_variant_id)
          AND calibration.status<>'review'),
      'approvalsCreated',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Human content, equipment-risk, difficulty, dosage, support, pilot, and publication review are incomplete.'),
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','Five links are automated oEmbed-healthy and embeddable, but exact match, full playback, safety, cues, captions, accessibility, quality, reviewer identity, and approval remain incomplete.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','Progression and regression relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Complexity and physical-difficulty scores remain review-only proposals.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=exact_definition_id AND definition.facility_id=1
    AND definition.status='review'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
      WHERE source.legacy_exercise_id IN(1413,1414)
        AND source.definition_id=standard_definition_id
        AND source.source_kind='duplicate_consolidation')<>2 THEN
    RAISE EXCEPTION '% failed to consolidate both legacy source rows',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.id=legacy_definition_id AND definition.status<>'archived'
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    WHERE variant.definition_id=legacy_definition_id AND variant.status<>'archived'
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
    JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
    WHERE variant.definition_id=legacy_definition_id AND profile.status<>'archived'
  ) THEN
    RAISE EXCEPTION '% failed to archive the false legacy Arc identity',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id=exact_definition_id
        AND variant.status='review'
        AND variant.requirements_json->>'selectable'='true'
        AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
          =greatest(
            (variant.difficulty_json->>'technicalComplexity')::INTEGER,
            (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>2 THEN
    RAISE EXCEPTION '% expected two exact difficulty-valid variants',migration_key;
  END IF;

  IF(SELECT count(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id=exact_definition_id
        AND profile.status='review'
        AND profile.dosage_json ? 'sets'
        AND profile.dosage_json ? 'repetitions'
        AND profile.dosage_json ? 'restSeconds'
        AND profile.time_model_json ? 'estimatedDurationSecondsMin'
        AND profile.time_model_json ? 'estimatedDurationSecondsMax'
        AND profile.measurement_json->>'repUnit'
          ='one_way_shoulder_to_shoulder_crossing')<>4 THEN
    RAISE EXCEPTION '% expected four planning-ready delivery profiles',
      migration_key;
  END IF;

  IF(SELECT count(DISTINCT evidence.section_key)
      FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id=exact_definition_id
        AND evidence.reviewed_card_version=1
        AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% expected sixteen candidate evidence sections',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=exact_definition_id
        AND media.reviewed_card_version=1
        AND media.review_status='candidate' AND media.link_status='healthy'
        AND media.embedding_allowed=TRUE AND media.exact_variant_match IS NULL
        AND media.demonstration_quality_score IS NULL
        AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>5 THEN
    RAISE EXCEPTION '% expected five embeddable but unapproved media candidates',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id=exact_definition_id
        AND alternate.reviewed_card_version=1
        AND alternate.review_status='candidate')<>8 THEN
    RAISE EXCEPTION '% expected eight alternate assessments',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id IN(tall_variant_id,half_variant_id)
        AND relationship.review_status='review'
        AND relationship.reviewed_by IS NULL
        AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected two review-only relationships',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      WHERE calibration.variant_id IN(tall_variant_id,half_variant_id)
        AND calibration.dimension IN('technicalComplexity','absoluteLoadDemand')
        AND calibration.status='review' AND calibration.reviewed_by IS NULL
        AND calibration.reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% expected four review-only calibration proposals',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise WHERE id IN(1413,1414)
      AND skill_level IS NOT NULL
  ) OR EXISTS(
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.id=exact_definition_id AND variant.status<>'archived'
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
    WHERE definition.id=exact_definition_id AND(
      definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
      OR variant.status='published' OR profile.status='published'))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id=exact_definition_id
        AND media.review_status IN('shortlisted','approved','rejected'))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id IN(tall_variant_id,half_variant_id)
        AND relationship.review_status<>'review')
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
      WHERE calibration.variant_id IN(tall_variant_id,half_variant_id)
        AND calibration.status<>'review') THEN
    RAISE EXCEPTION '% created forbidden approval or publication state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=standard_definition_id
        AND resolution.resolved_definition_id=legacy_definition_id
        AND resolution.decision='duplicate_consolidated'
        AND resolution.resolution_source='deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'decisionScope'
          ='identity_only_not_card_media_graph_calibration_or_publication_approval')<>1 THEN
    RAISE EXCEPTION '% expected one deterministic identity consolidation',
      migration_key;
  END IF;

  IF(SELECT count(*)
      FROM coaching.exercise_identity_resolution_v1 resolution
      JOIN coaching.exercise_definition_v1 other
        ON other.id=resolution.survivor_definition_id
      WHERE resolution.resolved_definition_id=exact_definition_id
        AND other.slug IN(
          standard_slug,'one-arm-landmine-push-press',
          'half-kneeling-one-arm-landmine-press','one-arm-landmine-z-press',
          'tall-kneeling-one-arm-landmine-press','landmine-squat-to-press',
          'one-arm-landmine-floor-press')
        AND resolution.decision='distinct_exercises'
        AND resolution.resolution_source='deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'decisionScope'
          ='identity_only_not_card_media_graph_calibration_or_publication_approval')<>7 THEN
    RAISE EXCEPTION '% expected seven deterministic exact-card boundaries',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      WHERE packet.definition_id=exact_definition_id
        AND packet.card_version=1 AND packet.audit_version=migration_key
        AND packet.status='quarantined'
        AND packet.human_review_required=TRUE)<>1 THEN
    RAISE EXCEPTION '% expected current quarantined card test packet',
      migration_key;
  END IF;
END
$$;
