-- Retire the mixed-base Kettlebell Strict Press source family and add one
-- exact review-only standing double-kettlebell variant to the completed
-- Standing Strict Overhead Press card. The source family permits a stance or
-- kneeling base and mixes generic/singular and explicit double-kettlebell
-- lineage, so it is not directly mapped to the standing survivor.
--
-- Media health is automated candidate metadata only. Exercise cards use
-- complexity and physical difficulty; athlete proficiency is excluded.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '430_coaching_kettlebell_strict_press_identity_resolution';
  research_batch CONSTANT TEXT :=
    'standing-kettlebell-strict-press-identity-v1';
  research_version CONSTANT TEXT := '2026-08-01.8';
  source_slug CONSTANT TEXT := 'kettlebell-strict-press';
  survivor_slug CONSTANT TEXT := 'strict-overhead-press';
  source_id UUID;
  survivor_id UUID;
  z_press_id UUID;
  bench_press_id UUID;
  seated_press_id UUID;
  new_variant_id UUID;
  applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT id INTO source_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=source_slug;
  SELECT id INTO survivor_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=survivor_slug;
  SELECT id INTO z_press_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='barbell-z-press';
  SELECT id INTO bench_press_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='barbell-bench-press';
  SELECT id INTO seated_press_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='seated-barbell-overhead-press';

  IF source_id IS NULL OR survivor_id IS NULL OR z_press_id IS NULL
      OR bench_press_id IS NULL OR seated_press_id IS NULL THEN
    RAISE EXCEPTION '% requires the source, survivor, and adjacent press definitions',
      migration_key;
  END IF;
  IF(SELECT count(*) FROM coaching.exercise_definition_source_v1 source
     WHERE source.definition_id=source_id
       AND source.legacy_exercise_id IN(490,491))<>2 THEN
    RAISE EXCEPTION '% requires both kettlebell source mappings 490 and 491',
      migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(source_id,survivor_id)
    AND definition.provenance_json->>'kettlebellIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,2) THEN
    RAISE EXCEPTION '% found a partial prior application',migration_key;
  END IF;
  IF applied_count=0 THEN
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source_id AND status='review' AND card_version=1)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=survivor_id AND status='review' AND card_version=2) THEN
      RAISE EXCEPTION '% expected source version 1 and survivor version 2 in review',
        migration_key;
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source_id AND status='archived' AND card_version=2)
      OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=survivor_id AND status='review' AND card_version=3) THEN
      RAISE EXCEPTION '% found prior-application card drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
      AND(
        ARRAY[resolution.survivor_definition_id,resolution.resolved_definition_id]
          @> ARRAY[source_id,survivor_id]
        OR ARRAY[resolution.survivor_definition_id,resolution.resolved_definition_id]
          @> ARRAY[z_press_id,survivor_id]
        OR ARRAY[resolution.survivor_definition_id,resolution.resolved_definition_id]
          @> ARRAY[bench_press_id,survivor_id]
        OR ARRAY[resolution.survivor_definition_id,resolution.resolved_definition_id]
          @> ARRAY[bench_press_id,seated_press_id])
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(source_id,survivor_id)
        AND(definition.status IN('published','deprecated')
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id IN(source_id,survivor_id)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id IN(source_id,survivor_id)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id IN(source_id,survivor_id)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id IN(source_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id IN(source_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id IN(source_id,survivor_id))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id IN(source_id,survivor_id)
        AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id IN(source_id,survivor_id)
        AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id IN(source_id,survivor_id)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      WHERE variant.definition_id IN(source_id,survivor_id)
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
    WHERE definition_id IN(source_id,survivor_id)
      AND review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id IN(source_id,survivor_id)
      AND review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',
      reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id IN(source_id,survivor_id)
      AND review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id AND variant.definition_id=source_id;
  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',
    difficulty_json=jsonb_build_object(
      'scoringStatus','blocked_pending_exact_identity',
      'technicalComplexity',NULL,'absoluteLoadDemand',NULL,
      'baseOverallDifficulty',NULL,
      'reason','base, laterality, kettlebell quantity, rack, and equipment operations are unresolved',
      'athleteProficiencyExcluded',TRUE),
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'missingIdentityDimensions',jsonb_build_array(
          'base','laterality','implement_quantity','rack',
          'handle_orientation','clean_or_handoff','set_down','repetition_boundary'),
        'retirementMigration',migration_key),
    load_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','load handling requires an exact base, laterality, quantity, and rack'),
    fatigue_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','fatigue and recovery require an exact executable task'),
    programming_profile_json=jsonb_build_object(
      'selectable',FALSE,'selectionPolicy','blocked_pending_identity_contract',
      'replacementPolicy','choose_an_exact_standing_or_kneeling_kettlebell_press'),
    updated_at=now()
  WHERE variant.definition_id=source_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Kettlebell Strict Press (Unresolved Legacy)',
    display_name='Kettlebell Strict Press (Unresolved Legacy)',
    description='Archived nonprescribable source family. It permits a stance or kneeling base and mixes generic Kettlebell Strict Press with explicit Double Kettlebell Strict Press lineage. Base, laterality, implement quantity, rack, handle orientation, clean or handoff, set-down, and repetition boundary are not jointly declared.',
    family_key='unresolved_kettlebell_strict_press_identity_quarantine',
    content_confidence=92,scoring_confidence=1,media_confidence=30,
    movement_patterns=ARRAY['push','brace'],
    body_regions=ARRAY['shoulder','upper_arm','forearm','upper_back','core','spine'],
    required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'known',jsonb_build_array('kettlebell_resistance','overhead_clearance'),
      'unresolved',jsonb_build_array(
        'standing_or_kneeling_footprint','kettlebell_quantity',
        'clean_or_handoff_zone','set_down_zone','spotter_position'),
      'selectionBlocked',TRUE),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness cannot be matched to an undefined base, laterality, and implement quantity',
      'supportPath','choose_an_exact_reviewed_kettlebell_press'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('generic_overhead_press_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array(
        'shoulder','scapulothoracic','elbow','wrist','thoracic_spine','lumbar_spine'),
      'jointActions',jsonb_build_array(
        'exact_actions_blocked_pending_base_laterality_and_quantity'),
      'planes',jsonb_build_array('scapular_and_sagittal_unresolved_by_configuration'),
      'laterality','unresolved_generic_or_bilateral_source_family',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This source family can mean materially different presses and is unavailable until an exact task is chosen.',
      'primaryCue','Ask for the exact standing or kneeling kettlebell press card.',
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'pain','instability','numbness_or_tingling','dizziness','pressure_symptoms'),
      'painGuidance','Do not begin from this unresolved card; stop the replacement exercise for symptoms or unsafe bell control.',
      'selfChecks',jsonb_build_array(
        'exact base and laterality are visible','kettlebell quantity and rack are visible',
        'clean or handoff and set-down are declared'),
      'accessibility',jsonb_build_array(
        'plain-language retirement explanation','text-first exact replacement'),
      'mediaAlternatives',jsonb_build_array(
        'missing-identity explanation','coach-selected exact card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'base','laterality','kettlebell_quantity','rack','handle_orientation',
        'clean_or_handoff','path','range','set_down','repetition_boundary'),
      'faultCorrections',jsonb_build_array(
        'Do not cue or dose until every identity and equipment field is declared'),
      'demonstrationPlan',jsonb_build_array(
        'Explain the mixed source lineage','Open the exact replacement card'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'standing_bilateral','choose_double_kettlebell_standing_variant',
        'unilateral_or_kneeling','choose_or_author_separate_exact_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','base','laterality','implement_quantity','equipment_operations'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','dropped_kettlebell')),
      'retentionPolicy','Preserve source mappings 490 and 491, original wording, aliases, evidence, media, and queue decisions.',
      'changeImpactPolicy','Do not reactivate without authoritative base, laterality, quantity, rack, clean or handoff, set-down, and repetition-boundary evidence.',
      'knownLimitations',jsonb_build_array(
        'mixed_base','mixed_quantity','no_exact_reviewed_media'),
      'supportSummary','Retirement is deliberate; do not silently map the source family to a standing variant.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'kettlebellIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'candidateStandingDefinition',survivor_slug,
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=source_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=3,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    aliases=ARRAY(SELECT DISTINCT alias_value FROM unnest(
      coalesce(definition.aliases,'{}')||ARRAY[
        'Standing Double Kettlebell Strict Press',
        'Double Kettlebell Standing Overhead Press']) alias_value
      ORDER BY alias_value),
    optional_equipment=ARRAY(SELECT DISTINCT item FROM unnest(
      coalesce(definition.optional_equipment,'{}')||ARRAY['kettlebell']) item
      ORDER BY item),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'kettlebellIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','standing_survivor_with_new_double_kettlebell_variant',
      'ambiguousSourceRetainedAsArchived',source_slug,
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=survivor_id;

  INSERT INTO coaching.exercise_variant_v1(
    definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES(survivor_id,'double-kettlebell-standing-neutral-rack',
    'Standing Double-Kettlebell Strict Press — Neutral Rack',
    ARRAY['standing','two_kettlebells','neutral_handles','bilateral','strict'],
    jsonb_build_object(
      'technicalComplexity',62,'absoluteLoadDemand',60,
      'baseOverallDifficulty',62,'coordinationDemand',62,
      'supervisionDemand',64,'failureConsequence',64,'impact',2,
      'workCapacityDemand',60,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty'),
      'athleteProficiencyExcluded',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base','standing_level_bilateral_base',
      'implement','two_matched_kettlebells','implementQuantity',2,
      'grip','neutral_handles_with_bells_supported_in_declared_front_rack',
      'rack','bilateral_front_rack_at_shoulders',
      'path','independent_owned_paths_in_front_of_head_to_overhead',
      'legDrive','none_deliberate',
      'repetitionCycle','active_strict_press_then_controlled_return_to_same_rack',
      'range','pain_free_owned_rack_to_overhead_finish',
      'eccentricSeconds',jsonb_build_object('minimum',2,'maximum',3),
      'cleanOrHandoff','declared_double_clean_or_two_person_handoff',
      'setDown','controlled_return_to_floor_or_blocks_with_clear_zone',
      'spotting','declared_by_load_risk_and_facility_policy',
      'equipmentRequired',jsonb_build_array('kettlebell')),
    'review',
    jsonb_build_object(
      'gripDemand',62,'spinalLoading',48,'eccentricStress',56,
      'landingContactsPerRep',0,'externalLoadMethod','two_kettlebells',
      'externalLoadDescription','two matched kettlebells independently pressed from a bilateral standing front rack',
      'loadTracking',jsonb_build_array(
        'mass_per_kettlebell','combined_load','repetitions','range','tempo','rir_or_rpe')),
    jsonb_build_object(
      'localMuscleFatigue',62,'gripFatigue',64,
      'technicalFatigueSensitivity',66,'impactAccumulation',2,
      'recoveryHours',36,'primaryFatigueSites',jsonb_build_array(
        'deltoids','triceps','upper_back','rotator_cuff','forearms','trunk'),
      'stopBefore',jsonb_build_array(
        'grip_or_rack_loss','bell_collision','rib_flare_or_lean',
        'asymmetric_path','range_loss','grinding_rep','unsafe_setdown')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'bilateral_overhead_strength','independent_bell_control',
        'triceps_strength','scapular_control','trunk_bracing'),
      'stimulusDose',jsonb_build_object(
        'primary','quality_external_load_repetitions','fatigueCeiling','moderate'),
      'weeklyExposure',jsonb_build_object('typical',1,'maximumWithoutReview',3),
      'prerequisites',jsonb_build_array(
        'owned_overhead_range','stable_standing_base',
        'safe_double_clean_or_handoff_and_setdown'),
      'completionCriteria',jsonb_build_array(
        'strict_no_leg_drive','stable_rack_and_base','controlled_independent_paths',
        'owned_finish_and_return','secure_setdown'),
      'sequenceRules',jsonb_build_array(
        'after_specific_warmup','before_fatigue_sensitive_overhead_skill',
        'before_dense_press_or_grip_conditioning'),
      'pairingCompatibility',jsonb_build_object(
        'preferred',jsonb_build_array('lower_body_strength','low_fatigue_mobility'),
        'avoid',jsonb_build_array('high_density_overhead_or_grip_work')),
      'interferenceRules',jsonb_build_array(
        'counts_toward_shoulder_triceps_grip_trunk_and_press_volume_budgets'),
      'uncertaintyPolicy',jsonb_build_object(
        'clean_handoff_or_setdown_unclear','do_not_lift',
        'load_or_range_uncertain','reduce_load'),
      'cumulativeBudget',jsonb_build_object(
        'shoulderPressVolume','combined_load_times_repetitions',
        'technicalSensitivity',66,'impact',2)))
  ON CONFLICT(definition_id,variant_key) DO UPDATE SET
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now()
  RETURNING id INTO new_variant_id;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT new_variant_id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,profile.alignment,
    profile.objectives,profile.dosage,
    'Stable feet and bilateral rack, no leg drive, controlled independent bell paths, owned range, repeatable 2-3 second return, and secure set-down.',
    ARRAY[
      'Stop for pain, instability, numbness, dizziness, pressure symptoms, grip loss, or unsafe bell control.',
      'Stop for rack loss, bell collision, rib flare, backward lean, asymmetric path, range loss, or grinding.',
      'Stop when the clean, handoff, spot, or set-down plan is no longer safe.'],
    'Verify matched kettlebells, clear zone, clean or handoff, rack, base, no leg drive, path, range, tempo, effort, and set-down. Count only repetitions that pass every gate.',
    'Use the declared clean or handoff, settle both bells in the rack, press without a dip, own the top, lower to the same rack, and set both bells down safely.',
    profile.adaptation,ARRAY['kettlebell'],
    jsonb_build_object(
      'stationSeconds',300,'athletesPerStation',1,'setupSeconds',75,
      'transitionSeconds',45,'overheadClearanceRequired',TRUE,
      'clearCleanAndSetDownZone',TRUE,'oneActiveLifterPerZone',TRUE),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'secondsPerRep',jsonb_build_object('minimum',4,'maximum',7),
      'setSeconds',jsonb_build_object('minimum',15,'maximum',55),
      'restSeconds',profile.dosage->'restSeconds',
      'durationInputs',jsonb_build_array(
        'repetitions','tempo','clean_or_handoff','setdown','rest')),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'reduce_load','reduce_repetitions','shorten_owned_range',
        'use_double_dumbbell_neutral_variant','increase_rest'),
      'progressOrder',jsonb_build_array(
        'stabilize_rack_and_path','complete_all_repetitions',
        'add_repetition','add_small_load'),
      'changeOneVariableAtATime',TRUE,
      'neverChangeSilently',jsonb_build_array(
        'base','laterality','kettlebell_quantity','leg_drive','press_sequence')),
    jsonb_build_object(
      'primary','completed_quality_repetitions',
      'record',jsonb_build_array(
        'mass_per_kettlebell','combined_load','repetitions','range','tempo',
        'rir_or_rpe','symmetry','symptoms','stop_reason'),
      'failedRepPolicy','do_not_count_and_end_or_reduce_load'),
    jsonb_build_object(
      'before',jsonb_build_array(
        'Confirm matched bells, exact load, clear zone, clean or handoff, range, tempo, spot, and set-down.',
        'Report current shoulder, elbow, wrist, neck, back, neurologic, dizziness, or pressure symptoms.'),
      'during',jsonb_build_array(
        'Call rack, path, tempo, and stop immediately when a gate fails.'),
      'after',jsonb_build_array(
        'Record load, repetitions, range, tempo, effort, symptoms, and stop reason.'))
  FROM(VALUES
    ('capacity-strength','capacity','primary',
      'Build standing bilateral kettlebell overhead strength with repeatable rack, path, and equipment control.',88,86,
      '{"strength":94,"tissue_capacity":76,"movement_quality":78}'::JSONB,
      '{"volumeUnit":"repetitions","sets":{"minimum":2,"maximum":4},"repetitionsPerSet":{"minimum":3,"maximum":8},"restSeconds":{"minimum":120,"maximum":240},"effort":"two_or_more_repeatable_repetitions_in_reserve"}'::JSONB,
      'Improved bilateral kettlebell strict-press strength and independent-bell control.'),
    ('resilience-controlled-volume','resilience','secondary',
      'Build controlled rack-to-overhead range and repeatable lowering at a submaximal dose.',82,88,
      '{"strength":72,"tissue_capacity":90,"movement_quality":92}'::JSONB,
      '{"volumeUnit":"repetitions","sets":{"minimum":2,"maximum":3},"repetitionsPerSet":{"minimum":5,"maximum":10},"restSeconds":{"minimum":90,"maximum":180},"effort":"low_to_moderate_fatigue_with_repeatable_path"}'::JSONB,
      'Improved overhead position, rack control, and repeatable submaximal volume tolerance.')
  ) profile(profile_key,phase_key,role,purpose,suitability,alignment,objectives,dosage,adaptation)
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
  SELECT definition.id,CASE definition.id WHEN survivor_id THEN 3 ELSE 2 END,
    section.section_key,source.source_url,source.source_title,
    source.source_publisher,source.source_kind,
    CASE definition.id WHEN source_id THEN jsonb_build_array(
      'Candidate evidence documents why '||section.section_key||
        ' cannot be inferred from a source family that permits standing or kneeling and mixes generic and double-kettlebell lineage.',
      'The source is archived and nonselectable; no identity mapping, score, dosage, media, graph, calibration, or publication approval is created.')
    ELSE jsonb_build_array(
      'Candidate evidence was reassessed for exact standing bilateral double-kettlebell rack, no-leg-drive press, independent paths, controlled return, equipment operations, dosage, quality gates, and stop rules in section '||section.section_key||'.',
      'Difficulty contains exercise complexity and physical difficulty only; all media, graph, calibration, and publication approvals remain human work.') END,
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
      WHEN section.section_key IN('taxonomy','biomechanics','difficulty','coach_support','alternates') THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/'
      WHEN section.section_key IN('identity','anatomy') THEN 'https://pubmed.ncbi.nlm.nih.gov/35936912/'
      WHEN section.section_key='load_fatigue_recovery' THEN 'https://pubmed.ncbi.nlm.nih.gov/42401924/'
      WHEN section.section_key IN('dosage','programming') THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
      WHEN section.section_key IN('safety_stop_rules','accessibility') THEN 'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'
      ELSE 'https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf' END source_url,
    CASE
      WHEN section.section_key='media' THEN 'Embed videos and playlists'
      WHEN section.section_key IN('taxonomy','biomechanics','difficulty','coach_support','alternates') THEN 'Stability of Resistance Training Implement Alters EMG Activity during the Overhead Press'
      WHEN section.section_key IN('identity','anatomy') THEN 'Front vs Back and Barbell vs Machine Overhead Press: An Electromyographic Analysis and Implications for Resistance Training'
      WHEN section.section_key='load_fatigue_recovery' THEN 'The effect of eccentric phase tempo on acute neuromechanical responses and short-term post-exercise recovery in healthy trained and recreationally active adults: a systematic review'
      WHEN section.section_key IN('dosage','programming') THEN 'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews'
      WHEN section.section_key IN('safety_stop_rules','accessibility') THEN 'Youth Resistance Training: Updated Position Statement Paper From the NSCA'
      ELSE 'Basics of Strength and Conditioning Manual' END source_title,
    CASE
      WHEN section.section_key='media' THEN 'YouTube Help'
      WHEN section.section_key IN('taxonomy','biomechanics','difficulty','coach_support','alternates') THEN 'International Journal of Exercise Science'
      WHEN section.section_key IN('identity','anatomy') THEN 'Frontiers in Physiology'
      WHEN section.section_key='load_fatigue_recovery' THEN 'BMC Sports Science, Medicine and Rehabilitation'
      WHEN section.section_key IN('dosage','programming') THEN 'Medicine and Science in Sports and Exercise'
      ELSE 'National Strength and Conditioning Association' END source_publisher,
    CASE WHEN section.section_key='media' THEN 'manufacturer_instruction'
      WHEN section.section_key IN('constraints','instructions','safety_stop_rules','athlete_support','accessibility') THEN 'professional_standard'
      ELSE 'peer_reviewed_research' END source_kind,
    CASE WHEN section.section_key='media' THEN 82
      WHEN section.section_key IN('dosage','programming') THEN 96
      WHEN section.section_key='load_fatigue_recovery' THEN 90
      WHEN section.section_key IN('safety_stop_rules','accessibility') THEN 88
      WHEN section.section_key IN('identity','anatomy') THEN 86
      WHEN section.section_key IN('taxonomy','biomechanics','difficulty','coach_support','alternates') THEN 84
      ELSE 84 END::SMALLINT quality
  ) source
  WHERE definition.id IN(source_id,survivor_id)
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
  SELECT definition.id,NULL,CASE definition.id WHEN survivor_id THEN 3 ELSE 2 END,
    link.url,'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel_name,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,NULL,
    media.notes
  FROM(VALUES
    (survivor_slug,'iJ0py9JQIZY','How To Barbell Press | The Starting Strength Method','Starting Strength','standing strict barbell overhead press','oEmbed metadata verified 2026-08-01T16:30:00Z. Title-level candidate only; exact movement, safety, accessibility, quality, reviewer, and approval remain unresolved.'),
    (survivor_slug,'22gQUcvcW1o','Dumbbell Strict Press','Marcus Filly','standing dumbbell strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Title-level candidate only; all human review gates remain unresolved.'),
    (survivor_slug,'Y4sfLqqbpVs','Sandbag Strict Press Demo','Steph Gaudreau - Fuel Your Strength','standing sandbag strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Title-level candidate only; all human review gates remain unresolved.'),
    (survivor_slug,'3y0XIgFyIgE','Double Kettlebell Strict Press by Kettlebell Athletes','Bij & Gab - Kettlebell Athletes','double kettlebell standing strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Exact base, rack, path, range, safety, accessibility, quality, reviewer, and approval remain unresolved.'),
    (survivor_slug,'tLQt4ccmPQ4','DOUBLE KETTLEBELL STRICT PRESS TECHNIQUE','Joe Daniels Kettlebell Muscle Gain','double kettlebell strict press technique','oEmbed metadata verified 2026-08-01T16:30:00Z. Exact base, rack, path, range, safety, accessibility, quality, reviewer, and approval remain unresolved.'),
    (source_slug,'Ay9W-movDuE','Kettlebell Exercise: Strict Press','Onnit','kettlebell strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Generic title does not declare base, laterality, quantity, rack, or equipment operations; adjacent evidence only.'),
    (source_slug,'3y0XIgFyIgE','Double Kettlebell Strict Press by Kettlebell Athletes','Bij & Gab - Kettlebell Athletes','double kettlebell strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Two-kettlebell title does not resolve the combined source family base; adjacent evidence only.'),
    (source_slug,'He8TyCcK0sc','Primal Methods | Kettlebell Strict Press | Eric Leija','Eric Leija','kettlebell strict press','oEmbed metadata verified 2026-08-01T16:30:00Z. Generic title does not declare base, laterality, quantity, rack, or equipment operations; adjacent evidence only.')
  ) media(definition_slug,video_id,title,channel_name,source_query,notes)
  JOIN coaching.exercise_definition_v1 definition ON definition.slug=media.definition_slug
  CROSS JOIN LATERAL(SELECT 'https://www.youtube.com/watch?v='||media.video_id url) link
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
    CASE definition.id WHEN survivor_id THEN 3 ELSE 2 END,
    alternate.alternate_name,alternate.classification,alternate.rationale,
    alternate.dimensions,
    CASE WHEN alternate.classification='new_definition' THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    (survivor_slug,'Standing Double-Kettlebell Strict Press','new_variant','Two matched kettlebells add independent load paths and rack operations while preserving the bilateral standing strict press.','{"implement":"two_kettlebells","base":"standing","laterality":"bilateral","legDrive":"none"}'::JSONB),
    (survivor_slug,'Standing Single-Kettlebell Strict Press','new_definition','One kettlebell changes laterality, asymmetric trunk demand, rack, and failure handling and requires its own exact identity.','{"implementQuantity":1,"laterality":"unilateral"}'::JSONB),
    (survivor_slug,'Half-Kneeling Kettlebell Strict Press','new_definition','A half-kneeling base changes support, laterality, balance, hip position, and equipment operations.','{"base":"half_kneeling"}'::JSONB),
    (survivor_slug,'Tall-Kneeling Kettlebell Strict Press','new_definition','A tall-kneeling base changes support, balance, hip strategy, setup, and set-down.','{"base":"tall_kneeling"}'::JSONB),
    (survivor_slug,'Kettlebell Push Press','new_definition','Deliberate knee and hip drive changes the action sequence and power intent.','{"legDrive":"deliberate","intent":"linked_power"}'::JSONB),
    (survivor_slug,'Kettlebell Bottoms-Up Press','new_definition','Bottoms-up orientation materially changes grip, stability, load ceiling, and failure response.','{"bellOrientation":"bottoms_up"}'::JSONB),
    (survivor_slug,'Seated Kettlebell Strict Press','new_definition','A seated base changes balance, trunk demand, support, setup, and equipment handling.','{"base":"seated"}'::JSONB),
    (survivor_slug,'Load, Repetitions, Rest, Range, or Eccentric Seconds','modifier_annotation','These are dosage or execution modifiers only after exact base, laterality, quantity, rack, and repetition cycle are selected.','{"modifiers":["load","repetitions","rest","range","eccentric_seconds"]}'::JSONB),
    (source_slug,'Standing Double-Kettlebell Strict Press','same_identity','If authoritative evidence establishes standing, bilateral execution with two matched kettlebells, a front rack, no leg drive, and a complete active press and return, use the exact standing variant.','{"possibleMapping":"strict-overhead-press/double-kettlebell-standing-neutral-rack","requiredFacts":["standing","bilateral","two_kettlebells","front_rack","active_press_and_return"]}'::JSONB),
    (source_slug,'Standing Single-Kettlebell Strict Press','new_definition','A unilateral standing press is not recoverable from the mixed generic/double source family without authoritative laterality and quantity evidence.','{"base":"standing","laterality":"unilateral","implementQuantity":1}'::JSONB),
    (source_slug,'Half-Kneeling Single-Kettlebell Strict Press','new_definition','Half-kneeling, unilateral loading, rack, and equipment operations form a separate exact contract.','{"base":"half_kneeling","laterality":"unilateral","implementQuantity":1}'::JSONB),
    (source_slug,'Tall-Kneeling Double-Kettlebell Strict Press','new_definition','Tall-kneeling support and two-bell handling form a separate exact contract.','{"base":"tall_kneeling","laterality":"bilateral","implementQuantity":2}'::JSONB),
    (source_slug,'Kettlebell Push Press','new_definition','Deliberate leg drive changes the strict action and intent.','{"legDrive":"deliberate"}'::JSONB),
    (source_slug,'Kettlebell Bottoms-Up Press','new_definition','Bottoms-up orientation changes grip, stability, loading, and failure handling.','{"bellOrientation":"bottoms_up"}'::JSONB),
    (source_slug,'Load, Range, Repetitions, Rest, or Tempo','modifier_annotation','These become modifiers only after base, laterality, quantity, rack, and the complete repetition boundary are fixed.','{"modifiers":["load","range","repetitions","rest","tempo"]}'::JSONB)
  ) alternate(definition_slug,alternate_name,classification,rationale,dimensions)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=alternate.definition_slug
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,edge.relationship,
    edge.similarity_score,edge.dimensions,edge.reason,edge.conditions,
    'review',NULL,NULL,NULL
  FROM(VALUES
    ('dumbbell-standing-neutral','double-kettlebell-standing-neutral-rack',
      'progression',68,ARRAY['equipment','rack','grip','stability','load']::TEXT[],
      'Two kettlebells preserve the bilateral standing neutral-path strict-press purpose while adding front-rack, clean or handoff, independent bell, grip, and set-down demands.',
      '{"requires":["safe_double_clean_or_handoff","stable_bilateral_rack","secure_setdown"],"notEquivalentFor":["dumbbell_specific_loading"]}'::JSONB),
    ('double-kettlebell-standing-neutral-rack','dumbbell-standing-neutral',
      'regression',78,ARRAY['equipment','rack','grip','stability','load']::TEXT[],
      'Matched dumbbells preserve a bilateral standing neutral-path strict press while reducing kettlebell rack and bell-control demands.',
      '{"useWhen":["kettlebell_rack_not_owned","double_clean_or_setdown_not_safe","matched_dumbbells_available"],"notEquivalentFor":["kettlebell_specific_strength"]}'::JSONB)
  ) edge(from_key,to_key,relationship,similarity_score,dimensions,reason,conditions)
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=survivor_id
      AND from_variant.variant_key=edge.from_key
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=survivor_id
      AND to_variant.variant_key=edge.to_key
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (1,new_variant_id,'technicalComplexity',62,60,
      'Candidate exercise-complexity anchor based on standing base, bilateral independent bell paths, double front-rack setup, strict no-leg-drive control, range, clean or handoff, and secure set-down. Independent human calibration is required.',
      'review',1,NULL,NULL,'No score approval is created by migration 430.',NULL),
    (1,new_variant_id,'absoluteLoadDemand',60,60,
      'Candidate physical-difficulty anchor based on combined external load, shoulder and triceps demand, grip and rack fatigue, trunk bracing, repetitions, range, and recovery. Independent human calibration is required.',
      'review',1,NULL,NULL,'No score approval is created by migration 430.',NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,source_id,survivor_id,'needs_human_review',
      'The archived source family permits a stance or kneeling base and mixes generic Kettlebell Strict Press and explicit Double Kettlebell Strict Press lineage. The standing survivor now includes an exact bilateral two-kettlebell variant, but base, laterality, quantity, rack, clean or handoff, set-down, and repetition boundary cannot be imported into the legacy source without authoritative evidence.',
      jsonb_build_object(
        'retirementMigration',migration_key,
        'resolution','retire_ambiguous_source_without_direct_consolidation',
        'standingCandidate',survivor_slug,
        'candidateVariant','double-kettlebell-standing-neutral-rack',
        'sourceMappings',jsonb_build_array(490,491),
        'missingIdentityDimensions',jsonb_build_array(
          'base','laterality','implement_quantity','rack','clean_or_handoff',
          'set_down','repetition_boundary'),
        'humanReviewRequired',TRUE,'approvalCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,z_press_id,survivor_id,'distinct_exercises',
      'Barbell Z Press requires a floor-seated long-sit base with no standing foot support. Standing Strict Overhead Press requires a standing bilateral base. The support geometry and balance contract are identity-bearing.',
      jsonb_build_object(
        'identityBoundary','floor_long_sit_press_vs_standing_strict_press',
        'decisionScope','identity_only_not_card_or_publication_approval',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,bench_press_id,survivor_id,'distinct_exercises',
      'Barbell Bench Press is a supported supine horizontal press toward and away from the torso. Standing Strict Overhead Press is an unsupported standing vertical press to overhead. Base, support, plane, path, and terminal position are identity-bearing.',
      jsonb_build_object(
        'identityBoundary','supine_horizontal_bench_press_vs_standing_vertical_overhead_press',
        'decisionScope','identity_only_not_card_or_publication_approval',
        'humanReviewRequired',TRUE,'approvalCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,bench_press_id,seated_press_id,'distinct_exercises',
      'Barbell Bench Press is a supine horizontal press. Seated Barbell Overhead Press uses an upright seated base and a vertical overhead path. Body orientation, pressing plane, path, support, and terminal position are identity-bearing.',
      jsonb_build_object(
        'identityBoundary','supine_horizontal_bench_press_vs_upright_seated_vertical_overhead_press',
        'decisionScope','identity_only_not_card_or_publication_approval',
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
        WHEN 490 THEN 'Kettlebell Strict Press (Unresolved Legacy)'
        ELSE 'Double Kettlebell Strict Press (Unresolved Legacy)' END,
    description='Archived mixed-base source. Standing versus kneeling base, laterality, implement quantity, rack, clean or handoff, set-down, and repetition boundary are not jointly established.',
    instructions='Do not prescribe from this source. Select an exact standing or kneeling kettlebell press card with declared equipment operations.',
    card_summary='Archived nonprescribable identity; retained for source traceability.',
    coach_language='Choose an exact replacement. Do not infer base, laterality, bell quantity, rack, clean or handoff, set-down, or repetition boundary.',
    athlete_language='This card is unavailable because its setup and exact repetition are not fully defined.',
    programming_logic=jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'replacementPolicy','choose_exact_standing_or_kneeling_kettlebell_press',
      'difficultyStatus','blocked_pending_exact_identity'),
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'missingIdentityDimensions',jsonb_build_array(
        'base','laterality','implement_quantity','rack','clean_or_handoff',
        'set_down','repetition_boundary')),
    coaching_execution=jsonb_build_object(
      'selectionBlocked',TRUE,
      'supportMessage','Open an exact replacement card before setup or instruction.'),
    skill_level=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id IN(490,491);

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level=NULL
  WHERE safety.exercise_id IN(490,491);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,
    CASE definition.id WHEN survivor_id THEN 3 ELSE 2 END,
    '1.0.0',migration_key,'quarantined',
    CASE definition.id
      WHEN source_id THEN jsonb_build_object(
        'stableSlugPreserved',TRUE,'legacySourceMappingsPreserved',TRUE,
        'identityExecutable',FALSE,'selectionBlocked',TRUE,
        'standingOrKneelingUnresolved',TRUE,'implementQuantityUnresolved',TRUE,
        'difficultyStatus','blocked_pending_exact_identity',
        'exerciseSkillLevelAbsent',TRUE,'requiredEvidenceSections',16,
        'candidateMediaCount',3,'alternateInterpretations',7,
        'mediaApprovalCreated',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE)
      ELSE jsonb_build_object(
        'stableSlugPreserved',TRUE,'identityAndAliasesComplete',TRUE,
        'controlledTaxonomyComplete',TRUE,'anatomyComplete',TRUE,
        'exerciseDifficultyOnly',TRUE,'overallDifficultyFormula','max',
        'exactVariantCount',7,'newKettlebellVariantCount',1,
        'newDeliveryProfileCount',2,'loadFatigueRecoveryComplete',TRUE,
        'constraintsComplete',TRUE,'dosageAndDurationComplete',TRUE,
        'athleteSupportComplete',TRUE,'coachSupportComplete',TRUE,
        'supportOperationsComplete',TRUE,'requiredEvidenceSections',16,
        'candidateMediaCount',5,'reviewRelationshipCount',2,
        'reviewCalibrationCount',2,'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE,
        'humanReviewRequired',TRUE,'publicationQuarantined',TRUE)
    END,
    CASE definition.id
      WHEN source_id THEN jsonb_build_array(
        jsonb_build_object('code','CARD-IDENTITY-EXECUTABLE-01',
          'message','Base, laterality, implement quantity, rack, equipment operations, and repetition boundary require authoritative human evidence.'),
        jsonb_build_object('code','CARD-MEDIA-01',
          'message','Adjacent media requires human exact-match and quality review.'),
        jsonb_build_object('code','CARD-PUBLISH-01',
          'message','Archived identity is intentionally nonprescribable.'))
      ELSE jsonb_build_array(
        jsonb_build_object('code','CARD-MEDIA-01',
          'message','A human must approve a healthy exact-match demonstration for the current card version.'),
        jsonb_build_object('code','CARD-GRAPH-03',
          'message','A qualified coach must review and approve the kettlebell and dumbbell relationship proposals.'),
        jsonb_build_object('code','CARD-CALIBRATION-01',
          'message','Independent difficulty calibration evidence and reviewer approval are required.'),
        jsonb_build_object('code','CARD-PUBLISH-01',
          'message','Publication remains blocked until all human quality gates pass.'))
    END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(source_id,survivor_id)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  actual_count := (SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.id IN(source_id,survivor_id)
      AND definition.provenance_json->>'kettlebellIdentityMigration'=migration_key
      AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
      AND definition.last_reviewed_at IS NULL
      AND definition.approved_video_url IS NULL);
  IF actual_count<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source_id AND status='archived' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=survivor_id AND status='review' AND card_version=3) THEN
    RAISE EXCEPTION '% expected one archived source and one review survivor',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id IN(source_id,survivor_id)
       AND evidence.reviewed_card_version=CASE evidence.definition_id
         WHEN survivor_id THEN 3 ELSE 2 END
       AND evidence.review_status='candidate')<>32
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=source_id
         AND evidence.reviewed_card_version=2
         AND evidence.review_status='candidate')<>16
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=survivor_id
         AND evidence.reviewed_card_version=3
         AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% expected 16 candidate evidence sections per card',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id IN(source_id,survivor_id)
       AND media.reviewed_card_version=CASE media.definition_id
         WHEN survivor_id THEN 3 ELSE 2 END
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>8
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id IN(source_id,survivor_id)
         AND alternate.reviewed_card_version=CASE alternate.definition_id
           WHEN survivor_id THEN 3 ELSE 2 END
         AND alternate.review_status='candidate'
         AND alternate.reviewer_user_id IS NULL
         AND alternate.reviewed_at IS NULL)<>15 THEN
    RAISE EXCEPTION '% expected candidate-only 8-media and 15-alternate packets',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.definition_id=survivor_id AND variant.status='review')<>7
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=source_id AND variant.status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.id=new_variant_id AND variant.status='review'
         AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
           =greatest(
             (variant.difficulty_json->>'technicalComplexity')::INTEGER,
             (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id IN(source_id,survivor_id)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id=new_variant_id
       AND profile.profile_key IN(
         'capacity-strength','resilience-controlled-volume')
       AND profile.status='review'
       AND cardinality(profile.equipment_required)>0)<>2
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id=new_variant_id
         AND calibration.dimension IN(
           'technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review'
         AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected complete review-only profiles and calibration',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
     WHERE relationship.from_variant_id IN(new_variant_id,
         (SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id=survivor_id
            AND variant_key='dumbbell-standing-neutral'))
       AND relationship.to_variant_id IN(new_variant_id,
         (SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id=survivor_id
            AND variant_key='dumbbell-standing-neutral'))
       AND relationship.review_status='review'
       AND relationship.reviewed_by IS NULL
       AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected both review-only relationship proposals',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.survivor_definition_id=source_id
       AND resolution.resolved_definition_id=survivor_id
       AND resolution.decision='needs_human_review'
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'retirementMigration'=migration_key)<>1
    OR(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
       WHERE(resolution.survivor_definition_id,resolution.resolved_definition_id)
         IN((z_press_id,survivor_id),(bench_press_id,survivor_id),
            (bench_press_id,seated_press_id))
         AND resolution.decision='distinct_exercises'
         AND resolution.resolution_source='deterministic_identity_equivalence'
         AND resolution.reviewed_by IS NULL
         AND resolution.evidence_json->>'migration'=migration_key)<>3 THEN
    RAISE EXCEPTION '% failed to persist source review and press boundaries',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise exercise
     WHERE exercise.facility_id=1 AND exercise.id IN(490,491)
       AND exercise.archived IS TRUE AND exercise.is_published IS FALSE
       AND exercise.skill_level IS NULL)<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(490,491)
         AND safety.minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% found invalid legacy selection or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id IN(source_id,survivor_id)
       AND packet.card_version=CASE packet.definition_id
         WHEN survivor_id THEN 3 ELSE 2 END
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE)<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(source_id,survivor_id)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           definition.anatomy_json,definition.athlete_support_json,
           definition.coach_support_json,definition.support_operations_json,
           definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
       WHERE media.definition_id IN(source_id,survivor_id)
         AND(media.review_status IN('approved','shortlisted','rejected')
           OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
           OR media.exact_variant_match IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
