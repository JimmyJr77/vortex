-- Consolidate nine redundant exercise definitions into four stable identities:
--   * three Snap-Down to Stick synonyms;
--   * two Mirror Shuffle synonyms;
--   * two distance-labelled Sprint-to-Stick Deceleration cards;
--   * two Single-Leg Pogo synonyms.
--
-- Distance, support, travel direction, cue source, lane size, cadence, arm
-- position, amplitude, dose, and session intent remain exact variant or
-- delivery dimensions. Rebound, single-leg snap-down, crossover or sprint
-- exits, pre-planned shuffles, multidirectional cuts, and stick-after-pogo
-- actions remain separate identities.
--
-- No exercise skill or proficiency level is introduced. Exercise difficulty
-- remains complexity plus physical difficulty, with overall equal to the
-- greater value. No human, publication, media, graph, or calibration approval
-- is created. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '353_coaching_reactive_landing_pogo_identity_consolidations';
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
    FROM (
      VALUES
        (
          'snap-down-to-stick',
          'snap-down-to-athletic-stick',
          'Snap-Down to Stick',
          'same_tall_to_bilateral_athletic_stick_action',
          'Snap-Down to Athletic Stick and Snap-Down to Stick both begin from tall organized posture, rapidly lower the arms and center of mass into a bilateral athletic landing position, and hold the finish without a rebound. Athletic only describes the required finish. Arm start, depth, stance width, cadence, hold duration, and session context remain variant or delivery dimensions.',
          ARRAY['Snap-Down to Athletic Stick','Athletic Snap-Down to Stick']::TEXT[],
          '["arm_start","stance_width","depth","cadence","stick_duration","session_context"]'::JSONB
        ),
        (
          'snap-down-to-stick',
          'snapdown-landing-stick',
          'Snap-Down to Stick',
          'same_tall_to_bilateral_athletic_stick_action',
          'Snapdown Landing Stick uses the same rapid tall-to-athletic bilateral descent and static finish as Snap-Down to Stick. Calling the terminal position an isometric landing stick does not create a second exercise because the stick is already the defining completion rule.',
          ARRAY['Snapdown Landing Stick','Snap Down Landing Stick']::TEXT[],
          '["arm_start","stance_width","depth","cadence","stick_duration","session_context"]'::JSONB
        ),
        (
          'snap-down-to-stick',
          'snap-down-to-stick-control-version',
          'Snap-Down to Stick',
          'same_tall_to_bilateral_athletic_stick_action',
          'The Control Version explicitly reaches tall, snaps down, lands in a bilateral athletic stance, and freezes without rebound, which is the canonical Snap-Down to Stick contract. Control is a delivery intent rather than a new identity.',
          ARRAY['Snap-Down to Stick Control Version','Snap Down Control']::TEXT[],
          '["arm_start","stance_width","depth","cadence","stick_duration","session_context"]'::JSONB
        ),
        (
          'mirror-shuffle',
          'mirror-shuffle-drill',
          'Mirror Shuffle',
          'same_partner_led_lateral_mirroring_action',
          'Mirror Shuffle Drill and Mirror Shuffle both place a leader and follower face-to-face inside a bounded lane; the leader changes lateral direction and the follower mirrors the live body cue while maintaining spacing and an athletic base. Drill adds no movement or decision rule.',
          ARRAY['Mirror Shuffle Drill','Partner Mirror Drill Shuffle']::TEXT[],
          '["lane_width","leader_speed","round_duration","role","cue_complexity","spacing"]'::JSONB
        ),
        (
          'mirror-shuffle',
          'partner-mirror-shuffle',
          'Mirror Shuffle',
          'same_partner_led_lateral_mirroring_action',
          'Partner Mirror Shuffle declares the same leader-follower lateral mirror task already required by Mirror Shuffle. Partner names the live cue source, not an alternate identity. Box size, speed, role rotation, response window, and round duration remain delivery dimensions.',
          ARRAY['Partner Mirror Shuffle','Partner Mirror Shuffle Box']::TEXT[],
          '["lane_or_box_size","leader_speed","round_duration","role","cue_complexity","spacing"]'::JSONB
        ),
        (
          'sprint-to-stick-deceleration',
          '5-yard-acceleration-decel-stick',
          'Sprint-to-Stick Deceleration',
          'same_linear_acceleration_to_bilateral_stick_action',
          'A five-yard acceleration followed by a planned linear braking zone and controlled bilateral stick is an exact distance variant of Sprint-to-Stick Deceleration. Approach distance changes achieved entry speed, physical demand, and setup but not the defining accelerate-brake-stick sequence.',
          ARRAY['5-Yard Acceleration Decel Stick','5 Yard Acceleration Deceleration Stick']::TEXT[],
          '["approach_distance","entry_velocity","braking_zone","start_stance","stick_duration","rest"]'::JSONB
        ),
        (
          'sprint-to-stick-deceleration',
          '5-yard-accel-to-decel-stick',
          'Sprint-to-Stick Deceleration',
          'same_linear_acceleration_to_bilateral_stick_action',
          'Accel and decel abbreviate acceleration and deceleration. This source prescribes the same five-yard linear acceleration, planned braking, bilateral athletic stop, and two-second stick as the five-yard Sprint-to-Stick variant.',
          ARRAY['5-Yard Accel to Decel Stick','5 Yard Accel-Decel Stick']::TEXT[],
          '["approach_distance","entry_velocity","braking_zone","start_stance","stick_duration","rest"]'::JSONB
        ),
        (
          'single-leg-pogo',
          'single-leg-pogo-in-place',
          'Single-Leg Pogo',
          'same_repeated_unilateral_ankle_dominant_hopping_action',
          'Single-Leg Pogo in Place is the stationary exact variant of Single-Leg Pogo: repeated low-amplitude unilateral contacts with an ankle-dominant spring, tall posture, controlled pelvis, and no terminal stick between contacts. Stationary versus traveling direction belongs on the variant.',
          ARRAY['Single-Leg Pogo in Place','Single Leg Stationary Pogo']::TEXT[],
          '["support","travel_direction","amplitude","cadence","arm_action","contact_count"]'::JSONB
        ),
        (
          'single-leg-pogo',
          'single-leg-pogo-jumps',
          'Single-Leg Pogo',
          'same_repeated_unilateral_ankle_dominant_hopping_action',
          'Single-Leg Pogo Jumps is a pluralized generic label for the same repeated unilateral ankle-dominant hopping action. Direction, amplitude, cadence, arm action, contact count, and support determine the exact variant and dose.',
          ARRAY['Single-Leg Pogo Jumps','Single Leg Pogo Hops']::TEXT[],
          '["support","travel_direction","amplitude","cadence","arm_action","contact_count"]'::JSONB
        )
    ) AS pairs(
      survivor_slug,
      duplicate_slug,
      canonical_name,
      identity_match,
      rationale,
      extra_aliases,
      variant_dimensions
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
        'researchBatch', 'reactive-landing-pogo-identity-v1',
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
          'resolution', pair.identity_match,
          'researchBatch', 'reactive-landing-pogo-identity-v1',
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
          'researchBatch', 'reactive-landing-pogo-identity-v1',
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

-- The shorter name created by consolidation raises a high-similarity review
-- pair with Hold-to-Hop. Preserve the mechanical boundary explicitly:
-- continuous repeated contacts without an inter-repetition stick versus a
-- hold-entry sequence that finishes each short bout with a stick or reset.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id = resolution.resolved_definition_id
    WHERE left_definition.facility_id = 1
      AND ARRAY[
        left_definition.slug,
        right_definition.slug
      ] @> ARRAY[
        'single-leg-pogo',
        'single-leg-pogo-hold-to-hop'
      ]::TEXT[]
      AND resolution.decision <> 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      '353_coaching_reactive_landing_pogo_identity_consolidations conflicts with a protected Single-Leg Pogo versus Hold-to-Hop decision';
  END IF;
END;
$$;

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
  1,
  repeated.id,
  hold_to_hop.id,
  'distinct_exercises',
  'Single-Leg Pogo is a continuous repeated-contact action with no intentional stick between contacts. Single-Leg Pogo Hold-to-Hop begins from a declared balance hold, performs a short pogo bout, and finishes with a stick or full reset. The entry hold, bout boundary, and terminal control event change the action and programming contract rather than merely dose or direction.',
  jsonb_build_object(
    'match', 'distinct_continuous_contacts_vs_hold_entry_terminal_stick',
    'leftSlug', repeated.slug,
    'rightSlug', hold_to_hop.slug,
    'definingBoundary', jsonb_build_object(
      'singleLegPogo',
        'continuous repeated contacts without an intentional inter-repetition stick',
      'holdToHop',
        'declared balance hold, short contact bout, then terminal stick or full reset'
    ),
    'researchBatch', 'reactive-landing-pogo-identity-v1',
    'exerciseDifficultyModel',
      'max_exercise_complexity_physical_difficulty',
    'humanReviewRequired', TRUE,
    'publicationQuarantined', TRUE,
    'migration',
      '353_coaching_reactive_landing_pogo_identity_consolidations'
  ),
  'deterministic_identity_equivalence',
  NULL,
  now()
FROM coaching.exercise_definition_v1 repeated
JOIN coaching.exercise_definition_v1 hold_to_hop
  ON hold_to_hop.facility_id = repeated.facility_id
WHERE repeated.facility_id = 1
  AND repeated.slug = 'single-leg-pogo'
  AND repeated.status <> 'archived'
  AND hold_to_hop.slug = 'single-leg-pogo-hold-to-hop'
  AND hold_to_hop.status <> 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.decision = 'distinct_exercises'
      AND resolution.resolution_source = 'human_review'
      AND ARRAY[
        resolution.survivor_definition_id,
        resolution.resolved_definition_id
      ] @> ARRAY[
        repeated.id,
        hold_to_hop.id
      ]::UUID[]
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 repeated
      ON repeated.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 hold_to_hop
      ON hold_to_hop.id = resolution.resolved_definition_id
    WHERE repeated.facility_id = 1
      AND ARRAY[
        repeated.slug,
        hold_to_hop.slug
      ] @> ARRAY[
        'single-leg-pogo',
        'single-leg-pogo-hold-to-hop'
      ]::TEXT[]
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      '353_coaching_reactive_landing_pogo_identity_consolidations requires the Single-Leg Pogo versus Hold-to-Hop identity boundary';
  END IF;
END;
$$;
