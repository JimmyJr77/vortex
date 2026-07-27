-- Resolve the mechanically explicit members of the remaining score-84 queue
-- and quarantine the one source pair whose takeoff/contact contract is not
-- recoverable from the legacy card.
--
-- These records change identity-queue state only. They do not change cards,
-- variants, difficulty, media, graph, calibration, review, or publication.
-- Exercise cards receive no skill/proficiency level. Exercise difficulty
-- remains complexity plus physical difficulty, with overall equal to their
-- maximum. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '357_coaching_remaining_score_84_identity_boundaries';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  facility BIGINT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'half-kneeling-cable-chop',
        'half-kneeling-cable-lift',
        'distinct_exercises',
        'high_to_low_chop_vs_low_to_high_lift',
        'Half-Kneeling Cable Chop uses a high-to-low diagonal cable path, while Half-Kneeling Cable Lift uses a low-to-high diagonal path. Reversing the path changes the start and finish, shoulder and trunk action, anchor placement, coaching, and substitution contract.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/'
        )
      ),
      (
        'lateral-one-in-shuffle',
        'lateral-two-in-shuffle',
        'distinct_exercises',
        'one_foot_vs_two_feet_per_ladder_space',
        'Lateral One-In Shuffle requires one foot contact in each successive ladder space. Lateral Two-In Shuffle requires both feet to enter each space before advancing. The ordered foot contacts, cadence, lead/trail timing, error definition, and coaching progression are different movement contracts.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/'
        )
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-landmine-floor-press',
        'distinct_exercises',
        'arc_press_path_vs_floor_supported_press',
        'One-Arm Landmine Arc Press is defined by moving the fixed bar end through a declared arcing press path. One-Arm Landmine Floor Press is defined by the floor-supported pressing base and its floor-limited range. Path, support base, setup, range, bracing, and spotting requirements make these separate exercises.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-floor-press',
        'one-arm-landmine-z-press',
        'distinct_exercises',
        'floor_supported_press_vs_long_sit_z_press',
        'One-Arm Landmine Floor Press uses a floor-supported supine press with floor-limited shoulder extension. One-Arm Landmine Z-Press uses an upright long-sit base without lower-body drive. Body orientation, support base, range, trunk demand, setup, and exit are identity-defining differences.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-landmine-z-press',
        'distinct_exercises',
        'arc_press_path_vs_long_sit_z_press',
        'One-Arm Landmine Arc Press is defined by its arcing bar-end path, while One-Arm Landmine Z-Press is defined by an upright long-sit press base without lower-body drive. Press path, support base, trunk demand, setup, and finish remain separate movement contracts.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'romanian-deadlift',
        'sandbag-deadlift-strength',
        'distinct_exercises',
        'standing_top_down_rdl_vs_floor_origin_deadlift',
        'Romanian Deadlift begins from a declared standing loaded position, uses soft knees and a top-down hips-back eccentric, then reverses from an owned range. Sandbag Deadlift begins with the implement on the floor and requires a floor-origin pull. Initial condition, pickup, knee contribution, range, grip, set-down, fatigue, and coaching differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/',
          'https://pubmed.ncbi.nlm.nih.gov/30662500/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC7046193/'
        )
      ),
      (
        'single-leg-lateral-hop-to-stick',
        'single-leg-line-hop-and-stick',
        'needs_human_review',
        'legacy_line_hop_takeoff_and_contact_sequence_underspecified',
        'Single-Leg Lateral Hop to Stick has an exact same-leg takeoff, same-leg landing, one lateral flight, and terminal hold. The legacy Single-Leg Line Hop and Stick source does not declare whether the athlete crosses once or repeatedly, whether takeoff and landing use the same leg, or whether the finish is a stick or reacceleration. Those facts determine identity and cannot be inferred safely.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32148612/',
          'https://pubmed.ncbi.nlm.nih.gov/37300972/'
        )
      )
    ) AS boundaries(
      left_slug,
      right_slug,
      decision,
      identity_boundary,
      rationale,
      research_sources
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
        '% requires active definitions % and %',
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
        AND resolution.decision <> boundary.decision
    ) THEN
      RAISE EXCEPTION
        '% conflicts with existing identity decision for % and %',
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
      boundary.decision,
      boundary.rationale,
      jsonb_build_object(
        'identityBoundary', boundary.identity_boundary,
        'researchSources', boundary.research_sources,
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
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
        AND existing.decision = boundary.decision
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

    IF NOT EXISTS (
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
        AND resolution.decision = boundary.decision
    ) THEN
      RAISE EXCEPTION
        '% did not persist decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;
  END LOOP;
END;
$$;
