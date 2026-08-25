-- These legacy support and isometric cards are not exact selectable contracts:
-- they combine different actions or omit essential support, range, loading,
-- time-dose, safety, and stop-rule facts. Exact reviewed neighbors remain.
DO $isometric_support_sources_251_266_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[251, 253, 254, 255, 256, 258, 260, 264, 265, 266]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Support / Isometric Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE source_id_value
          WHEN 251 THEN 'crab_and_reverse_tabletop_support_geometry_elbow_policy_hip_height_hold_duration_dose_and_exit_are_conflated'
          WHEN 253 THEN 'wall_orientation_hand_distance_shoulder_motion_range_rep_standard_dose_and_safe_exit_are_unspecified'
          WHEN 254 THEN 'wall_walk_start_orientation_hand_foot_path_terminal_height_descent_range_dose_and_safe_exit_are_unspecified'
          WHEN 255 THEN 'ring_assistance_entry_support_height_elbow_lock_policy_hold_duration_dose_and_safe_exit_are_unspecified'
          WHEN 256 THEN 'static_wrist_lean_and_dynamic_support_rock_are_distinct_actions_with_unspecified_hand_angle_load_range_dose_and_stop_rule'
          WHEN 258 THEN 'lateral_lunge_side_depth_support_range_hold_duration_load_dose_and_stop_rule_are_unspecified'
          WHEN 260 THEN 'squeeze_implement_bridge_support_geometry_knee_angle_hold_duration_load_dose_and_stop_rule_are_unspecified'
          WHEN 264 THEN 'support_surface_load_interface_knee_angle_heel_height_hold_duration_dose_and_stop_rule_are_unspecified'
          WHEN 265 THEN 'wall_or_floor_support_foot_distance_toe_lift_range_hold_duration_dose_and_stop_rule_are_unspecified'
          WHEN 266 THEN 'anchor_interface_knee_angle_body_line_lean_range_hand_catch_policy_hold_duration_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$isometric_support_sources_251_266_quarantine$;
