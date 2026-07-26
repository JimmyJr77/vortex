-- Complete the exact canonical authoring contract for the candidate-only
-- Dead Hang, Active Hang, and Scapular Pull-Up cards created by migrations
-- 309 and 313.
--
-- Migration 313 populated every broad support/programming section. The
-- publication-readiness contract also requires named member, coach,
-- operations, and generation fields. Populate those fields explicitly and
-- normalize anatomy planes to the controlled authoring enum.
--
-- No human review, media approval, graph approval, calibration approval, or
-- publication state is created. coaching.skill is untouched. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key TEXT := '314_coaching_hang_family_contract_completion';
  facility BIGINT;
  active_id UUID;
  dead_id UUID;
  scapular_id UUID;
  target_ids UUID[];
  protected_records INTEGER;
BEGIN
  SELECT id, facility_id
  INTO active_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'active-hang'
    AND status <> 'archived';

  SELECT id
  INTO dead_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'dead-hang'
    AND status <> 'archived';

  SELECT id
  INTO scapular_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'scapular-pull-up'
    AND status <> 'archived';

  IF active_id IS NULL OR dead_id IS NULL OR scapular_id IS NULL THEN
    RAISE EXCEPTION
      'Hang-family contract completion requires all three active canonical definitions';
  END IF;

  target_ids := ARRAY[dead_id, active_id, scapular_id];

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = ANY(target_ids)
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = ANY(target_ids)
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = relationship.from_variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND relationship.review_status = 'approved'
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Hang-family contract completion refused to override % protected records',
      protected_records;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'contractCompletionMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      anatomy_json = anatomy_json || jsonb_build_object(
        'planes', jsonb_build_array('frontal', 'sagittal', 'multiplanar'),
        'laterality', 'bilateral'
      ),
      athlete_support_json = athlete_support_json || jsonb_build_object(
        'whyItMatters', CASE slug
          WHEN 'dead-hang'
            THEN 'Dead Hang provides a measurable passive overhead-position and grip exposure when that exact context fits the session.'
          WHEN 'active-hang'
            THEN 'Active Hang develops repeatable straight-arm scapular engagement and grip control without turning the task into a pull-up.'
          ELSE
            'Scapular Pull-Up develops controlled straight-arm scapular motion while grip, elbows, trunk, and dismount stay organized.'
        END,
        'primaryCue', CASE slug
          WHEN 'dead-hang'
            THEN 'Secure grip, straight arms, assigned passive shoulders, quiet body, early step-down.'
          WHEN 'active-hang'
            THEN 'Secure grip, straight arms, shoulders slightly from the ears, quiet body, early step-down.'
          ELSE
            'Keep straight arms; move only through the shoulder blades and return slowly.'
        END,
        'expectedSensations', CASE slug
          WHEN 'dead-hang' THEN jsonb_build_array(
            'working_grip_and_forearms',
            'comfortable_passive_overhead_tension',
            'light_trunk_effort_to_limit_swing'
          )
          WHEN 'active-hang' THEN jsonb_build_array(
            'working_grip_and_forearms',
            'active_effort_below_and_around_the_shoulder_blades',
            'light_trunk_effort_to_hold_position'
          )
          ELSE jsonb_build_array(
            'working_grip_and_forearms',
            'small_controlled_motion_below_and_around_the_shoulder_blades',
            'trunk_effort_to_limit_swing'
          )
        END,
        'unexpectedSensations', jsonb_build_array(
          'sharp_or_increasing_pain',
          'pinching_or_instability',
          'numbness_or_tingling',
          'dizziness_or_breath_distress',
          'grip_slip_or_uncontrolled_drop',
          'neck_or_back_symptoms'
        ),
        'painGuidance',
          'Stop immediately for pain, pinching, instability, numbness, tingling, dizziness, or worsening symptoms; restore support and tell the coach. This card is not rehabilitation guidance.',
        'accessibility', jsonb_build_object(
          'physical', jsonb_build_array(
            'lower_bar_or_stable_foot_contact',
            'managed_band_assistance',
            'shorter_effort_or_fewer_repetitions',
            'longer_rest',
            'alternate_grip_or_supported_non_hanging_task'
          ),
          'communication', jsonb_build_array(
            'plain_language_cues',
            'front_and_side_demonstration',
            'still_frame_start_and_finish',
            'visible_stop_signal',
            'teach_back_before_loading'
          ),
          'individualization',
            'Choose assistance, exact variant, dose, and supervision from current readiness and symptoms, never an exercise-card skill level.'
        ),
        'mediaAlternatives', jsonb_build_array(
          'text_instructions',
          'start_and_finish_still_images',
          'slow_live_demonstration',
          'tactile_or_environmental_setup_cues_with_consent',
          'captions_or_transcript_when_available'
        )
      ),
      coach_support_json = coach_support_json || jsonb_build_object(
        'observationChecklist', CASE slug
          WHEN 'dead-hang' THEN jsonb_build_array(
            'anchor_clearance_and_step_down',
            'secure_grip',
            'straight_elbows',
            'declared_passive_shoulder_mode',
            'minimal_swing',
            'breathing_and_symptom_response',
            'reserve_and_exit_quality'
          )
          WHEN 'active-hang' THEN jsonb_build_array(
            'anchor_clearance_and_step_down',
            'secure_grip',
            'straight_elbows',
            'small_active_scapular_position_without_forced_retraction',
            'minimal_swing',
            'first_to_last_position',
            'reserve_and_exit_quality'
          )
          ELSE jsonb_build_array(
            'anchor_clearance_and_step_down',
            'secure_grip',
            'straight_elbows',
            'scapular_only_motion',
            'controlled_return_without_drop',
            'first_to_last_range',
            'minimal_swing',
            'reserve_and_exit_quality'
          )
        END,
        'demonstrationPlan', CASE slug
          WHEN 'dead-hang'
            THEN 'From front and side, show secure grip, supported mount, passive shoulder mode, still hold, endpoint, and step-down; contrast briefly with Active Hang.'
          WHEN 'active-hang'
            THEN 'From front and side, show secure grip, straight elbows, small active shoulder motion, held position, endpoint, and step-down; contrast with Dead Hang and Scapular Pull-Up.'
          ELSE
            'From front and side, show the passive or assigned start, small scapular pull, brief top, controlled return, straight elbows, no swing, and step-down.'
        END,
        'modificationDecisionTree', jsonb_build_object(
          'grip_or_overhead_access_limited', 'Use stable foot support, another appropriate grip, or a supported non-hanging task.',
          'position_or_range_not_repeatable', 'Reduce duration or repetitions, add assistance, and lengthen rest.',
          'band_entry_or_recoil_not_safe', 'Use stable foot assistance instead of a band.',
          'quality_stable_with_clear_reserve', 'Progress one dimension only: assistance, time, repetitions, implement, load, or laterality.',
          'symptoms_or_instability', 'Stop and follow the facility escalation pathway; do not solve symptoms by adding load.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'anchor_clearance_mount_or_exit_is_unsafe',
          'secure_grip_or_appropriate_substitute_is_unavailable',
          'current_pain_pinching_instability_numbness_or_tingling',
          'athlete_cannot_follow_the_declared_scapular_mode',
          'fatigue_from_prior_grip_or_pulling_work_prevents_quality',
          'qualified_supervision_required_but_unavailable'
        )
      ),
      support_operations_json = support_operations_json || jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_mismatch',
          'taxonomy_or_variant_mismatch',
          'difficulty_or_dose_mismatch',
          'equipment_anchor_or_clearance',
          'grip_or_overhead_accessibility',
          'pain_or_neurologic_symptom',
          'media_accuracy_or_accessibility',
          'relationship_or_substitution',
          'coach_or_athlete_comprehension'
        ),
        'supportEscalation', jsonb_build_object(
          'immediate',
            'Stop and secure the athlete for pain, neurologic symptoms, dizziness, instability, grip failure, equipment movement, or unsafe exit.',
          'clinical',
            'Refer individual symptoms, recent surgery, instability, or rehabilitation restrictions to an appropriate qualified clinician.',
          'equipment',
            'Quarantine the station and notify the equipment owner after anchor, bar, ring, band, rack, or clearance concerns.',
          'content',
            'Quarantine the card version and notify the canonical-library owner for identity, dose, media, or relationship defects.'
        ),
        'retentionPolicy',
          'Retain card and research versions, candidate media, alternate decisions, coach edits, symptoms, incidents, substitutions, and review history under facility privacy and retention policy.',
        'changeImpactPolicy',
          'A material identity, taxonomy, anatomy, score, variant, dose, stop-rule, media, or relationship change requires a new card version, stale-review invalidation, audit rerun, fatigue/duration revalidation, and release-owner notification.'
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'contractCompletionMigration', migration_key,
        'exactSupportContractComplete', TRUE,
        'exactProgrammingContractComplete', TRUE,
        'controlledAnatomyPlanes', TRUE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = ANY(target_ids);

  UPDATE coaching.exercise_variant_v1 variant
  SET programming_profile_json = programming_profile_json || jsonb_build_object(
        'trainingStimuli', CASE definition.slug
          WHEN 'dead-hang' THEN jsonb_build_array(
            'grip_isometric_capacity',
            'passive_overhead_position_exposure',
            'straight_arm_hang_tolerance'
          )
          WHEN 'active-hang' THEN jsonb_build_array(
            'grip_isometric_capacity',
            'active_scapular_isometric_control',
            'straight_arm_hang_position_ownership'
          )
          ELSE jsonb_build_array(
            'grip_isometric_capacity',
            'dynamic_scapular_depression_strength',
            'controlled_scapular_return',
            'straight_arm_hang_coordination'
          )
        END,
        'stimulusDose', jsonb_build_object(
          'primaryMetric', CASE
            WHEN definition.slug = 'scapular-pull-up' THEN 'quality_repetitions'
            ELSE 'quality_hold_seconds'
          END,
          'intensityRule',
            'Use the exact variant and assistance that preserve symptoms, grip, elbow position, scapular mode, body control, breathing, and safe exit.',
          'failurePolicy', 'Routine training does not use grip, position, or dismount failure.',
          'progressionRule', 'Change one dose or difficulty dimension only after repeatable work with clear reserve.'
        ),
        'weeklyExposure', jsonb_build_object(
          'countWith', jsonb_build_array(
            'pull_ups',
            'climbing',
            'rope_work',
            'rings',
            'loaded_carries',
            'deadlifts_and_other_high_grip_work',
            'other_overhead_hanging'
          ),
          'adjustFor',
            'Total grip time, scapular demand, symptoms, assistance, added load, unilateral work, and next-session pulling requirements.',
          'maximumPolicy',
            'No universal weekly maximum is asserted; use response, recovery, and independently calibrated programming policy.'
        ),
        'completionCriteria', jsonb_build_array(
          'all_assigned_work_completed_without_stop_rule',
          'grip_remained_secure',
          'elbows_remained_straight',
          'declared_scapular_mode_remained_correct',
          'body_swing_remained_within_the_declared_standard',
          'breathing_and_symptoms_remained_acceptable',
          'controlled_exit_remained_available'
        ),
        'sequenceRules', jsonb_build_array(
          'place_quality_or_position_practice_before_high_fatigue_pulling',
          'do_not_pre_fatigue_grip_before_high_consequence_bar_ring_or_climbing_work',
          'separate_maximum_testing_from_ordinary_training_profiles',
          'use_restore_breathing_only_as_a_declared_dead_hang_context',
          'revalidate_later_session_dose_after_weighted_or_unilateral_variants'
        ),
        'pairingCompatibility', jsonb_build_object(
          'compatible', jsonb_build_array(
            'lower_body_training',
            'low_grip_mobility',
            'controlled_trunk_work',
            'technical_pulling_preparation_when_total_volume_is_bounded'
          ),
          'conditional', jsonb_build_array(
            'pull_ups',
            'climbing',
            'rope_work',
            'rings',
            'loaded_carries',
            'heavy_hinges'
          ),
          'avoid', jsonb_build_array(
            'pairings_that_remove_secure_grip_or_safe_exit',
            'additional_overhead_or_grip_loading_after_stop_rules',
            'fatigue_circuits_that_turn_position_practice_into_failure_work'
          )
        ),
        'interferenceRules', jsonb_build_array(
          'reduce_dose_after_prior_grip_or_forearm_fatigue',
          'reduce_dose_after_prior_scapular_depression_or_pulling_volume',
          'omit_for_current_overhead_or_upper_extremity_symptoms',
          'protect_later_high_consequence_bar_ring_rope_or_climbing_tasks',
          'extend_recovery_after_weighted_or_single_arm_variants'
        ),
        'uncertaintyPolicy', jsonb_build_object(
          'scoreStatus', 'candidate_unanchored',
          'doseStatus', 'candidate_contextual',
          'mediaStatus', 'candidate_embed_healthy_exact_match_unreviewed',
          'relationshipStatus', 'candidate_unapproved',
          'action',
            'Use conservative assistance and dose, retain reserve, document response, and require independent human review before publication.'
        ),
        'skillLevelApplicability', 'skill_library_cards_only'
      ),
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND variant.definition_id = definition.id
    AND variant.status <> 'archived';

  UPDATE coaching.exercise_section_evidence_v1 evidence
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND evidence.definition_id = definition.id
    AND evidence.review_status = 'candidate'
    AND evidence.reviewed_card_version <> definition.card_version;

  UPDATE coaching.exercise_media_candidate_v1 media
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND media.definition_id = definition.id
    AND media.review_status = 'candidate'
    AND media.reviewed_card_version <> definition.card_version;

  UPDATE coaching.exercise_alternate_assessment_v1 alternate
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND alternate.definition_id = definition.id
    AND alternate.review_status = 'candidate'
    AND alternate.reviewed_card_version <> definition.card_version;

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET card_version = definition.card_version,
      status = 'quarantined',
      audit_version = 'canonical-card-audit-v1',
      checks_json = jsonb_build_object(
        'contractCompletionMigration', migration_key,
        'auditRerunRequired', TRUE,
        'humanReviewRequired', TRUE
      ),
      blocking_issues_json = jsonb_build_array(
        jsonb_build_object(
          'code', 'CARD-MEDIA-01',
          'category', 'media',
          'message', 'Exact-match media review and approval remain required.'
        ),
        jsonb_build_object(
          'code', 'CARD-PUBLISH-01',
          'category', 'publication',
          'message', 'Publication review remains required.'
        ),
        jsonb_build_object(
          'code', 'CARD-GRAPH-03',
          'category', 'relationship_graph',
          'message', 'Candidate relationship edges require coach review.'
        ),
        jsonb_build_object(
          'code', 'CARD-CALIBRATION-01',
          'category', 'calibration',
          'message', 'Difficulty scores require independent calibration.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND packet.definition_id = definition.id;
END
$$;
