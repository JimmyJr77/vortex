-- Consolidate five implementation/laterality-labelled Hip Thrust duplicates
-- into the stable legacy survivor distance-jump-hip-thrust.
--
-- The slug remains stable even though the canonical name is Hip Thrust.
-- Barbell, band, dumbbell, kettlebell, plate, sandbag, bodyweight, bilateral,
-- and single-leg configurations remain exact variants. Floor-supported glute
-- bridge remains a separate definition. Feet-Elevated Hip Thrust and Hip
-- Thrust Eccentric Lower remain active and receive needs_human_review identity
-- records because their sources do not resolve upper-body support geometry.
--
-- No exercise skill/proficiency level, human reviewer, approval, or media
-- verification is introduced. Exercise difficulty remains exercise complexity
-- plus physical difficulty, with overall equal to their maximum.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '361_coaching_hip_thrust_identity_consolidations';
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  duplicate_status TEXT;
  facility BIGINT;
  protected_records INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        'band-hip-thrust',
        'implement_resistance_profile',
        'Band Hip Thrust preserves the same upper-back-supported, feet-supported hip-extension action as Hip Thrust. The anchored band changes setup and the resistance profile and therefore remains an exact variant.',
        ARRAY['Band Hip Thrust', 'Band Hip Thrusts']::TEXT[]
      ),
      (
        'barbell-hip-thrust',
        'implement_load_position_and_equipment_operations',
        'Barbell Hip Thrust preserves the same upper-back-supported, feet-supported hip-extension action as Hip Thrust. A padded barbell across the pelvis changes load potential, contact, setup, spotting, loading, and unloading and therefore remains an exact variant.',
        ARRAY['Barbell Hip Thrust', 'Barbell Hip Thrusts']::TEXT[]
      ),
      (
        'hip-thrust-loaded-glute-bridge',
        'implement_load_position_and_source_label',
        'The Hip Thrust / Loaded Glute Bridge source explicitly places the upper back on a stable bench and loads the pelvis with a barbell, dumbbell, or plate. That execution is Hip Thrust despite the composite source label; the slash label remains an alias and the implement remains an exact variant. This decision does not merge floor-supported glute bridge.',
        ARRAY[
          'Hip Thrust / Loaded Glute Bridge',
          'Hip Thrust / Loaded Glute Bridges',
          'Loaded Hip Thrust'
        ]::TEXT[]
      ),
      (
        'sandbag-hip-thrust-strength',
        'implement_load_distribution_and_equipment_operations',
        'Sandbag Hip Thrust preserves the same upper-back-supported, feet-supported hip-extension action as Hip Thrust. The sandbag changes load distribution, contact, setup, loading, and unloading and therefore remains an exact variant.',
        ARRAY['Sandbag Hip Thrust', 'Sandbag Hip Thrusts']::TEXT[]
      ),
      (
        'single-leg-hip-thrust',
        'laterality_foot_support_and_side_balanced_dose',
        'Single-Leg Hip Thrust preserves the same upper-back-supported hip-extension action as Hip Thrust. One-foot support changes laterality, pelvic-control demand, load distribution, and side-balanced dosage and therefore remains an exact variant.',
        ARRAY[
          'Single-Leg Hip Thrust',
          'Single Leg Hip Thrust',
          'SingleLeg Hip Thrust',
          'Single-Leg Hip Thrusts',
          'Single Leg Hip Thrusts'
        ]::TEXT[]
      )
    ) AS pairs(
      duplicate_slug,
      identity_boundary,
      rationale,
      extra_aliases
    )
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;
    duplicate_status := NULL;
    facility := NULL;

    SELECT id, card_version, facility_id
    INTO survivor_id, survivor_version, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = 'distance-jump-hip-thrust'
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id, legacy_exercise_id, status
    INTO duplicate_id, duplicate_legacy_id, duplicate_status
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND facility_id = facility;

    IF survivor_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active survivor distance-jump-hip-thrust',
        migration_key;
    END IF;

    IF duplicate_id IS NULL THEN
      RAISE EXCEPTION
        '% requires traceable duplicate %',
        migration_key,
        pair.duplicate_slug;
    END IF;

    IF duplicate_status = 'archived' AND EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id = survivor_id
        AND resolution.resolved_definition_id = duplicate_id
        AND resolution.decision = 'duplicate_consolidated'
    ) THEN
      CONTINUE;
    END IF;

    IF duplicate_legacy_id IS NULL THEN
      RAISE EXCEPTION
        '% requires legacy traceability for unconsolidated duplicate %',
        migration_key,
        pair.duplicate_slug;
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
        '% conflicts with protected identity decision for distance-jump-hip-thrust and %',
        migration_key,
        pair.duplicate_slug;
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
        '% refused to override % protected record(s) for distance-jump-hip-thrust and %',
        migration_key,
        protected_records,
        pair.duplicate_slug;
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
      pair.rationale,
      jsonb_build_object(
        'match', 'same_upper_back_supported_hip_extension',
        'survivorSlug', 'distance-jump-hip-thrust',
        'resolvedSlug', pair.duplicate_slug,
        'identityBoundary', pair.identity_boundary,
        'variantDimensions', jsonb_build_array(
          'implement',
          'load_position',
          'resistance_profile',
          'laterality',
          'support_height',
          'range',
          'tempo',
          'top_position',
          'setup',
          'exit',
          'dose'
        ),
        'researchSourceKeys', jsonb_build_array(
          'barbell_hip_thrust_biomechanics',
          'hip_thrust_glute_bridge_emg',
          'barbell_hip_thrust_systematic_review',
          'single_leg_hip_thrust_glute_force'
        ),
        'researchSources', jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/33780488/',
          'https://pubmed.ncbi.nlm.nih.gov/35586943/',
          'https://pubmed.ncbi.nlm.nih.gov/31191088/',
          'https://pubmed.ncbi.nlm.nih.gov/36918403/'
        ),
        'exerciseDifficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'floorGluteBridgeRemainsDistinct', TRUE,
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
          'resolution', 'same_upper_back_supported_hip_extension',
          'identityBoundary', pair.identity_boundary,
          'migration', migration_key
        )
    WHERE source.definition_id = duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET variant_key = left(variant_key, 42)
          || '-source-' || duplicate_legacy_id::TEXT,
        display_name = 'Legacy ' || display_name || ' Source',
        definition_id = survivor_id,
        status = 'archived',
        requirements_json = coalesce(requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'identityQuarantine', TRUE,
            'sourceDefinitionId', duplicate_id,
            'identityBoundary', pair.identity_boundary,
            'quarantineReason',
              'Legacy source does not declare the exact support, load, range, tempo, dose, quality-gate, stop-rule, and equipment-operation contract required by the consolidated card.'
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
          'Preserved from a consolidated source; candidate metadata does not establish human viewing, exact matching, accessibility review, or approval.'
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
    SET canonical_name = 'Hip Thrust',
        display_name = 'Hip Thrust',
        aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            coalesce(survivor.aliases, '{}')
            || coalesce(duplicate.aliases, '{}')
            || ARRAY[
              duplicate.canonical_name,
              duplicate.display_name
            ]::TEXT[]
            || pair.extra_aliases
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(btrim(alias)) <> 'hip thrust'
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
          'identityResolution', 'same_upper_back_supported_hip_extension',
          'stableSlugPreserved', 'distance-jump-hip-thrust',
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
          'variantDimensions', jsonb_build_array(
            'implement',
            'load_position',
            'resistance_profile',
            'laterality',
            'support_height',
            'range',
            'tempo',
            'top_position',
            'setup',
            'exit',
            'dose'
          ),
          'researchVersion', '2026-07-27.50',
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
              'Re-run the canonical card audit after Hip Thrust identity consolidation.'
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
  END LOOP;

  -- These sources remain active because their body-support geometry is
  -- ambiguous. The records route them to a human without deciding identity.
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        'feet-elevated-hip-thrust',
        'The source does not resolve whether the feet alone are elevated with upper-back bench support, whether the shoulders remain on the floor, or the exact heights of both supports. Those geometries can cross the Hip Thrust versus Glute Bridge identity boundary.',
        'support_geometry_and_surface_height_unresolved'
      ),
      (
        'hip-thrust-eccentric-lower',
        'The source explicitly permits either upper-back bench support or a floor bridge position. Eccentric tempo is a Hip Thrust variant only after the support geometry is resolved.',
        'mixed_hip_thrust_or_floor_bridge_source'
      )
    ) AS boundaries(
      unresolved_slug,
      rationale,
      ambiguity
    )
  LOOP
    SELECT id
    INTO duplicate_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = facility
      AND slug = pair.unresolved_slug
      AND status <> 'archived';

    IF duplicate_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active unresolved definition %',
        migration_key,
        pair.unresolved_slug;
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
          resolution.decision <> 'needs_human_review'
          OR resolution.resolution_source = 'human_review'
        )
    ) THEN
      RAISE EXCEPTION
        '% refused to override prior identity decision for distance-jump-hip-thrust and %',
        migration_key,
        pair.unresolved_slug;
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
      'needs_human_review',
      pair.rationale,
      jsonb_build_object(
        'match', 'identity_boundary_unresolved',
        'survivorSlug', 'distance-jump-hip-thrust',
        'unresolvedSlug', pair.unresolved_slug,
        'ambiguity', pair.ambiguity,
        'requiredDecisionEvidence', jsonb_build_array(
          'upper_body_support_location',
          'foot_support_location_and_height',
          'range_of_motion',
          'full_video_or_source_review'
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
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.decision =
      'needs_human_review'
      AND coaching.exercise_identity_resolution_v1.resolution_source
        <> 'human_review';
  END LOOP;
END;
$$;
