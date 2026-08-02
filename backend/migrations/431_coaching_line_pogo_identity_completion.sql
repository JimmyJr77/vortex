-- Complete exact bilateral lateral and forward-back line-pogo cards and retire
-- three generic source identities plus four redundant published legacy aliases.
-- Automated media health remains candidate evidence only. Exercise cards use
-- complexity and physical difficulty; athlete proficiency is excluded.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '431_coaching_line_pogo_identity_completion';
  research_batch CONSTANT TEXT := 'line-pogo-identity-completion-v1';
  research_version CONSTANT TEXT := '2026-08-01.9';
  lateral_id UUID;
  forward_id UUID;
  generic_pogo_id UUID;
  generic_line_id UUID;
  ambiguous_forward_id UUID;
  lateral_variant_id UUID;
  forward_variant_id UUID;
  source_ids UUID[];
  survivor_ids UUID[];
  all_ids UUID[];
  applied_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT id INTO lateral_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='lateral-line-pogo';
  SELECT id INTO forward_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='line-pogo-forward-back';
  SELECT id INTO generic_pogo_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='line-pogo-hops';
  SELECT id INTO generic_line_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='line-hops';
  SELECT id INTO ambiguous_forward_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='forward-back-line-hops';

  IF lateral_id IS NULL OR forward_id IS NULL OR generic_pogo_id IS NULL
      OR generic_line_id IS NULL OR ambiguous_forward_id IS NULL THEN
    RAISE EXCEPTION '% requires all five line-hop definitions',migration_key;
  END IF;
  source_ids := ARRAY[generic_pogo_id,generic_line_id,ambiguous_forward_id];
  survivor_ids := ARRAY[lateral_id,forward_id];
  all_ids := source_ids||survivor_ids;

  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
     WHERE source.definition_id=ANY(all_ids)
       AND source.legacy_exercise_id IN(136,137,267,268,269,714,975,1083,1110))<>9 THEN
    RAISE EXCEPTION '% requires all nine preserved legacy source mappings',
      migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
    AND definition.provenance_json->>'linePogoIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,5) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF applied_count=0 THEN
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(all_ids)
         AND definition.status='review' AND definition.card_version=1)<>5 THEN
      RAISE EXCEPTION '% expected five version-1 review cards',migration_key;
    END IF;
  ELSE
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(source_ids)
         AND definition.status='archived' AND definition.card_version=2)<>3
      OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
         WHERE definition.id=ANY(survivor_ids)
           AND definition.status='review' AND definition.card_version=2)<>2 THEN
      RAISE EXCEPTION '% found prior-application state drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
      AND resolution.survivor_definition_id=ANY(all_ids)
      AND resolution.resolved_definition_id=ANY(all_ids)
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id=ANY(all_ids)
        AND(definition.status IN('published','deprecated')
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
      WHERE variant.definition_id=ANY(all_ids)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id=ANY(all_ids)
        AND(calibration.status<>'review'
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
    WHERE definition_id=ANY(all_ids) AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=ANY(all_ids) AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=ANY(all_ids) AND review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id AND variant.definition_id=ANY(all_ids);
  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',updated_at=now()
  WHERE variant.definition_id=ANY(all_ids);

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name=CASE definition.slug
      WHEN 'line-pogo-hops' THEN 'Line Pogo Hops (Unresolved Legacy)'
      WHEN 'line-hops' THEN 'Line Hops (Unresolved Legacy)'
      ELSE 'Forward-Back Line Hops (Unresolved Legacy)' END,
    display_name=CASE definition.slug
      WHEN 'line-pogo-hops' THEN 'Line Pogo Hops (Unresolved Legacy)'
      WHEN 'line-hops' THEN 'Line Hops (Unresolved Legacy)'
      ELSE 'Forward-Back Line Hops (Unresolved Legacy)' END,
    description=CASE definition.slug
      WHEN 'line-pogo-hops' THEN 'Archived nonprescribable source. Two-foot line wording does not declare lateral versus forward-back direction, mandatory line crossing, contact cycle, amplitude, or terminal action.'
      WHEN 'line-hops' THEN 'Archived nonprescribable source. Direction, line crossing, foot count, pogo versus brake-and-pop strategy, contact count, cadence, and terminal action are unresolved.'
      ELSE 'Archived nonprescribable source. Forward-back direction is known, but foot count, mandatory line crossing, pogo versus brake-and-pop strategy, contact count, cadence, and terminal action are unresolved.' END,
    family_key='unresolved_line_hop_identity_quarantine',
    content_confidence=94,scoring_confidence=1,media_confidence=36,
    movement_patterns=ARRAY['jump','land'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','core'],
    required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'known',jsonb_build_array('visible_line_wording','jump_landing_surface'),
      'unresolved',CASE definition.slug
        WHEN 'forward-back-line-hops' THEN jsonb_build_array(
          'line_crossing','foot_count','contact_strategy','contact_count',
          'cadence','terminal_action','landing_zone','run_out')
        ELSE jsonb_build_array(
          'direction','line_crossing','foot_count','contact_strategy',
          'contact_count','cadence','terminal_action','landing_zone') END,
      'selectionBlocked',TRUE),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness and impact exposure cannot be matched to an undefined contact task',
      'supportPath','choose_an_exact_reviewed_line_pogo_or_line_hop'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('generic_lower_limb_hopping_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array('foot','ankle','knee','hip','lumbopelvic'),
      'jointActions',jsonb_build_array('blocked_pending_direction_foot_count_and_contact_strategy'),
      'planes',CASE definition.slug WHEN 'forward-back-line-hops'
        THEN jsonb_build_array('sagittal_direction_known_exact_strategy_unresolved')
        ELSE jsonb_build_array('direction_and_plane_unresolved') END,
      'laterality','unresolved_bilateral_unilateral_or_alternating',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This label can mean materially different contact tasks and is unavailable until an exact exercise is selected.',
      'primaryCue','Ask for the exact lateral, forward-back, single-leg, alternating, or stick version.',
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'pain','instability','Achilles_or_plantar_symptoms','numbness','dizziness'),
      'painGuidance','Do not begin from this unresolved card; stop the replacement exercise for symptoms or unsafe contact control.',
      'selfChecks',jsonb_build_array(
        'direction and crossing are visible','foot count and contact sequence are visible',
        'contact unit and finish are declared'),
      'accessibility',jsonb_build_array(
        'plain-language retirement explanation','text-first exact alternatives'),
      'mediaAlternatives',jsonb_build_array(
        'missing-identity explanation','coach-selected exact card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'direction','line_crossing','foot_count','contact_strategy',
        'contact_count','cadence','terminal_action','repetition_boundary'),
      'faultCorrections',jsonb_build_array(
        'Do not cue, dose, or demonstrate until every identity field is declared'),
      'demonstrationPlan',jsonb_build_array(
        'Explain the ambiguous lineage','Open the exact replacement card'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'bilateral_lateral_pogo','choose_lateral_line_pogo',
        'bilateral_forward_back_pogo','choose_line_pogo_forward_back',
        'other','choose_or_author_a_separate_exact_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','direction','line_crossing','foot_count','contact_accounting'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','unsafe_surface_or_collision')),
      'retentionPolicy','Preserve source mappings, original wording, aliases, evidence, media, and queue decisions.',
      'changeImpactPolicy','Do not reactivate without exact direction, crossing, foot count, strategy, contact unit, and finish evidence.',
      'knownLimitations',jsonb_build_array(
        'undefined_contact_contract','no_exact_reviewed_media'),
      'supportSummary','Retirement is deliberate; do not silently map the source to a direction-specific survivor.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'linePogoIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name=CASE definition.id WHEN lateral_id
      THEN 'Two-Foot Lateral Line Pogo'
      ELSE 'Two-Foot Forward-Backward Line Pogo' END,
    display_name=CASE definition.id WHEN lateral_id
      THEN 'Two-Foot Lateral Line Pogo'
      ELSE 'Two-Foot Forward-Backward Line Pogo' END,
    description=CASE definition.id WHEN lateral_id THEN
      'A repeated low-amplitude bilateral pogo in which both feet take off and land together while crossing side-to-side over a visible floor line; every bilateral landing is one contact and the set ends in a controlled two-foot stop.'
      ELSE 'A repeated low-amplitude bilateral pogo in which both feet take off and land together while crossing forward and backward over a visible floor line; every bilateral landing is one contact and the set ends in a controlled two-foot stop.' END,
    family_key='bilateral_directional_line_pogo',
    aliases=ARRAY(SELECT DISTINCT alias_value FROM unnest(
      coalesce(definition.aliases,'{}')||CASE definition.id WHEN lateral_id
        THEN ARRAY['Two Foot Lateral Line Pogo','Bilateral Lateral Line Pogos']
        ELSE ARRAY['Two Foot Forward Backward Line Pogo','Bilateral Forward Backward Line Pogos'] END
      ) alias_value ORDER BY alias_value),
    content_confidence=94,scoring_confidence=72,media_confidence=58,
    movement_patterns=ARRAY['jump','land'],
    body_regions=ARRAY['foot','ankle','lower_leg','knee','hip','core'],
    required_equipment=ARRAY['line_tape'],
    optional_equipment=ARRAY['jump_mat','timer'],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'visible_floor_line','level_high_traction_resilient_surface',
        'clear_landing_area_on_both_sides','safe_footwear','no_cross_traffic'),
      'direction',CASE definition.id WHEN lateral_id
        THEN 'side_to_side_across_line' ELSE 'forward_backward_across_line' END,
      'minimumClearance','declared_amplitude_plus_fall_and_stop_space',
      'groupLayout',jsonb_build_object(
        'oneAthletePerLineZone',TRUE,'coachSightlineRequired',TRUE)),
    population_json=jsonb_build_object(
      'requires',jsonb_build_array(
        'pain_free_bilateral_takeoff_and_landing','controlled_low_amplitude_pogo',
        'ability_to_stop_on_command','tolerance_for_planned_impact_contacts'),
      'screen',jsonb_build_array(
        'current_lower_limb_pain','recent_ankle_knee_hip_injury',
        'Achilles_or_plantar_irritability','dizziness_or_balance_concern',
        'accumulated_jump_and_running_contacts'),
      'individualize',jsonb_build_array(
        'contacts','amplitude','rhythm','rest','surface','session_impact_budget'),
      'notMedicalClearance','Symptoms or return-to-sport restrictions require the appropriate clinician or policy process.'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'soleus','gastrocnemius','intrinsic_foot_muscles','fibularis_group'),
      'secondaryMuscles',jsonb_build_array(
        'tibialis_anterior','quadriceps','hamstrings','gluteal_group',
        'hip_adductors_abductors','trunk_stabilizers'),
      'joints',jsonb_build_array(
        'metatarsophalangeal','talocrural','subtalar','knee','hip','lumbopelvic'),
      'jointActions',CASE definition.id WHEN lateral_id THEN jsonb_build_array(
        'bilateral_plantarflexion_dorsiflexion_cycle','small_knee_flexion_extension',
        'small_hip_flexion_extension','frontal_plane_foot_ankle_knee_hip_stabilization',
        'trunk_postural_control') ELSE jsonb_build_array(
        'bilateral_plantarflexion_dorsiflexion_cycle','small_knee_flexion_extension',
        'small_hip_flexion_extension','sagittal_plane_propulsion_and_braking',
        'frontal_plane_alignment_control','trunk_postural_control') END,
      'planes',CASE definition.id WHEN lateral_id
        THEN jsonb_build_array('frontal_primary','sagittal_vertical_contact','transverse_stabilization')
        ELSE jsonb_build_array('sagittal_primary','frontal_stabilization','transverse_stabilization') END,
      'laterality','bilateral_simultaneous'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Builds repeatable bilateral elastic contacts while the feet and trunk control a small direction change.',
      'primaryCue',CASE definition.id WHEN lateral_id
        THEN 'Stay tall and spring both feet together side to side over the line.'
        ELSE 'Stay tall and spring both feet together forward and back over the line.' END,
      'expectedSensations',jsonb_build_array(
        'light_quick_calf_and_foot_work','brief_repeatable_contacts','low_amplitude_effort'),
      'unexpectedSensations',jsonb_build_array(
        'pain','joint_pinching','Achilles_or_plantar_pain','instability','numbness','dizziness'),
      'painGuidance','Stop immediately for symptoms, unsafe contacts, or loss of control; do not push through pain.',
      'selfChecks',jsonb_build_array(
        'both feet leave and land together','every landing clears the line',
        'contacts stay quiet and similar','posture stays tall','finish is controlled'),
      'accessibility',jsonb_build_array(
        'lower_amplitude','fewer_contacts','longer_rest','wider_visible_line',
        'in_place_bilateral_pogo_substitution_after_review',
        'text_still_image_audio_or_live_instruction'),
      'mediaAlternatives',jsonb_build_array(
        'step_sequence','contact_count_diagram','coach_demonstration')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'line_clearance','simultaneous_feet','contact_count','amplitude','rhythm',
        'posture','direction_drift','foot_knee_hip_alignment','symptoms','finish'),
      'faultCorrections',jsonb_build_array(
        'Reduce amplitude or contacts when rhythm, alignment, or quiet contact changes.',
        'Use a clearer line and slower declared rhythm when crossings are inconsistent.',
        'End the set rather than converting the task into fatigued conditioning.'),
      'demonstrationPlan',jsonb_build_array(
        'Show the exact direction and one counted contact.',
        'Show both feet crossing and landing together.',
        'Show the final controlled stop.'),
      'groupManagement',jsonb_build_object(
        'oneAthletePerLineZone',TRUE,'coachSightlineRequired',TRUE,
        'startStopSignalRequired',TRUE,'contactBudgetTracked',TRUE),
      'modificationDecisionTree',jsonb_build_object(
        'quality_loss','reduce_contacts_or_amplitude_and_increase_rest',
        'cannot_clear_line','use_wider_visible_target_or_in_place_reviewed_substitute',
        'symptoms','stop_and_follow_support_or_clinical_process'),
      'doNotUseWhen',jsonb_build_array(
        'pain_or_instability','unsafe_surface_or_space','cannot_land_bilaterally',
        'impact_budget_exhausted','coach_cannot_monitor_required_group_zone')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','equipment','surface','dose','impact','symptoms','media','accessibility'),
      'supportEscalation',jsonb_build_object(
        'coachReview',jsonb_build_array(
          'direction_or_contact_unit_unclear','repeated_quality_failure','substitution_needed'),
        'contentReview',jsonb_build_array(
          'source_conflict','media_mismatch','taxonomy_or_score_dispute'),
        'urgent',jsonb_build_array('injury_event','unsafe_surface_or_collision')),
      'retentionPolicy','Retain exact variant, surface, contacts, amplitude, rest, symptoms, substitutions, and stop reason with the workout version.',
      'changeImpactPolicy','Direction, foot count, crossing, contact strategy, contact unit, and finish changes require identity review and versioned workout revalidation.',
      'knownLimitations',jsonb_build_array(
        'candidate_media_not_human_approved','difficulty_not_independently_calibrated'),
      'supportSummary','Never silently swap direction, laterality, contact strategy, or terminal action.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'linePogoIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','complete_exact_direction_specific_survivor',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=ANY(survivor_ids);

  INSERT INTO coaching.exercise_variant_v1(
    definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT seed.definition_id,seed.variant_key,seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',seed.complexity,'absoluteLoadDemand',seed.physical,
      'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
      'coordinationDemand',seed.complexity+4,'supervisionDemand',42,
      'failureConsequence',50,'impact',3,'workCapacityDemand',44,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty'),
      'athleteProficiencyExcluded',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base','bilateral_upright_low_amplitude_pogo',
      'footCount',2,'laterality','bilateral_simultaneous',
      'target','visible_floor_line','direction',seed.direction,
      'lineCrossing','both_feet_clear_line_on_every_contact',
      'contactStrategy','short_repeatable_low_amplitude_stretch_shortening_cycle',
      'contactAccounting','one_contact_equals_one_bilateral_landing_after_crossing',
      'repetitionCycle','out_and_back_equals_two_contacts',
      'terminalAction','controlled_two_foot_stop_after_declared_contacts',
      'surface','level_high_traction_resilient',
      'equipmentRequired',jsonb_build_array('line_tape')),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight','impactLevel',3,'landingContactsPerRep',2,
      'exposureMetric','total_bilateral_landing_contacts',
      'loadTracking',jsonb_build_array(
        'contacts','sets','amplitude','set_duration','rest','surface',
        'contact_quality','symptoms'),
      'doNotInfer',jsonb_build_array(
        'force_threshold','contact_time_threshold','injury_risk_prediction')),
    jsonb_build_object(
      'localMuscleFatigue',48,'tendonLoadSensitivity',58,
      'technicalFatigueSensitivity',60,'impactAccumulation',52,
      'recoveryHours',24,
      'primaryFatigueSites',jsonb_build_array(
        'foot_intrinsics','calves','Achilles_tendon','plantar_tissues',
        'quadriceps','hip_stabilizers'),
      'stopBefore',jsonb_build_array(
        'pain_or_instability','Achilles_or_plantar_symptoms','line_contact',
        'asymmetric_or_separated_feet','alignment_loss','rising_contact_time',
        'lost_rhythm','unsafe_surface_or_traffic')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'bilateral_elastic_contact_quality','direction_specific_foot_ankle_control',
        'reactive_strength_support','postural_control'),
      'stimulusDose',jsonb_build_object(
        'primary','quality_bilateral_landing_contacts','fatigueCeiling','low'),
      'weeklyExposure',jsonb_build_object(
        'typical',1,'maximumWithoutReview',3,'allPlyometricContactsCount',TRUE),
      'prerequisites',jsonb_build_array(
        'pain_free_bilateral_pogo','stable_two_foot_landing',
        'safe_surface_and_line_zone','ability_to_stop_on_command'),
      'completionCriteria',jsonb_build_array(
        'both_feet_cross_and_land_together','declared_contacts_counted',
        'quiet_repeatable_low_amplitude_contacts','direction_and_posture_maintained',
        'controlled_finish'),
      'sequenceRules',jsonb_build_array(
        'after_specific_warmup','while_fresh','before_heavy_lower_body_fatigue',
        'before_dense_conditioning'),
      'pairingCompatibility',jsonb_build_object(
        'preferred',jsonb_build_array('upper_body_strength','low_fatigue_mobility'),
        'avoid',jsonb_build_array('dense_running_jumping_or_calf_fatigue')),
      'interferenceRules',jsonb_build_array(
        'counts_toward_jump_landing_calf_Achilles_plantar_and_neural_budgets'),
      'uncertaintyPolicy',jsonb_build_object(
        'direction_or_contact_unit_unclear','do_not_start',
        'surface_or_symptoms_unclear','stop_and_review'),
      'cumulativeBudget',jsonb_build_object(
        'landingContacts','count_every_bilateral_landing',
        'technicalSensitivity',60,'impactLevel',3))
  FROM(VALUES
    (lateral_id,'two-foot-side-to-side-low-amplitude',
      'Two-Foot Lateral Line Pogo — Low Amplitude',
      ARRAY['bilateral','lateral','line_crossing','low_amplitude','repeated'],
      'lateral_side_to_side',44,48),
    (forward_id,'two-foot-forward-back-low-amplitude',
      'Two-Foot Forward-Backward Line Pogo — Low Amplitude',
      ARRAY['bilateral','forward_backward','line_crossing','low_amplitude','repeated'],
      'forward_backward',46,48)
  ) seed(definition_id,variant_key,display_name,modifier_keys,direction,complexity,physical)
  ON CONFLICT(definition_id,variant_key) DO UPDATE SET
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  SELECT id INTO lateral_variant_id FROM coaching.exercise_variant_v1
  WHERE definition_id=lateral_id
    AND variant_key='two-foot-side-to-side-low-amplitude';
  SELECT id INTO forward_variant_id FROM coaching.exercise_variant_v1
  WHERE definition_id=forward_id
    AND variant_key='two-foot-forward-back-low-amplitude';
  IF lateral_variant_id IS NULL OR forward_variant_id IS NULL THEN
    RAISE EXCEPTION '% failed to create exact survivor variants',migration_key;
  END IF;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,profile.profile_key,profile.phase_key,profile.role,
    CASE definition.id WHEN lateral_id
      THEN profile.purpose_lateral ELSE profile.purpose_forward END,
    profile.suitability,profile.alignment,profile.objectives,profile.dosage,
    'Both feet cross and land together, contacts are quiet and counted, amplitude and direction remain declared, posture stays tall, and the set ends in a controlled two-foot stop.',
    ARRAY[
      'Stop for pain, instability, numbness, dizziness, Achilles or plantar symptoms.',
      'Stop for repeated line contact, separated or asymmetric feet, alignment loss, rising contact time, lost rhythm, or direction drift.',
      'Stop when the surface, landing zone, traffic boundary, or remaining impact budget is unsafe.'],
    'Verify line, surface, zone, footwear, direction, contact unit, contacts, amplitude, rest, accumulated impact, symptoms, and stop signal. Count every bilateral landing and end at the first failed quality gate.',
    CASE definition.id WHEN lateral_id
      THEN 'Stand beside the line, stay tall, spring both feet together side to side, count every landing, and finish balanced on two feet.'
      ELSE 'Stand behind the line, stay tall, spring both feet together forward and back, count every landing, and finish balanced on two feet.' END,
    profile.adaptation,ARRAY['line_tape'],
    jsonb_build_object(
      'stationSeconds',180,'athletesPerStation',1,'setupSeconds',30,
      'transitionSeconds',30,'oneAthletePerLineZone',TRUE,
      'clearLandingAreaBothSides',TRUE,'coachSightlineRequired',TRUE),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'secondsPerContact',jsonb_build_object('minimum',0.35,'maximum',1.2),
      'setSeconds',jsonb_build_object('minimum',4,'maximum',20),
      'restSeconds',profile.dosage->'restSeconds',
      'durationInputs',jsonb_build_array(
        'contacts','declared_rhythm','set_stop_time','rest','setup','transition')),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'reduce_contacts','reduce_amplitude','slow_declared_rhythm',
        'increase_rest','use_reviewed_in_place_substitute'),
      'progressOrder',jsonb_build_array(
        'stabilize_each_contact','complete_declared_contacts',
        'increase_contacts_within_cap','increase_amplitude_only_after_review'),
      'changeOneVariableAtATime',TRUE,
      'neverChangeSilently',jsonb_build_array(
        'direction','foot_count','line_crossing','contact_strategy','terminal_action')),
    jsonb_build_object(
      'primary','completed_quality_bilateral_landing_contacts',
      'record',jsonb_build_array(
        'direction','contacts','sets','amplitude','set_duration','rest',
        'surface','quality_failures','symptoms','stop_reason'),
      'failedContactPolicy','do_not_count_and_end_or_regress'),
    jsonb_build_object(
      'before',jsonb_build_array(
        'Confirm direction, line, surface, zone, footwear, contacts, amplitude, rest, and remaining impact budget.',
        'Report lower-limb symptoms, dizziness, or instability before starting.'),
      'during',jsonb_build_array(
        'Call contact count, alignment, rhythm, and stop immediately when a gate fails.'),
      'after',jsonb_build_array(
        'Record contacts, quality, symptoms, stop reason, and next-session response.'))
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=CASE definition.id WHEN lateral_id
        THEN 'two-foot-side-to-side-low-amplitude'
        ELSE 'two-foot-forward-back-low-amplitude' END
  CROSS JOIN(VALUES
    ('output-elastic-quality','output','primary',
      'Build crisp bilateral lateral elastic contacts and frontal-plane line control.',
      'Build crisp bilateral forward-back elastic contacts and sagittal line control.',
      90,90,'{"reactive_strength":92,"movement_quality":88,"directional_control":88}'::JSONB,
      '{"volumeUnit":"bilateral_landing_contacts","sets":{"minimum":2,"maximum":4},"contactsPerSet":{"minimum":8,"maximum":20},"restSeconds":{"minimum":60,"maximum":150},"effort":"crisp_low_fatigue_contacts_only"}'::JSONB,
      'Improved repeatable elastic contact quality and direction-specific control.'),
    ('prepare-contact-rhythm','prepare_and_access','secondary',
      'Rehearse low-amplitude lateral line clearance and bilateral contact rhythm before later work.',
      'Rehearse low-amplitude forward-back line clearance and bilateral contact rhythm before later work.',
      78,84,'{"movement_quality":90,"reactive_strength":72,"readiness":86}'::JSONB,
      '{"volumeUnit":"bilateral_landing_contacts","sets":{"minimum":1,"maximum":3},"contactsPerSet":{"minimum":6,"maximum":12},"restSeconds":{"minimum":45,"maximum":120},"effort":"submaximal_rehearsal_without_fatigue"}'::JSONB,
      'Improved readiness, line awareness, and bilateral contact rhythm.')
  ) profile(profile_key,phase_key,role,purpose_lateral,purpose_forward,
      suitability,alignment,objectives,dosage,adaptation)
  WHERE definition.id=ANY(survivor_ids)
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
  SELECT definition.id,2,section.section_key,source.source_url,
    source.source_title,source.source_publisher,source.source_kind,
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_array(
      'Candidate evidence documents why '||section.section_key||
        ' cannot be assigned to a source missing an exact direction, foot count, line-crossing, contact-strategy, contact-unit, or finish contract.',
      'The source is archived and nonselectable; no mapping, score, dosage, graph, calibration, media, or publication approval is created.')
    ELSE jsonb_build_array(
      'Candidate evidence was reassessed for exact bilateral low-amplitude line crossing, direction, contact accounting, controlled finish, surface, dose, cumulative impact, support, and stop rules in section '||section.section_key||'.',
      'Difficulty contains exercise complexity and physical difficulty only; all media, graph, calibration, card, and publication approvals remain human work.') END,
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
      WHEN section.section_key IN('identity','difficulty','alternates') THEN 'https://pubmed.ncbi.nlm.nih.gov/17544325/'
      WHEN section.section_key IN('anatomy','biomechanics','instructions') THEN 'https://pubmed.ncbi.nlm.nih.gov/17367931/'
      WHEN section.section_key='coach_support' THEN 'https://pubmed.ncbi.nlm.nih.gov/15088239/'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'https://pubmed.ncbi.nlm.nih.gov/38040837/'
      WHEN section.section_key IN('taxonomy','programming') THEN 'https://pubmed.ncbi.nlm.nih.gov/36906633/'
      ELSE 'https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati' END source_url,
    CASE
      WHEN section.section_key='media' THEN 'Embed videos and playlists'
      WHEN section.section_key IN('identity','difficulty','alternates') THEN 'Jump-landing direction influences dynamic postural stability scores'
      WHEN section.section_key IN('anatomy','biomechanics','instructions') THEN 'Changes in muscle activity with increase in leg stiffness during hopping'
      WHEN section.section_key='coach_support' THEN 'A simple method for field measurements of leg stiffness in hopping'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'Maximizing plyometric training for adolescents: a meta-analysis of ground contact frequency and overall intervention time on jumping ability'
      WHEN section.section_key IN('taxonomy','programming') THEN 'Effects of Plyometric Jump Training on the Reactive Strength Index in Healthy Individuals Across the Lifespan'
      ELSE 'Plyometrics for Beginners: Basic Considerations' END source_title,
    CASE
      WHEN section.section_key='media' THEN 'YouTube Help'
      WHEN section.section_key IN('identity','difficulty','alternates') THEN 'Journal of Science and Medicine in Sport'
      WHEN section.section_key IN('anatomy','biomechanics','instructions') THEN 'Neuroscience Letters'
      WHEN section.section_key='coach_support' THEN 'International Journal of Sports Medicine'
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 'Scientific Reports'
      WHEN section.section_key IN('taxonomy','programming') THEN 'Sports Medicine'
      ELSE 'World Athletics' END source_publisher,
    CASE WHEN section.section_key='media' THEN 'manufacturer_instruction'
      WHEN section.section_key IN('constraints','safety_stop_rules','athlete_support','accessibility') THEN 'professional_standard'
      ELSE 'peer_reviewed_research' END source_kind,
    CASE WHEN section.section_key='media' THEN 82
      WHEN section.section_key IN('load_fatigue_recovery','dosage') THEN 94
      WHEN section.section_key IN('taxonomy','programming') THEN 94
      WHEN section.section_key IN('identity','difficulty','alternates') THEN 88
      WHEN section.section_key IN('anatomy','biomechanics','instructions') THEN 88
      WHEN section.section_key='coach_support' THEN 86
      ELSE 86 END::SMALLINT quality
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
  SELECT definition.id,NULL,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel_name,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,NULL,
    media.notes
  FROM(VALUES
    ('lateral-line-pogo','Jiukp-0mUIA','Lateral Line Hops','Travis Goyeneche','two foot lateral line pogo hops','oEmbed metadata verified 2026-08-01T19:00:00Z. Exact foot count, crossing, quality, safety, accessibility, reviewer, and approval remain unresolved.'),
    ('lateral-line-pogo','mebZeogvli8','Lateral Line Hops - THIRSTgym.com','Brandon Smitley','lateral line hops','oEmbed metadata verified 2026-08-01T19:00:00Z. All human review gates remain unresolved.'),
    ('lateral-line-pogo','ZHg88_EYQ74','Lateral Line Hops – Speed, Agility & Footwork','Train With Cuz','lateral line hops','oEmbed metadata verified 2026-08-01T19:00:00Z. All human review gates remain unresolved.'),
    ('lateral-line-pogo','1MNy6YuN07s','How to Do a Lateral Side Jump | Plyometric Exercises','Howcast','lateral line jump','Adjacent lateral-jump candidate without an exact line-pogo title; no exact-match decision.'),
    ('lateral-line-pogo','llCzJrYwdsk','Rudiment Single Leg Pogo Lateral Line Hops','Block Fitness','lateral line pogo','Explicit single-leg contrast candidate; it is not evidence of a bilateral exact match.'),
    ('line-pogo-forward-back','EUwK9NIz2Bw','Forward / backward pogos','Functional Empowered Fitness, LLC','forward backward pogos','oEmbed metadata verified 2026-08-01T19:00:00Z. Exact-title candidate; all human gates remain unresolved.'),
    ('line-pogo-forward-back','G01Ng_RbFIQ','Forward/ Backward Pogos','Dr. Tyler Centner','forward backward pogos','oEmbed metadata verified 2026-08-01T19:00:00Z. Exact-title candidate; all human gates remain unresolved.'),
    ('line-pogo-forward-back','S_gK1MLb9BQ','Line Hops Front To Back','Elite Performance Institute','line hops front to back','Direction-specific candidate; exact pogo strategy and all human gates remain unresolved.'),
    ('line-pogo-forward-back','MFmanwtYKiw','Forward Pogo Hops (Exercise Library)','Horton Barbell','forward pogo hops','Forward-only adjacent candidate; it does not establish backward crossings or the complete set contract.'),
    ('line-pogo-forward-back','j0nl5dWuqN4','Pogo Jumps Tutorial - Proper Form and Technique','Runna','pogo jumps tutorial','Generic pogo candidate without a line or direction; adjacent evidence only.'),
    ('line-pogo-hops','cQ9JP36zIq4','Pogo Jumps | Ankle Hops','Sports Rehab Expert','line pogo hops','Generic pogo candidate without a line direction or crossing contract.'),
    ('line-pogo-hops','Jiukp-0mUIA','Lateral Line Hops','Travis Goyeneche','line pogo hops','One lateral interpretation; it cannot be imported into the generic source.'),
    ('line-pogo-hops','S_gK1MLb9BQ','Line Hops Front To Back','Elite Performance Institute','line pogo hops','One forward-back interpretation; it cannot be imported into the generic source.'),
    ('line-hops','Jiukp-0mUIA','Lateral Line Hops','Travis Goyeneche','line hops','Lateral interpretation only; not proof of the generic source.'),
    ('line-hops','S_gK1MLb9BQ','Line Hops Front To Back','Elite Performance Institute','line hops','Forward-back interpretation only; not proof of the generic source.'),
    ('line-hops','dJI2q9TPdig','Jr. NBA at Home: Line Hops Drill','Jr. NBA Jr. WNBA','line hops drill','Generic title does not resolve direction, foot count, crossing, or contact strategy.'),
    ('forward-back-line-hops','S_gK1MLb9BQ','Line Hops Front To Back','Elite Performance Institute','forward back line hops','Direction-specific title does not establish foot count, pogo strategy, contacts, or finish.'),
    ('forward-back-line-hops','Jiukp-0mUIA','Lateral Line Hops','Travis Goyeneche','forward back line hops','Conflicting lateral interpretation; adjacent evidence only.'),
    ('forward-back-line-hops','ZHg88_EYQ74','Lateral Line Hops – Speed, Agility & Footwork','Train With Cuz','forward back line hops','Conflicting lateral interpretation; adjacent evidence only.')
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
  SELECT definition.id,2,alternate.alternate_name,alternate.classification,
    alternate.rationale,alternate.dimensions,
    CASE WHEN alternate.classification='new_definition' THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    ('lateral-line-pogo','Two-Foot Forward-Backward Line Pogo','new_definition','Sagittal travel changes direction-specific stabilization and line relationship.','{"direction":"forward_backward"}'::JSONB),
    ('lateral-line-pogo','Single-Leg Lateral Line Pogo','new_definition','One-leg contacts change laterality, impact distribution, balance, and side dosage.','{"footCount":1}'::JSONB),
    ('lateral-line-pogo','Alternating-Foot Lateral Line Hop','new_definition','Alternating contacts create a different ordered gait and repetition boundary.','{"contactSequence":"alternating"}'::JSONB),
    ('lateral-line-pogo','Lateral Line Hop to Stick','new_definition','A discrete flight and terminal hold differ from repeated elastic contacts.','{"terminalAction":"stick"}'::JSONB),
    ('lateral-line-pogo','Reactive-Cue Lateral Line Pogo','new_variant','A live direction cue adds perception and response demand after the bilateral identity is fixed.','{"cue":"live_external"}'::JSONB),
    ('lateral-line-pogo','Weighted Lateral Line Pogo','new_variant','External load changes impact, fatigue, and failure consequence.','{"externalLoad":"declared"}'::JSONB),
    ('lateral-line-pogo','Lateral Hurdle Pogo','new_definition','A raised obstacle changes clearance, amplitude, equipment, and failure consequence.','{"obstacle":"raised_hurdle"}'::JSONB),
    ('lateral-line-pogo','Line Width, Starting Side, Contacts, Amplitude, Duration, or Rest','modifier_annotation','These scale delivery only after exact identity is selected.','{"modifiers":["line_width","starting_side","contacts","amplitude","duration","rest"]}'::JSONB),
    ('line-pogo-forward-back','Two-Foot Lateral Line Pogo','new_definition','Frontal-plane travel changes direction-specific stabilization.','{"direction":"lateral"}'::JSONB),
    ('line-pogo-forward-back','Single-Leg Forward-Backward Line Pogo','new_definition','One-leg contacts change laterality, balance, impact distribution, and side dosage.','{"footCount":1}'::JSONB),
    ('line-pogo-forward-back','Forward-Only Traveling Pogos','new_definition','Continuous forward travel has no alternating line-crossing cycle.','{"direction":"forward_only","travel":"continuous"}'::JSONB),
    ('line-pogo-forward-back','Forward-Back Line Hop to Stick','new_definition','A discrete hop and terminal hold differ from repeated elastic crossings.','{"terminalAction":"stick"}'::JSONB),
    ('line-pogo-forward-back','Reactive-Cue Forward-Back Line Pogo','new_variant','Live cue timing adds response demand after exact bilateral identity is fixed.','{"cue":"live_external"}'::JSONB),
    ('line-pogo-forward-back','Weighted Forward-Back Line Pogo','new_variant','External load changes impact, fatigue, and failure consequence.','{"externalLoad":"declared"}'::JSONB),
    ('line-pogo-forward-back','Forward-Back Hurdle Pogo','new_definition','A raised obstacle changes clearance, amplitude, equipment, and failure consequence.','{"obstacle":"raised_hurdle"}'::JSONB),
    ('line-pogo-forward-back','Line Width, Starting Side, Contacts, Amplitude, Duration, or Rest','modifier_annotation','These scale delivery only after exact identity is selected.','{"modifiers":["line_width","starting_side","contacts","amplitude","duration","rest"]}'::JSONB),
    ('line-pogo-hops','Two-Foot Lateral Line Pogo','same_identity','Possible only if authoritative evidence establishes side-to-side crossings.','{"possibleMapping":"lateral-line-pogo","requiredFacts":["lateral","cross_line"]}'::JSONB),
    ('line-pogo-hops','Two-Foot Forward-Backward Line Pogo','same_identity','Possible only if authoritative evidence establishes forward-back crossings.','{"possibleMapping":"line-pogo-forward-back","requiredFacts":["forward_backward","cross_line"]}'::JSONB),
    ('line-pogo-hops','In-Place Two-Foot Pogo Beside a Line','new_definition','A line that is not crossed is not a directional line-hop task.','{"lineCrossing":false}'::JSONB),
    ('line-pogo-hops','Single-Leg Line Pogo','new_definition','One-leg contacts change laterality and impact distribution.','{"footCount":1}'::JSONB),
    ('line-pogo-hops','Alternating Line Hop','new_definition','Alternating feet change the ordered contact pattern.','{"contactSequence":"alternating"}'::JSONB),
    ('line-pogo-hops','Line Hop to Stick','new_definition','Terminal stabilization changes the repetition boundary.','{"terminalAction":"stick"}'::JSONB),
    ('line-pogo-hops','Line Width, Contacts, Amplitude, Duration, or Rest','modifier_annotation','These become modifiers only after direction, crossing, foot count, and finish are fixed.','{"modifiers":["line_width","contacts","amplitude","duration","rest"]}'::JSONB),
    ('line-hops','Two-Foot Lateral Line Pogo','same_identity','Possible only with authoritative bilateral lateral-pogo evidence.','{"possibleMapping":"lateral-line-pogo"}'::JSONB),
    ('line-hops','Two-Foot Forward-Backward Line Pogo','same_identity','Possible only with authoritative bilateral forward-back-pogo evidence.','{"possibleMapping":"line-pogo-forward-back"}'::JSONB),
    ('line-hops','Single-Leg Lateral Line Hops','new_definition','Laterality and side dose differ.','{"footCount":1,"direction":"lateral"}'::JSONB),
    ('line-hops','Alternating-Foot Line Hops','new_definition','Ordered alternating contacts differ from bilateral landings.','{"contactSequence":"alternating"}'::JSONB),
    ('line-hops','Deep Brake-and-Pop Line Hops','new_definition','A deeper countermovement and braking strategy differs from stiff low-amplitude pogos.','{"contactStrategy":"brake_and_pop"}'::JSONB),
    ('line-hops','Line Hop to Stick','new_definition','A discrete contact ending in stabilization differs from continuous elastic contacts.','{"terminalAction":"stick"}'::JSONB),
    ('line-hops','Line Width, Contacts, Amplitude, Duration, or Rest','modifier_annotation','These become modifiers only after the movement contract is fixed.','{"modifiers":["line_width","contacts","amplitude","duration","rest"]}'::JSONB),
    ('forward-back-line-hops','Two-Foot Forward-Backward Line Pogo','same_identity','Possible only if evidence establishes bilateral stiff contacts crossing the line and a controlled finish.','{"possibleMapping":"line-pogo-forward-back","requiredFacts":["two_foot","pogo","cross_line","controlled_finish"]}'::JSONB),
    ('forward-back-line-hops','Single-Leg Forward-Backward Line Hops','new_definition','Unilateral contacts change laterality and side dosage.','{"footCount":1}'::JSONB),
    ('forward-back-line-hops','Alternating Forward-Back Line Hops','new_definition','Alternating contacts create a different gait and repetition unit.','{"contactSequence":"alternating"}'::JSONB),
    ('forward-back-line-hops','Forward-Back Brake-and-Pop to Reacceleration','new_definition','A deeper braking contact and sprint exit form an agility transition.','{"contactStrategy":"brake_and_pop","terminalAction":"reacceleration"}'::JSONB),
    ('forward-back-line-hops','Forward-Back Line Hop to Stick','new_definition','A terminal hold differs from repeated elastic contacts.','{"terminalAction":"stick"}'::JSONB),
    ('forward-back-line-hops','Forward-Only Traveling Pogos','new_definition','Continuous travel lacks the out-and-back crossing cycle.','{"direction":"forward_only"}'::JSONB),
    ('forward-back-line-hops','Line Width, Contacts, Amplitude, Duration, or Rest','modifier_annotation','These become modifiers only after foot count, crossing, strategy, and finish are fixed.','{"modifiers":["line_width","contacts","amplitude","duration","rest"]}'::JSONB)
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
    (lateral_variant_id,forward_variant_id,'lateral_substitution',70,
      ARRAY['direction','plane','line_relationship','stabilization'],
      'Both variants preserve bilateral low-amplitude repeated line-crossing contacts and contact accounting, but lateral versus forward-back direction changes plane-specific control and cannot be swapped silently.',
      '{"useWhen":["session_goal_allows_direction_change","exact_substitute_is_reviewed","impact_budget_revalidated"],"notEquivalentFor":["direction_specific_adaptation","direction_specific_assessment"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (forward_variant_id,lateral_variant_id,'lateral_substitution',70,
      ARRAY['direction','plane','line_relationship','stabilization'],
      'Both variants preserve bilateral low-amplitude repeated line-crossing contacts and contact accounting, but forward-back versus lateral direction changes plane-specific control and cannot be swapped silently.',
      '{"useWhen":["session_goal_allows_direction_change","exact_substitute_is_reviewed","impact_budget_revalidated"],"notEquivalentFor":["direction_specific_adaptation","direction_specific_assessment"]}'::JSONB,
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
        'Candidate exercise-complexity anchor based on bilateral timing, exact direction, line crossing, simultaneous feet, contact accounting, posture, rhythm, alignment, and controlled finish; independent human calibration is required.'
      ELSE
        'Candidate physical-difficulty anchor based on repeated bodyweight impact, plantar-flexor and foot demand, contact volume, amplitude, surface, accumulated plyometric exposure, and recovery; independent human calibration is required.'
    END,'review',1,NULL,NULL,
    'No score approval is created by migration 431.',NULL
  FROM(VALUES
    (lateral_variant_id,44,48),
    (forward_variant_id,46,48)
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
      ' Migration 431 archives the unresolved source',
      1
    )||' Migration 431 archives the unresolved source without direct consolidation and completes separate bilateral lateral and forward-back survivors. Reactivation or mapping still requires authoritative missing identity facts and qualified human review.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'retirementMigration',migration_key,
        'resolution','retire_ambiguous_source_without_direct_consolidation',
        'exactSurvivors',jsonb_build_array(
          'lateral-line-pogo','line-pogo-forward-back'),
        'humanReviewStillRequiredForSourceMapping',TRUE,
        'approvalCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.decision='needs_human_review'
    AND resolution.reviewed_by IS NULL
    AND resolution.survivor_definition_id=ANY(all_ids)
    AND resolution.resolved_definition_id=ANY(all_ids);

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,lateral_id,forward_id,'distinct_exercises',
    'The lateral survivor crosses a line side to side and requires frontal-plane displacement control. The forward-back survivor crosses the line in the sagittal direction. Direction and plane-specific propulsion, braking, stabilization, line relationship, and session intent are identity-bearing rather than dosage aliases.',
    jsonb_build_object(
      'identityBoundary','bilateral_lateral_line_pogo_vs_bilateral_forward_backward_line_pogo',
      'sharedContract',jsonb_build_array(
        'two_foot','bilateral_simultaneous','low_amplitude','repeated_contacts',
        'line_crossing','one_contact_per_bilateral_landing','controlled_finish'),
      'differingDimension','direction',
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
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
  SET name=CASE exercise.id
      WHEN 267 THEN 'Line Pogo Hops (Unresolved Legacy)'
      WHEN 269 THEN 'Forward-Back Line Hops (Unresolved Legacy)'
      ELSE 'Line Hops (Unresolved Legacy)' END,
    description='Archived nonprescribable line-hop source. Exact direction, crossing, foot count, contact strategy, contact accounting, cadence, and/or terminal action are not jointly established.',
    instructions='Do not prescribe from this source. Select an exact lateral, forward-back, single-leg, alternating, or terminal-stick card.',
    card_summary='Archived nonprescribable identity; retained for source traceability.',
    coach_language='Choose an exact replacement. Do not infer direction, foot count, crossing, contact strategy, contact unit, or finish.',
    athlete_language='This card is unavailable because its exact contact pattern is not fully defined.',
    programming_logic=jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'replacementPolicy','choose_exact_line_pogo_or_line_hop',
      'difficultyStatus','blocked_pending_exact_identity'),
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'missingIdentityDimensions',jsonb_build_array(
        'direction','line_crossing','foot_count','contact_strategy',
        'contact_accounting','cadence','terminal_action')),
    coaching_execution=jsonb_build_object(
      'selectionBlocked',TRUE,
      'supportMessage','Open an exact replacement card before setup or instruction.'),
    skill_level=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(267,269,714);

  UPDATE coaching.exercise exercise
  SET skill_level=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,
    programming_logic=coalesce(exercise.programming_logic,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'sourceAliasArchived',TRUE,
        'canonicalSurvivor',CASE WHEN exercise.id IN(137,268)
          THEN 'lateral-line-pogo' ELSE 'line-pogo-forward-back' END,
        'selectionPolicy','use_canonical_exact_survivor'),
    updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(136,137,268,1110);

  UPDATE coaching.exercise exercise
  SET name=CASE exercise.id WHEN 1083 THEN 'Two-Foot Lateral Line Pogo'
      ELSE 'Two-Foot Forward-Backward Line Pogo' END,
    description=CASE exercise.id WHEN 1083 THEN
      'Both feet repeatedly take off and land together while crossing side to side over a visible line; every bilateral landing is one contact and the set ends in a controlled two-foot stop.'
      ELSE 'Both feet repeatedly take off and land together while crossing forward and backward over a visible line; every bilateral landing is one contact and the set ends in a controlled two-foot stop.' END,
    instructions=CASE exercise.id WHEN 1083 THEN
      'Declare contacts, amplitude, rest, surface, and stop signal. Stay tall, spring both feet together side to side across the line, count every landing, and stop balanced on two feet.'
      ELSE 'Declare contacts, amplitude, rest, surface, and stop signal. Stay tall, spring both feet together forward and back across the line, count every landing, and stop balanced on two feet.' END,
    default_sets=3,default_reps=NULL,default_work_seconds=10,
    default_rest_seconds=75,tempo='crisp_repeatable_contacts',
    load_note='Bodyweight only; reduce contacts or amplitude before adding fatigue. Count all jump and landing exposure.',
    est_seconds_per_set=90,skill_level=NULL,is_published=TRUE,archived=FALSE,
    card_summary='Exact bilateral direction-specific line pogo with contact accounting, cumulative impact budget, and controlled finish.',
    coach_language='Verify line, surface, direction, simultaneous feet, every counted landing, posture, rhythm, alignment, symptoms, remaining impact budget, and controlled finish.',
    athlete_language=CASE exercise.id WHEN 1083
      THEN 'Stay tall and spring both feet together side to side over the line. Count every landing and stop before contacts get slow or uneven.'
      ELSE 'Stay tall and spring both feet together forward and back over the line. Count every landing and stop before contacts get slow or uneven.' END,
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'selectionRule','exact_direction_specific_variant_required',
      'fatigueRule','perform_while_fresh_and_count_all_landing_contacts',
      'substitutionRule','never_silently_change_direction_foot_count_contact_strategy_or_finish'),
    scalable_variables=ARRAY[
      'contacts','sets','amplitude','rhythm','rest_seconds','line_width'],
    movement_family='Bilateral directional line pogo',
    primary_phase_key='output',phase_subrole='elastic_contact_quality',
    primary_order_slot=CASE exercise.id WHEN 1083
      THEN 'bilateral_lateral_line_pogo' ELSE 'bilateral_forward_back_line_pogo' END,
    movement_requirements=jsonb_build_object(
      'base','bilateral_upright_low_amplitude_pogo','footCount',2,
      'lineCrossing','both_feet_clear_line_on_every_contact',
      'contactAccounting','one_contact_equals_one_bilateral_landing',
      'requiredEnvironment',jsonb_build_array(
        'visible_floor_line','level_high_traction_resilient_surface',
        'clear_landing_area_both_sides','no_cross_traffic'),
      'exactVariantRequired',TRUE),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare direction, line, contacts, amplitude, rest, surface, impact budget, and stop signal.',
        'Inspect footwear, landing zones, traffic, and coach sightline.'),
      'executionSteps',jsonb_build_array(
        'Establish tall bilateral posture beside or behind the line.',
        'Spring both feet together across the line at low amplitude.',
        'Count each bilateral landing as one contact.',
        'Maintain declared direction, rhythm, alignment, and quiet contacts.',
        'Finish in a balanced two-foot stop after the declared contacts.'),
      'qualityGate','Simultaneous feet, clear line crossing, counted quiet contacts, declared direction and amplitude, tall posture, repeatable alignment, and controlled finish.',
      'stopSigns',jsonb_build_array(
        'symptoms_or_instability','line_contact','feet_separate_or_land_asymmetrically',
        'alignment_or_posture_loss','rising_contact_time_or_lost_rhythm',
        'unsafe_surface_zone_or_traffic')),
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(975,1083);

  INSERT INTO coaching.exercise_difficulty_profile(
    exercise_id,technical,load,overall,recommended_age_min,
    recommended_age_max,attention_demand,notes,source,complexity,updated_at)
  VALUES
    (1083,4.4,4.8,4.8,NULL,NULL,'high',
      'Exercise complexity 44/100; physical difficulty 48/100; overall is max=48. Athlete proficiency is not an exercise field.',
      'candidate_research',NULL,now()),
    (975,4.6,4.8,4.8,NULL,NULL,'high',
      'Exercise complexity 46/100; physical difficulty 48/100; overall is max=48. Athlete proficiency is not an exercise field.',
      'candidate_research',NULL,now())
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical=EXCLUDED.technical,load=EXCLUDED.load,overall=EXCLUDED.overall,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand=EXCLUDED.attention_demand,notes=EXCLUDED.notes,
    source=EXCLUDED.source,complexity=NULL,updated_at=now();

  INSERT INTO coaching.exercise_dosage_profile(
    exercise_id,profile_name,is_default,volume_unit,default_sets,default_reps,
    default_work_seconds,default_distance,default_contacts,default_rounds,
    default_rest_seconds,tempo,load_type,default_intensity,default_rpe_min,
    default_rpe_max,default_load_note,est_seconds_per_set,session_volume_min,
    session_volume_max,weekly_volume_min,weekly_volume_max)
  VALUES
    (1083,'Default',TRUE,'contacts',3,NULL,NULL,NULL,12,NULL,75,
      'crisp_repeatable_contacts','bodyweight','low_to_moderate',3,6,
      'Count every bilateral landing; reduce contacts or amplitude at the first quality loss.',90,
      '12 quality bilateral landing contacts','60 quality bilateral landing contacts',NULL,120),
    (975,'Default',TRUE,'contacts',3,NULL,NULL,NULL,12,NULL,75,
      'crisp_repeatable_contacts','bodyweight','low_to_moderate',3,6,
      'Count every bilateral landing; reduce contacts or amplitude at the first quality loss.',90,
      '12 quality bilateral landing contacts','60 quality bilateral landing contacts',NULL,120)
  ON CONFLICT(exercise_id,profile_name) DO UPDATE SET
    is_default=TRUE,volume_unit=EXCLUDED.volume_unit,
    default_sets=EXCLUDED.default_sets,default_reps=NULL,
    default_work_seconds=NULL,default_distance=NULL,
    default_contacts=EXCLUDED.default_contacts,default_rounds=NULL,
    default_rest_seconds=EXCLUDED.default_rest_seconds,
    tempo=EXCLUDED.tempo,load_type=EXCLUDED.load_type,
    default_intensity=EXCLUDED.default_intensity,
    default_rpe_min=EXCLUDED.default_rpe_min,
    default_rpe_max=EXCLUDED.default_rpe_max,
    default_load_note=EXCLUDED.default_load_note,
    est_seconds_per_set=EXCLUDED.est_seconds_per_set,
    session_volume_min=EXCLUDED.session_volume_min,
    session_volume_max=EXCLUDED.session_volume_max,
    weekly_volume_min=NULL,weekly_volume_max=EXCLUDED.weekly_volume_max;

  UPDATE coaching.exercise_safety_profile safety
  SET risk_level=3,impact_level=3,requires_spotting=FALSE,
    requires_coach_supervision='recommended',minimum_age_recommended=NULL,
    minimum_skill_level=NULL,
    minimum_prerequisite_notes='Pain-free bilateral takeoff and landing, controlled low-amplitude in-place pogo, safe surface and line zone, and ability to stop on command.',
    readiness_checks=ARRAY[
      'Inspect line, surface, landing areas, footwear, traffic, and coach sightline.',
      'Confirm exact direction, contacts, amplitude, rest, and remaining impact budget.',
      'Confirm pain-free warm-up contacts with both feet landing together.'],
    contraindications=ARRAY[
      'Pain, instability, numbness, dizziness, acute lower-limb injury, or irritable Achilles or plantar symptoms.',
      'Unsafe surface, line, landing area, footwear, traffic, or coach visibility.',
      'Cannot preserve bilateral simultaneous landing, alignment, low amplitude, or controlled stop.'],
    stop_signs=ARRAY[
      'Pain, instability, Achilles or plantar symptoms, numbness, or dizziness.',
      'Repeated line contact, separated or asymmetric feet, posture or alignment loss.',
      'Rising contact time, rhythm loss, uncontrolled stop, unsafe surface, or traffic.'],
    common_substitutions=ARRAY[
      'Reviewed In-Place Bilateral Pogo','Calf Raise Rhythm Drill',
      'Low-Impact Foot-Ankle Preparation']
  WHERE safety.exercise_id IN(975,1083);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,2,'1.0.0',migration_key,'quarantined',
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_object(
      'stableSlugPreserved',TRUE,'legacySourceMappingPreserved',TRUE,
      'identityExecutable',FALSE,'selectionBlocked',TRUE,
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseSkillLevelAbsent',TRUE,'deliveryProfilesSelectable',FALSE,
      'requiredEvidenceSections',16,'candidateMediaCount',3,
      'alternateInterpretations',7,'mediaApprovalCreated',FALSE,
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE)
    ELSE jsonb_build_object(
      'stableSlugPreserved',TRUE,'identityAndAliasesComplete',TRUE,
      'controlledTaxonomyComplete',TRUE,'anatomyComplete',TRUE,
      'exerciseDifficultyOnly',TRUE,'overallDifficultyFormula','max',
      'exactVariantCount',1,'deliveryProfileCount',2,
      'loadFatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
      'dosageAndDurationComplete',TRUE,'cumulativeImpactBudgetComplete',TRUE,
      'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
      'supportOperationsComplete',TRUE,'requiredEvidenceSections',16,
      'candidateMediaCount',5,'alternateInterpretations',8,
      'reviewRelationshipCount',2,'reviewCalibrationCount',2,
      'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE) END,
    CASE WHEN definition.id=ANY(source_ids) THEN jsonb_build_array(
      jsonb_build_object('code','CARD-IDENTITY-EXECUTABLE-01',
        'message','Direction, crossing, foot count, contact strategy, contact accounting, cadence, or finish requires authoritative evidence.'),
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
        'message','A qualified coach must review and approve direction-changing relationship proposals.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','Independent difficulty calibration evidence and reviewer approval are required.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','Publication remains blocked until every human quality gate passes.')) END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id=ANY(all_ids)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
     WHERE definition.id=ANY(all_ids)
       AND definition.provenance_json->>'linePogoIdentityMigration'=migration_key
       AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
       AND definition.last_reviewed_at IS NULL
       AND definition.approved_video_url IS NULL)<>5
    OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(source_ids)
         AND definition.status='archived' AND definition.card_version=2)<>3
    OR(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id=ANY(survivor_ids)
         AND definition.status='review' AND definition.card_version=2)<>2 THEN
    RAISE EXCEPTION '% expected three archived sources and two review survivors',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id=ANY(all_ids)
       AND evidence.reviewed_card_version=2
       AND evidence.review_status='candidate')<>80
    OR EXISTS(SELECT 1 FROM unnest(all_ids) AS ids(definition_id)
       WHERE(SELECT count(DISTINCT evidence.section_key)
         FROM coaching.exercise_section_evidence_v1 evidence
         WHERE evidence.definition_id=ids.definition_id
           AND evidence.reviewed_card_version=2
           AND evidence.review_status='candidate')<>16) THEN
    RAISE EXCEPTION '% expected 16 candidate evidence sections per card',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id=ANY(all_ids)
       AND media.reviewed_card_version=2
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>19
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id=ANY(all_ids)
         AND alternate.reviewed_card_version=2
         AND alternate.review_status='candidate'
         AND alternate.reviewer_user_id IS NULL
         AND alternate.reviewed_at IS NULL)<>37 THEN
    RAISE EXCEPTION '% expected candidate-only 19-media and 37-alternate packets',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.definition_id=ANY(survivor_ids)
       AND variant.status='review')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=ANY(source_ids) AND variant.status<>'archived')
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
       WHERE variant.id IN(lateral_variant_id,forward_variant_id)
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
     WHERE profile.variant_id IN(lateral_variant_id,forward_variant_id)
       AND profile.profile_key IN('output-elastic-quality','prepare-contact-rhythm')
       AND profile.status='review'
       AND profile.equipment_required=ARRAY['line_tape']::TEXT[])<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id IN(lateral_variant_id,forward_variant_id)
         AND calibration.dimension IN(
           'technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review'
         AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% expected complete review-only profiles and calibration',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
     WHERE relationship.from_variant_id IN(lateral_variant_id,forward_variant_id)
       AND relationship.to_variant_id IN(lateral_variant_id,forward_variant_id)
       AND relationship.review_status='review'
       AND relationship.reviewed_by IS NULL
       AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected both review-only relationship proposals',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.decision='needs_human_review'
       AND resolution.survivor_definition_id=ANY(all_ids)
       AND resolution.resolved_definition_id=ANY(all_ids)
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'retirementMigration'=migration_key)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE resolution.survivor_definition_id=lateral_id
         AND resolution.resolved_definition_id=forward_id
         AND resolution.decision='distinct_exercises'
         AND resolution.resolution_source='deterministic_identity_equivalence'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key) THEN
    RAISE EXCEPTION '% failed to preserve source review and direction boundary',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1
       AND exercise.id IN(136,137,267,268,269,714,1110)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.skill_level IS NULL)<>7
    OR(SELECT count(*) FROM coaching.exercise exercise
       WHERE exercise.facility_id=1 AND exercise.id IN(975,1083)
         AND exercise.archived IS FALSE AND exercise.is_published IS TRUE
         AND exercise.skill_level IS NULL)<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(975,1083)
         AND safety.minimum_skill_level IS NOT NULL)
    OR(SELECT count(*) FROM coaching.exercise_difficulty_profile difficulty
       WHERE difficulty.exercise_id IN(975,1083)
         AND difficulty.overall=greatest(
           difficulty.technical,difficulty.load))<>2 THEN
    RAISE EXCEPTION '% found invalid legacy selection, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id=ANY(all_ids)
       AND packet.card_version=2 AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE)<>5
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
