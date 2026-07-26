-- Consolidate 180-degree cards that differ only by numeric wording or by the
-- approach-distance and turn-style delivery of the same planned 180-degree
-- change-of-direction task.
--
-- A 180-degree jump to a controlled bilateral landing is one identity whether
-- the name spells out "degree." A shuttle cut and a turn-and-sprint both use a
-- planned sprint approach, horizontal braking, a 180-degree turn, and
-- reacceleration in the opposite direction. Approach length, plant side,
-- pivot/turn style, timing method, and exit distance remain controlled variants
-- or delivery-profile dimensions.
--
-- Legacy sources, variants, delivery profiles, candidate research, and
-- candidate media remain traceable. Any human-reviewed content or revision
-- fails closed instead of being reassigned automatically.
-- IDEMPOTENT.

DO $$
DECLARE
  pair RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  protected_records INTEGER;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      (
        '180-jump-to-stick',
        '180-degree-jump-to-stick',
        'numeric_nomenclature',
        'Both cards describe a bilateral in-place jump with approximately 180 degrees of body rotation, a bilateral landing, and a deliberate stick. Spelling out degree does not create a second movement identity.'
      ),
      (
        '180-degree-turn-shuttle-cut',
        '180-degree-turn-and-sprint',
        'approach_and_turn_delivery',
        'Both cards describe a planned sprint approach, braking to reverse horizontal momentum, a 180-degree plant and turn, and reacceleration in the opposite direction. Approach distance, plant side, pivot style, timing, and exit distance are controlled delivery dimensions.'
      )
    ) AS pairs(survivor_slug, duplicate_slug, variant_dimension, rationale)
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;

    SELECT id, card_version
    INTO survivor_id, survivor_version
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.survivor_slug
      AND status <> 'archived';

    SELECT id, legacy_exercise_id
    INTO duplicate_id, duplicate_legacy_id
    FROM coaching.exercise_definition_v1
    WHERE slug = pair.duplicate_slug
      AND status <> 'archived';

    IF survivor_id IS NULL OR duplicate_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id = duplicate_id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id = duplicate_id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id = duplicate_id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id = duplicate_id
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id = duplicate_id
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id = duplicate_id
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        '180-degree consolidation for % requires human review: % protected records',
        pair.duplicate_slug,
        protected_records;
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
      pair.rationale,
      jsonb_build_object(
        'match', 'controlled_variant_equivalence',
        'survivor_slug', survivor.slug,
        'resolved_slug', duplicate.slug,
        'variant_dimension', pair.variant_dimension,
        'publication_quarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = duplicate_id
    WHERE survivor.id = survivor_id
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = survivor_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolved_from_definition_id', duplicate_id,
          'resolution', 'controlled_variant_equivalence',
          'variant_dimension', pair.variant_dimension
        )
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = left(variant_key, 80)
          || '-source-'
          || COALESCE(duplicate_legacy_id::text, left(duplicate_id::text, 8)),
        updated_at = now()
    WHERE definition_id = duplicate_id;

    -- Candidate-only records may move to the survivor. Conflicting candidates
    -- remain attached to the archived definition as immutable provenance.
    UPDATE coaching.exercise_section_evidence_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_section_evidence_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND existing.section_key = candidate.section_key
          AND existing.source_url = candidate.source_url
      );

    UPDATE coaching.exercise_alternate_assessment_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_alternate_assessment_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND lower(existing.alternate_name) = lower(candidate.alternate_name)
      );

    UPDATE coaching.exercise_media_candidate_v1 candidate
    SET definition_id = survivor_id,
        reviewed_card_version = survivor_version,
        updated_at = now()
    WHERE candidate.definition_id = duplicate_id
      AND candidate.review_status IN ('candidate', 'superseded')
      AND NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_media_candidate_v1 existing
        WHERE existing.definition_id = survivor_id
          AND existing.reviewed_card_version = survivor_version
          AND (
            existing.video_id = candidate.video_id
            OR existing.url = candidate.url
          )
      );

    UPDATE coaching.exercise_definition_v1 survivor
    SET aliases = ARRAY(
          SELECT min(alias)
          FROM unnest(
            COALESCE(survivor.aliases, '{}')
            || COALESCE(duplicate.aliases, '{}')
            || ARRAY[
              duplicate.canonical_name,
              duplicate.display_name
            ]
          ) alias
          WHERE nullif(btrim(alias), '') IS NOT NULL
            AND lower(alias) NOT IN (
              lower(survivor.canonical_name),
              lower(survivor.display_name)
            )
          GROUP BY lower(alias)
          ORDER BY lower(alias)
        ),
        provenance_json = survivor.provenance_json || jsonb_build_object(
          'identity_resolution', 'controlled_variant_consolidation',
          'consolidated_definition_ids',
            COALESCE(
              survivor.provenance_json->'consolidated_definition_ids',
              '[]'::jsonb
            ) || to_jsonb(duplicate_id::text),
          'consolidated_legacy_exercise_ids',
            COALESCE(
              survivor.provenance_json->'consolidated_legacy_exercise_ids',
              '[]'::jsonb
            ) || to_jsonb(duplicate_legacy_id)
        ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_card_test_packet_v1
    SET status = 'quarantined',
        blocking_issues_json = blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'variant_consolidation_reaudit_required',
            'message', 'Re-run the canonical card audit after the 180-degree identity consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        provenance_json = provenance_json || jsonb_build_object(
          'identity_resolution', 'controlled_variant_consolidation',
          'canonical_survivor_definition_id', survivor_id,
          'variant_dimension', pair.variant_dimension,
          'human_review_required', TRUE,
          'publication_quarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;
END;
$$;
