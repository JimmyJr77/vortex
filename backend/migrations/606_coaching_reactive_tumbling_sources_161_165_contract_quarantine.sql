-- Sources 161–165 lack exact operational contracts; Source 165 also combines
-- two different tumbling terminal actions.  Preserve lineage/media but block
-- workout selection until exact reviewed candidates exist.
DO $reactive_tumbling_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      (161, 'curved-run-to-cut', 'Curved Run to Cut Contract Quarantine — Source 161', 'curve_radius_direction_entry_speed_cut_angle_plant_side_exit_deceleration_lane_geometry_dosage_load_and_fatigue_are_unspecified'),
      (162, 'reactive-gate-sprint', 'Reactive Gate Sprint Contract Quarantine — Source 162', 'gate_count_layout_cue_mode_response_direction_acceleration_distance_run_out_deceleration_dosage_load_and_fatigue_are_unspecified'),
      (163, 'mirror-shuffle-to-sprint-exit', 'Mirror Shuffle to Sprint Exit Contract Quarantine — Source 163', 'partner_roles_lane_width_spacing_cue_rule_exit_direction_sprint_distance_run_out_dosage_load_and_fatigue_are_unspecified'),
      (164, 'ball-drop-sprint-catch', 'Ball Drop Sprint Catch Contract Quarantine — Source 164', 'ball_type_drop_height_releaser_position_start_distance_catch_rule_run_out_return_dosage_load_and_fatigue_are_unspecified'),
      (165, 'power-hurdle-to-cartwheel-round-off-entry', 'Power Hurdle to Cartwheel / Round-Off Identity Quarantine — Source 165', 'cartwheel_vs_round_off_terminal_action_hurdle_entry_side_hand_placement_landing_finish_surface_spotting_dosage_load_and_fatigue_are_conflated')
    ) AS source_data(legacy_id, slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='identity-quarantine-source-' || source_record.legacy_id,
        display_name=source_record.display_value,status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value AND v.variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.legacy_exercise_id=source_record.legacy_id AND d.slug=source_record.slug_value;
  END LOOP;
END;
$reactive_tumbling_quarantine$;
