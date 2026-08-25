-- These source definitions retain generic baselines without enough support,
-- implement, side, range, loading, sequence, safety, dose, and recovery facts
-- to select a safe exact kettlebell/carry exercise.
DO $kettlebell_sources_454_478_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[454,459,460,468,477]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Kettlebell / Carry Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value=454 THEN 'working_side_arm_position_implement_load_lane_distance_or_time_turn_policy_set_down_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=459 THEN 'working_side_implement_hold_hand_or_floor_support_stance_range_load_sequence_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=460 THEN 'working_side_implement_position_start_to_tall_sit_sequence_hand_support_leg_path_load_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value=468 THEN 'implement_position_stance_depth_hold_duration_range_load_dose_and_stop_rule_are_unspecified'
          ELSE 'single_or_double_kettlebell_implement_position_stance_range_load_pickup_set_down_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$kettlebell_sources_454_478_quarantine$;
