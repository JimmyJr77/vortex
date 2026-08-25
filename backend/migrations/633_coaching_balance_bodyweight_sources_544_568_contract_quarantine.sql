-- These generated balance, perturbation, and bodyweight baselines omit the
-- precise station, stimulus, support, contact, movement sequence, dose, and
-- stop rules required for selection. Exact reviewed neighbors remain intact.
DO $balance_bodyweight_sources_544_568_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[544,546,547,550,551,552,553,554,555,556,557,560,561,563,568]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Balance / Bodyweight Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (544,546,547,550) THEN 'station_layout_start_path_terminal_action_support_or_contact_policy_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value BETWEEN 551 AND 557 THEN 'partner_or_band_perturbation_source_magnitude_direction_timing_support_base_response_action_dose_and_safety_contract_are_unspecified'
          WHEN source_id_value=560 THEN 'kneeling_side_start_position_transition_sequence_support_policy_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value IN (561,563) THEN 'stance_support_range_tempo_or_hold_duration_load_dose_and_stop_rule_are_unspecified'
          ELSE 'assistance_interface_working_side_support_range_box_or_target_geometry_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$balance_bodyweight_sources_544_568_quarantine$;
