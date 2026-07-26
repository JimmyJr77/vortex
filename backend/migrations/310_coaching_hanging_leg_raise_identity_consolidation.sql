-- Consolidate four historical hanging knee/leg-raise definitions into one
-- stable identity with explicit controlled variants:
--   * Hanging Leg Raise / bent-knee baseline (legacy 604)
--   * straight-leg lever variant (legacy 605)
--   * bent-knee eccentric-lower variant (legacy 778)
--   * archived exact tuck/bent-knee duplicate (legacy 819)
--
-- Knee angle, owned range, tempo, assistance, implement, and added resistance
-- are variant or delivery dimensions. Kipping/cyclic swinging, captain-chair
-- support, pull-up combinations, static L-sits, and hanging windshield wipers
-- remain separate identities.
--
-- Exercise cards receive exercise-complexity and physical-difficulty scores
-- only. Overall difficulty is their maximum. No athlete/class skill-level
-- field is authored here.
--
-- Any published or human-reviewed material fails closed. Candidate-only
-- evidence and media remain quarantined; this migration records no approval,
-- reviewer identity, exact media match, or external verification.
-- IDEMPOTENT.

DO $$
DECLARE
  survivor_id UUID;
  straight_definition_id UUID;
  eccentric_definition_id UUID;
  tuck_duplicate_id UUID;
  survivor_version INTEGER;
  straight_variant_id UUID;
  eccentric_variant_id UUID;
  tuck_variant_id UUID;
  protected_records INTEGER;
  active_duplicate_count INTEGER;
  expected_source_count INTEGER;
