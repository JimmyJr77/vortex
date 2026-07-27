-- Consolidate researched Drop Jump, Depth Jump, and Falling Start duplicates.
--
-- Stable identities:
--   * Drop Jump: low-platform step-off, short bilateral ground contact,
--     immediate vertical rebound, and controlled final landing.
--   * Depth Jump: platform step-off, declared countermovement strategy,
--     maximal vertical rebound, and controlled final landing.
--   * Falling Start Sprint: controlled forward whole-body fall, recovery step,
--     and short linear acceleration through a declared distance.
--
-- Platform height, low-box wording, quarter-squat depth, exact distance, units,
-- and lane markers remain variant or delivery dimensions. Landing-only drops,
-- horizontal/lateral rebounds, the alternate contact strategy, and the
-- no-sprint fall-to-hold remain distinct identities.
--
-- No exercise skill/proficiency level or approval is introduced. Exercise
-- difficulty remains complexity plus physical difficulty, with overall equal
-- to their maximum. Candidate research and media remain quarantined.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '356_coaching_drop_depth_falling_start_identity_consolidation';
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
        'drop-jump',
        'drop-jump-reactive',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Drop Jump Reactive declares the same low-platform step-off, short bilateral contact, immediate vertical rebound, and controlled final landing as Drop Jump. Reactive is the defining intent of the action rather than a second identity.',
        ARRAY['Reactive Drop Jump']::TEXT[],
        '["platform_height","contact_strategy","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'drop-jump',
        'depth-drop-to-rebound',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Depth Drop to Rebound explicitly steps from a low box, contacts the floor, immediately rebounds vertically, and controls the final landing. Once a rebound is required, this is the Drop Jump action; depth-drop wording does not create a landing-only identity.',
        ARRAY['Depth Drop to Rebound']::TEXT[],
        '["platform_height","contact_strategy","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'drop-jump',
        'depth-drop-to-vertical-rebound',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Depth Drop to Vertical Rebound is the vertical baseline Drop Jump sequence. Vertical direction makes the contract explicit but does not add an action beyond the stable short-contact vertical rebound identity.',
        ARRAY['Depth Drop to Vertical Rebound']::TEXT[],
        '["platform_height","contact_strategy","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'drop-jump',
        'low-box-drop-to-vertical-rebound',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Low Box Drop to Vertical Rebound is an introductory low-platform delivery of Drop Jump. Low box constrains impact, readiness, and dosage but preserves the same step-off, short contact, vertical rebound, and final landing.',
        ARRAY['Low Box Drop to Vertical Rebound']::TEXT[],
        '["platform_height","contact_strategy","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'drop-jump',
        'low-box-drop-to-quarter-squat-rebound',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Low Box Drop to Quarter-Squat Rebound retains the Drop Jump action while annotating a shallow bounce strategy. Declared landing depth changes exact technique and difficulty but not the step-off, immediate vertical rebound, and controlled finish identity.',
        ARRAY['Low Box Drop to Quarter-Squat Rebound']::TEXT[],
        '["platform_height","contact_strategy","landing_depth","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'drop-jump',
        'low-box-rebound-jump',
        'Drop Jump',
        'same_short_contact_vertical_drop_jump',
        'Low Box Rebound Jump describes a very-low-platform step or drop, one immediate vertical rebound, and a controlled final landing. Very low height is a readiness and delivery constraint of Drop Jump rather than a separate identity.',
        ARRAY['Low Box Rebound Jump']::TEXT[],
        '["platform_height","contact_strategy","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'depth-jump',
        'depth-jump-to-rebound',
        'Depth Jump',
        'same_countermovement_vertical_depth_jump',
        'A rebound is inherent to the Depth Jump definition. Depth Jump to Rebound retains the same platform step-off, continuous countermovement contact, maximal vertical re-output, and controlled final landing.',
        ARRAY['Depth Jump to Rebound']::TEXT[],
        '["platform_height","countermovement_depth","rebound_height","arm_action","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'depth-jump',
        'depth-jump-to-vertical-jump',
        'Depth Jump',
        'same_countermovement_vertical_depth_jump',
        'Depth Jump to Vertical Jump states the baseline rebound direction already required by Depth Jump. Platform height, countermovement depth, arm action, target, and dose remain exact variant or delivery dimensions.',
        ARRAY['Depth Jump to Vertical Jump']::TEXT[],
        '["platform_height","countermovement_depth","rebound_height","arm_action","target","final_landing","dose"]'::JSONB,
        'reactive-depth-drop-jumps-v1',
        '2026-07-25.5'
      ),
      (
        'falling-start-10m',
        'falling-start-sprint',
        'Falling Start Sprint',
        'same_forward_fall_to_short_acceleration',
        'Falling Start Sprint and Falling Start 10m share the defining controlled forward whole-body fall, timely recovery step, and high-intent short linear acceleration. Omitting distance from the source title makes distance a delivery input rather than a second identity.',
        ARRAY['Falling Start 10m']::TEXT[],
        '["distance","distance_unit","finish_marker","timing_method","start_side","run_out","dose"]'::JSONB,
        'falling-start-collision-cluster-v1',
        '2026-07-25.11'
      ),
      (
        'falling-start-10m',
        'falling-start-to-10-meters',
        'Falling Start Sprint',
        'same_forward_fall_to_short_acceleration',
        'Falling Start to 10 Meters is the written-out metric dose of Falling Start Sprint. Ten metres changes prescribed exposure and measurement, not the forward-fall start or acceleration action.',
        ARRAY['Falling Start to 10 Meters','Falling Start 10 Meters']::TEXT[],
        '["distance","distance_unit","finish_marker","timing_method","start_side","run_out","dose"]'::JSONB,
        'falling-start-collision-cluster-v1',
        '2026-07-25.11'
      ),
      (
        'falling-start-10m',
        'falling-start-to-10-yards',
        'Falling Start Sprint',
        'same_forward_fall_to_short_acceleration',
        'Falling Start to 10 Yards uses the same forward-fall start and short acceleration as Falling Start Sprint. Ten yards is an imperial distance profile; the existing cone wording is retained as setup provenance rather than an identity.',
        ARRAY['Falling Start to 10 Yards','Falling Start to 10-Yard Cone']::TEXT[],
        '["distance","distance_unit","finish_marker","timing_method","start_side","run_out","dose"]'::JSONB,
        'falling-start-collision-cluster-v1',
        '2026-07-25.11'
      ),
      (
        'falling-start-10m',
        'falling-start-to-5-10-yard-sprint',
        'Falling Start Sprint',
        'same_forward_fall_to_short_acceleration',
        'Falling Start to 5–10 Yard Sprint preserves the same controlled fall, recovery step, and short linear acceleration. The five-to-ten-yard range is dosage and lane setup rather than a new exercise identity.',
        ARRAY['Falling Start to 5–10 Yard Sprint','Falling Start 5–10 Yards']::TEXT[],
        '["distance","distance_unit","finish_marker","timing_method","start_side","run_out","dose"]'::JSONB,
        'falling-start-collision-cluster-v1',
        '2026-07-25.11'
      )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      canonical_name,
      identity_match,
      rationale,
      extra_aliases,
      variant_dimensions,
      research_batch,
      research_version
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
    WHERE slug = pair.survivor_slug
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id, legacy_exercise_id, status
    INTO duplicate_id, duplicate_legacy_id, duplicate_status
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND facility_id = facility;

    IF survivor_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active survivor %',
        migration_key,
        pair.survivor_slug;
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
        '% conflicts with protected identity decision for % and %',
        migration_key,
        pair.survivor_slug,
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
        '% refused to override % protected record(s) for % and %',
        migration_key,
        protected_records,
        pair.survivor_slug,
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
        'match', pair.identity_match,
        'survivorSlug', pair.survivor_slug,
        'resolvedSlug', pair.duplicate_slug,
        'variantDimensions', pair.variant_dimensions,
        'researchBatch', pair.research_batch,
        'researchVersion', pair.research_version,
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
          'resolution', pair.identity_match,
          'researchBatch', pair.research_batch,
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
            'quarantineReason',
              'Legacy source does not declare the exact selectable variant contract, dose, quality gate, and stop rules required by the consolidated card.'
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
          'Preserved from a consolidated source; candidate metadata does not establish human viewing, exact matching, or approval.'
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
    SET canonical_name = pair.canonical_name,
        display_name = pair.canonical_name,
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
            AND lower(btrim(alias)) <> lower(pair.canonical_name)
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
          'identityResolution', pair.identity_match,
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
          'researchBatch', pair.research_batch,
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
              'Re-run the canonical card audit after identity consolidation.'
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
END;
$$;

