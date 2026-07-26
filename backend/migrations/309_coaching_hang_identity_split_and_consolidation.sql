-- Resolve the straight-arm hanging collision cluster into three exercise
-- identities:
--   1. Dead Hang: passive shoulder-girdle position, straight elbows.
--   2. Active Hang: isometric scapular engagement, straight elbows.
--   3. Scapular Pull-Up: repeated active/passive scapular motion, straight elbows.
--
-- "Active Hang Scapular Hold" is an exact Active Hang duplicate. The historical
-- "Dead Hang / Active Hang" card improperly combines two identities: its
-- ambiguous source remains archived and identity-quarantined, while the exact
-- "Active Dead Hang" source is retained under Active Hang. "Dead Hang Breathing
-- Reset" becomes a contextual restore delivery profile on the general Dead Hang
-- card rather than a separate exercise identity.
--
-- Exercise cards receive only exercise-complexity and physical-difficulty
-- scores. Athlete/class skill levels remain exclusive to skill-library cards.
--
-- Any published or human-reviewed content fails closed. Candidate-only records
-- may be retained or moved when identity is unambiguous; no approval, exact
-- media match, or external review is fabricated.
-- IDEMPOTENT.

DO $$
DECLARE
  active_id UUID;
  active_duplicate_id UUID;
  compound_id UUID;
  dead_id UUID;
  scapular_pull_id UUID;
  active_version INTEGER;
  dead_version INTEGER;
  protected_records INTEGER;
  source_count INTEGER;
  active_duplicate_variant_id UUID;
  compound_active_variant_id UUID;
  compound_ambiguous_variant_id UUID;
