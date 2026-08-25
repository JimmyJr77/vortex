-- Source 87 conflates wall contact with a human spot.  Support source changes
-- equipment, staffing, force path, exit, logistics, and safety contract.
DO $source_87_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=87 AND slug='handstand-kick-up-wall';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 87 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-87', display_name='Handstand Kick-Up Wall / Spot Identity Quarantine — Source 87', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','wall_contact_vs_human_spot_support_height_entry_exit_side_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('wall_contact_vs_human_spot','support_height','entry','exit','side_assignment','repetition_unit')) WHERE id=definition_id_value;
END;
$source_87_quarantine$;