-- Persist boundaries exposed by the consolidation. Existing human-review
-- decisions in either orientation are preserved without replacement.
DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '356_coaching_drop_depth_falling_start_identity_consolidation';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  facility BIGINT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'drop-jump',
        'depth-jump',
        'short_contact_bounce_vs_countermovement_height_strategy',
        'Drop Jump uses a deliberately short bounce contact and evaluates the rebound relative to contact time. Depth Jump permits a declared countermovement strategy to prioritize rebound height. Contact strategy, metric, fatigue signature, coaching, and progression differ, so the exact variants remain separate identities.',
        '["ground_contact_strategy","primary_quality_metric","countermovement_depth"]'::JSONB
      ),
      (
        'drop-jump',
        'depth-drop-to-athletic-stick',
        'immediate_rebound_vs_landing_only_stick',
        'Drop Jump requires an immediate second takeoff after floor contact. Depth Drop to Athletic Stick requires absorption and a held terminal landing with no rebound. The added takeoff changes impact count, intent, readiness, coaching, and stop rules.',
        '["terminal_action","landing_contact_count","rebound_intent"]'::JSONB
      ),
      (
        'drop-jump',
        'depth-drop-to-broad-rebound',
        'vertical_rebound_vs_horizontal_rebound',
        'Drop Jump uses the vertical rebound baseline. Depth Drop to Broad Rebound redirects the drop horizontally. Projection direction changes landing zone, loading, space, coaching, and substitution logic.',
        '["rebound_direction","landing_zone","space"]'::JSONB
      ),
      (
        'drop-jump',
        'depth-drop-to-lateral-rebound',
        'vertical_rebound_vs_lateral_rebound',
        'Drop Jump uses the vertical rebound baseline. Depth Drop to Lateral Rebound redirects the drop in the frontal plane. Projection direction and landing alignment change the movement and planning contract.',
        '["rebound_direction","landing_alignment","space"]'::JSONB
      ),
      (
        'falling-start-10m',
        'falling-start-hold',
        'short_acceleration_vs_single_step_terminal_hold',
        'Falling Start Sprint uses the controlled forward fall to enter continued short acceleration. Falling Start Position Hold catches the fall with one recovery step, freezes a split stance, and intentionally omits the sprint. The terminal action, contact count, lane, fatigue, and coaching contract make these distinct exercises.',
        '["terminal_action","contact_count","distance","intent"]'::JSONB
      )
    ) AS boundaries(
      left_slug,
      right_slug,
      identity_boundary,
      rationale,
      variant_dimensions
    )
  LOOP
    left_id := NULL;
    right_id := NULL;
    facility := NULL;

    SELECT id, facility_id
    INTO left_id, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id
    INTO right_id
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = facility
      AND status <> 'archived';

    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active boundary definitions % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_id
          AND resolution.resolved_definition_id = right_id
        )
        OR (
          resolution.survivor_definition_id = right_id
          AND resolution.resolved_definition_id = left_id
        )
      )
        AND resolution.decision <> 'distinct_exercises'
    ) THEN
      RAISE EXCEPTION
        '% conflicts with existing decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
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
    SELECT
      facility,
      left_id,
      right_id,
      'distinct_exercises',
      boundary.rationale,
      jsonb_build_object(
        'identityBoundary', boundary.identity_boundary,
        'variantDimensions', boundary.variant_dimensions,
        'researchBatches', jsonb_build_array(
          'reactive-depth-drop-jumps-v1',
          'falling-start-collision-cluster-v1'
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
    WHERE NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 existing
      WHERE (
        (
          existing.survivor_definition_id = left_id
          AND existing.resolved_definition_id = right_id
        )
        OR (
          existing.survivor_definition_id = right_id
          AND existing.resolved_definition_id = left_id
        )
      )
        AND existing.decision = 'distinct_exercises'
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id)
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';
  END LOOP;
END;
$$;
