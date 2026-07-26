-- Record deterministic movement boundaries for active cards whose names are
-- highly similar but whose ordered task or projection direction changes the
-- exercise identity.
--
-- These decisions resolve name-similarity warnings only. They do not approve
-- either card, media, relationships, calibrations, or publication, and they do
-- not assign exercise skill levels. Exercise difficulty remains exercise
-- complexity plus physical difficulty, with overall derived as their maximum.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  boundary RECORD;
  left_definition_id UUID;
  right_definition_id UUID;
  left_facility_id BIGINT;
  conflicting_resolutions INTEGER;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'medicine-ball-overhead-throw',
        'medicine-ball-overhead-back-throw',
        'forward_projection_vs_backward_projection',
        'Medicine Ball Overhead Throw projects a two-hand overhead release forward toward a declared open-distance, wall, or partner target. Medicine Ball Overhead Back Throw begins with the ball in front and projects it backward over the head after a declared countermovement. Opposite projection direction changes setup orientation, visual control, release mechanics, landing zone, retrieval, logistics, coaching, and stop rules, so these remain separate exercise identities.',
        jsonb_build_object(
          'leftProjection', 'forward',
          'rightProjection', 'backward_overhead',
          'leftStart', 'ball_overhead_or_behind_head_with_forward_target_visible',
          'rightStart', 'ball_in_front_with_backward_landing_zone_not_visible_during_release',
          'leftFinish', 'release_forward_toward_declared_target_or_open_lane',
          'rightFinish', 'release_backward_overhead_into_declared_clear_landing_sector',
          'researchSources', jsonb_build_array(
            'https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC3658404/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC8157825/'
          ),
          'humanReviewRequired', TRUE,
          'mediaReviewRequired', TRUE,
          'exerciseDifficultyModel',
            'exercise_complexity_and_physical_difficulty_only'
        )
      ),
      (
        'depth-drop-to-box-jump',
        'box-jump-to-depth-drop',
        'drop_then_jump_vs_jump_then_drop_order',
        'Depth Drop to Box Jump starts elevated, drops to the floor, and immediately rebounds onto a target box. Box Jump to Depth Drop starts on the floor, jumps onto the box, establishes the declared top contact, then steps or drops to the floor. Reversing the order changes the initial condition, reactive demand, landing count, equipment layout, fatigue and impact budget, coaching, and stop rules, so these remain separate exercise identities.',
        jsonb_build_object(
          'leftOrder', jsonb_build_array(
            'start_on_drop_box',
            'drop_to_floor',
            'reactive_jump_to_target_box'
          ),
          'rightOrder', jsonb_build_array(
            'start_on_floor',
            'jump_to_box',
            'controlled_step_or_drop_to_floor'
          ),
          'identityBoundary', 'ordered_contacts_and_initial_condition',
          'researchBatch',
            'scripts/data/canonical-research/batches/depth-box-order-sequences.v1.json',
          'humanReviewRequired', TRUE,
          'mediaReviewRequired', TRUE,
          'exerciseDifficultyModel',
            'exercise_complexity_and_physical_difficulty_only'
        )
      )
    ) AS boundaries(
      left_slug,
      right_slug,
      identity_boundary,
      rationale,
      evidence
    )
  LOOP
    left_definition_id := NULL;
    right_definition_id := NULL;
    left_facility_id := NULL;

    SELECT id, facility_id
    INTO left_definition_id, left_facility_id
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND status <> 'archived';

    SELECT id
    INTO right_definition_id
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = left_facility_id
      AND status <> 'archived';

    IF left_definition_id IS NULL OR right_definition_id IS NULL THEN
      RAISE EXCEPTION
        'Identity boundary requires active definitions % and % in one facility',
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    SELECT COUNT(*)
    INTO conflicting_resolutions
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = left_definition_id
        AND resolution.resolved_definition_id = right_definition_id
      )
      OR (
        resolution.survivor_definition_id = right_definition_id
        AND resolution.resolved_definition_id = left_definition_id
      )
    )
      AND resolution.decision <> 'distinct_exercises';

    IF conflicting_resolutions > 0 THEN
      RAISE EXCEPTION
        'Identity boundary for % and % conflicts with % existing resolution(s)',
        boundary.left_slug,
        boundary.right_slug,
        conflicting_resolutions;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source,
      reviewed_by
    )
    SELECT
      left_facility_id,
      left_definition_id,
      right_definition_id,
      'distinct_exercises',
      boundary.rationale,
      boundary.evidence || jsonb_build_object(
        'identityBoundary', boundary.identity_boundary,
        'decisionScope',
          'deterministic_identity_boundary_not_card_or_media_approval',
        'proficiencyClassificationScope', 'coaching_skill_library_only'
      ),
      'deterministic_identity_equivalence',
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_definition_id
          AND resolution.resolved_definition_id = right_definition_id
        )
        OR (
          resolution.survivor_definition_id = right_definition_id
          AND resolution.resolved_definition_id = left_definition_id
        )
      )
        AND resolution.decision = 'distinct_exercises'
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_definition_id
          AND resolution.resolved_definition_id = right_definition_id
        )
        OR (
          resolution.survivor_definition_id = right_definition_id
          AND resolution.resolved_definition_id = left_definition_id
        )
      )
        AND resolution.decision = 'distinct_exercises'
    ) THEN
      RAISE EXCEPTION
        'Identity boundary for % and % was not persisted',
        boundary.left_slug,
        boundary.right_slug;
    END IF;
  END LOOP;
END $$;
