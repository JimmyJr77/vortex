-- Consolidate strict full-cycle Pull-Up and Chin-Up source representations into
-- one exact vertical-pull family. Grip orientation, assistance interface,
-- external vest load, and archer side shift are variants. Eccentric-only,
-- isometric, scapular-only, and kipping actions retain separate identities.
-- No media, relationship, calibration, content, or publication approval is
-- created by this migration.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '475_coaching_pull_up_chin_up_identity_and_family_completion';
  research_version CONSTANT TEXT := '2026-08-02.80';
  canonical_id UUID;
  assisted_definition UUID;
  mixed_definition UUID;
  weighted_definition UUID;
  eccentric_definition UUID;
  isometric_definition UUID;
  scapular_definition UUID;
  consolidated_definition_ids UUID[];
  affected_definition_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[12,197,199,596,599,818,1049,1352];
  canonical_baseline UUID;
  assisted_baseline UUID;
  disjunctive_baseline UUID;
  weighted_baseline UUID;
  old_variant_ids UUID[];
  pronated_variant UUID := gen_random_uuid();
  supinated_variant UUID := gen_random_uuid();
  neutral_variant UUID := gen_random_uuid();
  archer_variant UUID := gen_random_uuid();
  band_assisted_variant UUID := gen_random_uuid();
  machine_assisted_variant UUID := gen_random_uuid();
  weighted_vest_variant UUID := gen_random_uuid();
  active_variant_ids UUID[];
  all_family_variant_ids UUID[];
  current_video_ids CONSTANT TEXT[] := ARRAY[
    'GBqAZP6jquc','eGo4IYlbE5g','e1YSApl-QcM','ayvVeCtp83Q','AqCmhR1Bl2Q'];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_id FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=12;
  SELECT id INTO assisted_definition FROM coaching.exercise_definition_v1
  WHERE slug='assisted-pull-up';
  SELECT id INTO mixed_definition FROM coaching.exercise_definition_v1
  WHERE slug='chin-up-or-assisted-chin-up';
  SELECT id INTO weighted_definition FROM coaching.exercise_definition_v1
  WHERE slug='weighted-vest-pull-up-strength';
  SELECT id INTO eccentric_definition FROM coaching.exercise_definition_v1
  WHERE slug='eccentric-pull-up' AND status<>'archived';
  SELECT id INTO isometric_definition FROM coaching.exercise_definition_v1
  WHERE slug='isometric-pull-up-hold' AND status<>'archived';
  SELECT id INTO scapular_definition FROM coaching.exercise_definition_v1
  WHERE slug='scapular-pull-up' AND status<>'archived';

  SELECT id INTO canonical_baseline FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND variant_key='baseline';
  SELECT id INTO assisted_baseline FROM coaching.exercise_variant_v1
  WHERE definition_id=assisted_definition AND variant_key='baseline';
  SELECT id INTO disjunctive_baseline FROM coaching.exercise_variant_v1
  WHERE definition_id=mixed_definition AND variant_key='baseline';
  SELECT id INTO weighted_baseline FROM coaching.exercise_variant_v1
  WHERE definition_id=weighted_definition AND variant_key='baseline';

  consolidated_definition_ids := ARRAY[
    assisted_definition,mixed_definition,weighted_definition];
  affected_definition_ids := ARRAY[
    canonical_id,assisted_definition,mixed_definition,weighted_definition];
  old_variant_ids := ARRAY[
    canonical_baseline,assisted_baseline,disjunctive_baseline,weighted_baseline];
  active_variant_ids := ARRAY[
    pronated_variant,supinated_variant,neutral_variant,archer_variant,
    band_assisted_variant,machine_assisted_variant,weighted_vest_variant];
  all_family_variant_ids := old_variant_ids||active_variant_ids;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND slug='pull-up-chin-up' AND status<>'archived')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(consolidated_definition_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids))<>8
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(old_variant_ids))<>4
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(ARRAY[eccentric_definition,isometric_definition,scapular_definition])
        AND status<>'archived')<>3 THEN
    RAISE EXCEPTION '% prerequisite identity state is missing or drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_id) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(all_family_variant_ids) AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_family_variant_ids)
          OR to_variant_id=ANY(all_family_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status IN('approved'))
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_family_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=ANY(source_ids)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_family_variant_ids)
      OR to_variant_id=ANY(all_family_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_family_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(old_variant_ids);
  UPDATE coaching.exercise_variant_v1
  SET variant_key=CASE id
        WHEN canonical_baseline THEN 'identity-quarantine-canonical-baseline'
        WHEN assisted_baseline THEN 'identity-quarantine-assisted-baseline'
        WHEN disjunctive_baseline THEN 'identity-quarantine-disjunctive-baseline'
        ELSE 'identity-quarantine-weighted-baseline' END,
      display_name=CASE id
        WHEN canonical_baseline THEN 'Pull-Up / Chin-Up Baseline — Identity Quarantine'
        WHEN assisted_baseline THEN 'Assisted Pull-Up Baseline — Identity Quarantine'
        WHEN disjunctive_baseline THEN 'Chin-Up or Assisted Chin-Up — Identity Quarantine'
        ELSE 'Weighted Vest Pull-Up Baseline — Identity Quarantine' END,
      modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
      requirements_json=jsonb_build_object(
        'selectable',FALSE,'representation','identity_quarantine',
        'archiveReason','generic_or_disjunctive_source_did_not_define_an_exact_selectable_strict_full_cycle_variant',
        'replacementDefinitionId',canonical_id,'migration',migration_key,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      load_profile_json=jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=jsonb_build_object('selectable',FALSE),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','identity_quarantine','selectable',FALSE,
        'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(old_variant_ids);

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_id,
      source_kind='duplicate_consolidation',
      provenance_json=jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'legacyExerciseId',legacy_exercise_id,
        'sourceDisposition',CASE legacy_exercise_id
          WHEN 12 THEN 'generic_pull_up_name_mapped_to_exact_variant_required_family'
          WHEN 197 THEN 'assistance_interface_is_an_exact_variant_dimension'
          WHEN 199 THEN 'stable_canonical_source_full_cycle_grip_variant_required'
          WHEN 596 THEN 'supinated_grip_is_an_exact_variant_dimension'
          WHEN 599 THEN 'archer_side_shift_is_an_exact_variant_dimension'
          WHEN 818 THEN 'strict_label_maps_to_no_kip_full_cycle_variant'
          WHEN 1049 THEN 'weighted_vest_is_an_exact_external_load_variant'
          ELSE 'disjunctive_chin_up_or_assisted_source_archived_not_selectable' END,
        'representedBySelectableSourceVariant',legacy_exercise_id<>1352,
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
          'https://pubmed.ncbi.nlm.nih.gov/21068680/',
          'https://pubmed.ncbi.nlm.nih.gov/28011412/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
          'https://pubmed.ncbi.nlm.nih.gov/29768093/'),
        'unrelatedCitationRemoved','https://pubmed.ncbi.nlm.nih.gov/38156065/',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_definition_v1 SET
    legacy_exercise_id=199,slug='pull-up-chin-up',
    canonical_name='Strict Pull-Up / Chin-Up',display_name='Pull-Up / Chin-Up',
    aliases=ARRAY[
      'Pull-Up','Pull Up','Strict Pull-Up','Strict Pull Up','Pronated Pull-Up',
      'Chin-Up','Chin Up','Supinated Pull-Up','Neutral-Grip Pull-Up',
      'Assisted Pull-Up','Band-Assisted Pull-Up','Machine-Assisted Pull-Up',
      'Archer Pull-Up','Weighted Vest Pull-Up']::TEXT[],
    description='A strict full-cycle vertical pull from a declared overhead support and grip: begin at the assigned controlled bottom position, pull without a required kip until the declared top standard is reached, then return under control to the same bottom. Grip orientation, assistance interface, external vest load, and archer side shift require exact variants.',
    family_key='strict_full_cycle_vertical_pull',schema_version='2.0.0',
    card_version=2,status='review',content_confidence=82,
    scoring_confidence=60,media_confidence=50,
    movement_patterns=ARRAY['pull','brace']::TEXT[],
    body_regions=ARRAY[
      'shoulder','scapula','elbow','wrist','hand','core','spine','rib_cage']::TEXT[],
    required_equipment='{}'::TEXT[],
    optional_equipment=ARRAY[
      'pull_up_bar','neutral_handle','assisted_pullup_machine','bands',
      'weighted_vest','box','mat','timer']::TEXT[],
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip_approach_and_landing_area',
      'station','one_inspected_overhead_support_with_clear_hang_and_exit_zone',
      'clearance',jsonb_build_array(
        'full_body_hang','head_above_or_to_declared_top_standard',
        'front_back_and_side_body_clearance','safe_mount_and_dismount_zone','no_cross_traffic'),
      'equipmentInspection',jsonb_build_array(
        'support_and_anchors_rated_stable_and_undamaged','grip_surface_dry_and_secure',
        'assistance_device_band_or_vest_exact_and_retained','box_and_mat_stable_if_used'),
      'coachSightline','front_quarter_for_grip_symmetry_and_top_standard_then_side_for_trunk_leg_and_bottom_control',
      'changeRule','Grip, width, implement, assistance interface and magnitude, external load, bottom, top, tempo, side, repetitions, rest, mount, and exit must be declared and revalidated.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_use_the_exact_support_and_assistance_to_complete_the_declared_strict_cycle_with_controlled_mount_and_exit',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array(
        'secure_full_hand_grip_on_assigned_support','controlled_mount_bottom_and_dismount',
        'assigned_shoulder_elbow_wrist_and_hand_ranges_tolerated',
        'can_brace_and_breathe_without_required_swing_or_kip',
        'can_report_symptoms_grip_uncertainty_and_quality_loss'),
      'cautions',jsonb_build_array(
        'current_or_recent_hand_wrist_elbow_shoulder_neck_spine_or_rib_symptoms',
        'neurologic_cardiopulmonary_dizziness_or_exertional_symptoms_requiring_clinical_guidance',
        'grip_mount_dismount_or_overhead_support_uncertainty',
        'recent_high_volume_climbing_hanging_rowing_carry_or_elbow_flexor_work',
        'unfamiliar_band_machine_counterweight_vest_or_handle_interface'),
      'doNotAutoSelect',jsonb_build_array(
        'support_grip_mount_or_exit_is_not_secure','exact_variant_or_assistance_is_unknown',
        'pain_guarding_neurologic_dizzy_or_unusual_exertional_symptoms',
        'strict_cycle_requires_unplanned_swing_kip_jump_or_drop'),
      'ageMinimumEvidence','none_established',
      'notClinicalClearance',TRUE,
      'exerciseDifficultyDoesNotEstablishIndividualReadiness',TRUE),
    provenance_json=jsonb_build_object(
      'canonicalAuthoredFromResearch',TRUE,'pullUpFamilyAuditMigration',migration_key,
      'researchVersion',research_version,'legacySources',to_jsonb(source_ids),
      'identityContract','strict_full_cycle_vertical_pull_from_declared_bottom_to_declared_top_and_controlled_return_without_required_kip',
      'activeWorkingSpecifications',jsonb_build_array(
        'strict-pronated-bar-bodyweight','strict-supinated-bar-bodyweight',
        'strict-neutral-handles-bodyweight','archer-pronated-bar-side-specific',
        'band-assisted-pronated-bar','counterweight-assisted-pronated',
        'weighted-vest-pronated-bar'),
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
        'https://pubmed.ncbi.nlm.nih.gov/21068680/',
        'https://pubmed.ncbi.nlm.nih.gov/28011412/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
        'https://pubmed.ncbi.nlm.nih.gov/25066518/',
        'https://pubmed.ncbi.nlm.nih.gov/28253041/',
        'https://pubmed.ncbi.nlm.nih.gov/32213783/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4633265/',
        'https://pubmed.ncbi.nlm.nih.gov/29768093/'),
      'removedUnrelatedSource','https://pubmed.ncbi.nlm.nih.gov/38156065/',
      'researchLimits','Technique and acute EMG, kinematic, kinetic, modeling, fatigue, and trained-sample studies do not establish universal safety, injury risk, readiness, load, dose, recovery, transfer, or difficulty scores.',
      'mediaState','five_current_oembed_healthy_candidates_unreviewed',
      'oembedCheckedAt','2026-08-02',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'latissimus_dorsi','biceps_brachii','brachialis','brachioradialis'),
      'secondaryMuscles',jsonb_build_array(
        'teres_major','posterior_deltoid','pectoralis_major','forearm_flexors'),
      'stabilizers',jsonb_build_array(
        'rotator_cuff','lower_trapezius','middle_trapezius','rhomboids',
        'serratus_anterior','erector_spinae','abdominal_wall','obliques','gluteals'),
      'joints',jsonb_build_array(
        'hand','wrist','radioulnar_joints','elbow','glenohumeral_joint',
        'scapulothoracic_articulation','thoracic_spine','lumbar_spine','pelvis'),
      'jointActions',jsonb_build_array(
        'grip_and_wrist_stabilization','forearm_pronation_supination_or_neutral_hold',
        'concentric_elbow_flexion','shoulder_adduction_and_extension',
        'scapular_upward_rotation_protraction_and_elevation_at_the_bottom_as_individually_tolerated',
        'scapular_downward_rotation_retraction_and_depression_during_ascent_without_forced_universal_position',
        'trunk_and_pelvis_anti_extension_and_swing_control',
        'controlled_elbow_extension_and_shoulder_elevation_on_return'),
      'jointActionPhases',jsonb_build_object(
        'bottom','declared_controlled_overhead_position_with_exact_grip_support_and_assistance',
        'ascent','elbows_flex_and_upper_arms_move toward_the_trunk_while_body_rises_without_required_kip',
        'top','declared_chin_level_or_other_exact_standard_reached_without_neck_reach',
        'return','same_path_reversed_under_control_to_the_declared_bottom'),
      'planes',jsonb_build_array('frontal','sagittal','transverse'),
      'laterality','bilateral_except_archer_variant_has_side_specific_load_shift',
      'evidenceLimit','Surface EMG and small-sample kinematics do not quantify force, activation, or optimal joint position for every person, grip, assistance, load, range, or repetition.'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','A strict full-cycle bodyweight vertical pull used for upper-body pulling strength or controlled volume when the exact grip, support, range, assistance or external load, and stop rule are declared.',
      'primaryCue','Own the bottom, pull without swinging to the exact top, then lower to the same bottom.',
      'before',jsonb_build_array(
        'Confirm grip, width, support, assistance or vest load, bottom, top, tempo, repetitions, rest, mount, exit, and stop signal.',
        'Inspect the bar, handles, anchors, band or machine, vest, box, mat, clearance, and approach.',
        'Rehearse the mount, first bottom, one exact repetition, and controlled exit.'),
      'during',jsonb_build_array(
        'Keep a full secure grip and the assigned wrist and forearm orientation.',
        'Pull the elbows toward the trunk while keeping the body path and leg rule unchanged.',
        'Reach the top with the pull, not by craning the neck or adding a kip.',
        'Lower under control to the assigned bottom and keep breathing.'),
      'expectedSensations',jsonb_build_array(
        'upper_back_and_lat_effort','elbow_flexor_effort','forearm_and_grip_effort',
        'trunk_bracing','breathing_and_heart_rate_increase_with_repeated_work'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_pain_or_joint_pinch','numbness_tingling_or_radiating_symptoms',
        'dizziness_faintness_chest_pressure_or_unusual_breathlessness',
        'grip_slip_support_movement_or_assistance_failure','uncontrolled_swing_fall_or_dismount'),
      'painGuidance','Stop the repetition, regain the assigned stable support if possible, use the planned exit, and tell the coach; do not diagnose or push through symptoms.',
      'selfChecks',jsonb_build_array(
        'same_grip_support_assistance_and_load','same_bottom_and_top',
        'no_unplanned_swing_kip_or_leg_drive','controlled_return_and_exit'),
      'mediaFallback','Use this written contract and a qualified live demonstration until exact current-card media is approved.'),
    coach_support_json=jsonb_build_object(
      'preflight',jsonb_build_array(
        'Confirm definition, variant, grip, width, assistance or external load, bottom, top, tempo, repetitions, reserve, rest, mount, exit, and cumulative pulling budget.',
        'Inspect support rating and stability, grip surface, anchors, band integrity and retention, machine pin and counterweight, vest closure, box, mat, and clearance.',
        'Confirm symptom report, recent pulling and grip work, and a safe no-jump mount and exit.'),
      'observationOrder',jsonb_build_array(
        'support_grip_and_mount','bottom_position','scapular_and_upper_arm_path',
        'elbow_wrist_and_hand','trunk_pelvis_and_legs','top_standard',
        'controlled_return','fatigue_signals_and_exit'),
      'qualityGate','Count only repetitions matching the exact grip, support, assistance or load, bottom, body path, top, tempo, breathing, return, and exit contract.',
      'stopAndRegress',jsonb_build_array(
        'stop_for_symptoms_support_or_grip_failure_or_unsafe_exit',
        'stop_on_unplanned_swing_kip_jump_drop_neck_reach_range_loss_or_uncontrolled_return',
        'reduce_repetitions_increase_rest_or_select_an_exact_reviewed_assistance_variant',
        'revalidate_every_constraint_after_substitution'),
      'record',jsonb_build_array(
        'variant_and_profile','grip_width_support_assistance_and_external_load',
        'planned_completed_and_failed_repetitions','bottom_top_tempo_and_rest',
        'first_quality_break','symptoms','actual_duration','substitution_and_reason'),
      'evidenceLimit','Difficulty and dose are review proposals, not athlete-level classifications or universal prescriptions.'),
    support_operations_json=jsonb_build_object(
      'memberQuestions',jsonb_build_array(
        'Which grip and support should I use?','What are my exact bottom and top standards?',
        'How much assistance or vest load is assigned?','How do I mount and exit safely?',
        'What should I do if my grip, range, or body path changes?'),
      'supportEscalation',jsonb_build_array(
        'symptom_or_medical_question','support_anchor_band_machine_or_vest_concern',
        'identity_or_variant_mismatch','unsafe_mount_dismount_or_clearance',
        'media_mismatch_or_accessibility_need','unresolved_substitution'),
      'accessibilityOptions',jsonb_build_array(
        'written_step_sequence','still_frame_or_live_demonstration',
        'reviewed_machine_or_band_assistance','lower_repetition_target_and_more_rest',
        'reviewed_horizontal_pull_substitution_when_vertical_pull_objective_can_change'),
      'neverDo',jsonb_build_array(
        'infer_readiness_from_exercise_difficulty','promise_pain_relief_or_injury_prevention',
        'change_grip_assistance_load_range_or_identity_without_revalidation',
        'treat_oembed_metadata_as_media_approval'),
      'persistenceRequired',jsonb_build_array(
        'definition_variant_profile_and_card_version','dose_and_duration',
        'equipment_assistance_and_load','fatigue_and_quality_break',
        'substitution_validation','coach_and_athlete_rendering')),
    updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_definition_v1 archived SET
    legacy_exercise_id=NULL,status='archived',approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    description='Archived identity lineage. Select the exact Pull-Up / Chin-Up family variant; this definition is not selectable.',
    provenance_json=coalesce(archived.provenance_json,'{}'::JSONB)||jsonb_build_object(
      'identityResolution','duplicate_consolidated','survivorDefinitionId',canonical_id,
      'migration',migration_key,'selectable',FALSE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(consolidated_definition_ids);

  UPDATE coaching.exercise_identity_resolution_v1 SET
    evidence_json=(coalesce(evidence_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
          'https://pubmed.ncbi.nlm.nih.gov/21068680/',
          'https://pubmed.ncbi.nlm.nih.gov/28011412/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
          'https://pubmed.ncbi.nlm.nih.gov/29768093/'),
        'unrelatedCitationRemoved','https://pubmed.ncbi.nlm.nih.gov/38156065/',
        'migration',migration_key,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,resolved_at=now()
  WHERE reviewed_by IS NULL
    AND (survivor_definition_id=canonical_id OR resolved_definition_id=canonical_id);

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_id,boundary.other_id,boundary.decision,boundary.rationale,
    jsonb_build_object(
      'identityBoundary',boundary.boundary,
      'leftContract','strict_full_cycle_vertical_pull',
      'rightContract',boundary.right_contract,
      'researchSources',boundary.sources,'migration',migration_key,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (assisted_definition,'duplicate_consolidated',
      'Assistance changes effective load, setup, retention, and dose but preserves the same strict full-cycle vertical-pull repetition.',
      'assistance_interface_variant_not_new_identity','strict_full_cycle_with_declared_assistance',
      jsonb_build_array('https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/')),
    (mixed_definition,'duplicate_consolidated',
      'The disjunctive source is not executable; its chin-up and assisted-chin-up choices map to exact grip and assistance variants while the source representation remains archived.',
      'disjunctive_source_archived_exact_variant_required','underspecified_chin_up_or_assisted_chin_up',
      jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21068680/')),
    (weighted_definition,'duplicate_consolidated',
      'A retained weighted vest changes external load and failure exposure but preserves the strict pronated full-cycle action.',
      'external_load_variant_not_new_identity','strict_full_cycle_with_weighted_vest',
      jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/28253041/')),
    (eccentric_definition,'distinct_exercises',
      'Eccentric-only work begins at the top and ends after lowering without requiring the concentric return, so its repetition boundary and contraction contract differ.',
      'contraction_sequence_and_repetition_boundary','eccentric_only_top_to_bottom',
      jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC4633265/')),
    (isometric_definition,'distinct_exercises',
      'A timed hold has no full concentric-eccentric repetition cycle and is dosed by duration at a declared position.',
      'isometric_duration_not_dynamic_cycle','isometric_hold_at_declared_position',
      jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC4633265/')),
    (scapular_definition,'distinct_exercises',
      'The scapular-only repetition intentionally minimizes elbow motion and does not require the full-body ascent to a top standard.',
      'scapular_only_action_not_full_vertical_pull','scapular_excursion_with_near_straight_elbows',
      jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/'))
  ) boundary(other_id,decision,rationale,boundary,right_contract,sources)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',v.speed,'decisionDemand',v.decision,
      'workCapacityDemand',v.work_capacity,'impact',1,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',1,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',v.spotting,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'implement',v.implement,'gripOrientation',v.grip_orientation,
      'gripWidth',v.grip_width,'handCount',2,
      'laterality',CASE WHEN v.archer
        THEN 'bilateral_grip_with_left_and_right_load_shift_dosed_separately'
        ELSE 'bilateral' END,
      'assistanceMethod',v.assistance_method,
      'externalLoadMethod',v.external_load_method,
      'start','controlled_declared_bottom_with_secure_full_grip',
      'ascent','strict_vertical_pull_without_required_kip_swing_or_leg_drive',
      'topStandard','chin_level_with_support_without_neck_reach',
      'return','controlled_return_to_same_declared_bottom',
      'mountAndExit','profile_declared_no_uncontrolled_jump_or_drop',
      'tempo','profile_declared','load','exact_assistance_or_external_load_recorded',
      'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'externalLoadMethod',v.external_load_method,
      'externalLoadDescription',CASE
        WHEN v.assistance_method<>'none' THEN 'Record exact assistance interface, anchor or machine, magnitude or setting, and how assistance changes across the repetition.'
        WHEN v.external_load_method='weighted_vest' THEN 'Record body mass context when available, vest mass, closure, movement of the vest, and completed and failed repetitions.'
        ELSE 'Body mass is the primary external resistance; record exact support, grip, range, tempo, repetitions, failed repetitions, and any counterbalancing.' END,
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'effectiveLoadDrivers',jsonb_build_array(
        'body_mass','grip_orientation_and_width','bottom_and_top_range',
        'assistance_method_and_magnitude','external_vest_mass','archer_side_shift',
        'tempo','repetitions','rest','grip_fatigue','prior_hanging_climbing_rowing_carry_and_elbow_flexor_work'),
      'loadTracking',jsonb_build_array(
        'definition_variant_and_profile','support_grip_and_width',
        'assistance_interface_and_setting','external_load_and_retention',
        'planned_completed_and_failed_repetitions','bottom_top_tempo_and_rest',
        'first_quality_break','symptoms','same_session_overlap')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',v.recovery_hours,
      'recoveryWindow','context_load_volume_novelty_training_history_symptoms_and_overlapping_pull_hang_grip_trunk_or_elbow_flexor_work_dependent',
      'primaryFatigueSites',jsonb_build_array(
        'latissimus_and_upper_back','elbow_flexors','forearms_and_grip',
        'shoulder_girdle','trunk_stabilizers'),
      'earlyFatigueSignals',jsonb_build_array(
        'grip_repositions_or_slips','bottom_becomes_uncontrolled_or_shortened',
        'swing_kip_leg_drive_or_body_path_changes','top_requires_neck_reach',
        'ascent_slows_materially_or_stalls','return_accelerates_or_range_shortens',
        'scapular_elbow_wrist_or_trunk_position_changes','breathing_or_bracing_becomes_uncontrolled',
        'mount_dismount_or_assistance_control_becomes_uncertain'),
      'downstreamConflicts',jsonb_build_array(
        'priority_climbing_rope_or_grip_work','heavy_row_or_elbow_flexor_work',
        'high_volume_hanging_carry_or_trunk_work','symptomatic_overhead_or_shoulder_loading'),
      'fatigueEvidenceLimit','Small trained samples and specific fatigue protocols do not define a universal failure threshold, dose, or recovery duration.'),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'strict_vertical_pull_strength','upper_back_and_elbow_flexor_loading',
        'grip_and_trunk_control','controlled_full_cycle_capacity'),
      'stimulusDose',jsonb_build_object(
        'primary','quality_full_cycle_repetitions','range','exact_bottom_and_top',
        'assistanceOrLoad','exact_method_and_magnitude',
        'countFailedAttemptsAsExposure',TRUE,
        'qualityCeiling','end_before_grip_body_path_range_tempo_or_return_changes'),
      'weeklyExposure','Combine valid and failed repetitions with all same-session and recent pull-up, chin-up, eccentric, isometric, hang, climb, row, carry, grip, and elbow-flexor work.',
      'prerequisites',jsonb_build_array(
        'secure_assigned_grip','controlled_mount_bottom_and_exit',
        'exact_assistance_or_load_known','strict_cycle_and_stop_signal_understood'),
      'completionCriteria',jsonb_build_array(
        'exact_variant_support_grip_width_assistance_or_load_range_tempo_and_dose',
        'repeatable_bottom_ascent_top_return_and_exit',
        'controlled_hand_wrist_elbow_shoulder_scapula_trunk_pelvis_legs_and_breathing',
        'completed_failed_rest_symptoms_duration_and_first_quality_break_recorded'),
      'sequenceRules',jsonb_build_array(
        'place_priority_strength_profile_before_fatiguing_pull_grip_or_elbow_flexor_work',
        'end_strength_set_before_grinding_or_range_loss',
        'volume_profile_never_overrides_symptom_grip_range_or_support_stop_rules',
        'avoid_pre_fatiguing_priority_climb_rope_or_pull_performance'),
      'interferenceRules',jsonb_build_array(
        'do_not_silently_change_grip_support_assistance_external_load_range_or_contraction_contract',
        'do_not_count_a_repetition_when_the_quality_gate_fails',
        'recompute_selection_load_fatigue_duration_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object(
        'unknownIdentitySupportGripAssistanceLoadRangeDoseOrSymptoms','fail_closed_and_request_coach_review',
        'neverInferMissingMechanicsFromNameVideoTitleOrLegacyDose',TRUE,
        'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE),
      'cumulativeBudget',jsonb_build_object(
        'qualityRepetitions',v.rep_budget,'failedAttemptsCount',TRUE,
        'landingContacts',0,'sameSessionPullHangGripTrunkAndElbowFlexorWorkRequired',TRUE))
  FROM (VALUES
    (pronated_variant,'strict-pronated-bar-bodyweight','Strict Pronated Bar Pull-Up',
      ARRAY['strict','pronated','bar','bodyweight','full_cycle']::TEXT[],
      'pull_up_bar','pronated','approximately_shoulder_width','none','body_mass',FALSE,
      48,72,78,30,12,50,46,35,15,55,60,55,48,76,22,48,24,62,70,76,72,36,30),
    (supinated_variant,'strict-supinated-bar-bodyweight','Strict Supinated Bar Chin-Up',
      ARRAY['strict','supinated','bar','bodyweight','full_cycle']::TEXT[],
      'pull_up_bar','supinated','approximately_shoulder_width','none','body_mass',FALSE,
      46,68,74,34,12,48,44,35,15,54,60,58,48,74,22,48,24,60,68,74,68,36,32),
    (neutral_variant,'strict-neutral-handles-bodyweight','Strict Neutral-Grip Pull-Up',
      ARRAY['strict','neutral_grip','parallel_handles','bodyweight','full_cycle']::TEXT[],
      'neutral_handle','neutral','fixed_handle_spacing','none','body_mass',FALSE,
      44,66,72,28,12,46,42,34,15,52,58,52,46,72,20,46,22,58,66,72,66,32,34),
    (archer_variant,'archer-pronated-bar-side-specific','Archer Pull-Up — Pronated Bar',
      ARRAY['strict','pronated','bar','archer','side_specific','full_cycle']::TEXT[],
      'pull_up_bar','pronated','wide_declared','none','body_mass',TRUE,
      66,86,92,48,32,76,78,42,25,60,68,66,58,84,40,64,40,78,84,86,86,48,20),
    (band_assisted_variant,'band-assisted-pronated-bar','Band-Assisted Pronated Pull-Up',
      ARRAY['strict','pronated','bar','band_assisted','full_cycle']::TEXT[],
      'pull_up_bar_and_band','pronated','approximately_shoulder_width','elastic_band','assisted_body_mass',FALSE,
      54,50,52,34,18,60,58,32,20,48,52,48,44,64,28,60,36,56,54,58,62,30,40),
    (machine_assisted_variant,'counterweight-assisted-pronated','Counterweight-Assisted Pronated Pull-Up',
      ARRAY['strict','pronated','machine','counterweight_assisted','full_cycle']::TEXT[],
      'assisted_pullup_machine','pronated','machine_fixed','counterweight_machine','assisted_body_mass',FALSE,
      48,48,50,28,12,50,48,28,16,46,50,46,42,58,18,52,30,50,52,56,56,24,44),
    (weighted_vest_variant,'weighted-vest-pronated-bar','Weighted-Vest Pronated Pull-Up',
      ARRAY['strict','pronated','bar','weighted_vest','full_cycle']::TEXT[],
      'pull_up_bar','pronated','approximately_shoulder_width','none','weighted_vest',FALSE,
      52,84,90,32,14,58,52,36,18,58,66,62,54,82,26,58,32,72,82,84,80,48,22)
  ) v(id,variant_key,display_name,modifiers,implement,grip_orientation,grip_width,
      assistance_method,external_load_method,archer,complexity,physical,
      relative_strength,mobility,balance,stability,coordination,speed,decision,
      work_capacity,eccentric,joint_stress,spinal_loading,grip,fear,supervision,
      spotting,failure,local_fatigue,grip_fatigue,technical_fatigue,
      recovery_hours,rep_budget)
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,
    variant_key=EXCLUDED.variant_key,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
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
  SELECT p.variant_id,p.profile_key,'capacity',p.role,p.purpose,p.suitability,88,
    jsonb_build_object(
      'verticalPullStrength',CASE WHEN p.profile_type='strength' THEN 5 ELSE 3 END,
      'controlledPullingVolume',CASE WHEN p.profile_type='volume' THEN 5 ELSE 2 END,
      'gripAndTrunkControl',4,'powerClaim',0,'injuryPreventionClaim',0),
    jsonb_build_object(
      'doseType','quality_full_cycle_repetitions','sets',p.sets,
      'repetitions',p.reps,'sidesMultiplier',CASE WHEN p.archer THEN 2 ELSE 1 END,
      'restSeconds',p.rest_seconds,'tempo',p.tempo,
      'reserveRepetitions',CASE WHEN p.profile_type='strength' THEN '2_to_3' ELSE '3_or_more' END,
      'assistanceOrExternalLoad','exact_variant_setting_or_mass_recorded',
      'qualityTerminated',TRUE,'countFailedAttemptsAsExposure',TRUE,
      'evidenceStatus','provisional_coaching_dose_not_a_universal_research_prescription'),
    'Every counted repetition uses the assigned support, grip, width, assistance or external load, bottom, strict ascent, top standard, controlled return, body path, breathing, tempo, mount, and exit.',
    ARRAY[
      'sharp_or_increasing_pain_joint_pinch_numbness_tingling_radiation_dizziness_faintness_chest_pressure_or_unusual_breathlessness',
      'wrong_or_unknown_definition_variant_support_grip_width_assistance_load_range_tempo_dose_mount_or_exit',
      'bar_handle_anchor_band_machine_vest_box_mat_clearance_or_approach_becomes_unsafe',
      'grip_slips_repositions_or_can_no_longer_support_the_assigned_repetition',
      'unplanned_swing_kip_leg_drive_jump_or_drop_appears',
      'bottom_is_shortened_uncontrolled_or_loses_the_declared_shoulder_position',
      'body_path_rotates_shifts_or_arches_beyond_the_assigned_variant',
      'top_requires_neck_reach_or_no_longer_meets_the_declared_standard',
      'ascent_stalls_or_tempo_changes_beyond_the_profile_limit',
      'return_accelerates_range_shortens_or_elbow_shoulder_wrist_or_trunk_control_changes',
      'breathing_bracing_or_symptom_reporting_becomes_uncontrolled',
      'planned_repetitions_or_cumulative_pull_hang_grip_or_elbow_flexor_budget_is_reached'],
    p.coach_instructions,p.athlete_instructions,p.expected_adaptation,
    p.equipment,
    jsonb_build_object(
      'athletesPerStation',1,'setupSeconds',60,'transitionSeconds',35,
      'station','one_inspected_support_and_clear_hang_exit_zone_per_athlete',
      'equipmentCheck','support_grip_anchor_assistance_external_load_box_mat_timer_clearance_and_exit',
      'coachPosition','front_quarter_then_side_outside_mount_and_dismount_path',
      'changeRule','coach_rechecks_identity_and_recomputes_load_dose_fatigue_duration_and_rendering',
      'substitutionRevalidation',jsonb_build_array(
        'identity','support','grip_and_width','assistance_or_external_load',
        'bottom_and_top','tempo','population','clearance','dose','fatigue',
        'duration','equipment','mount_and_exit','rendering')),
    CASE p.variant_id
      WHEN pronated_variant THEN ARRAY[supinated_variant,neutral_variant,band_assisted_variant,machine_assisted_variant]::UUID[]
      WHEN supinated_variant THEN ARRAY[pronated_variant,neutral_variant,band_assisted_variant]::UUID[]
      WHEN neutral_variant THEN ARRAY[pronated_variant,supinated_variant,machine_assisted_variant]::UUID[]
      WHEN archer_variant THEN ARRAY[pronated_variant,band_assisted_variant]::UUID[]
      WHEN band_assisted_variant THEN ARRAY[machine_assisted_variant,pronated_variant]::UUID[]
      WHEN machine_assisted_variant THEN ARRAY[band_assisted_variant,pronated_variant]::UUID[]
      ELSE ARRAY[pronated_variant,band_assisted_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'setupSeconds',60,'repetitionSeconds',p.rep_seconds,
      'sidesMultiplier',CASE WHEN p.archer THEN 2 ELSE 1 END,
      'exitSecondsPerSet',12,'transitionSeconds',35,'durationIncludesRest',TRUE,
      'durationFormula','setup + sets * (repetitions * sides_multiplier * repetition_seconds + controlled_exit_seconds) + inter_set_rest + transition',
      'durationCeilingSeconds',p.duration_ceiling,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'reduce',jsonb_build_array(
        'reduce_repetitions','increase_rest','increase_exact_assistance',
        'remove_external_vest_load','select_a_reviewed_grip_only_when_the_objective_and_ranges_are_preserved'),
      'increase',jsonb_build_array(
        'add_one_quality_repetition_within_budget',
        'reduce_assistance_or_add_vest_mass_only_when_all_range_tempo_and_exit_gates_are_unchanged',
        'reduce_rest_only_in_a_volume_profile_after_review'),
      'changeOneVariableAtATime',TRUE,'revalidateAfterChange',TRUE,
      'symptomRule','stop_and_select_a_separately_reviewed_pain_free_alternative'),
    jsonb_build_object(
      'record',jsonb_build_array(
        'definition_id','variant_id','profile_key','support','grip_and_width',
        'assistance_interface_and_setting','external_vest_mass','bottom_and_top',
        'planned_completed_and_failed_repetitions','tempo','rest_duration',
        'first_grip_range_path_position_breathing_or_exit_break','symptoms',
        'stop_reason','actual_duration','substitution'),
      'comparisonRule','Compare only when definition, variant, support, grip, width, assistance or load, bottom, top, tempo, and measurement method match.',
      'validity','all_identity_equipment_grip_range_path_breathing_dose_symptom_mount_and_exit_gates_pass'),
    jsonb_build_object(
      'before','Which exact support, grip, width, assistance or load, bottom, top, tempo, repetitions, reserve, rest, mount, exit, and stop signal are assigned?',
      'during','Are grip, body path, bottom, top, tempo, breathing, assistance, and return still exact without a kip?',
      'after','Store completed and failed repetitions, assistance or load, range, tempo, first break, symptoms, rest, duration, exit, and substitution.',
      'supportEscalation','Escalate symptoms, grip or support events, identity mismatch, unsafe assistance or exit, inaccessible instruction, or media mismatch.',
      'mediaFallback','Use the written phase contract and qualified live demonstration until exact current-version media is independently approved.')
  FROM (VALUES
    (pronated_variant,'capacity-strength-pronated','primary','strength',FALSE,
      'Build strict pronated full-cycle vertical-pull strength with conservative reserve and full rest.',92,4,4,150,'controlled_2_second_return',3.5,900,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Verify the pronated grip, exact range, no-kip body path, reserve, and controlled exit. End the set before speed, range, grip, trunk, breathing, or return changes.',
      'Own the bottom, pull without swinging until your chin reaches the standard, then lower under control. Stop with clean repetitions left.',
      'A review-only exposure to strict pronated vertical-pull strength.'),
    (pronated_variant,'capacity-volume-pronated','secondary','volume',FALSE,
      'Accumulate conservative strict pronated repetitions while technique remains the limiting stop.',84,3,6,105,'repeatable_controlled_cycle',3.2,820,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Track cumulative pull and grip work. Stop at the first grip, body-path, range, tempo, breathing, or exit change rather than chasing the target count.',
      'Make every repetition match. Stop when grip, range, body path, pace, or breathing first changes.',
      'A controlled volume exposure, not a universal endurance prescription.'),
    (supinated_variant,'capacity-strength-supinated','primary','strength',FALSE,
      'Build strict supinated full-cycle vertical-pull strength with exact wrist, elbow, and shoulder observation.',90,4,4,150,'controlled_2_second_return',3.5,900,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Verify supinated grip width, wrist comfort, exact range, reserve, and no-kip body path; end before elbow, wrist, shoulder, range, or return changes.',
      'Keep the palms toward you and wrists organized. Pull to the exact top without swinging, then lower to the same bottom.',
      'A review-only exposure to strict supinated vertical-pull strength.'),
    (supinated_variant,'capacity-volume-supinated','secondary','volume',FALSE,
      'Accumulate conservative strict chin-up repetitions with the same grip, range, and controlled return.',82,3,6,105,'repeatable_controlled_cycle',3.2,820,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Stop on grip migration, wrist or elbow compensation, body swing, range loss, neck reach, or uncontrolled return. Count failed attempts as exposure.',
      'Keep every chin-up identical. Stop when your grip, range, path, pace, or return changes.',
      'A controlled supinated pulling-volume exposure.'),
    (neutral_variant,'capacity-strength-neutral','primary','strength',FALSE,
      'Build strict neutral-grip vertical-pull strength on fixed inspected parallel handles.',90,4,4,150,'controlled_2_second_return',3.5,900,
      ARRAY['neutral_handle','mat','timer']::TEXT[],
      'Confirm the fixed handle spacing and exact bottom and top. End before grip, shoulder path, range, trunk, breathing, or return changes.',
      'Keep palms facing each other. Pull without swinging to the exact top, then lower to the same bottom.',
      'A review-only neutral-grip strength exposure.'),
    (neutral_variant,'capacity-volume-neutral','secondary','volume',FALSE,
      'Accumulate conservative neutral-grip repetitions with exact fixed-handle and range control.',82,3,6,105,'repeatable_controlled_cycle',3.2,820,
      ARRAY['neutral_handle','mat','timer']::TEXT[],
      'Track cumulative grip and pull volume. Stop at the first loss of fixed grip, range, body path, tempo, breathing, or exit control.',
      'Keep every neutral-grip repetition the same; finish the set at the first quality change.',
      'A controlled neutral-grip pulling-volume exposure.'),
    (archer_variant,'capacity-strength-archer','primary','strength',TRUE,
      'Use low-repetition side-specific archer pulls with explicit wide grip, load shift, range, and left-right records.',78,3,3,180,'controlled_shift_and_return',4.5,1050,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Verify wide grip, assigned side, load shift, straight-arm-side contract, top range, and equal planned exposure. Stop each side independently on rotation, range, grip, or path change.',
      'Shift toward the assigned hand while the other arm stays in its declared role. Return under control, exit, and record each side separately.',
      'A review-only asymmetric strict-pull strength exposure.'),
    (archer_variant,'capacity-volume-archer','secondary','volume',TRUE,
      'Accumulate a small side-specific archer dose only while both sides retain the exact path and range.',66,2,4,150,'repeatable_side_specific_cycle',4.5,980,
      ARRAY['pull_up_bar','mat','timer']::TEXT[],
      'Use independent side totals and stops. Do not continue after grip, trunk rotation, side shift, top, return, or breathing changes.',
      'Complete one side at a time and stop that side at the first grip, path, range, or posture change.',
      'A conservative side-specific volume exposure without assuming symmetric tolerance.'),
    (band_assisted_variant,'capacity-strength-band-assisted','primary','strength',FALSE,
      'Practice exact strict pronated repetitions with a declared inspected elastic-assistance interface.',84,4,5,120,'controlled_cycle_with_declared_band_assistance',3.5,860,
      ARRAY['pull_up_bar','bands','box','mat','timer']::TEXT[],
      'Verify band type, anchor, body contact, stretch path, retention, and changing assistance. Stop for band migration, damage, snap risk, body-path change, or unsafe entry or exit.',
      'Use the exact band and entry. Pull without swinging, lower under control, and stop before the band, grip, range, or path changes.',
      'A review-only assisted strict-cycle exposure; band assistance is not assumed constant.'),
    (band_assisted_variant,'capacity-volume-band-assisted','secondary','volume',FALSE,
      'Accumulate conservative band-assisted repetitions while band behavior and strict mechanics stay exact.',78,3,7,90,'repeatable_cycle_with_declared_band_assistance',3.3,820,
      ARRAY['pull_up_bar','bands','box','mat','timer']::TEXT[],
      'Count only repetitions with the same band placement, path, range, and body position. Stop on band, anchor, grip, tempo, breathing, or exit change.',
      'Keep the band and every repetition the same. Stop at the first change in band path, grip, range, body path, or pace.',
      'A controlled assisted-volume exposure without treating band tension as a fixed load.'),
    (machine_assisted_variant,'capacity-strength-machine-assisted','primary','strength',FALSE,
      'Practice strict pronated full cycles on an inspected counterweight machine with an exact setting.',86,4,5,120,'controlled_machine_guided_cycle',3.5,860,
      ARRAY['assisted_pullup_machine','timer']::TEXT[],
      'Verify machine, pin, counterweight setting, platform or knee-pad entry, handle, travel, bottom, top, and exit. Stop on machine movement, impact, range loss, or unsafe dismount.',
      'Use the assigned machine setting and handles. Pull to the exact top, lower without the stack or platform striking, then exit under control.',
      'A review-only machine-assisted strict-pull exposure.'),
    (machine_assisted_variant,'capacity-volume-machine-assisted','secondary','volume',FALSE,
      'Accumulate conservative counterweight-assisted repetitions without stack impact or shortened range.',80,3,7,90,'repeatable_machine_guided_cycle',3.3,820,
      ARRAY['assisted_pullup_machine','timer']::TEXT[],
      'Track the exact setting and stop on stack contact, platform bounce, changed body path, range, grip, breathing, or exit control.',
      'Keep the setting, path, and range unchanged. Stop before the stack hits or your grip, range, pace, or posture changes.',
      'A controlled machine-assisted pulling-volume exposure.'),
    (weighted_vest_variant,'capacity-strength-weighted-vest','primary','strength',FALSE,
      'Build externally loaded strict pronated pull strength with an exact secured vest mass and conservative reserve.',82,4,3,180,'controlled_2_to_3_second_return',4.0,1020,
      ARRAY['pull_up_bar','weighted_vest','box','mat','timer']::TEXT[],
      'Verify vest mass and closure, mount, clearance, range, reserve, and controlled exit. End before vest shift, grinding, grip, range, trunk, breathing, or return changes.',
      'Secure the vest, mount without jumping, pull cleanly to the exact top, and lower under control. Stop well before a failed repetition.',
      'A review-only externally loaded strict-pull strength exposure.'),
    (weighted_vest_variant,'capacity-volume-weighted-vest','secondary','volume',FALSE,
      'Accumulate a small weighted-vest repetition dose only while vest retention and strict mechanics remain unchanged.',68,3,4,150,'repeatable_loaded_controlled_cycle',4.0,940,
      ARRAY['pull_up_bar','weighted_vest','box','mat','timer']::TEXT[],
      'Do not use vest load to turn the profile into failure work. Stop on vest movement, grip, range, path, tempo, breathing, or exit change.',
      'Keep the vest still and every repetition clean. Stop when the load, grip, range, path, or pace changes.',
      'A conservative externally loaded volume exposure, not a universal hypertrophy dose.')
  ) p(variant_id,profile_key,role,profile_type,archer,purpose,suitability,sets,reps,
      rest_seconds,tempo,rep_seconds,duration_ceiling,equipment,
      coach_instructions,athlete_instructions,expected_adaptation)
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
  SELECT canonical_id,2,section.section_key,source.url,source.title,
    source.publisher,source.kind,
    jsonb_build_array(
      jsonb_build_object('claim',section.claim,'limits',section.limits),
      jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'limitations','The cited source does not establish individual readiness, medical safety, injury prevention, treatment effect, every listed muscle role, universal load, universal dose, universal recovery, long-term transfer, difficulty score, media approval, or publication approval.',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    source.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','grip_emg',
      'Pronated, supinated, neutral, and rope full repetitions were compared as pull-up variations; grip orientation changes the exact variant without replacing the strict full-cycle identity.',
      'Nineteen strength-trained men and acute EMG do not settle every grip, range, symptom response, or long-term outcome.'),
    ('taxonomy','instruction',
      'Professional instruction defines a bar-supported vertical pull with secure grip, braced trunk, elbow flexion, a declared top, and controlled return.',
      'The source labels an experience category, but this exercise card intentionally stores only exercise complexity and physical difficulty.'),
    ('anatomy','pull_chin_emg',
      'Pull-ups and chin-ups showed high activation across latissimus dorsi, elbow flexors, shoulder stabilizers, trunk extensors, and external oblique with grip-dependent differences.',
      'Surface EMG does not measure muscle force and cannot quantify every person, range, assistance method, or load.'),
    ('biomechanics','scapular',
      'Front, wide, and reverse pull-up techniques produced different scapulothoracic, glenohumeral, and humerothoracic kinematics.',
      'The observational sample contained eleven regular pull-up participants; risk discussion is not proof of individual injury or a universal optimal scapular cue.'),
    ('difficulty','load_velocity',
      'Body mass plus external load materially determines force and velocity demands in trained pronated pull-ups.',
      'The study did not create Vortex scores or validate any universal difficulty threshold.'),
    ('load_fatigue_recovery','fatigue',
      'Dynamic repetitions and an isometric half-pull position produced task-specific fatigue responses in a small sample of male climbers.',
      'The protocol cannot define universal set termination or recovery time and does not generalize to every population or variant.'),
    ('constraints','spine_load',
      'Modeled spine load was substantial during pull-up and chin-up tasks in the studied men despite the hanging position.',
      'Modeled loads from fourteen men do not establish contraindications; the card must not claim that hanging automatically unloads or decompresses the spine.'),
    ('dosage','velocity_loss',
      'Two eight-week prone-grip training programs with different within-set velocity-loss limits produced different outcomes in trained men.',
      'The result does not make one velocity-loss threshold or the study schedule a universal prescription; all card doses remain review-only coaching proposals.'),
    ('instructions','instruction',
      'The technique source supports a full secure grip, braced trunk, controlled upward pull without swing, chin-level top, and controlled return.',
      'One professional description does not prove that every cue, grip width, or shoulder position is appropriate for every person.'),
    ('safety_stop_rules','scapular',
      'Technique-dependent shoulder kinematics support exact grip, width, range, symptom, and quality stop rules rather than treating all pull-ups as interchangeable.',
      'Kinematic associations do not prove injury causation or individual medical safety.'),
    ('programming','load_velocity',
      'Individual load-, force-, power-, and velocity relationships can support monitoring in trained pronated pull-up contexts.',
      'Laboratory monitoring relationships do not establish superior programming, transfer, or a default load for all users.'),
    ('athlete_support','instruction',
      'Direct technique instruction supports concise self-checks for grip, body path, top position, swing avoidance, and controlled return.',
      'Written cues and candidate media do not replace individual observation, accessibility support, or symptom reporting.'),
    ('coach_support','pull_chin_emg',
      'Grip orientation changes some activation and elbow-motion characteristics while preserving a full vertical-pull cycle.',
      'Acute group means do not justify forcing one grip or path when a participant reports symptoms or cannot meet the exact contract.'),
    ('accessibility','grip_emg',
      'Neutral and supinated orientations are legitimate exact grip variants, and assistance can change effective demand while preserving the repetition identity.',
      'Grip changes and assistance are not automatically accessible or safe; support, range, mount, exit, symptoms, and exact equipment still require review.'),
    ('alternates','kipping',
      'Kipping pull-ups showed materially different hip and knee kinematics and muscle activation from standard pull-ups in eleven athletes.',
      'This acute comparison supports a distinct identity boundary but does not establish superiority, safety, or training outcomes.'),
    ('media','media',
      'YouTube oEmbed responses can establish candidate URL, current title, channel, thumbnail, and iframe metadata.',
      'Metadata does not establish full playback, exact movement or variant, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.')
  ) section(section_key,source_key,claim,limits)
  JOIN (VALUES
    ('instruction','https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
      'Pull-ups','American Council on Exercise','expert_instruction',78),
    ('pull_chin_emg','https://pubmed.ncbi.nlm.nih.gov/21068680/',
      'Surface electromyographic activation patterns and elbow joint motion during a pull-up, chin-up, or perfect-pullup rotational exercise',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',86),
    ('grip_emg','https://pubmed.ncbi.nlm.nih.gov/28011412/',
      'Electromyographic analysis of muscle activation during pull-up variations',
      'Journal of Electromyography and Kinesiology','peer_reviewed_research',85),
    ('scapular','https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
      'Scapula kinematics of pull-up techniques: Avoiding impingement risk with training changes',
      'Journal of Science and Medicine in Sport','peer_reviewed_research',86),
    ('spine_load','https://pubmed.ncbi.nlm.nih.gov/25066518/',
      'Muscle activity and spine load during pulling exercises: influence of stable and labile contact surfaces and technique coaching',
      'Journal of Electromyography and Kinesiology','peer_reviewed_research',84),
    ('load_velocity','https://pubmed.ncbi.nlm.nih.gov/28253041/',
      'Load-, Force-, and Power-Velocity Relationships in the Prone Pull-Up Exercise',
      'International Journal of Sports Physiology and Performance','peer_reviewed_research',86),
    ('velocity_loss','https://pubmed.ncbi.nlm.nih.gov/32213783/',
      'Effects of Velocity Loss During Body Mass Prone-Grip Pull-up Training on Strength and Endurance Performance',
      'Journal of Strength and Conditioning Research','peer_reviewed_research',87),
    ('fatigue','https://pmc.ncbi.nlm.nih.gov/articles/PMC4633265/',
      'Higher Neuromuscular Manifestations of Fatigue in Dynamic than Isometric Pull-Up Tasks in Rock Climbers',
      'Journal of Human Kinetics','peer_reviewed_research',82),
    ('kipping','https://pubmed.ncbi.nlm.nih.gov/29768093/',
      'Alterations in kinematics and muscle activation patterns with the addition of a kipping action during a pull-up activity',
      'Sports Biomechanics','peer_reviewed_research',84),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists','YouTube Help','manufacturer_instruction',82)
  ) source(source_key,url,title,publisher,kind,quality)
    ON source.source_key=section.source_key
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_id,media.variant_id,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.source_query,NULL,NULL,
    '2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This proves metadata and an embedding response only. Full playback, exact definition and variant, grip, width, support, assistance or load, bottom, top, body path, tempo, return, mount, exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unresolved.'
  FROM (VALUES
    (pronated_variant,'GBqAZP6jquc','How to do a Pull Up / MORE Pull Ups - Pull Up Tutorial',
      'Calisthenicmovement','strict pronated pull-up technique candidate'),
    (pronated_variant,'eGo4IYlbE5g','The Perfect Pull Up - Do it right!',
      'Calisthenicmovement','strict pronated pull-up technique candidate'),
    (supinated_variant,'e1YSApl-QcM',
      'PERFECT CHIN-UPS | The Only Chin-up Tutorial You''ll Ever Need (Full Guide)',
      'Simonster Strength','strict supinated chin-up technique candidate'),
    (neutral_variant,'ayvVeCtp83Q','How To Neutral Grip Pull Ups? | Neutral Grip Pull Ups Tutorial',
      'JustCalisthenics','neutral-grip pull-up technique candidate'),
    (archer_variant,'AqCmhR1Bl2Q','ARCHER PULL UP TUTORIAL | CORRECT FORM TUTORIAL',
      'Victory Calisthenics','archer pull-up technique candidate')
  ) media(variant_id,video_id,title,channel,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method=EXCLUDED.discovery_method,source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,a.name,a.classification,a.rationale,a.dimensions,
    NULL,'candidate',NULL,NULL
  FROM (VALUES
    ('Pull-Up','same_identity','Common family name; an exact grip, support, range, assistance or load, and profile are still required.',jsonb_build_object('alias','Pull-Up')),
    ('Strict Pull-Up','same_identity','Strict specifies the no-required-kip action already required by the canonical repetition.',jsonb_build_object('alias','Strict Pull-Up')),
    ('Chin-Up','same_identity','Common name for the strict supinated bar variant.',jsonb_build_object('variantKey','strict-supinated-bar-bodyweight')),
    ('Neutral-Grip Pull-Up','same_identity','Matches the fixed parallel-handle neutral-grip working specification.',jsonb_build_object('variantKey','strict-neutral-handles-bodyweight')),
    ('Archer Pull-Up','same_identity','Matches the explicit wide-grip side-specific load-shift variant.',jsonb_build_object('variantKey','archer-pronated-bar-side-specific')),
    ('Assisted Pull-Up','same_identity','Assistance preserves the full-cycle identity only after the interface and setting are exact.',jsonb_build_object('variantRequired',TRUE,'assistanceMethod','exact')),
    ('Weighted Vest Pull-Up','same_identity','A secured vest changes external load and failure exposure while preserving the strict cycle.',jsonb_build_object('variantKey','weighted-vest-pronated-bar')),
    ('Grip Width','modifier_annotation','A comfortable exact width changes joint path and demand but does not alone create a new repetition identity.',jsonb_build_object('gripWidth','declared')),
    ('Tempo Pull-Up','modifier_annotation','Concentric, pause, and eccentric timing change dose and fatigue while the full cycle remains intact.',jsonb_build_object('tempo','declared','durationRecomputed',TRUE)),
    ('Paused Pull-Up','modifier_annotation','A pause at the bottom, midpoint, or top changes time under tension within the same full cycle.',jsonb_build_object('pausePosition','declared','pauseSeconds','declared')),
    ('Range-Limited Pull-Up','modifier_annotation','A reviewed symptom-free range constraint is delivery metadata unless it changes the repetition into an isolated partial task.',jsonb_build_object('bottomAndTop','declared')),
    ('Mixed-Grip Pull-Up','new_variant','Different left and right forearm orientations create asymmetric shoulder, elbow, wrist, and side-accounting demands.',jsonb_build_object('gripOrientation','mixed','sideDose','balanced')),
    ('Towel Pull-Up','new_variant','A towel interface materially changes grip, wrist, clearance, and failure exposure while retaining the strict vertical-pull cycle.',jsonb_build_object('supportInterface','towel','gripDemand','higher')),
    ('Rope Pull-Up','new_variant','A rope interface changes hand position, grip, friction, clearance, and failure response while preserving the cycle.',jsonb_build_object('supportInterface','rope')),
    ('Ring Pull-Up','new_variant','Independent moving rings add support instability, rotation, spacing, and exit requirements.',jsonb_build_object('supportInterface','rings','stability','moving_independent')),
    ('Wide-Grip Pull-Up','new_variant','A materially wide pronated grip changes shoulder geometry and exact range and requires its own reviewed specification.',jsonb_build_object('gripWidth','wide')),
    ('Close-Grip Pull-Up','new_variant','A materially narrow grip changes joint paths and exact support requirements beyond a casual width annotation.',jsonb_build_object('gripWidth','narrow')),
    ('Chest-to-Bar Strict Pull-Up','new_variant','A higher declared top standard changes range and physical demand while preserving a strict full cycle.',jsonb_build_object('topStandard','chest_contacts_or_reaches_bar')),
    ('Foot-Assisted Pull-Up','new_variant','Foot support changes the assistance interface, force direction, setup, and athlete-controlled contribution.',jsonb_build_object('assistanceMethod','foot_on_box_or_bar')),
    ('Partner-Assisted Pull-Up','new_variant','Manual assistance changes force timing, communication, and spotter exposure and requires a separate exact protocol.',jsonb_build_object('assistanceMethod','partner_manual')),
    ('Weight-Belt Pull-Up','new_variant','A hanging belt load changes retention, swing, clearance, mount, and exit beyond the vest specification.',jsonb_build_object('externalLoadMethod','hanging_weight_belt')),
    ('One-Arm Pull-Up','new_definition','One supporting hand changes identity, asymmetry, grip, failure consequence, and side-specific dose beyond an archer shift.',jsonb_build_object('supportHands',1,'laterality','unilateral')),
    ('Eccentric Pull-Up','new_definition','Top-to-bottom eccentric-only work omits the required concentric ascent and uses a different reset.',jsonb_build_object('contraction','eccentric_only')),
    ('Isometric Pull-Up Hold','new_definition','A timed static position has no complete ascent-return repetition.',jsonb_build_object('contraction','isometric','doseUnit','seconds')),
    ('Scapular Pull-Up','new_definition','Near-straight-arm scapular excursion omits the full elbow-flexion vertical pull.',jsonb_build_object('primaryAction','scapular_excursion')),
    ('Kipping Pull-Up','new_definition','Required hip and knee momentum changes the action sequence, kinematics, fatigue, and repetition contract.',jsonb_build_object('momentum','required_kip')),
    ('Butterfly Pull-Up','new_definition','A continuous cyclic arch-hollow path and non-reversing body trajectory create a distinct repetition sequence.',jsonb_build_object('bodyPath','continuous_butterfly_cycle')),
    ('Muscle-Up','new_definition','The athlete transitions above the support into a dip support rather than terminating at the pull-up top.',jsonb_build_object('terminalAction','transition_to_support')),
    ('L-Sit Pull-Up','new_definition','A required hip-flexed leg hold adds a sustained compression task and distinct failure contract.',jsonb_build_object('requiredConcurrentAction','l_sit')),
    ('Pull-Up to Knee Raise','new_definition','A required knee or leg raise adds an ordered trunk-and-hip action to the vertical pull.',jsonb_build_object('addedAction','knee_or_leg_raise')),
    ('Behind-the-Neck Pull-Up','reject','The name implies a materially different head and shoulder path, but no exact working specification or qualified review is present; reject it from automatic selection pending original specification and review.',jsonb_build_object('selectable',FALSE,'humanReviewRequired',TRUE)),
    ('Clapping or Plyometric Pull-Up','new_definition','Hand release or flight adds projection, regrasp, impact, and failed-catch exposure.',jsonb_build_object('flight','required','regrasp','required'))
  ) a(name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (pronated_variant,supinated_variant,'lateral_substitution',91,
      ARRAY['complexity','stability','fatigue'],
      'Supinated grip preserves the strict full-cycle vertical pull but changes forearm orientation and some elbow, shoulder, wrist, and muscle demands.',
      '{"onlyWhen":"assigned_ranges_and_grip_are_tolerated_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (supinated_variant,pronated_variant,'lateral_substitution',91,
      ARRAY['complexity','stability','fatigue'],
      'Pronated grip preserves the strict cycle but changes the grip-specific joint path and demand.',
      '{"onlyWhen":"assigned_ranges_and_grip_are_tolerated_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (pronated_variant,neutral_variant,'lateral_substitution',92,
      ARRAY['complexity','stability'],
      'Fixed parallel handles preserve the strict cycle while changing forearm orientation, support geometry, and range.',
      '{"onlyWhen":"fixed_handles_and_exact_range_are_available_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (neutral_variant,pronated_variant,'lateral_substitution',92,
      ARRAY['complexity','stability'],
      'A pronated bar preserves the strict cycle but changes the handle and forearm geometry.',
      '{"onlyWhen":"bar_grip_and_exact_range_are_tolerated","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (band_assisted_variant,pronated_variant,'progression',86,
      ARRAY['load','stability','complexity','fatigue'],
      'Removing elastic assistance increases effective body-mass demand and removes band setup while retaining the pronated strict cycle.',
      '{"requires":["bodyweight_range_and_quality_gate","secure_mount_and_exit"],"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (pronated_variant,band_assisted_variant,'regression',86,
      ARRAY['load','stability','complexity','fatigue'],
      'A reviewed band can reduce effective demand but adds changing assistance, anchor, entry, retention, and exit constraints.',
      '{"onlyWhen":"exact_band_interface_is_inspected_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (machine_assisted_variant,pronated_variant,'progression',84,
      ARRAY['load','stability','complexity','fatigue'],
      'Removing counterweight assistance increases effective demand and changes the support and mount while preserving the strict cycle.',
      '{"requires":["bodyweight_range_and_quality_gate","bar_mount_and_exit_control"],"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (pronated_variant,machine_assisted_variant,'regression',84,
      ARRAY['load','stability','complexity','fatigue'],
      'A counterweight machine can reduce effective demand but changes the support, travel path, entry, and exit.',
      '{"onlyWhen":"machine_is_inspected_and_objective_is_preserved","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (pronated_variant,weighted_vest_variant,'progression',90,
      ARRAY['load','fatigue','complexity'],
      'A secured vest adds declared external mass and greater failure and recovery exposure while retaining the pronated strict cycle.',
      '{"requires":["bodyweight_repetitions_with_reserve","secured_vest","loaded_mount_and_exit_control"],"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (weighted_vest_variant,pronated_variant,'regression',90,
      ARRAY['load','fatigue','complexity'],
      'Removing the vest reduces external load and retention demands while preserving the pronated strict cycle.',
      '{"onlyWhen":"bodyweight_variant_preserves_the_session_objective","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (pronated_variant,archer_variant,'progression',82,
      ARRAY['load','stability','complexity','fatigue'],
      'The archer variant shifts load toward one side and adds wide-grip, asymmetry, anti-rotation, and separate side accounting.',
      '{"requires":["strict_pronated_range_with_reserve","wide_grip_tolerance","side_specific_control"],"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (archer_variant,pronated_variant,'regression',82,
      ARRAY['load','stability','complexity','fatigue'],
      'The bilateral pronated variant removes the required side shift and reduces asymmetry and side-accounting demand.',
      '{"onlyWhen":"bilateral_variant_preserves_the_session_objective","recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN v.complexity
      ELSE v.physical END,
    v.anchor_tier,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on support and grip specification, mount and exit, bottom and top standards, strict ascent, body-path control, return, assistance interface, external-load retention, laterality, observation, and quality termination.'
    ELSE
      'Review-only physical-difficulty anchor based on body mass, assistance or external vest load, grip and elbow-flexor demand, range, repetitions, tempo, reserve, rest, failed exposure, fatigue sensitivity, and overlapping pull, hang, climb, row, carry, and grip work.' END
      ||' This is exercise scoring, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (pronated_variant,'strict-pronated-bar-bodyweight',48,72,60),
    (supinated_variant,'strict-supinated-bar-bodyweight',46,68,60),
    (neutral_variant,'strict-neutral-handles-bodyweight',44,66,40),
    (archer_variant,'archer-pronated-bar-side-specific',66,86,80),
    (band_assisted_variant,'band-assisted-pronated-bar',54,50,60),
    (machine_assisted_variant,'counterweight-assisted-pronated',48,48,40),
    (weighted_vest_variant,'weighted-vest-pronated-bar',52,84,80)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_score_v1 score SET
    technical_complexity=CASE score.exercise_id
      WHEN 596 THEN 46 WHEN 599 THEN 66 WHEN 1049 THEN 52
      WHEN 197 THEN 54 WHEN 1352 THEN 46 ELSE 48 END,
    absolute_load_demand=CASE score.exercise_id
      WHEN 596 THEN 68 WHEN 599 THEN 86 WHEN 1049 THEN 84
      WHEN 197 THEN 50 WHEN 1352 THEN 68 ELSE 72 END,
    coordination_demand=CASE score.exercise_id WHEN 599 THEN 78 ELSE 46 END,
    impact=1,supervision_demand=CASE score.exercise_id
      WHEN 599 THEN 64 WHEN 197 THEN 60 ELSE 48 END,
    base_overall_difficulty=greatest(
      CASE score.exercise_id
        WHEN 596 THEN 46 WHEN 599 THEN 66 WHEN 1049 THEN 52
        WHEN 197 THEN 54 WHEN 1352 THEN 46 ELSE 48 END,
      CASE score.exercise_id
        WHEN 596 THEN 68 WHEN 599 THEN 86 WHEN 1049 THEN 84
        WHEN 197 THEN 50 WHEN 1352 THEN 68 ELSE 72 END),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exactVariantRequired',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=70,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Exercise complexity and physical difficulty are not athlete proficiency; exact variant and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,is_published=FALSE,why_publish_ready=FALSE,
    archived=id<>199,
    description=CASE WHEN id=199 THEN
      'From a declared controlled overhead bottom, use the exact grip and support to pull without a required kip until the assigned top standard is reached, then return under control to the same bottom. Assistance, vest load, and archer side shift require exact variants.'
      ELSE 'Archived source representation mapped to the exact canonical Pull-Up / Chin-Up family. It is not independently selectable.' END,
    instructions=CASE WHEN id=199 THEN
      'Declare support, grip, width, assistance or external load, bottom, top, tempo, repetitions, reserve, rest, mount, exit, and stop signal. Use a full secure grip, pull without swinging or leg drive, reach the top without neck reach, and lower to the same bottom under control.'
      ELSE 'Use the canonical Pull-Up / Chin-Up card and select an exact reviewed variant; do not prescribe this archived source representation.' END,
    default_sets=CASE WHEN id=199 THEN 4 ELSE default_sets END,
    default_reps=CASE WHEN id=199 THEN 4 ELSE default_reps END,
    default_work_seconds=NULL,
    default_rest_seconds=CASE WHEN id=199 THEN 150 ELSE default_rest_seconds END,
    est_seconds_per_set=CASE WHEN id=199 THEN 40 ELSE est_seconds_per_set END,
    card_summary=CASE WHEN id=199 THEN
      'Strict full-cycle vertical pull; exact grip, support, assistance or load, range, dose, mount, and exit are mandatory.'
      ELSE 'Archived identity lineage; select the exact canonical family variant.' END,
    coach_language=CASE WHEN id=199 THEN
      'Verify exact variant, support, grip, width, assistance or vest load, bottom, top, body path, scapular and upper-arm motion, elbow, wrist, hand, trunk, legs, tempo, reserve, breathing, return, mount, and exit. Stop for symptoms, support or grip events, kip, range loss, quality decline, or unsafe equipment.'
      ELSE 'Do not prescribe this archived source representation; select and validate an exact canonical variant.' END,
    athlete_language=CASE WHEN id=199 THEN
      'Own the bottom, pull without swinging to the exact top, then lower to the same bottom. Stop while every repetition still matches.'
      ELSE 'Ask the coach for the exact Pull-Up or Chin-Up variant.' END,
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_strict_full_cycle_variant_required_never_silently_change_to_eccentric_isometric_scapular_kipping_butterfly_or_muscle_up',
      'loadRule','record_body_mass_context_assistance_interface_and_setting_or_external_vest_mass',
      'fatigueRule','count_valid_and_failed_repetitions_with_all_pull_hang_climb_row_carry_grip_and_elbow_flexor_work',
      'substitutionRule','revalidate_identity_support_grip_range_assistance_load_dose_fatigue_duration_mount_exit_and_rendering',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY[
      'assistance_setting','vest_mass','repetitions','sets','rest_seconds','tempo']::TEXT[],
    movement_family='Strict full-cycle vertical pull',primary_phase_key='capacity',
    phase_subrole='vertical_pull_strength',primary_order_slot='capacity',
    movement_requirements=jsonb_build_object(
      'support','exact_variant_required','gripOrientation','exact_variant_required',
      'requiredSequence',jsonb_build_array(
        'controlled_bottom','strict_ascent_without_required_kip','declared_top',
        'controlled_return_to_same_bottom','controlled_exit'),
      'assistanceOrExternalLoad','exact_variant_and_profile_required',
      'variantRequired',TRUE,'impactLevel',0),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare support, grip, width, assistance or load, bottom, top, tempo, dose, reserve, rest, mount, exit, and stop signal.',
        'Inspect support, handle, anchor, band or machine, vest, box, mat, clearance, and approach.'),
      'executionSteps',jsonb_build_array(
        'Mount under control and establish the exact bottom with a full grip.',
        'Pull without a required kip or leg drive until the exact top standard is reached.',
        'Return under control to the same bottom while keeping grip, body path, and breathing organized.',
        'Complete the planned controlled exit before changing equipment or variant.'),
      'qualityGate',jsonb_build_array(
        'Exact support, grip, width, assistance or load, range, tempo, and dose.',
        'Repeatable bottom, ascent, top, return, body path, breathing, mount, and exit.',
        'No symptoms, support event, grip loss, unplanned momentum, range loss, or quality decline.'),
      'stopSigns',jsonb_build_array(
        'Pain, pinch, neurologic symptoms, dizziness, faintness, chest pressure, unusual breathlessness, or concerning exertional response.',
        'Support, grip, band, machine, vest, box, mat, clearance, mount, or exit becomes unsafe.',
        'Swing, kip, leg drive, neck reach, body-path change, range loss, failed repetition, or uncontrolled return.')),
    pairing_logic=jsonb_build_object(
      'goodForSessions',jsonb_build_array('upper_body_strength','pull_capacity','climbing_support'),
      'pairsWellAfter',jsonb_build_array('general_preparation','specific_grip_and_range_rehearsal'),
      'pairsWellBefore',jsonb_build_array('lower_priority_accessory_work','non_conflicting_capacity_work'),
      'avoidBefore',jsonb_build_array(
        'priority_climbing_rope_or_grip_work_if_pull_up_fatigue_reduces_quality',
        'heavy_row_carry_or_elbow_flexor_work_if_overlap_exceeds_budget'),
      'doNotUseWhen',jsonb_build_array(
        'support_grip_mount_or_exit_not_controlled','symptoms_or_unusual_exertional_response_present',
        'exact_variant_assistance_or_load_unavailable','safe_clearance_or_equipment_unavailable')),
    media_library=jsonb_build_object(
      'demoVideoSources',jsonb_build_array(
        'https://www.youtube.com/watch?v=GBqAZP6jquc',
        'https://www.youtube.com/watch?v=eGo4IYlbE5g',
        'https://www.youtube.com/watch?v=e1YSApl-QcM',
        'https://www.youtube.com/watch?v=ayvVeCtp83Q',
        'https://www.youtube.com/watch?v=AqCmhR1Bl2Q'),
      'mediaState','oembed_metadata_healthy_exact_match_and_approval_unresolved',
      'internalNotes',jsonb_build_array(
        'Do not treat title, thumbnail, channel, or oEmbed as movement review.',
        'Review full setup, support, grip, range, body path, assistance or load, tempo, return, mount, exit, captions, accessibility, cues, and stop rules.')),
    updated_at=now()
  WHERE id=ANY(source_ids);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(
    canonical_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'legacySources',8,'activeWorkingSpecifications',7,
        'consolidatedDefinitions',3,'sourceDerivedSelectableVariants',0,
        'eccentricIsometricScapularAndKippingBoundariesRecorded',TRUE),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('pull','brace')),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesJointsActionsFrontalSagittalTransverseAndVariantLaterality',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'athleteProficiencyStored',FALSE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,
        'bodyMassAssistanceLoadRangeGripTempoAndFailedExposureTracked',TRUE,
        'sameSessionPullHangClimbRowCarryGripAndElbowFlexorWorkRequired',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'supportGripAnchorAssistanceLoadClearancePopulationSymptomsMountAndExit',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',14,
        'doseDurationScalingLogisticsSubstitutionAndPersistence',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachAndSupportOperations',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'acuteAndPopulationLimitsExplicit',TRUE,
        'unrelatedCalfRaiseCitationRemoved',TRUE,
        'noUniversalDoseSafetyTransferOrDifficultyClaimed',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',12,'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',14,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',32),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01','category','media',
        'message','A qualified human must watch each candidate in full and verify exact definition, variant, support, grip, width, assistance or load, bottom, top, strict path, tempo, return, mount, exit, captions, accessibility, safety, cue quality, conflicts, playback, reviewer identity, and card-version match.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03','category','relationship_graph',
        'message','A qualified coach must approve or reject every progression, regression, and substitution proposal.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01','category','calibration',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not represent athlete proficiency.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01','category','publication',
        'message','A qualified reviewer and separate approver must complete content review before publication.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND status='review' AND card_version=2
        AND provenance_json->>'researchVersion'=research_version
        AND approved_video_url IS NULL AND reviewed_by IS NULL
        AND approved_by IS NULL AND last_reviewed_at IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(consolidated_definition_ids) AND status='archived'
        AND legacy_exercise_id IS NULL)<>3
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=canonical_id)<>8
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids)
        AND provenance_json->'researchSources' @>
          '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB) THEN
    RAISE EXCEPTION '% left invalid definitions, source mappings, or unrelated calf-raise provenance',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
        AND status='review' AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND load_profile_json<>'{}'::JSONB
        AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>7
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(old_variant_ids) AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>4 THEN
    RAISE EXCEPTION '% requires seven exact variants and four archived generic representations',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(dosage_json->>'repetitions','')<>''
        AND cardinality(equipment_required)>=2
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 300
        AND cardinality(stop_rules)>=10)<>14 THEN
    RAISE EXCEPTION '% requires fourteen complete contextual delivery profiles',migration_key;
  END IF;

  IF (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>32 THEN
    RAISE EXCEPTION '% found incomplete evidence, media, or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND to_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>12
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>14 THEN
    RAISE EXCEPTION '% found incomplete graph or calibration review queues',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id=ANY(consolidated_definition_ids)
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>3
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id=ANY(ARRAY[
          eccentric_definition,isometric_definition,scapular_definition])
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% requires explicit consolidation and contraction-boundary decisions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY[
            'load','leverage','range','speed','stability','complexity',
            'impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND (skill_level IS NOT NULL OR age_min IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (
        anatomy_json='{}'::JSONB OR environment_json='{}'::JSONB
        OR population_json='{}'::JSONB OR athlete_support_json='{}'::JSONB
        OR coach_support_json='{}'::JSONB OR support_operations_json='{}'::JSONB
        OR provenance_json->>'approvalsCreated'<>'false'
        OR approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% found incomplete support, exercise proficiency, age fabrication, or fabricated approval',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id AND card_version=2
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)=
          ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01'])<>1 THEN
    RAISE EXCEPTION '% requires exactly the four protected human gates',migration_key;
  END IF;
END $$;
