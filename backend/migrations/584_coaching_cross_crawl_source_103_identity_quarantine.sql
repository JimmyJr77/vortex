-- Source 103 conflates stationary and forward-traveling cross-crawl marching.
-- Displacement, support sequence, space, duration, fatigue, and exit differ.
DO $source_103_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=103 AND slug='cross-crawl-march';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 103 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-103', display_name='Cross-Crawl March In-Place / Traveling Identity Quarantine — Source 103', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','stationary_vs_forward_travel_base_contact_sequence_side_order_arm_contact_distance_duration_exit_and_count_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('stationary_vs_forward_travel','contact_sequence_and_side_order','arm_contact','distance_duration_exit_and_count')) WHERE id=definition_id_value;
END;
$source_103_quarantine$;
