-- Consolidate implement- and tempo-labeled bilateral Romanian deadlift cards
-- into the stable Romanian Deadlift identity.
--
-- Survivor:
--   Romanian Deadlift
--
-- Consolidated source identities:
--   Dumbbell Romanian Deadlift
--   Kettlebell Romanian Deadlift
--   Double Kettlebell Romanian Deadlift
--   Sandbag Romanian Deadlift
--   Landmine Romanian Deadlift
--   Romanian Deadlift Eccentric
--
-- Implement, implement count, free or fixed load path, grip, mass distribution,
-- range, and tempo are exact variants of the same bilateral standing loaded
-- hip hinge. Single-leg, staggered-stance, conventional-from-floor,
-- RDL-to-row, good-morning, and ballistic swing tasks remain separate. Legacy
-- variants remain archived provenance because their complete current equipment,
-- dosage, and safety contracts are incomplete. Candidate records move when
-- they do not collide; colliding candidates remain preserved on the archived
-- source definition. No reviewed content, approval, publication, calibration,
-- media decision, or exercise skill level is created or overwritten.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  survivor_slug CONSTANT TEXT := 'romanian-deadlift';
  source RECORD;
  survivor_id UUID;
  duplicate_id UUID;
  survivor_version INTEGER;
  duplicate_legacy_id BIGINT;
  target_ids UUID[];
  protected_records INTEGER;
