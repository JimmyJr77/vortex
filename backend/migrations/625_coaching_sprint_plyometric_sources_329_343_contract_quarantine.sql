-- Generated sprint/plyometric baselines below lack exact starts, distances,
-- resistance or grade, rhythm geometry, contact accounting, dose, fatigue, and
-- safety contracts. Existing reviewed exact sprint and plyometric variants are
-- retained separately.
DO $sprint_plyometric_sources_329_343_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[329,330,331,333,334,335,337,340,341,343]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Sprint / Plyometric Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (329,333,334) THEN 'start_position_cue_direction_distance_action_sequence_terminal_action_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN source_id_value IN (330,331) THEN 'resistance_or_sled_interface_anchor_or_load_distance_start_position_dose_and_safety_contract_are_unspecified'
          WHEN source_id_value IN (335,337,340,341) THEN 'build_up_distance_speed_timing_rhythm_or_marker_geometry_terminal_zone_dose_and_cumulative_impact_budget_are_unspecified'
          ELSE 'bilateral_or_unilateral_contact_strategy_amplitude_arm_policy_contact_count_dose_and_cumulative_impact_budget_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$sprint_plyometric_sources_329_343_quarantine$;