BEGIN
  SELECT id, card_version
  INTO active_id, active_version
  FROM coaching.exercise_definition_v1
  WHERE slug = 'active-hang'
    AND status <> 'archived';

  SELECT id
  INTO active_duplicate_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'active-hang-scapular-hold'
    AND status <> 'archived';

  SELECT id
  INTO compound_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'dead-hang-active-hang'
    AND status <> 'archived';

  SELECT id, card_version
  INTO dead_id, dead_version
  FROM coaching.exercise_definition_v1
  WHERE slug IN ('dead-hang', 'dead-hang-breathing-reset-restore')
    AND status <> 'archived'
  ORDER BY CASE WHEN slug = 'dead-hang' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id
  INTO scapular_pull_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'scapular-pull-up'
    AND status <> 'archived';

  IF active_id IS NULL OR dead_id IS NULL OR scapular_pull_id IS NULL THEN
    RAISE EXCEPTION
      'Hang identity migration requires active Active Hang, Dead Hang seed, and Scapular Pull-Up definitions';
  END IF;

  IF (active_duplicate_id IS NULL) <> (compound_id IS NULL) THEN
    RAISE EXCEPTION
      'Hang identity migration found a partial consolidation state';
  END IF;

  IF active_duplicate_id IS NOT NULL AND compound_id IS NOT NULL THEN
    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
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
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
        ])
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = profile.variant_id
        WHERE variant.definition_id = ANY(ARRAY[
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
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
              active_id,
              active_duplicate_id,
              compound_id,
              dead_id,
              scapular_pull_id
            ])
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(ARRAY[
              active_id,
              active_duplicate_id,
              compound_id,
              dead_id,
              scapular_pull_id
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
          active_id,
          active_duplicate_id,
          compound_id,
          dead_id,
          scapular_pull_id
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
        'Hang identity split and consolidation requires human review: % protected records',
        protected_records;
    END IF;

    SELECT COUNT(*)
    INTO source_count
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = compound_id
      AND legacy_exercise_id IN (201, 1074);

    IF source_count <> 2 OR EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_source_v1
      WHERE definition_id = compound_id
        AND legacy_exercise_id NOT IN (201, 1074)
    ) THEN
      RAISE EXCEPTION
        'Historical Dead Hang / Active Hang source split requires human review';
    END IF;

    SELECT id
    INTO active_duplicate_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = active_duplicate_id
      AND variant_key = 'baseline';

    SELECT id
    INTO compound_active_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = compound_id
      AND variant_key = 'baseline-source-1074';

    SELECT id
    INTO compound_ambiguous_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = compound_id
      AND variant_key = 'baseline';

    IF active_duplicate_variant_id IS NULL
      OR compound_active_variant_id IS NULL
      OR compound_ambiguous_variant_id IS NULL
    THEN
      RAISE EXCEPTION
        'Hang identity migration requires all three expected historical source variants';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE (
        definition_id = active_id
        AND variant_key IN (
          'active-hang-scapular-hold-source-857',
          'active-dead-hang-source-1074'
        )
      )
      OR (
        definition_id = dead_id
        AND variant_key = 'passive-or-active-source-201'
      )
    ) THEN
      RAISE EXCEPTION
        'Hang identity migration conflicts with an existing source variant key';
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
      'Active Hang Scapular Hold defines the same straight-elbow, actively depressed scapular isometric as Active Hang. Hold duration and delivery intent do not create another exercise identity.',
      jsonb_build_object(
        'match', 'exact_active_hang_identity',
        'survivor_slug', survivor.slug,
        'resolved_slug', duplicate.slug,
        'source_variant_key', 'active-hang-scapular-hold-source-857',
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'publication_quarantined', TRUE
      ),
      'deterministic_exact_identity'
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = active_duplicate_id
    WHERE survivor.id = active_id
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    -- Preserve unambiguous source lineage while making the combined source
    -- deliberately non-selectable.
    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = active_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolved_from_definition_id', active_duplicate_id,
          'resolution', 'exact_active_hang_identity',
          'target_variant_key', 'active-hang-scapular-hold-source-857'
        )
    WHERE definition_id = active_duplicate_id;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = active_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolved_from_definition_id', compound_id,
          'resolution', 'compound_identity_split',
          'resolved_identity', 'active_hang',
          'target_variant_key', 'active-dead-hang-source-1074'
        )
    WHERE definition_id = compound_id
      AND legacy_exercise_id = 1074;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = dead_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolved_from_definition_id', compound_id,
          'resolution', 'compound_identity_split',
          'resolved_identity', 'passive_hang_with_active_mode_unresolved',
          'target_variant_key', 'passive-or-active-source-201',
          'identity_quarantine', TRUE
        )
    WHERE definition_id = compound_id
      AND legacy_exercise_id = 201;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = active_id,
        variant_key = 'active-hang-scapular-hold-source-857',
        modifier_keys = ARRAY[
          'historical_source_variant',
          'exact_identity_duplicate'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'technicalComplexity', 28,
          'absoluteLoadDemand', 58,
          'coordinationDemand', 30,
          'baseOverallDifficulty', 58
        ),
        requirements_json = requirements_json || jsonb_build_object(
          'elbowAction', 'straight_isometric',
          'scapularMode', 'active_isometric',
          'identityDuplicate', TRUE
        ),
        status = 'archived',
        updated_at = now()
    WHERE id = active_duplicate_variant_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = active_id,
        variant_key = 'active-dead-hang-source-1074',
        modifier_keys = ARRAY[
          'historical_source_variant',
          'active_scapular_isometric'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'technicalComplexity', 28,
          'absoluteLoadDemand', 58,
          'coordinationDemand', 30,
          'baseOverallDifficulty', 58
        ),
        requirements_json = requirements_json || jsonb_build_object(
          'elbowAction', 'straight_isometric',
          'scapularMode', 'active_isometric',
          'sourceNameUsesDeadHang', TRUE
        ),
        status = 'archived',
        updated_at = now()
    WHERE id = compound_active_variant_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = dead_id,
        variant_key = 'passive-or-active-source-201',
        modifier_keys = ARRAY[
          'historical_compound_source',
          'scapular_mode_unresolved'
        ]::TEXT[],
        difficulty_json = jsonb_build_object(
          'scoreDeferred', TRUE,
          'reason', 'Historical source permits passive or active scapular mode and therefore does not define one selectable exercise variant.'
        ),
        requirements_json = requirements_json || jsonb_build_object(
          'elbowAction', 'straight_isometric',
          'scapularMode', 'passive_or_active_unresolved',
          'identityQuarantine', TRUE
        ),
        status = 'archived',
        updated_at = now()
    WHERE id = compound_ambiguous_variant_id;

    UPDATE coaching.exercise_delivery_profile_v1
    SET status = 'archived',
        equipment_required = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
        updated_at = now()
    WHERE variant_id IN (
      active_duplicate_variant_id,
      compound_active_variant_id,
      compound_ambiguous_variant_id
    );

    -- Candidate-only material from the exact Active Hang duplicate can follow
    -- the survivor when it does not conflict. Conflicts stay on the archived
    -- record as immutable provenance.
    UPDATE coaching.exercise_section_evidence_v1 candidate
    SET definition_id = active_id,
        reviewed_card_version = active_version,
        updated_at = now()
    WHERE candidate.definition_id = active_duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_section_evidence_v1 existing
        WHERE existing.definition_id = active_id
          AND existing.reviewed_card_version = active_version
          AND existing.section_key = candidate.section_key
          AND existing.source_url = candidate.source_url
      );

    UPDATE coaching.exercise_alternate_assessment_v1 candidate
    SET definition_id = active_id,
        reviewed_card_version = active_version,
        updated_at = now()
    WHERE candidate.definition_id = active_duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_alternate_assessment_v1 existing
        WHERE existing.definition_id = active_id
          AND existing.reviewed_card_version = active_version
          AND lower(existing.alternate_name) = lower(candidate.alternate_name)
      );

    UPDATE coaching.exercise_media_candidate_v1 candidate
    SET definition_id = active_id,
        reviewed_card_version = active_version,
        updated_at = now()
    WHERE candidate.definition_id = active_duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_media_candidate_v1 existing
        WHERE existing.definition_id = active_id
          AND existing.reviewed_card_version = active_version
          AND (
            existing.video_id = candidate.video_id
            OR existing.url = candidate.url
          )
      );

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identity_resolution', 'exact_active_hang_identity',
          'canonical_survivor_definition_id', active_id,
          'human_review_required', TRUE,
          'publication_quarantined', TRUE
        ),
        updated_at = now()
    WHERE id = active_duplicate_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identity_resolution', 'compound_identity_split',
          'active_hang_definition_id', active_id,
          'dead_hang_definition_id', dead_id,
          'ambiguous_source_variant', 'passive-or-active-source-201',
          'human_review_required', TRUE,
          'publication_quarantined', TRUE
        ),
        updated_at = now()
    WHERE id = compound_id;
  END IF;

  -- Normalize the three final identities. All content remains in review.
  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Active Hang',
      display_name = 'Active Hang',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          COALESCE(aliases, '{}')
          || ARRAY[
            'Active Hangs',
            'Active Hang Scapular Hold',
            'Active Hang Scapular Holds',
            'Active Dead Hang',
            'Active Dead Hangs'
          ]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) <> 'active hang'
        GROUP BY lower(alias)
        ORDER BY lower(alias)
      ),
      description = 'Hang from a secure bar or stable rings with straight elbows while actively drawing the shoulders slightly away from the ears, maintaining a controlled trunk position, and stopping before grip or shoulder position changes.',
      family_key = 'Straight-arm hanging and scapular control',
      movement_patterns = ARRAY[
        'vertical_suspension',
        'straight_arm_scapular_isometric',
        'grip_isometric'
      ]::TEXT[],
      body_regions = ARRAY[
        'hands_and_forearms',
        'shoulder_girdle',
        'upper_back',
        'trunk'
      ]::TEXT[],
      required_equipment = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
      optional_equipment = ARRAY[
        'stable_foot_assistance_box',
        'assistance_band',
        'landing_mat'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'anchor', 'rated_stable_and_height_appropriate',
        'clearance', 'full_body_and_safe_step_down',
        'surface', 'non_slip_with_no_cross_traffic',
        'supervision', 'direct_when_dismount_or_shoulder_control_is_uncertain'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'can_grasp_the_assigned_implement',
          'can_tolerate_overhead_position_with_straight_elbows',
          'can_create_and_hold_small_scapular_depression_without_pain',
          'can_step_down_or_receive_assistance_safely'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_elbow_wrist_or_hand_pain',
          'numbness_or_tingling',
          'uncontrolled_grip_loss',
          'unsafe_dismount'
        )
      ),
      anatomy_json = jsonb_build_object(
        'primaryActions', jsonb_build_array(
          'scapular_depression_isometric',
          'grip_isometric',
          'elbow_extension_held',
          'overhead_shoulder_position_held',
          'trunk_position_control'
        ),
        'primaryTissues', jsonb_build_array(
          'finger_and_wrist_flexors',
          'latissimus_dorsi',
          'lower_trapezius',
          'pectoralis_minor',
          'shoulder_stabilizers'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_joint',
          'scapulothoracic_articulation',
          'thoracic_and_lumbar_spine'
        ),
        'planes', jsonb_build_array(
          'frontal_and_scapular_plane_overhead_position',
          'multiplanar_isometric_stabilization'
        )
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identity_resolution', 'active_hang_exact_duplicate_consolidation',
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'skill_level_applicability', 'skill_library_cards_only',
        'human_review_required', TRUE,
        'publication_quarantined', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = active_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Active Hang',
      modifier_keys = ARRAY[
        'straight_elbows',
        'active_scapular_isometric',
        'bilateral_grip'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 28,
        'absoluteLoadDemand', 58,
        'coordinationDemand', 30,
        'baseOverallDifficulty', 58
      ),
      requirements_json = requirements_json || jsonb_build_object(
        'elbowAction', 'straight_isometric',
        'scapularMode', 'active_isometric',
        'externalResistance', 'relative_bodyweight',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_suspension',
        'primaryStress', jsonb_build_array(
          'grip',
          'scapular_depression_isometric',
          'overhead_shoulder_tolerance',
          'trunk_control'
        ),
        'impactClass', 'none'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue',
          'scapular_depressor_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'shoulders_drift_to_passive_hang',
          'elbows_bend',
          'grip_slips',
          'body_swings',
          'breath_holding'
        ),
        'recoveryDriver', 'grip_and_shoulder_response_plus_total_pulling_volume'
      ),
      programming_profile_json = programming_profile_json || jsonb_build_object(
        'exerciseComplexity', 28,
        'physicalDifficulty', 58,
        'overallDifficulty', 58,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      status = 'review',
      updated_at = now()
  WHERE definition_id = active_id
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_definition_v1
  SET slug = 'dead-hang',
      canonical_name = 'Dead Hang',
      display_name = 'Dead Hang',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          COALESCE(aliases, '{}')
          || ARRAY[
            'Dead Hangs',
            'Passive Hang',
            'Passive Hangs',
            'Dead Hang Breathing Reset',
            'Dead Hang Breathing Resets',
            'Dead Hang / Active Hang',
            'Dead Hang / Active Hangs'
          ]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) <> 'dead hang'
        GROUP BY lower(alias)
        ORDER BY lower(alias)
      ),
      description = 'Hang from a secure bar or stable rings with straight elbows while allowing the shoulders to remain in the assigned passive position. Maintain a secure grip and controlled body, then step down before grip, symptoms, or dismount quality changes.',
      family_key = 'Straight-arm hanging and scapular control',
      movement_patterns = ARRAY[
        'vertical_suspension',
        'straight_arm_passive_hang',
        'grip_isometric'
      ]::TEXT[],
      body_regions = ARRAY[
        'hands_and_forearms',
        'shoulder_girdle',
        'upper_back',
        'trunk'
      ]::TEXT[],
      required_equipment = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
      optional_equipment = ARRAY[
        'stable_foot_assistance_box',
        'assistance_band',
        'landing_mat'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'anchor', 'rated_stable_and_height_appropriate',
        'clearance', 'full_body_and_safe_step_down',
        'surface', 'non_slip_with_no_cross_traffic',
        'supervision', 'direct_when_dismount_or_symptom_monitoring_is_uncertain'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'can_grasp_the_assigned_implement',
          'can_tolerate_the_assigned_overhead_passive_position',
          'can_keep_elbows_straight_without_forced_locking',
          'can_step_down_or_receive_assistance_safely'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_instability_or_unassessed_overhead_pain',
          'elbow_wrist_or_hand_pain',
          'numbness_or_tingling',
          'uncontrolled_grip_loss',
          'unsafe_dismount'
        )
      ),
      anatomy_json = jsonb_build_object(
        'primaryActions', jsonb_build_array(
          'grip_isometric',
          'elbow_extension_held',
          'overhead_shoulder_position_held',
          'scapular_elevation_or_upward_rotation_allowed_by_protocol',
          'trunk_position_control'
        ),
        'primaryTissues', jsonb_build_array(
          'finger_and_wrist_flexors',
          'forearm_fascia_and_flexor_tendons',
          'shoulder_capsule_and_surrounding_tissues_under_traction',
          'shoulder_stabilizers_at_low_active_demand'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_joint',
          'scapulothoracic_articulation',
          'thoracic_and_lumbar_spine'
        ),
        'planes', jsonb_build_array(
          'frontal_and_scapular_plane_overhead_position',
          'multiplanar_isometric_stabilization'
        )
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identity_resolution', 'dead_hang_contextual_delivery_survivor',
        'former_slug', 'dead-hang-breathing-reset-restore',
        'breathing_reset_resolution', 'contextual_delivery_profile',
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'skill_level_applicability', 'skill_library_cards_only',
        'human_review_required', TRUE,
        'publication_quarantined', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = dead_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Dead Hang',
      modifier_keys = ARRAY[
        'straight_elbows',
        'passive_scapular_position',
        'bilateral_grip'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 18,
        'absoluteLoadDemand', 52,
        'coordinationDemand', 20,
        'baseOverallDifficulty', 52
      ),
      requirements_json = requirements_json || jsonb_build_object(
        'elbowAction', 'straight_isometric',
        'scapularMode', 'passive',
        'externalResistance', 'relative_bodyweight',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_suspension',
        'primaryStress', jsonb_build_array(
          'grip',
          'passive_overhead_shoulder_position_tolerance',
          'straight_arm_hang_tolerance'
        ),
        'impactClass', 'none'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'grip_slips',
          'elbows_bend',
          'body_swings',
          'symptoms_appear',
          'dismount_becomes_uncontrolled'
        ),
        'recoveryDriver', 'grip_and_shoulder_response_plus_total_pulling_volume'
      ),
      programming_profile_json = programming_profile_json || jsonb_build_object(
        'exerciseComplexity', 18,
        'physicalDifficulty', 52,
        'overallDifficulty', 52,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      status = 'review',
      updated_at = now()
  WHERE definition_id = dead_id
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET profile_key = 'restore-nasal-breathing',
      purpose = 'Brief supported or full dead-hang exposure with calm breathing. This is a contextual restore dose, not a separate exercise identity and not a grip-to-failure test.',
      dosage_json = jsonb_build_object(
        'sets', 1,
        'workSeconds', 10,
        'restSeconds', 30,
        'rpeCeiling', 4,
        'breathing', 'quiet_nasal_breathing_when_comfortable'
      ),
      quality_gate = 'Grip, breathing, straight elbows, assigned passive shoulder position, and safe step-down remain calm and repeatable.',
      stop_rules = ARRAY[
        'Pain, pinching, instability, numbness, or tingling appears or increases.',
        'Grip starts to open or slip.',
        'Breathing becomes strained, dizzy, or panicked.',
        'The athlete cannot step down safely.',
        'The assigned passive shoulder position cannot be tolerated.'
      ]::TEXT[],
      coach_instructions = 'Confirm passive rather than active scapular mode, provide foot assistance before quality fails, use short submaximal holds, and do not claim decompression, healing, or injury prevention.',
      athlete_instructions = 'Use a secure grip, keep your arms straight, let your shoulders take the assigned passive position, breathe calmly, and step down early.',
      expected_adaptation = 'Short exposure to passive overhead hanging and grip tolerance without meaningful fatigue.',
      equipment_required = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id = variant.id
    AND variant.definition_id = dead_id
    AND variant.variant_key = 'baseline'
    AND profile.profile_key IN ('legacy-restore', 'restore-nasal-breathing');

  UPDATE coaching.exercise_definition_v1
  SET description = 'Hang from a secure bar or stable rings with straight elbows. Move only through the shoulder blades: allow the assigned start position, draw the shoulders down to lift the body slightly without bending the elbows, then return under control without swinging.',
      family_key = 'Straight-arm hanging and scapular control',
      movement_patterns = ARRAY[
        'vertical_suspension',
        'straight_arm_scapular_pull',
        'grip_isometric'
      ]::TEXT[],
      body_regions = ARRAY[
        'hands_and_forearms',
        'shoulder_girdle',
        'upper_back',
        'trunk'
      ]::TEXT[],
      required_equipment = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
      optional_equipment = ARRAY[
        'stable_foot_assistance_box',
        'assistance_band',
        'landing_mat'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'anchor', 'rated_stable_and_height_appropriate',
        'clearance', 'full_body_and_safe_step_down',
        'surface', 'non_slip_with_no_cross_traffic',
        'supervision', 'direct_until_scapular_motion_and_dismount_are_repeatable'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'can_grasp_the_assigned_implement',
          'can_tolerate_overhead_hanging_with_straight_elbows',
          'can_distinguish_scapular_motion_from_elbow_flexion',
          'can_step_down_or_receive_assistance_safely'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_elbow_wrist_or_hand_pain',
          'numbness_or_tingling',
          'uncontrolled_swing_or_grip_loss',
          'unsafe_dismount'
        )
      ),
      anatomy_json = jsonb_build_object(
        'primaryActions', jsonb_build_array(
          'scapular_depression_concentric_and_eccentric',
          'scapular_elevation_or_return_under_control',
          'grip_isometric',
          'elbow_extension_held',
          'trunk_position_control'
        ),
        'primaryTissues', jsonb_build_array(
          'finger_and_wrist_flexors',
          'latissimus_dorsi',
          'lower_trapezius',
          'pectoralis_minor',
          'serratus_anterior_and_other_scapular_stabilizers'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_joint',
          'scapulothoracic_articulation',
          'thoracic_and_lumbar_spine'
        ),
        'planes', jsonb_build_array(
          'frontal_and_scapular_plane_overhead_position',
          'multiplanar_scapular_motion_and_stabilization'
        )
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identity_resolution', 'distinct_dynamic_scapular_hang',
        'exercise_difficulty_model',
          'exercise_complexity_and_physical_difficulty_only',
        'skill_level_applicability', 'skill_library_cards_only',
        'human_review_required', TRUE,
        'publication_quarantined', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = scapular_pull_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Scapular Pull-Up',
      modifier_keys = ARRAY[
        'straight_elbows',
        'dynamic_scapular_motion',
        'bilateral_grip'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 38,
        'absoluteLoadDemand', 62,
        'coordinationDemand', 42,
        'baseOverallDifficulty', 62
      ),
      requirements_json = requirements_json || jsonb_build_object(
        'elbowAction', 'straight_throughout',
        'scapularMode', 'dynamic_active_to_controlled_return',
        'externalResistance', 'relative_bodyweight',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_dynamic_scapular_pull',
        'primaryStress', jsonb_build_array(
          'grip',
          'scapular_depression_strength',
          'controlled_scapular_return',
          'overhead_shoulder_tolerance',
          'trunk_control'
        ),
        'impactClass', 'none'
      ),
      fatigue_profile_json = jsonb_build_object(
        'localFatigue', jsonb_build_array(
          'finger_and_forearm_fatigue',
          'scapular_depressor_fatigue'
        ),
        'qualityLoss', jsonb_build_array(
          'elbows_bend',
          'range_shrinks',
          'return_drops_uncontrolled',
          'body_swings',
          'grip_slips',
          'breath_holding'
        ),
        'recoveryDriver', 'grip_scapular_and_shoulder_response_plus_total_pulling_volume'
      ),
      programming_profile_json = programming_profile_json || jsonb_build_object(
        'exerciseComplexity', 38,
        'physicalDifficulty', 62,
        'overallDifficulty', 62,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      status = 'review',
      updated_at = now()
  WHERE definition_id = scapular_pull_id
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET equipment_required = ARRAY['pull_up_bar_or_stable_rings']::TEXT[],
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id = variant.id
    AND variant.definition_id IN (active_id, dead_id, scapular_pull_id)
    AND variant.status <> 'archived';

  -- Record the boundaries that prevent future duplicate recombination.
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
    active.facility_id,
    active.id,
    dead.id,
    'distinct_exercises',
    'Active Hang requires an isometric active scapular position; Dead Hang permits the assigned passive scapular position. That change alters joint action, muscle demand, coaching, stop rules, dosage, and substitutions.',
    jsonb_build_object(
      'identity_boundary', 'active_vs_passive_scapular_mode',
      'active_slug', active.slug,
      'passive_slug', dead.slug,
      'elbows', 'straight_in_both',
      'exercise_difficulty_model',
        'exercise_complexity_and_physical_difficulty_only'
    ),
    'deterministic_identity_equivalence'
  FROM coaching.exercise_definition_v1 active
  JOIN coaching.exercise_definition_v1 dead
    ON dead.id = dead_id
  WHERE active.id = active_id
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
    active.facility_id,
    active.id,
    scapular.id,
    'distinct_exercises',
    'Active Hang is an isometric scapular hold; Scapular Pull-Up repeatedly moves between scapular positions. Repetition, eccentric return, motion quality, and fatigue behavior create a separate exercise identity.',
    jsonb_build_object(
      'identity_boundary', 'isometric_hold_vs_dynamic_scapular_repetition',
      'active_slug', active.slug,
      'dynamic_slug', scapular.slug,
      'elbows', 'straight_in_both',
      'exercise_difficulty_model',
        'exercise_complexity_and_physical_difficulty_only'
    ),
    'deterministic_identity_equivalence'
  FROM coaching.exercise_definition_v1 active
  JOIN coaching.exercise_definition_v1 scapular
    ON scapular.id = scapular_pull_id
  WHERE active.id = active_id
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
    dead.facility_id,
    dead.id,
    scapular.id,
    'distinct_exercises',
    'Dead Hang is a static passive-position exposure; Scapular Pull-Up adds repeated active scapular depression and controlled return. The dynamic action is not a dosage modifier of a passive hold.',
    jsonb_build_object(
      'identity_boundary', 'passive_isometric_vs_dynamic_scapular_repetition',
      'passive_slug', dead.slug,
      'dynamic_slug', scapular.slug,
      'elbows', 'straight_in_both',
      'exercise_difficulty_model',
        'exercise_complexity_and_physical_difficulty_only'
    ),
    'deterministic_identity_equivalence'
  FROM coaching.exercise_definition_v1 dead
  JOIN coaching.exercise_definition_v1 scapular
    ON scapular.id = scapular_pull_id
  WHERE dead.id = dead_id
  ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET status = 'quarantined',
      blocking_issues_json = CASE
        WHEN packet.blocking_issues_json @> '[{
          "code": "hang_identity_research_and_media_review_required"
        }]'::JSONB
          THEN packet.blocking_issues_json
        ELSE packet.blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'hang_identity_research_and_media_review_required',
            'message', 'Re-run the canonical audit and complete section, alternate, score-calibration, exact-media, and human card review for the resolved passive, active, and dynamic hang identities.'
          )
        )
      END,
      human_review_required = TRUE,
      checked_at = now()
  WHERE packet.definition_id IN (active_id, dead_id, scapular_pull_id);
END;
$$;