BEGIN
  SELECT id, card_version
  INTO survivor_id, survivor_version
  FROM coaching.exercise_definition_v1
  WHERE slug IN ('hanging-leg-raise', 'hanging-knee-raise')
    AND status <> 'archived'
  ORDER BY CASE WHEN slug = 'hanging-leg-raise' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id
  INTO straight_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'hanging-straight-leg-raise'
    AND status <> 'archived';

  SELECT id
  INTO eccentric_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'hanging-knee-raise-eccentric-lower'
    AND status <> 'archived';

  SELECT id
  INTO tuck_duplicate_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'tuck-hanging-knee-raise'
    AND status <> 'archived';

  IF survivor_id IS NULL THEN
    RAISE EXCEPTION
      'Hanging leg-raise identity migration requires an active Hanging Knee Raise seed or final Hanging Leg Raise definition';
  END IF;

  active_duplicate_count :=
    (straight_definition_id IS NOT NULL)::INTEGER
    + (eccentric_definition_id IS NOT NULL)::INTEGER
    + (tuck_duplicate_id IS NOT NULL)::INTEGER;

  IF active_duplicate_count NOT IN (0, 3) THEN
    RAISE EXCEPTION
      'Hanging leg-raise identity migration found a partial consolidation state: % active duplicates',
      active_duplicate_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug = 'hanging-leg-raise'
      AND id <> survivor_id
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Hanging leg-raise identity migration found a conflicting active final slug';
  END IF;

  IF active_duplicate_count = 3 THEN
    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
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
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = profile.variant_id
        WHERE variant.definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND profile.status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(ARRAY[
              survivor_id,
              straight_definition_id,
              eccentric_definition_id,
              tuck_duplicate_id
            ])
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(ARRAY[
              survivor_id,
              straight_definition_id,
              eccentric_definition_id,
              tuck_duplicate_id
            ])
          )
        )
          AND (
            relationship.review_status <> 'review'
            OR relationship.reviewed_by IS NOT NULL
            OR relationship.reviewed_at IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_calibration_v1 calibration
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = calibration.variant_id
        WHERE variant.definition_id = ANY(ARRAY[
          survivor_id,
          straight_definition_id,
          eccentric_definition_id,
          tuck_duplicate_id
        ])
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        'Hanging leg-raise identity consolidation requires human review: % protected records',
        protected_records;
    END IF;

    SELECT COUNT(*)
    INTO expected_source_count
    FROM coaching.exercise_definition_source_v1
    WHERE (
      definition_id = survivor_id
      AND legacy_exercise_id = 604
    )
    OR (
      definition_id = straight_definition_id
      AND legacy_exercise_id = 605
    )
    OR (
      definition_id = eccentric_definition_id
      AND legacy_exercise_id = 778
    )
    OR (
      definition_id = tuck_duplicate_id
      AND legacy_exercise_id = 819
    );

    IF expected_source_count <> 4 OR EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_source_v1
      WHERE definition_id = ANY(ARRAY[
        survivor_id,
        straight_definition_id,
        eccentric_definition_id,
        tuck_duplicate_id
      ])
        AND legacy_exercise_id NOT IN (604, 605, 778, 819)
    ) THEN
      RAISE EXCEPTION
        'Hanging leg-raise source lineage differs from the expected four-card cluster';
    END IF;

    SELECT id
    INTO straight_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = straight_definition_id
      AND variant_key = 'baseline';

    SELECT id
    INTO eccentric_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = eccentric_definition_id
      AND variant_key = 'baseline';

    SELECT id
    INTO tuck_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = tuck_duplicate_id
      AND variant_key = 'baseline';

    IF straight_variant_id IS NULL
      OR eccentric_variant_id IS NULL
      OR tuck_variant_id IS NULL
    THEN
      RAISE EXCEPTION
        'Hanging leg-raise identity migration requires all expected historical baseline variants';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE definition_id = survivor_id
        AND variant_key IN (
          'straight-leg',
          'bent-knee-eccentric-lower',
          'tuck-bent-knee-source-819'
        )
    ) THEN
      RAISE EXCEPTION
        'Hanging leg-raise identity migration conflicts with an existing final variant key';
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source
    )
    SELECT
      survivor.facility_id,
      survivor.id,
      duplicate.id,
      'duplicate_consolidated',
      'Hanging Straight-Leg Raise preserves the same bilateral suspended hip-flexion and trunk-control identity. Knee extension lengthens the lever and adds knee-extensor demand, so it is an explicit higher-difficulty variant rather than a separate stable exercise.',
      jsonb_build_object(
        'identityBoundary', 'knee_angle_and_lever_length',
        'targetVariantKey', 'straight-leg',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'publicationQuarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = straight_definition_id
    WHERE survivor.id = survivor_id
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source
    )
    SELECT
      survivor.facility_id,
      survivor.id,
      duplicate.id,
      'duplicate_consolidated',
      'Hanging Knee Raise Eccentric Lower is the bent-knee hanging leg raise with a declared slow lowering emphasis. Tempo and contraction emphasis materially change dose and fatigue, but not the stable exercise identity.',
      jsonb_build_object(
        'identityBoundary', 'eccentric_tempo_delivery',
        'targetVariantKey', 'bent-knee-eccentric-lower',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'publicationQuarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = eccentric_definition_id
    WHERE survivor.id = survivor_id
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source
    )
    SELECT
      survivor.facility_id,
      survivor.id,
      duplicate.id,
      'duplicate_consolidated',
      'Tuck Hanging Knee Raise and Hanging Knee Raise both describe a bilateral bent-knee raise from a still hang. The tuck wording adds no stable identity dimension, so the historical source is retained as an archived exact duplicate.',
      jsonb_build_object(
        'identityBoundary', 'exact_bent_knee_duplicate',
        'targetVariantKey', 'tuck-bent-knee-source-819',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'publicationQuarantined', TRUE
      ),
      'deterministic_exact_identity'
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = tuck_duplicate_id
    WHERE survivor.id = survivor_id
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', straight_definition_id,
          'resolution', 'lever_length_variant',
          'targetVariantKey', 'straight-leg'
        )
    WHERE definition_id = straight_definition_id;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', eccentric_definition_id,
          'resolution', 'eccentric_delivery_variant',
          'targetVariantKey', 'bent-knee-eccentric-lower'
        )
    WHERE definition_id = eccentric_definition_id;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', tuck_duplicate_id,
          'resolution', 'exact_bent_knee_duplicate',
          'targetVariantKey', 'tuck-bent-knee-source-819'
        )
    WHERE definition_id = tuck_duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = 'straight-leg',
        display_name = 'Hanging Straight-Leg Raise',
        modifier_keys = ARRAY[
          'straight_knees',
          'long_lever',
          'bilateral',
          'strict_no_swing'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'technicalComplexity', 48,
          'absoluteLoadDemand', 72,
          'coordinationDemand', 52,
          'baseOverallDifficulty', 72
        ),
        requirements_json = jsonb_build_object(
          'suspension', 'full_hang',
          'kneeAngle', 'extended',
          'leverLength', 'long',
          'laterality', 'bilateral',
          'swingMode', 'strict_none',
          'safeExitRequired', TRUE
        ),
        load_profile_json = jsonb_build_object(
          'loadingType', 'relative_bodyweight_dynamic_long_lever',
          'primaryStress', jsonb_build_array(
            'grip_isometric',
            'overhead_shoulder_position',
            'hip_flexion',
            'abdominal_pelvic_control',
            'knee_extension_isometric'
          ),
          'impactClass', 'none_except_uncontrolled_dismount'
        ),
        fatigue_profile_json = jsonb_build_object(
          'localFatigue', jsonb_build_array(
            'finger_and_forearm_fatigue',
            'hip_flexor_fatigue',
            'abdominal_and_trunk_stabilizer_fatigue',
            'quadriceps_isometric_fatigue'
          ),
          'qualityLoss', jsonb_build_array(
            'knees_bend_unintentionally',
            'pelvis_tips_forward_or_ribs_flare',
            'range_shrinks',
            'body_swings',
            'lowering_drops',
            'grip_slips'
          ),
          'recoveryDriver', 'grip_shoulder_hip_flexor_and_trunk_response_plus_total_hanging_and_pulling_volume'
        ),
        programming_profile_json = jsonb_build_object(
          'exerciseComplexity', 48,
          'physicalDifficulty', 72,
          'overallDifficulty', 72,
          'overallFormula', 'max_exercise_complexity_physical_difficulty'
        ),
        status = 'review',
        updated_at = now()
    WHERE id = straight_variant_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = 'bent-knee-eccentric-lower',
        display_name = 'Hanging Knee Raise — Eccentric Lower',
        modifier_keys = ARRAY[
          'bent_knees',
          'bilateral',
          'eccentric_emphasis',
          'strict_no_swing'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'technicalComplexity', 48,
          'absoluteLoadDemand', 58,
          'coordinationDemand', 50,
          'baseOverallDifficulty', 58
        ),
        requirements_json = jsonb_build_object(
          'suspension', 'full_hang',
          'kneeAngle', 'flexed',
          'laterality', 'bilateral',
          'contractionEmphasis', 'eccentric_lower',
          'loweringSeconds', jsonb_build_array(4, 6),
          'swingMode', 'strict_none',
          'assistedReturnAllowed', TRUE,
          'safeExitRequired', TRUE
        ),
        load_profile_json = jsonb_build_object(
          'loadingType', 'relative_bodyweight_eccentric_emphasis',
          'primaryStress', jsonb_build_array(
            'grip_isometric',
            'overhead_shoulder_position',
            'eccentric_hip_extension_control',
            'abdominal_pelvic_control'
          ),
          'impactClass', 'none_except_uncontrolled_dismount'
        ),
        fatigue_profile_json = jsonb_build_object(
          'localFatigue', jsonb_build_array(
            'finger_and_forearm_fatigue',
            'hip_flexor_fatigue',
            'abdominal_and_trunk_stabilizer_fatigue'
          ),
          'qualityLoss', jsonb_build_array(
            'tempo_accelerates',
            'last_third_drops',
            'pelvis_tips_forward_or_ribs_flare',
            'body_swings',
            'grip_slips'
          ),
          'recoveryDriver', 'eccentric_tolerance_plus_grip_shoulder_and_total_hanging_volume'
        ),
        programming_profile_json = jsonb_build_object(
          'exerciseComplexity', 48,
          'physicalDifficulty', 58,
          'overallDifficulty', 58,
          'overallFormula', 'max_exercise_complexity_physical_difficulty'
        ),
        status = 'review',
        updated_at = now()
    WHERE id = eccentric_variant_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = 'tuck-bent-knee-source-819',
        display_name = 'Tuck Hanging Knee Raise (Historical Duplicate)',
        modifier_keys = ARRAY[
          'historical_source_variant',
          'exact_bent_knee_duplicate'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'technicalComplexity', 42,
          'absoluteLoadDemand', 62,
          'coordinationDemand', 46,
          'baseOverallDifficulty', 62
        ),
        requirements_json = jsonb_build_object(
          'suspension', 'full_hang',
          'kneeAngle', 'flexed',
          'laterality', 'bilateral',
          'swingMode', 'strict_none',
          'identityDuplicate', TRUE
        ),
        load_profile_json = jsonb_build_object(
          'loadingType', 'relative_bodyweight_dynamic_bent_knee',
          'identityDuplicate', TRUE
        ),
        fatigue_profile_json = jsonb_build_object(
          'identityDuplicate', TRUE
        ),
        programming_profile_json = jsonb_build_object(
          'exerciseComplexity', 42,
          'physicalDifficulty', 62,
          'overallDifficulty', 62,
          'overallFormula', 'max_exercise_complexity_physical_difficulty',
          'identityDuplicate', TRUE
        ),
        status = 'archived',
        updated_at = now()
    WHERE id = tuck_variant_id;

    UPDATE coaching.exercise_delivery_profile_v1
    SET status = 'archived',
        equipment_required = ARRAY['rated_pull_up_bar_or_stable_rings']::TEXT[],
        updated_at = now()
    WHERE variant_id = tuck_variant_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'lever_length_variant',
          'canonicalSurvivorDefinitionId', survivor_id,
          'targetVariantKey', 'straight-leg',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = straight_definition_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'eccentric_delivery_variant',
          'canonicalSurvivorDefinitionId', survivor_id,
          'targetVariantKey', 'bent-knee-eccentric-lower',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = eccentric_definition_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'exact_bent_knee_duplicate',
          'canonicalSurvivorDefinitionId', survivor_id,
          'targetVariantKey', 'tuck-bent-knee-source-819',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = tuck_duplicate_id;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET slug = 'hanging-leg-raise',
      canonical_name = 'Hanging Leg Raise',
      display_name = 'Hanging Leg Raise',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          COALESCE(aliases, '{}')
          || ARRAY[
            'Hanging Leg Raises',
            'Hanging Knee Raise',
            'Hanging Knee Raises',
            'Tuck Hanging Knee Raise',
            'Tuck Hanging Knee Raises',
            'Hanging Straight-Leg Raise',
            'Hanging Straight-Leg Raises',
            'Hanging Straight Leg Raise',
            'Hanging Straight Leg Raises',
            'Hanging Knee Raise Eccentric Lower',
            'Hanging Knee Raise Eccentric Lowers'
          ]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) <> 'hanging leg raise'
        GROUP BY lower(alias)
        ORDER BY lower(alias)
      ),
      description = 'From a still two-hand hang on a secure bar or stable rings, raise both thighs by flexing the hips while controlling the pelvis and trunk, then lower without swinging. Declare knee angle, owned range, tempo, assistance, and implement for every dose.',
      family_key = 'Hanging hip flexion and trunk control',
      movement_patterns = ARRAY['hang', 'brace']::TEXT[],
      body_regions = ARRAY[
        'hand',
        'wrist',
        'elbow',
        'shoulder',
        'scapula',
        'core',
        'spine',
        'pelvis',
        'hip',
        'knee',
        'full_body'
      ]::TEXT[],
      required_equipment = ARRAY['bar_or_rings']::TEXT[],
      optional_equipment = ARRAY[
        'box',
        'bands',
        'mat',
        'straps_optional',
        'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'anchor', 'rated_stable_and_checked_before_use',
        'barHeight', 'allows_safe_mount_full_clearance_and_controlled_step_down',
        'surface', 'non_slip_with_landing_space',
        'traffic', 'no_person_or_equipment_crosses_the_swing_envelope',
        'supervision', 'direct_until_mount_hang_control_and_exit_are_repeatable'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'can_use_a_secure_grip_or_approved_grip_substitute',
          'can_tolerate_the_assigned_overhead_hang',
          'can_hold_or_receive_assistance_for_a_still_start',
          'can_flex_the_hips_without_uncontrolled_swing',
          'can_lower_and_exit_safely'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_elbow_wrist_hand_hip_or_low_back_pain',
          'numbness_or_tingling',
          'grip_slip_or_uncontrolled_swing',
          'painful_hip_pinching_or_cramping_that_changes_mechanics',
          'unsafe_mount_or_dismount'
        ),
        'clinicalBoundary', 'Symptoms, recent surgery, instability, neurologic signs, or a rehabilitation restriction require individualized clinician guidance rather than a generic card progression.'
      ),
      anatomy_json = jsonb_build_object(
        'jointActions', jsonb_build_array(
          'bilateral_hip_flexion_concentric_and_eccentric',
          'pelvic_position_control_with_optional_posterior_tilt_at_declared_end_range',
          'abdominal_wall_isometric_and_dynamic_trunk_control',
          'grip_isometric',
          'overhead_shoulder_position_held'
        ),
        'primaryMuscles', jsonb_build_array(
          'iliopsoas',
          'rectus_femoris_with_greater_contribution_when_knees_are_extended',
          'sartorius_and_other_hip_flexors',
          'rectus_abdominis',
          'internal_and_external_obliques',
          'finger_and_wrist_flexors'
        ),
        'secondaryMuscles', jsonb_build_array(
          'transversus_abdominis_and_deep_trunk_stabilizers',
          'latissimus_dorsi',
          'rotator_cuff_and_scapular_stabilizers',
          'quadriceps_for_knee_extension_isometric',
          'spinal_stabilizers'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_and_scapulothoracic_complex',
          'thoracic_and_lumbar_spine',
          'pelvis_and_sacroiliac_region',
          'hip',
          'knee'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_and_transverse_isometric_control'
        ),
        'laterality', 'bilateral_baseline'
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters', 'Builds controlled hip flexion, pelvic and trunk control, grip, and overhead hanging tolerance. It does not isolate a lower abdominal region and should not be chased through swing or grip failure.',
        'primaryCue', 'Start still, bring the thighs up, keep the ribs and pelvis controlled, and lower quietly.',
        'expectedSensations', jsonb_build_array(
          'working_hip_flexors',
          'abdominal_and_trunk_tension',
          'forearm_and_grip_effort',
          'controlled_overhead_shoulder_effort'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_or_increasing_pain',
          'front_of_hip_pinching',
          'low_back_pain',
          'numbness_or_tingling',
          'shoulder_instability',
          'grip_slipping',
          'dizziness'
        ),
        'painGuidance', 'Stop and step down for pain, pinching, numbness, tingling, instability, dizziness, or a slipping grip. Do not use momentum to move through symptoms.',
        'selfChecks', jsonb_build_array(
          'body_is_still_before_each_rep',
          'assigned_knee_angle_and_range_stay_consistent',
          'ribs_and_pelvis_do_not_tip_uncontrollably',
          'lowering_is_quiet_and_owned',
          'step_down_happens_with_grip_reserve'
        ),
        'accessibility', jsonb_build_array(
          'use_a_lower_bar_or_stable_foot_support',
          'reduce_range_or_repetitions',
          'use_bent_knees_before_straight_legs',
          'use_plain_language_and_a_visual_end_range_target',
          'substitute_supported_or_supine_hip_flexion_when_hanging_is_not_accessible'
        ),
        'mediaAlternatives', jsonb_build_array(
          'captioned_video',
          'front_and_side_still_sequence',
          'coach_demonstration',
          'plain_text_steps'
        )
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'anchor_mount_clearance_and_step_down',
          'secure_grip_and_tolerated_overhead_position',
          'still_start_without_kip',
          'declared_knee_angle_range_and_tempo',
          'pelvis_rib_and_lumbar_control',
          'controlled_lowering',
          'grip_reserve_and_safe_exit'
        ),
        'faultCorrections', jsonb_build_object(
          'swinging', 'Stop, let the body settle, reduce range or reps, and use foot assistance.',
          'ribs_or_pelvis_escape', 'Use a smaller range and cue the thighs up without chasing height.',
          'knees_bend_on_straight_variant', 'Return to the bent-knee variant or shorten the straight-leg range.',
          'lowering_drops', 'Reduce range, prescribe the eccentric variant with assistance, or end the set.',
          'grip_fails_first', 'Shorten sets, increase rest, use approved assistance, or choose a supported substitute.'
        ),
        'demonstrationPlan', 'Show the mount, still hang, bent-knee baseline, controlled lower, straight-leg lever difference, swing fault, early stop, and step-down from front and side.',
        'groupManagement', 'Use one athlete per clear hanging lane, stage boxes before the set, keep traffic outside the swing envelope, and rotate before grip fatigue delays turnover.',
        'modificationDecisionTree', jsonb_build_array(
          'If the athlete cannot mount or exit safely, use a lower bar, box, direct assistance, or supported substitute.',
          'If the hang is painful or unstable, do not prescribe this card.',
          'If grip or shoulder position fails before hip and trunk work, shorten the set or use a supported substitute.',
          'If swinging starts, reset fully; if it repeats, reduce range or end the set.',
          'Progress bent-knee range and control before straightening the knees or adding load.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'anchor_clearance_or_step_down_is_unsafe',
          'overhead_hang_is_painful_or_unstable',
          'grip_cannot_be_secured',
          'symptoms_or_rehabilitation_restrictions_are_unresolved',
          'fatigue_from_prior_hanging_or_pulling_prevents_a_still_controlled_rep'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch',
          'difficulty_or_dosage_question',
          'equipment_or_accessibility_problem',
          'pain_or_adverse_response',
          'media_mismatch_or_broken_embed',
          'substitution_request'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent', 'Stop exercise and follow facility emergency policy for acute injury, neurologic symptoms, fainting, or an unsafe fall.',
          'clinical', 'Refer symptom, postoperative, instability, or rehabilitation questions to an appropriately qualified clinician.',
          'content', 'Route identity, scoring, dosage, or media disputes to canonical card review; support staff must not approve content.'
        ),
        'retentionPolicy', 'Retain source lineage, candidate evidence, media review history, adverse-response reports, and superseded variants according to canonical governance policy.',
        'changeImpactPolicy', 'Identity, knee-angle variant, difficulty, stop-rule, dosage, substitution, or media changes require a new card review and regenerated test packet before publication.'
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identityResolution', 'hanging_knee_leg_raise_variant_consolidation',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = survivor_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Hanging Knee Raise',
      modifier_keys = ARRAY[
        'bent_knees',
        'bilateral',
        'strict_no_swing'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 42,
        'absoluteLoadDemand', 62,
        'coordinationDemand', 46,
        'supervisionDemand', 55,
        'failureConsequence', 58,
        'impact', 1,
        'workCapacityDemand', 64,
        'baseOverallDifficulty', 62
      ),
      requirements_json = jsonb_build_object(
        'suspension', 'full_hang',
        'kneeAngle', 'flexed',
        'laterality', 'bilateral',
        'swingMode', 'strict_none',
        'range', 'declared_and_owned',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_bent_knee',
        'gripDemand', 65,
        'spinalLoading', 35,
        'eccentricStress', 55,
        'landingContactsPerRep', 0,
        'externalLoadMethod', 'relative_bodyweight',
        'primaryStress', jsonb_build_array(
          'grip_isometric',
          'overhead_shoulder_position',
          'hip_flexion',
          'abdominal_pelvic_control'
        ),
        'impactClass', 'none_except_uncontrolled_dismount'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localMuscleFatigue', 65,
        'gripFatigue', 65,
        'technicalFatigueSensitivity', 60,
        'impactAccumulation', 1,
        'recoveryHours', 24,
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue',
          'hip_flexor_fatigue',
          'abdominal_and_trunk_stabilizer_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'body_swings',
          'pelvis_tips_forward_or_ribs_flare',
          'range_shrinks',
          'lowering_drops',
          'grip_slips',
          'shoulder_position_changes'
        ),
        'recoveryDriver', 'grip_shoulder_hip_flexor_and_trunk_response_plus_total_hanging_and_pulling_volume'
      ),
      programming_profile_json = jsonb_build_object(
        'exerciseComplexity', 42,
        'physicalDifficulty', 62,
        'overallDifficulty', 62,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'hanging_hip_flexion_strength',
          'pelvic_and_trunk_control',
          'grip_capacity',
          'overhead_hanging_tolerance'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 6,
          'typicalReps', 18,
          'maximumUsefulReps', 36
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1,
          'typical', 2,
          'maximum', 3,
          'minimumRecoveryHours', 24
        ),
        'prerequisites', jsonb_build_array(
          'secure_grip_or_approved_substitute',
          'tolerated_overhead_hang',
          'safe_mount_and_exit',
          'still_start_with_owned_bent_knee_range'
        ),
        'completionCriteria', jsonb_build_array(
          'three_sets_of_eight_strict_repetitions_with_consistent_range',
          'no_swing_pain_grip_slip_or_uncontrolled_lowering'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array(
            'general_warm_up',
            'overhead_and_grip_readiness'
          ),
          'preferredBefore', jsonb_build_array(
            'high_fatigue_grip_or_pulling_work'
          ),
          'avoidAfter', jsonb_build_array(
            'exhaustive_hanging',
            'grip_failure',
            'painful_overhead_loading'
          )
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array(
            'lower_body_strength',
            'low_demand_mobility'
          ),
          'acceptable', jsonb_build_array(
            'low_grip_lower_body_capacity'
          ),
          'incompatible', jsonb_build_array(
            'max_effort_grip',
            'high_volume_vertical_pull',
            'high_consequence_bar_skill'
          )
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object(
            'stimulus', 'pulling_or_climbing_priority',
            'action', 'place_after_priority_or_reduce_volume'
          ),
          jsonb_build_object(
            'stimulus', 'hip_flexor_or_trunk_fatigue',
            'action', 'reduce_range_reps_or_omit'
          )
        ),
        'uncertaintyPolicy', 'Exclude when anchor, clearance, grip, overhead tolerance, current symptoms, fatigue state, or safe exit is unknown.'
      ),
      status = 'review',
      updated_at = now()
  WHERE definition_id = survivor_id
    AND variant_key = 'baseline';

  SELECT id
  INTO straight_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id = survivor_id
    AND variant_key = 'straight-leg';

  SELECT id
  INTO eccentric_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id = survivor_id
    AND variant_key = 'bent-knee-eccentric-lower';

  IF straight_variant_id IS NULL OR eccentric_variant_id IS NULL THEN
    RAISE EXCEPTION
      'Hanging leg-raise identity migration could not resolve final straight-leg and eccentric variants';
  END IF;

  -- Re-author the selectable variants outside the first-run consolidation
  -- branch so a changed candidate schema can be rehearsed idempotently.
  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Hanging Straight-Leg Raise',
      modifier_keys = ARRAY[
        'straight_knees',
        'long_lever',
        'bilateral',
        'strict_no_swing'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 48,
        'absoluteLoadDemand', 72,
        'coordinationDemand', 52,
        'supervisionDemand', 60,
        'failureConsequence', 65,
        'impact', 1,
        'workCapacityDemand', 70,
        'baseOverallDifficulty', 72
      ),
      requirements_json = jsonb_build_object(
        'suspension', 'full_hang',
        'kneeAngle', 'extended',
        'leverLength', 'long',
        'laterality', 'bilateral',
        'swingMode', 'strict_none',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_long_lever',
        'gripDemand', 68,
        'spinalLoading', 42,
        'eccentricStress', 65,
        'landingContactsPerRep', 0,
        'externalLoadMethod', 'relative_bodyweight',
        'primaryStress', jsonb_build_array(
          'grip_isometric',
          'overhead_shoulder_position',
          'hip_flexion',
          'abdominal_pelvic_control',
          'knee_extension_isometric'
        ),
        'impactClass', 'none_except_uncontrolled_dismount'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localMuscleFatigue', 75,
        'gripFatigue', 68,
        'technicalFatigueSensitivity', 72,
        'impactAccumulation', 1,
        'recoveryHours', 36,
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue',
          'hip_flexor_fatigue',
          'abdominal_and_trunk_stabilizer_fatigue',
          'quadriceps_isometric_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'knees_bend_unintentionally',
          'pelvis_tips_forward_or_ribs_flare',
          'range_shrinks',
          'body_swings',
          'lowering_drops',
          'grip_slips'
        ),
        'recoveryDriver', 'grip_shoulder_hip_flexor_quadriceps_and_trunk_response_plus_total_hanging_and_pulling_volume'
      ),
      programming_profile_json = jsonb_build_object(
        'exerciseComplexity', 48,
        'physicalDifficulty', 72,
        'overallDifficulty', 72,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'long_lever_hanging_hip_flexion_strength',
          'pelvic_and_trunk_control',
          'knee_extension_isometric',
          'grip_and_overhead_hanging_capacity'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 4,
          'typicalReps', 12,
          'maximumUsefulReps', 24
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1,
          'typical', 2,
          'maximum', 3,
          'minimumRecoveryHours', 36
        ),
        'prerequisites', jsonb_build_array(
          'secure_grip_and_tolerated_overhead_hang',
          'safe_mount_and_exit',
          'repeatable_strict_bent_knee_raise',
          'owned_straight_knee_range_without_swing'
        ),
        'completionCriteria', jsonb_build_array(
          'three_sets_of_six_with_declared_straight_knee_range',
          'no_unplanned_knee_bend_swing_pain_or_dropped_lowering'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array(
            'general_warm_up',
            'bent_knee_pattern_rehearsal'
          ),
          'preferredBefore', jsonb_build_array(
            'high_fatigue_grip_or_pulling_work'
          ),
          'avoidAfter', jsonb_build_array(
            'exhaustive_hanging',
            'high_volume_hip_flexion',
            'grip_failure'
          )
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array(
            'lower_body_strength',
            'low_demand_mobility'
          ),
          'acceptable', jsonb_build_array(
            'low_grip_lower_body_capacity'
          ),
          'incompatible', jsonb_build_array(
            'high_volume_vertical_pull',
            'max_effort_grip',
            'high_consequence_bar_skill',
            'high_volume_hip_flexion'
          )
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object(
            'stimulus', 'bent_knee_quality_not_established',
            'action', 'use_baseline_variant'
          ),
          jsonb_build_object(
            'stimulus', 'hamstring_length_or_knee_extension_limits_range',
            'action', 'shorten_range_or_use_bent_knee_variant'
          )
        ),
        'uncertaintyPolicy', 'Exclude when bent-knee readiness, straight-knee range, anchor, clearance, grip, overhead tolerance, fatigue state, or safe exit is unknown.'
      ),
      status = 'review',
      updated_at = now()
  WHERE id = straight_variant_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Hanging Knee Raise — Eccentric Lower',
      modifier_keys = ARRAY[
        'bent_knees',
        'bilateral',
        'eccentric_emphasis',
        'strict_no_swing'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 48,
        'absoluteLoadDemand', 58,
        'coordinationDemand', 50,
        'supervisionDemand', 58,
        'failureConsequence', 58,
        'impact', 1,
        'workCapacityDemand', 55,
        'baseOverallDifficulty', 58
      ),
      requirements_json = jsonb_build_object(
        'suspension', 'full_hang',
        'kneeAngle', 'flexed',
        'laterality', 'bilateral',
        'contractionEmphasis', 'eccentric_lower',
        'loweringSeconds', jsonb_build_array(4, 6),
        'swingMode', 'strict_none',
        'assistedReturnAllowed', TRUE,
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_eccentric_emphasis',
        'gripDemand', 65,
        'spinalLoading', 35,
        'eccentricStress', 82,
        'landingContactsPerRep', 0,
        'externalLoadMethod', 'relative_bodyweight_with_assisted_return_allowed',
        'primaryStress', jsonb_build_array(
          'grip_isometric',
          'overhead_shoulder_position',
          'eccentric_hip_extension_control',
          'abdominal_pelvic_control'
        ),
        'impactClass', 'none_except_uncontrolled_dismount'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localMuscleFatigue', 70,
        'gripFatigue', 65,
        'technicalFatigueSensitivity', 75,
        'impactAccumulation', 1,
        'recoveryHours', 36,
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue',
          'hip_flexor_fatigue',
          'abdominal_and_trunk_stabilizer_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'tempo_accelerates',
          'last_third_drops',
          'pelvis_tips_forward_or_ribs_flare',
          'body_swings',
          'grip_slips'
        ),
        'recoveryDriver', 'eccentric_tolerance_plus_grip_shoulder_hip_flexor_trunk_and_total_hanging_volume'
      ),
      programming_profile_json = jsonb_build_object(
        'exerciseComplexity', 48,
        'physicalDifficulty', 58,
        'overallDifficulty', 58,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'eccentric_hip_flexion_control',
          'pelvic_and_trunk_control',
          'grip_and_overhead_hanging_capacity'
        ),
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveReps', 3,
          'typicalReps', 9,
          'maximumUsefulReps', 18,
          'loweringSeconds', jsonb_build_array(4, 6)
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1,
          'typical', 2,
          'maximum', 2,
          'minimumRecoveryHours', 36
        ),
        'prerequisites', jsonb_build_array(
          'secure_grip_and_tolerated_overhead_hang',
          'safe_assisted_or_self_raise_to_start',
          'pain_free_owned_bent_knee_range',
          'normal_recovery_from_baseline_variant'
        ),
        'completionCriteria', jsonb_build_array(
          'three_sets_of_five_with_four_to_six_second_lowers',
          'no_last_third_drop_swing_pain_or_abnormal_next_day_response'
        ),
        'sequenceRules', jsonb_build_object(
          'preferredAfter', jsonb_build_array(
            'general_warm_up',
            'baseline_pattern_rehearsal'
          ),
          'preferredBefore', jsonb_build_array(
            'high_fatigue_grip_or_hip_flexion_work'
          ),
          'avoidAfter', jsonb_build_array(
            'high_volume_eccentric_work',
            'exhaustive_hanging',
            'grip_failure'
          )
        ),
        'pairingCompatibility', jsonb_build_object(
          'recommended', jsonb_build_array(
            'low_eccentric_lower_body_strength',
            'low_demand_mobility'
          ),
          'acceptable', jsonb_build_array(
            'low_grip_technical_rehearsal'
          ),
          'incompatible', jsonb_build_array(
            'high_volume_eccentric_hip_flexion',
            'high_volume_vertical_pull',
            'max_effort_grip'
          )
        ),
        'interferenceRules', jsonb_build_array(
          jsonb_build_object(
            'stimulus', 'recent_eccentric_soreness_or_abnormal_recovery',
            'action', 'reduce_dose_or_omit'
          ),
          jsonb_build_object(
            'stimulus', 'start_position_requires_unsafe_assistance',
            'action', 'use_supported_or_supine_substitute'
          )
        ),
        'uncertaintyPolicy', 'Exclude when start assistance, lowering capacity, recovery response, anchor, clearance, grip, overhead tolerance, symptoms, or safe exit is unknown.'
      ),
      status = 'review',
      updated_at = now()
  WHERE id = eccentric_variant_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key = 'capacity-bent-knee-strength',
      phase_key = 'capacity',
      role = 'primary',
      purpose = 'Strict bent-knee hanging hip-flexion and trunk-control strength with enough grip and position reserve to prevent swinging.',
      phase_suitability = 82,
      methodology_alignment = 78,
      objective_relevance_json = jsonb_build_object(
        'relative_strength', 88,
        'trunk_control', 88,
        'grip_capacity', 70,
        'conditioning', 25
      ),
      dosage_json = jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'reps', jsonb_build_array(4, 10),
        'restSeconds', jsonb_build_array(75, 150),
        'rpeCeiling', 8,
        'tempo', '1-1-2_to_2-1-3',
        'range', 'highest_repeatable_range_without_swing'
      ),
      quality_gate = 'Every repetition starts still, uses the declared bent-knee range, keeps grip and overhead position secure, controls ribs and pelvis, and lowers without dropping.',
      stop_rules = ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'Grip opens or slips, or the athlete cannot step down safely.',
        'Swing, kip, or bounce is needed to raise the knees.',
        'Pelvis, ribs, or low back can no longer be controlled.',
        'The lowering phase drops or the assigned range changes for two repetitions.'
      ]::TEXT[],
      coach_instructions = 'Count only strict repetitions from a settled hang. Choose range and volume so hip and trunk work occur before grip, shoulder position, or swing becomes the limiter.',
      athlete_instructions = 'Start still. Bring your thighs up with your knees bent, keep your ribs and pelvis controlled, lower quietly, and step down before your grip slips.',
      expected_adaptation = 'Improved strict hanging hip-flexion strength, anterior trunk and pelvic control, grip capacity, and overhead position tolerance.',
      equipment_required = ARRAY['bar_or_rings']::TEXT[],
      logistics_json = jsonb_build_object(
        'lane', 'one_athlete_per_clear_hanging_lane',
        'mount', 'box_or_direct_assistance_staged_before_set',
        'transitionSeconds', 20,
        'setupSeconds', 20
      ),
      time_model_json = jsonb_build_object(
        'secondsPerRep', 4,
        'minimumSetSeconds', 20,
        'maximumSetSeconds', 50
      ),
      dose_scaling_json = jsonb_build_object(
        'regress', jsonb_build_array(
          'reduce_range',
          'stable_foot_assistance',
          'supported_knee_raise',
          'supine_bent_knee_raise'
        ),
        'progress', jsonb_build_array(
          'increase_owned_range',
          'add_pause',
          'straight_leg_variant',
          'external_load_only_after_review'
        )
      ),
      measurement_json = jsonb_build_object(
        'record', jsonb_build_array(
          'implement',
          'grip',
          'knee_angle',
          'range_landmark',
          'sets',
          'clean_reps',
          'tempo',
          'rest',
          'swing_events',
          'grip_and_symptom_response'
        )
      ),
      support_prompts_json = jsonb_build_object(
        'athlete', 'Could every rep start still and lower quietly?',
        'coach', 'Did grip, shoulder position, pelvis, range, or tempo become the first limiter?'
      ),
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id = variant.id
    AND variant.definition_id = survivor_id
    AND variant.variant_key = 'baseline'
    AND profile.profile_key IN ('legacy-capacity', 'capacity-bent-knee-strength');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key = 'capacity-straight-leg-strength',
      phase_key = 'capacity',
      role = 'conditional',
      purpose = 'Long-lever strict hanging leg raise for athletes who can preserve straight knees, pelvic and trunk control, grip, and a still body.',
      phase_suitability = 76,
      methodology_alignment = 82,
      objective_relevance_json = jsonb_build_object(
        'relative_strength', 92,
        'trunk_control', 90,
        'hip_flexion_strength', 92,
        'conditioning', 18
      ),
      dosage_json = jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'reps', jsonb_build_array(3, 8),
        'restSeconds', jsonb_build_array(90, 180),
        'rpeCeiling', 8,
        'tempo', '1-1-3',
        'range', 'declared_owned_range_with_knees_extended'
      ),
      quality_gate = 'Knees remain extended by intent, the body begins still, range is repeatable, ribs and pelvis stay controlled, and the lowering phase does not drop.',
      stop_rules = ARRAY[
        'Any general hanging leg-raise stop rule occurs.',
        'Knees bend unintentionally or quadriceps cramp changes the pattern.',
        'The athlete chases height by swinging, leaning, or losing pelvic control.',
        'The long lever cannot be lowered under control.'
      ]::TEXT[],
      coach_instructions = 'Use only after strict bent-knee repetitions are repeatable. Score the longer lever as higher physical difficulty, not as an athlete level. Reduce range or return to bent knees before form changes.',
      athlete_instructions = 'Keep your knees long, lift only as high as you can own, keep your body still, and lower slowly.',
      expected_adaptation = 'Improved long-lever hip-flexion strength, knee-extension isometric endurance, trunk and pelvic control, grip, and hanging tolerance.',
      equipment_required = ARRAY['bar_or_rings']::TEXT[],
      logistics_json = jsonb_build_object(
        'lane', 'one_athlete_per_clear_hanging_lane',
        'mount', 'box_or_direct_assistance_staged_before_set',
        'transitionSeconds', 25,
        'setupSeconds', 20
      ),
      time_model_json = jsonb_build_object(
        'secondsPerRep', 5,
        'minimumSetSeconds', 18,
        'maximumSetSeconds', 45
      ),
      dose_scaling_json = jsonb_build_object(
        'regress', jsonb_build_array(
          'shorten_straight_leg_range',
          'bent_knee_baseline',
          'supported_leg_raise'
        ),
        'progress', jsonb_build_array(
          'increase_owned_range',
          'add_pause',
          'slower_lower',
          'external_load_only_after_review'
        )
      ),
      measurement_json = jsonb_build_object(
        'record', jsonb_build_array(
          'implement',
          'grip',
          'knee_extension_quality',
          'range_landmark',
          'sets',
          'clean_reps',
          'tempo',
          'rest',
          'swing_events',
          'symptom_response'
        )
      ),
      support_prompts_json = jsonb_build_object(
        'athlete', 'Could you keep your knees long and lower without swinging?',
        'coach', 'Was knee angle, grip, trunk position, range, or tempo the first limiter?'
      ),
      status = 'review',
      updated_at = now()
  WHERE profile.variant_id = straight_variant_id
    AND profile.profile_key IN ('legacy-capacity', 'capacity-straight-leg-strength');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key = 'resilience-eccentric-lower',
      phase_key = 'resilience',
      role = 'conditional',
      purpose = 'Assisted or self-raised bent-knee start followed by a deliberate pain-free eccentric lower for hanging hip-flexion and trunk-control capacity.',
      phase_suitability = 80,
      methodology_alignment = 86,
      objective_relevance_json = jsonb_build_object(
        'eccentric_control', 94,
        'tissue_capacity', 82,
        'trunk_control', 88,
        'conditioning', 10
      ),
      dosage_json = jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'reps', jsonb_build_array(3, 6),
        'loweringSeconds', jsonb_build_array(4, 6),
        'restSeconds', jsonb_build_array(90, 180),
        'rpeCeiling', 7,
        'return', 'assisted_or_controlled_reset_as_declared'
      ),
      quality_gate = 'Each repetition begins from the same owned position and maintains the prescribed 4–6 second lower without swing, pelvic escape, breath distress, pain, or a dropped final third.',
      stop_rules = ARRAY[
        'Any general hanging leg-raise stop rule occurs.',
        'The prescribed lowering time cannot be maintained.',
        'The last third drops or swing becomes the braking strategy.',
        'Pain, hip pinching, unusual cramping, or next-day flare-up changes the plan.'
      ]::TEXT[],
      coach_instructions = 'Provide a safe route to the start position, time the full lower, cap total eccentric volume, and count this with other hip-flexor, trunk, grip, and hanging work.',
      athlete_instructions = 'Start from the position you can own, lower for the full count, stay still, breathe, and stop before pain or collapse.',
      expected_adaptation = 'Improved controlled eccentric tolerance through the assigned hanging hip-flexion range without using momentum or fatigue circuits.',
      equipment_required = ARRAY['bar_or_rings']::TEXT[],
      logistics_json = jsonb_build_object(
        'lane', 'one_athlete_per_clear_hanging_lane',
        'startAssistance', 'box_coach_or_self_raise_declared_before_set',
        'transitionSeconds', 30,
        'setupSeconds', 25
      ),
      time_model_json = jsonb_build_object(
        'secondsPerRep', 7,
        'minimumSetSeconds', 25,
        'maximumSetSeconds', 50
      ),
      dose_scaling_json = jsonb_build_object(
        'regress', jsonb_build_array(
          'shorten_range',
          'increase_start_assistance',
          'reduce_lowering_time_to_owned_minimum',
          'supported_or_supine_eccentric'
        ),
        'progress', jsonb_build_array(
          'complete_full_owned_range',
          'increase_to_six_second_lower',
          'add_repetition_within_cap',
          'straight_leg_eccentric_only_after_review'
        )
      ),
      measurement_json = jsonb_build_object(
        'record', jsonb_build_array(
          'start_assistance',
          'range_landmark',
          'lowering_seconds_each_rep',
          'sets',
          'clean_reps',
          'rest',
          'swing_events',
          'same_day_and_next_day_response'
        )
      ),
      support_prompts_json = jsonb_build_object(
        'athlete', 'Could you control the last third and recover normally by the next day?',
        'coach', 'Was tempo maintained, and did symptoms or recovery require a smaller next dose?'
      ),
      status = 'review',
      updated_at = now()
  WHERE profile.variant_id = eccentric_variant_id
    AND profile.profile_key IN ('legacy-resilience', 'resilience-eccentric-lower');

  UPDATE coaching.exercise_score_v1
  SET technical_complexity = CASE exercise_id
        WHEN 604 THEN 42
        WHEN 605 THEN 48
        WHEN 778 THEN 48
        WHEN 819 THEN 42
      END,
      absolute_load_demand = CASE exercise_id
        WHEN 604 THEN 62
        WHEN 605 THEN 72
        WHEN 778 THEN 58
        WHEN 819 THEN 62
      END,
      coordination_demand = CASE exercise_id
        WHEN 604 THEN 46
        WHEN 605 THEN 52
        WHEN 778 THEN 50
        WHEN 819 THEN 46
      END,
      impact = 1,
      supervision_demand = 55,
      base_overall_difficulty = CASE exercise_id
        WHEN 604 THEN 62
        WHEN 605 THEN 72
        WHEN 778 THEN 58
        WHEN 819 THEN 62
      END,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = 'Candidate score from hanging leg-raise identity audit. Complexity and physical difficulty are separate; overall is their maximum. Human calibration review remains required.',
      updated_at = now()
  WHERE exercise_id IN (604, 605, 778, 819);

  UPDATE coaching.exercise_difficulty_profile
  SET technical = CASE exercise_id
        WHEN 604 THEN 4
        WHEN 605 THEN 5
        WHEN 778 THEN 5
        WHEN 819 THEN 4
      END,
      complexity = CASE exercise_id
        WHEN 604 THEN 4
        WHEN 605 THEN 5
        WHEN 778 THEN 5
        WHEN 819 THEN 4
      END,
      load = CASE exercise_id
        WHEN 604 THEN 6
        WHEN 605 THEN 7
        WHEN 778 THEN 6
        WHEN 819 THEN 6
      END,
      overall = CASE exercise_id
        WHEN 604 THEN 6
        WHEN 605 THEN 7
        WHEN 778 THEN 6
        WHEN 819 THEN 6
      END,
      recommended_age_min = CASE exercise_id
        WHEN 605 THEN 12
        ELSE 10
      END,
      attention_demand = 'moderate',
      notes = 'Canonical hanging leg-raise identity audit: exercise complexity and physical difficulty only; overall equals their maximum.',
      source = 'canonical_identity_audit',
      updated_at = now()
  WHERE exercise_id IN (604, 605, 778, 819);

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET status = 'quarantined',
      blocking_issues_json = CASE
        WHEN packet.blocking_issues_json @> '[{
          "code": "hanging_leg_raise_identity_research_and_media_review_required"
        }]'::JSONB
          THEN packet.blocking_issues_json
        ELSE packet.blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'hanging_leg_raise_identity_research_and_media_review_required',
            'message', 'Complete section, alternate, score-calibration, exact-variant media, accessibility, and human card review for the consolidated Hanging Leg Raise and its bent-knee, straight-leg, and eccentric variants.'
          )
        )
      END,
      human_review_required = TRUE,
      checked_at = now()
  WHERE packet.definition_id = survivor_id;
END;
$$;
