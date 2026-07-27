-- Adjudicate the next ten score-84 name-similarity candidates as distinct
-- exercise identities. Each pair crosses a declared movement-contract
-- boundary: rotation angle, ordered contacts, support geometry, projection
-- direction, or a required terminal action.
--
-- This migration resolves identity-queue warnings only. It does not alter card
-- content, aliases, difficulty, media, relationships, calibration, review, or
-- publication. Exercise cards receive no skill or proficiency level; exercise
-- difficulty remains complexity plus physical difficulty, with overall equal
-- to their maximum. Human identity decisions are preserved. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '355_coaching_score_84_identity_boundaries';
  boundary RECORD;
  left_definition RECORD;
  right_definition RECORD;
  conflicting_resolutions INTEGER;
  left_count INTEGER;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        '180-jump-to-stick',
        '90-degree-jump-turn-to-stick',
        'half_turn_vs_quarter_turn',
        '180 Jump to Stick requires a half-turn before the terminal landing, while 90-Degree Jump Turn to Stick requires a quarter-turn. The declared rotation changes aerial orientation, visual reacquisition, landing direction, coordination demand, coaching constraints, and progression choice, so these remain separate exercise identities.',
        jsonb_build_object(
          'leftRotationDegrees', 180,
          'rightRotationDegrees', 90,
          'sharedTerminalAction', 'controlled_stick',
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/'
          )
        )
      ),
      (
        'backpedal-to-sprint-to-stick',
        'backpedal-to-sprint-turn',
        'required_terminal_deceleration_stick',
        'Backpedal-to-Sprint-to-Stick requires backpedal, transition, forward acceleration, planned braking, and a balanced terminal stick. Backpedal to Sprint Turn is defined by the rearward-to-forward hip flip and sprint exit; a separate planned braking zone and terminal stick are not identity requirements. The added deceleration-and-stick contract changes space, impact and fatigue budgeting, coaching, and stop rules.',
        jsonb_build_object(
          'leftOrder', jsonb_build_array(
            'backpedal',
            'hip_flip_or_transition',
            'forward_acceleration',
            'planned_deceleration',
            'terminal_stick'
          ),
          'rightOrder', jsonb_build_array(
            'backpedal',
            'hip_flip_or_transition',
            'forward_acceleration_or_sprint_exit'
          ),
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/'
          )
        )
      ),
      (
        'lateral-hop-to-stick',
        'lateral-quick-step-to-stick',
        'bilateral_flight_vs_stepping_rhythm',
        'Bilateral Lateral Jump to Stick requires simultaneous two-leg lateral takeoff, a flight phase, simultaneous two-foot landing, and a held stick. Lateral Quick Step to Stick is a ladder or line stepping-rhythm task followed by a terminal stick. Replacing a flight-and-landing event with repeated steps changes contact order, impact, equipment, logistics, coaching, and dosage.',
        jsonb_build_object(
          'leftContactContract', 'bilateral_takeoff_flight_bilateral_landing',
          'rightContactContract', 'alternating_lateral_steps_then_stick',
          'researchSources', jsonb_build_array(
            'https://pubmed.ncbi.nlm.nih.gov/32148612/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
          )
        )
      ),
      (
        'bound-to-stick',
        'curved-bound-to-stick',
        'linear_projection_vs_curved_heading',
        'Bound to Stick is the linear contralateral single-leg projection-and-stick task. Curved Bound to Stick requires projection around a declared curve with a changing travel heading. The curved path adds orientation and redirection constraints that change setup, landing alignment, perception, coaching, and progression choice.',
        jsonb_build_object(
          'leftProjection', 'linear_contralateral',
          'rightProjection', 'curved_with_changing_heading',
          'researchSources', jsonb_build_array(
            'https://pubmed.ncbi.nlm.nih.gov/32148612/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/'
          )
        )
      ),
      (
        'bound-to-stick',
        'skater-bound-to-stick',
        'linear_projection_vs_frontal_lateral_projection',
        'Bound to Stick is the linear contralateral bound-and-stick task. Skater Bound to Stick requires frontal-plane lateral projection and unilateral lateral deceleration. Projection direction changes joint loading, landing alignment, lane geometry, coaching constraints, and substitution logic, so these remain separate exercise identities.',
        jsonb_build_object(
          'leftProjection', 'linear_contralateral',
          'rightProjection', 'frontal_plane_lateral',
          'researchSources', jsonb_build_array(
            'https://pubmed.ncbi.nlm.nih.gov/32148612/',
            'https://pubmed.ncbi.nlm.nih.gov/28090004/'
          )
        )
      ),
      (
        'box-jump',
        'countermovement-jump-rebound',
        'elevated_terminal_landing_vs_immediate_second_takeoff',
        'Box Jump requires a floor takeoff and controlled terminal landing on a stable elevated box. Countermovement Jump Rebound requires a countermovement jump followed by an immediate second takeoff. The rebound contact, absence of a terminal elevated target, reactive demand, impact profile, and equipment contract make these distinct exercises.',
        jsonb_build_object(
          'leftOrder', jsonb_build_array(
            'floor_takeoff',
            'elevated_box_landing',
            'stand_and_step_down'
          ),
          'rightOrder', jsonb_build_array(
            'countermovement_takeoff',
            'ground_contact',
            'immediate_second_takeoff'
          ),
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
          )
        )
      ),
      (
        'broad-jump-to-box-jump',
        'low-box-drop-to-broad-jump',
        'horizontal_then_elevated_jump_vs_drop_then_horizontal_rebound',
        'Broad Jump to Box Jump starts on the floor, completes a horizontal jump, then jumps to an elevated box. Low Box Drop to Broad Jump starts elevated, drops to the floor, and immediately rebounds horizontally. Reversing the initial condition and ordered contacts changes landing count, reactive demand, box placement, impact budget, coaching, and stop rules.',
        jsonb_build_object(
          'leftOrder', jsonb_build_array(
            'floor_start',
            'horizontal_jump',
            'controlled_contact',
            'jump_to_elevated_box'
          ),
          'rightOrder', jsonb_build_array(
            'elevated_start',
            'drop_to_floor',
            'immediate_horizontal_rebound'
          ),
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/'
          )
        )
      ),
      (
        'bulgarian-split-squat',
        'front-foot-elevated-split-squat',
        'rear_foot_elevated_vs_front_foot_elevated',
        'Bulgarian Split Squat elevates the rear foot while the lead foot remains on the floor. Front-Foot-Elevated Split Squat elevates the whole lead foot while the rear forefoot remains on the floor. The opposite support geometry changes setup, balance, available joint angles, loading strategy, coaching, and substitution logic.',
        jsonb_build_object(
          'leftSupportGeometry', 'rear_foot_elevated',
          'rightSupportGeometry', 'front_foot_elevated',
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC8136570/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC11611527/',
            'https://pubmed.ncbi.nlm.nih.gov/24345718/'
          )
        )
      ),
      (
        'cossack-squat',
        'landmine-hack-squat',
        'lateral_unilateral_shift_vs_bilateral_fixed_bar_path',
        'Cossack Squat shifts side-to-side into a deep unilateral lateral squat while the opposite leg lengthens. Landmine Hack Squat is a bilateral squat using the landmine fixed angled load path. Stance, plane, laterality, external-load path, equipment, and range-of-motion intent are different identity-defining contracts.',
        jsonb_build_object(
          'leftContract', 'lateral_unilateral_weight_shift_with_opposite_leg_lengthened',
          'rightContract', 'bilateral_squat_against_fixed_angled_landmine_path',
          'researchSources', jsonb_build_array(
            'https://pubmed.ncbi.nlm.nih.gov/41886869/',
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/'
          )
        )
      ),
      (
        'crossover-step-and-go',
        'drop-step-crossover-go',
        'crossover_first_step_vs_drop_step_then_crossover',
        'Crossover Step and Go uses an open-hip crossover as the first declared step from athletic stance. Drop-Step Crossover Go requires a drop step before the crossover and drive. The added ordered foot contact changes initial reorientation, space, timing, coaching, and use in change-of-direction progressions.',
        jsonb_build_object(
          'leftOrder', jsonb_build_array(
            'athletic_stance',
            'crossover_first_step',
            'go'
          ),
          'rightOrder', jsonb_build_array(
            'athletic_stance',
            'drop_step',
            'crossover',
            'go'
          ),
          'researchSources', jsonb_build_array(
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/',
            'https://www.nsca.com/education/articles/kinetic-select/run-and-cut/'
          )
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
    SELECT COUNT(*)
    INTO left_count
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND status <> 'archived';

    IF left_count = 0 THEN
      RAISE EXCEPTION
        '% requires at least one active definition for %',
        migration_key,
        boundary.left_slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 active_right
      WHERE active_right.slug = boundary.right_slug
        AND active_right.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_definition_v1 active_left
          WHERE active_left.facility_id = active_right.facility_id
            AND active_left.slug = boundary.left_slug
            AND active_left.status <> 'archived'
        )
    ) THEN
      RAISE EXCEPTION
        '% found active % without active % in the same facility',
        migration_key,
        boundary.right_slug,
        boundary.left_slug;
    END IF;

    FOR left_definition IN
      SELECT id, facility_id
      FROM coaching.exercise_definition_v1
      WHERE slug = boundary.left_slug
        AND status <> 'archived'
    LOOP
      right_definition := NULL;

      SELECT id
      INTO right_definition
      FROM coaching.exercise_definition_v1
      WHERE facility_id = left_definition.facility_id
        AND slug = boundary.right_slug
        AND status <> 'archived';

      IF right_definition.id IS NULL THEN
        RAISE EXCEPTION
          '% requires active % with % in facility %',
          migration_key,
          boundary.right_slug,
          boundary.left_slug,
          left_definition.facility_id;
      END IF;

      SELECT COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_definition.id
          AND resolution.resolved_definition_id = right_definition.id
        )
        OR (
          resolution.survivor_definition_id = right_definition.id
          AND resolution.resolved_definition_id = left_definition.id
        )
      )
        AND resolution.decision <> 'distinct_exercises';

      IF conflicting_resolutions > 0 THEN
        RAISE EXCEPTION
          '% conflicts with % existing decision(s) for % and %',
          migration_key,
          conflicting_resolutions,
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
        reviewed_by
      )
      SELECT
        left_definition.facility_id,
        left_definition.id,
        right_definition.id,
        'distinct_exercises',
        boundary.rationale,
        boundary.evidence || jsonb_build_object(
          'identityBoundary', boundary.identity_boundary,
          'researchVersion', '2026-07-27.46',
          'migration', migration_key,
          'decisionScope',
            'identity_only_not_card_media_graph_calibration_or_publication_approval',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE,
          'exerciseDifficultyModel',
            'exercise_complexity_and_physical_difficulty_only'
        ),
        'deterministic_identity_equivalence',
        NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 existing
        WHERE (
          (
            existing.survivor_definition_id = left_definition.id
            AND existing.resolved_definition_id = right_definition.id
          )
          OR (
            existing.survivor_definition_id = right_definition.id
            AND existing.resolved_definition_id = left_definition.id
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
            resolution.survivor_definition_id = left_definition.id
            AND resolution.resolved_definition_id = right_definition.id
          )
          OR (
            resolution.survivor_definition_id = right_definition.id
            AND resolution.resolved_definition_id = left_definition.id
          )
        )
          AND resolution.decision = 'distinct_exercises'
      ) THEN
        RAISE EXCEPTION
          '% did not persist distinct boundary for % and %',
          migration_key,
          boundary.left_slug,
          boundary.right_slug;
      END IF;
    END LOOP;
  END LOOP;
END $$;
