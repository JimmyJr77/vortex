-- Source 85 conflates donkey kick and bunny hop under one label while allowing
-- different starts and unspecified hip/foot travel.  Preserve its lineage but
-- require separate exact contracts before either task can be selectable.
DO $source_85_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=85 AND slug='donkey-kick';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 85 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-85', display_name='Donkey Kick / Bunny Hop Identity Quarantine — Source 85', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','donkey_kick_vs_bunny_hop_start_action_hip_height_foot_travel_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('donkey_kick_vs_bunny_hop','start','hip_height','foot_travel','repetition_unit')) WHERE id=definition_id_value;
END;
$source_85_quarantine$;
