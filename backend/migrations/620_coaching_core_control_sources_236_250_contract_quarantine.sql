-- Sources below expose review baselines that either combine materially distinct
-- actions or omit the exact contact, support, path, range, dose, and fatigue
-- contracts needed by the workout generator. Existing exact Dead Bug, Front
-- Plank, Pallof, and Scapular Push-Up variants remain untouched.
DO $core_control_sources_236_250_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[236, 239, 241, 242, 243, 244, 246, 248, 249, 250]
  LOOP
    SELECT source.definition_id INTO definition_id_value
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.legacy_exercise_id=source_id_value
    LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Core / Control Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE source_id_value
          WHEN 236 THEN 'line_or_beam_surface_width_height_target_or_command_freeze_duration_foot_path_dose_and_fall_exit_are_unspecified'
          WHEN 239 THEN 'working_arm_leg_pair_range_hold_duration_support_base_return_standard_dose_and_stop_rule_are_unspecified'
          WHEN 241 THEN 'forearm_or_hand_base_knee_or_toe_support_body_orientation_lever_range_hold_duration_dose_and_stop_rule_are_unspecified'
          WHEN 242 THEN 'hand_foot_geometry_knee_hover_height_external_load_hold_duration_dose_and_stop_rule_are_unspecified'
          WHEN 243 THEN 'hand_foot_geometry_tap_side_shift_policy_knee_hover_height_repetition_standard_dose_and_stop_rule_are_unspecified'
          WHEN 244 THEN 'dumbbell_plate_or_slider_interface_drag_path_hand_support_side_load_range_repetition_standard_and_dose_are_conflated'
          WHEN 246 THEN 'press_or_lift_path_anchor_height_laterality_kneeling_side_range_hold_duration_load_dose_and_stop_rule_are_conflated'
          WHEN 248 THEN 'y_t_and_w_are_distinct_arm_paths_with_unspecified_support_range_hold_dose_and_stop_rules'
          WHEN 249 THEN 'hand_foot_geometry_tap_side_shift_policy_repetition_standard_dose_and_stop_rule_are_unspecified'
          WHEN 250 THEN 'forward_backward_and_lateral_crawl_paths_hand_foot_sequence_distance_turn_policy_dose_and_stop_rule_are_conflated'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$core_control_sources_236_250_quarantine$;
