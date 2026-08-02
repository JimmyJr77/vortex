-- Replace generic World's Greatest Stretch source variants with exact,
-- review-only working specifications. Identity, research, media, graph,
-- calibration, and publication remain fail-closed and human-review gated.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '471_coaching_worlds_greatest_stretch_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.78';
  canonical_id CONSTANT UUID := 'af147afc-63e9-4944-a5b5-d3b5d2fa6120';
  duplicate_id CONSTANT UUID := '79163605-3c21-4d37-ab50-07bdd288d99a';
  affected_definition_ids CONSTANT UUID[] := ARRAY[canonical_id,duplicate_id];
  source_ids CONSTANT BIGINT[] := ARRAY[10,883];
  source_variant_ids CONSTANT UUID[] := ARRAY[
    'a95b10d1-0da7-4395-bddc-353c317c4939'::UUID,
    'c5dc4aaa-9f26-4bd9-a879-22d0c96e330b'::UUID];
  knee_down_variant CONSTANT UUID := 'e96c7db2-05dd-43fd-b3aa-0c40fc2b6736';
  knee_up_variant CONSTANT UUID := 'c6bacbb4-698d-41e9-8986-eb33d2b8f520';
  active_variant_ids CONSTANT UUID[] := ARRAY[knee_down_variant,knee_up_variant];
  spiderman_definition CONSTANT UUID := '4484c7a4-4f6d-4dd4-9dd2-caf7622e8a22';
  spiderman_variant CONSTANT UUID := '27f0bc89-fa06-438f-ac73-56137c07bd2a';
  inchworm_definition CONSTANT UUID := '61ecee7c-48e5-4a5f-8325-e3991be4f202';
  inchworm_variant CONSTANT UUID := '72ef0437-def5-4672-a463-c57182e4a3e1';
  plank_definition CONSTANT UUID := 'b2018692-7c1d-49d4-a49b-d984ca3b63ed';
  plank_variant CONSTANT UUID := 'fad0d11a-d3c3-4824-b347-b2c4d28a1352';
  current_video_ids CONSTANT TEXT[] := ARRAY[
    '-CiWQ2IvY34','FIZMUyAPPWY','CXnge363CH8','VQqabRnOR1E'];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND slug='worlds-greatest-stretch'
        AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_id AND slug='worlds-greatest-stretch-with-rotation')
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=ANY(source_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(ARRAY[spiderman_definition,inchworm_definition,plank_definition])
          AND status<>'archived')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(ARRAY[spiderman_variant,inchworm_variant,plank_variant])
          AND status<>'archived')<>3 THEN
    RAISE EXCEPTION '% prerequisite identity state is missing or drifted',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_id) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',
      migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
          OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status IN('approved'))
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=ANY(source_ids)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
      OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_id,
      source_kind=CASE WHEN legacy_exercise_id=10
        THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)
        ||jsonb_build_object(
          'migration',migration_key,
          'sourceDisposition',CASE WHEN legacy_exercise_id=10
            THEN 'mapped_to_research_authored_working_specifications'
            ELSE 'duplicate_rotation_label_consolidated' END,
          'representedBySelectableSourceVariant',FALSE,
          'sourceMovementEvidence','long_lunge_instep_reach_ipsilateral_rotation_and_front_hamstring_rockback',
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1
  SET definition_id=canonical_id,
      variant_key='identity-quarantine-source-'
        ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
      display_name='World''s Greatest Stretch Identity Quarantine — Source '
        ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
      modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
      requirements_json=jsonb_build_object(
        'selectable',FALSE,'representation','identity_quarantine',
        'sourceLegacyExerciseId',source_ids[array_position(source_variant_ids,id)],
        'archiveReason',CASE id
          WHEN source_variant_ids[1]
            THEN 'generic_source_variant_permits_rear_knee_down_or_up_and_does_not_fix_entry_exit_rotation_range_rockback_range_tempo_or_dose'
          ELSE 'duplicate_source_variant_does_not_fix_rear_knee_position_entry_exit_rotation_range_rockback_range_tempo_or_dose' END,
        'researchAuthoredReplacementRequired',TRUE,
        'humanReviewRequired',TRUE),
      load_profile_json=jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=jsonb_build_object('selectable',FALSE),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','identity_quarantine','selectable',FALSE,
        'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1
  SET status='archived',approved_video_url=NULL,reviewed_by=NULL,
      approved_by=NULL,last_reviewed_at=NULL,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)
        ||jsonb_build_object(
          'worldsGreatestStretchAuditMigration',migration_key,
          'identityResolution','duplicate_consolidated',
          'canonicalSurvivorDefinitionId',canonical_id,'selectable',FALSE,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=duplicate_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,canonical_id,duplicate_id,'duplicate_consolidated',
    'Both records require a long-lunge instep or elbow reach, ipsilateral thoracic rotation, return of the hand, and front-leg hamstring rockback. Adding “with rotation” does not create a new exercise because rotation is already identity-defining; rear-knee support, entry, exit, range, tempo, breathing, and dose remain variant or delivery dimensions.',
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','same_lunge_rotation_hamstring_rockback_sequence',
      'variantDimensions',jsonb_build_array(
        'rear_knee_support','entry','exit','elbow_depth','rotation_range',
        'rockback_range','tempo','breathing','dose'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_and_traceability_only'),
    'deterministic_exact_identity',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,canonical_id,spiderman_definition,'distinct_exercises',
    'World''s Greatest Stretch requires an ipsilateral thoracic rotation between the instep reach and hamstring rockback. Spiderman Lunge Hamstring Sweep omits that rotation and centers the lunge-to-hamstring sweep, so adding or removing rotation changes required actions and identity.',
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','required_thoracic_rotation_vs_rotation_free_lunge_hamstring_sweep',
      'baseContract','lunge_instep_reach_ipsilateral_rotation_hamstring_rockback',
      'neighborContract','spiderman_lunge_to_hamstring_sweep_without_required_rotation',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_only_neighbor_canonical_audit_still_required'),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Lunge Instep Reach to Ipsilateral Rotation and Hamstring Rockback',
    display_name='World''s Greatest Stretch',
    aliases=ARRAY[
      'Worlds Greatest Stretch','World''s Greatest Stretch with Rotation',
      'Lunge Elbow Drop to Rotation and Hamstring Stretch',
      'Lunge Instep Reach Rotation Rockback']::TEXT[],
    description='From a declared direct step or reset, establish a long lunge with both hands inside the lead foot. Lower the lead-side elbow toward the instep only through owned range, then rotate the same-side arm and thorax upward while the pelvis and lead-knee line remain controlled. Return the hand, shift the hips back, and extend the lead knee through an owned hamstring-rockback range before resetting or switching. Every selectable variant fixes rear-knee support, entry, exit, range, tempo, side order, dose, and quality stop.',
    family_key='integrated_lunge_rotation_hamstring_rockback_mobility',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=88,scoring_confidence=66,media_confidence=50,
    movement_patterns=ARRAY['squat','hinge','rotate','reach']::TEXT[],
    body_regions=ARRAY[
      'full_body','hip','hamstrings','ankle','knee','thoracic_spine',
      'shoulder','wrist','core']::TEXT[],
    required_equipment=ARRAY['none']::TEXT[],
    optional_equipment=ARRAY['mat','yoga_block']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'iliopsoas','rectus_femoris','hamstrings','adductor_magnus',
        'gluteus_maximus','external_oblique','internal_oblique'),
      'secondaryMuscles',jsonb_build_array(
        'gastrocnemius','soleus','gluteus_medius','quadriceps',
        'thoracic_erector_spinae','serratus_anterior','deltoid'),
      'stabilizers',jsonb_build_array(
        'deep_spinal_stabilizers','rotator_cuff','scapular_stabilizers',
        'foot_intrinsics','pelvic_stabilizers'),
      'joints',jsonb_build_array(
        'hip','knee','ankle','thoracic_spine','lumbar_spine','pelvis',
        'glenohumeral_joint','scapulothoracic_articulation','elbow','wrist'),
      'jointActions',jsonb_build_array(
        'lead_hip_flexion','rear_hip_extension','lead_ankle_dorsiflexion',
        'lead_knee_flexion_then_extension','ipsilateral_thoracic_rotation',
        'moving_shoulder_horizontal_abduction_and_flexion',
        'support_arm_closed_chain_stabilization','hip_hinge_rockback',
        'pelvic_and_lumbar_position_control'),
      'jointActionPhases',jsonb_build_object(
        'lunge',jsonb_build_array(
          'lead_hip_and_knee_flexion','rear_hip_extension',
          'lead_ankle_dorsiflexion'),
        'instepReach','lead_side_elbow_approaches_instep_through_owned_range',
        'rotation',jsonb_build_array(
          'lead_side_thoracic_rotation','same_side_arm_reaches_up',
          'pelvis_and_lead_knee_remain_controlled'),
        'rockback',jsonb_build_array(
          'moving_hand_returns','hips_shift_back','lead_knee_extends',
          'spine_stays_long_without_forced_end_range'),
        'reset','declared_return_or_side_switch'),
      'planes',jsonb_build_array('sagittal','transverse','multiplanar'),
      'laterality','alternating',
      'evidenceLimit','The exact named sequence has not been validated as a single intervention. Professional technique and general dynamic-stretching evidence do not establish individual muscle force, treatment effect, injury prevention, long-term adaptation, universal dose, or readiness.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_non_slip_floor_with_optional_mat',
      'clearance',jsonb_build_array(
        'one_long_lunge_length','full_upward_arm_reach',
        'hamstring_rockback_space','safe_entry_and_exit','no_cross_traffic'),
      'station','one_lunge_lane_per_athlete',
      'visualReference','coach_front_quarter_and_side_view',
      'changeRule','Elevated hands, blocks, continuous walking, plank entry, inchworm entry, added load, or omitted rotation requires an explicitly reviewed variant or neighboring definition.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_enter_a_supported_long_lunge_bear_hand_support_rotate_and_rock_back_without_symptoms_or_loss_of_control',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array(
        'pain_free_floor_or_supported_lunge_entry','lead_foot_can_stay_stable',
        'hand_support_and_upward_reach_are_tolerated',
        'can_control_lead_knee_and_pelvis','can_report_symptoms_and_uncertainty'),
      'cautions',jsonb_build_array(
        'current_or_recent_hip_knee_ankle_spine_shoulder_elbow_or_wrist_symptoms',
        'neurologic_symptoms_dizziness_or_balance_concern',
        'hypermobility_or_end_range_apprehension','pregnancy_or_postpartum_position_or_pressure_concern',
        'recent_high_volume_lunge_hamstring_rotation_or_hand_support_training',
        'unsafe_floor_access_or_inability_to_rise_safely'),
      'notClinicalClearance',TRUE,
      'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This dynamic sequence rehearses a controlled lunge, upper-back rotation, and front-leg rockback in one low-fatigue flow. The goal is usable, repeatable range—not touching the elbow to the floor or forcing a stretch.',
      'primaryCue','Long lunge, lead elbow toward the instep, same arm rotates up, hand returns, hips rock back, then reset or switch.',
      'before',jsonb_build_array(
        'Confirm rear knee down or up, entry and exit, starting side, ranges, tempo, repetitions each side, rest, and stop signal.',
        'Check floor, hand support, overhead clearance, and a safe way to enter and exit.',
        'Use the assigned hand support; do not remove a block or support silently.'),
      'during',jsonb_build_array(
        'Keep the lead foot planted and knee tracking with the foot.',
        'Rotate the lead-side arm and chest only through controlled range.',
        'Return the hand before shifting the hips back.',
        'Keep breathing and stop before pinching, nerve-like symptoms, or balance loss.'),
      'expectedSensations',jsonb_build_array(
        'rear_front_of_hip_stretch','lead_inner_hip_or_glute_stretch',
        'lead_hamstring_tension_during_rockback','upper_back_rotation_effort',
        'support_arm_and_trunk_stabilization'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_pain','joint_pinch','numbness_or_tingling',
        'radiating_or_electrical_tension','dizziness_or_nausea',
        'wrist_or_shoulder_instability','loss_of_balance_or_breath_lock'),
      'painGuidance','Return the moving hand, reduce the lunge, stop in a stable position, and tell the coach. Do not force the next phase or repeat automatically.',
      'selfChecks',jsonb_build_array(
        'exact_rear_knee_variant','lead_foot_flat_and_knee_controlled',
        'lead_side_elbow_and_arm','rotation_precedes_rockback',
        'owned_not_forced_range','continuous_breathing','stable_reset'),
      'accessibility',jsonb_build_array(
        'rear_knee_down_variant','smaller_lunge','smaller_rotation',
        'smaller_rockback','hands_on_reviewed_elevated_support_variant',
        'fewer_repetitions','longer_rest','written_or_live_nonvideo_instruction'),
      'mediaAlternatives',jsonb_build_array(
        'written_five_phase_sequence','front_quarter_and_side_still_sequence',
        'coach_live_demonstration','visual_floor_markers'),
      'stopSignal','Say stop, return both hands to support, shorten the lunge, and report what changed.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_variant_entry_exit_start_side_range_tempo_and_dose',
        'lead_foot_and_knee_line','rear_knee_support_and_pelvic_control',
        'lead_side_elbow_instep_path','thoracic_not_forced_lumbar_rotation',
        'hand_return_before_rockback','lead_knee_extension_and_long_spine',
        'breathing_symptoms_balance_and_reset'),
      'faultCorrections',jsonb_build_object(
        'lead_heel_lifts_or_knee_collapses','shorten_lunge_and_reduce_forward_range',
        'elbow_forced_to_floor','use_an_owned_elbow_depth_or_support',
        'pelvis_spins_with_arm','reduce_rotation_and_anchor_lead_foot',
        'lumbar_twist_or_extension','reduce_range_and_recue_rib_pelvis_control',
        'rockback_rounding_or_nerve_tension','reduce_knee_extension_and_rockback_range',
        'wrist_or_shoulder_symptom','stop_and_use_a_separately_reviewed_support_option',
        'balance_or_breathing_loss','end_set_and reassess'),
      'demonstrationPlan',jsonb_build_array(
        'show_exact_rear_knee_variant_and_entry','show_lead_elbow_to_instep_path',
        'show_same_side_rotation_with_stable_pelvis','show_hand_return_then_rockback',
        'show_reset_or_switch_and_first_quality_stop'),
      'groupManagement',jsonb_build_array(
        'one_athlete_per_clear_lunge_lane','align_all_starting_sides',
        'stagger_rows_to_protect_upward_reach','declare_entry_exit_and_cadence',
        'record_both_sides_and_failed_attempts'),
      'modificationDecisionTree',jsonb_build_array(
        'pain_pinch_neurologic_sign_dizziness_or_instability_stop_and_escalate',
        'rear_knee_or_sequence_unknown_quarantine_selection',
        'range_or_balance_failure_reduce_range_or_use_knee_down_variant',
        'floor_or_hand_support_issue_select_separately_reviewed_variant',
        'recompute_duration_fatigue_and_rendering_after_every_change'),
      'doNotUseWhen',jsonb_build_array(
        'floor_or_lunge_entry_is_not_tolerated','pain_pinch_neurologic_or_dizzy_symptoms_present',
        'hand_support_or_rotation_is_not_tolerated','lead_knee_or_balance_cannot_be_controlled',
        'safe_space_entry_exit_or_coach_sightline_is_unavailable'),
      'validRepetition','The exact rear-knee support, entry, lunge, lead-side instep reach, ipsilateral rotation, hand return, hamstring rockback, tempo, breathing, reset, and symptom gates all pass.'),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity_or_variant_mismatch','unsafe_floor_space_or_support',
        'pain_pinch_neurologic_dizziness_or_instability',
        'lunge_rotation_rockback_sequence_or_breathing_failure',
        'dose_duration_fatigue_or_recovery_mismatch',
        'broken_inaccessible_or_mismatched_media'),
      'supportEscalation',jsonb_build_object(
        'safety','remove_from_selection_and_alert_coach_or_library_owner',
        'identity','quarantine_and_route_to_canonical_identity_review',
        'symptoms','stop_session_exposure_and_follow_facility_health_protocol',
        'doseOrFatigue','route_to_programming_review_before_reuse',
        'media','quarantine_candidate_and_schedule_re_review'),
      'retentionPolicy',jsonb_build_object(
        'attemptAndDoseRecord','retain_with_saved_workout_version',
        'symptomAndIncidentRecord','facility_health_and_incident_policy',
        'athleteFeedbackDays',365,
        'mediaReview','retain_reviewer_timestamp_card_version_and_decision'),
      'changeImpactPolicy',jsonb_build_object(
        'identityOrSafetyChange','invalidate_release_and_revalidate_saved_workouts',
        'variantScoreOrDoseChange','recompute_selection_fatigue_duration_and_substitutions',
        'instructionChange','increment_card_version_and_recheck_media',
        'mediaChange','invalidate_media_review_only',
        'relationshipChange','revalidate_substitution_and_progression_paths'),
      'generationRecords',jsonb_build_array(
        'definition_id','variant_id','profile_key','rear_knee_support',
        'entry_exit_starting_side_ranges_tempo_breathing',
        'planned_completed_failed_repetitions_each_side','rest_duration',
        'first_quality_break_symptoms_stop_reason_substitution'),
      'publicationQuarantined',TRUE,'mediaReviewRequired',TRUE,
      'relationshipReviewRequired',TRUE,'calibrationReviewRequired',TRUE),
    provenance_json=coalesce(provenance_json,'{}'::JSONB)
      ||jsonb_build_object(
        'worldsGreatestStretchAuditMigration',migration_key,
        'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
        'legacySources',source_ids,
        'consolidatedDefinitionIds',jsonb_build_array(duplicate_id),
        'activeWorkingSpecifications',jsonb_build_array(
          'rear-knee-down-floor-flow','rear-knee-up-long-lunge-flow'),
        'primaryIdentitySource','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
        'researchSources',jsonb_build_array(
          'https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
          'https://pubmed.ncbi.nlm.nih.gov/29063454/',
          'https://pubmed.ncbi.nlm.nih.gov/24149201/'),
        'mediaState','four_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'researchLimits','no_exact_sequence_trial_general_dynamic_stretching_evidence_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',8,'decisionDemand',8,
      'workCapacityDemand',v.work_capacity,'impact',1,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',1,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',1,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'entry','direct_step_or_stationary_reset_no_plank_or_inchworm_required',
      'start','long_lunge_both_hands_inside_lead_foot',
      'rearKneeSupport',v.rear_knee,
      'sequence',jsonb_build_array(
        'lead_side_elbow_toward_instep','same_side_arm_and_thorax_rotate_up',
        'moving_hand_returns','hips_rock_back_and_lead_knee_extends',
        'declared_reset_or_switch'),
      'range','individually_owned_and_recorded',
      'tempo','profile_declared_controlled','laterality','alternating_sides',
      'breathing','continuous_without_forced_end_range',
      'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'externalLoadMethod','bodyweight',
      'externalLoadDescription','Bodyweight lunge, hand support, rotation, and rockback only; no added load or partner force.',
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'effectiveLoadDrivers',jsonb_build_array(
        'rear_knee_support','lunge_length','lead_ankle_and_hip_range',
        'hand_support','rotation_range','rockback_range','tempo',
        'repetitions_each_side','prior_lunge_hamstring_and_hand_support_fatigue'),
      'loadTracking',jsonb_build_array(
        'exact_variant','entry_exit','ranges','tempo','repetitions_each_side',
        'failed_attempts','same_session_lunge_hamstring_rotation_and_hand_support_work')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',8,
      'recoveryWindow','typically_4_to_18_hours_context_novelty_volume_range_and_symptom_dependent',
      'primaryFatigueSites',jsonb_build_array(
        'lead_leg','rear_hip_flexors','hamstrings','support_wrist_and_shoulder','trunk'),
      'earlyFatigueSignals',jsonb_build_array(
        'lead_heel_lift_or_knee_collapse','pelvis_spins_or_lumbar_region_twists',
        'elbow_depth_or_rotation_range_forced','rockback_rounding_or_range_loss',
        'support_arm_collapse','rushed_transition_or_breath_lock'),
      'downstreamConflicts',jsonb_build_array(
        'priority_lunge_sprint_hamstring_or_rotation_work',
        'high_volume_wrist_or_shoulder_support_work',
        'symptomatic_hip_knee_ankle_spine_shoulder_or_wrist_loading')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'integrated_dynamic_mobility','lunge_position_access',
        'thoracic_rotation_control','hamstring_rockback_range',
        'alternating_sequence_coordination'),
      'stimulusDose',jsonb_build_object(
        'primary','quality_repetitions_each_side',
        'countFailedAttemptsAsExposure',TRUE,'fatigueCeiling','low'),
      'weeklyExposure','Combine valid and failed repetitions with all lunges, split squats, hamstring mobility or loading, thoracic rotation, and prolonged hand-support work.',
      'prerequisites',jsonb_build_array(
        'pain_free_assigned_entry','exact_rear_knee_variant_understood',
        'lead_foot_knee_and_balance_control','hand_support_and_rotation_tolerated'),
      'completionCriteria',jsonb_build_array(
        'exact_entry_rear_knee_sequence_ranges_tempo_and_side_order',
        'controlled_lead_foot_knee_pelvis_spine_and_support_arm',
        'continuous_breathing_and_stable_reset',
        'dose_fault_symptom_duration_and_recovery_recorded'),
      'sequenceRules',jsonb_build_array(
        'use_after_general_temperature_and_specific_floor_access_preparation',
        'place_before_high_output_work_only_when_low_fatigue',
        'follow_with_task_specific_activation_or_rehearsal',
        'stop_before_range_chasing_or_position_failure'),
      'pairingCompatibility',jsonb_build_array(
        'task_specific_activation','low_demand_sprint_squat_or_lunge_rehearsal'),
      'interferenceRules',jsonb_build_array(
        'do_not_turn_the_drill_into_long_passive_holds_before_priority_power',
        'do_not_silently_change_to_inchworm_plank_or_rotation_free_sweep',
        'recompute_identity_fatigue_duration_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object(
        'unknownRearKneeEntrySequenceRangeSupportOrSymptoms','fail_closed_and_request_coach_review',
        'neverInferMissingMechanicsFromNameOrVideoTitle',TRUE,
        'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE),
      'cumulativeBudget',jsonb_build_object(
        'qualityRepetitionsEachSide',v.rep_budget,
        'integratedMobilitySecondsEstimate',v.seconds_budget,
        'landingContacts',0,'failedAttemptsCount',TRUE,
        'sameSessionLungeHamstringRotationAndHandSupportWorkRequired',TRUE))
  FROM (VALUES
    (knee_down_variant,'rear-knee-down-floor-flow',
      'World''s Greatest Stretch — Rear Knee Down Floor Flow',
      ARRAY['rear_knee_down','floor_support','dynamic_mobility','bodyweight']::TEXT[],
      42,26,24,58,32,38,48,24,16,24,16,30,18,18,22,28,34,38,
      'rear_knee_contacts_optional_mat_after_lunge_entry',24,360),
    (knee_up_variant,'rear-knee-up-long-lunge-flow',
      'World''s Greatest Stretch — Rear Knee Up Long-Lunge Flow',
      ARRAY['rear_knee_up','long_lunge','floor_support','dynamic_mobility','bodyweight']::TEXT[],
      50,34,32,64,46,48,56,30,22,30,22,38,24,24,30,36,44,48,
      'rear_knee_remains_off_floor_with_back_leg_long',20,360)
  ) v(id,variant_key,display_name,modifiers,complexity,physical,
      relative_strength,mobility,balance,stability,coordination,work_capacity,
      eccentric,joint_stress,spinal_loading,grip,fear,supervision,failure,
      local_fatigue,grip_fatigue,technical_fatigue,rear_knee,rep_budget,seconds_budget)
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
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,90,
    jsonb_build_object(
      'integratedDynamicMobility',5,'lungePositionAccess',5,
      'thoracicRotationControl',4,'hamstringRockbackRange',4,
      'strengthHypertrophyClaim',0,'fatigueConditioning',0),
    jsonb_build_object(
      'doseType','repetitions_each_side','sets',profile.sets,
      'repetitionsEachSide',profile.reps_each_side,
      'restSeconds',profile.rest_seconds,'tempo',profile.tempo,
      'range','owned_recorded_not_forced','qualityTerminated',TRUE,
      'countFailedAttemptsAsExposure',TRUE,
      'evidenceStatus','provisional_coaching_dose_not_a_research_prescription'),
    'Every counted repetition uses the assigned entry, rear-knee support, lead-side instep reach, ipsilateral rotation, hand return, hamstring rockback, tempo, breathing, and reset while lead foot, knee, pelvis, spine, support arm, balance, and symptoms pass.',
    ARRAY[
      'sharp_or_increasing_pain_joint_pinch_numbness_tingling_radiation_dizziness_nausea_or_fear',
      'wrong_or_unknown_variant_entry_exit_rear_knee_starting_side_range_tempo_or_dose',
      'floor_mat_support_space_overhead_clearance_or_exit_becomes_unsafe',
      'lead_heel_lifts_foot_rolls_or_knee_collapses_or_shifts_uncontrolled',
      'rear_knee_or_pelvis_changes_from_the_assigned_variant',
      'elbow_is_forced_or_the_wrong_arm_rotates',
      'pelvis_spins_or_lumbar_extension_rotation_replaces_thoracic_rotation',
      'support_wrist_elbow_or_shoulder_collapses_or_becomes_symptomatic',
      'rockback_causes_rounding_nerve_like_tension_or_loss_of_balance',
      'planned_repetitions_duration_or_cumulative_mobility_budget_is_reached'],
    profile.coach_instructions,profile.athlete_instructions,
    profile.expected_adaptation,ARRAY['none']::TEXT[],
    jsonb_build_object(
      'athletesPerStation',1,'setupSeconds',30,'transitionSeconds',20,
      'station','one_clear_non_slip_lunge_lane_per_athlete',
      'equipmentCheck','dry_floor_optional_mat_and_clear_arm_and_rockback_paths',
      'coachPosition','front_quarter_then_side_view_outside_reach_path',
      'changeRule','coach_rechecks_identity_and_recomputes_dose_fatigue_duration_and_rendering',
      'substitutionRevalidation',jsonb_build_array(
        'identity','entry','exit','rear_knee_support','sequence','ranges',
        'tempo','population','dose','fatigue','duration','rendering')),
    CASE profile.variant_id
      WHEN knee_down_variant THEN ARRAY[knee_up_variant,spiderman_variant,plank_variant]::UUID[]
      ELSE ARRAY[knee_down_variant,spiderman_variant,inchworm_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'setupSeconds',30,'repetitionSeconds',profile.rep_seconds,
      'resetSeconds',4,'transitionSeconds',20,'durationIncludesRest',TRUE,
      'durationFormula','setup + sets * (repetitions_each_side * 2 * (repetition + reset)) + inter_set_rest + transition',
      'durationCeilingSeconds',profile.duration_ceiling,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'reduce',jsonb_build_array(
        'reduce_lunge_depth','reduce_elbow_depth','reduce_rotation',
        'reduce_rockback','use_rear_knee_down_variant','reduce_repetitions','increase_rest'),
      'increase',jsonb_build_array(
        'increase_owned_range_within_same_variant','add_one_repetition_each_side_within_budget',
        'use_rear_knee_up_only_after_review'),
      'changeOneVariableAtATime',TRUE,'revalidateAfterChange',TRUE,
      'symptomRule','stop_and_select_reviewed_pain_free_alternative'),
    jsonb_build_object(
      'record',jsonb_build_array(
        'definition_id','variant_id','profile_key','entry_exit','rear_knee_support',
        'starting_side_lunge_elbow_rotation_and_rockback_ranges','tempo_breathing',
        'planned_completed_and_failed_repetitions_each_side',
        'first_position_sequence_balance_or_breathing_break',
        'rest_duration_symptoms_stop_reason_and_substitution'),
      'comparisonRule','Compare only when variant, entry, rear-knee support, ranges, tempo, side order, and measurement method match.',
      'validity','all exact identity sequence position breathing dose symptom duration and reset gates pass'),
    jsonb_build_object(
      'before','Which exact variant, entry, exit, starting side, ranges, tempo, repetitions per side, rest, and stop signal are assigned?',
      'during','Do the lead foot, knee, pelvis, spine, support arm, lead-side rotation, hand return, rockback, breathing, and balance still match?',
      'after','Store completed and failed repetitions each side, first break, symptoms, duration, rest, and substitution.',
      'supportEscalation','Escalate symptoms, identity mismatch, inaccessible instruction, or media mismatch through the documented support path.',
      'mediaFallback','Use the written five-phase contract and qualified live demonstration until an exact video is independently approved.')
  FROM (VALUES
    (knee_down_variant,'prepare-knee-down-integrated-mobility','prepare_and_access','primary',
      'Use a supported rear-knee-down sequence to access lunge, rotation, and hamstring-rockback ranges with minimal fatigue.',94,1,3,15,'three_second_lunge_two_second_rotation_three_second_rockback',10,480,
      'Confirm rear knee down, lead-side arm, owned ranges, hand return before rockback, and stable breathing. Stop before passive hanging or range chasing.',
      'Rear knee down. Lead elbow in, same arm up, hand down, hips back, then reset. Use only your smooth range.',
      'More repeatable access to the integrated lunge-rotation-rockback sequence without meaningful fatigue.'),
    (knee_down_variant,'movement-intelligence-knee-down-sequence','movement_intelligence','secondary',
      'Practice exact phase order, side recognition, range ownership, and stable transitions.',90,2,4,25,'controlled_ten_second_sequence',10,700,
      'Observe phase order and both sides. End on the first wrong arm, pelvic spin, lead-knee loss, support collapse, or rockback compensation.',
      'Repeat the same five phases on each side. Keep your foot and knee steady and finish one phase before the next.',
      'Cleaner alternating sequence control and more reproducible owned ranges.'),
    (knee_down_variant,'recovery-knee-down-low-dose-flow','resilience','conditional',
      'Use a low-dose quality flow when recovery context permits and the drill reduces rather than creates symptoms or fatigue.',78,1,3,30,'slow_continuous_quality_flow',11,520,
      'Do not prescribe as treatment or chase range. Record pre/post symptoms and stop if motion worsens, radiates, or becomes less controlled.',
      'Move slowly for up to three repetitions each side. Stop if you feel worse, less steady, or more restricted.',
      'A brief low-fatigue mobility exposure with documented symptom and range response.'),
    (knee_up_variant,'prepare-knee-up-integrated-mobility','prepare_and_access','primary',
      'Use the rear-knee-up long-lunge sequence before task-specific preparation when it stays crisp and low fatigue.',92,1,3,20,'three_second_lunge_two_second_rotation_three_second_rockback',10,500,
      'Verify the back leg stays long, the lead heel and knee stay controlled, and rotation comes from the upper trunk without sacrificing the lunge.',
      'Keep the rear knee up and leg long. Lead elbow in, same arm up, hand down, hips back, then switch.',
      'More repeatable long-lunge access, thoracic rotation, and hamstring rockback before priority work.'),
    (knee_up_variant,'movement-intelligence-knee-up-sequence','movement_intelligence','secondary',
      'Develop repeatable rear-knee-up balance, phase order, and bilateral range control.',88,2,4,30,'controlled_ten_second_sequence',10,720,
      'Record side-specific lunge, rotation, and rockback ranges. Stop when balance, lead-knee line, pelvis, support arm, or sequence changes.',
      'Match the same long-lunge sequence on both sides. Own the ranges and reset before the next repetition.',
      'Improved reproducibility of the more demanding rear-knee-up sequence.'),
    (knee_up_variant,'resilience-knee-up-low-volume','resilience','conditional',
      'Accumulate a small number of controlled long-lunge mobility repetitions without turning the drill into conditioning.',76,2,3,40,'slow_quality_terminated_flow',11,760,
      'Cap volume, count failed attempts, and combine exposure with all same-session lunge, hamstring, rotation, and hand-support work.',
      'Complete up to three clean repetitions each side. Stop before your ranges, balance, breathing, or sequence change.',
      'Greater repeatability of the long-lunge mobility sequence under a low, quality-terminated dose.')
  ) profile(variant_id,profile_key,phase_key,role,purpose,suitability,
      sets,reps_each_side,rest_seconds,tempo,rep_seconds,duration_ceiling,
      coach_instructions,athlete_instructions,expected_adaptation)
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
  SELECT canonical_id,2,e.section_key,e.source_url,e.source_title,
    e.source_publisher,e.source_kind,
    e.claims||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'limitations','No source validates this exact named sequence as a universal intervention or establishes individual safety, treatment effect, injury prevention, long-term adaptation, transfer, dose, difficulty score, or publication approval.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The professional sequence identifies a long-lunge hip opener, lead-side elbow depth, active thoracic rotation, and a hamstring phase.','limits','Professional instruction defines technique but is not comparative outcome evidence.'))),
    ('taxonomy','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The drill combines hip-position access, thoracic rotation, shoulder support and reach, and front-leg hamstring positioning.'))),
    ('anatomy','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The instruction explicitly discusses the hip flexors, front hip, thoracic spine, shoulder girdle, and hamstring phase.','limits','This does not measure muscle force or validate every listed stabilizer.'))),
    ('biomechanics','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The support arm is used actively while the torso rotates toward the lead leg; the hamstring phase follows the rotation phase.','limits','Kinematics and kinetics were not measured.'))),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/29063454/',
      'Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research',88,
      jsonb_build_array(jsonb_build_object(
        'claim','Dynamic-stretching effects vary with duration, amplitude, and velocity.','limits','No universal exercise-complexity or physical-difficulty scale and no exact-sequence score were studied.'))),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/29063454/',
      'Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research',88,
      jsonb_build_array(jsonb_build_object(
        'claim','Protocol variables can produce positive, neutral, or negative acute performance responses.','limits','The review does not prescribe fatigue ceilings or recovery hours for this drill.'))),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/24149201/',
      'Effects of dynamic and static stretching within general and activity specific warm-up protocols','Journal of Sports Science and Medicine','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Warm-up effects were tested in a specific participant sample and activity-specific context.','limits','Results cannot be generalized to symptomatic populations or this exact floor sequence.'))),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/29063454/',
      'Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research',88,
      jsonb_build_array(jsonb_build_object(
        'claim','Duration, amplitude, and velocity are meaningful protocol variables.','limits','Working sets, repetitions, rest, and duration remain provisional coaching proposals.'))),
    ('instructions','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The instruction fixes the elbow-to-front-hip phase, active same-side thoracic rotation, hamstring phase, and side repetition.'))),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/29063454/',
      'Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research',88,
      jsonb_build_array(jsonb_build_object(
        'claim','Controlled dynamic stretching is distinguished from higher-velocity ballistic stretching.','limits','The review does not establish medical clearance or symptom stop rules for an individual.'))),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/24149201/',
      'Effects of dynamic and static stretching within general and activity specific warm-up protocols','Journal of Sports Science and Medicine','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Activity-specific warm-up context influenced measured sprint performance while other outcomes were unchanged.','limits','This does not prove that World''s Greatest Stretch improves a later task.'))),
    ('athlete_support','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The instruction emphasizes active movement and individually available hamstring range.','limits','The athlete should not infer that deeper range is required.'))),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/29063454/',
      'Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research',88,
      jsonb_build_array(jsonb_build_object(
        'claim','Inconsistent protocol reporting limits consensus, supporting explicit range, duration, amplitude, and velocity records.'))),
    ('accessibility','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','Available range differs by person and the sequence can be performed without reaching a fixed universal depth.','limits','Elevated support and nonfloor options require their own review.'))),
    ('alternates','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The named flow includes rotation and hamstring phases, allowing rotation-free sweeps, plank returns, and inchworm entries to be distinguished.'))),
    ('media','https://library.theprehabguys.com/vimeo-video/worlds-greatest-stretch-2/',
      'World''s Greatest Stretch','[P]rehab','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','An exact demonstration must show entry, rear-knee support, lead-side elbow path, ipsilateral rotation, hand return, rockback, side order, ranges, and stop.','limits','A title, thumbnail, or oEmbed response cannot establish exact match.')))
  ) e(section_key,source_url,source_title,source_publisher,source_kind,quality,claims)
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
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT canonical_id,NULL,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','legacy_import',
    'legacy World''s Greatest Stretch references rechecked through YouTube oEmbed on 2026-08-02',
    NULL,NULL,'2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This proves metadata and embedding response only. Full playback, entry, rear-knee support, exact sequence, ranges, side mapping, tempo, breathing, dose, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unresolved.'
  FROM (VALUES
    ('-CiWQ2IvY34','The World''s Greatest Stretch (Mobility Exercise) by Squat University','Squat University'),
    ('FIZMUyAPPWY','Worlds greatest stretch','Mercy Sports Performance powered by EXOS'),
    ('CXnge363CH8','Worlds Greatest Stretch with Thoracic Rotation','Functional Bodybuilding'),
    ('VQqabRnOR1E','World''s Greatest Stretch','[P]rehab')
  ) media(video_id,title,channel)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method=EXCLUDED.discovery_method,source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,alternate.name,alternate.classification,
    alternate.rationale,alternate.dimensions,NULL,'candidate',NULL,NULL
  FROM (VALUES
    ('World''s Greatest Stretch','same_identity','Stable display name for the exact lunge, lead-side instep reach, ipsilateral rotation, hand return, and hamstring-rockback sequence.',jsonb_build_object('displayName','World''s Greatest Stretch')),
    ('Worlds Greatest Stretch','same_identity','Punctuation-free alias for the same exact sequence.',jsonb_build_object('alias','Worlds Greatest Stretch')),
    ('World''s Greatest Stretch with Rotation','same_identity','Rotation is already required by the base identity; this archived label is a duplicate.',jsonb_build_object('consolidatedDefinitionId',duplicate_id)),
    ('Rear-Knee-Down World''s Greatest Stretch','same_identity','Matches the exact rear-knee-down working specification.',jsonb_build_object('variantKey','rear-knee-down-floor-flow')),
    ('Rear-Knee-Up World''s Greatest Stretch','same_identity','Matches the exact rear-knee-up long-lunge working specification.',jsonb_build_object('variantKey','rear-knee-up-long-lunge-flow')),
    ('Starting Side','modifier_annotation','Starting side changes order but not required actions.',jsonb_build_object('modifier','starting_side')),
    ('Elbow Depth','modifier_annotation','Owned elbow depth scales range only when the sequence and all other mechanics remain fixed.',jsonb_build_object('modifier','elbow_depth')),
    ('Rotation Range','modifier_annotation','Owned thoracic rotation range is recorded within an unchanged variant.',jsonb_build_object('modifier','rotation_range')),
    ('Hamstring Rockback Range','modifier_annotation','Front-knee extension and hip-rockback range scale exposure without changing identity.',jsonb_build_object('modifier','rockback_range')),
    ('Step-Through Exit','modifier_annotation','A declared direct step-through exit is delivery metadata when no plank, crawl, or extra action is inserted.',jsonb_build_object('modifier','exit')),
    ('Stationary Reset','modifier_annotation','Returning to the declared lunge or standing reset changes logistics but not the five required phases.',jsonb_build_object('modifier','reset')),
    ('Tempo Breathing Sets Repetitions and Rest','modifier_annotation','Cadence, breathing emphasis, and dose scale delivery only after exact identity is fixed.',jsonb_build_object('modifiers',jsonb_build_array('tempo','breathing','sets','repetitions_each_side','rest_seconds'))),
    ('Hands on Yoga Blocks','new_variant','Elevated bilateral hand support changes wrist demand, trunk angle, reachable elbow depth, rotation setup, logistics, and equipment.',jsonb_build_object('equipment','yoga_block')),
    ('Bench-Elevated World''s Greatest Stretch','new_variant','A bench changes support height, lunge angle, load distribution, clearance, and usable ranges.',jsonb_build_object('supportHeight','bench')),
    ('Walking World''s Greatest Stretch','new_variant','Continuous forward travel changes entry, exit, space, balance, alternation, and duration.',jsonb_build_object('locomotion','continuous_walking')),
    ('World''s Greatest Stretch with Rotation Hold','new_variant','A prescribed end-range isometric rotation hold changes time under tension and dose.',jsonb_build_object('hold','rotation_end_range')),
    ('World''s Greatest Stretch with Hamstring Hold','new_variant','A prescribed hamstring-phase hold changes dynamic intent and exposure.',jsonb_build_object('hold','hamstring_phase')),
    ('Spiderman Lunge Hamstring Sweep','new_definition','The existing neighbor omits required thoracic rotation and centers the lunge-to-hamstring sweep.',jsonb_build_object('targetDefinitionId',spiderman_definition)),
    ('Inchworm to World''s Greatest Stretch','new_definition','The existing neighbor adds a standing hinge, hand walk, plank exposure, and return.',jsonb_build_object('targetDefinitionId',inchworm_definition)),
    ('World''s Greatest Stretch to Plank','new_definition','The existing neighbor requires a braced plank return between lunge repetitions.',jsonb_build_object('targetDefinitionId',plank_definition)),
    ('Runner''s Lunge with Rotation Only','new_definition','Omitting the required hamstring rockback changes the sequence contract.',jsonb_build_object('missingAction','hamstring_rockback')),
    ('Lunge Hamstring Sweep without Rotation','new_definition','Omitting the required rotation changes the sequence and maps toward the existing Spiderman sweep neighbor.',jsonb_build_object('missingAction','thoracic_rotation')),
    ('Loaded World''s Greatest Stretch','new_variant','Added load changes force, grip, balance, failure consequence, dose, and recovery.',jsonb_build_object('externalLoad',TRUE)),
    ('World''s Greatest Stretch Assessment','new_definition','A scored maximal range or time assessment changes purpose, attempts, validity, termination, and persistence.',jsonb_build_object('purpose','assessment')),
    ('Undefined World''s Greatest Stretch','reject','A generic label without rear-knee support, entry, exit, exact phases, ranges, tempo, side order, dose, and stop rule is not selectable.',jsonb_build_object('identityQuarantine',TRUE)),
    ('Forced Elbow-to-Floor Repetition','reject','Forcing a fixed depth violates the owned-range and symptom contract.',jsonb_build_object('quality','invalid_repetition')),
    ('Lumbar-Twist Rotation','reject','Replacing thoracic rotation with uncontrolled lumbar or pelvic rotation fails the repetition.',jsonb_build_object('quality','invalid_repetition')),
    ('Pain-Through Mobility Flow','reject','Continuing through pain, pinching, neurologic symptoms, dizziness, or instability violates stop rules.',jsonb_build_object('symptomPolicy','prohibited'))
  ) alternate(name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (knee_down_variant,knee_up_variant,'progression',94,
      ARRAY['stability','load','complexity'],
      'Lifting the rear knee preserves the exact sequence while reducing support and increasing lunge, balance, stabilization, and observation demands.',
      '{"requires":["knee_down_sequence_control","pain_free_hand_support","stable_lead_foot_and_knee"],"revalidate":["rear_knee_support","ranges","dose","fatigue","duration","rendering"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (knee_up_variant,knee_down_variant,'regression',94,
      ARRAY['stability','load','complexity'],
      'Placing the rear knee on the floor increases support while retaining the same lunge, lead-side instep reach, rotation, return, and rockback sequence.',
      '{"revalidate":["rear_knee_contact","mat","ranges","dose","fatigue","duration","rendering"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (knee_down_variant,spiderman_variant,'lateral_substitution',78,
      ARRAY['complexity','range','stability'],
      'The rotation-free Spiderman hamstring sweep can preserve a lunge-to-rockback mobility purpose when rotation is not required, but identity, objective, scoring, dose, and rendering change.',
      '{"onlyWhen":"thoracic_rotation_goal_can_change","coachConfirmationRequired":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (knee_up_variant,plank_variant,'lateral_substitution',72,
      ARRAY['load','stability','complexity','fatigue'],
      'The plank-return neighbor can preserve an integrated mobility purpose but adds shoulder and wrist loading, braced plank exposure, transition actions, fatigue, and time.',
      '{"onlyWhen":"plank_entry_and_return_are_acceptable","coachConfirmationRequired":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
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
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN variant.complexity ELSE variant.physical END,
    variant.anchor_tier,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN 'Review-only exercise-complexity anchor based on phase count, rear-knee support, side recognition, lead-foot and knee control, elbow and arm mapping, thoracic rotation, hand return, rockback sequencing, balance, breathing, and quality termination.'
      ELSE 'Review-only physical-difficulty anchor based on bodyweight lunge depth, rear-knee support, hand support, range, time under tension, repetitions each side, prior lunge-hamstring-rotation work, symptoms, and recovery.' END
      ||' No athlete proficiency classification is represented. Variant: '
      ||variant.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (knee_down_variant,'rear-knee-down-floor-flow',42,26,40),
    (knee_up_variant,'rear-knee-up-long-lunge-flow',50,34,40)
  ) variant(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand'))
    dimension(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=42,absolute_load_demand=26,
    coordination_demand=48,impact=1,supervision_demand=18,
    base_overall_difficulty=greatest(42,26),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'sourceIdentity','lunge_instep_reach_ipsilateral_rotation_hamstring_rockback',
      'exactVariantRequired',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=66,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only; exact variant assignment and independent human calibration remain required.',
    updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise SET skill_level=NULL,
    name=CASE id WHEN 10 THEN 'World''s Greatest Stretch' ELSE name END,
    description=CASE id WHEN 10 THEN
      'From a long lunge with both hands inside the lead foot, lower the lead-side elbow through owned range, rotate the same arm and thorax up, return the hand, then rock back and extend the lead knee before resetting or switching.'
      ELSE description END,
    instructions=CASE id WHEN 10 THEN
      'Declare rear knee down or up, entry, exit, starting side, ranges, tempo, repetitions each side, rest, and stop signal. Lead elbow in, same arm up, hand down, hips back, then reset or switch.'
      ELSE instructions END,
    default_sets=CASE id WHEN 10 THEN 1 ELSE default_sets END,
    default_reps=CASE id WHEN 10 THEN 3 ELSE default_reps END,
    default_work_seconds=CASE id WHEN 10 THEN NULL ELSE default_work_seconds END,
    default_rest_seconds=CASE id WHEN 10 THEN 20 ELSE default_rest_seconds END,
    est_seconds_per_set=CASE id WHEN 10 THEN 95 ELSE est_seconds_per_set END,
    card_summary=CASE id WHEN 10 THEN
      'Integrated dynamic lunge, lead-side thoracic rotation, and front-leg hamstring-rockback sequence.'
      ELSE card_summary END,
    coach_language=CASE id WHEN 10 THEN
      'Verify exact rear-knee variant, phase order, lead-side arm, lead foot and knee, pelvis, thoracic rotation, hand return, rockback, breathing, and reset. Stop for symptoms, forced range, support failure, or balance loss.'
      ELSE coach_language END,
    athlete_language=CASE id WHEN 10 THEN
      'Long lunge; lead elbow in, same arm up, hand down, hips back, then reset. Smooth range only.'
      ELSE athlete_language END,
    programming_logic=CASE id WHEN 10 THEN jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','lunge_instep_reach_ipsilateral_rotation_hand_return_and_hamstring_rockback_exact_variant_required',
      'fatigueRule','count_valid_and_failed_repetitions_with_all_lunge_hamstring_rotation_and_hand_support_work',
      'substitutionRule','never_silently_add_or_remove_rotation_plank_inchworm_load_or_support_height',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
      ELSE programming_logic END,
    scalable_variables=CASE id WHEN 10 THEN ARRAY[
      'lunge_range','elbow_depth','rotation_range','rockback_range','tempo',
      'starting_side','repetitions_each_side','sets','rest_seconds']::TEXT[]
      ELSE scalable_variables END,
    movement_family=CASE id WHEN 10 THEN
      'Integrated lunge rotation and hamstring rockback mobility' ELSE movement_family END,
    primary_phase_key=CASE id WHEN 10 THEN 'prepare_and_access'
      ELSE primary_phase_key END,
    phase_subrole=CASE id WHEN 10 THEN 'integrated_mobility'
      ELSE phase_subrole END,
    primary_order_slot=CASE id WHEN 10 THEN 'integrated_mobility'
      ELSE primary_order_slot END,
    movement_requirements=CASE id WHEN 10 THEN jsonb_build_object(
      'start','long_lunge_both_hands_inside_lead_foot',
      'requiredSequence',jsonb_build_array(
        'lead_side_instep_reach','ipsilateral_thoracic_rotation',
        'hand_return','hamstring_rockback','reset_or_switch'),
      'variantRequired',TRUE,'impactLevel',0) ELSE movement_requirements END,
    coaching_execution=CASE id WHEN 10 THEN jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare rear-knee support, entry, exit, starting side, ranges, tempo, dose, rest, and stop signal.',
        'Inspect floor, optional mat, hand support, overhead clearance, lane, and safe exit.'),
      'executionSteps',jsonb_build_array(
        'Establish the assigned long lunge with both hands inside the lead foot.',
        'Lower the lead-side elbow toward the instep through owned range.',
        'Rotate the same arm and upper trunk upward while controlling foot, knee, pelvis, and support arm.',
        'Return the hand, shift hips back, extend the lead knee through owned range, then reset or switch.'),
      'qualityGate',jsonb_build_array(
        'Exact variant and phase order with the lead-side arm.',
        'Stable lead foot, knee, pelvis, spine, support arm, breathing, and balance.',
        'Owned rotation and rockback without force, symptoms, or rushed transitions.'),
      'stopSigns',jsonb_build_array(
        'Pain, pinch, numbness, tingling, radiation, dizziness, nausea, instability, or apprehension.',
        'Wrong phase or arm, lead-knee loss, pelvic spin, lumbar substitution, support collapse, forced range, or balance loss.',
        'Unsafe floor, mat, support, lane, overhead clearance, entry, or exit.'))
      ELSE coaching_execution END,
    pairing_logic=CASE id WHEN 10 THEN jsonb_build_object(
      'goodForSessions',jsonb_build_array(
        'general_warmup','sprint_prep','squat_prep','lunge_prep','field_or_court_prep'),
      'pairsWellAfter',jsonb_build_array(
        'general_temperature_raise','ankle_or_hip_specific_access'),
      'pairsWellBefore',jsonb_build_array(
        'task_specific_activation','low_volume_movement_rehearsal'),
      'avoidBefore',jsonb_build_array(
        'priority_power_or_strength_if_volume_range_or_holds_would_create_fatigue'),
      'doNotUseWhen',jsonb_build_array(
        'floor_lunge_or_hand_support_not_tolerated','symptoms_present',
        'exact_sequence_unavailable','safe_space_entry_or_exit_unavailable'))
      ELSE pairing_logic END,
    media_library=CASE id WHEN 10 THEN jsonb_build_object(
      'demoVideoSources',jsonb_build_array(
        'https://www.youtube.com/watch?v=-CiWQ2IvY34',
        'https://www.youtube.com/watch?v=FIZMUyAPPWY',
        'https://www.youtube.com/watch?v=CXnge363CH8',
        'https://www.youtube.com/watch?v=VQqabRnOR1E'),
      'mediaState','oembed_metadata_healthy_exact_match_and_approval_unresolved',
      'internalNotes',jsonb_build_array(
        'Do not treat titles, thumbnails, or oEmbed as movement review.',
        'Film entry, rear-knee support, lead-side elbow path, rotation, hand return, rockback, side order, ranges, breathing, reset, and stop.'))
      ELSE media_library END,
    archived=CASE id WHEN 883 THEN TRUE ELSE archived END,
    is_published=CASE id WHEN 883 THEN FALSE ELSE is_published END,
    why_publish_ready=CASE id WHEN 883 THEN FALSE ELSE why_publish_ready END,
    updated_at=now()
  WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'legacySources',2,'duplicateDefinitionsConsolidated',1,
        'activeWorkingSpecifications',2,'sourceDerivedSelectableVariants',0,
        'neighborBoundariesRecorded',3),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('squat','hinge','rotate','reach')),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesJointsActionsSagittalTransverseMultiplanarAndAlternatingLaterality',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,
        'validFailedAndEachSideExposure',TRUE,
        'sameSessionLungeHamstringRotationAndHandSupportWorkRequired',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'floorSpacePopulationSymptomsSupportEntryAndExit',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',6,
        'doseDurationScalingLogisticsSubstitutionAndPersistence',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachAndSupportOperations',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'noExactSequenceTrialClaimed',TRUE,
        'generalDynamicStretchingLimitsExplicit',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',4,'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object(
        'passed',TRUE,'assessments',28),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object(
        'passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01','category','media',
        'message','A qualified human must watch each candidate in full and verify exact entry, rear-knee support, lead-side instep reach, ipsilateral rotation, hand return, rockback, side order, ranges, tempo, breathing, dose, captions, accessibility, safety, cue quality, conflicts, playback, reviewer identity, and card-version match.'),
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

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids))<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_id AND status='archived')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(source_variant_ids) AND definition_id=canonical_id
        AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
        AND status='review' AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0)<>2 THEN
    RAISE EXCEPTION '% left invalid identity consolidation or working variants',
      migration_key;
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
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>28 THEN
    RAISE EXCEPTION '% left incomplete profiles, evidence, media, or alternates',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND reviewed_by IS NULL)<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND relationship IN('progression','regression')
        AND dimensions && ARRAY[
          'whole_body_rotation','landing_heading','spatial_orientation']::TEXT[])
    OR EXISTS(SELECT 1 FROM coaching.exercise WHERE id=ANY(source_ids)
      AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (review_status IN('approved') OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND (status<>'review' OR approved_video_url IS NOT NULL
          OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% inferred approval, invalid graph, or athlete skill metadata',
      migration_key;
  END IF;

  IF (SELECT array_agg(item->>'code' ORDER BY item->>'code')
      FROM coaching.exercise_card_test_packet_v1 packet
      CROSS JOIN LATERAL jsonb_array_elements(packet.blocking_issues_json) item
      WHERE packet.definition_id=canonical_id)
      IS DISTINCT FROM ARRAY[
        'CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[] THEN
    RAISE EXCEPTION '% did not retain the exact human-review blockers',
      migration_key;
  END IF;
END $$;
