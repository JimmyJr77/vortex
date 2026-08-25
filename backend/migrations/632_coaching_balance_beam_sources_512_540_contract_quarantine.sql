-- These balance/beam source labels do not specify an exact surface geometry,
-- support, travel path, terminal action, fall/exit handling, dose, or fatigue
-- contract. Existing exact non-beam foundation variants remain unchanged.
DO $balance_beam_sources_512_540_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[512,515,516,518,520,522,528,530,531,532,533,535,536,537,538,539,540]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='Balance / Beam Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value IN (512,515,516,518,520,522,528,530) THEN 'support_surface_or_base_body_position_range_hold_or_cycle_standard_side_or_direction_dose_and_stop_rule_are_unspecified'
          WHEN source_id_value BETWEEN 531 AND 540 THEN 'beam_or_line_height_width_surface_travel_path_orientation_terminal_action_fall_or_exit_handling_dose_and_stop_rule_are_unspecified'
          ELSE 'support_surface_stance_range_reach_or_perturbation_source_dose_and_stop_rule_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$balance_beam_sources_512_540_quarantine$;
