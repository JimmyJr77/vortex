-- These bodyweight and pulling baselines omit exact support, orientation,
-- contact, range, assistance/load, dose, and stop-rule facts. Existing exact
-- reviewed variants for their neighbors remain unchanged.
DO $bodyweight_pull_sources_571_600_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[571,572,575,588,590,591,592,598,600]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Bodyweight / Pull Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (571,572,575) THEN 'support_geometry_stance_or_base_range_load_hold_or_repetition_standard_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=588 THEN 'wall_orientation_hand_foot_path_range_repetition_standard_dose_and_safe_exit_are_unspecified'
          WHEN source_id_value BETWEEN 590 AND 592 THEN 'apparatus_entry_support_height_grip_elbow_policy_range_load_dose_and_safe_exit_are_unspecified'
          WHEN source_id_value=598 THEN 'apparatus_grip_start_end_hold_position_duration_assistance_dose_and_safe_exit_are_unspecified'
          ELSE 'bar_or_ring_interface_support_orientation_leg_position_row_range_load_dose_and_safe_exit_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$bodyweight_pull_sources_571_600_quarantine$;
