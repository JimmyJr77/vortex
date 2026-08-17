-- These strongman, sled, and sandbag source cards contain no operational card
-- profile beyond legacy difficulty fragments. Their names alone cannot establish
-- the implement dimensions, start/end positions, lane/platform setup, load,
-- dosage, fatigue budget, quality gate, or stop rule required for selection.
DO $blank_profile_strongman_sources_1023_1046_quarantine$
DECLARE source_id_value INTEGER; definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[1023,1027,1029,1030,1031,1032,1033,1034,1035,1036,1037,1038,1039,1040,1041,1042,1043,1045,1046]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-'||source_id_value,display_name='Blank-Profile Contract Quarantine — Source '||source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','requirements_load_fatigue_dosage_quality_and_stop_rule_profiles_are_empty'),difficulty_json='{}'::jsonb,load_profile_json='{}'::jsonb,fatigue_profile_json='{}'::jsonb,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::jsonb)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$blank_profile_strongman_sources_1023_1046_quarantine$;
