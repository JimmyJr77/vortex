-- Replace the three deliberately quarantined high-similarity pairs with
-- deterministic, source-backed movement-contract boundaries and consolidate
-- the low-amplitude bilateral lateral-jump source into its canonical family.
--
-- These decisions are identity-only. They create no human, media, graph,
-- calibration, or publication approval. All affected cards remain review-only
-- and publication-quarantined. Exercise difficulty is exercise complexity plus
-- physical difficulty, with overall derived as their maximum. Exercise cards
-- receive no skill or proficiency level. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '341_coaching_remaining_identity_boundaries_researched';
  boundary RECORD;
  left_definition_id UUID;
  right_definition_id UUID;
  facility BIGINT;
  low_amplitude_definition_id UUID;
  lateral_definition_id UUID;
  low_amplitude_legacy_id BIGINT;
  protected_records INTEGER;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'dead-bug-wall-press',
        'medicine-ball-dead-bug-press',
        'bilateral_fixed_wall_press_with_leg_only_motion_vs_contralateral_ball_press_with_opposite_arm_and_leg_motion',
        'Dead Bug Wall Press uses both hands against a fixed wall while one declared leg moves. Medicine-Ball Dead Bug Press holds a movable ball between one declared hand and the opposite knee while the free opposite arm and leg move. Force source, pressing limbs, moving limbs, coordination, and equipment are identity-defining differences.',
        '{
          "leftContract":{
            "forceSource":"fixed_wall",
            "pressingLimbs":"both_hands",
            "movingLimbs":"one_declared_leg_at_a_time"
          },
          "rightContract":{
            "forceSource":"medicine_ball_between_contralateral_limbs",
            "pressingLimbs":"one_declared_hand_and_opposite_knee",
            "movingLimbs":"free_opposite_arm_and_leg"
          },
          "changedDimensions":[
            "force_source",
            "pressing_limbs",
            "moving_limbs",
            "coordination",
            "equipment"
          ],
          "researchBatch":"dead-bug-press-boundary-v1"
        }'::JSONB
      ),
      (
        'lateral-hop-to-stick',
        'single-leg-lateral-hop-to-stick',
        'bilateral_takeoff_and_landing_vs_ipsilateral_single_leg_takeoff_and_landing',
        'The generic lateral-hop source is made explicit as a bilateral lateral jump: two-foot takeoff, two-foot landing, terminal hold, and full reset. The single-leg card explicitly takes off and lands on the same declared leg. Support laterality, load distribution, balance demand, landing geometry, and side dosage are identity-defining differences.',
        '{
          "leftContract":{
            "canonicalName":"Bilateral Lateral Jump to Stick",
            "takeoff":"bilateral_two_foot",
            "landing":"bilateral_two_foot"
          },
          "rightContract":{
            "canonicalName":"Single-Leg Lateral Hop to Stick",
            "takeoff":"one_declared_leg",
            "landing":"same_declared_leg"
          },
          "changedDimensions":[
            "takeoff_laterality",
            "landing_laterality",
            "load_distribution",
            "balance_demand",
            "landing_geometry",
            "side_dosage"
          ],
          "researchBatch":"bilateral-lateral-jump-stick-boundary-v1"
        }'::JSONB
      ),
      (
        'med-ball-countermovement-rotational-throw',
        'medicine-ball-countermovement-throw',
        'transverse_side_specific_rotational_projection_vs_forward_bilateral_chest_projection',
        'The rotational source declares side-specific transverse projection, hip and thoracic rotation, and horizontal shoulder action. The generic countermovement source declares bilateral hip-and-knee dip-and-drive, pectoral and triceps contribution, elbow extension, and a forward wall target; it is made explicit as a forward chest pass. Projection plane, stance orientation, laterality, joint sequence, and target are identity-defining differences.',
        '{
          "leftContract":{
            "canonicalName":"Countermovement Rotational Medicine-Ball Throw",
            "projection":"transverse_rotational",
            "orientation":"side_on",
            "laterality":"declared_side_specific"
          },
          "rightContract":{
            "canonicalName":"Countermovement Medicine-Ball Chest Pass",
            "projection":"forward_horizontal_chest",
            "orientation":"front_facing",
            "laterality":"bilateral"
          },
          "changedDimensions":[
            "projection_plane",
            "stance_orientation",
            "laterality",
            "joint_sequence",
            "target"
          ],
          "researchBatch":"countermovement-medicine-ball-projection-boundary-v1"
        }'::JSONB
      )
    ) AS value(
      left_slug,
      right_slug,
      boundary_key,
      rationale,
      evidence_json
    )
  LOOP
    SELECT id, facility_id
    INTO left_definition_id, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND status <> 'archived';

    SELECT id
    INTO right_definition_id
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = facility
      AND status <> 'archived';

    IF left_definition_id IS NULL OR right_definition_id IS NULL THEN
      RAISE EXCEPTION
        'Identity boundary % requires active definitions for % and %',
        boundary.boundary_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_definition_id
          AND resolution.resolved_definition_id = right_definition_id
        )
        OR (
          resolution.survivor_definition_id = right_definition_id
          AND resolution.resolved_definition_id = left_definition_id
        )
      )
        AND resolution.decision = 'duplicate_consolidated'
    ) THEN
      RAISE EXCEPTION
        'Identity boundary % conflicts with an existing duplicate consolidation',
        boundary.boundary_key;
    END IF;

    UPDATE coaching.exercise_identity_resolution_v1
    SET survivor_definition_id = left_definition_id,
        resolved_definition_id = right_definition_id,
        decision = 'distinct_exercises',
        rationale = boundary.rationale,
        evidence_json = boundary.evidence_json || jsonb_build_object(
          'identityBoundary', boundary.boundary_key,
          'decisionScope',
            'identity_only_not_card_media_graph_calibration_or_publication_approval',
          'humanReviewRequired', FALSE,
          'exerciseDifficultyModel',
            'exercise_complexity_and_physical_difficulty_only',
          'proficiencyClassificationScope',
            'coaching_skill_library_only',
          'migration', migration_key
        ),
        resolution_source = 'deterministic_identity_equivalence',
        reviewed_by = NULL,
        resolved_at = now()
    WHERE (
      (
        survivor_definition_id = left_definition_id
        AND resolved_definition_id = right_definition_id
      )
      OR (
        survivor_definition_id = right_definition_id
        AND resolved_definition_id = left_definition_id
      )
    );

    IF NOT FOUND THEN
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
        left_definition_id,
        right_definition_id,
        'distinct_exercises',
        boundary.rationale,
        boundary.evidence_json || jsonb_build_object(
          'identityBoundary', boundary.boundary_key,
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
      );
    END IF;
  END LOOP;

  SELECT id, facility_id
  INTO lateral_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'lateral-hop-to-stick'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id
  INTO low_amplitude_definition_id, low_amplitude_legacy_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'lateral-hop-to-stick-low-amplitude'
    AND facility_id = facility;

  IF lateral_definition_id IS NULL OR low_amplitude_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Low-amplitude consolidation requires both lateral-jump definitions';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = low_amplitude_definition_id
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
      WHERE definition_id = low_amplitude_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = low_amplitude_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = low_amplitude_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = low_amplitude_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = low_amplitude_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = low_amplitude_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = low_amplitude_definition_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1
      WHERE from_variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = low_amplitude_definition_id
      )
         OR to_variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = low_amplitude_definition_id
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1
      WHERE variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = low_amplitude_definition_id
      )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Low-amplitude consolidation refused to override % protected records',
      protected_records;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = lateral_definition_id
        AND resolution.resolved_definition_id = low_amplitude_definition_id
      )
      OR (
        resolution.survivor_definition_id = low_amplitude_definition_id
        AND resolution.resolved_definition_id = lateral_definition_id
      )
    )
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      'Low-amplitude consolidation conflicts with a distinct-exercises decision';
  END IF;

  DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
  USING coaching.exercise_media_candidate_v1 survivor_media
  WHERE duplicate_media.definition_id = low_amplitude_definition_id
    AND survivor_media.definition_id = lateral_definition_id
    AND survivor_media.reviewed_card_version =
      duplicate_media.reviewed_card_version
    AND survivor_media.video_id = duplicate_media.video_id;

  UPDATE coaching.exercise_media_candidate_v1
  SET definition_id = lateral_definition_id,
      review_status = CASE
        WHEN review_status = 'candidate' THEN 'superseded'
        ELSE review_status
      END,
      notes = concat_ws(
        ' ',
        notes,
        'Preserved from the consolidated low-amplitude source; candidate metadata does not establish human viewing or approval.'
      ),
      updated_at = now()
  WHERE definition_id = low_amplitude_definition_id;

  UPDATE coaching.exercise_variant_v1
  SET definition_id = lateral_definition_id,
      variant_key = 'legacy-low-amplitude-source-221',
      display_name = 'Legacy Low-Amplitude Bilateral Lateral Jump Source',
      modifier_keys = ARRAY['low_amplitude', 'legacy_source']::TEXT[],
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'This legacy definition is an under-specified amplitude source for the bilateral lateral-jump identity. Use an exact reviewed variant.'
      ),
      updated_at = now()
  WHERE definition_id = low_amplitude_definition_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = lateral_definition_id
    AND variant.variant_key = 'legacy-low-amplitude-source-221';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id = lateral_definition_id
  WHERE definition_id = low_amplitude_definition_id;

  UPDATE coaching.exercise_definition_v1
  SET aliases = (
        SELECT ARRAY_AGG(DISTINCT alias_value ORDER BY alias_value)
        FROM unnest(
          aliases
          || ARRAY[
            'Lateral Hop to Stick — Low Amplitude',
            'Lateral Hop to Stick Low Amplitude',
            'Low-Amplitude Bilateral Lateral Jump to Stick'
          ]::TEXT[]
        ) AS alias_value
        WHERE btrim(alias_value) <> ''
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration', migration_key,
        'consolidatedLegacyExerciseIds',
          COALESCE(
            provenance_json -> 'consolidatedLegacyExerciseIds',
            '[]'::JSONB
          ) || to_jsonb(low_amplitude_legacy_id),
        'consolidatedDefinitionIds',
          COALESCE(
            provenance_json -> 'consolidatedDefinitionIds',
            '[]'::JSONB
          ) || to_jsonb(low_amplitude_definition_id),
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = lateral_definition_id;

  UPDATE coaching.exercise_definition_v1
  SET status = 'archived',
      legacy_exercise_id = NULL,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'archivedByIdentityMigration', migration_key,
        'survivorDefinitionId', lateral_definition_id,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = low_amplitude_definition_id;

  UPDATE coaching.exercise
  SET is_published = FALSE,
      archived = TRUE,
      skill_level = NULL,
      updated_at = now()
  WHERE id = low_amplitude_legacy_id;

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
    low_amplitude_definition_id,
    'duplicate_consolidated',
    'The low-amplitude card preserves the same bilateral two-foot lateral takeoff, bilateral two-foot landing, terminal hold, and full-reset identity. Amplitude changes physical difficulty and belongs on an exact variant rather than a separate definition.',
    jsonb_build_object(
      'match', 'bilateral_lateral_jump_to_terminal_stick',
      'survivorSlug', 'lateral-hop-to-stick',
      'resolvedSlug', 'lateral-hop-to-stick-low-amplitude',
      'changedDimension', 'amplitude_only',
      'researchBatch', 'bilateral-lateral-jump-stick-boundary-v1',
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

  UPDATE coaching.exercise
  SET skill_level = NULL,
      updated_at = now()
  WHERE slug IN (
    'dead-bug-wall-press',
    'medicine-ball-dead-bug-press',
    'lateral-hop-to-stick',
    'single-leg-lateral-hop-to-stick',
    'med-ball-countermovement-rotational-throw',
    'medicine-ball-countermovement-throw'
  );

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL
  FROM coaching.exercise exercise
  WHERE exercise.id = scaling.exercise_id
    AND exercise.slug IN (
      'dead-bug-wall-press',
      'medicine-ball-dead-bug-press',
      'lateral-hop-to-stick',
      'single-leg-lateral-hop-to-stick',
      'med-ball-countermovement-rotational-throw',
      'medicine-ball-countermovement-throw'
    );

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level = NULL
  FROM coaching.exercise exercise
  WHERE exercise.id = safety.exercise_id
    AND exercise.slug IN (
      'dead-bug-wall-press',
      'medicine-ball-dead-bug-press',
      'lateral-hop-to-stick',
      'single-leg-lateral-hop-to-stick',
      'med-ball-countermovement-rotational-throw',
      'medicine-ball-countermovement-throw'
    );
END
$$;