BEGIN
  FOR source IN
    SELECT *
    FROM (VALUES
      (
        'dumbbell-romanian-deadlift',
        'Dumbbell Romanian Deadlift',
        'dumbbell',
        'two',
        'free_independent_paths',
        'standard_controlled',
        'The generic survivor already explicitly permits dumbbells. Two independent dumbbells change grip, mass distribution, path management, and load potential without changing the bilateral standing Romanian-deadlift action.'
      ),
      (
        'kettlebell-romanian-deadlift',
        'Kettlebell Romanian Deadlift',
        'kettlebell',
        'one',
        'centered_free_path',
        'standard_controlled',
        'The generic survivor already explicitly permits kettlebells. One centered kettlebell changes grip and mass distribution without changing the bilateral standing Romanian-deadlift action.'
      ),
      (
        'double-kettlebell-romanian-deadlift',
        'Double Kettlebell Romanian Deadlift',
        'kettlebell',
        'two',
        'free_independent_paths',
        'standard_controlled',
        'Two kettlebells change implement count, grip, load, path management, and set-down logistics while preserving the same bilateral standing Romanian-deadlift action.'
      ),
      (
        'sandbag-romanian-deadlift-strength',
        'Sandbag Romanian Deadlift',
        'sandbag',
        'one',
        'deformable_front_hold',
        'standard_controlled',
        'A front-held deformable sandbag changes grip and mass distribution while preserving the same bilateral standing hip hinge, soft-knee position, posterior-chain range, and hip-driven finish.'
      ),
      (
        'landmine-romanian-deadlift',
        'Landmine Romanian Deadlift',
        'landmine',
        'one',
        'fixed_angled_arc',
        'standard_controlled',
        'A secure landmine changes the load path to a fixed angled arc and adds anchor, sleeve, handle, and plate constraints without changing the bilateral standing Romanian-deadlift action.'
      ),
      (
        'romanian-deadlift-eccentric',
        'Romanian Deadlift Eccentric',
        'barbell_or_dumbbell',
        'declared',
        'close_free_path',
        'slow_eccentric',
        'A declared slow lowering tempo changes eccentric stress, technical demand, dosage, and recovery within the same bilateral Romanian-deadlift identity.'
      )
    ) AS sources(
      duplicate_slug,
      retained_alias,
      declared_implement,
      implement_quantity,
      load_path,
      tempo_contract,
      rationale
    )
  LOOP
    survivor_id := NULL;
    duplicate_id := NULL;
    survivor_version := NULL;
    duplicate_legacy_id := NULL;

    SELECT id, card_version
    INTO survivor_id, survivor_version
    FROM coaching.exercise_definition_v1
    WHERE slug = survivor_slug
      AND status <> 'archived';

    SELECT id, legacy_exercise_id
    INTO duplicate_id, duplicate_legacy_id
    FROM coaching.exercise_definition_v1
    WHERE slug = source.duplicate_slug
      AND status <> 'archived';

    IF survivor_id IS NULL AND duplicate_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Romanian-deadlift consolidation found active duplicate % without survivor %',
        source.duplicate_slug,
        survivor_slug;
    END IF;

    IF survivor_id IS NULL OR duplicate_id IS NULL THEN
      CONTINUE;
    END IF;

    target_ids := ARRAY[survivor_id, duplicate_id];

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
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(target_ids)
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(target_ids)
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
        WHERE variant.definition_id = ANY(target_ids)
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_v1 score
        WHERE score.exercise_id IN (
          SELECT definition_source.legacy_exercise_id
          FROM coaching.exercise_definition_source_v1 definition_source
          WHERE definition_source.definition_id = ANY(target_ids)
        )
          AND (
            score.human_review_status <> 'queued'
            OR score.reviewed_by IS NOT NULL
            OR score.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        'Romanian-deadlift consolidation for % refused to override % protected records',
        source.duplicate_slug,
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
      source.rationale,
      jsonb_build_object(
        'match', 'bilateral_loaded_romanian_deadlift_identity_equivalence',
        'survivorSlug', survivor.slug,
        'resolvedSlug', duplicate.slug,
        'declaredImplement', source.declared_implement,
        'implementQuantity', source.implement_quantity,
        'loadPath', source.load_path,
        'tempoContract', source.tempo_contract,
        'sameBilateralStance', TRUE,
        'sameStandingTopStart', TRUE,
        'sameHipHingeAndHipExtensionAction', TRUE,
        'implementIsExactVariant', TRUE,
        'tempoIsExactVariantOrDeliveryDimension', TRUE,
        'exerciseSkillLevelAllowed', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
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
          'resolvedFromDefinitionId', duplicate_id,
          'resolution', 'bilateral_loaded_romanian_deadlift_identity_equivalence',
          'declaredImplement', source.declared_implement,
          'implementQuantity', source.implement_quantity,
          'loadPath', source.load_path,
          'tempoContract', source.tempo_contract
        )
    WHERE definition_id = duplicate_id;

    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    WHERE profile.variant_id IN (
      SELECT id
      FROM coaching.exercise_variant_v1
      WHERE definition_id = duplicate_id
    );

    UPDATE coaching.exercise_variant_v1
    SET definition_id = survivor_id,
        variant_key = left(
          'legacy-'
          || replace(source.declared_implement, '_', '-')
          || '-'
          || replace(source.tempo_contract, '_', '-')
          || '-source-'
          || COALESCE(duplicate_legacy_id::TEXT, left(duplicate_id::TEXT, 8))
          || '-'
          || variant_key,
          120
        ),
        status = 'archived',
        requirements_json = requirements_json || jsonb_build_object(
          'sourceIdentityDuplicate', TRUE,
          'sourceDefinitionId', duplicate_id,
          'declaredImplement', source.declared_implement,
          'implementQuantity', source.implement_quantity,
          'loadPath', source.load_path,
          'tempoContract', source.tempo_contract,
          'selectable', FALSE,
          'identityQuarantine', TRUE
        ),
        updated_at = now()
    WHERE definition_id = duplicate_id;

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
              duplicate.display_name,
              source.retained_alias
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
          'identityResolution',
            'bilateral_loaded_romanian_deadlift_identity_equivalence',
          'consolidatedDefinitionIds',
            COALESCE(
              survivor.provenance_json->'consolidatedDefinitionIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_id::TEXT),
          'consolidatedLegacyExerciseIds',
            COALESCE(
              survivor.provenance_json->'consolidatedLegacyExerciseIds',
              '[]'::JSONB
            ) || to_jsonb(duplicate_legacy_id),
          'exerciseSkillLevelAllowed', FALSE,
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 duplicate
    WHERE survivor.id = survivor_id
      AND duplicate.id = duplicate_id;

    UPDATE coaching.exercise_card_test_packet_v1
    SET status = 'quarantined',
        blocking_issues_json = blocking_issues_json || jsonb_build_array(
          jsonb_build_object(
            'code', 'romanian_deadlift_identity_reaudit_required',
            'message', 'Re-run the canonical card audit after Romanian-deadlift identity consolidation.'
          )
        ),
        human_review_required = TRUE,
        checked_at = now()
    WHERE definition_id = survivor_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'duplicate_consolidated',
          'canonicalSurvivorDefinitionId', survivor_id,
          'declaredImplement', source.declared_implement,
          'implementQuantity', source.implement_quantity,
          'loadPath', source.load_path,
          'tempoContract', source.tempo_contract,
          'exerciseSkillLevelAllowed', FALSE,
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = duplicate_id;
  END LOOP;
END;
$$;
