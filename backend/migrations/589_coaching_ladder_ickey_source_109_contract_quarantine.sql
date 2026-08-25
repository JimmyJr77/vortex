-- Source 109's Ickey walkthrough lacks ladder orientation, travel direction,
-- lead side, box count, entry, exit, cadence, load, fatigue, and media mapping.
DO $source_109_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=109 AND slug='ladder-ickey-shuffle';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 109 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-109', display_name='Ladder Ickey Shuffle Contract Quarantine — Source 109', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','ladder_orientation_travel_direction_lead_side_box_count_entry_exit_cadence_load_fatigue_and_media_variant_assignment_are_unspecified'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('ladder_orientation_and_travel_direction','lead_side_and_box_count','entry_exit_cadence','load_fatigue_and_media_assignment')) WHERE id=definition_id_value;
END;
$source_109_quarantine$;
