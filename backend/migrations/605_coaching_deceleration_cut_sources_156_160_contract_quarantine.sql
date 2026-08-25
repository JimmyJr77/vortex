-- Surviving generic baselines in these deceleration/COD families omit the
-- exact geometry, entry, contact, terminal, dosage, load, and fatigue contract.
DO $deceleration_cut_quarantine$
DECLARE source_record RECORD;
BEGIN
  FOR source_record IN
    SELECT * FROM (VALUES
      ('jog-to-stick-linear-deceleration', 'Linear Deceleration Contract Quarantine — Sources 155/156', 'approach_speed_distance_stop_zone_braking_contact_count_lead_leg_hold_duration_measurement_rest_dosage_load_and_fatigue_are_unspecified'),
      ('90-degree-speed-cut', '90-Degree Speed Cut Contract Quarantine — Source 159', 'approach_speed_distance_plant_foot_braking_emphasis_exit_speed_cone_layout_side_dose_rest_dosage_load_and_fatigue_are_unspecified'),
      ('pro-agility-5-10-5-technical-rep', 'Pro-Agility 5-10-5 Contract Quarantine — Source 158', 'start_position_line_layout_turn_sequence_side_order_entry_intent_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified'),
      ('180-degree-turn-shuttle-cut', '180-Degree Turn / Shuttle Cut Contract Quarantine — Source 160', 'entry_distance_turn_foot_turn_direction_turn_angle_return_path_exit_deceleration_measurement_rest_dosage_load_and_fatigue_are_unspecified')
    ) AS source_data(slug_value, display_value, unresolved_value)
  LOOP
    UPDATE coaching.exercise_variant_v1 v
    SET variant_key='contract-quarantine-' || source_record.slug_value,
        display_name=source_record.display_value,status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',source_record.unresolved_value),
        difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,
        programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    FROM coaching.exercise_definition_v1 d
    WHERE v.definition_id=d.id AND d.facility_id=1 AND d.slug=source_record.slug_value AND v.variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 d
    SET status='archived',card_version=card_version+1,
        provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE d.facility_id=1 AND d.slug=source_record.slug_value;
  END LOOP;
END;
$deceleration_cut_quarantine$;
