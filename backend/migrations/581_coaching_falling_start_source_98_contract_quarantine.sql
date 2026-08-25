-- Source 98 does not define lead side, fall distance, catch contact, split
-- stance geometry, arm position, hold/reset count, or exit; its active card
-- also lacks operational requirements, load, and fatigue contracts.
DO $source_98_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=98 AND slug='falling-start-hold';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 98 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-98', display_name='Falling Start Position Contract Quarantine — Source 98', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','lead_side_fall_distance_catch_contact_split_stance_arm_position_hold_reset_count_exit_load_and_fatigue_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('lead_side','fall_distance_and_catch_contact','split_stance_and_arm_position','hold_reset_count_and_exit','load_fatigue')) WHERE id=definition_id_value;
END;
$source_98_quarantine$;
