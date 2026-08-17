-- These lateral, rotational, weighted, and composite box-jump labels lack an
-- exact box/obstacle, takeoff, landing, descent, external load, dose, fatigue,
-- quality, and stop-rule contract. Preserve only their non-selectable lineage.
DO $blank_profile_box_jump_sources_1562_1588_quarantine$
DECLARE source_id_value INTEGER; definition_id_value UUID;
BEGIN
  FOREACH source_id_value IN ARRAY ARRAY[1562,1563,1564,1565,1566,1568,1569,1570,1572,1577,1578,1579,1580,1581,1582,1583,1584,1585,1586,1587,1588]
  LOOP
    SELECT source.definition_id INTO definition_id_value FROM coaching.exercise_definition_source_v1 source WHERE source.legacy_exercise_id=source_id_value LIMIT 1;
    IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source % canonical definition missing', source_id_value; END IF;
    UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-'||source_id_value,display_name='Blank-Profile Contract Quarantine — Source '||source_id_value,status='archived',requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'exerciseCardDoesNotClassifyParticipants',true,'unresolvedContract','box_or_obstacle_takeoff_landing_descent_external_load_dose_fatigue_quality_and_stop_rule_profiles_are_empty'),difficulty_json='{}'::jsonb,load_profile_json='{}'::jsonb,fatigue_profile_json='{}'::jsonb,programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true) WHERE definition_id=definition_id_value AND variant_key='baseline';
    UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::jsonb)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'exerciseCardDoesNotClassifyParticipants',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only') WHERE id=definition_id_value;
  END LOOP;
END;
$blank_profile_box_jump_sources_1562_1588_quarantine$;
