-- Sources 286-305 were generated from generic change-of-direction language.
-- Apart from the already exact Backpedal-to-Sprint Turn family (source 297),
-- they omit the layout, start, route, plant, object handling, terminal action,
-- dosage, fatigue, and safety contracts required for automatic selection.
DO $cod_transition_sources_286_305_quarantine$
DECLARE
  source_id_value INTEGER;
  definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[286,287,288,289,290,291,292,293,294,295,296,298,299,300,301,302,303,304,305]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1
    SET variant_key='identity-quarantine-source-' || source_id_value,
        display_name='COD / Transition Contract Quarantine — Source ' || source_id_value,
        status='archived',
        requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract',CASE
          WHEN source_id_value BETWEEN 286 AND 293 THEN 'layout_cone_spacing_start_route_direction_plant_sequence_terminal_action_dose_and_cumulative_impact_budget_are_unspecified'
          WHEN source_id_value BETWEEN 294 AND 299 THEN 'start_stance_directional_footwork_transition_sequence_distance_terminal_action_dose_and_cumulative_impact_budget_are_unspecified'
          ELSE 'sport_object_or_implement_start_route_action_sequence_defender_or_space_constraint_terminal_action_dose_and_cumulative_impact_budget_are_unspecified'
        END),difficulty_json='{}'::JSONB,load_profile_json='{}'::JSONB,fatigue_profile_json='{}'::JSONB,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
    WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1
    SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only')
    WHERE id=definition_id_value;
  END LOOP;
END;
$cod_transition_sources_286_305_quarantine$;
