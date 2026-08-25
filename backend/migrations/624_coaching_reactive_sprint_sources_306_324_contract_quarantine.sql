-- These generic reactive/COD/sprint-source baselines omit the exact cue,
-- station, action, resistance, object, timing, dose, fatigue, and safety
-- contracts. Existing exact Mirror Shuffle, Ball Drop, Dribble, Ankling, and
-- 10-yard Sprint variants remain available.
DO $reactive_sprint_sources_306_324_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[306,308,311,312,313,314,316,324]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Reactive / Sprint Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (306,308,312,313,316) THEN 'cue_source_station_layout_start_action_sequence_direction_distance_terminal_action_dose_and_cumulative_fatigue_or_impact_budget_are_unspecified'
          WHEN source_id_value=311 THEN 'ball_type_drop_or_throw_source_start_distance_lateral_target_catch_or_return_action_dose_and_safety_contract_are_unspecified'
          WHEN source_id_value=314 THEN 'rear_foot_support_height_split_stance_side_knee_angle_isometric_position_hold_duration_load_dose_and_stop_rule_are_unspecified'
          ELSE 'stance_arm_action_range_cadence_side_count_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$reactive_sprint_sources_306_324_quarantine$;
