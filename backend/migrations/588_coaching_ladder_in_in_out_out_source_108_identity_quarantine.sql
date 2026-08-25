-- Source 108 conflates forward and lateral in-in-out-out ladder travel.  The
-- travel axis changes lane layout, entry, side dose, contact order, exit, and
-- fatigue accounting; its active card also lacks operational contracts.
DO $source_108_quarantine$
DECLARE definition_id_value UUID;
BEGIN
  SELECT id INTO definition_id_value FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=108 AND slug='ladder-in-in-out-out';
  IF definition_id_value IS NULL THEN RAISE EXCEPTION 'Source 108 canonical definition missing'; END IF;
  UPDATE coaching.exercise_variant_v1 SET variant_key='identity-quarantine-source-108', display_name='Ladder In-In-Out-Out Forward / Lateral Identity Quarantine — Source 108', status='archived',
    requirements_json=jsonb_build_object('selectable',false,'identityQuarantine',true,'unresolvedContract','forward_vs_lateral_travel_ladder_or_cone_grid_entry_side_dose_contact_order_exit_count_load_and_fatigue_are_conflated'), difficulty_json='{}'::JSONB, load_profile_json='{}'::JSONB, fatigue_profile_json='{}'::JSONB, programming_profile_json=jsonb_build_object('selectable',false,'humanReviewRequired',true,'publicationQuarantined',true)
  WHERE definition_id=definition_id_value AND variant_key='baseline';
  UPDATE coaching.exercise_definition_v1 SET status='archived',card_version=card_version+1,provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object('sourceDisposition','identity_quarantine','humanReviewRequired',true,'approvalsCreated',false,'publicationQuarantined',true,'legacyMediaDisposition','retained_unverified_non_embedded_candidates_only','unresolvedIdentity',jsonb_build_array('forward_vs_lateral_travel','ladder_vs_cone_grid','entry_side_dose_and_contact_order','exit_count_load_and_fatigue')) WHERE id=definition_id_value;
END;
$source_108_quarantine$;
