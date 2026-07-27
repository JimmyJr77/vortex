-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- score-82 canonical identity queue.
--
-- These records resolve identity only. They do not approve or publish cards,
-- media, relationships, calibration, or dosage. Exercise cards use exercise
-- complexity and physical difficulty only; athlete skill/proficiency levels
-- remain exclusive to the skill library. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '375_coaching_score_82_identity_boundaries';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  left_status TEXT;
  right_status TEXT;
  facility BIGINT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        '10-yard-sprint',
        'pogo-to-10-yard-sprint',
        'distinct_exercises',
        'sprint_only_vs_pogo_contacts_then_sprint',
        '10-Yard Sprint begins with the declared sprint start and acceleration. Pogo to 10-Yard Sprint requires one or more stiff ankle contacts before the acceleration. The added contacts change the ordered action, reactive exposure, start timing, contact budget, fatigue, and stop rules.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        '180-jump-to-stick',
        'tuck-jump-to-stick',
        'distinct_exercises',
        'half_turn_rotation_vs_sagittal_tuck_in_flight',
        '180 Jump to Stick requires a half-turn in flight and a reoriented terminal landing. Tuck Jump to Stick requires rapid hip and knee flexion in flight without a declared half-turn. Airborne action, visual orientation, landing direction, spatial demand, and failure criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'barbell-bench-press',
        'barbell-z-press',
        'distinct_exercises',
        'supine_horizontal_press_vs_floor_seated_vertical_press',
        'Barbell Bench Press uses a supine bench-supported base and horizontal press path. Barbell Z Press uses a floor-seated base with the legs extended and a vertical overhead path. Support, joint angles, balance, trunk and hip demand, rack setup, spotting, and safe failure response differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/23096062/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/'
        )
      ),
      (
        'bird-dog',
        'bird-dog-row',
        'distinct_exercises',
        'contralateral_quadruped_reach_vs_reach_base_plus_loaded_row',
        'Bird Dog is a contralateral quadruped reach and hold. Bird Dog Row retains a three-point quadruped base while adding an externally loaded unilateral row. The extra joint action, implement, grip, anti-rotation load, support demand, and dose make it a compound exercise rather than an equipment variation.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21877146/')
      ),
      (
        'bottoms-up-kettlebell-press',
        'kettlebell-bottoms-up-curl',
        'distinct_exercises',
        'bottoms_up_overhead_press_vs_bottoms_up_elbow_flexion',
        'Bottoms-Up Kettlebell Press moves the bell through an overhead press. Bottoms-Up Curl uses elbow flexion while preserving the unstable bell orientation. Primary joint action, path, terminal position, shoulder demand, load tolerance, and stop rules differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'bound-to-stick',
        'carioca-bound-to-stick',
        'distinct_exercises',
        'direct_bound_entry_vs_carioca_crossover_approach_then_bound',
        'Carioca Bound to Stick requires a crossover locomotor approach before the bound and landing. Bound to Stick begins from its declared static or direct takeoff. The added crossover contacts, pelvic rotation, rhythm, approach distance, ordered actions, and fatigue create a separate compound contract.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/')
      ),
      (
        'box-squat',
        'dumbbell-sumo-squat',
        'distinct_exercises',
        'required_box_contact_vs_unsupported_wide_stance_squat',
        'Box Squat requires a declared box target and controlled contact before the ascent. Dumbbell Sumo Squat is unsupported and requires a wide externally rotated stance with a free reversal. Support, stance, depth reference, load path, reversal mechanics, equipment, and faults differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/')
      ),
      (
        'broad-jump-to-stick',
        'rotational-broad-jump-to-stick',
        'distinct_exercises',
        'straight_horizontal_projection_vs_horizontal_projection_with_rotation',
        'Broad Jump to Stick uses straight horizontal projection to a forward-facing terminal landing. Rotational Broad Jump to Stick requires declared axial rotation and a reoriented landing. Airborne action, visual orientation, landing geometry, space, and failure criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'countermovement-medicine-ball-scoop-toss',
        'medicine-ball-chest-pass',
        'distinct_exercises',
        'lower_body_countermovement_scoop_projection_vs_two_hand_chest_projection',
        'Countermovement Medicine Ball Scoop Toss loads the ball low and uses a scoop path driven by a countermovement. Medicine Ball Chest Pass begins at the chest and projects forward through a two-hand press. Start position, ball path, joint actions, release angle, loading strategy, and targets differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'dead-bug-pullover-band-dead-bug',
        'dumbbell-pullover',
        'distinct_exercises',
        'dead_bug_leg_and_trunk_constraint_vs_supported_pullover_only',
        'Dead Bug Pullover requires a supine dead-bug leg position or alternating leg action while the trunk resists extension during the pullover. Dumbbell Pullover does not require that leg sequence. Support, ordered actions, anti-extension demand, coordination, and dose unit differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21877146/')
      ),
      (
        'drop-catch-medicine-ball-chest-pass',
        'medicine-ball-chest-pass-catch-and-stick',
        'distinct_exercises',
        'self_drop_catch_then_pass_vs_receive_external_pass_then_terminal_stick',
        'Drop-Catch Medicine Ball Chest Pass begins with a declared self-drop or partner drop, catches the ball, then immediately projects it as a chest pass. Chest Pass Catch-and-Stick is organized around receiving an incoming pass and owning the terminal absorption. Ball source, action order, release, finish, and partner contract differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/22744301/'
        )
      ),
      (
        'glute-bridge',
        'glute-bridge-march',
        'distinct_exercises',
        'bilateral_bridge_vs_alternating_single_support_march',
        'Glute Bridge uses bilateral foot support through the lift or hold. Glute Bridge March adds alternating hip flexion and repeated single-leg support while the pelvis remains elevated. Support base, laterality, ordered actions, anti-rotation demand, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21877146/')
      ),
      (
        'goblet-squat',
        'kettlebell-goblet-squat-iso-hold',
        'distinct_exercises',
        'dynamic_squat_repetitions_vs_fixed_bottom_isometric',
        'Goblet Squat completes controlled eccentric and concentric repetitions. Kettlebell Goblet Squat Iso Hold maintains a declared bottom position without visible joint movement. Contraction type, dose unit, range, local fatigue behavior, measurement, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/30580468/')
      ),
      (
        'kettlebell-suitcase-deadlift',
        'sumo-deadlift',
        'distinct_exercises',
        'offset_unilateral_load_geometry_vs_centered_wide_stance_deadlift',
        'Kettlebell Suitcase Deadlift uses an offset load beside one leg and requires side-specific anti-lateral-flexion control. Sumo Deadlift uses a centered implement with a deliberately wide stance. Load geometry, laterality, stance, grip, bar or bell path, setup, and dosage differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/32107499/')
      ),
      (
        'landmine-ball-grip-press',
        'landmine-ball-grip-row',
        'distinct_exercises',
        'angled_press_away_vs_row_toward_trunk',
        'Landmine Ball-Grip Press moves the attachment away from the body through an angled press. Landmine Ball-Grip Row pulls it toward the trunk from a supported hinge or stance. Force direction, joint actions, body position, path, attachment clearance, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/'
        )
      ),
      (
        'medicine-ball-chest-pass-catch-and-stick',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'chest_level_projection_and_reception_vs_low_scoop_projection_and_reception',
        'Chest Pass Catch-and-Stick uses a chest-level two-hand press path. Scoop Toss Catch-and-Stick uses a low-to-high scoop path. Start position, release path, catch trajectory, joint sequencing, target, and absorption strategy differ even though both include a terminal catch.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-throw',
        'split-stance-rotational-catch-and-throw',
        'distinct_exercises',
        'declared_rotational_projection_vs_external_catch_then_rotational_return',
        'Medicine Ball Rotational Throw is organized around producing a declared rotational projection. Split-Stance Rotational Catch and Throw first receives and tracks an external ball, absorbs it in a split stance, then returns it. Perception, ball possession, ordered actions, stance, partner timing, and failure criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/22744301/'
        )
      ),
      (
        'negative-pull-up',
        'push-up-negative',
        'distinct_exercises',
        'vertical_pull_eccentric_vs_horizontal_push_eccentric',
        'Negative Pull-Up lowers from an overhead hanging pull-up position. Push-Up Negative lowers in a prone horizontal press position. Force direction, support points, grip, shoulder path, primary tissues, setup, assistance, and safe exit differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/30580468/')
      ),
      (
        'perturbation-single-leg-balance',
        'single-leg-perturbation-catch',
        'distinct_exercises',
        'external_body_perturbation_vs_object_tracking_and_catch',
        'Perturbation Single-Leg Balance maintains stance while a coach, band, or surface perturbs the body. Single-Leg Perturbation Catch requires tracking and receiving an object. Perceptual task, hand action, partner behavior, load path, error state, and group logistics differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'pike-push-up',
        'push-up',
        'distinct_exercises',
        'hip_flexed_vertical_press_bias_vs_prone_horizontal_press',
        'Pike Push-Up uses a high-hip position and a more vertical shoulder press path. Push-Up uses a long prone plank and horizontal press path. Body geometry, load distribution, shoulder angle, head clearance, range, and substitution behavior differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'plyo-push-up',
        'push-up',
        'distinct_exercises',
        'ballistic_hand_flight_and_landing_vs_continuous_controlled_support',
        'Plyo Push-Up requires explosive projection that unloads or lifts the hands followed by an upper-body landing. Push-Up maintains continuous hand contact and controlled reversal. Flight, impact, rate of force development, contact budget, fatigue, and safety criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'romanian-deadlift',
        'single-leg-romanian-deadlift',
        'distinct_exercises',
        'bilateral_hinge_vs_unilateral_support_hinge',
        'Romanian Deadlift uses bilateral foot support and a symmetrical hinge. Single-Leg Romanian Deadlift uses one primary support leg with the other leg unloaded or counterbalancing. Laterality, support base, balance, pelvic control, load tolerance, and side-specific dosage differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/')
      ),
      (
        'round-off-rebound-snap-down-to-stick',
        'snap-down-to-rebound',
        'distinct_exercises',
        'roundoff_entry_rebound_and_terminal_stick_vs_snapdown_then_rebound',
        'Round-Off Rebound / Snap-Down to Stick begins with a round-off, rebounds, and finishes through a declared snap-down landing. Snap-Down to Rebound begins from the snap-down action and finishes with a rebound. Entry, hand contacts, inversion, ordered actions, contact count, space, and terminal action differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/')
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-line-hop-and-stick',
        'needs_human_review',
        'line_hop_source_does_not_declare_direction_contact_count_or_line_crossing',
        'Single-Leg Hop to Stick declares a small unilateral hop and terminal hold but does not declare a line target. Single-Leg Line Hop and Stick names a line yet its legacy text does not declare whether the athlete crosses the line, moves forward or lateral, or performs one or repeated contacts. Those facts determine duplicate, variant, or distinct identity and cannot be inferred safely.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'single-leg-hop-to-stick',
        'step-off-to-single-leg-stick',
        'distinct_exercises',
        'active_floor_takeoff_vs_elevated_step_off_without_takeoff',
        'Single-Leg Hop to Stick requires an active floor takeoff before the unilateral landing. Step-Off to Single-Leg Stick begins from an elevated surface and removes the takeoff. Start surface, force-production task, fall height, impact, equipment, and failure response differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22431209/')
      ),
      (
        'single-leg-pogo-hold-stick',
        'single-leg-pogo-hold-to-hop',
        'distinct_exercises',
        'pogo_contacts_then_terminal_hold_vs_initial_hold_then_pogo_contacts',
        'Single-Leg Pogo Hold-Stick performs reactive contacts before the terminal hold. Single-Leg Pogo Hold-to-Hop begins with a balance hold before initiating pogo contacts. Reversing the actions changes readiness, first contact, measurement, fatigue, and terminal criteria.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'single-leg-rdl-reach-plus-catch',
        'single-leg-romanian-deadlift',
        'distinct_exercises',
        'unilateral_hinge_only_vs_hinge_reach_plus_external_catch',
        'Single-Leg Romanian Deadlift is organized around the unilateral hinge. Single-Leg RDL Reach plus Catch adds an externally timed object catch while the athlete owns the hinge position. Perception, hand action, partner timing, perturbation, balance error, and logistics differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22744301/')
      ),
      (
        'single-leg-snap-down-stick',
        'snap-down-to-stick',
        'distinct_exercises',
        'unilateral_terminal_support_vs_bilateral_terminal_support',
        'Single-Leg Snap-Down Stick finishes on one declared support leg and requires side-specific control. Snap-Down to Stick finishes bilaterally. Support base, laterality, load distribution, landing tolerance, balance, and dose differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/')
      ),
      (
        'step-up',
        'step-up-jump',
        'distinct_exercises',
        'controlled_step_to_support_vs_step_driven_flight_and_landing',
        'Step-Up transfers onto an elevated surface under continuous support. Step-Up Jump uses the step action to create flight and then requires a landing. Ballistic intent, contact sequence, impact, box clearance, fatigue, and safety contract differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'tuck-front-lever-hold',
        'tuck-front-lever-row',
        'distinct_exercises',
        'fixed_isometric_lever_vs_dynamic_row_in_lever_position',
        'Tuck Front Lever Hold maintains one declared lever position without visible joint motion. Tuck Front Lever Row adds repeated pulling through a declared range while preserving the lever. Contraction type, joint action, dose unit, grip fatigue, range, and stop rules differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/')
      ),
      (
        'tuck-jump-to-lateral-stick',
        'tuck-jump-to-stick',
        'distinct_exercises',
        'tuck_with_lateral_terminal_displacement_vs_vertical_terminal_landing',
        'Tuck Jump to Lateral Stick requires declared lateral displacement and a reoriented or offset terminal landing after the tuck. Tuck Jump to Stick remains vertically organized. Projection, landing location, frontal-plane braking, space, and fault criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/')
      ),
      (
        'wall-drill-switch',
        'wall-drive-switch-to-sprint',
        'distinct_exercises',
        'wall_supported_switch_repetitions_vs_wall_switch_then_free_acceleration',
        'Wall Drill Switch finishes in the wall-supported drill. Wall Drive Switch to Sprint requires release from the wall and transition into free acceleration. The added exit, first steps, space, timing, footwear and surface demand, fatigue, and terminal action differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
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
    left_status := NULL;
    right_status := NULL;
    facility := NULL;

    SELECT id, status, facility_id
    INTO left_id, left_status, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND facility_id = 1;

    SELECT id, status
    INTO right_id, right_status
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = facility;

    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION
        '% requires traceable definitions % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    IF left_status = 'archived' OR right_status = 'archived' THEN
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
          AND resolution.decision = boundary.decision
      ) THEN
        CONTINUE;
      END IF;

      RAISE EXCEPTION
        '% found archived endpoint without matching decision for % and %',
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
        'legacySourceCardsAudited', TRUE,
        'researchSources', boundary.research_sources,
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
        'missingIdentityFacts',
          boundary.decision = 'needs_human_review',
        'humanReviewRequired', TRUE,
        'reviewerAssigned', FALSE,
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
