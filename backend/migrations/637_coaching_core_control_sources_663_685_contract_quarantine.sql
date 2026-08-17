-- These core/control source cards have generic baselines that do not define
-- their exact support, limb path, range, loading, dose, or stop contract.
DO $core_control_sources_663_685_quarantine$
DECLARE source_id_value INTEGER; definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[663,664,665,667,670,671,672,679,682,683,685]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-'||source_id_value,display_name='Core / Control Contract Quarantine — Source '||source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','support_geometry_limb_or_body_path_range_load_or_assistance_dose_and_stop_rule_are_unspecified'),difficulty_json='{}'::jsonb,load_profile_json='{}'::jsonb,fatigue_profile_json='{}'::jsonb,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::jsonb)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$core_control_sources_663_685_quarantine$;
