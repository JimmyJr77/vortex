-- Complete the candidate-only Dead Hang, Active Hang, and Scapular Pull-Up
-- family after migration 309 resolved their identities.
--
-- Migration 309 intentionally kept detailed movement descriptors on the
-- definitions. Those descriptors are useful mechanics qualifiers, but they are
-- not keys in the controlled movement/body-region/equipment taxonomies. This
-- migration maps the definitions to controlled keys, keeps the precise
-- descriptors in anatomy/programming metadata, creates every researched
-- difficulty-scored variant, and supplies generation/user/coach/support data
-- for every exact variant.
--
-- Exercise cards use exercise complexity and physical difficulty only. Overall
-- difficulty is their maximum. This migration does not edit coaching.skill.
--
-- Everything remains in review. Relationships remain unapproved, media remains
-- candidate-only, calibration remains unapproved, and the cards remain
-- publication-quarantined. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key TEXT := '313_coaching_hang_family_structural_completion';
  facility BIGINT;
  active_id UUID;
  dead_id UUID;
  scapular_id UUID;
  target_ids UUID[];
  protected_records INTEGER;
  unexpected_variants INTEGER;
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
      'Hang-family completion requires active Dead Hang, Active Hang, and Scapular Pull-Up definitions';
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
      'Hang-family completion refused to override % published, reviewed, or approved records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = ANY(target_ids)
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'foot-assisted',
      'band-assisted',
      'ring',
      'weighted',
      'single-arm'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Hang-family completion found % unexpected active variants; identity review is required',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'completenessMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      movement_patterns = CASE slug
        WHEN 'dead-hang' THEN ARRAY['hang', 'brace']::TEXT[]
        ELSE ARRAY['hang', 'pull', 'brace']::TEXT[]
      END,
      body_regions = ARRAY[
        'hand', 'wrist', 'elbow', 'shoulder', 'scapula', 'core', 'spine'
      ]::TEXT[],
      required_equipment = ARRAY['bar_or_rings']::TEXT[],
      optional_equipment = ARRAY[
        'box', 'bands', 'mat', 'timer', 'weighted_vest'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'anchor', 'rated_secure_and_checked_before_each_station_use',
        'height', 'athlete_can_mount_and_step_down_without_jumping',
        'clearance', 'full_body_swing_and_assisted_exit_space',
        'surface', 'level_non_slip_with_matting_when_indicated',
        'traffic', 'station_isolated_from_cross_traffic',
        'bandSafety', 'band_condition_anchor_path_entry_and_recoil_checked',
        'loadAttachment', 'added_load_secured_and_removed_before_dismount'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'secure_grip_or_appropriate_alternative',
          'symptom_free_assigned_overhead_position',
          'straight_elbow_position_without_forced_locking',
          'controlled_mount_and_step_down_or_direct_assistance',
          'can_follow_the_declared_passive_active_or_dynamic_scapular_mode'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hand_wrist_elbow_shoulder_neck_or_back_pain',
          'numbness_tingling_dizziness_or_instability',
          'uncontrolled_grip_loss_or_swing',
          'unsafe_mount_dismount_anchor_or_clearance',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance; this card is not rehabilitation instruction.',
        'selectionBoundary',
          'Assistance, dose, supervision, and difficulty caps follow current readiness and workout context, never an exercise-card skill level.'
      ),
      anatomy_json = CASE slug
        WHEN 'dead-hang' THEN jsonb_build_object(
          'primaryMuscles', jsonb_build_array(
            'finger_flexors',
            'wrist_flexors',
            'forearm_stabilizers',
            'rotator_cuff_and_scapular_stabilizers_at_low_active_demand'
          ),
          'secondaryMuscles', jsonb_build_array(
            'latissimus_dorsi',
            'trapezius',
            'serratus_anterior',
            'abdominal_wall',
            'spinal_stabilizers'
          ),
          'joints', jsonb_build_array(
            'finger_joints',
            'wrist',
            'elbow',
            'glenohumeral_joint',
            'acromioclavicular_and_sternoclavicular_joints',
            'scapulothoracic_articulation',
            'thoracic_and_lumbar_spine'
          ),
          'jointActions', jsonb_build_array(
            'finger_and_wrist_flexion_isometric',
            'elbow_extension_held',
            'overhead_glenohumeral_position_held',
            'assigned_passive_scapular_elevation_and_upward_rotation',
            'trunk_position_control'
          ),
          'planes', jsonb_build_array(
            'scapular_plane_overhead_position',
            'multiplanar_isometric_stabilization'
          ),
          'laterality', 'bilateral',
          'movementQualifiers', jsonb_build_array(
            'vertical_suspension',
            'straight_arm_passive_hang',
            'bilateral_grip_isometric'
          )
        )
        WHEN 'active-hang' THEN jsonb_build_object(
          'primaryMuscles', jsonb_build_array(
            'finger_flexors',
            'wrist_flexors',
            'latissimus_dorsi',
            'lower_trapezius',
            'scapular_stabilizers'
          ),
          'secondaryMuscles', jsonb_build_array(
            'rotator_cuff',
            'serratus_anterior',
            'rhomboids',
            'triceps_for_elbow_position',
            'abdominal_wall',
            'spinal_stabilizers'
          ),
          'joints', jsonb_build_array(
            'finger_joints',
            'wrist',
            'elbow',
            'glenohumeral_joint',
            'acromioclavicular_and_sternoclavicular_joints',
            'scapulothoracic_articulation',
            'thoracic_and_lumbar_spine'
          ),
          'jointActions', jsonb_build_array(
            'finger_and_wrist_flexion_isometric',
            'elbow_extension_held',
            'scapular_depression_isometric',
            'overhead_glenohumeral_position_held',
            'trunk_position_control'
          ),
          'planes', jsonb_build_array(
            'scapular_plane_overhead_position',
            'multiplanar_isometric_stabilization'
          ),
          'laterality', 'bilateral',
          'movementQualifiers', jsonb_build_array(
            'vertical_suspension',
            'straight_arm_active_scapular_isometric',
            'bilateral_grip_isometric'
          )
        )
        ELSE jsonb_build_object(
          'primaryMuscles', jsonb_build_array(
            'finger_flexors',
            'wrist_flexors',
            'latissimus_dorsi',
            'lower_trapezius',
            'scapular_stabilizers'
          ),
          'secondaryMuscles', jsonb_build_array(
            'rotator_cuff',
            'serratus_anterior',
            'rhomboids',
            'triceps_for_elbow_position',
            'abdominal_wall',
            'spinal_stabilizers'
          ),
          'joints', jsonb_build_array(
            'finger_joints',
            'wrist',
            'elbow',
            'glenohumeral_joint',
            'acromioclavicular_and_sternoclavicular_joints',
            'scapulothoracic_articulation',
            'thoracic_and_lumbar_spine'
          ),
          'jointActions', jsonb_build_array(
            'finger_and_wrist_flexion_isometric',
            'elbow_extension_held',
            'scapular_depression_concentric',
            'scapular_elevation_or_return_eccentric',
            'overhead_glenohumeral_position_control',
            'trunk_position_control'
          ),
          'planes', jsonb_build_array(
            'scapular_plane_overhead_position',
            'multiplanar_scapular_motion_and_stabilization'
          ),
          'laterality', 'bilateral',
          'movementQualifiers', jsonb_build_array(
            'vertical_suspension',
            'straight_arm_dynamic_scapular_pull',
            'bilateral_grip_isometric'
          )
        )
      END,
      athlete_support_json = jsonb_build_object(
        'setupSteps', jsonb_build_array(
          'Wait for the coach to confirm the anchor, space, and assistance.',
          'Use the box or band exactly as assigned.',
          'Take a full secure grip before the feet leave support.',
          'Name the assigned shoulder mode before starting.'
        ),
        'selfChecks', jsonb_build_array(
          'Hands remain secure.',
          'Elbows remain straight without forced locking.',
          'The body stays quiet.',
          'The assigned shoulder position remains comfortable and controllable.',
          'A controlled step-down remains available.'
        ),
        'accessibilityOptions', jsonb_build_array(
          'lower_bar_or_stable_foot_contact',
          'band_assistance_with_coach_managed_entry_and_exit',
          'shorter_submaximal_efforts',
          'longer_rest',
          'alternate_implement_or_grip_when_appropriate',
          'plain_language_visual_demo_and_visible_stop_signal'
        ),
        'stopAndEscalate', jsonb_build_array(
          'pain_pinching_or_instability',
          'numbness_or_tingling',
          'dizziness_or_breath_distress',
          'grip_opening_or_slipping',
          'uncontrolled_swing_or_elbow_bend',
          'unsafe_dismount'
        ),
        'mediaAlternative',
          'Provide text, still-frame start and finish positions, and an in-person demonstration; candidate videos are optional and unapproved.',
        'levelPolicy',
          'This exercise has complexity and physical-difficulty scores, not a beginner, intermediate, advanced, or elite level.'
      ),
      coach_support_json = jsonb_build_object(
        'observationViews', jsonb_build_array(
          'front_for_grip_symmetry_and_shoulder_height',
          'side_for_elbow_position_swing_and_body_line',
          'close_view_for_hand_security_and_assistance_setup'
        ),
        'faultCorrections', jsonb_build_object(
          'grip_slip', 'End the effort and reduce duration or add assistance.',
          'elbow_bend', 'Stop, unload, and restore the straight-arm task.',
          'shoulder_mode_error', 'Reset and demonstrate the declared passive, active-isometric, or dynamic mode.',
          'swing', 'Use a lower start, still body, shorter dose, or more assistance.',
          'unsafe_exit', 'Restore stable foot contact before another attempt.'
        ),
        'demonstration',
          'Show grip, mount, exact shoulder mode, endpoint, breathing, and step-down from front and side.',
        'groupManagement',
          'One athlete works per rated station position; pre-stage assistance without blocking the exit and assign a coach-visible stop signal.',
        'loadMonitoring',
          'Count total hanging time or repetitions with pull-ups, climbing, carries, rings, rope, and other grip or scapular work.',
        'documentation',
          'Record implement, grip, assistance, load, sets, time or reps, rest, symptoms, quality loss, and exit quality.'
      ),
      support_operations_json = jsonb_build_object(
        'incidentEscalation',
          'Stop the station, secure the athlete, record the event, and follow facility medical and equipment protocols.',
        'retention',
          'Retain card version, research version, candidate URLs, alternate decisions, coach edits, symptoms, incidents, and substitutions under facility policy.',
        'feedbackFields', jsonb_build_array(
          'identity_match',
          'difficulty_fit',
          'dose_fit',
          'assistance_used',
          'grip_or_shoulder_symptoms',
          'quality_loss',
          'substitution_reason',
          'media_accessibility'
        ),
        'changeImpact', jsonb_build_array(
          'revalidate_delivery_profiles',
          'recalculate_fatigue_and_duration_budgets',
          'invalidate_stale_media_and_section_reviews',
          'recheck_relationship_edges',
          'notify_library_owner_before_release'
        ),
        'owner', 'canonical_exercise_library_review_queue'
      ),
      content_confidence = 80,
      scoring_confidence = 74,
      media_confidence = 42,
      provenance_json = provenance_json || jsonb_build_object(
        'completenessMigration', migration_key,
        'controlledTaxonomyCorrection', TRUE,
        'researchVersion', '2026-07-26.30',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'skillLevelApplicability', 'skill_library_cards_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaCandidateOnly', TRUE
      ),
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      approved_video_url = NULL,
      updated_at = now()
  WHERE id = ANY(target_ids);

  -- The surviving legacy source now presents the general canonical identity;
  -- breathing remains a delivery profile rather than part of its exercise name.
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise
    WHERE facility_id = facility
      AND slug = 'dead-hang'
      AND id <> (
        SELECT legacy_exercise_id
        FROM coaching.exercise_definition_v1
        WHERE id = dead_id
      )
  ) THEN
    RAISE EXCEPTION
      'Hang-family completion found a conflicting legacy dead-hang slug';
  END IF;

  UPDATE coaching.exercise legacy
  SET name = definition.canonical_name,
      slug = definition.slug,
      description = definition.description,
      skill_level = NULL,
      why_publish_ready = FALSE,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND legacy.id = definition.legacy_exercise_id;

  -- Candidate-only research records can follow the materially revised card
  -- version. Human-reviewed records were prohibited above.
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

  CREATE TEMP TABLE hang_variant_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    technical SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    failure_consequence SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    grip_demand SMALLINT NOT NULL,
    spinal_loading SMALLINT NOT NULL,
    eccentric_stress SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    grip_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    external_load_method TEXT NOT NULL,
    phase_key TEXT NOT NULL,
    role TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    purpose TEXT NOT NULL,
    phase_suitability SMALLINT NOT NULL,
    sets_count SMALLINT NOT NULL,
    reps_count SMALLINT,
    work_seconds SMALLINT,
    rest_seconds SMALLINT NOT NULL,
    rpe_ceiling SMALLINT NOT NULL,
    equipment_required TEXT[] NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hang_variant_seed VALUES
    (
      'dead-hang', 'baseline', 'Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'bilateral_grip'],
      18, 52, 20, 35, 50, 55, 68, 8, 8, 48, 68, 28, 12,
      'bodyweight', 'prepare_and_access', 'secondary', 'submaximal-access',
      'Submaximal passive-position hanging exposure with grip and safe-exit reserve.',
      72, 2, NULL, 15, 60, 5, ARRAY['bar_or_rings']
    ),
    (
      'dead-hang', 'foot-assisted', 'Foot-Assisted Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'foot_assisted'],
      18, 28, 20, 30, 32, 34, 34, 5, 5, 26, 34, 22, 8,
      'bodyweight', 'prepare_and_access', 'secondary', 'submaximal-access',
      'Stable foot contact unloads the hands and shoulders while preserving passive hanging.',
      88, 2, NULL, 15, 45, 4, ARRAY['bar_or_rings', 'box']
    ),
    (
      'dead-hang', 'band-assisted', 'Band-Assisted Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'band_assisted'],
      22, 34, 26, 45, 42, 40, 42, 5, 5, 32, 42, 30, 8,
      'bodyweight', 'prepare_and_access', 'conditional', 'submaximal-access',
      'Band assistance unloads passive hanging while requiring controlled entry, recoil, and exit.',
      75, 2, NULL, 15, 60, 4, ARRAY['bar_or_rings', 'bands']
    ),
    (
      'dead-hang', 'ring', 'Ring Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'ring_implement'],
      20, 56, 28, 40, 55, 58, 72, 8, 8, 52, 72, 34, 16,
      'bodyweight', 'capacity', 'secondary', 'submaximal-capacity',
      'Passive straight-arm hanging on stable rings with self-selected grip orientation.',
      68, 3, NULL, 15, 75, 6, ARRAY['rings']
    ),
    (
      'dead-hang', 'weighted', 'Weighted Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'added_load'],
      22, 74, 28, 58, 72, 74, 88, 12, 10, 72, 88, 40, 36,
      'relative_external', 'capacity', 'conditional', 'submaximal-capacity',
      'Added-load passive hanging for explicitly planned grip capacity without failure.',
      45, 3, NULL, 10, 120, 7, ARRAY['bar_or_rings', 'weighted_vest']
    ),
    (
      'dead-hang', 'single-arm', 'Single-Arm Dead Hang',
      ARRAY['straight_elbows', 'passive_scapular_position', 'unilateral_grip'],
      30, 84, 45, 68, 82, 78, 96, 18, 12, 82, 96, 58, 48,
      'bodyweight', 'capacity', 'conditional', 'submaximal-capacity',
      'Unilateral passive hanging with declared assistance and a protected exit.',
      30, 3, NULL, 8, 150, 8, ARRAY['bar_or_rings']
    ),
    (
      'active-hang', 'baseline', 'Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'bilateral_grip'],
      28, 58, 30, 35, 50, 60, 70, 8, 10, 58, 70, 38, 16,
      'bodyweight', 'movement_intelligence', 'secondary', 'position-ownership',
      'Own a small active straight-arm scapular position without drifting or bending the elbows.',
      86, 3, NULL, 12, 60, 6, ARRAY['bar_or_rings']
    ),
    (
      'active-hang', 'foot-assisted', 'Foot-Assisted Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'foot_assisted'],
      28, 32, 30, 30, 34, 38, 38, 5, 8, 32, 38, 34, 8,
      'bodyweight', 'movement_intelligence', 'primary', 'position-ownership',
      'Stable foot assistance preserves active scapular position practice with reduced relative load.',
      92, 3, NULL, 12, 45, 4, ARRAY['bar_or_rings', 'box']
    ),
    (
      'active-hang', 'band-assisted', 'Band-Assisted Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'band_assisted'],
      32, 38, 34, 45, 44, 44, 46, 5, 8, 38, 46, 40, 8,
      'bodyweight', 'movement_intelligence', 'conditional', 'position-ownership',
      'Band assistance unloads active hanging while preserving straight-arm scapular control.',
      78, 3, NULL, 12, 60, 5, ARRAY['bar_or_rings', 'bands']
    ),
    (
      'active-hang', 'ring', 'Ring Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'ring_implement'],
      28, 64, 38, 45, 60, 64, 76, 8, 10, 64, 76, 48, 20,
      'bodyweight', 'capacity', 'secondary', 'position-capacity',
      'Active straight-arm hanging on stable rings with controlled orientation and no drift.',
      64, 3, NULL, 12, 90, 7, ARRAY['rings']
    ),
    (
      'active-hang', 'weighted', 'Weighted Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'added_load'],
      32, 80, 38, 62, 78, 78, 90, 12, 12, 80, 90, 58, 40,
      'relative_external', 'capacity', 'conditional', 'position-capacity',
      'Added-load active hanging for explicitly planned scapular and grip capacity with reserve.',
      38, 3, NULL, 8, 150, 8, ARRAY['bar_or_rings', 'weighted_vest']
    ),
    (
      'active-hang', 'single-arm', 'Single-Arm Active Hang',
      ARRAY['straight_elbows', 'active_scapular_isometric', 'unilateral_grip'],
      38, 88, 50, 72, 86, 82, 98, 18, 12, 88, 98, 68, 48,
      'bodyweight', 'capacity', 'conditional', 'position-capacity',
      'Unilateral active hanging with explicit assistance, asymmetry control, and protected exit.',
      25, 3, NULL, 6, 180, 8, ARRAY['bar_or_rings']
    ),
    (
      'scapular-pull-up', 'baseline', 'Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'bilateral_grip'],
      38, 62, 42, 40, 55, 60, 72, 8, 32, 62, 72, 58, 24,
      'bodyweight', 'movement_intelligence', 'primary', 'movement-quality',
      'Repeat a small straight-arm scapular pull and controlled return without swing or elbow flexion.',
      90, 3, 6, NULL, 75, 6, ARRAY['bar_or_rings']
    ),
    (
      'scapular-pull-up', 'foot-assisted', 'Foot-Assisted Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'foot_assisted'],
      38, 36, 42, 32, 36, 40, 40, 5, 22, 38, 40, 50, 12,
      'bodyweight', 'movement_intelligence', 'primary', 'movement-quality',
      'Stable foot assistance preserves scapular-only repetitions while reducing relative load.',
      95, 3, 6, NULL, 60, 4, ARRAY['bar_or_rings', 'box']
    ),
    (
      'scapular-pull-up', 'band-assisted', 'Band-Assisted Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'band_assisted'],
      42, 42, 46, 48, 48, 46, 48, 5, 24, 44, 48, 58, 12,
      'bodyweight', 'movement_intelligence', 'conditional', 'movement-quality',
      'Band assistance reduces loading while retaining dynamic scapular timing and straight elbows.',
      78, 3, 6, NULL, 75, 5, ARRAY['bar_or_rings', 'bands']
    ),
    (
      'scapular-pull-up', 'ring', 'Ring Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'ring_implement'],
      38, 68, 50, 48, 65, 68, 78, 8, 36, 70, 78, 66, 28,
      'bodyweight', 'capacity', 'secondary', 'movement-capacity',
      'Dynamic straight-arm scapular repetitions on stable rings with controlled orientation.',
      58, 3, 6, NULL, 105, 7, ARRAY['rings']
    ),
    (
      'scapular-pull-up', 'weighted', 'Weighted Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'added_load'],
      44, 84, 48, 66, 82, 82, 92, 12, 42, 86, 92, 72, 40,
      'relative_external', 'capacity', 'conditional', 'movement-capacity',
      'Added-load scapular repetitions with full motion control, reserve, and protected dismount.',
      32, 3, 5, NULL, 180, 8, ARRAY['bar_or_rings', 'weighted_vest']
    ),
    (
      'scapular-pull-up', 'single-arm', 'Single-Arm Scapular Pull-Up',
      ARRAY['straight_elbows', 'dynamic_scapular_motion', 'unilateral_grip'],
      50, 92, 62, 78, 92, 88, 99, 20, 45, 94, 99, 82, 48,
      'bodyweight', 'capacity', 'conditional', 'movement-capacity',
      'Unilateral dynamic scapular motion with declared assistance, strict range, and protected exit.',
      20, 3, 4, NULL, 210, 9, ARRAY['bar_or_rings']
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json,
    status
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity', seed.technical,
      'absoluteLoadDemand', seed.physical,
      'coordinationDemand', seed.coordination,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.failure_consequence,
      'impact', 1,
      'workCapacityDemand', seed.work_capacity,
      'baseOverallDifficulty', GREATEST(seed.technical, seed.physical)
    ),
    jsonb_build_object(
      'scapularMode', CASE seed.definition_slug
        WHEN 'dead-hang' THEN 'passive_isometric'
        WHEN 'active-hang' THEN 'active_isometric'
        ELSE 'dynamic_active_to_controlled_return'
      END,
      'elbowAction', CASE seed.definition_slug
        WHEN 'scapular-pull-up' THEN 'straight_throughout_dynamic_repetitions'
        ELSE 'straight_isometric'
      END,
      'assistance', CASE
        WHEN seed.variant_key = 'foot-assisted' THEN 'stable_foot_contact'
        WHEN seed.variant_key = 'band-assisted' THEN 'band'
        ELSE 'none'
      END,
      'implement', CASE
        WHEN seed.variant_key = 'ring' THEN 'rings'
        ELSE 'bar_or_rings'
      END,
      'laterality', CASE
        WHEN seed.variant_key = 'single-arm' THEN 'unilateral'
        ELSE 'bilateral'
      END,
      'externalResistance', seed.external_load_method,
      'safeExitRequired', TRUE,
      'humanReviewRequired', TRUE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod', seed.external_load_method,
      'loadingType', CASE
        WHEN seed.definition_slug = 'scapular-pull-up'
          THEN 'relative_bodyweight_dynamic_scapular_pull'
        WHEN seed.definition_slug = 'active-hang'
          THEN 'relative_bodyweight_active_scapular_isometric'
        ELSE 'relative_bodyweight_passive_suspension'
      END,
      'impactClass', 'none_except_uncontrolled_dismount',
      'primaryStress', jsonb_build_array(
        'grip',
        CASE seed.definition_slug
          WHEN 'dead-hang' THEN 'passive_overhead_position_tolerance'
          WHEN 'active-hang' THEN 'scapular_depression_isometric'
          ELSE 'dynamic_scapular_depression_and_controlled_return'
        END,
        'straight_arm_position',
        'safe_dismount'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'qualityLoss', jsonb_build_array(
        'grip_opens_or_slips',
        'elbows_bend',
        'shoulder_mode_changes',
        'body_swings',
        'dismount_quality_declines'
      ),
      'cumulativeLoadWarning',
        'Count with pull-ups, climbing, carries, rings, rope, and other grip or scapular work.'
    ),
    jsonb_build_object(
      'exerciseComplexity', seed.technical,
      'physicalDifficulty', seed.physical,
      'overallDifficulty', GREATEST(seed.technical, seed.physical),
      'overallFormula', 'max_exercise_complexity_physical_difficulty',
      'movementIdentity', seed.definition_slug,
      'variantBoundary', seed.variant_key,
      'preferredPhases', jsonb_build_array(seed.phase_key),
      'sequenceGuidance',
        'Place quality-sensitive hanging before high-fatigue pulling when position practice is the goal.',
      'interference',
        'Reduce or omit after high-volume pulling, climbing, carries, rope, rings, or symptomatic overhead work.',
      'prerequisites', jsonb_build_array(
        'rated_anchor_and_clearance',
        'secure_grip_or_appropriate_substitute',
        'symptom_free_assigned_overhead_position',
        'controlled_mount_and_exit'
      ),
      'progressionCriteria', jsonb_build_array(
        'all_assigned_work_is_symptom_free',
        'grip_and_elbow_position_remain_stable',
        'declared_scapular_mode_is_repeatable',
        'body_stays_quiet',
        'exit_remains_controlled_with_reserve'
      ),
      'regressionOptions', jsonb_build_array(
        'stable_foot_assistance',
        'band_assistance_with_managed_entry_and_exit',
        'shorter_effort_or_fewer_repetitions',
        'longer_rest',
        'supported_non_hanging_scapular_task_when_grip_or_overhead_access_is_limiting'
      ),
      'modifierAnnotations', jsonb_build_array(
        'grip_orientation',
        'trunk_shape',
        'hold_or_pause_seconds',
        'tempo',
        'breathing_instruction',
        'test_endpoint'
      ),
      'skillLevelApplicability', 'skill_library_cards_only'
    ),
    'review'
  FROM hang_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = facility
   AND definition.slug = seed.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, variant_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    status = 'review',
    updated_at = now();

  -- Old legacy profiles are structurally incomplete and candidate-only. Keep
  -- the meaningful Dead Hang breathing context; archive the obsolete imports.
  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id = variant.id
    AND variant.definition_id = ANY(target_ids)
    AND profile.status <> 'archived'
    AND NOT (
      variant.definition_id = dead_id
      AND variant.variant_key = 'baseline'
      AND profile.profile_key = 'restore-nasal-breathing'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM hang_variant_seed seed
      JOIN coaching.exercise_definition_v1 definition
        ON definition.slug = seed.definition_slug
       AND definition.facility_id = facility
      WHERE definition.id = variant.definition_id
        AND seed.variant_key = variant.variant_key
        AND seed.profile_key = profile.profile_key
    );

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
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    status
  )
  SELECT
    variant.id,
    seed.profile_key,
    seed.phase_key,
    seed.role,
    seed.purpose,
    seed.phase_suitability,
    CASE
      WHEN seed.phase_key = 'movement_intelligence' THEN 90
      WHEN seed.phase_key = 'prepare_and_access' THEN 82
      ELSE 72
    END,
    jsonb_build_object(
      'grip_capacity', CASE WHEN seed.phase_key = 'capacity' THEN 90 ELSE 55 END,
      'scapular_control', CASE
        WHEN seed.definition_slug = 'dead-hang' THEN 45
        ELSE 90
      END,
      'overhead_position_access', 75,
      'pulling_preparation', CASE
        WHEN seed.definition_slug = 'dead-hang' THEN 55
        ELSE 82
      END
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'sets', seed.sets_count,
      'reps', seed.reps_count,
      'workSeconds', seed.work_seconds,
      'restSeconds', seed.rest_seconds,
      'rpeCeiling', seed.rpe_ceiling,
      'tempo', CASE
        WHEN seed.definition_slug = 'scapular-pull-up'
          THEN 'small_controlled_pull_one_second_pause_controlled_return'
        ELSE 'quiet_mount_still_hold_controlled_step_down'
      END,
      'reserveRule',
        'Stop with secure grip, declared shoulder-mode control, and a controlled exit still available.'
    )),
    CASE seed.definition_slug
      WHEN 'dead-hang'
        THEN 'Secure grip, straight elbows, comfortable passive shoulder position, quiet body, and controlled step-down remain repeatable.'
      WHEN 'active-hang'
        THEN 'Secure grip, straight elbows, small active scapular position, quiet body, normal breathing, and controlled step-down remain repeatable.'
      ELSE
        'Secure grip, straight elbows, visible scapular-only motion, controlled return, quiet trunk, and controlled step-down remain repeatable.'
    END,
    ARRAY[
      'Stop for pain, pinching, instability, numbness, or tingling.',
      'Stop for dizziness, breath distress, or panic.',
      'Stop when the grip opens or slips.',
      'Stop when elbows bend or the declared shoulder mode changes.',
      'Stop for uncontrolled swing or an unsafe dismount.'
    ]::TEXT[],
    CASE seed.definition_slug
      WHEN 'dead-hang'
        THEN 'Confirm passive mode, anchor, grip, assistance, stillness, reserve, and step-down. Do not claim decompression, healing, or injury prevention.'
      WHEN 'active-hang'
        THEN 'Confirm a small active position rather than maximal forced depression; watch grip, straight elbows, scapular drift, body swing, reserve, and exit.'
      ELSE
        'Demonstrate the small scapular range; watch straight elbows, first-to-last range, controlled return, grip, swing, reserve, and exit.'
    END,
    CASE seed.definition_slug
      WHEN 'dead-hang'
        THEN 'Grip securely, keep your arms straight, let your shoulders take the assigned passive position, stay still, and step down early.'
      WHEN 'active-hang'
        THEN 'Grip securely, keep straight arms, draw your shoulders slightly from your ears, hold a quiet body, and step down before the position changes.'
      ELSE
        'Grip securely, keep straight arms, move only through your shoulder blades, return slowly, avoid swinging, and step down before quality changes.'
    END,
    CASE seed.definition_slug
      WHEN 'dead-hang'
        THEN 'Submaximal grip and passive overhead-position tolerance in the declared context.'
      WHEN 'active-hang'
        THEN 'Repeatable active straight-arm scapular-position control with submaximal grip demand.'
      ELSE
        'Repeatable dynamic scapular depression and controlled return under the declared hanging load.'
    END,
    seed.equipment_required,
    jsonb_build_object(
      'stationCapacity', 1,
      'setup', 'Coach checks anchor, clearance, height, assistance, grip option, and exit before work.',
      'turnover', 'Athlete restores stable foot contact before the next athlete approaches.',
      'supervision', CASE
        WHEN seed.supervision >= 60 THEN 'direct_every_attempt'
        WHEN seed.supervision >= 40 THEN 'direct_until_repeatable'
        ELSE 'coach_visible'
      END,
      'bandSafety', CASE
        WHEN seed.variant_key = 'band-assisted'
          THEN 'Coach manages band condition, entry, body path, recoil, and exit.'
        ELSE 'not_applicable'
      END,
      'loadSafety', CASE
        WHEN seed.variant_key = 'weighted'
          THEN 'Secure load and remove it before dismount; no improvised attachment.'
        ELSE 'not_applicable'
      END
    ),
    jsonb_build_object(
      'setupSeconds', 30,
      'workSeconds', COALESCE(
        seed.work_seconds,
        seed.reps_count * CASE
          WHEN seed.definition_slug = 'scapular-pull-up' THEN 4
          ELSE 1
        END
      ),
      'restSeconds', seed.rest_seconds,
      'transitionSeconds', 20,
      'expectedTotalSeconds',
        30
        + seed.sets_count * (
          COALESCE(
            seed.work_seconds,
            seed.reps_count * CASE
              WHEN seed.definition_slug = 'scapular-pull-up' THEN 4
              ELSE 1
            END
          )
          + seed.rest_seconds
        )
        + 20,
      'groupPlanning',
        'Multiply station positions by work-rest turnover; never queue an athlete under the implement.'
    ),
    jsonb_build_object(
      'regressBy', jsonb_build_array(
        'add_stable_foot_contact',
        'use_managed_band_assistance',
        'shorten_time_or_repetitions',
        'increase_rest',
        'use_a_supported_non_hanging_substitute'
      ),
      'progressBy', jsonb_build_array(
        'reduce_assistance',
        'add_small_time_or_repetitions',
        'change_implement',
        'add_load_or_unilateral_demand_only_after_all_quality_criteria'
      ),
      'cohortRule',
        'Choose exact variants individually; do not assign one difficulty or dose to the entire class.',
      'noLevelRule',
        'Scaling follows readiness and measured difficulty, not an exercise-card skill level.'
    ),
    jsonb_build_object(
      'record', CASE
        WHEN seed.definition_slug = 'scapular-pull-up'
          THEN jsonb_build_array(
            'implement', 'grip', 'assistance', 'load', 'sets', 'repetitions',
            'rest', 'range_quality', 'elbow_position', 'swing', 'symptoms', 'exit_quality'
          )
        ELSE jsonb_build_array(
          'implement', 'grip', 'assistance', 'load', 'sets', 'hold_seconds',
          'rest', 'shoulder_mode', 'body_control', 'symptoms', 'exit_quality'
        )
      END,
      'success',
        'All assigned work remains symptom-free, repeatable, and submaximal with a secure grip and controlled exit.',
      'failure',
        'Any stop rule, assistance drift, grip slip, elbow bend, shoulder-mode loss, uncontrolled swing, or unsafe exit.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Can you keep your grip, straight arms, assigned shoulder mode, quiet body, normal breathing, and a safe step-down?',
      'coachPrompt',
        'Verify identity, assistance, cumulative grip load, first-to-last quality, stop rules, and exit before progressing.',
      'supportPrompt',
        'If the athlete cannot safely grip, hang overhead, follow the mode, or exit, substitute a supported task and document why.',
      'mediaPrompt',
        'Candidate video is optional and unapproved; provide text, stills, and a live demonstration.'
    ),
    'review'
  FROM hang_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = facility
   AND definition.slug = seed.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  ON CONFLICT (variant_id, profile_key) DO UPDATE SET
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
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    status = 'review',
    updated_at = now();

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET phase_key = 'restore',
      role = 'conditional',
      purpose = 'Brief supported or full Dead Hang with calm breathing; a contextual restore exposure, not a separate identity, treatment, or maximum-time test.',
      phase_suitability = 72,
      methodology_alignment = 65,
      objective_relevance_json = jsonb_build_object(
        'overhead_position_access', 78,
        'calm_breathing', 72,
        'grip_capacity', 35
      ),
      dosage_json = jsonb_build_object(
        'sets', 2,
        'workSeconds', 10,
        'restSeconds', 45,
        'rpeCeiling', 4,
        'breathing', 'quiet_nasal_breathing_when_comfortable',
        'reserveRule', 'Step down while grip, breathing, position, and exit remain easy.'
      ),
      quality_gate = 'Grip, breathing, straight elbows, passive shoulder position, body stillness, and step-down remain calm and repeatable.',
      stop_rules = ARRAY[
        'Stop for pain, pinching, instability, numbness, or tingling.',
        'Stop when grip starts to open or slip.',
        'Stop for dizziness, breath distress, or panic.',
        'Stop for uncontrolled swing or an unsafe step-down.'
      ]::TEXT[],
      coach_instructions = 'Confirm passive mode, provide foot assistance early, keep the dose submaximal, and do not claim decompression, healing, or injury prevention.',
      athlete_instructions = 'Grip securely, keep straight arms, let your shoulders take the assigned passive position, breathe calmly, and step down early.',
      expected_adaptation = 'Brief passive overhead-position and grip exposure without meaningful fatigue.',
      equipment_required = ARRAY['bar_or_rings']::TEXT[],
      logistics_json = jsonb_build_object(
        'stationCapacity', 1,
        'setup', 'Check anchor, clearance, grip, assistance, and step-down.',
        'turnover', 'Restore foot contact before the next athlete approaches.',
        'supervision', 'coach_visible'
      ),
      time_model_json = jsonb_build_object(
        'setupSeconds', 30,
        'workSeconds', 10,
        'restSeconds', 45,
        'transitionSeconds', 20,
        'expectedTotalSeconds', 160
      ),
      dose_scaling_json = jsonb_build_object(
        'regressBy', jsonb_build_array('foot_assistance', 'shorter_hold', 'longer_rest'),
        'progressBy', jsonb_build_array('reduce_assistance', 'add_small_time_only'),
        'noLevelRule', 'Scale by readiness and measured difficulty, not an exercise-card skill level.'
      ),
      measurement_json = jsonb_build_object(
        'record', jsonb_build_array(
          'implement', 'grip', 'assistance', 'hold_seconds', 'rest',
          'breathing', 'symptoms', 'body_control', 'exit_quality'
        ),
        'success', 'Calm, symptom-free holds finish with clear reserve and controlled step-down.'
      ),
      support_prompts_json = jsonb_build_object(
        'athletePrompt', 'Can you breathe calmly and step down while your grip is still secure?',
        'coachPrompt', 'Verify passive mode and stop before fatigue changes breathing, grip, or exit.',
        'mediaPrompt', 'Candidate media is optional and unapproved.'
      ),
      status = 'review',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE profile.variant_id = variant.id
    AND variant.definition_id = dead_id
    AND variant.variant_key = 'baseline'
    AND profile.profile_key = 'restore-nasal-breathing';

  -- Candidate graph proposals. These encode reviewed dimensions and rationale
  -- but do not grant coach approval.
  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status
  )
  SELECT
    source_variant.id,
    target_variant.id,
    seed.relationship,
    seed.similarity,
    seed.dimensions,
    seed.reason,
    jsonb_build_object(
      'humanReviewRequired', TRUE,
      'createdByMigration', migration_key
    ),
    'review'
  FROM (
    VALUES
      ('dead-hang', 'foot-assisted', 'dead-hang', 'baseline', 'progression', 96, ARRAY['load']::TEXT[],
        'Removing stable foot assistance increases relative grip and overhead-position load while preserving passive hang identity.'),
      ('dead-hang', 'band-assisted', 'dead-hang', 'baseline', 'progression', 94, ARRAY['load', 'stability']::TEXT[],
        'Removing band assistance increases bodyweight demand and removes changing elastic support.'),
      ('dead-hang', 'baseline', 'dead-hang', 'ring', 'progression', 92, ARRAY['stability']::TEXT[],
        'Rings preserve passive hanging but increase implement stabilization and grip-orientation demand.'),
      ('dead-hang', 'baseline', 'dead-hang', 'weighted', 'progression', 91, ARRAY['load', 'fatigue']::TEXT[],
        'Added load increases grip, overhead-position, recovery, attachment, and exit demands.'),
      ('dead-hang', 'baseline', 'dead-hang', 'single-arm', 'progression', 86, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Unilateral suspension increases load per limb, asymmetry control, and failure consequence.'),
      ('active-hang', 'foot-assisted', 'active-hang', 'baseline', 'progression', 96, ARRAY['load']::TEXT[],
        'Removing stable foot assistance increases relative grip and active scapular isometric demand.'),
      ('active-hang', 'band-assisted', 'active-hang', 'baseline', 'progression', 94, ARRAY['load', 'stability']::TEXT[],
        'Removing band assistance increases bodyweight demand and removes elastic support logistics.'),
      ('active-hang', 'baseline', 'active-hang', 'ring', 'progression', 92, ARRAY['stability']::TEXT[],
        'Rings preserve active isometric identity while increasing implement stabilization.'),
      ('active-hang', 'baseline', 'active-hang', 'weighted', 'progression', 90, ARRAY['load', 'fatigue']::TEXT[],
        'Added load increases grip, scapular isometric, recovery, attachment, and exit demands.'),
      ('active-hang', 'baseline', 'active-hang', 'single-arm', 'progression', 85, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Unilateral active suspension increases limb load, asymmetry control, and failure consequence.'),
      ('scapular-pull-up', 'foot-assisted', 'scapular-pull-up', 'baseline', 'progression', 96, ARRAY['load']::TEXT[],
        'Removing stable foot assistance increases relative grip and dynamic scapular load.'),
      ('scapular-pull-up', 'band-assisted', 'scapular-pull-up', 'baseline', 'progression', 94, ARRAY['load', 'stability']::TEXT[],
        'Removing band assistance increases bodyweight demand and removes changing elastic support.'),
      ('scapular-pull-up', 'baseline', 'scapular-pull-up', 'ring', 'progression', 91, ARRAY['stability', 'complexity']::TEXT[],
        'Rings preserve scapular repetitions while increasing stabilization and grip-orientation demand.'),
      ('scapular-pull-up', 'baseline', 'scapular-pull-up', 'weighted', 'progression', 89, ARRAY['load', 'fatigue']::TEXT[],
        'Added load increases dynamic scapular, grip, recovery, attachment, and exit demands.'),
      ('scapular-pull-up', 'baseline', 'scapular-pull-up', 'single-arm', 'progression', 83, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Unilateral dynamic suspension increases limb load, asymmetry control, and failure consequence.'),
      ('dead-hang', 'baseline', 'active-hang', 'baseline', 'progression', 82, ARRAY['load', 'complexity']::TEXT[],
        'Active Hang retains straight-arm suspension but adds intentional scapular isometric force.'),
      ('active-hang', 'baseline', 'scapular-pull-up', 'baseline', 'progression', 84, ARRAY['range', 'complexity', 'fatigue']::TEXT[],
        'Scapular Pull-Up retains straight arms and active scapular control but adds repeated motion and controlled return.')
  ) AS seed(
    from_slug,
    from_variant,
    to_slug,
    to_variant,
    relationship,
    similarity,
    dimensions,
    reason
  )
  JOIN coaching.exercise_definition_v1 source_definition
    ON source_definition.facility_id = facility
   AND source_definition.slug = seed.from_slug
   AND source_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = source_definition.id
   AND source_variant.variant_key = seed.from_variant
  JOIN coaching.exercise_definition_v1 target_definition
    ON target_definition.facility_id = facility
   AND target_definition.slug = seed.to_slug
   AND target_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = target_definition.id
   AND target_variant.variant_key = seed.to_variant
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review';

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE definition.slug
        WHEN 'dead-hang' THEN 18
        WHEN 'active-hang' THEN 28
        ELSE 38
      END,
      absolute_load_demand = CASE definition.slug
        WHEN 'dead-hang' THEN 52
        WHEN 'active-hang' THEN 58
        ELSE 62
      END,
      coordination_demand = CASE definition.slug
        WHEN 'dead-hang' THEN 20
        WHEN 'active-hang' THEN 30
        ELSE 42
      END,
      impact = 1,
      supervision_demand = CASE definition.slug
        WHEN 'dead-hang' THEN 35
        WHEN 'active-hang' THEN 35
        ELSE 40
      END,
      base_overall_difficulty = CASE definition.slug
        WHEN 'dead-hang' THEN 52
        WHEN 'active-hang' THEN 58
        ELSE 62
      END,
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'exerciseComplexity', CASE definition.slug
          WHEN 'dead-hang' THEN 18
          WHEN 'active-hang' THEN 28
          ELSE 38
        END,
        'physicalDifficulty', CASE definition.slug
          WHEN 'dead-hang' THEN 52
          WHEN 'active-hang' THEN 58
          ELSE 62
        END,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      migration_confidence = 74,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Candidate research reassessment only; independent human calibration is required before publication.',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND score.exercise_id = definition.legacy_exercise_id;

  UPDATE coaching.exercise
  SET skill_level = NULL,
      why_publish_ready = FALSE,
      updated_at = now()
  WHERE id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_v1
    WHERE id = ANY(target_ids)
  );

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required
  )
  SELECT
    definition.id,
    definition.facility_id,
    definition.card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '309_coaching_hang_identity_split_and_consolidation',
      'completenessMigration', migration_key,
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'formalProficiencyClassification', 'skill_library_only',
      'exerciseCardProficiencyLevel', 'not_applicable',
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
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
    TRUE
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
  ON CONFLICT (definition_id) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END
$$;
