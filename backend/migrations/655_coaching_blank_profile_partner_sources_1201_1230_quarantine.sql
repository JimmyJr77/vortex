-- Partner drills need explicit roles, resistance/force limits, setup, space,
-- release and catch procedures, dosage, fatigue limits, and stop rules. These
-- legacy labels supply none of that operational card contract.
DO $blank_profile_partner_sources_1201_1230_quarantine$
DECLARE source_id_value INTEGER; definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[1201,1202,1203,1204,1205,1207,1209,1210,1212,1213,1214,1215,1219,1220,1221,1223,1224,1225,1226,1227,1228,1229,1230]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-'||source_id_value,display_name='Blank-Profile Contract Quarantine — Source '||source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','roles_setup_force_or_resistance_limits_dose_fatigue_quality_and_stop_rule_profiles_are_empty'),difficulty_json='{}'::jsonb,load_profile_json='{}'::jsonb,fatigue_profile_json='{}'::jsonb,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::jsonb)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$blank_profile_partner_sources_1201_1230_quarantine$;
