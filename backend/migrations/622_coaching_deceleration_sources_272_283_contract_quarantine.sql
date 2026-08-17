-- Remaining generated landing and deceleration baselines in this batch do not
-- define enough mechanics for a safe selector. Existing exact snap-down, drop
-- landing, and lateral-bound cards are not changed.
DO $deceleration_sources_272_283_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[272, 273, 278, 281, 282, 283]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Landing / Deceleration Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE source_id_value
          WHEN 272 THEN 'single_leg_start_support_release_landing_leg_contact_count_hold_standard_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 273 THEN 'platform_height_departure_direction_landing_leg_or_feet_lateral_target_hold_standard_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 278 THEN 'build_up_distance_speed_braking_zone_breakdown_step_pattern_stop_standard_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 281 THEN 'approach_distance_speed_closeout_footwork_terminal_stance_hold_or_exit_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 282 THEN 'curve_radius_direction_speed_braking_entry_footwork_terminal_stance_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN 283 THEN 'approach_distance_speed_cut_side_plant_foot_angle_reacceleration_distance_dose_and_cumulative_impact_budget_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$deceleration_sources_272_283_quarantine$;
