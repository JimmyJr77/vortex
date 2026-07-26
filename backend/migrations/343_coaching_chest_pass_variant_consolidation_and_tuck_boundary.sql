-- Resolve the two high-similarity pairs introduced when migration 342 made
-- ambiguous names explicit.
--
-- Countermovement is an exact variant of the broader forward two-hand
-- medicine-ball chest-pass identity, so the completed variants and all source
-- lineage are consolidated into Medicine Ball Chest Pass. Tuck Jump to Lateral
-- Stick remains distinct from Bilateral Lateral Jump to Stick because the tuck
-- jump adds a vertical tuck and a different action/contact sequence before the
-- terminal lateral landing.
--
-- No human, media, graph, calibration, or publication approval is created.
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Exercise cards receive no skill or
-- proficiency level. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '343_coaching_chest_pass_variant_consolidation_and_tuck_boundary';
  chest_definition_id UUID;
  countermovement_definition_id UUID;
  rotational_definition_id UUID;
  lateral_definition_id UUID;
  tuck_definition_id UUID;
  chest_legacy_id BIGINT;
  countermovement_legacy_id BIGINT;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  SELECT id, legacy_exercise_id, facility_id
  INTO chest_definition_id, chest_legacy_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-chest-pass'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id
  INTO countermovement_definition_id, countermovement_legacy_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-countermovement-throw'
    AND facility_id = facility;

  SELECT id
  INTO lateral_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'lateral-hop-to-stick'
    AND facility_id = facility
    AND status <> 'archived';

  SELECT id
  INTO tuck_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'tuck-jump-to-lateral-stick'
    AND facility_id = facility
    AND status <> 'archived';

  SELECT id
  INTO rotational_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'med-ball-countermovement-rotational-throw'
    AND facility_id = facility
    AND status <> 'archived';

  IF chest_definition_id IS NULL
    OR countermovement_definition_id IS NULL
    OR rotational_definition_id IS NULL
    OR lateral_definition_id IS NULL
    OR tuck_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Chest-pass consolidation and tuck boundary require all four definitions';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id IN (chest_definition_id, countermovement_definition_id)
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id IN (
        chest_definition_id,
        countermovement_definition_id
      )
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (
            chest_definition_id,
            countermovement_definition_id
          )
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (
            chest_definition_id,
            countermovement_definition_id
          )
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
      WHERE calibration.variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id IN (
          chest_definition_id,
          countermovement_definition_id
        )
      )
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Chest-pass consolidation refused to override % protected records',
      protected_records;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = chest_definition_id
        AND resolution.resolved_definition_id =
          countermovement_definition_id
      )
      OR (
        resolution.survivor_definition_id =
          countermovement_definition_id
        AND resolution.resolved_definition_id = chest_definition_id
      )
    )
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      'Chest-pass consolidation conflicts with a distinct-exercises decision';
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE variant_key
        WHEN 'baseline' THEN 'legacy-generic-chest-pass-source'
        ELSE variant_key
      END,
      display_name = CASE variant_key
        WHEN 'baseline' THEN 'Legacy Generic Medicine-Ball Chest Pass Source'
        ELSE display_name
      END,
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare exact stance, preload, ball mass, target, contacts, return, dose, or stop contract. Use an exact reviewed chest-pass variant.'
      ),
      updated_at = now()
  WHERE definition_id = chest_definition_id
    AND variant_key IN ('baseline', 'baseline-source-354')
    AND status <> 'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = chest_definition_id
    AND variant.status = 'archived';

  DELETE FROM coaching.exercise_section_evidence_v1 duplicate_evidence
  USING coaching.exercise_section_evidence_v1 survivor_evidence
  WHERE duplicate_evidence.definition_id = countermovement_definition_id
    AND survivor_evidence.definition_id = chest_definition_id
    AND survivor_evidence.reviewed_card_version =
      duplicate_evidence.reviewed_card_version
    AND survivor_evidence.section_key = duplicate_evidence.section_key
    AND survivor_evidence.source_url = duplicate_evidence.source_url;

  UPDATE coaching.exercise_section_evidence_v1
  SET definition_id = chest_definition_id,
      updated_at = now()
  WHERE definition_id = countermovement_definition_id;

  DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
  USING coaching.exercise_media_candidate_v1 survivor_media
  WHERE duplicate_media.definition_id = countermovement_definition_id
    AND survivor_media.definition_id = chest_definition_id
    AND survivor_media.reviewed_card_version =
      duplicate_media.reviewed_card_version
    AND survivor_media.video_id = duplicate_media.video_id;

  UPDATE coaching.exercise_media_candidate_v1
  SET definition_id = chest_definition_id,
      notes = concat_ws(
        ' ',
        notes,
        'Preserved from the consolidated countermovement chest-pass source; candidate metadata does not establish human viewing or approval.'
      ),
      updated_at = now()
  WHERE definition_id = countermovement_definition_id;

  DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
  USING coaching.exercise_alternate_assessment_v1 survivor_alternate
  WHERE duplicate_alternate.definition_id = countermovement_definition_id
    AND survivor_alternate.definition_id = chest_definition_id
    AND survivor_alternate.reviewed_card_version =
      duplicate_alternate.reviewed_card_version
    AND lower(survivor_alternate.alternate_name) =
      lower(duplicate_alternate.alternate_name);

  UPDATE coaching.exercise_alternate_assessment_v1
  SET definition_id = chest_definition_id,
      updated_at = now()
  WHERE definition_id = countermovement_definition_id;

  UPDATE coaching.exercise_variant_v1
  SET definition_id = chest_definition_id,
      updated_at = now()
  WHERE definition_id = countermovement_definition_id;

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id = chest_definition_id
  WHERE definition_id = countermovement_definition_id;

  UPDATE coaching.exercise_definition_v1 survivor
  SET canonical_name = 'Medicine Ball Chest Pass',
      display_name = 'Medicine Ball Chest Pass',
      aliases = (
        SELECT ARRAY_AGG(DISTINCT alias_value ORDER BY alias_value)
        FROM unnest(
          survivor.aliases
          || resolved.aliases
          || ARRAY[
            'Countermovement Medicine-Ball Chest Pass',
            'Medicine Ball Countermovement Throw',
            'Med Ball Countermovement Throw',
            'Countermovement Medicine Ball Chest Throw',
            'Squat to Medicine-Ball Chest Pass'
          ]::TEXT[]
        ) AS alias_value
        WHERE btrim(alias_value) <> ''
          AND lower(btrim(alias_value)) <> 'medicine ball chest pass'
      ),
      description =
        'Face an inspected wall or trained partner with one exact medicine ball held at the chest. Use the exact reviewed stationary, shallow-countermovement, squat-countermovement, kneeling, or other declared chest-pass variant; project the ball forward from the chest with two hands, finish with declared contacts, wait for the return path, retrieve or receive only as prescribed, and fully reset.',
      family_key = 'forward_medicine_ball_chest_projection',
      card_version = greatest(survivor.card_version, resolved.card_version),
      status = 'review',
      content_confidence = greatest(
        coalesce(survivor.content_confidence, 1),
        coalesce(resolved.content_confidence, 1)
      ),
      scoring_confidence = greatest(
        coalesce(survivor.scoring_confidence, 1),
        coalesce(resolved.scoring_confidence, 1)
      ),
      media_confidence = greatest(
        coalesce(survivor.media_confidence, 1),
        coalesce(resolved.media_confidence, 1)
      ),
      movement_patterns = resolved.movement_patterns,
      body_regions = resolved.body_regions,
      required_equipment = resolved.required_equipment,
      optional_equipment = resolved.optional_equipment,
      environment_json = resolved.environment_json,
      population_json = resolved.population_json,
      anatomy_json = resolved.anatomy_json,
      athlete_support_json = resolved.athlete_support_json,
      coach_support_json = resolved.coach_support_json,
      support_operations_json = resolved.support_operations_json,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = survivor.provenance_json || jsonb_build_object(
        'identityMigration', migration_key,
        'identityResolution',
          'forward_medicine_ball_chest_projection_with_exact_preload_variants',
        'consolidatedLegacyExerciseIds',
          COALESCE(
            survivor.provenance_json -> 'consolidatedLegacyExerciseIds',
            '[]'::JSONB
          ) || to_jsonb(countermovement_legacy_id),
        'consolidatedDefinitionIds',
          COALESCE(
            survivor.provenance_json -> 'consolidatedDefinitionIds',
            '[]'::JSONB
          ) || to_jsonb(countermovement_definition_id),
        'researchBatch',
          'countermovement-medicine-ball-projection-boundary-v1',
        'structuralCompletionMigration',
          '342_coaching_researched_identity_boundary_card_completion',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 resolved
  WHERE survivor.id = chest_definition_id
    AND resolved.id = countermovement_definition_id;

  UPDATE coaching.exercise_definition_v1
  SET status = 'archived',
      legacy_exercise_id = NULL,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'archivedByIdentityMigration', migration_key,
        'survivorDefinitionId', chest_definition_id,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = countermovement_definition_id;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  VALUES (
    facility,
    chest_definition_id,
    countermovement_definition_id,
    'duplicate_consolidated',
    'The countermovement card preserves the same forward two-hand medicine-ball chest projection. Shallow versus squat countermovement changes preload, lower-body contribution, exercise complexity, and physical difficulty but belongs on exact chest-pass variants rather than a separate exercise definition.',
    jsonb_build_object(
      'match', 'forward_two_hand_medicine_ball_chest_projection',
      'survivorSlug', 'medicine-ball-chest-pass',
      'resolvedSlug', 'medicine-ball-countermovement-throw',
      'variantDimensions', jsonb_build_array(
        'preload',
        'squat_depth',
        'lower_body_contribution',
        'contacts',
        'target_and_return'
      ),
      'researchBatch',
        'countermovement-medicine-ball-projection-boundary-v1',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'migration', migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  )
  ON CONFLICT (
    survivor_definition_id,
    resolved_definition_id
  )
  DO UPDATE SET
    decision = EXCLUDED.decision,
    rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json,
    resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL,
    resolved_at = now();

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = rotational_definition_id
        AND resolution.resolved_definition_id = chest_definition_id
      )
      OR (
        resolution.survivor_definition_id = chest_definition_id
        AND resolution.resolved_definition_id = rotational_definition_id
      )
    )
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION
      'Rotational versus chest-pass boundary conflicts with a duplicate consolidation';
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  VALUES (
    facility,
    rotational_definition_id,
    chest_definition_id,
    'distinct_exercises',
    'Countermovement Rotational Medicine-Ball Throw uses a side-on, side-specific transverse projection with hip-pelvis-trunk rotation. Medicine Ball Chest Pass uses a front-facing bilateral forward chest projection. Projection plane, orientation, laterality, joint sequence, target, and side dosage are identity-defining differences.',
    jsonb_build_object(
      'identityBoundary',
        'transverse_side_specific_rotational_projection_vs_forward_bilateral_chest_projection',
      'rotationalContract', jsonb_build_object(
        'projection', 'transverse_rotational',
        'orientation', 'side_on',
        'laterality', 'declared_side_specific'
      ),
      'chestPassContract', jsonb_build_object(
        'projection', 'forward_horizontal_chest',
        'orientation', 'front_facing',
        'laterality', 'bilateral'
      ),
      'changedDimensions', jsonb_build_array(
        'projection_plane',
        'stance_orientation',
        'laterality',
        'joint_sequence',
        'target',
        'side_dosage'
      ),
      'researchBatch',
        'countermovement-medicine-ball-projection-boundary-v1',
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'humanReviewRequired', FALSE,
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'proficiencyClassificationScope',
        'coaching_skill_library_only',
      'migration', migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  )
  ON CONFLICT (
    survivor_definition_id,
    resolved_definition_id
  )
  DO UPDATE SET
    decision = EXCLUDED.decision,
    rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json,
    resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL,
    resolved_at = now();

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = lateral_definition_id
        AND resolution.resolved_definition_id = tuck_definition_id
      )
      OR (
        resolution.survivor_definition_id = tuck_definition_id
        AND resolution.resolved_definition_id = lateral_definition_id
      )
    )
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION
      'Tuck-jump boundary conflicts with a duplicate consolidation';
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  VALUES (
    facility,
    lateral_definition_id,
    tuck_definition_id,
    'distinct_exercises',
    'Bilateral Lateral Jump to Stick begins with a bilateral lateral projection and ends in a bilateral terminal stick. Tuck Jump to Lateral Stick adds a vertical tuck-jump action and a different flight, hip-flexion, contact, and reorientation sequence before the lateral terminal landing.',
    jsonb_build_object(
      'identityBoundary',
        'bilateral_lateral_projection_vs_tuck_jump_then_lateral_stick_sequence',
      'leftActions', jsonb_build_array(
        'bilateral_lateral_jump',
        'bilateral_landing',
        'terminal_stick'
      ),
      'rightActions', jsonb_build_array(
        'vertical_tuck_jump',
        'landing_or_reorientation',
        'lateral_terminal_stick'
      ),
      'changedDimensions', jsonb_build_array(
        'action_sequence',
        'projection_direction',
        'flight_shape',
        'hip_flexion',
        'contact_count',
        'reorientation',
        'impact_and_fatigue'
      ),
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'humanReviewRequired', FALSE,
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'proficiencyClassificationScope',
        'coaching_skill_library_only',
      'migration', migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  )
  ON CONFLICT (
    survivor_definition_id,
    resolved_definition_id
  )
  DO UPDATE SET
    decision = EXCLUDED.decision,
    rationale = EXCLUDED.rationale,
    evidence_json = EXCLUDED.evidence_json,
    resolution_source = EXCLUDED.resolution_source,
    reviewed_by = NULL,
    resolved_at = now();

  UPDATE coaching.exercise legacy
  SET name = 'Medicine Ball Chest Pass',
      description = (
        SELECT definition.description
        FROM coaching.exercise_definition_v1 definition
        WHERE definition.id = chest_definition_id
      ),
      instructions =
        'Declare the exact chest-pass variant, ball and mass, stance or preload, forward target, contacts, attempts, rest, return policy, and stop signal. Project forward from the chest, finish, wait, retrieve or receive only as prescribed, and reset.',
      card_summary =
        'Forward two-hand medicine-ball chest projection with exact stationary or countermovement variant, ball, stance, target, contacts, return, output budget, and full reset.',
      coach_language =
        'Observe exact variant, ball, stance or preload, lower-to-upper-body force transfer, ribs and pelvis, forward chest release, contacts, target, return, output, symptoms, and stop response.',
      athlete_language =
        'Ball at chest, use the declared start, pass straight forward, finish balanced, wait, reset.',
      movement_family = 'Forward medicine-ball chest projection',
      primary_phase_key = 'output',
      phase_subrole = 'jump_throw_explosive_power',
      primary_order_slot = 'medicine_ball_chest_pass',
      archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      programming_logic = jsonb_build_object(
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'identityRule',
          'select_exact_forward_chest_projection_stance_preload_contact_target_return_and_measurement_contract',
        'fatigueRule',
          'stop_before_speed_accuracy_posture_contact_or_lane_discipline_declines'
      ),
      media_library = jsonb_build_object(
        'candidateCount',
          (
            SELECT COUNT(*)
            FROM coaching.exercise_media_candidate_v1 media
            WHERE media.definition_id = chest_definition_id
              AND media.reviewed_card_version = (
                SELECT card_version
                FROM coaching.exercise_definition_v1
                WHERE id = chest_definition_id
              )
              AND media.review_status = 'candidate'
          ),
        'approvalStatus', 'human_review_required',
        'approvedVideoUrl', NULL
      ),
      updated_at = now()
  WHERE legacy.id = chest_legacy_id;

  UPDATE coaching.exercise
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      updated_at = now()
  WHERE id = countermovement_legacy_id;

  UPDATE coaching.exercise_scaling_profile
  SET skill_level = NULL
  WHERE exercise_id IN (chest_legacy_id, countermovement_legacy_id);

  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level = NULL
  WHERE exercise_id IN (chest_legacy_id, countermovement_legacy_id);

  DELETE FROM coaching.exercise_card_test_packet_v1
  WHERE definition_id = countermovement_definition_id;

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = chest_definition_id;
END
$$;
