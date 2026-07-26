-- Consolidate high-confidence synonym-, implement-, load-, rack-, quantity-,
-- assistance-, tempo-, cue-, and environment-labeled duplicates into stable
-- movement identities.
--
-- These modifiers remain available as exact exercise variants. They are not
-- athlete proficiency classifications: exercise cards use exercise complexity
-- and physical difficulty only, while proficiency levels belong exclusively to
-- coaching skill-library cards.
--
-- This migration does not create or overwrite a human review, approval,
-- publication decision, exact-media decision, graph approval, or calibration
-- approval. Candidate-only work is preserved; every affected survivor remains
-- quarantined for a new audit. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  source RECORD;
  survivor RECORD;
  duplicate RECORD;
  target_ids UUID[];
  target_legacy_ids BIGINT[];
  protected_records INTEGER;
  conflicting_resolutions INTEGER;
BEGIN
  FOR source IN
    SELECT *
    FROM (VALUES
      (
        'bulgarian-split-squat',
        'barbell-bulgarian-split-squat',
        'implement_and_load_position',
        '{"implement":"barbell","loadPosition":"declared_source_position"}'::JSONB
      ),
      (
        'bulgarian-split-squat',
        'dumbbell-bulgarian-split-squat',
        'implement_quantity_grip_and_load_position',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position"}'::JSONB
      ),
      (
        'bulgarian-split-squat',
        'kettlebell-bulgarian-split-squat',
        'implement_quantity_grip_and_load_position',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position"}'::JSONB
      ),
      (
        'strict-overhead-press',
        'dumbbell-strict-overhead-press',
        'implement_quantity_grip_and_load_position',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","legDrive":false}'::JSONB
      ),
      (
        'strict-overhead-press',
        'sandbag-strict-overhead-press-strength',
        'implement_grip_and_load_position',
        '{"implement":"sandbag","loadPosition":"declared_source_position","legDrive":false}'::JSONB
      ),
      (
        'sumo-deadlift',
        'dumbbell-sumo-deadlift',
        'implement_quantity_grip_and_start_height',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","startHeight":"declared_source_height"}'::JSONB
      ),
      (
        'sumo-deadlift',
        'kettlebell-sumo-deadlift',
        'implement_quantity_grip_and_start_height',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","startHeight":"declared_source_height"}'::JSONB
      ),
      (
        'sumo-deadlift',
        'landmine-sumo-deadlift',
        'implement_fixed_path_grip_and_start_height',
        '{"implement":"landmine","barPath":"fixed_angled","grip":"declared_source_grip","startHeight":"declared_source_height"}'::JSONB
      ),
      (
        'heels-elevated-goblet-squat',
        'heels-elevated-kettlebell-goblet-squat',
        'implement_grip_load_and_heel_elevation',
        '{"implement":"kettlebell","loadPosition":"goblet","heelElevation":"declared_source_height"}'::JSONB
      ),
      (
        'distance-jump-standing-calf-raise',
        'standing-dumbbell-calf-raise',
        'implement_quantity_support_and_range',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","support":"declared_source_support","range":"declared_source_range"}'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'dumbbell-floor-press',
        'implement_quantity_grip_and_press_laterality',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","pressLaterality":"declared_source_laterality"}'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'double-kettlebell-floor-press',
        'implement_quantity_grip_and_press_laterality',
        '{"implement":"kettlebell","implementQuantity":"two","pressLaterality":"bilateral"}'::JSONB
      ),
      (
        'front-rack-carry',
        'dumbbell-front-rack-carry',
        'implement_quantity_rack_and_distance',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","rack":"front_rack","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'front-rack-carry',
        'kettlebell-front-rack-carry',
        'implement_quantity_rack_and_distance',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","rack":"front_rack","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'front-rack-carry',
        'double-kettlebell-front-rack-carry',
        'implement_quantity_rack_and_distance',
        '{"implement":"kettlebell","implementQuantity":"two","rack":"front_rack","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'plank-pull-through',
        'dumbbell-plank-pull-through',
        'implement_transfer_path_and_base_width',
        '{"implement":"dumbbell","transferPath":"declared_source_path","baseWidth":"declared_source_base"}'::JSONB
      ),
      (
        'plank-pull-through',
        'medicine-ball-plank-pull-through',
        'implement_transfer_path_and_base_width',
        '{"implement":"medicine_ball","transferPath":"declared_source_path","baseWidth":"declared_source_base"}'::JSONB
      ),
      (
        'single-leg-squat-to-box',
        'kettlebell-single-leg-box-squat',
        'implement_load_position_box_height_and_touch_contract',
        '{"implement":"kettlebell","loadPosition":"declared_source_position","boxHeight":"declared_source_height","boxContact":"declared_source_contact"}'::JSONB
      ),
      (
        'farmer-carry',
        'dumbbell-farmer-carry',
        'implement_quantity_grip_and_distance',
        '{"implement":"dumbbell","implementQuantity":"two","grip":"closed_handled","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'farmer-carry',
        'double-kettlebell-farmer-carry',
        'implement_quantity_grip_and_distance',
        '{"implement":"kettlebell","implementQuantity":"two","grip":"closed_handled","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'farmer-carry',
        'jerry-can-farmer-carry-strength',
        'implement_quantity_grip_and_distance',
        '{"implement":"jerry_can_or_handled_odd_object","implementQuantity":"two","grip":"closed_handled","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'glute-bridge',
        'bodyweight-glute-bridge',
        'external_load_support_and_range',
        '{"implement":"bodyweight","externalLoad":false,"support":"floor","range":"declared_source_range"}'::JSONB
      ),
      (
        'glute-bridge',
        'dumbbell-glute-bridge',
        'implement_load_position_support_and_range',
        '{"implement":"dumbbell","loadPosition":"across_pelvis","support":"floor","range":"declared_source_range"}'::JSONB
      ),
      (
        'glute-bridge',
        'kettlebell-glute-bridge',
        'implement_load_position_support_and_range',
        '{"implement":"kettlebell","loadPosition":"across_pelvis","support":"floor","range":"declared_source_range"}'::JSONB
      ),
      (
        'glute-bridge',
        'barbell-glute-bridge',
        'implement_load_position_support_and_range',
        '{"implement":"barbell","loadPosition":"across_pelvis","support":"floor","range":"declared_source_range"}'::JSONB
      ),
      (
        'glute-bridge',
        'sandbag-glute-bridge-strength',
        'implement_load_position_support_and_range',
        '{"implement":"sandbag","loadPosition":"across_pelvis","support":"floor","range":"declared_source_range"}'::JSONB
      ),
      (
        'goblet-squat',
        'kettlebell-goblet-squat',
        'implement_grip_load_position_and_range',
        '{"implement":"kettlebell","grip":"goblet","loadPosition":"chest","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'bodyweight-reverse-lunge',
        'external_load_step_length_and_range',
        '{"implement":"bodyweight","externalLoad":false,"stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'dumbbell-reverse-lunge',
        'implement_quantity_load_position_step_length_and_range',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'kettlebell-reverse-lunge',
        'implement_quantity_load_position_step_length_and_range',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'barbell-reverse-lunge',
        'implement_load_position_step_length_and_range',
        '{"implement":"barbell","loadPosition":"declared_source_position","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'front-rack-reverse-lunge',
        'implement_front_rack_step_length_and_range',
        '{"implement":"barbell_or_declared_source","loadPosition":"front_rack","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'front-rack-reverse-lunge-with-med-ball',
        'implement_front_rack_step_length_and_range',
        '{"implement":"medicine_ball","loadPosition":"front_rack_at_chest","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'reverse-lunge',
        'sandbag-reverse-lunge-strength',
        'implement_load_position_step_length_and_range',
        '{"implement":"sandbag","loadPosition":"declared_source_position","stepLength":"declared_source_length","range":"declared_source_range"}'::JSONB
      ),
      (
        'suitcase-carry',
        'dumbbell-suitcase-carry',
        'implement_quantity_side_grip_and_distance',
        '{"implement":"dumbbell","implementQuantity":"one","side":"declared_source_side","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'suitcase-carry',
        'single-kettlebell-suitcase-carry',
        'implement_quantity_side_grip_and_distance',
        '{"implement":"kettlebell","implementQuantity":"one","side":"declared_source_side","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'suitcase-carry',
        'sandbag-suitcase-carry-strength',
        'implement_quantity_side_grip_and_distance',
        '{"implement":"sandbag","implementQuantity":"one","side":"declared_source_side","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'lateral-lunge',
        'bodyweight-lateral-lunge',
        'external_load_step_width_depth_and_return',
        '{"implement":"bodyweight","externalLoad":false,"stepWidth":"declared_source_width","depth":"declared_source_depth","return":"declared_source_return"}'::JSONB
      ),
      (
        'lateral-lunge',
        'kettlebell-lateral-lunge',
        'implement_load_position_step_width_depth_and_return',
        '{"implement":"kettlebell","loadPosition":"declared_source_position","stepWidth":"declared_source_width","depth":"declared_source_depth","return":"declared_source_return"}'::JSONB
      ),
      (
        'lateral-lunge',
        'barbell-lateral-lunge',
        'implement_load_position_step_width_depth_and_return',
        '{"implement":"barbell","loadPosition":"declared_source_position","stepWidth":"declared_source_width","depth":"declared_source_depth","return":"declared_source_return"}'::JSONB
      ),
      (
        'lateral-lunge',
        'lateral-lunge-loaded',
        'implement_load_position_step_width_depth_and_return',
        '{"implement":"declared_external_load","loadPosition":"declared_source_position","stepWidth":"declared_source_width","depth":"declared_source_depth","return":"declared_source_return"}'::JSONB
      ),
      (
        'lateral-lunge',
        'sandbag-lateral-lunge-strength',
        'implement_load_position_step_width_depth_and_return',
        '{"implement":"sandbag","loadPosition":"declared_source_position","stepWidth":"declared_source_width","depth":"declared_source_depth","return":"declared_source_return"}'::JSONB
      ),
      (
        'overhead-carry',
        'kettlebell-overhead-carry',
        'implement_quantity_side_lockout_and_distance',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","side":"declared_source_side","lockout":"overhead","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'overhead-carry',
        'double-dumbbell-overhead-carry',
        'implement_quantity_side_lockout_and_distance',
        '{"implement":"dumbbell","implementQuantity":"two","side":"bilateral","lockout":"overhead","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-dumbbell-rdl',
        'implement_quantity_load_side_reach_and_range',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadSide":"declared_source_side","reach":"declared_source_reach","range":"declared_source_range"}'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-kettlebell-rdl',
        'implement_quantity_load_side_reach_and_range',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadSide":"declared_source_side","reach":"declared_source_reach","range":"declared_source_range"}'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'barbell-single-leg-romanian-deadlift',
        'implement_load_position_reach_and_range',
        '{"implement":"barbell","loadPosition":"two_hand_front","reach":"declared_source_reach","range":"declared_source_range"}'::JSONB
      ),
      (
        'lateral-bear-crawl',
        'lateral-bear-crawl-ladder',
        'lane_marker_spacing_distance_and_direction',
        '{"implement":"agility_ladder_or_floor_markers","travelDirection":"lateral","spacing":"declared_source_spacing","distance":"declared_source_distance"}'::JSONB
      ),
      (
        '10-yard-sprint',
        '10-yard-sprint-start',
        'start_stance_cue_and_timing',
        '{"distanceYards":10,"startStance":"declared_source_stance","cue":"declared_source_cue","timing":"declared_source_timing"}'::JSONB
      ),
      (
        'alternate-leg-bound-for-distance',
        'alternating-bounds-for-distance',
        'orthographic_name_contact_count_and_distance',
        '{"contactPattern":"alternating","contactCount":"declared_source_count","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'nordic-hamstring-curl',
        'assisted-nordic-hamstring-curl',
        'assistance_range_and_return_strategy',
        '{"assistance":"declared_source_assistance","range":"declared_source_range","returnStrategy":"declared_source_return"}'::JSONB
      ),
      (
        'nordic-hamstring-eccentric',
        'assisted-nordic-hamstring-eccentric',
        'assistance_range_tempo_and_return_strategy',
        '{"assistance":"declared_source_assistance","range":"declared_source_range","tempo":"declared_source_tempo","returnStrategy":"declared_source_return"}'::JSONB
      ),
      (
        'single-leg-squat-to-box',
        'assisted-single-leg-squat-to-box',
        'assistance_box_height_range_and_touch_contract',
        '{"assistance":"declared_source_assistance","boxHeight":"declared_source_height","range":"declared_source_range","boxContact":"declared_source_contact"}'::JSONB
      ),
      (
        'auditory-start-sprint',
        'split-stance-auditory-sprint-start',
        'start_stance_auditory_cue_and_distance',
        '{"startStance":"split_stance","cue":"auditory","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'backpedal-to-stick',
        'backpedal-to-decel-stick',
        'orthographic_deceleration_target_and_distance',
        '{"travelDirection":"backward","terminalAction":"deceleration_stick","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-open-turn',
        'turn_side_opening_mechanics_and_distance',
        '{"turnType":"open_turn","turnSide":"declared_source_side","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-turn-on-signal',
        'external_cue_turn_side_and_distance',
        '{"cue":"declared_external_signal","turnSide":"declared_source_side","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'ball-drop-reaction-sprint',
        'partner-reaction-ball-drop-sprint',
        'partner_role_ball_release_and_sprint_distance',
        '{"cueSource":"partner_ball_release","ballType":"declared_source_ball","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'bear-plank-shoulder-tap',
        'bear-plank-shoulder-tap-balance',
        'tap_cadence_pause_and_base_width',
        '{"tapCadence":"declared_source_cadence","pause":"declared_source_pause","baseWidth":"declared_source_base"}'::JSONB
      ),
      (
        'bear-plank-shoulder-tap',
        'bear-plank-shoulder-tap-iso-hold',
        'tap_hold_duration_and_base_width',
        '{"terminalHold":"declared_source_duration","baseWidth":"declared_source_base","antiRotation":"declared_source_standard"}'::JSONB
      ),
      (
        'bear-to-crab-switch',
        'bear-to-crab-switch-on-cue',
        'external_cue_switch_side_and_cadence',
        '{"cue":"declared_external_signal","switchSide":"declared_source_side","cadence":"declared_source_cadence"}'::JSONB
      ),
      (
        'box-squat',
        'dumbbell-box-squat',
        'implement_quantity_load_position_box_height_and_touch',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","boxHeight":"declared_source_height","boxContact":"declared_source_contact"}'::JSONB
      ),
      (
        'box-squat',
        'kettlebell-box-squat',
        'implement_quantity_load_position_box_height_and_touch',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","boxHeight":"declared_source_height","boxContact":"declared_source_contact"}'::JSONB
      ),
      (
        'color-call-cone-cut',
        'colored-cone-call-out',
        'orthographic_color_cue_response_target_and_return',
        '{"cue":"color_call_or_visual_color","response":"declared_source_cut_touch_or_stop","target":"declared_source_cone","return":"declared_source_return"}'::JSONB
      ),
      (
        'countermovement-jump',
        'countermovement-vertical-jump',
        'orthographic_arm_action_target_and_landing',
        '{"projectionDirection":"vertical","armAction":"declared_source_arm_action","target":"declared_source_target","landing":"floor_controlled"}'::JSONB
      ),
      (
        'curved-sprint-bound',
        'curved-sprint-bound-series',
        'contact_count_curve_radius_and_distance',
        '{"contactCount":"declared_source_count","curveRadius":"declared_source_radius","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'distance-jump-hip-thrust',
        'dumbbell-hip-thrust',
        'implement_load_position_support_range_and_pause',
        '{"implement":"dumbbell","loadPosition":"across_pelvis","support":"bench_or_declared_source","range":"declared_source_range","pause":"declared_source_pause"}'::JSONB
      ),
      (
        'distance-jump-hip-thrust',
        'kettlebell-hip-thrust',
        'implement_load_position_support_range_and_pause',
        '{"implement":"kettlebell","loadPosition":"across_pelvis","support":"bench_or_declared_source","range":"declared_source_range","pause":"declared_source_pause"}'::JSONB
      ),
      (
        'distance-jump-straight-leg-bound-march',
        'straight-leg-bound-march',
        'orthographic_contact_count_cadence_and_distance',
        '{"contactPattern":"alternating_straight_leg_march","contactCount":"declared_source_count","cadence":"declared_source_cadence","distance":"declared_source_distance"}'::JSONB
      ),
      (
        'double-dumbbell-front-squat',
        'double-kettlebell-front-squat',
        'implement_grip_front_rack_and_range',
        '{"implement":"kettlebell","implementQuantity":"two","loadPosition":"front_rack","range":"declared_source_range"}'::JSONB
      ),
      (
        'kettlebell-deadlift',
        'double-kettlebell-deadlift',
        'implement_quantity_grip_stance_and_start_height',
        '{"implement":"kettlebell","implementQuantity":"two","grip":"declared_source_grip","stance":"declared_source_stance","startHeight":"declared_source_height"}'::JSONB
      ),
      (
        'kettlebell-strict-press',
        'double-kettlebell-strict-press',
        'implement_quantity_rack_and_press_laterality',
        '{"implement":"kettlebell","implementQuantity":"two","rack":"declared_source_rack","pressLaterality":"bilateral","legDrive":false}'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'heavy-med-ball-chest-pass-d7',
        'ball_mass_distance_return_and_rest',
        '{"implement":"medicine_ball","ballMass":"heavy_relative_to_athlete","distance":"declared_source_distance","return":"declared_source_return","rest":"full_reset"}'::JSONB
      ),
      (
        'drop-step-crossover-go',
        'drop-step-crossover-go-on-cue',
        'external_cue_side_distance_and_finish',
        '{"cue":"declared_external_signal","side":"declared_source_side","distance":"declared_source_distance","finish":"declared_source_finish"}'::JSONB
      ),
      (
        'dumbbell-pullover',
        'kettlebell-pullover',
        'implement_quantity_grip_range_and_support',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","grip":"declared_source_grip","range":"declared_source_range","support":"declared_source_support"}'::JSONB
      ),
      (
        'dumbbell-renegade-row',
        'kettlebell-renegade-row',
        'implement_quantity_base_width_and_row_laterality',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","baseWidth":"declared_source_base","rowLaterality":"declared_source_laterality"}'::JSONB
      ),
      (
        'split-squat',
        'dumbbell-split-squat',
        'implement_quantity_load_position_stance_and_range',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","stance":"split","range":"declared_source_range"}'::JSONB
      ),
      (
        'split-squat',
        'kettlebell-split-squat',
        'implement_quantity_load_position_stance_and_range',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","stance":"split","range":"declared_source_range"}'::JSONB
      ),
      (
        'split-squat',
        'double-kettlebell-split-squat',
        'implement_quantity_front_rack_stance_and_range',
        '{"implement":"kettlebell","implementQuantity":"two","loadPosition":"declared_source_position","stance":"split","range":"declared_source_range"}'::JSONB
      ),
      (
        'step-up',
        'dumbbell-step-up',
        'implement_quantity_load_position_box_height_and_finish',
        '{"implement":"dumbbell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","boxHeight":"declared_source_height","finish":"declared_source_finish"}'::JSONB
      ),
      (
        'step-up',
        'kettlebell-step-up',
        'implement_quantity_load_position_box_height_and_finish',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadPosition":"declared_source_position","boxHeight":"declared_source_height","finish":"declared_source_finish"}'::JSONB
      ),
      (
        'dumbbell-sumo-squat',
        'kettlebell-sumo-squat',
        'implement_quantity_grip_stance_and_range',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","grip":"declared_source_grip","stance":"sumo","range":"declared_source_range"}'::JSONB
      ),
      (
        'dumbbell-windmill',
        'kettlebell-windmill',
        'implement_load_side_grip_range_and_support',
        '{"implement":"kettlebell","loadSide":"declared_source_side","grip":"declared_source_grip","range":"declared_source_range","support":"declared_source_support"}'::JSONB
      ),
      (
        'falling-start-to-10-yards',
        'falling-start-to-10-yard-cone',
        'orthographic_finish_marker_cue_and_distance',
        '{"start":"falling_start","distanceYards":10,"finishMarker":"cone_or_line","cue":"declared_source_cue"}'::JSONB
      ),
      (
        'line-pogo-forward-back',
        'forward-backward-pogos',
        'orthographic_line_target_amplitude_contacts_and_distance',
        '{"direction":"forward_backward","target":"line_or_floor_marker","amplitude":"declared_source_amplitude","contactCount":"declared_source_count"}'::JSONB
      ),
      (
        'half-kneeling-rotational-wall-throw',
        'half-kneeling-rotational-med-ball-throw',
        'orthographic_ball_wall_return_side_and_stance',
        '{"implement":"medicine_ball","target":"wall","return":"declared_throw_only_or_rebound","side":"declared_source_side","stance":"half_kneeling"}'::JSONB
      ),
      (
        'high-low-catch-decision-drill',
        'high-low-football-catch-decision-drill',
        'sport_context_ball_type_cue_height_and_return',
        '{"sportContext":"football_or_general_catching","ballType":"declared_source_ball","cue":"high_or_low","return":"declared_source_return"}'::JSONB
      ),
      (
        'hill-sprint-acceleration',
        'low-incline-hill-sprint-acceleration',
        'incline_distance_start_and_recovery',
        '{"incline":"low_safe_declared_grade","distance":"declared_source_distance","start":"declared_source_stance","recovery":"declared_source_recovery"}'::JSONB
      ),
      (
        'jump-rope-bounce',
        'jump-rope-low-bounce',
        'amplitude_cadence_contact_count_and_duration',
        '{"amplitude":"low","cadence":"declared_source_cadence","contactCount":"declared_source_count","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'jump-rope-bounce',
        'jump-rope-easy-bounce',
        'amplitude_cadence_contact_count_and_duration',
        '{"amplitude":"easy_low","cadence":"declared_source_cadence","contactCount":"declared_source_count","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'kettlebell-deadlift',
        'kettlebell-deadlift-heavy-d7',
        'load_intensity_stance_start_height_reps_and_rest',
        '{"implement":"kettlebell","loadIntensity":"heavy_relative_to_athlete","stance":"declared_source_stance","startHeight":"declared_source_height","reps":"declared_source_reps","rest":"declared_source_rest"}'::JSONB
      ),
      (
        'landmine-rotation',
        'landmine-180-rotation',
        'rotation_arc_stance_range_and_return',
        '{"implement":"landmine","rotationArcDegrees":180,"stance":"declared_source_stance","range":"declared_source_range","return":"declared_source_return"}'::JSONB
      ),
      (
        'landmine-anti-rotation-press',
        'landmine-anti-rotation-press-out',
        'orthographic_stance_press_range_hold_and_load',
        '{"implement":"landmine","stance":"declared_source_stance","pressRange":"declared_source_range","hold":"declared_source_hold","load":"declared_source_load"}'::JSONB
      ),
      (
        'lateral-bound-to-stick',
        'lateral-skater-bound-stick',
        'orthographic_projection_distance_landing_side_and_hold',
        '{"projectionDirection":"lateral","distance":"declared_source_distance","landingSide":"declared_source_side","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'lateral-line-pogo',
        'lateral-line-pogo-hops',
        'orthographic_line_target_amplitude_contacts_and_duration',
        '{"direction":"lateral","target":"line","amplitude":"declared_source_amplitude","contactCount":"declared_source_count","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'lateral-line-pogo',
        'lateral-line-hops',
        'line_target_amplitude_contacts_and_stiffness_strategy',
        '{"direction":"lateral","target":"line","amplitude":"declared_source_amplitude","contactCount":"declared_source_count","stiffnessStrategy":"declared_source_strategy"}'::JSONB
      ),
      (
        'lateral-lunge-to-rotational-reach',
        'lateral-lunge-to-rotational-reach-flow',
        'continuity_cadence_range_and_return',
        '{"continuity":"flow_or_reset","cadence":"declared_source_cadence","range":"declared_source_range","return":"declared_source_return"}'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'lateral-shuffle-decel-stick-on-cue',
        'external_stop_cue_distance_side_and_terminal_hold',
        '{"cue":"declared_external_stop_signal","distance":"declared_source_distance","side":"declared_source_side","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'lateral-shuffle-to-stick',
        'orthographic_distance_side_deceleration_target_and_hold',
        '{"distance":"declared_source_distance","side":"declared_source_side","terminalAction":"deceleration_stick","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'lateral-shuffle-to-braking-stick',
        'orthographic_distance_side_deceleration_target_and_hold',
        '{"distance":"declared_source_distance","side":"declared_source_side","terminalAction":"deceleration_stick","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'lateral-step-down',
        'lateral-step-down-balance',
        'box_height_range_touch_balance_and_support',
        '{"boxHeight":"declared_source_height","range":"declared_source_range","touch":"tap_or_hover","balance":"declared_source_standard","support":"declared_source_support"}'::JSONB
      ),
      (
        'line-pogo-side-to-side',
        'low-line-pogo-side-to-side',
        'amplitude_line_target_contacts_and_duration',
        '{"direction":"side_to_side","amplitude":"low","target":"line","contactCount":"declared_source_count","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'low-level-reactive-agility-box',
        'partner-low-level-reactive-agility-box',
        'partner_cue_box_dimensions_response_set_and_duration',
        '{"cueSource":"partner","boxDimensions":"declared_source_dimensions","responseSet":"declared_source_responses","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'med-ball-overhead-back-toss',
        'orthographic_ball_mass_preload_direction_contacts_and_sector',
        '{"implement":"medicine_ball","ballMass":"declared_source_mass","preload":"declared_source_preload","direction":"backward_overhead","contacts":"declared_source_contacts","target":"closed_landing_sector"}'::JSONB
      ),
      (
        'medicine-ball-catch-to-decel-stick',
        'partner-med-ball-catch-to-decel-stick',
        'partner_role_ball_mass_approach_direction_and_terminal_hold',
        '{"cueSource":"partner_throw","implement":"medicine_ball","ballMass":"declared_source_mass","approach":"declared_source_approach","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'medicine-ball-lateral-shuffle-pass',
        'partner-lateral-shuffle-med-ball-pass',
        'partner_role_pass_type_shuffle_distance_and_return',
        '{"cueSource":"partner","implement":"medicine_ball","passType":"declared_chest_or_scoop","shuffleDistance":"declared_source_distance","return":"declared_source_return"}'::JSONB
      ),
      (
        'medicine-ball-rotational-scoop-toss',
        'rotational-wall-ball-scoop-toss',
        'orthographic_ball_wall_return_side_and_stance',
        '{"implement":"medicine_ball","target":"wall","return":"declared_throw_only_or_rebound","side":"declared_source_side","stance":"declared_source_stance"}'::JSONB
      ),
      (
        'medicine-ball-rotational-scoop-toss',
        'standing-medicine-ball-scoop-toss',
        'declared_rotational_action_ball_target_return_side_and_stance',
        '{"implement":"medicine_ball","action":"rotational_scoop_toss","target":"declared_wall_partner_or_lane","return":"declared_source_return","stance":"standing"}'::JSONB
      ),
      (
        'mini-hurdle-wicket-rhythm-run',
        'mini-hurdle-wicket-run-in',
        'orthographic_spacing_run_in_distance_cadence_and_exit',
        '{"implement":"mini_hurdles_or_wickets","spacing":"declared_source_spacing","runInDistance":"declared_source_run_in","cadence":"declared_source_cadence","exit":"declared_source_exit"}'::JSONB
      ),
      (
        'one-arm-dumbbell-row',
        'one-arm-kettlebell-row',
        'implement_grip_support_load_side_and_range',
        '{"implement":"kettlebell","grip":"declared_source_grip","support":"declared_source_support","loadSide":"declared_source_side","range":"declared_source_range"}'::JSONB
      ),
      (
        'open-book-rotation',
        'open-book-t-spine-rotation',
        'orthographic_side_knee_support_range_and_breath',
        '{"side":"declared_source_side","kneeSupport":"declared_source_support","range":"declared_source_range","breath":"declared_source_breath"}'::JSONB
      ),
      (
        'pallof-press-pallof-hold',
        'pallof-press-iso-hold',
        'orthographic_stance_press_range_hold_and_resistance',
        '{"stance":"declared_standing_or_kneeling","pressRange":"declared_source_range","hold":"isometric","resistance":"band_or_cable"}'::JSONB
      ),
      (
        'partner-chase-first-step-sprint',
        'partner-chase-sprint-start',
        'orthographic_partner_cue_start_stance_distance_and_roles',
        '{"cueSource":"lead_partner","startStance":"declared_source_stance","distance":"declared_source_distance","roles":"declared_source_roles"}'::JSONB
      ),
      (
        'reactive-med-ball-toss-and-relocate',
        'partner-reactive-med-ball-toss-and-relocate',
        'partner_role_ball_target_relocation_and_return',
        '{"cueSource":"partner","implement":"medicine_ball","target":"declared_live_safe_location","relocation":"declared_source_relocation","return":"declared_source_return"}'::JSONB
      ),
      (
        'pike-push-up',
        'pike-push-up-box-pike-push-up',
        'foot_elevation_support_range_and_head_target',
        '{"footElevation":"floor_or_box","support":"declared_source_support","range":"declared_source_range","headTarget":"declared_source_target"}'::JSONB
      ),
      (
        'push-up-negative',
        'ring-push-up-negative',
        'support_implement_stability_range_and_tempo',
        '{"support":"rings","stability":"free_suspension","range":"declared_source_range","tempo":"slow_eccentric"}'::JSONB
      ),
      (
        'rear-foot-elevated-split-squat',
        'rear-foot-elevated-split-squat-negative',
        'eccentric_tempo_range_support_and_return',
        '{"tempo":"slow_eccentric","range":"declared_source_range","rearFootSupport":"declared_source_support","return":"declared_source_return"}'::JSONB
      ),
      (
        'seated-box-jump',
        'seated-start-box-jump',
        'orthographic_seat_height_pause_box_height_and_landing',
        '{"start":"seated","seatHeight":"declared_source_height","pause":"declared_source_pause","boxHeight":"declared_source_box","landing":"box_controlled"}'::JSONB
      ),
      (
        'side-plank-reach-through',
        'side-plank-reach-through-control',
        'orthographic_side_support_range_cadence_and_return',
        '{"side":"declared_source_side","support":"declared_source_support","range":"declared_source_range","cadence":"declared_source_cadence","return":"stacked"}'::JSONB
      ),
      (
        'single-leg-squat-to-box',
        'single-leg-box-squat-negative',
        'eccentric_tempo_box_height_range_and_return',
        '{"tempo":"slow_eccentric","boxHeight":"declared_source_height","range":"declared_source_range","return":"declared_source_return"}'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-rdl-reach',
        'external_load_reach_side_range_and_support',
        '{"implement":"bodyweight_or_declared_load","reach":"declared_source_reach","side":"declared_source_side","range":"declared_source_range","support":"declared_source_support"}'::JSONB
      ),
      (
        'staggered-stance-dumbbell-rdl',
        'staggered-stance-kettlebell-rdl',
        'implement_quantity_load_side_stance_and_range',
        '{"implement":"kettlebell","implementQuantity":"declared_source_quantity","loadSide":"declared_source_side","stance":"staggered","range":"declared_source_range"}'::JSONB
      ),
      (
        'staggered-stance-dumbbell-rdl',
        'staggered-stance-sandbag-rdl-strength',
        'implement_load_position_stance_and_range',
        '{"implement":"sandbag","loadPosition":"declared_source_position","stance":"staggered","range":"declared_source_range"}'::JSONB
      ),
      (
        'standing-calf-raise-iso-hold',
        'standing-calf-raise-isometric-hold',
        'orthographic_support_load_range_and_hold_duration',
        '{"support":"declared_source_support","load":"declared_source_load","range":"top_hold","holdDuration":"declared_source_duration"}'::JSONB
      ),
      (
        'tall-kneeling-cable-band-chop',
        'tall-kneeling-medicine-ball-chop',
        'implement_resistance_vector_chop_path_range_and_tempo',
        '{"implement":"medicine_ball","resistanceVector":"free_load","chopPath":"declared_source_path","range":"declared_source_range","tempo":"declared_source_tempo"}'::JSONB
      ),
      (
        'wall-drill-switch',
        'wall-drill-fast-switch',
        'switch_cadence_contact_count_wall_angle_and_duration',
        '{"cadence":"fast","contactCount":"declared_source_count","wallAngle":"declared_source_angle","duration":"declared_source_duration"}'::JSONB
      ),
      (
        'wall-drill-switch',
        'wall-drive-switch',
        'orthographic_switch_cadence_contact_count_and_wall_angle',
        '{"cadence":"declared_source_cadence","contactCount":"declared_source_count","wallAngle":"declared_source_angle"}'::JSONB
      ),
      (
        'wall-drill-march',
        'wall-drive-march',
        'orthographic_march_cadence_contact_count_and_wall_angle',
        '{"cadence":"declared_source_cadence","contactCount":"declared_source_count","wallAngle":"declared_source_angle"}'::JSONB
      ),
      (
        'wall-drive-iso-hold',
        'wall-drive-sprint-iso-hold',
        'orthographic_side_wall_angle_joint_positions_and_hold',
        '{"side":"declared_source_side","wallAngle":"declared_source_angle","jointPositions":"declared_source_positions","holdDuration":"declared_source_duration"}'::JSONB
      ),
      (
        'wall-handstand-hold',
        'wall-handstand-line-hold',
        'orthographic_wall_orientation_hand_spacing_line_and_duration',
        '{"wallOrientation":"declared_source_orientation","handSpacing":"declared_source_spacing","lineStandard":"declared_source_standard","holdDuration":"declared_source_duration"}'::JSONB
      ),
      (
        'bulgarian-split-squat',
        'rear-foot-elevated-split-squat',
        'orthographic_rear_foot_support_stance_range_and_load',
        '{"stance":"rear_foot_elevated_split","rearFootSupport":"box_or_bench","range":"declared_source_range","load":"declared_source_load"}'::JSONB
      ),
      (
        'lateral-sled-drag',
        'heavy-sled-lateral-drag-strength',
        'load_intensity_attachment_side_distance_and_rest',
        '{"implement":"sled","loadIntensity":"heavy_relative_to_athlete","attachment":"declared_source_attachment","side":"declared_source_side","distance":"declared_source_distance","rest":"declared_source_rest"}'::JSONB
      ),
      (
        'heavy-sled-push-march',
        'heavy-sled-push-sled-drive-march',
        'orthographic_load_body_angle_step_pattern_distance_and_rest',
        '{"implement":"sled","loadIntensity":"heavy_relative_to_athlete","bodyAngle":"declared_source_angle","stepPattern":"march","distance":"declared_source_distance","rest":"declared_source_rest"}'::JSONB
      ),
      (
        'half-kneeling-pallof-press',
        'half-kneeling-pallof-press-iso-hold',
        'hold_duration_resistance_anchor_side_and_range',
        '{"stance":"half_kneeling","holdDuration":"declared_source_duration","resistance":"band_or_cable","anchorSide":"declared_source_side","pressRange":"declared_source_range"}'::JSONB
      ),
      (
        'partner-mirror-shuffle',
        'partner-mirror-shuffle-box',
        'lane_or_box_dimensions_cue_roles_duration_and_reset',
        '{"environment":"cone_box_or_lane","dimensions":"declared_source_dimensions","cueSource":"leader_partner","roles":"declared_source_roles","duration":"declared_source_duration","reset":"declared_source_reset"}'::JSONB
      ),
      (
        'suitcase-carry',
        'suitcase-carry-march',
        'travel_or_in_place_step_pattern_side_load_and_duration',
        '{"stepPattern":"march_in_place_or_travel","side":"declared_source_side","load":"declared_source_load","distanceOrTime":"declared_source_dose"}'::JSONB
      ),
      (
        'nordic-hamstring-eccentric',
        'nordic-hamstring-curl-negative',
        'orthographic_assistance_range_tempo_and_return_strategy',
        '{"assistance":"declared_source_assistance","range":"declared_source_range","tempo":"slow_eccentric","returnStrategy":"declared_source_return"}'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'split-stance-medicine-ball-rotational-throw',
        'standing_stance_ball_target_return_side_and_load',
        '{"stance":"split","implement":"medicine_ball","target":"declared_wall_partner_or_lane","return":"declared_source_return","side":"declared_source_side","ballMass":"declared_source_mass"}'::JSONB
      ),
      (
        'box-jump',
        'arm-swing-timing-box-jump',
        'arm_action_preload_box_height_landing_and_descent',
        '{"armAction":"timed_arm_swing","preload":"declared_source_preload","boxHeight":"declared_source_height","landing":"box_controlled","descent":"step_down"}'::JSONB
      ),
      (
        'box-jump',
        'no-arm-swing-box-jump',
        'arm_action_preload_box_height_landing_and_descent',
        '{"armAction":"no_arm_swing","preload":"declared_source_preload","boxHeight":"declared_source_height","landing":"box_controlled","descent":"step_down"}'::JSONB
      ),
      (
        'ball-drop-reaction-sprint',
        'ball-drop-reaction',
        'orthographic_ball_type_bounce_limit_distance_and_finish',
        '{"cue":"ball_drop","ballType":"declared_source_ball","bounceLimit":"declared_source_limit","distance":"declared_source_distance","finish":"catch_or_declared_target"}'::JSONB
      ),
      (
        'box-jump',
        'countermovement-box-jump',
        'preload_arm_action_box_height_landing_and_descent',
        '{"preload":"countermovement","armAction":"declared_source_arm_action","boxHeight":"declared_source_height","landing":"box_controlled","descent":"step_down"}'::JSONB
      ),
      (
        'box-jump',
        'non-countermovement-box-jump',
        'preload_arm_action_box_height_landing_and_descent',
        '{"preload":"static_or_no_countermovement","armAction":"declared_source_arm_action","boxHeight":"declared_source_height","landing":"box_controlled","descent":"step_down"}'::JSONB
      ),
      (
        'trap-bar-deadlift',
        'kettlebell-deadlift-trap-bar-deadlift',
        'malformed_multi_implement_source_grip_stance_start_height_and_range',
        '{"implement":"trap_bar_or_kettlebell_as_declared_by_legacy_source","sourceRequiresVariantSplit":true,"grip":"declared_source_grip","stance":"declared_source_stance","startHeight":"declared_source_height","range":"declared_source_range"}'::JSONB
      ),
      (
        'rotational-bound-to-stick',
        'lateral-bound-to-rotational-stick',
        'orthographic_projection_direction_rotation_landing_side_and_hold',
        '{"projectionDirection":"declared_lateral_or_diagonal","rotation":"declared_source_rotation","landingSide":"declared_source_side","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'lateral-bound-to-stick',
        'step-behind-lateral-bound-to-stick',
        'approach_step_projection_distance_landing_side_and_hold',
        '{"approach":"step_behind","projectionDirection":"lateral","distance":"declared_source_distance","landingSide":"declared_source_side","terminalHold":"declared_source_hold"}'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'med-ball-step-behind-rotational-throw',
        'approach_step_ball_target_return_side_and_load',
        '{"approach":"step_behind","implement":"medicine_ball","target":"declared_wall_partner_or_lane","return":"declared_source_return","side":"declared_source_side","ballMass":"declared_source_mass"}'::JSONB
      ),
      (
        'kneeling-box-jump',
        'half-kneeling-box-jump',
        'kneeling_base_lead_side_box_height_landing_and_descent',
        '{"startBase":"half_kneeling","leadSide":"declared_source_side","boxHeight":"declared_source_height","landing":"box_controlled","descent":"step_down"}'::JSONB
      )
    ) AS sources(
      survivor_slug,
      duplicate_slug,
      identity_boundary,
      variant_dimensions
    )
  LOOP
    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 active_duplicate
      WHERE active_duplicate.slug = source.duplicate_slug
        AND active_duplicate.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_definition_v1 active_survivor
          WHERE active_survivor.facility_id = active_duplicate.facility_id
            AND active_survivor.slug = source.survivor_slug
            AND active_survivor.status <> 'archived'
        )
    ) THEN
      RAISE EXCEPTION
        'Implement identity consolidation found active duplicate % without active survivor % in the same facility',
        source.duplicate_slug,
        source.survivor_slug;
    END IF;

    FOR survivor IN
      SELECT id, facility_id, card_version, canonical_name, display_name
      FROM coaching.exercise_definition_v1
      WHERE slug = source.survivor_slug
        AND status <> 'archived'
    LOOP
      SELECT
        id,
        facility_id,
        legacy_exercise_id,
        canonical_name,
        display_name,
        aliases,
        provenance_json
      INTO duplicate
      FROM coaching.exercise_definition_v1
      WHERE facility_id = survivor.facility_id
        AND slug = source.duplicate_slug
        AND status <> 'archived';

      IF duplicate.id IS NULL THEN
        CONTINUE;
      END IF;

      target_ids := ARRAY[survivor.id, duplicate.id];

      SELECT COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
        )
        OR (
          resolution.survivor_definition_id = duplicate.id
          AND resolution.resolved_definition_id = survivor.id
        )
      )
        AND NOT (
          resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
          AND resolution.decision = 'duplicate_consolidated'
        );

      SELECT conflicting_resolutions + COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        resolution.survivor_definition_id = duplicate.id
        OR resolution.resolved_definition_id = duplicate.id
      )
        AND survivor.id NOT IN (
          resolution.survivor_definition_id,
          resolution.resolved_definition_id
        )
        -- A survivor may itself become a source in a later, broader
        -- consolidation. Keep its already-archived duplicate lineage in
        -- place; all of those source maps move to the final survivor below.
        AND NOT (
          resolution.decision = 'duplicate_consolidated'
          AND resolution.survivor_definition_id = duplicate.id
          AND EXISTS (
            SELECT 1
            FROM coaching.exercise_definition_v1 prior_duplicate
            WHERE prior_duplicate.id = resolution.resolved_definition_id
              AND prior_duplicate.status = 'archived'
          )
        );

      IF conflicting_resolutions > 0 THEN
        RAISE EXCEPTION
          'Implement identity consolidation for % and % conflicts with % existing identity resolution(s)',
          source.survivor_slug,
          source.duplicate_slug,
          conflicting_resolutions;
      END IF;

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
          'Implement identity consolidation for % refused to override % protected record(s)',
          source.duplicate_slug,
          protected_records;
      END IF;

      SELECT COALESCE(
        array_agg(DISTINCT definition_source.legacy_exercise_id),
        '{}'::BIGINT[]
      )
      INTO target_legacy_ids
      FROM coaching.exercise_definition_source_v1 definition_source
      WHERE definition_source.definition_id = ANY(target_ids);

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
      VALUES (
        survivor.facility_id,
        survivor.id,
        duplicate.id,
        'duplicate_consolidated',
        format(
          '%s preserves the same base movement contract as %s. The source modifier is retained as exact variant metadata (%s), not as a separate exercise identity.',
          duplicate.canonical_name,
          survivor.canonical_name,
          source.identity_boundary
        ),
        jsonb_build_object(
          'match', 'same_base_movement_with_exact_variant_dimensions',
          'survivorSlug', source.survivor_slug,
          'resolvedSlug', source.duplicate_slug,
          'identityBoundary', source.identity_boundary,
          'variantDimensions', source.variant_dimensions,
          'sameBaseMovementContract', TRUE,
          'modifierBecomesExactVariant', TRUE,
          'exerciseDifficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'proficiencyClassificationScope',
            'coaching_skill_library_only',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        'deterministic_identity_equivalence',
        NULL
      )
      ON CONFLICT (survivor_definition_id, resolved_definition_id)
      DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE resolution.survivor_definition_id = survivor.id
          AND resolution.resolved_definition_id = duplicate.id
          AND resolution.decision = 'duplicate_consolidated'
      ) THEN
        RAISE EXCEPTION
          'Implement identity consolidation for % was not persisted',
          source.duplicate_slug;
      END IF;

      UPDATE coaching.exercise_definition_source_v1 definition_source
      SET definition_id = survivor.id,
          source_kind = 'duplicate_consolidation',
          provenance_json = definition_source.provenance_json
            || jsonb_build_object(
              'resolvedFromDefinitionId', duplicate.id,
              'resolution',
                'same_base_movement_with_exact_variant_dimensions',
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions
            )
      WHERE definition_source.definition_id = duplicate.id;

      UPDATE coaching.exercise_delivery_profile_v1 profile
      SET status = 'archived',
          updated_at = now()
      WHERE profile.variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = duplicate.id
      );

      UPDATE coaching.exercise_variant_v1 variant
      SET definition_id = survivor.id,
          variant_key = left(
            'legacy-source-'
            || COALESCE(
              duplicate.legacy_exercise_id::TEXT,
              left(duplicate.id::TEXT, 8)
            )
            || '-'
            || variant.variant_key,
            120
          ),
          status = 'archived',
          difficulty_json = variant.difficulty_json
            - 'skillLevel'
            - 'skill_level'
            - 'proficiencyLevel'
            - 'proficiency_level',
          requirements_json = variant.requirements_json
            - 'skillLevel'
            - 'skill_level'
            - 'proficiencyLevel'
            - 'proficiency_level'
            || jsonb_build_object(
              'sourceIdentityDuplicate', TRUE,
              'sourceDefinitionId', duplicate.id,
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions,
              'selectable', FALSE,
              'identityQuarantine', TRUE,
              'exerciseSkillLevelAllowed', FALSE
            ),
          updated_at = now()
      WHERE variant.definition_id = duplicate.id;

      UPDATE coaching.exercise_section_evidence_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_section_evidence_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND existing.section_key = candidate.section_key
            AND existing.source_url = candidate.source_url
        );

      UPDATE coaching.exercise_alternate_assessment_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_alternate_assessment_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND lower(existing.alternate_name) =
              lower(candidate.alternate_name)
        );

      UPDATE coaching.exercise_media_candidate_v1 candidate
      SET definition_id = survivor.id,
          reviewed_card_version = survivor.card_version,
          updated_at = now()
      WHERE candidate.definition_id = duplicate.id
        AND candidate.review_status IN ('candidate', 'superseded')
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_media_candidate_v1 existing
          WHERE existing.definition_id = survivor.id
            AND existing.reviewed_card_version = survivor.card_version
            AND (
              existing.video_id = candidate.video_id
              OR existing.url = candidate.url
            )
        );

      UPDATE coaching.exercise_definition_v1 survivor_definition
      SET aliases = ARRAY(
            SELECT min(alias)
            FROM unnest(
              COALESCE(survivor_definition.aliases, '{}')
              || COALESCE(duplicate.aliases, '{}')
              || ARRAY[
                duplicate.canonical_name,
                duplicate.display_name
              ]
            ) alias
            WHERE nullif(btrim(alias), '') IS NOT NULL
              AND lower(alias) NOT IN (
                lower(survivor_definition.canonical_name),
                lower(survivor_definition.display_name)
              )
            GROUP BY lower(alias)
            ORDER BY lower(alias)
          ),
          provenance_json =
            survivor_definition.provenance_json
            || jsonb_build_object(
              'identityResolution',
                'same_base_movement_with_exact_variant_dimensions',
              'consolidatedDefinitionIds',
                COALESCE(
                  survivor_definition.provenance_json
                    -> 'consolidatedDefinitionIds',
                  '[]'::JSONB
                ) || to_jsonb(duplicate.id::TEXT),
              'consolidatedLegacyExerciseIds',
                COALESCE(
                  survivor_definition.provenance_json
                    -> 'consolidatedLegacyExerciseIds',
                  '[]'::JSONB
                ) || to_jsonb(duplicate.legacy_exercise_id),
              'exerciseDifficultyModel',
                'max_exercise_complexity_physical_difficulty',
              'proficiencyClassificationScope',
                'coaching_skill_library_only',
              'humanReviewRequired', TRUE,
              'publicationQuarantined', TRUE
            ),
          updated_at = now()
      WHERE survivor_definition.id = survivor.id;

      UPDATE coaching.exercise
      SET skill_level = NULL,
          updated_at = now()
      WHERE id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_scaling_profile
      SET skill_level = NULL
      WHERE exercise_id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_safety_profile
      SET minimum_skill_level = NULL
      WHERE exercise_id = ANY(target_legacy_ids);

      UPDATE coaching.exercise_card_test_packet_v1 packet
      SET status = 'quarantined',
          blocking_issues_json =
            packet.blocking_issues_json
            || jsonb_build_array(
              jsonb_build_object(
                'code',
                  'implement_identity_consolidation_reaudit_required',
                'message',
                  format(
                    'Re-run the canonical card audit after consolidating %s.',
                    source.duplicate_slug
                  ),
                'sourceSlug', source.duplicate_slug
              )
            ),
          human_review_required = TRUE,
          checked_at = now()
      WHERE packet.definition_id = survivor.id;

      UPDATE coaching.exercise_definition_v1 archived_duplicate
      SET status = 'archived',
          approved_video_url = NULL,
          provenance_json =
            archived_duplicate.provenance_json
            || jsonb_build_object(
              'identityResolution', 'duplicate_consolidated',
              'canonicalSurvivorDefinitionId', survivor.id,
              'identityBoundary', source.identity_boundary,
              'variantDimensions', source.variant_dimensions,
              'exerciseDifficultyModel',
                'max_exercise_complexity_physical_difficulty',
              'proficiencyClassificationScope',
                'coaching_skill_library_only',
              'humanReviewRequired', TRUE,
              'publicationQuarantined', TRUE
            ),
          updated_at = now()
      WHERE archived_duplicate.id = duplicate.id;
    END LOOP;
  END LOOP;
END;
$$;
