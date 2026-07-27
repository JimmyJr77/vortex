-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- remaining score-83 canonical identity queue.
--
-- These records change identity-queue state only. They do not approve or
-- publish cards, media, relationships, calibration, or dosage. Exercise cards
-- receive exercise-complexity and physical-difficulty assessment only; no
-- athlete skill/proficiency level is introduced. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '371_coaching_score_83_identity_boundaries';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  facility BIGINT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        'bear-plank-hold',
        'plank-hold',
        'distinct_exercises',
        'quadruped_knee_hover_vs_long_lever_prone_support',
        'Bear Plank Hold uses a quadruped base with hands and feet supporting the body while the knees hover under the hips. Plank Hold uses a long prone support line. Support points, hip and knee angles, lever length, load distribution, entry, exit, and fault criteria are different movement contracts.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC11055131/'
        )
      ),
      (
        'lateral-hop-to-stick',
        'low-hurdle-lateral-hop-to-stick',
        'distinct_exercises',
        'unobstructed_lateral_jump_vs_required_hurdle_clearance',
        'Bilateral Lateral Jump to Stick projects to a declared line or zone without an obstacle. Low Hurdle Lateral Hop to Stick requires obstacle clearance before the terminal landing. The hurdle adds approach spacing, minimum flight path, collision risk, equipment, logistics, and a different failure condition.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
        )
      ),
      (
        'lateral-hop-to-stick',
        'medial-lateral-hop-stick',
        'distinct_exercises',
        'single_bilateral_lateral_jump_vs_ladder_hop_sequence',
        'Bilateral Lateral Jump to Stick is one declared two-foot lateral flight to a simultaneous two-foot terminal hold. Medial-Lateral Hop Stick is a ladder-targeted sequence through multiple boxes. Contact count, spatial pattern, direction changes, ladder dependency, reset policy, and terminal action differ.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/',
          'https://pubmed.ncbi.nlm.nih.gov/24290613/'
        )
      ),
      (
        'bodyweight-box-squat',
        'pause-bodyweight-squat',
        'distinct_exercises',
        'external_box_contact_vs_unsupported_bottom_pause',
        'Bodyweight Box Squat requires a declared box target and controlled contact without rocking. Pause Bodyweight Squat requires a self-supported pause at owned depth without box contact. Support, depth reference, reversal mechanics, equipment, setup, and failure conditions differ.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'bodyweight-box-squat',
        'tempo-bodyweight-squat',
        'distinct_exercises',
        'external_box_contact_vs_free_squat_tempo',
        'Bodyweight Box Squat requires controlled contact with a declared box. Tempo Bodyweight Squat remains unsupported and is defined by a declared lowering and pause tempo. External support, depth reference, reversal, equipment, setup, and fault criteria remain different.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'drop-landing-to-stick',
        'kick-to-landing-stick',
        'distinct_exercises',
        'elevated_drop_entry_vs_kick_recoil_and_recovery',
        'Drop Landing to Stick removes takeoff and begins from a declared elevated step-off or drop before a bilateral landing. Kick-to-Landing Stick begins with a sport-specific kick, recoil, support-foot pivot, and recovery to a usable stance. Initial action, laterality, momentum, perception, finish, and safety contract differ.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/'
        )
      ),
      (
        'goblet-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_parallel_stance_vs_stationary_split_stance',
        'Goblet Squat uses a bilateral approximately parallel stance with a front-held load. Split Squat uses a stationary side-specific split stance with asymmetrical support and a lead-leg bias. Stance, laterality, load distribution, balance, and side-specific dosage are identity-defining.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/24345718/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'half-kneeling-landmine-anti-rotation-press',
        'landmine-anti-rotation-press',
        'distinct_exercises',
        'declared_half_kneeling_base_vs_stance_unspecified_press_out',
        'Half-Kneeling Landmine Anti-Rotation Press requires one knee down, the other foot planted, and a declared side relationship to the landmine. The generic Landmine Anti-Rotation Press-Out source does not require that support base. Half-kneeling support, laterality, hip position, balance, setup, and substitution behavior define a separate exercise.',
        jsonb_build_array(
          'https://www.nsca.com/contentassets/8323553f698a466a98220b21d9eb9a65/foundationsoffitnessprogramming_201508.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/21877146/'
        )
      ),
      (
        'handstand-hold',
        'wall-handstand-hold',
        'distinct_exercises',
        'unsupported_inverted_balance_vs_wall_supported_inversion',
        'Handstand Hold requires independent inverted balance in a clean line. Wall Handstand Hold requires declared wall support. External support, balance demand, entry, exit, fall space, spotting, failure response, and substitution contract differ.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/'
        )
      ),
      (
        'hop-to-hop-to-stick-linear',
        'star-hop-to-stick',
        'distinct_exercises',
        'two_linear_same_leg_hops_vs_multidirectional_star_targets',
        'Hop-to-Hop-to-Stick Linear requires two same-leg linear hops followed by one owned landing. Star Hop to Stick uses multiple clock-face or star targets in declared directions. Direction sequence, target layout, contact plan, spatial decision, and dose differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/24290613/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
        )
      ),
      (
        'hurdle-hop-to-box-jump',
        'hurdle-hop-to-broad-jump',
        'distinct_exercises',
        'reactive_contact_to_elevated_box_vs_horizontal_broad_projection',
        'Hurdle Hop to Box Jump finishes on an elevated box target. Hurdle Hop to Broad Jump finishes with horizontal projection to the floor. Projection direction, target geometry, landing height, distance, equipment, clearance, and failure response are different.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32897526/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
        )
      ),
      (
        'inchworm-to-worlds-greatest-stretch',
        'worlds-greatest-stretch',
        'distinct_exercises',
        'inchworm_hand_walk_entry_plus_lunge_flow_vs_lunge_mobility_sequence',
        'Inchworm to World''s Greatest Stretch begins with a hinge and hand walk to plank before the lunge and rotation sequence. World''s Greatest Stretch begins in or steps directly to the lunge. The added hand-supported walkout, plank exposure, ordered actions, space, wrist demand, and return are identity-defining.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10980866/'
        )
      ),
      (
        'kettlebell-deadlift',
        'trap-bar-deadlift',
        'distinct_exercises',
        'anterior_or_center_kettlebell_path_vs_athlete_inside_trap_bar_frame',
        'Kettlebell Deadlift uses one or two compact bells with the load centered between or in front of the feet. Trap Bar Deadlift places the athlete inside a rigid frame with lateral handles and declared handle height. Load geometry, grip width, implement clearance, start height, load capacity, setup, and set-down remain separate movement contracts.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/32107499/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'kneeling-medicine-ball-chest-pass',
        'moving-target-medicine-ball-chest-pass',
        'distinct_exercises',
        'fixed_kneeling_base_vs_moving_partner_prediction_and_foot_adjustment',
        'Kneeling Medicine Ball Chest Pass uses a declared half- or tall-kneeling base and exact wall or partner return contract. Moving Target Medicine Ball Chest Pass requires prediction, foot adjustment, and accurate output to a moving partner. Support base, locomotion, perception, target behavior, group logistics, and failure criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12912675/'
        )
      ),
      (
        'kneeling-medicine-ball-chest-pass',
        'tall-kneeling-cable-band-chop',
        'distinct_exercises',
        'horizontal_ball_projection_vs_resisted_diagonal_chop',
        'Kneeling Medicine Ball Chest Pass projects a ball horizontally from the chest with two hands. Tall-Kneeling Cable or Band Chop keeps hold of a tensioned implement and follows a controlled diagonal path. Object release, path, force direction, anchor, return, intent, and safety contract differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/'
        )
      ),
      (
        'lateral-bound-to-rotational-throw',
        'medicine-ball-rotational-toss-to-lateral-bound',
        'distinct_exercises',
        'bound_then_capture_then_throw_vs_throw_then_lateral_bound',
        'Lateral Bound to Rotational Throw bounds first, captures the landing, then transfers into the throw. Medicine Ball Rotational Toss to Lateral Bound throws first and then bounds laterally. Reversing the ordered actions changes ball possession, momentum, foot contacts, landing task, timing, and safe collection.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/'
        )
      ),
      (
        'low-box-drop-to-stick',
        'low-box-jump-to-stick',
        'distinct_exercises',
        'step_off_drop_and_floor_landing_vs_floor_takeoff_and_box_landing',
        'Low Box Drop to Stick starts on the box, removes takeoff, and lands on the floor to train absorption. Low Box Jump to Stick starts on the floor, creates a takeoff, and lands on the box. Start surface, force-production task, landing surface, height, impact, and exit are opposite contracts.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
        )
      ),
      (
        'med-ball-slam-to-rotational-throw',
        'shuffle-to-rotational-medicine-ball-throw',
        'distinct_exercises',
        'vertical_slam_rebound_or_retrieval_then_throw_vs_lateral_shuffle_entry',
        'Med Ball Slam to Rotational Throw begins with a vertical slam and requires a declared rebound, retrieval, or second-ball transition before the rotational throw. Shuffle-to-Rotational Medicine Ball Throw begins with a lateral shuffle or crow-hop into a plant. Entry action, ball handling, contacts, timing, space, and fatigue differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/'
        )
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-chest-pass-catch-and-stick',
        'distinct_exercises',
        'outgoing_two_hand_projection_vs_incoming_catch_and_terminal_absorption',
        'Medicine Ball Chest Pass is organized around outgoing two-hand projection with an exact return policy. Catch-and-Stick is organized around receiving an incoming ball, absorbing its momentum, and owning a terminal position. Primary action, partner behavior, perception, load direction, failure criteria, and intent differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/22744301/'
        )
      ),
      (
        'pin-squat',
        'squat-pin-iso',
        'distinct_exercises',
        'dynamic_dead_start_squat_vs_overcoming_isometric_against_pins',
        'Pin Squat begins from or reverses at a declared pin height and completes dynamic concentric and controlled eccentric motion. Squat Pin Iso produces force against fixed pins without visible joint movement. Contraction type, range, dose unit, spotting, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/30580468/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'seated-barbell-overhead-press',
        'strict-overhead-press',
        'distinct_exercises',
        'supported_seated_press_vs_standing_whole_body_braced_press',
        'Seated Overhead Press uses a declared seat and optional back support to reduce lower-body contribution. Strict Overhead Press uses a standing base and whole-body bracing. Support base, hip and knee position, balance, setup, spotting, load handling, and substitution behavior differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/23096062/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/'
        )
      ),
      (
        'distance-jump-standing-calf-raise',
        'standing-calf-raise-iso-hold',
        'distinct_exercises',
        'dynamic_plantarflexion_repetitions_vs_fixed_top_position_hold',
        'Standing Calf Raise uses repeated controlled plantarflexion through a declared range. Standing Calf Raise Iso Hold maintains one declared joint angle without visible motion. Contraction type, dose unit, range, local fatigue behavior, measurement, and stop rules differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/30580468/'
        )
      ),
      (
        'distance-jump-straight-leg-bound',
        'straight-leg-bounds-to-sprint',
        'distinct_exercises',
        'straight_leg_bound_sequence_vs_bound_to_sprint_transition',
        'Straight-Leg Bound finishes with a declared landing or run-out after the bounding sequence. Straight-Leg Bounds to Sprint requires an explicit transition into sprint mechanics. The added acceleration or fly transition changes contacts, distance, space, fatigue, timing, and terminal action.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/'
        )
      ),
      (
        'worlds-greatest-stretch',
        'worlds-greatest-stretch-to-plank',
        'distinct_exercises',
        'lunge_rotation_hamstring_flow_vs_repeated_lunge_to_plank_transition',
        'World''s Greatest Stretch is a lunge, rotation, and hamstring mobility sequence that may step directly between sides. World''s Greatest Stretch to Plank requires return to a braced plank between lunges. The plank support, wrist and shoulder demand, ordered transition, trunk constraint, and repetition unit differ.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10980866/'
        )
      ),
      (
        'landmine-ball-grip-press',
        'landmine-squat-to-press',
        'distinct_exercises',
        'angled_press_only_vs_squat_drive_to_press',
        'Landmine Ball-Grip Press begins from an organized standing press position and uses only the angled press action. Landmine Squat-to-Press requires a squat descent and leg-driven ascent before the press. The added lower-body action, range, sequencing, load, fatigue, and stop rules define a separate compound exercise.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/'
        )
      ),
      (
        'bound-to-stick',
        'lateral-bound-to-stick',
        'needs_human_review',
        'generic_bound_source_does_not_declare_projection_direction',
        'Bound to Stick declares one-leg takeoff, opposite-leg landing, horizontal projection, and a terminal hold, but does not declare forward versus lateral projection. Lateral Bound to Stick requires frontal-plane projection. Direction determines whether this is a duplicate, a forward-bound identity, or an umbrella source and cannot be assigned safely from the legacy text.',
        jsonb_build_array(
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/',
          'https://pubmed.ncbi.nlm.nih.gov/32897526/'
        )
      ),
      (
        'dumbbell-overhead-press-eccentric',
        'strict-overhead-press',
        'needs_human_review',
        'eccentric_only_source_does_not_declare_standing_or_seated_base',
        'Dumbbell Overhead Press Eccentric declares a four-to-six-second lowering from lockout and a reset, but does not declare whether the base is standing or seated or how lockout is regained. Those facts determine whether it belongs to Standing Strict Overhead Press, Seated Overhead Press, or a separate externally assisted negative contract.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/23096062/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/'
        )
      ),
      (
        'landmine-press',
        'two-hand-landmine-press',
        'needs_human_review',
        'generic_landmine_press_does_not_declare_hand_count_stance_or_path',
        'The generic Landmine Press source describes an angled press but does not declare one hand versus two hands, stance, side, rotation policy, or exact bar-end path. The library contains explicit one-hand and two-hand landmine press families, so assigning this source to either would fabricate missing identity facts.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
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
        'legacySourceCardsAudited', TRUE,
        'researchSources', boundary.research_sources,
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
        'missingIdentityFacts',
          CASE
            WHEN boundary.decision = 'needs_human_review'
              THEN TRUE
            ELSE FALSE
          END,
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
