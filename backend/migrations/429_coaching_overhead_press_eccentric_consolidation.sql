-- Resolve the mixed-base Dumbbell Overhead Press Eccentric collision without
-- inventing a standing or seated identity. The ambiguous source is archived;
-- its authored 4-6 second lowering concept becomes explicit full-cycle tempo
-- variants on the existing standing and seated overhead-press definitions.
--
-- Every active variant declares base, implement, grip, rack, no-leg-drive
-- policy, concentric return, eccentric tempo, range, equipment operations,
-- dosage, fatigue, recovery, quality gates, and stop rules. Evidence, media,
-- graph, calibration, and cards remain candidate/review only. No approval is
-- fabricated. Exercise cards contain exercise complexity and physical
-- difficulty only; overall is their maximum. Athlete proficiency is excluded.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '429_coaching_overhead_press_eccentric_consolidation';
  research_batch CONSTANT TEXT :=
    'overhead-press-eccentric-consolidation-v1';
  research_version CONSTANT TEXT := '2026-08-01.7';
  ambiguous_slug CONSTANT TEXT := 'dumbbell-overhead-press-eccentric';
  standing_slug CONSTANT TEXT := 'strict-overhead-press';
  seated_slug CONSTANT TEXT := 'seated-barbell-overhead-press';
  ambiguous_legacy_id CONSTANT BIGINT := 774;
  standing_legacy_id CONSTANT BIGINT := 404;
  seated_legacy_id CONSTANT BIGINT := 405;
  ambiguous_id UUID;
  standing_id UUID;
  seated_id UUID;
  applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT id INTO ambiguous_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=ambiguous_slug;
  SELECT id INTO standing_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=standing_slug;
  SELECT id INTO seated_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=seated_slug;

  IF ambiguous_id IS NULL OR standing_id IS NULL OR seated_id IS NULL THEN
    RAISE EXCEPTION '% requires all three overhead-press definitions',
      migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id=ambiguous_id
      AND source.legacy_exercise_id=ambiguous_legacy_id
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id=standing_id
      AND source.legacy_exercise_id=standing_legacy_id
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id=seated_id
      AND source.legacy_exercise_id=seated_legacy_id
  ) THEN
    RAISE EXCEPTION '% requires preserved legacy source lineage 774, 404, and 405',
      migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id=resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id=standing_id
      AND duplicate.slug='dumbbell-strict-overhead-press'
      AND resolution.decision='duplicate_consolidated'
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id=resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id=standing_id
      AND duplicate.slug='sandbag-strict-overhead-press-strength'
      AND resolution.decision='duplicate_consolidated'
  ) OR NOT EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id=resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id=seated_id
      AND duplicate.slug='seated-dumbbell-overhead-press'
      AND resolution.decision='duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION '% requires the prior standing and seated implement consolidations',
      migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
    AND definition.provenance_json->>'eccentricIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,3) THEN
    RAISE EXCEPTION '% found a partial prior application',migration_key;
  END IF;

  IF applied_count=0 THEN
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ambiguous_id AND status='review' AND card_version=1
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=standing_id AND status='review' AND card_version=1
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=seated_id AND status='review' AND card_version=2
    ) THEN
      RAISE EXCEPTION '% expected source versions 1, 1, and 2 in review',
        migration_key;
    END IF;
  ELSE
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ambiguous_id AND status='archived' AND card_version=2
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=standing_id AND status='review' AND card_version=2
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=seated_id AND status='review' AND card_version=3
    ) THEN
      RAISE EXCEPTION '% found prior-application card drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
      AND(ARRAY[resolution.survivor_definition_id,
            resolution.resolved_definition_id] @> ARRAY[ambiguous_id,standing_id]
        OR ARRAY[resolution.survivor_definition_id,
            resolution.resolved_definition_id] @> ARRAY[ambiguous_id,seated_id])
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
        AND(definition.status IN('published','deprecated')
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id IN(ambiguous_id,standing_id,seated_id))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id IN(ambiguous_id,standing_id,seated_id))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id IN(ambiguous_id,standing_id,seated_id))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      WHERE variant.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      WHERE variant.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=calibration.variant_id
      WHERE variant.definition_id IN(ambiguous_id,standing_id,seated_id)
        AND(calibration.status<>'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(
          ambiguous_legacy_id,standing_legacy_id,seated_legacy_id)
        AND(score.human_review_status<>'queued'
          OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF applied_count=0 THEN
    UPDATE coaching.exercise_section_evidence_v1 evidence
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE evidence.definition_id IN(ambiguous_id,standing_id,seated_id)
      AND evidence.review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 media
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
    WHERE media.definition_id IN(ambiguous_id,standing_id,seated_id)
      AND media.review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 alternate
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE alternate.definition_id IN(ambiguous_id,standing_id,seated_id)
      AND alternate.review_status='candidate';
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=ambiguous_id
    AND profile.status<>'archived';

  UPDATE coaching.exercise_variant_v1 variant
  SET status='archived',
    difficulty_json=jsonb_build_object(
      'scoringStatus','blocked_pending_exact_identity',
      'technicalComplexity',NULL,'absoluteLoadDemand',NULL,
      'baseOverallDifficulty',NULL,
      'reason','standing versus seated base and complete repetition cycle are unresolved',
      'athleteProficiencyExcluded',TRUE),
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'missingIdentityDimensions',jsonb_build_array(
          'base','back_support','grip','rack','concentric_return',
          'assistance','pickup','set_down','spotting','repetition_boundary'),
        'retirementMigration',migration_key),
    load_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','load and equipment handling require an exact base and repetition cycle'),
    fatigue_profile_json=jsonb_build_object(
      'status','blocked_pending_exact_identity',
      'reason','eccentric fatigue and recovery require exact load, volume, range, base, and return method'),
    programming_profile_json=jsonb_build_object(
      'selectable',FALSE,'selectionPolicy','blocked_pending_identity_contract',
      'replacementPolicy','choose_an_explicit_standing_or_seated_full_cycle_variant'),
    updated_at=now()
  WHERE variant.definition_id=ambiguous_id;

  UPDATE coaching.exercise_variant_v1 variant
  SET variant_key='legacy-generic-baseline',
    display_name='Legacy Generic Standing Overhead Press Source',
    status='archived',
    requirements_json=coalesce(variant.requirements_json,'{}'::JSONB)
      ||jsonb_build_object(
        'selectable',FALSE,'identityQuarantine',TRUE,
        'quarantineReason','The generic source does not declare implement, grip, rack, range, tempo, equipment operations, dose, quality gate, or stop rules.'),
    updated_at=now()
  WHERE variant.definition_id=standing_id
    AND variant.variant_key='baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id=variant.id
    AND variant.definition_id=standing_id
    AND variant.status='archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='archived',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Dumbbell Overhead Press Eccentric (Unresolved Legacy)',
    display_name='Dumbbell Overhead Press Eccentric (Unresolved Legacy)',
    description='Archived nonprescribable legacy label. It permits either standing or seated execution and does not declare grip, support, how the dumbbells reach lockout, whether the concentric press belongs to each repetition, assistance, pickup, set-down, spotting, or a complete repetition boundary. Choose an explicit standing or seated full-cycle tempo variant instead.',
    family_key='unresolved_overhead_press_eccentric_identity_quarantine',
    content_confidence=92,scoring_confidence=1,media_confidence=28,
    movement_patterns=ARRAY['push','brace'],
    body_regions=ARRAY['shoulder','upper_arm','forearm','core','spine'],
    required_equipment=ARRAY[]::TEXT[],optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'known',jsonb_build_array('overhead_clearance','two_dumbbells'),
      'unresolved',jsonb_build_array(
        'standing_footprint_or_bench','back_support','rack_or_handoff',
        'spotter_position','pickup_path','set_down_path'),
      'selectionBlocked',TRUE),
    population_json=jsonb_build_object(
      'selectionBlocked',TRUE,
      'reason','readiness cannot be matched to an undefined base and repetition cycle',
      'supportPath','choose_an_explicit_standing_or_seated_full_cycle_variant'),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'generic_overhead_press_lowering_involvement_only'),
      'secondaryMuscles',jsonb_build_array(),
      'joints',jsonb_build_array(
        'shoulder','scapulothoracic','elbow','wrist','thoracic_spine','lumbar_spine'),
      'jointActions',jsonb_build_array(
        'exact_actions_blocked_pending_base_and_repetition_cycle'),
      'planes',jsonb_build_array('scapular_and_sagittal_unresolved_by_grip'),
      'laterality','bilateral_dumbbell_wording_without_grip_or_path_contract',
      'humanReviewRequired',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This source label combines materially different setups and is unavailable until an exact task is chosen.',
      'primaryCue','Ask the coach for the named standing or seated full-cycle variant.',
      'secondaryCues',jsonb_build_array(
        'Do not lift from this card','Use the replacement card setup and stop rules'),
      'expectedSensations',jsonb_build_array(),
      'unexpectedSensations',jsonb_build_array(
        'pain','instability','numbness_or_tingling','dizziness','pressure_symptoms'),
      'painGuidance','Do not begin from this unresolved card; stop any replacement exercise for pain, instability, neurologic symptoms, dizziness, or unsafe equipment control.',
      'selfChecks',jsonb_build_array(
        'exact replacement name is visible','base and support are declared',
        'grip and full repetition cycle are declared','pickup and set-down are declared'),
      'accessibility',jsonb_build_array(
        'plain-language retirement explanation','text-first exact replacement instructions'),
      'mediaAlternatives',jsonb_build_array(
        'text explanation of missing identity facts','coach-selected exact card')),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'base','support','implement_quantity','grip','rack','concentric_return',
        'eccentric_seconds','range','spotting','pickup','set_down','repetition_boundary'),
      'faultCorrections',jsonb_build_array(
        'Do not cue or dose until every identity and equipment-control field is declared'),
      'demonstrationPlan',jsonb_build_array(
        'Explain why stand-or-sit and reset wording is non-executable',
        'Open the exact replacement card before demonstrating'),
      'groupManagement',jsonb_build_object(
        'selectionBlocked',TRUE,'stationAssignment','none_from_this_card'),
      'modificationDecisionTree',jsonb_build_object(
        'standing_full_cycle','choose_standing_tempo_variant',
        'seated_back_supported_full_cycle','choose_seated_tempo_variant',
        'assisted_eccentric_only','author_or_select_a_separate_reviewed_definition'),
      'doNotUseWhen',jsonb_build_array('always_while_identity_is_unresolved')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity','base','repetition_cycle','equipment_operations','media_mismatch'),
      'supportEscalation',jsonb_build_object(
        'contentReview',jsonb_build_array(
          'authoritative_source_supplied','new_exact_variant_requested'),
        'urgent',jsonb_build_array('injury_event','dropped_implement')),
      'retentionPolicy','Preserve source 774, its original wording, evidence, adjacent media, and all prior queue decisions.',
      'changeImpactPolicy','Do not reactivate without authoritative base, support, grip, return, range, spotting, pickup, set-down, and repetition-boundary evidence.',
      'knownLimitations',jsonb_build_array(
        'mixed_base_source','undefined_return_cycle','no_exact_reviewed_media'),
      'supportSummary','Retirement is deliberate; do not silently map this source to standing or seated.'),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'eccentricIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','retire_ambiguous_source_without_direct_consolidation',
      'candidateStandingDefinition',standing_slug,
      'candidateSeatedDefinition',seated_slug,
      'difficultyStatus','blocked_pending_exact_identity',
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'approvalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=ambiguous_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name='Standing Strict Overhead Press',
    display_name='Standing Strict Overhead Press',
    aliases=ARRAY(SELECT DISTINCT alias_value FROM unnest(
      coalesce(definition.aliases,'{}')||ARRAY[
        'Strict Overhead Press','Standing Overhead Press','Military Press',
        'Barbell Strict Press','Dumbbell Strict Press','Sandbag Strict Press',
        'Standing Dumbbell Overhead Press Eccentric']) alias_value
      ORDER BY alias_value),
    description='Stand on a level surface with a declared bilateral free-weight rack. Brace without deliberate knee or hip drive, press to an owned overhead finish, then return under control to the same rack. The exact variant declares implement, quantity, grip, load, range, tempo, spotting, pickup, set-down, dose, quality gate, and stop rules.',
    family_key='standing_bilateral_strict_free_weight_overhead_press',
    content_confidence=90,scoring_confidence=70,media_confidence=46,
    movement_patterns=ARRAY['push','brace'],
    body_regions=ARRAY[
      'shoulder','upper_arm','forearm','upper_back','core','spine','hip','knee','foot'],
    required_equipment=ARRAY[]::TEXT[],
    optional_equipment=ARRAY['barbell','dumbbell','sandbag','squat_rack','plates','collars'],
    environment_json='{
      "surface":{"required":"level_dry_non_slip","clearFootprint":true},
      "space":{"overheadClearance":true,"clearPickupAndSetDownPath":true,"noCrossTraffic":true},
      "equipment":{"inspectionRequired":true,"rackHeightDeclared":true,"collarsRequiredForLoadedBarbell":true,"matchedDumbbellsRequired":true},
      "spotting":{"requiredByLoadRiskAndFacilityPolicy":true,"handoffAndFailurePlanDeclared":true},
      "sharedStation":{"oneActiveLifterInsidePressingZone":true}
    }'::JSONB,
    population_json='{
      "prerequisites":["pain_free_owned_overhead_range","stable_standing_base","can_control_front_rack_and_overhead_finish","safe_pickup_and_setdown_understood"],
      "useCaution":["recent_shoulder_elbow_wrist_neck_or_back_symptoms","limited_overhead_range","poor_rib_pelvis_control","recent_high_volume_pressing","unfamiliar_equipment_handoff"],
      "doNotUseWhen":["pain_or_neurologic_symptoms","dizziness_or_pressure_symptoms","unsafe_equipment_or_clearance","cannot_control_rack_overhead_finish_or_setdown"],
      "regressionOrder":["reduce_load","shorten_owned_range","neutral_grip_dumbbells","seated_supported_press_after_review","non_overhead_substitution_after_review"],
      "individualizationRequired":true,
      "medicalClearancePolicy":"Follow the athlete care plan and local scope; this card does not diagnose symptoms or clear return to training."
    }'::JSONB,
    anatomy_json='{
      "primaryMuscles":["anterior_deltoid","medial_deltoid","triceps_brachii","upper_trapezius"],
      "secondaryMuscles":["clavicular_pectoralis_major","serratus_anterior","posterior_deltoid","forearm_flexors_and_extensors"],
      "stabilizers":["rotator_cuff","scapular_stabilizers","abdominal_wall","spinal_erectors","gluteals"],
      "joints":["glenohumeral","scapulothoracic","elbow","wrist","thoracic_spine","lumbar_spine","pelvis","hip","knee","ankle","foot"],
      "jointActions":["shoulder_flexion_and_abduction","scapular_upward_rotation","elbow_extension","controlled_elbow_flexion","wrist_stabilization","thoracolumbar_anti_extension","standing_base_isometric_control"],
      "planes":["scapular","sagittal","frontal"],
      "laterality":"bilateral_with_implement_specific_linked_or_independent_paths",
      "kineticChain":"standing_closed_chain_base_with_open_chain_vertical_press",
      "evidenceLimit":"Configuration-specific anatomy and demand vary by implement, grip, range, load, and individual structure."
    }'::JSONB,
    athlete_support_json='{
      "whyItMatters":"Builds strict overhead pressing strength and control from a standing base without using leg drive.",
      "primaryCue":"Stand tall, brace, press without a dip, own the top, and lower to the same rack.",
      "secondaryCues":["Feet stay planted","Ribs stay stacked","Wrists stay over elbows","Finish and lower under control"],
      "expectedSensations":["shoulder_and_triceps_effort","upper_back_and_trunk_bracing","grip_effort","greater_time_under_tension_on_tempo_variants"],
      "unexpectedSensations":["sharp_or_increasing_pain","joint_pinch","numbness_or_tingling","dizziness","pressure_symptoms","loss_of_balance_or_implement_control"],
      "painGuidance":"Stop, secure the implement, and tell the coach about pain, instability, neurologic symptoms, dizziness, pressure symptoms, or an unsafe rack or set-down.",
      "selfChecks":["exact_variant_and_load_are_declared","no_knee_or_hip_drive","feet_and_ribs_remain_stable","path_is_controlled_and_symmetric","tempo_and_range_match_the_card","implement_is_secured_before_relaxing"],
      "accessibility":["lighter_load","neutral_grip_dumbbells","shorter_owned_range","longer_rest","text_and_still_sequence","audio_description","live_demonstration"],
      "mediaAlternatives":["step_by_step_text","front_and_side_stills","captioned_video_required_for_approval","coach_demonstration"]
    }'::JSONB,
    coach_support_json='{
      "observationChecklist":["equipment_and_clearance","foot_pressure_and_balance","rack_and_grip","rib_pelvis_position","scapular_motion","wrist_elbow_stack","bar_or_dumbbell_path","symmetry","owned_range","eccentric_seconds","breathing","effort","secure_finish"],
      "faultCorrections":[
        {"fault":"leg_drive","action":"reduce_load_and_restart_from_a_static_rack"},
        {"fault":"rib_flare_or_backward_lean","action":"reduce_load_or_range_and_restore_stack"},
        {"fault":"asymmetric_or_diverging_path","action":"stop_set_reduce_load_and_rehearse_exact_grip_and_rack"},
        {"fault":"tempo_break","action":"end_tempo_set_or_reduce_load"},
        {"fault":"unsafe_pickup_rerack_or_setdown","action":"stop_and_rebuild_equipment_plan"}],
      "demonstrationPlan":["show_exact_implement_grip_and_rack","show_no_leg_drive","show_owned_overhead_finish","show_declared_eccentric_tempo","show_safe_rerack_or_setdown","contrast_leg_drive_rib_flare_and_path_loss"],
      "groupManagement":{"oneActiveLifterPerZone":true,"coachSightLine":"front_oblique_and_side","rackTrafficControlled":true,"dumbbellsNotLeftInWalkway":true},
      "modificationDecisionTree":{"pain_or_neurologic_symptom":"stop_and_escalate","range_not_owned":"reduce_range_or_use_reviewed_substitution","path_or_stack_changes":"reduce_load_or_end_set","tempo_not_repeatable":"reduce_load_repetitions_or_end_set","equipment_plan_unsafe":"do_not_start"},
      "doNotUseWhen":["overhead_clearance_or_footing_is_unsafe","rack_handoff_or_setdown_is_uncontrolled","pain_instability_neurologic_dizziness_or_pressure_symptoms","no_leg_drive_or_owned_range_cannot_be_preserved"]
    }'::JSONB,
    support_operations_json='{
      "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
      "supportEscalation":{"urgent":["injury_event","dropped_implement","neurologic_or_pressure_symptom"],"coachReview":["repeated_path_or_tempo_failure","side_asymmetry","dose_or_load_mismatch"],"contentReview":["unclear_variant","conflicting_instruction","media_mismatch"]},
      "retentionPolicy":"Retain card version, exact variant, load, range, tempo, repetitions, effort, symptoms, stop reason, equipment event, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"Changes to base, implement, grip, rack, leg drive, repetition cycle, range, tempo, difficulty, dose, media, or graph relationships require a new card version and renewed affected reviews.",
      "knownLimitations":["no_human_approved_media","scores_and_graph_edges_are_review_proposals","tempo_dose_requires_local_calibration"],
      "supportSummary":"Never convert a strict press to a push press or an eccentric-only assisted repetition without selecting a different exact contract."
    }'::JSONB,
    provenance_json=definition.provenance_json||jsonb_build_object(
      'eccentricIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','standing_survivor_with_exact_implement_grip_and_tempo_variants',
      'ambiguousSourceRetainedAsArchived',ambiguous_slug,
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=standing_id;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=3,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    aliases=ARRAY(SELECT DISTINCT alias_value FROM unnest(
      coalesce(definition.aliases,'{}')||ARRAY[
        'Seated Dumbbell Overhead Press Eccentric',
        'Seated Dumbbell Press with Slow Lower']) alias_value
      ORDER BY alias_value),
    support_operations_json=coalesce(definition.support_operations_json,'{}'::JSONB)
      ||jsonb_build_object(
        'eccentricTempoVariantPolicy','A 4-6 second lower remains an exact variant with a complete active concentric press, declared grip, back support, range, load, pickup, and set-down.',
        'tempoDoseCalibrationRequired',TRUE),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'eccentricIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityResolution','seated_survivor_with_explicit_full_cycle_tempo_variants',
      'ambiguousSourceRetainedAsArchived',ambiguous_slug,
      'exerciseDifficultyModel','max_exercise_complexity_physical_difficulty',
      'athleteProficiencyExcluded',TRUE,'humanReviewRequired',TRUE,
      'publicationQuarantined',TRUE,'mediaApprovalCreated',FALSE,
      'graphApprovalCreated',FALSE,'calibrationApprovalCreated',FALSE),
    updated_at=now()
  WHERE definition.id=seated_id;

  CREATE TEMP TABLE press_variant_seed(
    definition_slug TEXT,
    variant_key TEXT,
    display_name TEXT,
    modifier_keys TEXT[],
    exercise_complexity SMALLINT,
    physical_difficulty SMALLINT,
    supervision_demand SMALLINT,
    failure_consequence SMALLINT,
    impact SMALLINT,
    work_capacity_demand SMALLINT,
    equipment TEXT[],
    implement TEXT,
    grip TEXT,
    base TEXT,
    eccentric_seconds_min SMALLINT,
    eccentric_seconds_max SMALLINT
  ) ON COMMIT DROP;

  INSERT INTO press_variant_seed VALUES
    (standing_slug,'barbell-standing-pronated',
      'Standing Barbell Strict Overhead Press — Pronated Grip',
      ARRAY['standing','barbell','pronated_grip','bilateral','strict'],
      54,64,62,66,2,58,
      ARRAY['barbell','plates','collars','squat_rack'],
      'one_barbell','pronated_declared_width','standing_level_bilateral_base',
      2,3),
    (standing_slug,'dumbbell-standing-neutral',
      'Standing Dumbbell Strict Overhead Press — Neutral Grip',
      ARRAY['standing','two_dumbbells','neutral_grip','bilateral','strict'],
      56,54,58,56,2,54,
      ARRAY['dumbbell'],'two_matched_dumbbells','neutral',
      'standing_level_bilateral_base',2,3),
    (standing_slug,'dumbbell-standing-pronated',
      'Standing Dumbbell Strict Overhead Press — Pronated Grip',
      ARRAY['standing','two_dumbbells','pronated_grip','bilateral','strict'],
      58,56,60,58,2,56,
      ARRAY['dumbbell'],'two_matched_dumbbells','pronated',
      'standing_level_bilateral_base',2,3),
    (standing_slug,'sandbag-standing-front-rack',
      'Standing Sandbag Strict Overhead Press — Front Rack',
      ARRAY['standing','sandbag','front_rack','bilateral','strict'],
      58,60,62,64,2,58,
      ARRAY['sandbag'],'one_sandbag','declared_bilateral_sandbag_grip',
      'standing_level_bilateral_base',2,3),
    (standing_slug,'dumbbell-standing-neutral-eccentric-4-6',
      'Standing Dumbbell Strict Press — Neutral Grip, 4–6-Second Lower',
      ARRAY['standing','two_dumbbells','neutral_grip','bilateral','strict','eccentric_4_6_seconds'],
      62,58,66,62,2,64,
      ARRAY['dumbbell'],'two_matched_dumbbells','neutral',
      'standing_level_bilateral_base',4,6),
    (standing_slug,'dumbbell-standing-pronated-eccentric-4-6',
      'Standing Dumbbell Strict Press — Pronated Grip, 4–6-Second Lower',
      ARRAY['standing','two_dumbbells','pronated_grip','bilateral','strict','eccentric_4_6_seconds'],
      64,60,68,64,2,66,
      ARRAY['dumbbell'],'two_matched_dumbbells','pronated',
      'standing_level_bilateral_base',4,6),
    (seated_slug,'dumbbell-back-supported-neutral-eccentric-4-6',
      'Back-Supported Seated Dumbbell Press — Neutral Grip, 4–6-Second Lower',
      ARRAY['seated','back_supported','two_dumbbells','neutral_grip','bilateral','strict','eccentric_4_6_seconds'],
      58,54,62,58,2,62,
      ARRAY['dumbbell','bench'],'two_matched_dumbbells','neutral',
      'stable_upright_back_supported_bench',4,6),
    (seated_slug,'dumbbell-back-supported-pronated-eccentric-4-6',
      'Back-Supported Seated Dumbbell Press — Pronated Grip, 4–6-Second Lower',
      ARRAY['seated','back_supported','two_dumbbells','pronated_grip','bilateral','strict','eccentric_4_6_seconds'],
      60,56,64,60,2,64,
      ARRAY['dumbbell','bench'],'two_matched_dumbbells','pronated',
      'stable_upright_back_supported_bench',4,6);

  INSERT INTO coaching.exercise_variant_v1(
    definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT definition.id,seed.variant_key,seed.display_name,seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',seed.exercise_complexity,
      'absoluteLoadDemand',seed.physical_difficulty,
      'baseOverallDifficulty',greatest(
        seed.exercise_complexity,seed.physical_difficulty),
      'coordinationDemand',seed.exercise_complexity,
      'supervisionDemand',seed.supervision_demand,
      'failureConsequence',seed.failure_consequence,
      'impact',seed.impact,
      'workCapacityDemand',seed.work_capacity_demand,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'dimensionMeaning',jsonb_build_object(
        'technicalComplexity','exercise_complexity',
        'absoluteLoadDemand','physical_difficulty'),
      'athleteProficiencyExcluded',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base',seed.base,'implement',seed.implement,
      'implementQuantity',CASE seed.implement
        WHEN 'two_matched_dumbbells' THEN 2 ELSE 1 END,
      'grip',seed.grip,
      'rack',CASE seed.implement
        WHEN 'one_barbell' THEN 'front_shoulders_or_upper_chest_owned_start'
        WHEN 'one_sandbag' THEN 'declared_front_rack_at_upper_chest_or_shoulders'
        ELSE 'shoulder_level_owned_start' END,
      'path','in_front_of_head_to_owned_overhead_finish',
      'legDrive','none_deliberate',
      'repetitionCycle','active_strict_press_then_controlled_return_to_same_rack',
      'range','pain_free_owned_rack_to_overhead_finish',
      'eccentricSeconds',jsonb_build_object(
        'minimum',seed.eccentric_seconds_min,
        'maximum',seed.eccentric_seconds_max),
      'concentricIntent','controlled_without_leg_drive',
      'breathing','declared_repeatable_strategy_without_prolonged_straining',
      'spotting','required_by_load_risk_and_facility_policy',
      'pickupAndSetDown',CASE seed.implement
        WHEN 'one_barbell' THEN 'rack_only_unless_reviewed_plan_declares_otherwise'
        WHEN 'one_sandbag' THEN 'declared_two_hand_pickup_front_rack_and_controlled_setdown'
        ELSE 'declared_thigh_assist_or_spotter_handoff_and_controlled_setdown' END,
      'equipmentRequired',to_jsonb(seed.equipment)),
    'review',
    jsonb_build_object(
      'gripDemand',CASE seed.implement
        WHEN 'one_barbell' THEN 46 WHEN 'one_sandbag' THEN 64 ELSE 54 END,
      'spinalLoading',CASE seed.base
        WHEN 'standing_level_bilateral_base' THEN 46 ELSE 30 END,
      'eccentricStress',CASE WHEN seed.eccentric_seconds_min>=4 THEN 72 ELSE 54 END,
      'landingContactsPerRep',0,
      'externalLoadMethod',seed.implement,
      'externalLoadDescription',seed.display_name,
      'loadTracking',jsonb_build_array(
        'external_load','repetitions','eccentric_seconds','range',
        'rir_or_rpe','set_duration')),
    jsonb_build_object(
      'localMuscleFatigue',CASE WHEN seed.eccentric_seconds_min>=4 THEN 68 ELSE 58 END,
      'gripFatigue',CASE seed.implement
        WHEN 'one_sandbag' THEN 64 ELSE 50 END,
      'technicalFatigueSensitivity',seed.exercise_complexity,
      'impactAccumulation',seed.impact,
      'recoveryHours',CASE WHEN seed.eccentric_seconds_min>=4 THEN 48 ELSE 36 END,
      'primaryFatigueSites',jsonb_build_array(
        'deltoids','triceps','upper_back','rotator_cuff','forearms','trunk'),
      'stopBefore',jsonb_build_array(
        'base_or_bench_contact_loss','rib_flare_or_backward_lean',
        'asymmetric_path','wrist_or_elbow_collapse','range_loss',
        'tempo_break','grinding_rep','unsafe_rerack_or_setdown')),
    jsonb_build_object(
      'trainingStimuli',CASE WHEN seed.eccentric_seconds_min>=4 THEN
        jsonb_build_array('bilateral_overhead_strength','eccentric_control',
          'time_under_tension','triceps_and_deltoid_capacity')
        ELSE jsonb_build_array('bilateral_overhead_strength',
          'triceps_strength','scapular_control','trunk_bracing') END,
      'stimulusDose',jsonb_build_object(
        'primary','quality_external_load_repetitions',
        'fatigueCeiling',CASE WHEN seed.eccentric_seconds_min>=4
          THEN 'low_to_moderate' ELSE 'moderate' END),
      'weeklyExposure',jsonb_build_object('typical',1,'maximumWithoutReview',3),
      'prerequisites',jsonb_build_array(
        'owned_overhead_range','stable_declared_base',
        'safe_equipment_pickup_and_setdown'),
      'completionCriteria',jsonb_build_array(
        'strict_no_leg_drive','stable_base_and_rib_pelvis_position',
        'symmetric_owned_path','declared_tempo_and_range',
        'secure_finish'),
      'sequenceRules',jsonb_build_array(
        'after_specific_warmup',
        'before_fatigue_sensitive_throwing_or_overhead_skill',
        'before_dense_press_conditioning'),
      'pairingCompatibility',jsonb_build_object(
        'preferred',jsonb_build_array('lower_body_strength','low_fatigue_mobility'),
        'avoid',jsonb_build_array('high_density_overhead_or_triceps_work')),
      'interferenceRules',jsonb_build_array(
        'counts_toward_shoulder_triceps_grip_and_press_volume_budgets',
        'tempo_variants_add_eccentric_and_recovery_budget'),
      'uncertaintyPolicy',jsonb_build_object(
        'unclear_variant_or_equipment_plan','do_not_lift',
        'range_load_or_tempo_uncertain','reduce_load_or_use_simpler_variant'),
      'cumulativeBudget',jsonb_build_object(
        'shoulderPressVolume','external_load_times_repetitions',
        'eccentricTimeSecondsPerRep',jsonb_build_object(
          'minimum',seed.eccentric_seconds_min,
          'maximum',seed.eccentric_seconds_max),
        'technicalSensitivity',seed.exercise_complexity,
        'impact',seed.impact))
  FROM press_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=seed.definition_slug
  ON CONFLICT(definition_id,variant_key) DO UPDATE SET
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
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
    CASE profile.profile_key WHEN 'capacity-strength' THEN
      'Build strict overhead strength with repeatable equipment control and two or more repetitions in reserve.'
      ELSE 'Build controlled overhead range, position, and eccentric timing without chasing fatigue.' END,
    CASE profile.profile_key WHEN 'capacity-strength' THEN 86 ELSE 82 END,
    CASE profile.profile_key WHEN 'capacity-strength' THEN 84 ELSE 88 END,
    CASE profile.profile_key WHEN 'capacity-strength' THEN
      jsonb_build_object('strength',95,'tissue_capacity',76,'movement_quality',72)
      ELSE jsonb_build_object('strength',72,'tissue_capacity',90,'movement_quality',92) END,
    jsonb_build_object(
      'volumeUnit','repetitions','sets',jsonb_build_object('minimum',2,'maximum',4),
      'repetitionsPerSet',CASE
        WHEN seed.eccentric_seconds_min>=4 THEN jsonb_build_object('minimum',3,'maximum',6)
        WHEN profile.profile_key='capacity-strength' THEN jsonb_build_object('minimum',3,'maximum',8)
        ELSE jsonb_build_object('minimum',5,'maximum',10) END,
      'restSeconds',CASE profile.profile_key
        WHEN 'capacity-strength' THEN jsonb_build_object('minimum',120,'maximum',240)
        ELSE jsonb_build_object('minimum',90,'maximum',180) END,
      'effort','finish_with_two_or_more_repeatable_repetitions_in_reserve',
      'eccentricSeconds',jsonb_build_object(
        'minimum',seed.eccentric_seconds_min,'maximum',seed.eccentric_seconds_max),
      'range','pain_free_owned_range'),
    'Every repetition preserves the declared base, no leg drive, rib-pelvis position, grip, path, owned range, eccentric timing, and secure return.',
    ARRAY[
      'Stop for pain, instability, numbness, dizziness, pressure symptoms, or unsafe equipment control.',
      'Stop for loss of base or bench contact, repeated rib flare, asymmetric path, range loss, or wrist or elbow collapse.',
      'Stop when eccentric timing changes, a repetition grinds, the spot is unavailable, or rerack or set-down would be unsafe.'],
    'Verify the exact variant, equipment, clearance, base, grip, rack, range, tempo, load, spot, pickup, and set-down. Count only repetitions that pass every quality gate.',
    'Use the named setup. Press without a dip, own the top, lower for the declared time to the same rack, and secure the implement before relaxing.',
    CASE profile.profile_key WHEN 'capacity-strength' THEN
      'Improved strict overhead pressing strength with repeatable path and equipment control.'
      ELSE 'Improved overhead position and eccentric control at a tolerable submaximal dose.' END,
    seed.equipment,
    jsonb_build_object(
      'stationSeconds',CASE WHEN seed.eccentric_seconds_min>=4 THEN 360 ELSE 300 END,
      'athletesPerStation',1,'setupSeconds',60,'transitionSeconds',45,
      'overheadClearanceRequired',TRUE,'spottingPlanRequired',TRUE,
      'sharedEquipmentPolicy','one_active_lifter_and_clear_walkway'),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'secondsPerRep',jsonb_build_object(
        'minimum',seed.eccentric_seconds_min+2,
        'maximum',seed.eccentric_seconds_max+4),
      'setSeconds',CASE WHEN seed.eccentric_seconds_min>=4
        THEN jsonb_build_object('minimum',18,'maximum',60)
        ELSE jsonb_build_object('minimum',12,'maximum',50) END,
      'restSeconds',CASE profile.profile_key
        WHEN 'capacity-strength' THEN jsonb_build_object('minimum',120,'maximum',240)
        ELSE jsonb_build_object('minimum',90,'maximum',180) END,
      'durationInputs',jsonb_build_array(
        'repetitions','eccentric_seconds','concentric_seconds','setup','rest')),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'reduce_load','reduce_repetitions','shorten_owned_range',
        'use_neutral_grip_dumbbell_variant','increase_rest'),
      'progressOrder',jsonb_build_array(
        'improve_range_and_path','complete_all_tempo_repetitions',
        'add_repetition','add_small_load'),
      'changeOneVariableAtATime',TRUE,
      'neverChangeSilently',jsonb_build_array(
        'base','implement','grip','leg_drive','repetition_cycle','tempo')),
    jsonb_build_object(
      'primary','completed_quality_repetitions',
      'record',jsonb_build_array(
        'external_load','range','eccentric_seconds','repetitions','rir_or_rpe',
        'path_quality','symmetry','symptoms','stop_reason'),
      'failedRepPolicy','do_not_count_and_end_or_reduce_load'),
    jsonb_build_object(
      'before',jsonb_build_array(
        'Confirm exact variant, load, range, tempo, clearance, spot, pickup, and set-down.',
        'Report current shoulder, elbow, wrist, neck, back, neurologic, dizziness, or pressure symptoms.'),
      'during',jsonb_build_array(
        'Call tempo, path, and stop immediately when a gate fails.'),
      'after',jsonb_build_array(
        'Record load, repetitions, range, tempo, effort, symptoms, and stop reason.',
        'Review same-day and next-day response before increasing dose.'))
  FROM press_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=seed.definition_slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key
  CROSS JOIN(VALUES
    ('capacity-strength','capacity','primary'),
    ('resilience-tempo-control','resilience','secondary')
  ) profile(profile_key,phase_key,role)
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
    CASE definition.id WHEN seated_id THEN 3 ELSE 2 END,
    section.section_key,source.source_url,source.source_title,
    source.source_publisher,source.source_kind,
    CASE definition.id
      WHEN ambiguous_id THEN jsonb_build_array(
        'Candidate evidence documents why '||section.section_key||
          ' cannot be safely inferred from the mixed standing-or-seated source with an undefined return cycle.',
        'The source is archived and nonselectable; the evidence creates no identity, score, dosage, media, graph, calibration, or publication approval.')
      WHEN standing_id THEN jsonb_build_array(
        'Candidate evidence was reassessed for exact standing base, bilateral free-weight implement, grip, front rack, strict no-leg-drive action, active press, controlled return, owned range, tempo, equipment operations, dosage, quality gates, and stop rules in section '||section.section_key||'.',
        'Exercise difficulty uses complexity and physical difficulty only, with overall as their maximum; media, graph, calibration, and publication require human review.')
      ELSE jsonb_build_array(
        'Candidate evidence was reassessed for exact seated base, support, bilateral implement, grip, rack, strict action, active press, controlled return, owned range, 4-6 second tempo variants, equipment operations, dosage, quality gates, and stop rules in section '||section.section_key||'.',
        'Exercise difficulty uses complexity and physical difficulty only, with overall as their maximum; media, graph, calibration, and publication require human review.')
    END,
    source.evidence_quality,'candidate',NULL,NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN(VALUES
    ('identity'),('taxonomy'),('anatomy'),('biomechanics'),('difficulty'),
    ('load_fatigue_recovery'),('constraints'),('dosage'),('instructions'),
    ('safety_stop_rules'),('programming'),('athlete_support'),
    ('coach_support'),('accessibility'),('alternates'),('media')
  ) section(section_key)
  CROSS JOIN LATERAL(
    SELECT
      CASE
        WHEN section.section_key='media' THEN
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'
        WHEN section.section_key='load_fatigue_recovery' THEN
          'https://pubmed.ncbi.nlm.nih.gov/42401924/'
        WHEN section.section_key IN('dosage','programming') THEN
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC7739265/'
        WHEN section.section_key IN(
          'identity','biomechanics','difficulty','coach_support','alternates') THEN
          'https://pubmed.ncbi.nlm.nih.gov/23096062/'
        WHEN section.section_key IN('taxonomy','anatomy') THEN
          'https://pubmed.ncbi.nlm.nih.gov/35936912/'
        WHEN section.section_key IN('safety_stop_rules','accessibility') THEN
          'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'
        ELSE
          'https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf'
      END source_url,
      CASE
        WHEN section.section_key='media' THEN 'Embed videos and playlists'
        WHEN section.section_key='load_fatigue_recovery' THEN
          'The effect of eccentric phase tempo on acute neuromechanical responses and short-term post-exercise recovery in healthy trained and recreationally active adults: a systematic review'
        WHEN section.section_key IN('dosage','programming') THEN
          'Implementing Eccentric Resistance Training-Part 2: Practical Recommendations'
        WHEN section.section_key IN(
          'identity','biomechanics','difficulty','coach_support','alternates') THEN
          'Effects of Body Position and Loading Modality on Muscle Activity and Strength in Shoulder Presses'
        WHEN section.section_key IN('taxonomy','anatomy') THEN
          'Front vs Back and Barbell vs Machine Overhead Press: An Electromyographic Analysis and Implications for Resistance Training'
        WHEN section.section_key IN('safety_stop_rules','accessibility') THEN
          'Youth Resistance Training: Updated Position Statement Paper From the NSCA'
        ELSE 'Basics of Strength and Conditioning Manual'
      END source_title,
      CASE
        WHEN section.section_key='media' THEN 'YouTube Help'
        WHEN section.section_key='load_fatigue_recovery' THEN
          'BMC Sports Science, Medicine and Rehabilitation'
        WHEN section.section_key IN('dosage','programming') THEN
          'International Journal of Environmental Research and Public Health'
        WHEN section.section_key IN(
          'identity','biomechanics','difficulty','coach_support','alternates') THEN
          'Journal of Strength and Conditioning Research'
        WHEN section.section_key IN('taxonomy','anatomy') THEN
          'Frontiers in Physiology'
        ELSE 'National Strength and Conditioning Association'
      END source_publisher,
      CASE
        WHEN section.section_key='media' THEN 'manufacturer_instruction'
        WHEN section.section_key IN(
          'constraints','instructions','safety_stop_rules',
          'athlete_support','accessibility') THEN 'professional_standard'
        ELSE 'peer_reviewed_research'
      END source_kind,
      CASE
        WHEN section.section_key='media' THEN 82
        WHEN section.section_key='load_fatigue_recovery' THEN 90
        WHEN section.section_key IN('dosage','programming') THEN 88
        WHEN section.section_key IN(
          'identity','biomechanics','difficulty','coach_support','alternates') THEN 87
        WHEN section.section_key IN('taxonomy','anatomy') THEN 86
        WHEN section.section_key IN('safety_stop_rules','accessibility') THEN 88
        ELSE 84
      END::SMALLINT evidence_quality
  ) source
  WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT definition.id,NULL,
    CASE definition.id WHEN seated_id THEN 3 ELSE 2 END,
    media.url,'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel_name,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,NULL,
    media.notes
  FROM(VALUES
    (standing_slug,'https://www.youtube.com/watch?v=iJ0py9JQIZY','iJ0py9JQIZY','How To Barbell Press | The Starting Strength Method','Starting Strength','standing strict barbell overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Title-level candidate only; full exact-variant, cue, safety, captions, accessibility, quality, reviewer, and approval review remain unresolved.'),
    (standing_slug,'https://www.youtube.com/watch?v=nNMR9fRGRjQ','nNMR9fRGRjQ','How to Press: Proper Overhead Press Form (Step-by-Step Tutorial)','Barbell Logic','standing strict barbell overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Title-level candidate only; all human review gates remain unresolved.'),
    (standing_slug,'https://www.youtube.com/watch?v=22gQUcvcW1o','22gQUcvcW1o','Dumbbell Strict Press','Marcus Filly','standing dumbbell strict press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Stance, grip, range, full cycle, tempo, safety, accessibility, reviewer, and approval remain unresolved.'),
    (standing_slug,'https://www.youtube.com/watch?v=q4SAD8Q93UU','q4SAD8Q93UU','Dumbbell Strict Press','98 Training','standing dumbbell strict press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Stance, grip, range, full cycle, tempo, safety, accessibility, reviewer, and approval remain unresolved.'),
    (standing_slug,'https://www.youtube.com/watch?v=Y4sfLqqbpVs','Y4sfLqqbpVs','Sandbag Strict Press Demo','Steph Gaudreau - Fuel Your Strength','standing sandbag strict press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Rack, grip, path, range, safety, accessibility, reviewer, and approval remain unresolved.'),
    (seated_slug,'https://www.youtube.com/watch?v=ECWxumBMLVQ','ECWxumBMLVQ','How To: Seated Barbell Shoulder Press','ScottHermanFitness','seated barbell overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Title-level candidate; all exact-variant and human review gates remain unresolved.'),
    (seated_slug,'https://www.youtube.com/watch?v=PhCNJy_Td7U','PhCNJy_Td7U','How To: SEATED PRESS - The Press Accessory You NEED To Try!','Barbell Logic','seated barbell press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Implement and exact dimensions require human review.'),
    (seated_slug,'https://www.youtube.com/watch?v=C0We_bEyxlM','C0We_bEyxlM','How To Do: Seated Dumbbell Overhead Press','MuscleWiki','seated dumbbell overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Title-level candidate; exact grip, support, range, tempo, safety, accessibility, reviewer, and approval remain unresolved.'),
    (seated_slug,'https://www.youtube.com/watch?v=xg-7dS8ZGKE','xg-7dS8ZGKE','Seated Dumbbell Overhead Press','Women''s Strength Nation by Holly Perkins','seated dumbbell overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Title-level candidate; all human review gates remain unresolved.'),
    (seated_slug,'https://www.youtube.com/watch?v=en2Kbfvx4eA','en2Kbfvx4eA','Seated Dumbbell Eccentric Press | Shoulder | Strength and Conditioning Exercises','Rehab My Patient','seated dumbbell eccentric overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. Exact grip, support, range, active return, tempo, safety, accessibility, reviewer, and approval remain unresolved.'),
    (ambiguous_slug,'https://www.youtube.com/watch?v=XAT5vx_7G10','XAT5vx_7G10','Eccentric Dumbbell Shoulder Press','Hungry 2 Evolve','dumbbell overhead press eccentric','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. The title does not declare base, grip, support, return cycle, or exact tempo; adjacent evidence only.'),
    (ambiguous_slug,'https://www.youtube.com/watch?v=en2Kbfvx4eA','en2Kbfvx4eA','Seated Dumbbell Eccentric Press | Shoulder | Strength and Conditioning Exercises','Rehab My Patient','seated dumbbell eccentric overhead press','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. The title establishes one seated interpretation that cannot be imported into the mixed-base source; adjacent evidence only.'),
    (ambiguous_slug,'https://www.youtube.com/watch?v=WYsfnPmrfp4','WYsfnPmrfp4','Dumbbell Shoulder Press Eccentric','Calvin Dietz','dumbbell shoulder press eccentric','YouTube oEmbed metadata verified 2026-08-01T16:00:00Z. The title does not declare base, grip, support, return cycle, or exact tempo; adjacent evidence only.')
  ) media(definition_slug,url,video_id,title,channel_name,source_query,notes)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=media.definition_slug
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
    CASE definition.id WHEN seated_id THEN 3 ELSE 2 END,
    alternate.alternate_name,alternate.classification,alternate.rationale,
    alternate.dimensions,
    CASE WHEN alternate.classification='new_definition' THEN
      jsonb_build_object('status','proposal_only','humanReviewRequired',TRUE,
        'sourceCard',alternate.definition_slug) ELSE NULL END,
    'candidate',NULL,NULL
  FROM(VALUES
    (standing_slug,'Standing Barbell Strict Overhead Press','new_variant','A barbell links both hands while preserving the standing strict vertical press.','{"implement":"barbell","base":"standing","legDrive":"none"}'::JSONB),
    (standing_slug,'Standing Dumbbell Strict Overhead Press','new_variant','Two dumbbells add independent paths while preserving the standing strict vertical press.','{"implement":"two_dumbbells","base":"standing"}'::JSONB),
    (standing_slug,'Standing Sandbag Strict Overhead Press','new_variant','The sandbag changes grip, rack, load distribution, and failure handling within the standing strict press.','{"implement":"sandbag","rack":"declared_front_rack"}'::JSONB),
    (standing_slug,'Standing Dumbbell Overhead Press with 4–6-Second Lower','new_variant','A prolonged eccentric phase changes tempo, dose, fatigue, and recovery while preserving a complete standing strict press.','{"tempo":"4_to_6_second_eccentric","repetitionCycle":"active_press_and_controlled_return"}'::JSONB),
    (standing_slug,'Seated Overhead Press','new_definition','A seated base changes balance, trunk demand, setup, support, and equipment operations.','{"base":"seated"}'::JSONB),
    (standing_slug,'Push Press','new_definition','Deliberate knee and hip drive changes the action and power intent.','{"legDrive":"deliberate","intent":"linked_power"}'::JSONB),
    (standing_slug,'Single-Arm Overhead Press','new_definition','Unilateral loading changes laterality and trunk demand.','{"laterality":"unilateral"}'::JSONB),
    (standing_slug,'Load, Repetitions, Rest, Range, or Eccentric Seconds','modifier_annotation','These are dose or execution modifiers after an exact variant is selected.','{"modifiers":["load","repetitions","rest","range","eccentric_seconds"]}'::JSONB),
    (seated_slug,'Back-Supported Seated Dumbbell Press with 4–6-Second Lower','new_variant','A prolonged eccentric phase changes tempo, dose, fatigue, and recovery while preserving the complete seated press.','{"tempo":"4_to_6_second_eccentric","support":"upright_back_support"}'::JSONB),
    (seated_slug,'Neutral-Grip Seated Dumbbell Press','new_variant','Grip changes wrist, elbow, and shoulder orientation within the bilateral seated press.','{"grip":"neutral"}'::JSONB),
    (seated_slug,'Pronated-Grip Seated Dumbbell Press','new_variant','Grip changes wrist, elbow, and shoulder orientation within the bilateral seated press.','{"grip":"pronated"}'::JSONB),
    (seated_slug,'Unsupported Seated Overhead Press','new_variant','Removing back support raises trunk-position demand while preserving the seated base.','{"backSupport":"none"}'::JSONB),
    (seated_slug,'Standing Overhead Press','new_definition','Standing changes base, balance, trunk demand, setup, and failure response.','{"base":"standing"}'::JSONB),
    (seated_slug,'Seated Push Press','new_definition','Deliberate drive changes the strict action and intent.','{"legDrive":"deliberate"}'::JSONB),
    (seated_slug,'Seated Single-Arm Overhead Press','new_definition','Unilateral loading changes laterality and frontal and transverse trunk demand.','{"laterality":"unilateral"}'::JSONB),
    (seated_slug,'Load, Repetitions, Rest, Range, Bench Angle, or Eccentric Seconds','modifier_annotation','These are dose or setup modifiers after the exact seated variant is selected.','{"modifiers":["load","repetitions","rest","range","bench_angle","eccentric_seconds"]}'::JSONB),
    (ambiguous_slug,'Standing Dumbbell Strict Press with 4–6-Second Lower','same_identity','If authoritative evidence establishes standing, active press, declared grip, and full cycle, use the corresponding standing tempo variant.','{"possibleMapping":"strict-overhead-press","requiredFacts":["standing","active_press","declared_grip","full_cycle"]}'::JSONB),
    (ambiguous_slug,'Seated Back-Supported Dumbbell Press with 4–6-Second Lower','same_identity','If authoritative evidence establishes seated back support, active press, declared grip, and full cycle, use the corresponding seated tempo variant.','{"possibleMapping":"seated-barbell-overhead-press","requiredFacts":["seated","back_supported","active_press","declared_grip"]}'::JSONB),
    (ambiguous_slug,'Unsupported Seated Dumbbell Press with 4–6-Second Lower','new_variant','An unsupported seated base has a different trunk and setup contract and requires explicit review.','{"base":"seated_unsupported","tempo":"4_to_6_second_eccentric"}'::JSONB),
    (ambiguous_slug,'Assisted Eccentric-Only Dumbbell Overhead Lower','new_definition','An assisted reset removes the concentric press and creates a different action, logistics, dose, and failure protocol.','{"concentricAction":"assisted_or_absent","spotter":"required"}'::JSONB),
    (ambiguous_slug,'Single-Arm Eccentric Dumbbell Overhead Press','new_definition','One-arm loading changes laterality and trunk demands.','{"laterality":"unilateral"}'::JSONB),
    (ambiguous_slug,'Eccentric Dumbbell Push Press','new_definition','Deliberate leg drive changes the concentric action and power intent.','{"legDrive":"deliberate"}'::JSONB),
    (ambiguous_slug,'Load, Range, Eccentric Seconds, Repetitions, or Rest','modifier_annotation','These become modifiers only after base, grip, return cycle, and equipment operations are fixed.','{"modifiers":["load","range","eccentric_seconds","repetitions","rest"]}'::JSONB)
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
    (standing_slug,'dumbbell-standing-neutral',standing_slug,'dumbbell-standing-neutral-eccentric-4-6','progression',82,ARRAY['tempo','fatigue','control']::TEXT[],'A 4-6 second lower increases time under tension, technical timing, and recovery demand while preserving base, grip, active press, range, and equipment operations.','{"requires":["repeatable_normal_tempo_path","load_reduced_for_full_tempo","recovery_monitored"]}'::JSONB),
    (standing_slug,'dumbbell-standing-neutral-eccentric-4-6',standing_slug,'dumbbell-standing-neutral','regression',92,ARRAY['tempo','fatigue','control']::TEXT[],'Returning to a controlled 2-3 second lower preserves the standing neutral-grip press while reducing eccentric duration and fatigue.','{"useWhen":["tempo_break","recovery_cost_too_high","session_goal_is_strength_not_tempo"]}'::JSONB),
    (standing_slug,'dumbbell-standing-pronated',standing_slug,'dumbbell-standing-pronated-eccentric-4-6','progression',82,ARRAY['tempo','fatigue','control']::TEXT[],'A 4-6 second lower increases time under tension, technical timing, and recovery demand while preserving the pronated standing press.','{"requires":["repeatable_normal_tempo_path","load_reduced_for_full_tempo","recovery_monitored"]}'::JSONB),
    (standing_slug,'dumbbell-standing-pronated-eccentric-4-6',standing_slug,'dumbbell-standing-pronated','regression',92,ARRAY['tempo','fatigue','control']::TEXT[],'Returning to a controlled 2-3 second lower reduces eccentric duration while preserving the pronated standing press.','{"useWhen":["tempo_break","recovery_cost_too_high","session_goal_is_strength_not_tempo"]}'::JSONB),
    (seated_slug,'dumbbell-back-supported-neutral',seated_slug,'dumbbell-back-supported-neutral-eccentric-4-6','progression',84,ARRAY['tempo','fatigue','control']::TEXT[],'A 4-6 second lower increases time under tension while preserving back support, neutral grip, active press, and equipment operations.','{"requires":["repeatable_normal_tempo_path","load_reduced_for_full_tempo","recovery_monitored"]}'::JSONB),
    (seated_slug,'dumbbell-back-supported-neutral-eccentric-4-6',seated_slug,'dumbbell-back-supported-neutral','regression',94,ARRAY['tempo','fatigue','control']::TEXT[],'A controlled 2-3 second lower reduces eccentric duration while preserving the back-supported neutral-grip press.','{"useWhen":["tempo_break","recovery_cost_too_high","session_goal_is_strength_not_tempo"]}'::JSONB),
    (seated_slug,'dumbbell-back-supported-pronated',seated_slug,'dumbbell-back-supported-pronated-eccentric-4-6','progression',84,ARRAY['tempo','fatigue','control']::TEXT[],'A 4-6 second lower increases time under tension while preserving back support, pronated grip, active press, and equipment operations.','{"requires":["repeatable_normal_tempo_path","load_reduced_for_full_tempo","recovery_monitored"]}'::JSONB),
    (seated_slug,'dumbbell-back-supported-pronated-eccentric-4-6',seated_slug,'dumbbell-back-supported-pronated','regression',94,ARRAY['tempo','fatigue','control']::TEXT[],'A controlled 2-3 second lower reduces eccentric duration while preserving the back-supported pronated-grip press.','{"useWhen":["tempo_break","recovery_cost_too_high","session_goal_is_strength_not_tempo"]}'::JSONB),
    (standing_slug,'barbell-standing-pronated',standing_slug,'dumbbell-standing-pronated','lateral_substitution',74,ARRAY['equipment','stability','load']::TEXT[],'Two dumbbells preserve the standing bilateral strict-press purpose but change linked-hand stability, independent paths, pickup, set-down, and loading potential.','{"useWhen":["barbell_unavailable","independent_paths_preferred"],"notEquivalentFor":["barbell_specific_strength","maximum_load"]}'::JSONB),
    (standing_slug,'dumbbell-standing-pronated',standing_slug,'barbell-standing-pronated','lateral_substitution',74,ARRAY['equipment','stability','load']::TEXT[],'A barbell preserves the standing bilateral strict-press purpose but changes linked-hand stability, rack, spotting, and loading potential.','{"useWhen":["matched_dumbbells_unavailable","barbell_rack_and_path_owned"],"notEquivalentFor":["independent_arm_control"]}'::JSONB),
    (standing_slug,'dumbbell-standing-neutral',seated_slug,'dumbbell-back-supported-neutral','lateral_substitution',66,ARRAY['base','support','stability']::TEXT[],'A back-supported seated neutral-grip press can preserve a bilateral overhead-strength purpose when standing control is not appropriate, but it changes base and trunk demand.','{"useWhen":["standing_base_not_owned","back_supported_position_selected"],"notEquivalentFor":["standing_trunk_and_balance_demand"]}'::JSONB),
    (seated_slug,'dumbbell-back-supported-neutral',standing_slug,'dumbbell-standing-neutral','lateral_substitution',66,ARRAY['base','support','stability']::TEXT[],'A standing neutral-grip press preserves the bilateral overhead-strength purpose but adds balance and trunk demand and requires a different setup.','{"requires":["stable_standing_base","owned_no_leg_drive_press"],"notEquivalentFor":["seated_supported_loading"]}'::JSONB)
  ) edge(from_slug,from_key,to_slug,to_key,relationship,similarity_score,dimensions,reason,conditions)
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.slug=edge.from_slug
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=from_definition.id
      AND from_variant.variant_key=edge.from_key
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.slug=edge.to_slug
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=to_definition.id
      AND to_variant.variant_key=edge.to_key
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
        'Candidate exercise-complexity anchor based on base, independent path, grip, equipment operations, strict no-leg-drive control, range, and eccentric timing; independent human calibration is required.'
      ELSE
        'Candidate physical-difficulty anchor based on external load potential, local muscular demand, eccentric time under tension, range, volume, and recovery; independent human calibration is required.'
    END,
    'review',1,NULL,NULL,
    'No score approval is created by migration 429.',NULL
  FROM press_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug=seed.definition_slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key
  CROSS JOIN LATERAL(VALUES
    ('technicalComplexity',seed.exercise_complexity),
    ('absoluteLoadDemand',seed.physical_difficulty)
  ) calibration(dimension,score)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET rationale='The source remains ambiguous between standing and seated execution and does not define grip, support, how lockout is regained, assistance, pickup, set-down, or a complete repetition cycle. Migration 429 archives it without direct consolidation and supplies separate review-state full-cycle standing and seated tempo variants; a qualified human may reactivate or map the source only with authoritative missing facts.',
    evidence_json=coalesce(resolution.evidence_json,'{}'::JSONB)
      ||jsonb_build_object(
        'retirementMigration',migration_key,
        'resolution','retire_ambiguous_source_without_direct_consolidation',
        'standingCandidate',standing_slug,'seatedCandidate',seated_slug,
        'humanReviewStillRequiredForSourceMapping',TRUE,
        'approvalCreated',FALSE),
    resolved_at=now()
  WHERE resolution.decision='needs_human_review'
    AND resolution.reviewed_by IS NULL
    AND resolution.survivor_definition_id=ambiguous_id
    AND resolution.resolved_definition_id IN(standing_id,seated_id);

  UPDATE coaching.exercise exercise
  SET name='Dumbbell Overhead Press Eccentric (Unresolved Legacy)',
    description='Archived mixed-base source. Standing versus seated execution, grip, support, return method, pickup, set-down, spotting, and repetition boundary are unresolved.',
    instructions='Do not prescribe from this source. Select an explicit standing or seated full-cycle tempo variant.',
    card_summary='Archived nonprescribable identity; retained for source traceability.',
    coach_language='Choose an exact standing or seated replacement. Do not infer base, grip, return, assistance, or equipment operations.',
    athlete_language='This card is unavailable because the setup and full repetition are not defined.',
    programming_logic=jsonb_build_object(
      'selectable',FALSE,'identityQuarantine',TRUE,
      'replacementPolicy','choose_exact_standing_or_seated_full_cycle_variant',
      'difficultyStatus','blocked_pending_exact_identity'),
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'missingIdentityDimensions',jsonb_build_array(
        'base','back_support','grip','rack','concentric_return','assistance',
        'pickup','set_down','spotting','repetition_boundary')),
    coaching_execution=jsonb_build_object(
      'selectionBlocked',TRUE,
      'supportMessage','Open the exact replacement card before setup or instruction.'),
    skill_level=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=ambiguous_legacy_id
    AND exercise.slug=ambiguous_slug;

  UPDATE coaching.exercise exercise
  SET name='Standing Strict Overhead Press',
    description='A bilateral standing free-weight overhead press from a declared front rack to an owned overhead finish and back to the same rack without deliberate knee or hip drive.',
    instructions='Declare implement, grip, rack, load, range, eccentric tempo, spot, pickup, set-down, dose, and stop signal. Stand on level footing, brace, press without leg drive, own the top, lower to the same rack, and secure the implement.',
    default_sets=3,default_reps=5,default_work_seconds=NULL,
    default_rest_seconds=150,tempo='declared_by_exact_variant',
    load_note='Use a load that preserves the exact path, range, tempo, and at least two repeatable repetitions in reserve.',
    est_seconds_per_set=180,skill_level=NULL,
    card_summary='Standing bilateral strict overhead press with exact barbell, dumbbell, sandbag, grip, and eccentric-tempo variants.',
    coach_language='Verify base, rack, grip, no leg drive, rib-pelvis position, path, range, tempo, breathing, spot, and secure finish. Stop before grinding or equipment-control loss.',
    athlete_language='Stand tall, brace, press without a dip, own the top, lower for the declared time, and secure the weight.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'selectionRule','exact_variant_required',
      'fatigueRule','place_before_fatigue_sensitive_overhead_skill_or_dense_pressing',
      'tempoRule','long_eccentric_variants_reduce_load_or_repetitions_and_add_recovery_budget',
      'substitutionRule','never_silently_change_base_leg_drive_laterality_or_repetition_cycle'),
    scalable_variables=ARRAY[
      'implement','grip','load','range','repetitions','eccentric_seconds','rest_seconds'],
    movement_family='Standing bilateral strict free-weight overhead press',
    primary_phase_key='capacity',phase_subrole='vertical_press_strength',
    primary_order_slot='standing_strict_overhead_press',
    movement_requirements=jsonb_build_object(
      'base','standing_level_bilateral','legDrive','none_deliberate',
      'repetitionCycle','active_press_and_controlled_return',
      'requiredEnvironment',jsonb_build_array(
        'level_non_slip_footing','overhead_clearance',
        'clear_pickup_and_setdown_path','no_cross_traffic'),
      'exactVariantRequired',TRUE),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare exact implement, grip, rack, load, range, tempo, spot, pickup, set-down, dose, and stop rule.',
        'Inspect footing, equipment, overhead clearance, rack, pressing zone, and traffic.'),
      'executionSteps',jsonb_build_array(
        'Establish the standing base and front rack.',
        'Brace and press without knee or hip drive.',
        'Reach the owned overhead finish without excessive lean.',
        'Lower for the declared time to the same rack.',
        'Secure the implement before relaxing.'),
      'qualityGate','Stable base, no leg drive, controlled rib-pelvis position, declared grip and path, owned range, exact tempo, and safe equipment finish.',
      'stopSigns',jsonb_build_array(
        'symptoms_or_dizziness','base_or_position_loss','path_or_range_loss',
        'tempo_break','grinding_rep','unsafe_spot_rerack_or_setdown')),
    why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.facility_id=1 AND exercise.id=standing_legacy_id
    AND exercise.slug=standing_slug;

  UPDATE coaching.exercise
  SET skill_level=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE facility_id=1 AND id=seated_legacy_id AND slug=seated_slug;

  INSERT INTO coaching.exercise_difficulty_profile(
    exercise_id,technical,load,overall,recommended_age_min,
    recommended_age_max,attention_demand,notes,source,complexity,updated_at)
  VALUES
    (standing_legacy_id,5.4,6.4,6.4,NULL,NULL,'high',
      'Exercise complexity 54/100; physical difficulty 64/100; overall is max=64. Exact variants override these base anchors. Athlete proficiency is not an exercise field.',
      'candidate_research',NULL,now()),
    (seated_legacy_id,4.6,6.0,6.0,NULL,NULL,'high',
      'Exercise complexity 46/100; physical difficulty 60/100; overall is max=60. Exact variants override these base anchors. Athlete proficiency is not an exercise field.',
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
  VALUES(standing_legacy_id,'Default',TRUE,'reps',3,5,NULL,NULL,NULL,NULL,
    150,'declared_by_exact_variant','external_load','moderate_to_high',6,8,
    'Use exact variant load, range, eccentric timing, and equipment operations; finish with at least two repeatable repetitions in reserve.',
    180,'2 sets of 3 quality repetitions','4 sets of 8 quality repetitions',NULL,24)
  ON CONFLICT(exercise_id,profile_name) DO UPDATE SET
    is_default=TRUE,volume_unit=EXCLUDED.volume_unit,
    default_sets=EXCLUDED.default_sets,default_reps=EXCLUDED.default_reps,
    default_work_seconds=NULL,default_distance=NULL,default_contacts=NULL,
    default_rounds=NULL,default_rest_seconds=EXCLUDED.default_rest_seconds,
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
  SET risk_level=3,impact_level=1,requires_spotting=TRUE,
    requires_coach_supervision='recommended',minimum_age_recommended=NULL,
    minimum_skill_level=NULL,
    minimum_prerequisite_notes='Pain-free owned overhead range, stable standing base, controlled front rack and overhead finish, and safe equipment pickup, spotting, rerack, and set-down.',
    readiness_checks=ARRAY[
      'Inspect footing, equipment, rack, overhead clearance, pressing zone, and traffic.',
      'Confirm the exact variant, load, grip, range, tempo, pickup, set-down, and spot.',
      'Confirm a pain-free warm-up press with stable base, no leg drive, and repeatable path.'],
    contraindications=ARRAY[
      'Pain, instability, neurologic symptoms, dizziness, pressure symptoms, or acute shoulder, elbow, wrist, neck, or back irritation.',
      'Unsafe equipment, footing, overhead clearance, rack, spot, pickup, set-down, or traffic.',
      'Cannot preserve base, no leg drive, owned range, path, tempo, or equipment control.'],
    stop_signs=ARRAY[
      'Pain, joint pinch, numbness, instability, dizziness, or pressure symptoms.',
      'Loss of balance or bench contact, repeated rib flare, asymmetric path, wrist or elbow collapse, or range loss.',
      'Tempo break, grinding repetition, failed press, unsafe spot, rerack, or set-down.'],
    common_substitutions=ARRAY[
      'Lighter Standing Dumbbell Strict Press','Neutral-Grip Standing Dumbbell Strict Press',
      'Back-Supported Seated Dumbbell Overhead Press','Reviewed Non-Overhead Press']
  WHERE safety.exercise_id=standing_legacy_id;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,
    CASE definition.id WHEN seated_id THEN 3 ELSE 2 END,
    '1.0.0',migration_key,'quarantined',
    CASE definition.id
      WHEN ambiguous_id THEN jsonb_build_object(
        'stableSlugPreserved',TRUE,'legacySourcePreserved',TRUE,
        'identityExecutable',FALSE,'selectionBlocked',TRUE,
        'standingOrSeatedUnresolved',TRUE,'repetitionCycleUnresolved',TRUE,
        'difficultyStatus','blocked_pending_exact_identity',
        'athleteProficiencyExcluded',TRUE,
        'requiredEvidenceSections',16,'candidateMediaCount',3,
        'mediaApprovalCreated',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE)
      WHEN standing_id THEN jsonb_build_object(
        'stableSlugPreserved',TRUE,'identityAndAliasesComplete',TRUE,
        'controlledTaxonomyComplete',TRUE,'anatomyComplete',TRUE,
        'exerciseDifficultyOnly',TRUE,'overallDifficultyFormula','max',
        'exactVariantCount',6,'deliveryProfileCount',12,
        'loadFatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
        'dosageAndDurationComplete',TRUE,'athleteSupportComplete',TRUE,
        'coachSupportComplete',TRUE,'supportOperationsComplete',TRUE,
        'requiredEvidenceSections',16,'candidateMediaCount',5,
        'reviewRelationshipCount',8,'reviewCalibrationCount',12,
        'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE)
      ELSE jsonb_build_object(
        'stableSlugPreserved',TRUE,'identityAndAliasesComplete',TRUE,
        'controlledTaxonomyComplete',TRUE,'anatomyComplete',TRUE,
        'exerciseDifficultyOnly',TRUE,'overallDifficultyFormula','max',
        'exactVariantCount',6,'newTempoVariantCount',2,
        'newDeliveryProfileCount',4,
        'loadFatigueRecoveryComplete',TRUE,'constraintsComplete',TRUE,
        'dosageAndDurationComplete',TRUE,'athleteSupportComplete',TRUE,
        'coachSupportComplete',TRUE,'supportOperationsComplete',TRUE,
        'requiredEvidenceSections',16,'candidateMediaCount',5,
        'reviewRelationshipCount',8,'reviewCalibrationCount',4,
        'mediaApprovalCreated',FALSE,'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE,'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE)
    END,
    CASE definition.id
      WHEN ambiguous_id THEN jsonb_build_array(
        jsonb_build_object('code','CARD-IDENTITY-EXECUTABLE-01',
          'message','Standing versus seated base and the complete repetition cycle require authoritative human evidence.'),
        jsonb_build_object('code','CARD-MEDIA-01',
          'message','Adjacent media requires human exact-match and quality review.'),
        jsonb_build_object('code','CARD-PUBLISH-01',
          'message','Archived identity is intentionally nonprescribable.'))
      ELSE jsonb_build_array(
        jsonb_build_object('code','CARD-MEDIA-01',
          'message','A human must approve a healthy exact-match demonstration for the current card version.'),
        jsonb_build_object('code','CARD-GRAPH-03',
          'message','A qualified coach must review and approve progression, regression, and substitution edges.'),
        jsonb_build_object('code','CARD-CALIBRATION-01',
          'message','Independent calibration evidence and reviewer approval are required.'),
        jsonb_build_object('code','CARD-PUBLISH-01',
          'message','Publication remains blocked until all human quality gates pass.'))
    END,
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,
    card_version=EXCLUDED.card_version,schema_version='1.0.0',
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
    AND definition.provenance_json->>'eccentricIdentityMigration'=migration_key
    AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
    AND definition.last_reviewed_at IS NULL
    AND definition.approved_video_url IS NULL;
  IF actual_count<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ambiguous_id AND status='archived' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=standing_id AND status='review' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=seated_id AND status='review' AND card_version=3) THEN
    RAISE EXCEPTION '% expected one archived source and two review survivors',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id IN(ambiguous_id,standing_id,seated_id)
       AND evidence.reviewed_card_version=CASE evidence.definition_id
         WHEN seated_id THEN 3 ELSE 2 END
       AND evidence.review_status='candidate')<>48
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=ambiguous_id
         AND evidence.reviewed_card_version=2
         AND evidence.review_status='candidate')<>16
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=standing_id
         AND evidence.reviewed_card_version=2
         AND evidence.review_status='candidate')<>16
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=seated_id
         AND evidence.reviewed_card_version=3
         AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% expected 16 candidate evidence sections per card',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id IN(ambiguous_id,standing_id,seated_id)
       AND media.reviewed_card_version=CASE media.definition_id
         WHEN seated_id THEN 3 ELSE 2 END
       AND media.review_status='candidate' AND media.link_status='healthy'
       AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>13
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id IN(ambiguous_id,standing_id,seated_id)
         AND alternate.reviewed_card_version=CASE alternate.definition_id
           WHEN seated_id THEN 3 ELSE 2 END
         AND alternate.review_status='candidate'
         AND alternate.reviewer_user_id IS NULL
         AND alternate.reviewed_at IS NULL)<>23 THEN
    RAISE EXCEPTION '% expected candidate-only 13-media and 23-alternate packets',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_variant_v1 variant
     WHERE variant.definition_id=standing_id AND variant.status='review')<>6
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=seated_id AND variant.status='review')<>6
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       WHERE variant.definition_id=ambiguous_id AND variant.status<>'archived')
    OR(SELECT count(*) FROM coaching.exercise_variant_v1 variant
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id=variant.definition_id
       WHERE definition.slug IN(standing_slug,seated_slug)
         AND variant.status='review'
         AND(variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
           =greatest(
             (variant.difficulty_json->>'technicalComplexity')::INTEGER,
             (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER))<>12
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id=variant.definition_id
       WHERE definition.id IN(standing_id,seated_id)
         AND variant.status='review'
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           variant.difficulty_json,variant.requirements_json,
           variant.load_profile_json,variant.fatigue_profile_json,
           variant.programming_profile_json))) THEN
    RAISE EXCEPTION '% found invalid variant, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=variant.definition_id
     WHERE definition.slug IN(standing_slug,seated_slug)
       AND variant.variant_key IN(SELECT variant_key FROM press_variant_seed)
       AND profile.profile_key IN(
         'capacity-strength','resilience-tempo-control')
       AND profile.status='review'
       AND cardinality(profile.equipment_required)>0)<>16
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       JOIN coaching.exercise_variant_v1 variant
         ON variant.id=calibration.variant_id
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id=variant.definition_id
       WHERE definition.slug IN(standing_slug,seated_slug)
         AND variant.variant_key IN(SELECT variant_key FROM press_variant_seed)
         AND calibration.dimension IN(
           'technicalComplexity','absoluteLoadDemand')
         AND calibration.status='review'
         AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>16 THEN
    RAISE EXCEPTION '% expected complete review-only profiles and calibration',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
     JOIN coaching.exercise_variant_v1 from_variant
       ON from_variant.id=relationship.from_variant_id
     JOIN coaching.exercise_definition_v1 from_definition
       ON from_definition.id=from_variant.definition_id
     JOIN coaching.exercise_variant_v1 to_variant
       ON to_variant.id=relationship.to_variant_id
     JOIN coaching.exercise_definition_v1 to_definition
       ON to_definition.id=to_variant.definition_id
     WHERE from_definition.slug IN(standing_slug,seated_slug)
       AND to_definition.slug IN(standing_slug,seated_slug)
       AND(from_variant.variant_key LIKE '%eccentric-4-6'
         OR to_variant.variant_key LIKE '%eccentric-4-6'
         OR(from_variant.variant_key IN(
             'barbell-standing-pronated','dumbbell-standing-pronated',
             'dumbbell-standing-neutral')
           AND to_variant.variant_key IN(
             'barbell-standing-pronated','dumbbell-standing-pronated',
             'dumbbell-standing-neutral','dumbbell-back-supported-neutral'))
         OR(from_variant.variant_key='dumbbell-back-supported-neutral'
           AND to_variant.variant_key='dumbbell-standing-neutral'))
       AND relationship.review_status='review'
       AND relationship.reviewed_by IS NULL
       AND relationship.reviewed_at IS NULL)<12 THEN
    RAISE EXCEPTION '% expected all review-only graph proposals',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.survivor_definition_id=ambiguous_id
       AND resolution.resolved_definition_id IN(standing_id,seated_id)
       AND resolution.decision='needs_human_review'
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'retirementMigration'=migration_key)<>2 THEN
    RAISE EXCEPTION '% did not preserve both source-mapping review decisions',
      migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise exercise
       WHERE exercise.id=ambiguous_legacy_id AND exercise.archived IS TRUE
         AND exercise.is_published IS FALSE AND exercise.skill_level IS NULL)
    OR(SELECT count(*) FROM coaching.exercise exercise
       WHERE exercise.id IN(standing_legacy_id,seated_legacy_id)
         AND exercise.skill_level IS NULL)<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile safety
       WHERE safety.exercise_id IN(
           ambiguous_legacy_id,standing_legacy_id,seated_legacy_id)
         AND safety.minimum_skill_level IS NOT NULL)
    OR(SELECT count(*) FROM coaching.exercise_difficulty_profile difficulty
       WHERE difficulty.exercise_id IN(standing_legacy_id,seated_legacy_id)
         AND difficulty.overall=greatest(
           difficulty.technical,difficulty.load))<>2 THEN
    RAISE EXCEPTION '% found invalid legacy selection, difficulty, or proficiency state',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
     WHERE packet.definition_id IN(ambiguous_id,standing_id,seated_id)
       AND packet.card_version=CASE packet.definition_id
         WHEN seated_id THEN 3 ELSE 2 END
       AND packet.audit_version=migration_key
       AND packet.status='quarantined'
       AND packet.human_review_required IS TRUE)<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(ambiguous_id,standing_id,seated_id)
         AND coaching.exercise_json_has_level_classification(jsonb_build_array(
           definition.anatomy_json,definition.athlete_support_json,
           definition.coach_support_json,definition.support_operations_json,
           definition.provenance_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
       WHERE media.definition_id IN(ambiguous_id,standing_id,seated_id)
         AND(media.review_status IN('approved','shortlisted','rejected')
           OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
           OR media.exact_variant_match IS NOT NULL)) THEN
    RAISE EXCEPTION '% created forbidden approval or proficiency state',
      migration_key;
  END IF;
END $$;
