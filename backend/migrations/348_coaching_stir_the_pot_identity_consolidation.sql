-- Consolidate Stir-the-Pot Plank into the stable Stir-the-Pot definition.
-- Both legacy cards prescribe the same forearms-on-stability-ball circular
-- plank. Knee versus toe support, circle size, foot width, repetitions, and
-- population framing are variant or delivery dimensions.
--
-- No approval is created. Candidate-only research may move; reviewed,
-- published, approved, graph, calibration, or revision state fails closed.
-- Exercise cards use complexity and physical difficulty, never skill levels.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '348_coaching_stir_the_pot_identity_consolidation';
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  SELECT id, card_version, facility_id
  INTO survivor_id, survivor_version, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'stir-the-pot'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id, status
  INTO duplicate_id, duplicate_legacy_id, duplicate_status
  FROM coaching.exercise_definition_v1
  WHERE slug = 'stir-the-pot-plank'
    AND facility_id = facility;

  IF survivor_id IS NULL THEN
    RAISE EXCEPTION
      '% requires the active stir-the-pot survivor',
      migration_key;
  END IF;

  IF duplicate_id IS NULL THEN
    RAISE EXCEPTION
      '% requires the stir-the-pot-plank source definition',
      migration_key;
  END IF;

  IF duplicate_status = 'archived' AND EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.survivor_definition_id = survivor_id
      AND resolution.resolved_definition_id = duplicate_id
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
      )
      OR (
        resolution.survivor_definition_id = duplicate_id
        AND resolution.resolved_definition_id = survivor_id
      )
    )
      AND (
        resolution.decision = 'distinct_exercises'
        OR resolution.resolution_source = 'human_review'
      )
  ) THEN
    RAISE EXCEPTION
      '% conflicts with a protected identity decision',
      migration_key;
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id IN (survivor_id, duplicate_id)
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
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id IN (survivor_id, duplicate_id)
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (survivor_id, duplicate_id)
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id IN (survivor_id, duplicate_id)
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
        WHERE definition_id IN (survivor_id, duplicate_id)
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
      '% refused to override % protected record(s)',
      migration_key,
      protected_records;
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
    survivor_id,
    duplicate_id,
    'duplicate_consolidated',
    'Stir-the-Pot and Stir-the-Pot Plank prescribe the same stability-ball plank with a circular elbow or forearm path and a quiet trunk and pelvis. The added word plank and throwing-athlete framing do not add an exercise action. Knee or toe support, circle size, foot width, direction, repetitions, and contextual purpose remain exact variant or delivery dimensions.',
    jsonb_build_object(
      'match', 'same_stability_ball_circular_plank_action',
      'survivorSlug', 'stir-the-pot',
      'resolvedSlug', 'stir-the-pot-plank',
      'exactVariantDimensions', jsonb_build_array(
        'support_base',
        'circle_size',
        'foot_width',
        'direction',
        'repetitions'
      ),
      'deliveryDimensions', jsonb_build_array(
        'training_context',
        'population',
        'session_phase'
      ),
      'researchBatch', 'stir-the-pot-family-v1',
      'researchSources', jsonb_build_array(
        'ace_stir_the_pot',
        'gym_ball_trunk_emg',
        'unstable_surface_emg_meta_analysis',
        'unstable_closed_chain_shoulder_meta_analysis'
      ),
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
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

  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id = survivor_id,
      source_kind = 'duplicate_consolidation',
      provenance_json = source.provenance_json || jsonb_build_object(
        'resolvedFromDefinitionId', duplicate_id,
        'resolution', 'same_stability_ball_circular_plank_action',
        'researchBatch', 'stir-the-pot-family-v1',
        'migration', migration_key
      )
  WHERE source.definition_id = duplicate_id;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE
        WHEN variant_key = 'baseline'
          THEN 'legacy-source-1344-baseline'
        ELSE left(variant_key, 57) || '-source-1344'
      END,
      display_name = CASE
        WHEN variant_key = 'baseline'
          THEN 'Legacy Stir-the-Pot Plank Source'
        ELSE display_name
      END,
      definition_id = survivor_id,
      status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'quarantineReason',
            'Legacy source does not declare exact support base, circle size, direction order, repetition contract, ball specification, or stop rules.'
        ),
      updated_at = now()
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = survivor_id
    AND variant.status = 'archived';

  DELETE FROM coaching.exercise_section_evidence_v1 duplicate_evidence
  USING coaching.exercise_section_evidence_v1 survivor_evidence
  WHERE duplicate_evidence.definition_id = duplicate_id
    AND survivor_evidence.definition_id = survivor_id
    AND survivor_evidence.reviewed_card_version =
      duplicate_evidence.reviewed_card_version
    AND survivor_evidence.section_key = duplicate_evidence.section_key
    AND survivor_evidence.source_url = duplicate_evidence.source_url;

  UPDATE coaching.exercise_section_evidence_v1
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE definition_id = duplicate_id;

  DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
  USING coaching.exercise_media_candidate_v1 survivor_media
  WHERE duplicate_media.definition_id = duplicate_id
    AND survivor_media.definition_id = survivor_id
    AND survivor_media.reviewed_card_version =
      duplicate_media.reviewed_card_version
    AND (
      survivor_media.video_id = duplicate_media.video_id
      OR survivor_media.url = duplicate_media.url
    );

  UPDATE coaching.exercise_media_candidate_v1
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      notes = concat_ws(
        ' ',
        notes,
        'Preserved from the consolidated Stir-the-Pot Plank source; candidate metadata does not establish human viewing or approval.'
      ),
      updated_at = now()
  WHERE definition_id = duplicate_id;

  DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
  USING coaching.exercise_alternate_assessment_v1 survivor_alternate
  WHERE duplicate_alternate.definition_id = duplicate_id
    AND survivor_alternate.definition_id = survivor_id
    AND survivor_alternate.reviewed_card_version =
      duplicate_alternate.reviewed_card_version
    AND lower(survivor_alternate.alternate_name) =
      lower(duplicate_alternate.alternate_name);

  UPDATE coaching.exercise_alternate_assessment_v1
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_definition_v1 survivor
  SET canonical_name = 'Stir-the-Pot',
      display_name = 'Stir-the-Pot',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(survivor.aliases, '{}')
          || coalesce(duplicate.aliases, '{}')
          || ARRAY[
            duplicate.canonical_name,
            duplicate.display_name,
            'Stability-Ball Stir-the-Pot',
            'Swiss-Ball Stir-the-Pot'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) NOT IN (
            lower(survivor.canonical_name),
            lower(survivor.display_name)
          )
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      status = 'review',
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = survivor.provenance_json || jsonb_build_object(
        'identityMigration', migration_key,
        'identityResolution', 'same_stability_ball_circular_plank_action',
        'consolidatedDefinitionIds',
          coalesce(
            survivor.provenance_json -> 'consolidatedDefinitionIds',
            '[]'::JSONB
          ) || to_jsonb(duplicate_id),
        'consolidatedLegacyExerciseIds',
          coalesce(
            survivor.provenance_json -> 'consolidatedLegacyExerciseIds',
            '[]'::JSONB
          ) || to_jsonb(duplicate_legacy_id),
        'researchBatch', 'stir-the-pot-family-v1',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 duplicate
  WHERE survivor.id = survivor_id
    AND duplicate.id = duplicate_id;

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      blocking_issues_json = blocking_issues_json || jsonb_build_array(
        jsonb_build_object(
          'code', 'identity_consolidation_reaudit_required',
          'message',
            'Re-run the canonical card audit after Stir-the-Pot identity consolidation.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = survivor_id;

  UPDATE coaching.exercise_definition_v1
  SET status = 'archived',
      legacy_exercise_id = NULL,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'archivedByIdentityMigration', migration_key,
        'survivorDefinitionId', survivor_id,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = duplicate_id;
END;
$$;
