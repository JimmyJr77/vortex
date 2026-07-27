-- Consolidate the two alternating-bound cards into one stable identity.
--
-- Both cards use consecutive unilateral contacts with contralateral arm
-- action and alternating legs. "For distance" versus "for height and
-- distance" changes projection emphasis, contact-time intent, dose, and
-- measurement; it does not change the base exercise identity. Traditional
-- and sprint-oriented executions remain exact variants on the survivor.
--
-- The migration creates no exercise skill/proficiency level, human review,
-- media approval, graph approval, calibration approval, or publication.
-- Exercise difficulty remains exercise complexity plus physical difficulty,
-- with overall equal to their maximum. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '366_coaching_alternating_bounds_identity_consolidation';
  survivor_id UUID;
  duplicate_id UUID;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  survivor_version INTEGER;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  SELECT id, card_version, facility_id
  INTO survivor_id, survivor_version, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'alternate-leg-bound-for-distance'
    AND status <> 'archived';

  SELECT id, legacy_exercise_id, status
  INTO duplicate_id, duplicate_legacy_id, duplicate_status
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'alternate-bounds-for-height-and-distance';

  IF survivor_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active survivor alternate-leg-bound-for-distance',
      migration_key;
  END IF;

  IF duplicate_id IS NULL THEN
    RAISE EXCEPTION
      '% requires traceable duplicate alternate-bounds-for-height-and-distance',
      migration_key;
  END IF;

  IF duplicate_status = 'archived' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
        AND resolution.decision = 'duplicate_consolidated'
    ) THEN
      RAISE EXCEPTION
        '% found archived duplicate without matching identity resolution',
        migration_key;
    END IF;
    RETURN;
  END IF;

  IF duplicate_legacy_id IS NULL THEN
    RAISE EXCEPTION
      '% requires duplicate legacy traceability',
      migration_key;
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
        resolution.decision <> 'duplicate_consolidated'
        OR resolution.resolution_source = 'human_review'
      )
  ) THEN
    RAISE EXCEPTION
      '% conflicts with protected identity decision for the alternating-bound pair',
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
    'Both definitions require consecutive unilateral horizontal plyometric contacts with alternating legs and running-style contralateral arm action. Height-versus-distance emphasis changes projection strategy, contact-time intent, dose, and measurement, so it belongs to exact traditional- and sprint-bound variants and contextual delivery profiles rather than a second exercise identity.',
    jsonb_build_object(
      'match',
        'same_alternating_unilateral_multistep_bound',
      'survivorSlug',
        'alternate-leg-bound-for-distance',
      'resolvedSlug',
        'alternate-bounds-for-height-and-distance',
      'identityBoundary',
        'projection_emphasis_contact_time_intent_distance_dose_and_measurement',
      'variantDimensions', jsonb_build_array(
        'traditional_or_sprint_bound',
        'horizontal_vertical_projection_emphasis',
        'contact_time_intent',
        'distance',
        'contact_count',
        'approach',
        'intensity',
        'dose',
        'measurement'
      ),
      'researchSourceKeys', jsonb_build_array(
        'olympic_coach_plyometric_practices',
        'horizontal_multi_step_jump_review',
        'horizontal_vertical_plyometric_meta_analysis'
      ),
      'researchSources', jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/',
        'https://pubmed.ncbi.nlm.nih.gov/32897526/'
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
    resolved_at = now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source
    <> 'human_review';

  UPDATE coaching.exercise_definition_source_v1 source
  SET definition_id = survivor_id,
      source_kind = 'duplicate_consolidation',
      provenance_json = source.provenance_json || jsonb_build_object(
        'resolvedFromDefinitionId', duplicate_id,
        'resolution', 'same_alternating_unilateral_multistep_bound',
        'variantDimensions', jsonb_build_array(
          'projection_emphasis',
          'contact_time_intent',
          'distance',
          'dose'
        ),
        'migration', migration_key
      )
  WHERE source.definition_id = duplicate_id;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-source-' || duplicate_legacy_id::TEXT
        || '-baseline',
      display_name =
        'Legacy Alternate Bounds for Height and Distance Source',
      definition_id = survivor_id,
      status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'sourceDefinitionId', duplicate_id,
          'identityBoundary',
            'projection_emphasis_contact_time_intent_distance_dose_and_measurement',
          'quarantineReason',
            'Legacy source does not declare exact traditional-versus-sprint mechanics, distance, contacts, effort, dose, quality gates, or stop rules.'
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
        'Preserved from a consolidated source. Candidate metadata alone does not establish an alternating-bound match, accessibility, quality, or approval.'
      ),
      updated_at = now()
  WHERE definition_id = duplicate_id;

  DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
  USING coaching.exercise_alternate_assessment_v1 survivor_alternate
  WHERE duplicate_alternate.definition_id = duplicate_id
    AND survivor_alternate.definition_id = survivor_id
    AND lower(survivor_alternate.alternate_name) =
      lower(duplicate_alternate.alternate_name);

  UPDATE coaching.exercise_alternate_assessment_v1
  SET definition_id = survivor_id,
      reviewed_card_version = survivor_version,
      updated_at = now()
  WHERE definition_id = duplicate_id;

  UPDATE coaching.exercise_definition_v1 survivor
  SET aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(survivor.aliases, '{}')
          || coalesce(duplicate.aliases, '{}')
          || ARRAY[
            duplicate.canonical_name,
            duplicate.display_name,
            'Alternate Bounds for Height and Distance',
            'Alternating Bounds for Height and Distance',
            'Alternate-Leg Bounds'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> lower(survivor.canonical_name)
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
        'identityResolution',
          'same_alternating_unilateral_multistep_bound',
        'stableSlugPreserved',
          'alternate-leg-bound-for-distance',
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
        'researchVersion', '2026-07-27.52',
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
            'Re-run the canonical card audit after alternating-bound identity consolidation.'
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
