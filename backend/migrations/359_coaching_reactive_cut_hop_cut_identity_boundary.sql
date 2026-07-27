-- Preserve the identity boundary exposed after the reactive hop-to-cut
-- consolidation.
--
-- Reactive 45-Degree Cut is a cue-driven change of direction over a marked
-- approach and exit task. Reactive Hop-to-Cut first requires a discrete hop,
-- presents the cue during the hop or landing, and uses that landing contact to
-- enter the cut. The added airborne action and landing-to-cut transition
-- change the ordered contact sequence, impact count, cue window, fatigue,
-- coaching, regression, and stop-rule contract.
--
-- This migration records identity state only. It does not approve, publish, or
-- otherwise complete either card. It introduces no exercise
-- skill/proficiency level. Exercise difficulty remains complexity plus
-- physical difficulty, with overall equal to their maximum.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '359_coaching_reactive_cut_hop_cut_identity_boundary';
  left_id UUID;
  right_id UUID;
  facility BIGINT;
BEGIN
  SELECT id, facility_id
  INTO left_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'reactive-45-degree-cut'
    AND facility_id = 1
    AND status <> 'archived';

  SELECT id
  INTO right_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'reactive-hop-to-cut'
    AND facility_id = facility
    AND status <> 'archived';

  IF left_id IS NULL OR right_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active definitions reactive-45-degree-cut and reactive-hop-to-cut',
      migration_key;
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
      '% conflicts with existing identity decision for reactive-45-degree-cut and reactive-hop-to-cut',
      migration_key;
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
    'Reactive 45-Degree Cut is a cue-driven change-of-direction task over a marked approach and exit. Reactive Hop-to-Cut adds a discrete airborne hop before the direction decision and presents the cue during the hop or landing, so the landing contact becomes the transition into the cut. The added takeoff, flight, landing impact, ordered contact sequence, cue window, and landing-to-cut transition change load, fatigue, coaching, quality gates, regressions, and stop rules.',
    jsonb_build_object(
      'identityBoundary',
        'marked_approach_cut_vs_discrete_hop_landing_to_cut',
      'leftSourceContract', jsonb_build_object(
        'slug', 'reactive-45-degree-cut',
        'requiredSequence', jsonb_build_array(
          'marked_approach',
          'live_direction_cue',
          'cut_plant',
          'controlled_exit'
        )
      ),
      'rightSourceContract', jsonb_build_object(
        'slug', 'reactive-hop-to-cut',
        'requiredSequence', jsonb_build_array(
          'discrete_hop_takeoff',
          'airborne_cue_or_landing_cue',
          'landing_contact',
          'directional_cut',
          'controlled_acceleration'
        )
      ),
      'distinguishingDimensions', jsonb_build_array(
        'initial_action',
        'takeoff_count',
        'flight_count',
        'landing_impact_count',
        'ordered_contact_sequence',
        'cue_window',
        'landing_to_cut_transition',
        'approach_distance',
        'fatigue_signature',
        'quality_gates',
        'stop_rules'
      ),
      'researchSourceKeys', jsonb_build_array(
        'cutting_performance_injury_review',
        'cutting_alignment_scoring_tool',
        'reactive_y_agility_visual_gate'
      ),
      'researchSources', jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC8363537/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC8016420/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/'
      ),
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
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
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      '% could not persist the reactive cut identity boundary',
      migration_key;
  END IF;
END;
$$;
