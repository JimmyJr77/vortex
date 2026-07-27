-- Close the two additional Alternating Bounds identities exposed after the
-- initial consolidation and canonical rename.
--
-- The generic Alternating Bounds source is an exact duplicate. Alternating
-- Bounds for Height preserves the same alternating unilateral contact
-- sequence; vertical projection emphasis is an exact traditional-bound
-- variant/delivery dimension. Same-leg bounding remains a separate exercise.
--
-- Five media links inherited from the generic source identify same-leg bounds
-- in current oEmbed metadata. They remain traceable candidate records but are
-- explicitly marked mismatched; no human rejection or approval is fabricated.
--
-- No exercise skill/proficiency level or approval is introduced.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '368_coaching_remaining_alternating_bounds_identity_consolidations';
  survivor_id UUID;
  survivor_version INTEGER;
  facility BIGINT;
  duplicate RECORD;
  protected_records INTEGER;
BEGIN
  SELECT id, card_version, facility_id
  INTO survivor_id, survivor_version, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'alternate-leg-bound-for-distance'
    AND status <> 'archived';

  IF survivor_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active alternate-leg-bound-for-distance survivor',
      migration_key;
  END IF;

  FOR duplicate IN
    SELECT
      definition.id,
      definition.slug,
      definition.canonical_name,
      definition.display_name,
      definition.aliases,
      definition.legacy_exercise_id,
      definition.status,
      CASE definition.slug
        WHEN 'alternating-bounds'
          THEN 'same_alternating_unilateral_multistep_bound'
        ELSE 'same_alternating_bound_with_vertical_projection_variant'
      END AS resolution_key,
      CASE definition.slug
        WHEN 'alternating-bounds'
          THEN 'Generic Alternating Bounds and the survivor both require consecutive forward one-foot contacts that alternate legs with coordinated arm action and a controlled finish. The generic label adds no identity-defining action.'
        ELSE 'Alternating Bounds for Height preserves consecutive forward one-foot contacts that alternate legs. Vertical-biased projection changes impulse direction, contact intent, dose, and measurement and is represented by the traditional mixed-projection exact variant rather than a separate exercise identity.'
      END AS rationale
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = facility
      AND definition.slug IN (
        'alternating-bounds',
        'alternating-bounds-for-height'
      )
    ORDER BY definition.slug
  LOOP
    IF duplicate.status = 'archived' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate.id
          AND resolution.decision = 'duplicate_consolidated'
      ) THEN
        RAISE EXCEPTION
          '% found archived duplicate % without identity resolution',
          migration_key,
          duplicate.slug;
      END IF;
      CONTINUE;
    END IF;

    IF duplicate.legacy_exercise_id IS NULL THEN
      RAISE EXCEPTION
        '% requires legacy traceability for %',
        migration_key,
        duplicate.slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor_id
          AND resolution.resolved_definition_id = duplicate.id
        )
        OR (
          resolution.survivor_definition_id = duplicate.id
          AND resolution.resolved_definition_id = survivor_id
        )
      )
        AND (
          resolution.decision <> 'duplicate_consolidated'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% conflicts with protected identity decision for %',
        migration_key,
        duplicate.slug;
    END IF;

    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id IN (survivor_id, duplicate.id)
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
        WHERE definition_id IN (survivor_id, duplicate.id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id IN (survivor_id, duplicate.id)
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate.id)
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id IN (survivor_id, duplicate.id)
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
          WHERE definition_id IN (survivor_id, duplicate.id)
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
        '% refused to override % protected record(s) for %',
        migration_key,
        protected_records,
        duplicate.slug;
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
      duplicate.id,
      'duplicate_consolidated',
      duplicate.rationale,
      jsonb_build_object(
        'match', duplicate.resolution_key,
        'survivorSlug', 'alternate-leg-bound-for-distance',
        'resolvedSlug', duplicate.slug,
        'identityBoundary',
          'alternating_contact_pattern_projection_contact_time_distance_dose_and_measurement',
        'variantDimensions', jsonb_build_array(
          'traditional_or_sprint_bound',
          'projection_emphasis',
          'contact_time_intent',
          'distance',
          'contacts',
          'intensity',
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
          'resolvedFromDefinitionId', duplicate.id,
          'resolution', duplicate.resolution_key,
          'variantDimensions', jsonb_build_array(
            'projection_emphasis',
            'contact_time_intent',
            'distance',
            'dose'
          ),
          'migration', migration_key
        )
    WHERE source.definition_id = duplicate.id;

    UPDATE coaching.exercise_variant_v1
    SET variant_key = 'legacy-source-'
          || duplicate.legacy_exercise_id::TEXT
          || '-baseline',
        display_name =
          'Legacy ' || duplicate.display_name || ' Source',
        definition_id = survivor_id,
        status = 'archived',
        requirements_json = coalesce(requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'identityQuarantine', TRUE,
            'sourceDefinitionId', duplicate.id,
            'identityBoundary',
              'alternating_contact_pattern_projection_contact_time_distance_dose_and_measurement',
            'quarantineReason',
              'Legacy source does not declare the exact traditional-versus-sprint form, distance or contacts, effort, dose, quality gates, and stop rules required by the completed card.'
          ),
        updated_at = now()
    WHERE definition_id = duplicate.id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.id = profile.variant_id
      AND variant.definition_id = survivor_id
      AND variant.status = 'archived';

    DELETE FROM coaching.exercise_section_evidence_v1 duplicate_evidence
    USING coaching.exercise_section_evidence_v1 survivor_evidence
    WHERE duplicate_evidence.definition_id = duplicate.id
      AND survivor_evidence.definition_id = survivor_id
      AND survivor_evidence.reviewed_card_version =
        duplicate_evidence.reviewed_card_version
      AND survivor_evidence.section_key = duplicate_evidence.section_key
      AND survivor_evidence.source_url = duplicate_evidence.source_url;

    UPDATE coaching.exercise_section_evidence_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate.id;

    DELETE FROM coaching.exercise_media_candidate_v1 duplicate_media
    USING coaching.exercise_media_candidate_v1 survivor_media
    WHERE duplicate_media.definition_id = duplicate.id
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
    WHERE definition_id = duplicate.id;

    DELETE FROM coaching.exercise_alternate_assessment_v1 duplicate_alternate
    USING coaching.exercise_alternate_assessment_v1 survivor_alternate
    WHERE duplicate_alternate.definition_id = duplicate.id
      AND survivor_alternate.definition_id = survivor_id
      AND lower(survivor_alternate.alternate_name) =
        lower(duplicate_alternate.alternate_name);

    UPDATE coaching.exercise_alternate_assessment_v1
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE definition_id = duplicate.id;

    UPDATE coaching.exercise_definition_v1 survivor
    SET aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            coalesce(survivor.aliases, '{}')
            || coalesce(duplicate.aliases, '{}')
            || ARRAY[
              duplicate.canonical_name,
              duplicate.display_name
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
          'remainingIdentityMigration', migration_key,
          'consolidatedDefinitionIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedDefinitionIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate.id),
          'consolidatedLegacyExerciseIds',
            coalesce(
              survivor.provenance_json -> 'consolidatedLegacyExerciseIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate.legacy_exercise_id),
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE,
          'mediaApprovalCreated', FALSE,
          'graphApprovalCreated', FALSE,
          'calibrationApprovalCreated', FALSE
        ),
        updated_at = now()
    WHERE survivor.id = survivor_id;

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
    WHERE id = duplicate.id;
  END LOOP;

  UPDATE coaching.exercise_media_candidate_v1
  SET reviewed_card_version = survivor_version,
      embed_url =
        'https://www.youtube-nocookie.com/embed/' || video_id,
      title = CASE video_id
        WHEN '1pfCX540xz4' THEN 'Single Leg Bounds'
        WHEN 'Hnf_4gSkXtg' THEN 'Single Leg Bounds'
        WHEN 'I7ChaipZVM4'
          THEN 'Single Leg Bounds for Speed Training - 3 Step Progression | One Leg Bounding'
        WHEN 'LMOrbWBhyMs'
          THEN 'Single Leg Bounding (Running Drill)'
        WHEN 'X0dZBSroHDg'
          THEN 'Top 10 Top Speed Drills [#1 Single Leg Bounding] | Overtime Athletes'
      END,
      channel_name = CASE video_id
        WHEN '1pfCX540xz4' THEN 'XCELER8 Athletics'
        WHEN 'Hnf_4gSkXtg' THEN 'Block Fitness'
        WHEN 'I7ChaipZVM4' THEN 'Simple Speed Coach'
        WHEN 'LMOrbWBhyMs' THEN 'The Barefoot Sprinter'
        WHEN 'X0dZBSroHDg' THEN 'overtimeathletes'
      END,
      captions_available = NULL,
      embedding_allowed = TRUE,
      exact_variant_match = FALSE,
      demonstration_quality_score = NULL,
      link_status = 'mismatched',
      review_status = 'candidate',
      reviewer_user_id = NULL,
      reviewed_at = NULL,
      next_review_at = NULL,
      notes =
        'YouTube oEmbed title/channel metadata checked 2026-07-26. The title identifies repeated same-leg bounding, not opposite-leg alternating bounds. Retained only as quarantined legacy provenance; no human viewing, rejection, accessibility review, or approval is claimed.',
      updated_at = now()
  WHERE definition_id = survivor_id
    AND video_id IN (
      '1pfCX540xz4',
      'Hnf_4gSkXtg',
      'I7ChaipZVM4',
      'LMOrbWBhyMs',
      'X0dZBSroHDg'
    );

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      blocking_issues_json = blocking_issues_json || jsonb_build_array(
        jsonb_build_object(
          'code', 'expanded_identity_consolidation_reaudit_required',
          'message',
            'Re-run the canonical card audit after the remaining Alternating Bounds consolidations.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = survivor_id;
END;
$$;
