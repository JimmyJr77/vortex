-- Complete the consolidated Adductor Rockback candidate card.
--
-- Migration 308 is the identity authority: it consolidated generic reach,
-- explicit thoracic-rotation reach, and historical half-kneeling sources into
-- one definition. Generic reach direction and the historical half-kneeling
-- support, leg path, load, and rock direction remain identity-quarantined.
--
-- Public YouTube URLs are unverified, non-embeddable candidates. No playback,
-- oEmbed, exact-match, caption, accessibility, quality, reviewer, media,
-- graph, calibration, card, or publication approval is claimed. Exercise
-- difficulty is exercise complexity plus physical difficulty, with overall
-- derived as their maximum. Athlete proficiency levels remain exclusive to
-- coaching.skill and are intentionally absent.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '404_coaching_adductor_rockback_family_completion';
  research_batch CONSTANT TEXT := 'adductor-rockback-family-v1';
  research_version CONSTANT TEXT := '2026-07-26.25';
  active_count INTEGER;
  already_applied_count INTEGER;
  protected_count INTEGER;
  source_count INTEGER;
  consolidated_count INTEGER;
BEGIN
  SELECT count(*)
  INTO active_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'adductor-rockback'
    AND status <> 'archived';

  IF active_count <> 1 THEN
    RAISE EXCEPTION
      '% expected exactly 1 active Adductor Rockback definition; found %',
      migration_key,
      active_count;
  END IF;

  SELECT count(*)
  INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'adductor-rockback'
    AND status <> 'archived'
    AND provenance_json->>'structuralCompletionMigration' = migration_key;

  IF already_applied_count NOT IN (0, 1) THEN
    RAISE EXCEPTION
      '% found an invalid prior-application count %',
      migration_key,
      already_applied_count;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id)
  INTO source_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived';

  IF source_count <> 4 THEN
    RAISE EXCEPTION
      '% expected all 4 legacy mappings on the active survivor; found %',
      migration_key,
      source_count;
  END IF;

  SELECT count(*)
  INTO consolidated_count
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_identity_resolution_v1 resolution
    ON resolution.survivor_definition_id = survivor.id
   AND resolution.decision = 'duplicate_consolidated'
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = resolution.resolved_definition_id
   AND duplicate.status = 'archived'
  WHERE survivor.facility_id = 1
    AND survivor.slug = 'adductor-rockback'
    AND survivor.status <> 'archived'
    AND duplicate.slug = ANY(ARRAY[
      'adductor-rockback-with-reach',
      'adductor-rock-back-with-t-spine-reach',
      'half-kneeling-adductor-rockback'
    ]::TEXT[]);

  IF consolidated_count <> 3 THEN
    RAISE EXCEPTION
      '% requires all 3 migration-308 Adductor Rockback consolidations; found %',
      migration_key,
      consolidated_count;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND (
      (already_applied_count = 0 AND definition.card_version <> 1)
      OR (already_applied_count = 1 AND definition.card_version <> 2)
      OR definition.status IN ('published','deprecated')
      OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % protected canonical definition(s)',
      migration_key,
      protected_count;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  JOIN coaching.exercise_score_v1 score
    ON score.exercise_id = source.legacy_exercise_id
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND (
      score.human_review_status <> 'queued'
      OR score.reviewed_by IS NOT NULL
      OR score.reviewed_at IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % human-reviewed legacy score record(s)',
      migration_key,
      protected_count;
  END IF;

  SELECT
    (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      LEFT JOIN coaching.exercise_delivery_profile_v1 profile
        ON profile.variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND (variant.status = 'published' OR profile.status = 'published')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_section_evidence_v1 evidence
        ON evidence.definition_id = definition.id
       AND evidence.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND evidence.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id = definition.id
       AND media.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND media.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_alternate_assessment_v1 alternate
        ON alternate.definition_id = definition.id
       AND alternate.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND alternate.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_review_v1 review
        ON review.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_revision_v1 revision
        ON revision.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_review_v1 review
        ON review.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      JOIN coaching.exercise_relationship_v1 relationship
        ON relationship.from_variant_id = variant.id
        OR relationship.to_variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND (
          relationship.review_status <> 'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      JOIN coaching.exercise_score_calibration_v1 calibration
        ON calibration.variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug = 'adductor-rockback'
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_count;

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % reviewed or published dependent record(s)',
      migration_key,
      protected_count;
  END IF;

  IF already_applied_count = 0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id = variant.definition_id
    WHERE profile.variant_id = variant.id
      AND definition.facility_id = 1
      AND definition.slug = 'adductor-rockback';

    UPDATE coaching.exercise_variant_v1 variant
    SET variant_key = left(
          'legacy-source-'
          || coalesce(definition.legacy_exercise_id::TEXT, 'unknown')
          || '-'
          || variant.variant_key,
          120
        ),
        status = 'archived',
        requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable',FALSE,
            'completionQuarantine',TRUE,
            'quarantineReason',
              'Superseded source variant lacks the complete exact start, support, leg path, foot orientation, reach, range, dose, fatigue, and stop-rule contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug = 'adductor-rockback';
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name = 'Adductor Rockback',
      display_name = 'Adductor Rockback',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(definition.aliases, '{}')
          || ARRAY['Adductor Rock Back','Quadruped Adductor Rockback']::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> 'adductor rockback'
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      description = 'From quadruped, keep one knee supported and extend the opposite leg laterally. Maintain declared hand support, foot orientation, pelvis and lumbar position while moving the hips backward and forward through a comfortable range. Support height and a fully specified reach or start-position overlay are variant dimensions.',
      family_key = 'adductor_rockback_family',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      status = 'review',
      content_confidence = 76,
      scoring_confidence = 66,
      media_confidence = 20,
      movement_patterns = ARRAY['hinge','brace','reach']::TEXT[],
      body_regions = ARRAY['hip','groin','pelvis','spine','core','shoulder','elbow','wrist']::TEXT[],
      required_equipment = ARRAY['none']::TEXT[],
      optional_equipment = ARRAY['exercise_mat','knee_pad','stable_support','floor_markers','video_capture']::TEXT[],
      anatomy_json = jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array('adductor_magnus','adductor_longus','adductor_brevis','gracilis','pectineus','medial_thigh_and_groin_tissues'),
        'secondaryMusclesAndTissues',jsonb_build_array('hamstrings','gluteus_maximus','gluteus_medius_and_minimus','deep_hip_rotators','abdominal_wall','spinal_stabilizers','serratus_anterior_and_shoulder_girdle_for_floor_support'),
        'joints',jsonb_build_array('hip','pelvis','lumbar_spine','thoracic_spine','knee','shoulder','elbow','wrist'),
        'actions',jsonb_build_array('extended_side_hip_abduction_held','bilateral_hip_flexion_and_extension_during_rock','pelvic_position_control','lumbar_spine_stabilization','controlled_return'),
        'planes',jsonb_build_array('frontal_setup','sagittal_rocking','transverse_stabilization','transverse_motion_only_for_declared_thoracic_rotation'),
        'laterality','unilateral_with_both_sides_programmed'
      ),
      environment_json = jsonb_build_object(
        'surface','level_clean_non_slip',
        'clearance',jsonb_build_array('one_leg_extended_laterally','forward_hand_support','no_cross_traffic'),
        'supportPolicy','hands_and_support_knee_stable_or_exact_elevated_support_declared',
        'paddingPolicy','offer_clean_knee_padding_before_setup_becomes_a_barrier'
      ),
      population_json = jsonb_build_object(
        'selectionStatus','candidate_requires_human_review',
        'readinessChecks',jsonb_build_array('floor_transfer_or_approved_supported_alternative','tolerable_kneeling_and_upper_body_support','pain_free_self_selected_adductor_range','controlled_pelvis_and_lumbar_position','both_sides_can_be_programmed_and_recorded'),
        'constraints',jsonb_build_array('range_is_not_forced','support_contacts_remain_stable','generic_reach_and_half_kneeling_sources_are_not_selectable','current_adductor_injury_or_persistent_groin_pain_requires_individual_clinical_guidance'),
        'contraindications',jsonb_build_array('sharp_or_increasing_pain','hip_pinching_guarding_numbness_or_tingling','unsafe_or_slipping_support','persistent_pelvis_or_spine_compensation','floor_transfer_or_kneeling_not_tolerated_without_an_approved_alternative')
      ),
      athlete_support_json = jsonb_build_object(
        'plainLanguageSummary','One leg out, keep your back long, move your hips back to comfortable inner-thigh tension, then return smoothly.',
        'setupChecklist',jsonb_build_array('declare_side_and_order','pad_support_knee','declare_hand_support_and_foot_orientation','clear_lateral_leg_space','set_range_and_stop_signal'),
        'cues',jsonb_build_array('hands_stay_connected','pelvis_quiet','back_long','hips_back_not_chest_down','comfortable_tension_not_forced_range','match_both_sides'),
        'feedbackPrompt','Did you feel comfortable inner-thigh tension without groin pain, hip pinching, or your back changing shape?',
        'accessibilityOptions',jsonb_build_array('knee_padding','elevated_hands','shorter_leg_reach','smaller_rock_range','slower_rehearsal','visible_side_cues','longer_setup','standing_adductor_shift_substitute','written_audio_still_image_or_live_instruction')
      ),
      coach_support_json = jsonb_build_object(
        'observationPriorities',jsonb_build_array('exact_variant_and_side_order','front_or_rear_view_for_pelvis_and_leg_path','side_view_for_hip_rock_and_lumbar_position','hand_knee_and_foot_contacts','left_right_range_symptoms_and_control'),
        'qualityGate','Count only repetitions with stable support contacts, the declared extended-leg and foot position, controlled pelvis and lumbar spine, smooth hip motion, continued breathing, and no sharp symptom.',
        'stopRules',jsonb_build_array('sharp_or_increasing_groin_hip_knee_wrist_shoulder_or_back_pain','hip_pinching_guarding_numbness_or_tingling','support_contact_slip_or_unsafe_space','persistent_pelvis_or_spine_compensation_after_one_regression_or_cue','range_or_control_materially_worsens','breath_holding_or_bouncing'),
        'reviewFlags',jsonb_build_array('generic_reach_direction_arm_path_timing_and_trunk_motion_unresolved','half_kneeling_support_leg_path_load_rock_direction_and_terminal_position_unresolved','all_scores_relationships_media_and_card_states_are_candidate_only')
      ),
      support_operations_json = jsonb_build_object(
        'supportSummary','Expose side, hand and knee support, foot orientation, range, reach, repetitions or breaths, symptoms, quality stop, and floor-access alternative.',
        'issueCategories',jsonb_build_array('identity_or_variant','range_or_side_symmetry','difficulty_or_dose','equipment_or_environment','symptom_or_population_constraint','instruction_or_accessibility','media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array('acute_injury','neurologic_symptom','unsafe_support_or_fall'),
          'coachReview',jsonb_build_array('repeated_pelvis_spine_leg_or_support_fault','persistent_asymmetry','unclear_range_or_side_dose'),
          'contentReview',jsonb_build_array('generic_reach_identity','half_kneeling_identity','media_mismatch','missing_accessibility_or_stop_rule')
        ),
        'knownLimitations',jsonb_build_array('no_direct_biomechanics_or_dose_response_study_for_the_exact_drill','exercise_specific_sources_are_expert_instruction','generic_reach_and_half_kneeling_variants_nonselectable','candidate_media_not_reverified_in_this_migration','scores_relationships_calibrations_and_card_are_unapproved_proposals'),
        'changeImpactPolicy','Changes to start position, support, leg path, foot orientation, range, cadence, hold, reach, load, side dose, stop rule, relationship, or media require renewed affected reviews.'
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'identityAuthorityMigration','308_coaching_adductor_rockback_variant_consolidation',
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_candidates_unverified_and_non_embeddable',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ),
      updated_at = now()
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived';

  CREATE TEMP TABLE adductor_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    start_position TEXT NOT NULL,
    support_contract TEXT NOT NULL,
    leg_path TEXT NOT NULL,
    foot_orientation TEXT NOT NULL,
    overlay TEXT NOT NULL,
    complexity SMALLINT,
    physical SMALLINT,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    equipment TEXT[] NOT NULL,
    selectable BOOLEAN NOT NULL,
    identity_quarantine BOOLEAN NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO adductor_variant_seed VALUES
    ('baseline','Adductor Rockback — Quadruped Baseline','quadruped_one_knee_supported_opposite_leg_extended_laterally','both_hands_on_floor','extended_leg_lateral_and_declared_straight','declared_foot_flat_or_heel_supported_toes_up','none',26,12,24,18,18,1,12,28,12,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('reach-overlay-unresolved','Adductor Rockback — Reach Direction Unresolved','quadruped_one_knee_supported_opposite_leg_extended_laterally','both_hands_support_unresolved_during_reach','extended_leg_lateral_and_declared_straight','declared_before_review','reach_direction_arm_path_timing_and_trunk_motion_unresolved',NULL,NULL,34,30,24,1,14,40,12,ARRAY['none']::TEXT[],FALSE,TRUE),
    ('thoracic-rotation-reach','Adductor Rockback — Thoracic Rotation Reach','quadruped_one_knee_supported_opposite_leg_extended_laterally','one_hand_support_with_declared_reaching_arm','extended_leg_lateral_and_declared_straight','declared_foot_orientation','declared_thoracic_rotation_reach_with_quiet_pelvis',38,14,38,24,22,1,14,40,12,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('half-kneeling-kicking-access','Adductor Rockback — Half-Kneeling Protocol Unresolved','half_kneeling_context_only','hand_support_unresolved','working_leg_path_and_rock_direction_unresolved','unresolved','external_load_terminal_position_and_kicking_context_unresolved',NULL,NULL,36,34,28,1,18,44,18,ARRAY[]::TEXT[],FALSE,TRUE),
    ('elevated-hand-support','Adductor Rockback — Elevated Hand Support','quadruped_one_knee_supported_opposite_leg_extended_laterally','both_hands_on_stable_elevated_support','extended_leg_lateral_and_declared_straight','declared_foot_orientation','none',20,10,18,16,14,1,10,22,12,ARRAY['stable_support']::TEXT[],TRUE,FALSE);

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    status,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    ARRAY[
      seed.start_position,
      seed.support_contract,
      seed.leg_path,
      seed.foot_orientation,
      seed.overlay
    ]::TEXT[],
    CASE
      WHEN seed.complexity IS NULL OR seed.physical IS NULL
        THEN jsonb_build_object(
          'scoreDeferred',TRUE,
          'deferredReason',CASE
            WHEN seed.variant_key = 'reach-overlay-unresolved'
              THEN 'Reach direction, arm path, timing, support, and intended trunk motion are unresolved.'
            ELSE 'Half-kneeling support, working-leg path, load, rock direction, and terminal position are unresolved.'
          END,
          'difficultyModel','max_exercise_complexity_physical_difficulty',
          'provisional',TRUE
        )
      ELSE jsonb_build_object(
        'technicalComplexity',seed.complexity,
        'absoluteLoadDemand',seed.physical,
        'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
        'coordinationDemand',seed.coordination,
        'supervisionDemand',seed.supervision,
        'failureConsequence',seed.consequence,
        'impact',seed.impact,
        'workCapacityDemand',seed.local_fatigue,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object('technicalComplexity','exercise_complexity','absoluteLoadDemand','physical_difficulty'),
        'provisional',TRUE
      )
    END,
    jsonb_build_object(
      'selectable',seed.selectable,
      'identityQuarantine',seed.identity_quarantine,
      'startPosition',seed.start_position,
      'supportContract',seed.support_contract,
      'legPath',seed.leg_path,
      'footOrientation',seed.foot_orientation,
      'overlay',seed.overlay,
      'range','self_selected_pain_free_without_forcing',
      'pelvisAndSpine','declared_quiet_controlled_position',
      'sideDose','both_sides_declared_and_recorded',
      'terminalAction','controlled_return_to_start'
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_or_unresolved_only',
      'externalLoadDescription',CASE
        WHEN seed.variant_key = 'half-kneeling-kicking-access'
          THEN 'historical external-load state unresolved'
        ELSE 'bodyweight with declared hand and knee support'
      END,
      'effectiveLoadDrivers',jsonb_build_array('body_mass','floor_transfer','kneeling_tolerance','upper_body_support','leg_position','foot_orientation','rock_range','tempo_or_hold','reach_overlay','side_dose','repetitions'),
      'gripDemand',1,
      'spinalLoading',4,
      'eccentricStress',8,
      'impactClass','none',
      'loadTracking',jsonb_build_array('variant_key','side','support_height','foot_orientation','range','tempo_or_hold','reach','external_load_if_reviewed','repetitions_or_breaths')
    ),
    jsonb_build_object(
      'localMuscleFatigue',seed.local_fatigue,
      'gripFatigue',1,
      'technicalFatigueSensitivity',seed.technical_fatigue,
      'impactAccumulation',seed.impact,
      'recoveryHours',seed.recovery_hours,
      'primaryFatigueSites',jsonb_build_array('adductors_and_medial_thigh','support_side_hip','pelvic_and_trunk_stabilizers','wrists_shoulders_and_serratus_for_hand_support'),
      'earlyFatigueSignals',jsonb_build_array('reduced_or_forced_range','pelvis_rotation','lumbar_rounding_or_arching','extended_knee_bending','shoulder_collapse','breath_holding','rushed_repetitions','side_asymmetry'),
      'downstreamConflicts',jsonb_build_array('kicking_cutting_skating_or_sprinting_load','lateral_strength_or_copenhagen_work','high_volume_squatting_or_lunging','wrist_or_shoulder_support_work','fatigue_degraded_conditioning')
    ),
    jsonb_build_object(
      'selectionStatus',CASE
        WHEN seed.selectable THEN 'candidate_requires_human_review'
        ELSE 'blocked_pending_identity_review'
      END,
      'primaryIntent','low_fatigue_adductor_length_tolerance_and_hip_flexion_access',
      'appropriatePhases',CASE
        WHEN seed.selectable THEN jsonb_build_array('prepare_and_access')
        ELSE jsonb_build_array('identity_review_only')
      END,
      'avoidUse',jsonb_build_array('forced_flexibility_test','injury_prevention_claim','replacement_for_progressive_adductor_strength','fatigue_station','unrecorded_side_support_foot_reach_or_range','unresolved_variant_selection'),
      'cumulativeBudget',jsonb_build_object(
        'repetitionsPerSide',1,
        'adductorRangeExposure',seed.local_fatigue,
        'floorAndUpperBodySupportStress',seed.technical_fatigue,
        'impact',seed.impact,
        'countInWorkout',seed.selectable
      )
    )
  FROM adductor_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, variant_key)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    status = 'review',
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    updated_at = now();

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id,
    profile_key,
    phase_key,
    role,
    purpose,
    phase_suitability,
    methodology_alignment,
    objective_relevance_json,
    dosage_json,
    quality_gate,
    stop_rules,
    coach_instructions,
    athlete_instructions,
    expected_adaptation,
    equipment_required,
    logistics_json,
    substitution_ids,
    status,
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json
  )
  SELECT
    variant.id,
    CASE
      WHEN seed.selectable THEN 'prepare-access'
      ELSE 'identity-review-only'
    END,
    'prepare_and_access',
    CASE
      WHEN seed.selectable THEN 'primary'
      ELSE 'avoid'
    END,
    CASE
      WHEN seed.selectable
        THEN 'Rehearse a pain-free exact Adductor Rockback at low fatigue, record both sides, and follow with task-relevant movement when the access need is observed.'
      ELSE 'Preserve unresolved identity evidence without authorizing a production dose or workout selection.'
    END,
    CASE WHEN seed.selectable THEN 94 ELSE 1 END,
    CASE WHEN seed.selectable THEN 92 ELSE 100 END,
    jsonb_build_object(
      'adductorAndHipAccess',CASE WHEN seed.selectable THEN 90 ELSE 0 END,
      'pelvisAndSpineControl',seed.technical_fatigue,
      'lowFatiguePreparation',CASE WHEN seed.selectable THEN 96 ELSE 0 END,
      'productionAuthorized',seed.selectable
    ),
    CASE
      WHEN seed.selectable THEN jsonb_build_object(
        'sets',jsonb_build_array(1,2),
        'repsPerSide',jsonb_build_array(5,10),
        'optionalBreathsAtComfortableEndPosition',jsonb_build_array(1,3),
        'rpe',jsonb_build_array(1,4),
        'restSeconds',jsonb_build_array(15,45),
        'tempo','smooth_rock_back_brief_position_ownership_controlled_return_without_bouncing',
        'stopBeforeFatigue',TRUE
      )
      ELSE jsonb_build_object(
        'productionDoseAuthorized',FALSE,
        'sets',jsonb_build_array(0,0),
        'reps',jsonb_build_array(0,0),
        'reviewRequirements',CASE
          WHEN seed.variant_key = 'reach-overlay-unresolved'
            THEN jsonb_build_array('reach_direction','arm_path','timing','hand_support','intended_trunk_motion')
          ELSE jsonb_build_array('half_kneeling_configuration','hand_support','working_leg_path','external_load','rock_direction','terminal_position')
        END
      )
    END,
    CASE
      WHEN seed.selectable
        THEN 'Every counted repetition preserves the declared side, hand and knee support, extended-leg and foot position, comfortable range, pelvis and lumbar control, breathing, exact overlay, and smooth return.'
      ELSE 'No production repetition is authorized until every missing identity dimension is defined and independently reviewed.'
    END,
    ARRAY[
      'Stop for sharp or increasing groin, hip, knee, wrist, shoulder, or back pain; pinching, guarding, numbness, or tingling.',
      'Stop for slipping support, forced range, breath holding, bouncing, repeated pelvis or spine compensation, or worsening side asymmetry.',
      'Do not continue through an unresolved identity question or turn this low-fatigue access drill into conditioning.'
    ]::TEXT[],
    ARRAY[
      'Confirm exact variant, side order, hand and knee support, foot orientation, range, tempo or breath count, and stop signal.',
      'Observe from front or rear for pelvis and leg path and from the side for hip motion and lumbar position.',
      'For unresolved variants, collect missing identity facts only; do not prescribe or imply approval.'
    ]::TEXT[],
    ARRAY[
      'Set your hands and support knee, extend the called leg to the side, and use the assigned foot position.',
      'Keep your pelvis quiet and back long as your hips move back to comfortable inner-thigh tension, then return smoothly.',
      'Stop for pain, pinching, slipping, forced range, breath holding, or a change in the called position.'
    ]::TEXT[],
    CASE
      WHEN seed.selectable
        THEN 'Repeatable low-fatigue adductor length tolerance and hip-flexion access with controlled support, pelvis, spine, breathing, and side symmetry.'
      ELSE 'A complete human identity decision; no training adaptation or dose is promised.'
    END,
    seed.equipment,
    jsonb_build_object(
      'athletesPerStation',1,
      'coachSightline','front_or_rear_for_pelvis_leg_and_foot_plus_side_for_hip_rock_and_lumbar_position',
      'requiredClearance','clean_floor_or_support_zone_with_full_lateral_leg_space_and_no_cross_traffic',
      'setupSeconds',CASE WHEN seed.variant_key = 'elevated-hand-support' THEN 60 ELSE 45 END,
      'transitionSeconds',20,
      'sharedEquipmentPolicy','Clean padding and stable elevated support are assigned before the athlete enters the station.'
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'repSeconds',6,
      'setupSeconds',CASE WHEN seed.variant_key = 'elevated-hand-support' THEN 60 ELSE 45 END,
      'transitionSeconds',20,
      'restIsExplicit',TRUE
    ),
    jsonb_build_object(
      'scaleDown',jsonb_build_array('reduce_range','shorten_leg_reach','add_knee_padding','elevate_hands','slow_rehearsal','increase_setup_time','use_a_separate_standing_adductor_shift_definition'),
      'scaleUp',jsonb_build_array('improve_repeatability','increase_owned_range_within_variant','add_brief_declared_breath_pause','use_declared_thoracic_rotation_variant'),
      'neverScaleBy',jsonb_build_array('forcing_range','inventing_reach_direction','inventing_half_kneeling_support_or_load','adding_fatigue','continuing_through_pain_or_compensation')
    ),
    jsonb_build_object(
      'track',jsonb_build_array('variant_key','side_order','support_height','foot_orientation','range','tempo_or_breaths','reach','repetitions','rpe','symptoms','quality_stop'),
      'qualityThreshold','Both sides meet the exact support, position, range, breathing, and symptom gate.',
      'productionSelectable',seed.selectable
    ),
    jsonb_build_object(
      'beforeSet',jsonb_build_array('confirm_exact_variant_and_identity_state','confirm_floor_padding_support_and_lateral_space','confirm_side_order_range_dose_and_stop_signal'),
      'duringSet',jsonb_build_array('watch_support_pelvis_spine_leg_path_range_breathing_and_symptoms','announce_first_material_quality_stop'),
      'afterSet',jsonb_build_array('record_both_sides_range_dose_symptoms_and_faults','transition_to_task_relevant_movement_or_regress_without_changing_identity')
    )
  FROM adductor_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  ON CONFLICT (variant_id, profile_key)
  DO UPDATE SET
    phase_key = EXCLUDED.phase_key,
    role = EXCLUDED.role,
    purpose = EXCLUDED.purpose,
    phase_suitability = EXCLUDED.phase_suitability,
    methodology_alignment = EXCLUDED.methodology_alignment,
    objective_relevance_json = EXCLUDED.objective_relevance_json,
    dosage_json = EXCLUDED.dosage_json,
    quality_gate = EXCLUDED.quality_gate,
    stop_rules = EXCLUDED.stop_rules,
    coach_instructions = EXCLUDED.coach_instructions,
    athlete_instructions = EXCLUDED.athlete_instructions,
    expected_adaptation = EXCLUDED.expected_adaptation,
    equipment_required = EXCLUDED.equipment_required,
    logistics_json = EXCLUDED.logistics_json,
    substitution_ids = EXCLUDED.substitution_ids,
    status = 'review',
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    updated_at = now();

  CREATE TEMP TABLE adductor_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO adductor_evidence_seed VALUES
    ('identity','https://themovementfix.com/how-to-stretch-your-adductors-with-the-adductor-rock-back/','How to Stretch Your Adductors with the Adductor Rock Back','The Movement Fix','expert_instruction',72,'["The exercise-specific source sets the drill on one supported knee with both hands forward and the opposite leg extended laterally, then moves the hips backward while the lumbar position remains controlled.","Treat that quadruped unilateral rock-back as the canonical identity. Foot orientation, range, support, cadence, and a declared reach remain variants only while the same hip-rocking task remains primary."]'::JSONB),
    ('taxonomy','https://library.theprehabguys.com/vimeo-video/quadruped-dynamic-long-adductor-stretch/','Adductor Rock Back','[P]rehab','expert_instruction',72,'["The exercise source describes hands-and-knees support, one straight leg placed laterally, a neutral pelvic and low-back position, and a backward hip shift.","Classify {{canonicalName}} by side, straight-versus-bent extended knee, foot orientation, support height, range, tempo or hold, and exact reach direction rather than by an athlete or class skill level."]'::JSONB),
    ('anatomy','https://www.ncbi.nlm.nih.gov/books/NBK534775/','Anatomy, Bony Pelvis and Lower Limb: Medial Thigh Muscles','NCBI Bookshelf / StatPearls','professional_standard',82,'["The medial-thigh anatomy reference identifies the adductor longus, brevis, magnus, gracilis, and pectineus and describes the group as central to hip adduction and lower-extremity function.","Represent the medial-thigh adductors and gracilis as the primary target tissues, with hip, pelvis, knee, and trunk position explicitly modeled; the exact tissue emphasis changes with hip, knee, and foot orientation."]'::JSONB),
    ('biomechanics','https://themovementfix.com/how-to-stretch-your-adductors-with-the-adductor-rock-back/','How to Stretch Your Adductors with the Adductor Rock Back','The Movement Fix','expert_instruction',72,'["The exercise source moves the pelvis backward into greater hip flexion while the laterally extended leg remains organized and the lower back stays controlled.","The cue to move the hips back rather than drop the chest is an exercise-specific coaching model, not direct laboratory evidence. Do not claim an ideal depth, foot angle, pelvic orientation, or tissue-specific adaptation for every athlete."]'::JSONB),
    ('difficulty','https://library.theprehabguys.com/vimeo-video/quadruped-dynamic-long-adductor-stretch/','Adductor Rock Back','[P]rehab','expert_instruction',72,'["The setup is externally unloaded and supported by the hands and one knee, but it still requires unilateral setup, stable support contacts, controlled pelvis and spine, and self-selected range.","Assess exercise complexity separately from physical difficulty and derive overall as their maximum. Floor transfer, kneeling, wrist and shoulder support, coordination, supervision, failure consequence, and symptoms remain separate planning dimensions; no athlete skill level belongs on the exercise card."]'::JSONB),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC10569248/','Current Clinical Concepts: Exercise and Load Management of Adductor Strains, Adductor Ruptures, and Long-Standing Adductor-Related Groin Pain','Journal of Athletic Training','peer_reviewed_research',92,'["Adductor load management should account for tissue irritability, symptoms during and after exercise, strength and performance, and total sport-specific exposure rather than a single exercise name.","For {{canonicalName}}, track side, range, repetitions or hold time, symptom response, support demand, and overlap with kicking, cutting, skating, sprinting, lateral strength, and adductor-loading work. Low-load recovery guidance is a conservative programming inference, not a measured result for this drill."]'::JSONB),
    ('constraints','https://library.theprehabguys.com/vimeo-video/quadruped-dynamic-long-adductor-stretch/','Adductor Rock Back','[P]rehab','expert_instruction',72,'["The exercise-specific source requires hands-and-knees support, a laterally extended straight leg, a comfortable backward shift, and a relatively flat low back without excessive arching or bending.","Require stable floor and hand contacts, lateral leg space, tolerable kneeling and upper-body support, and a pain-free self-selected range. Use padding, elevated hands, shorter range, or a standing substitute when floor access or support tolerance limits quality."]'::JSONB),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/37962709/','Acute Effects of Various Stretching Techniques on Range of Motion: A Systematic Review with Meta-Analysis','Sports Medicine - Open','peer_reviewed_research',92,'["Across 47 eligible studies, an acute stretching bout produced a small overall range-of-motion effect, while technique, intensity, trained state, and duration did not explain the effect and the hip-adductor test subgroup did not show a significant change.","Use a small, quality-preserving dose for movement preparation and reassess the athlete''s response. No source validates one universal repetition count, hold duration, or acute adductor-range benefit for this exact exercise."]'::JSONB),
    ('instructions','https://themovementfix.com/how-to-stretch-your-adductors-with-the-adductor-rock-back/','How to Stretch Your Adductors with the Adductor Rock Back','The Movement Fix','expert_instruction',72,'["The exercise source specifies a padded support knee, hands forward, one laterally extended leg, a neutral lower back, and a backward hip movement without dropping the chest.","Instructions for {{canonicalName}} must name the side, support surface, extended-knee expectation, foot orientation, comfortable range, pelvis and spine constraint, tempo or hold, return, and side order."]'::JSONB),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/26642915/','Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review','Applied Physiology, Nutrition, and Metabolism','peer_reviewed_research',90,'["Dynamic stretching can be included within a warm-up followed by additional dynamic activity, but effect sizes are small to moderate and evidence does not support universal injury-prevention claims.","Use {{canonicalName}} for an observed adductor or hip-flexion access need, keep it low fatigue, and follow it with task-relevant movement. Do not substitute it for progressive adductor strength and sport-specific load capacity."]'::JSONB),
    ('athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should account for individual readiness, movement competence, psychosocial needs, and progressive exposure.","Athlete support should show the working side, hand and knee support, foot orientation, acceptable range, a successful repetition, a floor-access alternative, and the groin-pain or hip-pinch stop signal in plain language."]'::JSONB),
    ('coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction, supervision, appropriate progression, and safe equipment are central to exercise participation.","Coach support should include floor and padding setup, front and side observation points, left-right comparison, exact variant declaration, symptom and range logging, a standing substitute, and hard quarantine alerts for unresolved reach and half-kneeling variants."]'::JSONB),
    ('alternates','https://www.catalystathletics.com/exercise/754/Half-Kneeling-Adductor-Rock/','Half-Kneeling Adductor Rock','Catalyst Athletics','expert_instruction',70,'["The half-kneeling instruction uses a distinct knee-and-foot configuration, optional external implement against the trunk, a rock toward the up leg, and a controlled return.","A fully specified half-kneeling setup can remain a start-position and implement variant of the adductor rock family. The historical Vortex half-kneeling source remains quarantined because it does not define those dimensions. Frog rock-backs, stepping lateral lunges, and direct adductor-strength tasks remain separate definitions."]'::JSONB),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Exercise selection and progression require qualified supervision, technically appropriate loading, safe equipment and space, and individual readiness.","Stop {{canonicalName}} for sharp or increasing groin, hip, knee, wrist, shoulder, or back pain; pinching, guarding, numbness, or tingling; a slipping support contact; forced range; breath holding; or repeated loss of the assigned pelvis and spine position."]'::JSONB),
    ('accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Training should be individualized and progressed from the participant''s current physical, psychosocial, and training readiness rather than from a level attached to an exercise card.","Make {{canonicalName}} accessible with knee padding, hands on a stable elevated surface, a shorter leg reach, a smaller rock-back range, slower rehearsal, visible side cues, longer setup time, or a standing adductor-shift substitute when floor access is the limiting constraint. Record exercise complexity and physical difficulty; do not label the exercise itself beginner, intermediate, or advanced."]'::JSONB),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The supplied links are discovery candidates only. YouTube oEmbed responded for all five on the snapshot date, but exact sequence, variant match, safety, cue quality, captions, accessibility, full content, reviewer identity, and approval require human review."]'::JSONB);

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    claims_json,
    evidence_quality,
    review_status,
    reviewer_user_id,
    reviewed_at
  )
  SELECT
    definition.id,
    definition.card_version,
    evidence.section_key,
    evidence.source_url,
    evidence.source_title,
    evidence.source_publisher,
    evidence.source_kind,
    replace(
      evidence.claims_json::TEXT,
      '{{canonicalName}}',
      definition.canonical_name
    )::JSONB,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN adductor_evidence_seed evidence
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived'
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
  )
  DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE adductor_relationship_seed (
    from_key TEXT NOT NULL,
    to_key TEXT NOT NULL,
    relationship TEXT NOT NULL,
    similarity SMALLINT NOT NULL,
    reason TEXT NOT NULL,
    conditions JSONB NOT NULL,
    PRIMARY KEY (from_key, to_key, relationship)
  ) ON COMMIT DROP;

  INSERT INTO adductor_relationship_seed VALUES
    ('elevated-hand-support','baseline','progression',90,'The baseline removes elevated hand support and adds floor-transfer, wrist, shoulder, trunk-support, and active-range demand while preserving the same quadruped unilateral rock.','{"changedAttributes":["support_height","floor_transfer","wrist_and_shoulder_support","active_range"],"condition":"progress_only_after_stable_elevated_support_and_pain_free_floor_access","humanReviewRequired":true}'::JSONB),
    ('baseline','elevated-hand-support','regression',90,'Elevated hands reduce floor-transfer, wrist, shoulder, trunk-support, and accessible-range demand while preserving the lateral leg position and hip rock.','{"changedAttributes":["support_height","floor_transfer","wrist_and_shoulder_support","active_range"],"condition":"use_when_floor_or_upper_body_support_limits_baseline_quality","humanReviewRequired":true}'::JSONB),
    ('baseline','thoracic-rotation-reach','progression',80,'The declared thoracic-rotation reach adds arm timing and trunk-pelvis dissociation while preserving the primary quadruped rock.','{"changedAttributes":["reach_direction","thoracic_rotation","hand_support","coordination"],"condition":"progress_after_repeatable_baseline_control_and_pain_free_rotation","humanReviewRequired":true}'::JSONB),
    ('thoracic-rotation-reach','baseline','regression',80,'The baseline removes the required thoracic rotation and one-hand support while preserving the primary hip-rocking task.','{"changedAttributes":["reach_direction","thoracic_rotation","hand_support","coordination"],"condition":"objective_accepts_no_reach_overlay","humanReviewRequired":true}'::JSONB),
    ('baseline','elevated-hand-support','lateral_substitution',84,'Elevated hand support is an exact support substitution when the objective remains low-fatigue adductor and hip access.','{"changedAttributes":["support_height","floor_access"],"condition":"objective_and_range_are_preserved_and_support_is_stable","humanReviewRequired":true}'::JSONB),
    ('elevated-hand-support','baseline','lateral_substitution',84,'Floor support is an exact support substitution when the athlete tolerates the transfer, wrist, shoulder, and trunk demands.','{"changedAttributes":["support_height","floor_access"],"condition":"floor_access_and_upper_body_support_are_pain_free_and_controlled","humanReviewRequired":true}'::JSONB);

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status,
    created_by,
    reviewed_by,
    reviewed_at
  )
  SELECT
    from_variant.id,
    to_variant.id,
    seed.relationship,
    seed.similarity,
    ARRAY['complexity','physical_difficulty','support','range','reach','floor_access']::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM adductor_relationship_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = definition.id
   AND from_variant.variant_key = seed.from_key
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = definition.id
   AND to_variant.variant_key = seed.to_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_relationship_v1.review_status = 'review';

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id,
    variant_id,
    dimension,
    proposed_score,
    anchor_tier,
    rationale,
    status,
    version,
    created_by,
    reviewed_by,
    review_notes,
    reviewed_at
  )
  SELECT
    1,
    variant.id,
    dimension.dimension,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN seed.complexity
      ELSE seed.physical
    END,
    CASE
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 30 THEN 20
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 50 THEN 40
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 70 THEN 60
      ELSE 80
    END,
    CASE dimension.dimension
      WHEN 'technicalComplexity'
        THEN 'Candidate exercise-complexity score reflects unilateral setup, support, floor transfer, pelvis and spine control, leg and foot position, reach overlay, side order, and repeatable range; human anchor review is pending.'
      ELSE 'Candidate physical-difficulty score reflects bodyweight support, kneeling tolerance, adductor range exposure, upper-body support, repetitions, and repeatable quality; human anchor review is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Candidate migration-404 anchor; independent human review required.',
    NULL
  FROM adductor_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (VALUES
    ('technicalComplexity'),
    ('absoluteLoadDemand')
  ) AS dimension(dimension)
  WHERE seed.complexity IS NOT NULL
    AND seed.physical IS NOT NULL
  ON CONFLICT (facility_id, variant_id, dimension, version)
  DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_score_calibration_v1.status = 'review';

  CREATE TEMP TABLE adductor_media_seed (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO adductor_media_seed VALUES
    ('Vr0Us9LPGRg','How to Stretch Your Adductors with the Adductor Rock Back','The Movement Fix','Public YouTube search: adductor rockback exercise','Historical research recorded an oEmbed response on 2026-07-26, but this migration does not reverify playback or embedding. Exact baseline sequence, claims, cue quality, accessibility, and full content require human review.'),
    ('yF8o6I6aSZg','Adductor Quadruped Rockback - Hip Mobility Drill','Mike Reinold','Public YouTube search: adductor rockback exercise','Historical research recorded an oEmbed response on 2026-07-26, but this migration does not reverify playback or embedding. Exact foot position, range, safety, captions, and demonstration quality require human review.'),
    ('zfO4HhPUxDw','Adductor Rock Backs are the Ultimate Groin Stretch','[P]rehab','Public YouTube search: adductor rockback exercise','The superlative in the source title is not adopted as a Vortex claim. Playback, embedding, exact sequence, claims, and full demonstration require human review.'),
    ('Gf2eQUxG2HM','Adductor Rockback w/ Reach Thru T-Spine Rotation','Fitness At Achieve Wellness','Public YouTube search: adductor rockback with reach thoracic rotation','Thoracic-rotation variant candidate only. Playback, embedding, exact direction, pelvis control, cue quality, captions, accessibility, and full content require human review.'),
    ('OH1uIXf0y-w','Adductor Rock Back w Thoracic Rotation','MamasteFit','Public YouTube search: adductor rockback with reach thoracic rotation','Thoracic-rotation variant candidate only. Population context is not inferred from the channel name; playback, embedding, exact match, and full content require human review.');

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
    duration_seconds,
    language_code,
    captions_available,
    embedding_allowed,
    exact_variant_match,
    demonstration_quality_score,
    link_status,
    review_status,
    discovery_method,
    source_query,
    reviewer_user_id,
    reviewed_at,
    notes
  )
  SELECT
    definition.id,
    NULL,
    definition.card_version,
    'https://www.youtube.com/watch?v=' || media.video_id,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    NULL,
    'en',
    NULL,
    FALSE,
    NULL,
    NULL,
    'unverified',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    media.notes
  FROM adductor_media_seed media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id)
  DO UPDATE SET
    variant_id = NULL,
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    duration_seconds = NULL,
    language_code = 'en',
    captions_available = NULL,
    embedding_allowed = FALSE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'unverified',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE adductor_alternate_seed (
    alternate_name TEXT PRIMARY KEY,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO adductor_alternate_seed VALUES
    ('Adductor Rockback with Foot Flat','modifier_annotation','Foot orientation changes the local position and perceived stretch without changing the quadruped unilateral hip-rocking identity.','{"footOrientation":"foot_flat"}'::JSONB),
    ('Adductor Rockback with Toes Up','modifier_annotation','Rotating the foot so the toes face upward is an explicit foot-orientation modifier, not a new movement identity.','{"footOrientation":"heel_supported_toes_up"}'::JSONB),
    ('Supported Adductor Rockback','new_variant','Stable elevated hand support changes floor-transfer, wrist, shoulder, trunk-support, and accessible-range demands while preserving the same lateral leg position and hip rock.','{"variantKey":"elevated-hand-support","supportLevel":"stable_elevated_hands"}'::JSONB),
    ('Adductor Rockback with Reach','new_variant','An upper-body reach is a controlled overlay on the same rock-back, but the historical source remains quarantined until reach direction, arm path, timing, and desired trunk motion are defined.','{"variantKey":"reach-overlay-unresolved","armTask":"reach_direction_unresolved","identityQuarantine":true}'::JSONB),
    ('Adductor Rock-Back with T-Spine Reach','new_variant','Specified thoracic rotation adds a multiplanar reach overlay while preserving the primary quadruped adductor rock-back.','{"variantKey":"thoracic-rotation-reach","armTask":"thoracic_rotation_reach","pelvisConstraint":"quiet"}'::JSONB),
    ('Half-Kneeling Adductor Rockback','new_variant','Half-kneeling changes start position and support while retaining an adductor-focused rocking task. The historical source remains quarantined until leg path, hand support, load, and direction are specified.','{"variantKey":"half-kneeling-kicking-access","startPosition":"half_kneeling","supportAndLoad":"unresolved","identityQuarantine":true}'::JSONB),
    ('Loaded Half-Kneeling Adductor Rock','new_variant','A declared kettlebell or dumbbell against the trunk changes implement, loading, physical difficulty, and dosage while preserving a fully specified half-kneeling rock.','{"startPosition":"half_kneeling","implement":"kettlebell_or_dumbbell_against_trunk","requiresNewReviewedVariant":true}'::JSONB),
    ('Frog Rockback','new_definition','A bilateral bent-knee wide-base setup changes laterality, knee position, hip orientation, and the primary movement from the unilateral straight-leg rock-back.','{"movementPattern":"bilateral_bent_knee_adductor_rockback"}'::JSONB),
    ('Lateral Lunge Shift','new_definition','A standing loaded-leg lateral shift changes support, force acceptance, balance, joint loading, and the primary movement from a floor-supported mobility rock.','{"movementPattern":"standing_lateral_lunge_shift"}'::JSONB),
    ('Copenhagen Adduction Exercise','new_definition','The Copenhagen exercise is a direct adductor-strength task with different support, leverage, force production, fatigue, and progression requirements.','{"primaryTrainingStimulus":"adductor_strength_and_capacity"}'::JSONB),
    ('Standing Adductor Shift','new_definition','The standing substitute removes floor and upper-body support and changes balance and lower-extremity loading enough to require its own definition.','{"movementPattern":"standing_wide_stance_adductor_shift"}'::JSONB);

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id,
    reviewed_card_version,
    alternate_name,
    classification,
    rationale,
    distinguishing_dimensions,
    proposed_card_json,
    review_status,
    reviewer_user_id,
    reviewed_at
  )
  SELECT
    definition.id,
    definition.card_version,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    NULL,
    'candidate',
    NULL,
    NULL
  FROM adductor_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = 'adductor-rockback'
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, alternate_name)
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    schema_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required,
    checked_at
  )
  SELECT
    definition.id,
    definition.facility_id,
    definition.card_version,
    definition.schema_version,
    migration_key,
    'quarantined',
    jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'controlledTaxonomyPresent',TRUE,
      'anatomyJointsActionsPlanesLateralityPresent',TRUE,
      'selectableIdentitiesResolved',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.requirements_json->>'selectable' = 'true'
          AND variant.requirements_json->>'identityQuarantine' = 'false'
      ) = 3,
      'unresolvedVariantsQuarantined',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.requirements_json->>'selectable' = 'false'
          AND variant.requirements_json->>'identityQuarantine' = 'true'
          AND variant.difficulty_json->>'scoreDeferred' = 'true'
      ) = 2,
      'difficultyFormulaValid',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND (
            (
              variant.difficulty_json ? 'technicalComplexity'
              AND variant.difficulty_json ? 'absoluteLoadDemand'
              AND (
                NOT (variant.difficulty_json ? 'baseOverallDifficulty')
                OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
                  <> greatest(
                    (variant.difficulty_json->>'technicalComplexity')::INTEGER,
                    (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
                  )
              )
            )
            OR (
              (variant.difficulty_json ? 'technicalComplexity')
                <> (variant.difficulty_json ? 'absoluteLoadDemand')
            )
            OR (
              NOT (variant.difficulty_json ? 'technicalComplexity')
              AND variant.difficulty_json->>'scoreDeferred' IS DISTINCT FROM 'true'
            )
          )
      ),
      'exerciseProficiencyClassificationAbsent',
        NOT coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            definition.provenance_json,
            definition.environment_json,
            definition.population_json,
            definition.anatomy_json,
            definition.athlete_support_json,
            definition.coach_support_json,
            definition.support_operations_json
          )
        ),
      'loadFatigueRecoveryPresent',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.load_profile_json <> '{}'::JSONB
          AND variant.fatigue_profile_json <> '{}'::JSONB
      ) = 5,
      'equipmentEnvironmentPopulationPresent',
        cardinality(definition.required_equipment) > 0
        AND definition.environment_json <> '{}'::JSONB
        AND definition.population_json <> '{}'::JSONB,
      'deliveryProfilesPresent',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_delivery_profile_v1 profile
          ON profile.variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND profile.status = 'review'
      ) = 5,
      'coachAndAthleteSupportPresent',
        definition.coach_support_json <> '{}'::JSONB
        AND definition.athlete_support_json <> '{}'::JSONB,
      'allEvidenceSectionsPresent',(
        SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id = definition.id
          AND evidence.reviewed_card_version = definition.card_version
          AND evidence.review_status = 'candidate'
      ) = 16,
      'mediaCandidateCount',(
        SELECT count(DISTINCT media.video_id)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND media.review_status = 'candidate'
          AND media.link_status = 'unverified'
          AND media.embedding_allowed IS FALSE
      ),
      'mediaVerifiedOrApprovedCount',(
        SELECT count(*)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND (
            media.link_status = 'healthy'
            OR media.embedding_allowed IS TRUE
            OR media.exact_variant_match IS NOT NULL
            OR media.review_status <> 'candidate'
          )
      ),
      'alternateAssessmentsPresent',(
        SELECT count(*)
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id = definition.id
          AND alternate.reviewed_card_version = definition.card_version
          AND alternate.review_status = 'candidate'
      ) = 11,
      'relationshipsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_relationship_v1 relationship
          ON relationship.from_variant_id = variant.id
          OR relationship.to_variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND relationship.review_status <> 'review'
      ),
      'calibrationsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_score_calibration_v1 calibration
          ON calibration.variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND calibration.status <> 'review'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-IDENTITY-03',
        'message','Generic reach direction, arm path, timing, support, and intended trunk motion remain unresolved; the variant is nonselectable and unscored.'
      ),
      jsonb_build_object(
        'code','CARD-IDENTITY-04',
        'message','Historical half-kneeling configuration, hand support, working-leg path, external load, rock direction, and terminal position remain unresolved; the variant is nonselectable and unscored.'
      ),
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','Five public YouTube candidates require current playback, oEmbed, exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','No current two-person card or publication approval exists.'
      ),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','Review-only progression, regression, and substitution relationships require human approval.'
      ),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','Difficulty proposals require independent human anchor review.'
      )
    ),
    TRUE,
    now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived'
  ON CONFLICT (definition_id)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    schema_version = EXCLUDED.schema_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
      AND variant.status = 'review'
      AND (
        (
          variant.difficulty_json ? 'technicalComplexity'
          AND variant.difficulty_json ? 'absoluteLoadDemand'
          AND (
            NOT (variant.difficulty_json ? 'baseOverallDifficulty')
            OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
              <> greatest(
                (variant.difficulty_json->>'technicalComplexity')::INTEGER,
                (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
              )
          )
        )
        OR (
          (variant.difficulty_json ? 'technicalComplexity')
            <> (variant.difficulty_json ? 'absoluteLoadDemand')
        )
        OR (
          NOT (variant.difficulty_json ? 'technicalComplexity')
          AND variant.difficulty_json->>'scoreDeferred' IS DISTINCT FROM 'true'
        )
        OR coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            variant.difficulty_json,
            variant.requirements_json,
            variant.load_profile_json,
            variant.fatigue_profile_json,
            variant.programming_profile_json
          )
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% produced an invalid/deferred difficulty state or prohibited level classification',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
      AND profile.status = 'review'
      AND coaching.exercise_json_has_level_classification(
        jsonb_build_array(
          profile.objective_relevance_json,
          profile.dosage_json,
          profile.logistics_json,
          profile.time_model_json,
          profile.dose_scaling_json,
          profile.measurement_json,
          profile.support_prompts_json
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% produced a prohibited level classification in a delivery profile',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
      AND (
        definition.card_version <> 2
        OR definition.status <> 'review'
        OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
        OR coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            definition.provenance_json,
            definition.environment_json,
            definition.population_json,
            definition.anatomy_json,
            definition.athlete_support_json,
            definition.coach_support_json,
            definition.support_operations_json
          )
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% did not leave the target at unapproved review card version 2 without proficiency metadata',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM adductor_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
  ) <> 5 THEN
    RAISE EXCEPTION '% did not create all 5 exact review variants', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM adductor_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.status = 'review'
  ) <> 5 THEN
    RAISE EXCEPTION '% did not create all 5 contextual or review-only profiles', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_section_evidence_v1 evidence
      ON evidence.definition_id = definition.id
     AND evidence.reviewed_card_version = definition.card_version
     AND evidence.review_status = 'candidate'
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 16 THEN
    RAISE EXCEPTION '% did not create all 16 candidate evidence rows', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
     AND media.review_status = 'candidate'
     AND media.link_status = 'unverified'
     AND media.embedding_allowed IS FALSE
     AND media.exact_variant_match IS NULL
     AND media.demonstration_quality_score IS NULL
     AND media.reviewer_user_id IS NULL
     AND media.reviewed_at IS NULL
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 5 THEN
    RAISE EXCEPTION '% did not create all 5 unverified, non-embeddable media candidates', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id = definition.id
     AND alternate.reviewed_card_version = definition.card_version
     AND alternate.review_status = 'candidate'
     AND alternate.reviewer_user_id IS NULL
     AND alternate.reviewed_at IS NULL
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 11 THEN
    RAISE EXCEPTION '% did not create all 11 candidate alternate assessments', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM adductor_relationship_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 from_variant
      ON from_variant.definition_id = definition.id
     AND from_variant.variant_key = seed.from_key
    JOIN coaching.exercise_variant_v1 to_variant
      ON to_variant.definition_id = definition.id
     AND to_variant.variant_key = seed.to_key
    JOIN coaching.exercise_relationship_v1 relationship
      ON relationship.from_variant_id = from_variant.id
     AND relationship.to_variant_id = to_variant.id
     AND relationship.relationship = seed.relationship
     AND relationship.review_status = 'review'
     AND relationship.reviewed_by IS NULL
     AND relationship.reviewed_at IS NULL
  ) <> 6 THEN
    RAISE EXCEPTION '% did not create all 6 review-only relationships', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM adductor_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_score_calibration_v1 calibration
      ON calibration.variant_id = variant.id
     AND calibration.status = 'review'
     AND calibration.reviewed_by IS NULL
     AND calibration.reviewed_at IS NULL
     AND calibration.dimension IN (
       'technicalComplexity',
       'absoluteLoadDemand'
     )
    WHERE seed.complexity IS NOT NULL
      AND seed.physical IS NOT NULL
  ) <> 6 THEN
    RAISE EXCEPTION '% did not create all 6 review-only calibration rows', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_card_test_packet_v1 packet
      ON packet.definition_id = definition.id
     AND packet.card_version = definition.card_version
     AND packet.status = 'quarantined'
     AND packet.human_review_required IS TRUE
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 1 THEN
    RAISE EXCEPTION '% did not create the quarantined card test packet', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.status = 'review'
     AND variant.requirements_json->>'selectable' = 'true'
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 3 OR (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.status = 'review'
     AND variant.requirements_json->>'selectable' = 'false'
     AND variant.requirements_json->>'identityQuarantine' = 'true'
     AND variant.difficulty_json->>'scoreDeferred' = 'true'
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
  ) <> 2 THEN
    RAISE EXCEPTION '% produced an invalid selectable or deferred identity boundary', migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
      AND (
        media.review_status <> 'candidate'
        OR media.link_status <> 'unverified'
        OR media.embedding_allowed IS DISTINCT FROM FALSE
        OR media.exact_variant_match IS NOT NULL
        OR media.demonstration_quality_score IS NOT NULL
        OR media.reviewer_user_id IS NOT NULL
        OR media.reviewed_at IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id = definition.id
     AND alternate.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug = 'adductor-rockback'
      AND (
        alternate.review_status <> 'candidate'
        OR alternate.reviewer_user_id IS NOT NULL
        OR alternate.reviewed_at IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM adductor_relationship_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 from_variant
      ON from_variant.definition_id = definition.id
     AND from_variant.variant_key = seed.from_key
    JOIN coaching.exercise_variant_v1 to_variant
      ON to_variant.definition_id = definition.id
     AND to_variant.variant_key = seed.to_key
    JOIN coaching.exercise_relationship_v1 relationship
      ON relationship.from_variant_id = from_variant.id
     AND relationship.to_variant_id = to_variant.id
     AND relationship.relationship = seed.relationship
    WHERE relationship.review_status <> 'review'
       OR relationship.reviewed_by IS NOT NULL
       OR relationship.reviewed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM adductor_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = 'adductor-rockback'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_score_calibration_v1 calibration
      ON calibration.variant_id = variant.id
    WHERE calibration.status <> 'review'
       OR calibration.reviewed_by IS NOT NULL
       OR calibration.reviewed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION '% created or retained an unsupported approval state', migration_key;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id)
  INTO source_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status = 'review';

  IF source_count <> 4 THEN
    RAISE EXCEPTION '% lost one or more of the 4 legacy source mappings', migration_key;
  END IF;

  SELECT count(*)
  INTO consolidated_count
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_identity_resolution_v1 resolution
    ON resolution.survivor_definition_id = survivor.id
   AND resolution.decision = 'duplicate_consolidated'
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = resolution.resolved_definition_id
   AND duplicate.status = 'archived'
  WHERE survivor.facility_id = 1
    AND survivor.slug = 'adductor-rockback'
    AND survivor.status = 'review'
    AND duplicate.slug = ANY(ARRAY[
      'adductor-rockback-with-reach',
      'adductor-rock-back-with-t-spine-reach',
      'half-kneeling-adductor-rockback'
    ]::TEXT[]);

  IF consolidated_count <> 3 THEN
    RAISE EXCEPTION '% lost one or more migration-308 consolidations', migration_key;
  END IF;
END
$$;
