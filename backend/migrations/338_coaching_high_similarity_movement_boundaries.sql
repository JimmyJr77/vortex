-- Resolve high name-similarity pairs whose declared movement contract changes
-- direction, base, target, added action, contact count, laterality, or force
-- strategy. These are deterministic identity boundaries, not card approvals.
--
-- No exercise skill or proficiency level is assigned. Exercise difficulty is
-- assessed through exercise complexity and physical difficulty, with overall
-- derived as their maximum. IDEMPOTENT and fail-closed.

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
        '2-point-start-10-20m',
        '3-point-start-10-20m',
        'two_point_vs_three_point_start_base',
        'The two-point start uses two foot contacts and no ground hand, while the three-point start adds a ground-hand contact and different start geometry. Start base, joint positions, rise pattern, setup time, accessibility, supervision, and first-step execution remain distinct exercise contracts.',
        '{"leftStart":"two_point_no_ground_hand","rightStart":"three_point_one_ground_hand","changedDimensions":["start_position","support_contacts","accessibility","first_step_geometry"]}'::JSONB
      ),
      (
        'bear-crawl-ladder',
        'lateral-bear-crawl',
        'forward_or_general_vs_lateral_crawl_direction',
        'Bear Crawl Ladder uses the declared forward or general contralateral ladder path, while Lateral Bear Crawl requires sideways travel. Travel direction changes hand-foot sequencing, frontal-plane demand, lane layout, observation, dosage, and substitutions.',
        '{"leftDirection":"forward_or_declared_general","rightDirection":"lateral","changedDimensions":["travel_direction","coordination","lane_layout"]}'::JSONB
      ),
      (
        'bear-plank-shoulder-tap',
        'tall-plank-shoulder-tap',
        'knees_hovered_bear_base_vs_extended_tall_plank_base',
        'Bear Plank Shoulder Tap uses flexed hips and knees with the knees hovering near the floor. Tall Plank Shoulder Tap uses an extended high-plank body line. Base geometry, lever length, hip and knee position, trunk demand, wrist loading, and scaling are separate exercise contracts.',
        '{"leftBase":"bear_plank_knees_hovered","rightBase":"tall_plank_extended_body_line","changedDimensions":["base","leverage","joint_positions","load_distribution"]}'::JSONB
      ),
      (
        'box-jump',
        'countermovement-jump',
        'box_landing_target_vs_floor_landing',
        'Box Jump projects onto a raised box and requires box-height selection, top landing, stand or stabilization, and step-down logistics. Countermovement Jump returns to the floor without a raised target. Landing target, flight constraint, impact distribution, equipment, and failure consequence remain distinct; arm action and countermovement strategy stay exact variants inside the box-jump identity.',
        '{"leftLanding":"raised_box","rightLanding":"floor","leftVariantDimensions":["arm_action","countermovement_strategy"],"changedDimensions":["landing_target","equipment","failure_consequence","descent_logistics"]}'::JSONB
      ),
      (
        'isometric-ankle-eversion-press',
        'isometric-ankle-inversion-press',
        'outward_eversion_vs_inward_inversion_force_direction',
        'Isometric ankle eversion presses outward and loads the lateral evertor action; isometric ankle inversion presses inward and loads the medial invertor action. Force direction, target tissues, resistance placement, observation, symptoms, and substitutions are opposite and remain distinct.',
        '{"leftForceDirection":"eversion_outward","rightForceDirection":"inversion_inward","changedDimensions":["primary_joint_action","force_direction","target_tissues","resistance_placement"]}'::JSONB
      ),
      (
        'landmine-romanian-deadlift-to-row',
        'romanian-deadlift',
        'hinge_plus_row_vs_hinge_only',
        'Landmine Romanian Deadlift to Row adds a deliberate upper-body row to the loaded hinge. Romanian Deadlift ends after hip extension without the row. Added elbow flexion and shoulder-extension action changes primary stimulus, grip and upper-back load, sequence, fatigue, dosage, and substitutions.',
        '{"leftActions":["loaded_hinge","row"],"rightActions":["loaded_hinge"],"changedDimensions":["primary_joint_action","primary_training_stimulus","sequence","fatigue"]}'::JSONB
      ),
      (
        'medicine-ball-clean-to-squat',
        'medicine-ball-squat-clean-to-wall-ball-shot',
        'clean_and_squat_vs_clean_squat_and_wall_shot',
        'Medicine Ball Clean to Squat completes after the clean, controlled squat, and stand. Medicine Ball Squat Clean to Wall Ball Shot adds a ballistic wall-target release and associated catch or retrieval contract. The added projection, wall, ball path, impact, fatigue, and safety requirements create a separate exercise.',
        '{"leftActions":["clean","squat"],"rightActions":["clean","squat","wall_ball_shot"],"changedDimensions":["primary_joint_action","ballistic_release","equipment","safety","fatigue"]}'::JSONB
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-triple-hop-to-stick',
        'one_projection_contact_vs_three_repeated_projections',
        'Single-Leg Hop to Stick uses one unilateral projection followed by a terminal landing. Single-Leg Triple Hop to Stick uses three repeated unilateral projections before the terminal landing. Contact count, repeated elastic demand, distance strategy, impact budget, fatigue, time, and stop rules remain distinct.',
        '{"leftProjectionCount":1,"rightProjectionCount":3,"changedDimensions":["contact_count","repeated_elastic_demand","impact_budget","fatigue","distance_strategy"]}'::JSONB
      ),
      (
        'split-squat-jump-to-stick',
        'squat-jump-to-stick',
        'split_stance_unilateral_bias_vs_bilateral_squat_base',
        'Split-Squat Jump to Stick starts and finishes from a split stance with asymmetric front- and rear-leg roles. Squat Jump to Stick uses a bilateral squat base. Laterality, stance, propulsion distribution, landing, pelvis control, side dosage, and substitutions remain distinct.',
        '{"leftBase":"split_stance_asymmetrical","rightBase":"bilateral_squat","changedDimensions":["stance","laterality","propulsion_distribution","landing","side_dosage"]}'::JSONB
      ),
      (
        'two-hand-landmine-press',
        'two-hand-landmine-push-press',
        'strict_press_vs_deliberate_lower_body_drive',
        'Two-Hand Landmine Press uses a strict press without deliberate lower-body drive. Two-Hand Landmine Push Press adds a dip and forceful leg drive. Force strategy, primary stimulus, load potential, coordination, fatigue, dosage, and substitutions remain distinct.',
        '{"leftLegDrive":false,"rightLegDrive":true,"changedDimensions":["force_strategy","primary_joint_action","load_potential","coordination","fatigue"]}'::JSONB
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
        'Movement boundary requires active definitions % and % in one facility',
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
        'Movement boundary for % and % conflicts with % existing resolution(s)',
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
          'deterministic_movement_boundary_not_card_media_graph_calibration_or_publication_approval',
        'humanReviewRequired', TRUE,
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'proficiencyClassificationScope',
          'coaching_skill_library_only'
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
        'Movement boundary for % and % was not persisted',
        boundary.left_slug,
        boundary.right_slug;
    END IF;
  END LOOP;
END $$;
